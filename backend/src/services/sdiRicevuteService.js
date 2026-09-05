// Recupero automatico via IMAP delle ricevute/notifiche del Sistema di Interscambio (SDI)
// dalla stessa casella PEC usata per l'invio, con archiviazione locale e notifica desktop.
//
// IMPORTANTE: legge in sola lettura (nessun delete/move/flag) e tocca SOLO i messaggi
// il cui mittente è il dominio ufficiale SDI (@pec.fatturapa.it) — ogni altra email nella
// casella resta intoccata e non viene nemmeno scaricata nel dettaglio.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { sdiLogger } from '../lib/logger.js';
import { notificaMac } from '../lib/macNotifier.js';
import { messaggioPerCodice } from './scartoSuggerimenti.js';
import { generaNomeFileXml } from './fatturaPaXmlGenerator.js';
import { listMesiFatturati, getInvoice } from './invoiceService.js';

// Finestra massima di attesa risposta SDI dopo un invio: passato questo tempo dall'ultimo
// invio di una fattura, si considera l'esito "in ritardo" e non più motivo per continuare
// il polling automatico (resta comunque disponibile il ping manuale in Impostazioni).
const FINESTRA_ATTESA_RISPOSTA_MS = 72 * 60 * 60 * 1000;

const MITTENTE_SDI_DOMINIO = '@pec.fatturapa.it';

// Tipo di ricevuta riconosciuto dal prefisso standard del nome file XML allegato.
const PREFISSI_TIPO_RICEVUTA = {
  RC: 'Ricevuta di Consegna',
  NS: 'Notifica di Scarto',
  MC: 'Mancata Consegna',
  NE: 'Notifica Esito (accettazione/rifiuto committente)',
  EC: 'Notifica Esito Cedente',
  DT: 'Decorrenza Termini',
  AT: 'Attestazione di Trasmissione (mancato recapito)',
};

function riconosciTipo(nomeFile) {
  const prefisso = Object.keys(PREFISSI_TIPO_RICEVUTA).find(p => nomeFile.toUpperCase().includes(`_${p}_`));
  return prefisso ? { codice: prefisso, descrizione: PREFISSI_TIPO_RICEVUTA[prefisso] } : { codice: 'ALTRO', descrizione: 'Allegato SDI non classificato' };
}

// Sottocartelle di smistamento per esito, create automaticamente sotto la cartella archivio.
const SOTTOCARTELLE = {
  ACCETTATE: 'Accettate',
  RIFIUTATE: 'Rifiutate',
  MANCATA_CONSEGNA: 'MancataConsegna',
  NON_CLASSIFICATE: 'NonClassificate',
};

// Esito dichiarato dal committente dentro una Notifica Esito (NE): EC01 accettata, EC02 rifiutata.
function esitoNotificaEsito(contenutoXml) {
  const match = contenutoXml.toString('utf8').match(/<Esito>\s*(EC0[12])\s*<\/Esito>/i);
  return match?.[1]?.toUpperCase() === 'EC02' ? 'rifiutata' : 'accettata';
}

// Determina la sottocartella di destinazione in base al tipo di ricevuta/notifica e,
// solo per NE (che può contenere sia accettazione che rifiuto), al suo contenuto.
function risolviSottocartella(codiceTipo, contenutoXml) {
  switch (codiceTipo) {
    case 'RC': case 'DT': case 'EC':
      return SOTTOCARTELLE.ACCETTATE;
    case 'NS':
      return SOTTOCARTELLE.RIFIUTATE;
    case 'MC': case 'AT':
      return SOTTOCARTELLE.MANCATA_CONSEGNA;
    case 'NE':
      return esitoNotificaEsito(contenutoXml) === 'rifiutata' ? SOTTOCARTELLE.RIFIUTATE : SOTTOCARTELLE.ACCETTATE;
    default:
      return SOTTOCARTELLE.NON_CLASSIFICATE;
  }
}

// Anno della ricevuta: letto dalla data della fattura originale citata nell'XML (più
// affidabile della data di ricezione mail per associare l'archivio all'anno di competenza).
// Fallback sull'anno corrente se il tag non è presente/parsabile.
// Tag data noti nei tracciati di ricevuta/notifica SDI, in ordine di preferenza: la data
// dell'evento SDI stesso (ricezione/consegna/mancata consegna/esito) prima di quella della
// fattura originale che il documento referenzia, per evitare di ancorarsi al tag sbagliato.
const TAG_DATA_SDI = ['DataOraRicezione', 'DataOraConsegna', 'DataOraMancataConsegna', 'DataOra'];

