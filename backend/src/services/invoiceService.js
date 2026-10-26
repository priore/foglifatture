// Calcolo e archiviazione della Fattura Pro-Forma: ore * tariffa oraria + bollo virtuale condizionale.
import { randomBytes } from 'node:crypto';
import { readJson, writeJson, listKeys, listEstranei, listNomi } from '../lib/jsonStore.js';
import { leggiRegistro, registraNumero, liberaPrenotazioniOrfane, FILE_REGISTRO } from './numerazioneService.js';
import { sincronizzaPrimaDiEmettere } from '../lib/cloudHook.js';

// Nome valido di un file in invoices/: anno-mese-clienteId. Altro (copie in conflitto dei
// provider cloud, file estranei) non è una fattura e va segnalato, non letto.
const FORMATO_CHIAVE = /^\d{4}-\d{2}-[A-Za-z0-9_-]+$/;

function chiaveMese(anno, mese, clienteId) {
  return `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
}

function percorsoFile(anno, mese, clienteId) {
  return `invoices/${chiaveMese(anno, mese, clienteId)}.json`;
}

// Spacca una chiave "anno-mese-clienteId" nelle sue parti. clienteId può contenere
// trattini (uuid), quindi si spacca solo sui primi due segmenti, il resto è l'id.
function parseChiave(chiave) {
  const [anno, mese, ...restoId] = chiave.split('-');
  return { chiave, anno: Number(anno), mese: Number(mese), clienteId: restoId.join('-') };
}

// Calcola bollo (dichiarato nell'XML FatturaPA se dovuto) e netto a pagare a partire
// da un imponibile già noto. Il bollo non va in tabella nella fattura pro-forma né
// sommato al netto richiesto al cliente: resta solo l'indicazione legale "assolta in
// modo virtuale" e il campo DatiBollo XML. Regime forfettario: nessuna rivalsa INPS,
// nessuna ritenuta d'acconto.
export function calcolaBollo(imponibile, sogliaBolloVirtuale, importoBollo, rivalsaAliquota = 0) {
  const rivalsaInps = rivalsaAliquota > 0 ? Number((imponibile * rivalsaAliquota / 100).toFixed(2)) : 0;
  const totaleConRivalsa = Number((imponibile + rivalsaInps).toFixed(2));
  // La soglia (DPR 642/72, Tariffa all. A parte I art. 13) vale sul totale del documento:
  // la rivalsa INPS è parte dell'importo e concorre, il bollo stesso no.
  const bolloApplicabile = totaleConRivalsa > sogliaBolloVirtuale;
  const bollo = bolloApplicabile ? importoBollo : 0;
  return { imponibile, bolloApplicabile, bollo, rivalsaInps, nettoAPagare: totaleConRivalsa };
}

// Imponibile da timesheet: ore * tariffa oraria.
export function calcolaCompenso({ totaleOre, tariffaOraria, sogliaBolloVirtuale, importoBollo, rivalsaAliquota = 0 }) {
  const imponibile = Number((totaleOre * tariffaOraria).toFixed(2));
  return calcolaBollo(imponibile, sogliaBolloVirtuale, importoBollo, rivalsaAliquota);
}

// Arricchisce una fattura letta da disco con lo stato pagamento derivato da pagamenti[].
// Va chiamata da ogni funzione che legge una fattura per uso relativo al pagamento
// (fattureAperte, ricaviAnnoCassa, dashboard, export) — non serve per letture che
// riguardano solo dati fiscali/anagrafici (es. verificaIntegritaNumerazione).
export function arricchisciStatoPagamento(fattura) {
  if (!fattura) return fattura;
  // ponytail: migrazione one-time in lettura, mai scritta su disco automaticamente —
  // il file JSON passa al nuovo formato solo alla prossima scrittura naturale
  // (nuovo pagamento via confermaPagamento, o rigenerazione fattura).
  const pagamenti = fattura.pagamenti ?? (
    fattura.dataPagamento
      ? [{ data: fattura.dataPagamento, importo: fattura.nettoAPagare }]
      : []
  );
  const totalePagato = Number(pagamenti.reduce((s, p) => s + p.importo, 0).toFixed(2));
  // Nota di credito (TD04) emessa: riduce il dovuto. Se il cliente aveva già pagato di più,
  // `daRimborsare` lo segnala, ma i ricavi per cassa non si riducono (vedi CONCORRENZA_GAP, K4).
  const dovuto = Number((fattura.nettoAPagare - (fattura.notaCredito?.nettoAPagare ?? 0)).toFixed(2));
  const residuo = Number((dovuto - totalePagato).toFixed(2));
  const daRimborsare = fattura.notaCredito ? Math.max(0, -residuo) : 0;
  const dataPagamento = pagamenti.length ? pagamenti.at(-1).data : null;
  return {
    ...fattura,
    pagamenti,
    dataPagamento,
    totalePagato,
    residuo,
    daRimborsare,
    stato: dovuto <= 0 ? 'stornata' : (residuo <= 0 ? 'pagata' : (totalePagato > 0 ? 'parziale' : 'aperta')),
  };
}

export async function getInvoice(anno, mese, clienteId) {
  return readJson(percorsoFile(anno, mese, clienteId), null);
}

export async function saveInvoice(anno, mese, clienteId, invoice) {
  await writeJson(percorsoFile(anno, mese, clienteId), invoice);
  return invoice;
}

// Termine di pagamento pattuito col cliente: dato commerciale, non fiscale (finisce in
// DatiPagamento solo se l'XML non è ancora stato trasmesso), scrivibile anche a fattura già accettata da SDI — a
// differenza di importo/descrizione/numero, che passano da /genera e restano bloccati.
export async function impostaScadenzaPagamento(anno, mese, clienteId, dataScadenzaPagamento) {
  const invoice = await getInvoice(anno, mese, clienteId);
  if (!invoice) throw new Error('Fattura non trovata');
  invoice.dataScadenzaPagamento = dataScadenzaPagamento || null;
  await saveInvoice(anno, mese, clienteId, invoice);
  return invoice;
}

// Restituisce le chiavi già parsate ({ chiave, anno, mese, clienteId }), non stringhe
// grezze: evita che ogni consumatore debba rifare split('-') su un formato composito.
export async function listMesiFatturati() {
  const chiavi = await listKeys('invoices', FORMATO_CHIAVE);
  return chiavi.map(parseChiave).sort((a, b) => a.chiave.localeCompare(b.chiave));
}

// Prossimo numero fattura (progressivo puro, senza barra/anno: formato più compatibile
// con lo SDI secondo esperienza pregressa). Se il mese ha già una fattura salvata per
// questo cliente ne riusa il numero (una rigenerazione non deve consumare un nuovo
// progressivo). Il progressivo è unico per fornitore/P.IVA, non per cliente: conta le
// fatture effettivamente scritte su disco (tutteLeFatture), non le entry di directory.
export async function prossimoNumeroFattura(anno, mese, clienteId) {
  const esistente = await getInvoice(anno, mese, clienteId);
  if (esistente) return esistente.numero;
  return prossimoNumeroInSequenza();
}

// Numero successivo della sequenza unica (fatture + note di credito), senza riusare quello di
// alcuna fattura esistente: serve per documenti nuovi come la nota di credito.
// Conta anche il registro di numerazione: un numero prenotato da un altro dispositivo, la
// cui fattura non è ancora arrivata, non si riusa.
export async function prossimoNumeroInSequenza() {
  return String(await ultimoNumeroEmesso() + 1);
}

async function ultimoNumeroEmesso() {
  const numeri = (await tutteLeFatture()).map((f) => Number(f.numero));
  return Math.max(0, ...numeri, (await leggiRegistro()).ultimoNumero);
}

// Legge tutte le fatture esistenti (tutti i mesi, tutti i clienti), ordinate per numero
// progressivo. clienteId viene letto dal contenuto della fattura deserializzata (dove
// saveInvoice lo scrive esplicitamente), mai dalla chiave file: questo evita che il
// progressivo Number(f.numero) confonda il clienteId con parte del numero fattura.
async function tutteLeFatture() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(
    chiavi.map(({ anno, mese, clienteId }) => getInvoice(anno, mese, clienteId))
  );
  // Le note di credito condividono la sequenza numerica (progressivo unico per P.IVA).
  const note = fatture.filter((f) => f?.notaCredito).map((f) => ({ ...f.notaCredito, anno: f.anno, mese: f.mese, clienteId: f.clienteId, nota: true }));
  return [...fatture.filter(Boolean), ...note].sort((a, b) => Number(a.numero) - Number(b.numero));
}

// ProgressivoInvio SDI: a differenza del numero fattura (che identifica il documento
// fiscale e non cambia mai), il progressivo identifica il singolo TENTATIVO di
// trasmissione — ogni invio o reinvio via PEC (anche dopo scarto) ne consuma uno nuovo.
// SDI rifiuta come "00002 nome file duplicato" qualunque nome già visto per lo stesso
// trasmittente, anche a distanza di mesi/anni e anche da gestionali precedenti (visto
// coi progressivi alfanumerici tipo "XEYon" nell'archivio storico) — un contatore
// sequenziale locale (1, 2, 3…) può quindi collidere con progressivi mai registrati nel
// nostro DB. Alfanumerico casuale rende la collisione trascurabile senza dover conoscere
// lo storico completo presso SDI — ma il PROGRESSIVO nel nome file (a differenza del tag
// <ProgressivoInvio> nell'XML, che può arrivare a 10 caratteri) è vincolato dalle regole
// di nomenclatura SDI a max 5 caratteri, solo A-Z maiuscole e 0-9 (scarto 00001 altrimenti).
const ALFABETO_PROGRESSIVO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function prossimoProgressivoInvio() {
  const byte = randomBytes(5);
  return Array.from(byte, (b) => ALFABETO_PROGRESSIVO[b % ALFABETO_PROGRESSIVO.length]).join('');
}

// Verifica che `numero` sia valido rispetto alle fatture già emesse: nessun duplicato,
// nessun salto nella sequenza (deve essere l'ultimo progressivo + 1) — la sequenza resta
// UNICA cross-cliente (obbligo legale: il progressivo è per P.IVA fornitore, non per
// cliente). Si esclude dal controllo solo la fattura dello stesso cliente/stesso mese
// (una rigenerazione riusa il proprio numero); la fattura di un altro cliente nello
// stesso mese civile resta nel controllo sequenza.
export async function verificaIntegritaNumerazione(anno, mese, clienteId, numero) {
  const tutte = await tutteLeFatture();
  const fatturaCorrente = tutte.find(
    (f) => !f.nota && f.anno === anno && f.mese === mese && f.clienteId === clienteId
  );
  // Rigenerare una fattura che riusa esattamente il proprio numero esistente è sempre
  // valido, anche se non è più l'ultima della sequenza globale (con più clienti, altre
  // fatture più recenti di altri clienti possono essere state generate nel frattempo —
  // a differenza del caso a singolo cliente, "riusare il proprio numero" non coincide
  // più sempre con "essere l'ultimo della sequenza").
  if (fatturaCorrente && String(fatturaCorrente.numero) === String(numero)) {
    return { valido: true };
  }

  const fatture = tutte.filter(
    (f) => f.nota || !(f.anno === anno && f.mese === mese && f.clienteId === clienteId)
  );

  const duplicato = fatture.find((f) => String(f.numero) === String(numero));
  if (duplicato) {
    return {
      valido: false,
      errore: `Numero fattura ${numero} già usato per ${duplicato.anno}-${String(duplicato.mese).padStart(2, '0')}`,
    };
  }

  const ultimoNumero = Math.max(0, ...fatture.map((f) => Number(f.numero)), (await leggiRegistro()).ultimoNumero);
  if (ultimoNumero === 0) {
    if (String(numero) !== '1') {
      return { valido: false, errore: `Prima fattura: il numero deve essere 1, non ${numero}` };
    }
    return { valido: true };
  }

  const atteso = ultimoNumero + 1;
  if (Number(numero) !== atteso) {
    return { valido: false, errore: `Numero fattura non sequenziale: atteso ${atteso}, ricevuto ${numero}` };
  }

  return { valido: true };
}

// Scansione completa della sequenza (prima di ogni emissione). Bloccanti: numeri duplicati,
// file estranei in invoices/ (copie in conflitto incluse) e copie in conflitto del registro.
// I buchi non bloccano (una fattura non ancora sincronizzata, o un import storico, li crea)
// e i numeri prenotati senza fattura sono solo informativi.
export async function scansionaSequenza() {
  const [estranei, documenti, registro, nomiRadice] = await Promise.all([
    listEstranei('invoices', FORMATO_CHIAVE), tutteLeFatture(), leggiRegistro(), listNomi(''),
  ]);
  const perNumero = new Map();
  for (const d of documenti) {
    const etichetta = `${d.nota ? 'nota di credito ' : ''}${d.anno}-${String(d.mese).padStart(2, '0')} cliente ${d.clienteId}`;
    perNumero.set(Number(d.numero), [...(perNumero.get(Number(d.numero)) ?? []), etichetta]);
  }
  const duplicati = [...perNumero].filter(([, docs]) => docs.length > 1).map(([numero, docs]) => ({ numero, documenti: docs }));
  const massimo = Math.max(0, ...perNumero.keys());
  const buchi = Array.from({ length: massimo }, (_, i) => i + 1).filter((n) => !perNumero.has(n));
  const inAttesa = Object.keys(registro.numeri).map(Number).filter((n) => !perNumero.has(n)).sort((a, b) => a - b);
  const registroConflitto = nomiRadice.filter((n) => n.startsWith(FILE_REGISTRO) && n !== FILE_REGISTRO);
  return { ok: !duplicati.length && !estranei.length && !registroConflitto.length, duplicati, estranei, registroConflitto, buchi, inAttesa };
}

// Doppione nato da due dispositivi che hanno preso lo stesso numero. Tiene il numero il documento già
// trasmesso o pagato, poi il più vecchio (criterio dei soli dati: ogni dispositivo sceglie lo stesso vincitore
// anche con un registro non ancora allineato); gli altri, se mai usciti dall'app, passano al primo numero libero.
// Un documento già trasmesso non si rinumera: il doppione resta e blocca.
const giaUscito = (d) => Boolean(d.invii?.length || d.dataPagamento || d.pagamenti?.length);

export async function riparaDuplicati() {
  const chiavi = await listMesiFatturati();
  const fatture = (await Promise.all(chiavi.map(({ anno, mese, clienteId }) => getInvoice(anno, mese, clienteId)))).filter(Boolean);
  const documenti = fatture.flatMap((f) => [{ f, d: f, nota: false }, ...(f.notaCredito ? [{ f, d: f.notaCredito, nota: true }] : [])]);
  const perNumero = Map.groupBy(documenti, ({ d }) => Number(d.numero));
  let massimo = Math.max((await leggiRegistro()).ultimoNumero, ...perNumero.keys());
  const priorita = ({ f, d, nota }) => [giaUscito(d) ? 0 : 1, f.anno * 100 + f.mese, f.clienteId, nota ? 1 : 0];
  const confronta = (a, b) => { const [pa, pb] = [priorita(a), priorita(b)]; const i = pa.findIndex((v, k) => v !== pb[k]); return i < 0 ? 0 : pa[i] < pb[i] ? -1 : 1; };
  const riparati = [];
  for (const [numero, gruppo] of perNumero) {
    if (gruppo.length < 2) continue;
    gruppo.sort(confronta);
    const [vincitore, ...altri] = gruppo;
    await registraNumero(numero, { anno: vincitore.f.anno, mese: vincitore.f.mese, clienteId: vincitore.f.clienteId, nota: vincitore.nota, riassegna: true });
    for (const { f, d, nota } of altri) {
      if (giaUscito(d)) continue;
      const nuovo = ++massimo;
      await registraNumero(nuovo, { anno: f.anno, mese: f.mese, clienteId: f.clienteId, nota });
      d.numero = String(nuovo);
      await saveInvoice(f.anno, f.mese, f.clienteId, f);
      riparati.push({ anno: f.anno, mese: f.mese, clienteId: f.clienteId, nota, da: numero, a: nuovo });
    }
  }
  return riparati;
}

// Esito per l'emissione: ok, oppure il messaggio che spiega perché è bloccata.
export async function verificaSequenzaPerEmissione() {
  try {
    await sincronizzaPrimaDiEmettere();
  } catch (err) {
    return { ok: false, errore: err.message };
  }
  const riparati = await riparaDuplicati();
  await liberaPrenotazioniOrfane((await tutteLeFatture()).map((d) => Number(d.numero)));
  const scan = await scansionaSequenza();
  if (scan.ok) return { ok: true, scan, riparati };
  const parti = [];
  if (scan.duplicati.length) parti.push(`numeri duplicati: ${scan.duplicati.map((d) => `${d.numero} (${d.documenti.join(', ')})`).join('; ')}`);
  if (scan.estranei.length) parti.push(`file estranei o copie in conflitto in invoices/: ${scan.estranei.join(', ')}`);
  if (scan.registroConflitto.length) parti.push(`copie in conflitto del registro di numerazione: ${scan.registroConflitto.join(', ')}`);
  return { ok: false, scan, errore: `Emissione bloccata, controlla l'archivio. ${parti.join('. ')}.` };
}