function annoRicevuta(contenutoXml) {
  const testo = contenutoXml.toString('utf8');
  for (const tag of TAG_DATA_SDI) {
    const match = testo.match(new RegExp(`<${tag}>(\\d{4})-\\d{2}-\\d{2}`));
    if (match) return match[1];
  }
  const fallback = testo.match(/<Data>(\d{4})-\d{2}-\d{2}<\/Data>/);
  return fallback?.[1] ?? String(new Date().getFullYear());
}

// SDI include nel testo di <Descrizione>/<Suggerimento> nomi di tag XML citati
// letteralmente (es. "1.1.1.2 &lt;IdCodice&gt; non valido"): vanno decodificati una
// volta qui, altrimenti l'interpolazione Vue li ri-escapa mostrando "&lt;" a video.
function decodeEntitaXml(testo) {
  return testo?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') ?? null;
}

// Estrae la lista errori dichiarati in una Notifica di Scarto (NS): ogni <Errore> ha
// codice/descrizione/suggerimento ufficiali SDI (es. 00300 "IdCodice non valido").
export function estraiErroriScarto(contenutoXml) {
  const testo = contenutoXml.toString('utf8');
  const blocchi = testo.match(/<Errore>[\s\S]*?<\/Errore>/g) || [];
  return blocchi.map((blocco) => {
    const codice = blocco.match(/<Codice>\s*([^<]+?)\s*<\/Codice>/)?.[1] ?? null;
    return {
      codice,
      descrizione: decodeEntitaXml(blocco.match(/<Descrizione>\s*([\s\S]+?)\s*<\/Descrizione>/)?.[1]),
      suggerimento: decodeEntitaXml(blocco.match(/<Suggerimento>\s*([\s\S]+?)\s*<\/Suggerimento>/)?.[1]),
      dettaglio: messaggioPerCodice(codice),
    };
  });
}

function creaClientImap(pecConfig) {
  return new ImapFlow({
    host: pecConfig.imapHost,
    port: pecConfig.imapPort,
    secure: pecConfig.imapSecure,
    auth: { user: pecConfig.casellaMittente, pass: pecConfig.passwordMittente },
    logger: false,
  });
}

/**
 * Controlla la casella PEC per nuove email da SDI, scarica gli allegati XML,
 * li salva nella cartella archivio configurata e notifica l'utente.
 * @returns {Promise<{ nuove: number, errore?: string }>}
 */
export async function controllaRicevuteSdi(pecConfig, percorsoArchivio) {
  if (!pecConfig.imapHost || !pecConfig.casellaMittente || !pecConfig.passwordMittente) {
    const errore = 'Configurazione IMAP incompleta: compila i dati PEC in Impostazioni.';
    await sdiLogger.error(`Controllo ricevute bloccato: ${errore}`);
    return { nuove: 0, errore };
  }
  if (!percorsoArchivio) {
    const errore = 'Cartella archivio SDI non configurata.';
    await sdiLogger.error(`Controllo ricevute bloccato: ${errore}`);
    return { nuove: 0, errore };
  }

  const client = creaClientImap(pecConfig);
  let nuove = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Solo messaggi non ancora letti dal dominio SDI ufficiale: non tocca il resto della casella.
      const messaggiTrovati = await client.search({ seen: false, from: MITTENTE_SDI_DOMINIO }, { uid: true });
      for (const uid of messaggiTrovati || []) {
        const { content } = await client.download(uid, undefined, { uid: true });
        if (!content) {
          await sdiLogger.error(`Email SDI senza contenuto scaricabile, ignorata (uid ${uid})`);
          continue;
        }
        const email = await simpleParser(content);
        await sdiLogger.info(`Email SDI ricevuta: ${email.subject}`, { da: email.from?.text });

        // L'XML FatturaPA può arrivare come allegato diretto (alcune ricevute SDI) oppure
        // imbustato in un .eml di trasporto (es. postacert.eml di Aruba/Legalmail): si
        // raccolgono entrambe le fonti, senza assumere quale delle due sia usata.
        const allegatiDiretti = email.attachments || [];
        // eml.content può mancare se l'allegato non è stato scaricato per intero da
        // ImapFlow (stesso motivo del guard su "content" sopra): si scarta silenziosamente
        // invece di far fallire l'intero giro di polling per un singolo allegato vuoto.
        const allegatiEml = allegatiDiretti.filter(a => a.filename?.toLowerCase().endsWith('.eml') && a.content);
        const allegatiImbustati = (await Promise.all(
          allegatiEml.map(async (eml) => (await simpleParser(eml.content)).attachments || [])
        )).flat();
        const tuttiGliAllegati = [...allegatiDiretti, ...allegatiImbustati];

        for (const allegato of tuttiGliAllegati) {
          const nomeFile = allegato.filename?.toLowerCase();
          // daticert.xml è il solo metadato di certificazione PEC (non un documento SDI): si scarta.
          if (!nomeFile?.endsWith('.xml') || nomeFile === 'daticert.xml') continue;
          const tipo = riconosciTipo(allegato.filename);
          const anno = annoRicevuta(allegato.content);
          const sottocartella = risolviSottocartella(tipo.codice, allegato.content);
          const cartellaDestinazione = path.join(percorsoArchivio, anno, sottocartella);
          await mkdir(cartellaDestinazione, { recursive: true });
          const destinazione = path.join(cartellaDestinazione, path.basename(allegato.filename));
          await writeFile(destinazione, allegato.content);
          nuove += 1;
          await sdiLogger.info(`Archiviato ${allegato.filename} (${tipo.descrizione})`, { destinazione });
          notificaMac('Ricevuta SDI', `${tipo.descrizione}: ${allegato.filename}`);
        }
        // Segna come letta la sola email SDI appena processata (nessun'altra email toccata).
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    await sdiLogger.error('Errore durante il controllo ricevute SDI', { errore: err.message, stack: err.stack });
    notificaMac('Errore ricezione SDI', err.message);
    return { nuove, errore: err.message };
  } finally {
    await client.logout().catch(() => {});
  }

  if (nuove > 0) notificaMac('Ricevute SDI', `${nuove} nuovo/i documento/i archiviato/i`);
  return { nuove };
}

/**
 * Elenca le ricevute SDI già archiviate su disco per una specifica fattura,
 * riconoscendo il file dal nome standard IT<piva>_<progressivo>_<TIPO>.xml
 * (stesso prefisso del file XML fattura generato da generaNomeFileXml).
 * @returns {Promise<Array<{ nomeFile, tipo, descrizione, data }>>}
 */
export async function listaRicevutePerFattura(percorsoArchivio, prefissoNomeFile) {
  if (!percorsoArchivio || !prefissoNomeFile) return [];
  return listaRicevuteArchivio(percorsoArchivio, prefissoNomeFile);
}

// Tipi di ricevuta che equivalgono ad accettazione della fattura da parte dello SDI
// (RC/DT: accettata dal sistema; EC: esito accettato dal committente, già filtrato da
// risolviSottocartella/esitoNotificaEsito in fase di archiviazione).
const TIPI_ACCETTAZIONE = new Set(['RC', 'DT', 'EC']);

/**
 * Stato SDI corrente di una fattura, determinato dalla ricevuta più recente tra tutti i
 * tentativi di invio registrati (invoice.invii), letta dalle ricevute già archiviate su
 * disco — nessuno stato duplicato: la ricevuta su disco resta l'unica fonte di verità.
 * Una fattura mai inviata o senza ricevute ancora arrivate risulta 'in-attesa'.
 * @returns {Promise<{ stato: 'accettata'|'scartata'|'in-attesa', data: string|null }>}
 */
export async function statoSdiFattura(invoice, config) {
  // Fattura storica importata da XML FatturaPA: il documento esiste solo perché è già
  // stato realmente trasmesso e accettato, anche se qui invii[] è vuoto (l'invio non è
  // mai passato da questa app) — trattata sempre come accettata, mai rigenerabile.
  if (invoice?.importataDaStorico) return { stato: 'accettata', data: invoice.data ?? null };

  const invii = invoice?.invii ?? [];
  if (invii.length === 0) return { stato: 'in-attesa', data: null };

  const perProgressivo = await Promise.all(invii.map(({ progressivoInvio }) => {
    const prefisso = generaNomeFileXml(config.fornitore, progressivoInvio).replace(/\.xml$/i, '');
    return listaRicevutePerFattura(config.sdi.percorsoArchivio, prefisso);
  }));
  const tutte = perProgressivo.flat().sort((a, b) => b.data.localeCompare(a.data));
  const ultima = tutte.find((r) => TIPI_ACCETTAZIONE.has(r.tipo) || r.tipo === 'NS');
  if (!ultima) return { stato: 'in-attesa', data: null };
  return { stato: TIPI_ACCETTAZIONE.has(ultima.tipo) ? 'accettata' : 'scartata', data: ultima.data };
}

/**
 * Elenca tutte le ricevute SDI archiviate su disco, di qualunque fattura (usato dalla
 * pagina Cronologia). Stessa scansione di cartelle di listaRicevutePerFattura ma senza
 * filtro di prefisso.
 * @returns {Promise<Array<{ nomeFile, tipo, descrizione, data }>>}
 */
export async function listaTutteRicevute(percorsoArchivio) {
  if (!percorsoArchivio) return [];
  return listaRicevuteArchivio(percorsoArchivio, '');
}

async function listaRicevuteArchivio(percorsoArchivio, prefissoNomeFile) {
  // Le ricevute sono smistate in <archivio>/<anno>/<esito>/ (Accettate/Rifiutate/...); si
  // scandiscono anche la cartella archivio e le sue sottocartelle esito direttamente, per
  // restare compatibili con l'eventuale struttura pre-smistamento per anno.
  let sottodirArchivio = [];
  try {
    sottodirArchivio = (await readdir(percorsoArchivio, { withFileTypes: true }))
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch { /* cartella archivio non ancora creata */ }
  const cartelleEsito = Object.values(SOTTOCARTELLE);
  const cartelleAnno = sottodirArchivio.filter(nome => /^\d{4}$/.test(nome));
  const cartelle = [
    percorsoArchivio,
    ...cartelleEsito.map(c => path.join(percorsoArchivio, c)),
    ...cartelleAnno.flatMap(anno => cartelleEsito.map(c => path.join(percorsoArchivio, anno, c))),
  ];
  const ricevute = (await Promise.all(cartelle.map(async (cartella) => {
    let file;
    try {
      file = await readdir(cartella);
    } catch {
      return []; // cartella non ancora creata: nessuna ricevuta qui
    }
    const trovati = file.filter((f) => f.startsWith(prefissoNomeFile) && f.toLowerCase().endsWith('.xml'));
    return Promise.all(trovati.map(async (nomeFile) => {
      const percorso = path.join(cartella, nomeFile);
      const tipo = riconosciTipo(nomeFile);
      const info = await stat(percorso);
      const ricevuta = { nomeFile, tipo: tipo.codice, descrizione: tipo.descrizione, data: info.mtime.toISOString() };
      // Solo per le notifiche di scarto (NS) si legge il contenuto per estrarre il
      // dettaglio errori SDI: le altre ricevute non hanno <ListaErrori> da mostrare.
      if (tipo.codice === 'NS') {
        ricevuta.errori = estraiErroriScarto(await readFile(percorso));
      }
      return ricevuta;
    }));
  }))).flat();
  return ricevute.sort((a, b) => b.data.localeCompare(a.data));
}

// Vero se esiste almeno una fattura ancora "in-attesa" di risposta SDI il cui ultimo
// invio è avvenuto entro la finestra di attesa: in tal caso vale la pena interrogare la
// PEC. Fatture con invio più vecchio della finestra sono considerate "in ritardo" e non
// giustificano più il polling automatico da sole (si presume risposta persa/da gestire
// a mano). Invii ripetuti a distanza di minuti/ore sulla stessa fattura non fanno perdere
// la finestra: conta solo il dataInvio più recente di ciascuna fattura.
async function inAttesaRispostaRecente(config) {
  const mesi = await listMesiFatturati();
  const fatture = await Promise.all(mesi.map((m) => getInvoice(m.anno, m.mese, m.clienteId)));
  const ora = Date.now();
  for (const invoice of fatture) {
    const ultimoInvio = invoice?.invii?.at(-1)?.dataInvio;
    if (!ultimoInvio) continue;
    if (ora - new Date(ultimoInvio).getTime() > FINESTRA_ATTESA_RISPOSTA_MS) continue;
    const { stato } = await statoSdiFattura(invoice, config);
    if (stato === 'in-attesa') return true;
  }
  return false;
}

let timerPolling = null;

// Avvia il controllo periodico in background; richiamato all'avvio del server.
// Ad ogni giro rilegge la config per rispettare il flag pollingAbilitato anche se
// cambiato a runtime dall'utente in Impostazioni, senza dover riavviare il servizio.
// Se la config IMAP non è compilata, il ping semplicemente non troverà nulla da fare
// e loggerà l'errore ad ogni giro (visibile in sdi.log) finché non viene configurata.
export function avviaPollingSdi(getConfig, minuti) {
  fermaPollingSdi();
  const intervalloMs = Math.max(1, minuti) * 60 * 1000;
  timerPolling = setInterval(async () => {
    const config = await getConfig();
    if (!config.sdi.pollingAbilitato) return;
    if (!(await inAttesaRispostaRecente(config))) return;
    await controllaRicevuteSdi(config.pec, config.sdi.percorsoArchivio);
  }, intervalloMs);
}

export function fermaPollingSdi() {
  if (timerPolling) clearInterval(timerPolling);
  timerPolling = null;
}
