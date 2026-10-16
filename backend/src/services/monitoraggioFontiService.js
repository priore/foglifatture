// Controllo periodico delle fonti normative: confronta l'impronta SHA-256 di ogni fonte
// del registro con quella dell'ultima run. Se diversa, scrive fonti-cambiate.json e notifica.
// Per fonti HTML e PDF con testo archiviato, propone nuovi valori via AI (verifica citazione).
// XLS: solo avviso hash, nessuna proposta AI.
// Fonti senza URL (es. dl89-2026): saltate senza errore.
//
// Pattern setInterval uguale a backupService/reminderService: tick ogni 30 min,
// ma esegue il controllo solo se sono passati abbastanza giorni dall'ultima run
// (7 giorni normalmente, 2 giorni nei periodi caldi: dic-feb per circolare INPS, mag-lug per proroghe).
// ponytail: tick corto + ultimoControllo persistito, così il restart del backend non azzera il timer.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson } from '../lib/jsonStore.js';
import { logger } from '../lib/logger.js';
import { notifica } from '../lib/notifier.js';
import PDFParser from 'pdf2json';

const TICK_MS = 30 * 60 * 1000; // 30 minuti

// Domini ufficiali consentiti. Match su hostname esatto o sottodominio.
export const DOMINI_UFFICIALI = [
  'agenziaentrate.gov.it',
  'normattiva.it',
  'gazzettaufficiale.it',
  'inps.it',
  'adm.gov.it',
  'fatturapa.gov.it',
  'agid.gov.it',
];

let timer = null;
let inCorso = false; // ponytail: evita sovrapposizione tick manuale + automatico

// Giorni da aspettare prima del prossimo controllo in base al mese corrente.
function giorniAttesa() {
  const m = new Date().getMonth() + 1; // 1-12
  // Periodi caldi: dic-feb (circolare INPS), mag-lug (proroghe AdE)
  if ([12, 1, 2, 5, 6, 7].includes(m)) return 2;
  return 7;
}

export function hostnameConsentito(url) {
  try {
    const h = new URL(url).hostname;
    return DOMINI_UFFICIALI.some(d => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
}

// Calcola SHA-256 di un buffer o stringa.
function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

// Estrae il testo visibile da HTML grezzo senza dipendenze: rimuove tag e decodifica entità base.
export function estraiTestoDaHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Estrae il testo da un PDF digitale (pdf2json, puro JS). Spazi/righe collassati per hash stabile.
// PDF scansionati (solo immagini) danno testo vuoto: l'errore evita una baseline hash di niente.
export async function estraiTestoDaPdf(buffer) {
  const raw = await new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    parser.on('pdfParser_dataError', e => reject(new Error(e?.parserError?.message ?? String(e?.parserError ?? e))));
    parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()));
    // pdf2json.parseBuffer legge dall'offset 0 del pool se il Buffer è una slice: serve un ArrayBuffer esatto
    parser.parseBuffer(Buffer.from(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length)));
  });
  const testo = raw.replace(/\s+/g, ' ').trim();
  if (!testo) throw new Error('PDF senza testo estraibile');
  return testo;
}

// Scarica una fonte e restituisce { hash, hashByte, testo } o lancia un errore.
// testo è valorizzato per HTML con selettoreContenuto e per PDF; hashByte serve solo
// a riconoscere la vecchia baseline PDF (impronta sui byte) senza falso "fonte cambiata".
async function scaricaFonte(voce) {
  const url = voce.urlDownload || voce.url;
  if (!url) throw new Error('URL non disponibile');

  // Verifica dominio sulla URL di download
  if (!hostnameConsentito(url)) throw new Error(`Dominio non consentito: ${new URL(url).hostname}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Verifica anche il dominio dopo eventuali redirect
  if (!hostnameConsentito(res.url)) throw new Error(`Redirect verso dominio non consentito: ${new URL(res.url).hostname}`);

  // Limite 10 MB
  const MAX_BYTES = 10 * 1024 * 1024;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`Risposta troppo grande (${buf.length} byte)`);

  const isHtml = (voce.formato === 'html') || res.headers.get('content-type')?.includes('text/html');
  if (isHtml && voce.selettoreContenuto) {
    const testo = estraiTestoDaHtml(buf.toString('utf-8'));
    return { hash: sha256(testo), testo };
  }
  const isPdf = voce.formato === 'pdf' || buf.subarray(0, 5).toString() === '%PDF-';
  if (isPdf) {
    const testo = await estraiTestoDaPdf(buf);
    return { hash: sha256(testo), hashByte: sha256(buf), testo };
  }
  // XLS o HTML senza selettore: hash dei byte raw
  return { hash: sha256(buf), testo: null };
}

// Raccoglie i campi del pacchetto regole che citano una fonte specifica (per idFonte).
// Restituisce array di { campo, sezione, valore, citazione }.
export function campiCitantiFonte(pacchetto, idFonte) {
  const risultati = [];
  function visita(obj, percorso) {
    if (!obj || typeof obj !== 'object') return;
    if ('fonti' in obj && typeof obj.fonti === 'object') {
      for (const [campo, ref] of Object.entries(obj.fonti)) {
        if (ref?.id === idFonte && ref?.citazione) {
          risultati.push({ campo: percorso ? `${percorso}.${campo}` : campo, valore: obj[campo], citazione: ref.citazione });
        }
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'fonti' && v && typeof v === 'object' && !Array.isArray(v)) {
        visita(v, percorso ? `${percorso}.${k}` : k);
      }
    }
  }
  visita(pacchetto, '');
  return risultati;
}

const FINESTRA_CHAR = 3000; // caratteri prima/dopo la citazione mancante
const CAP_AI = 8000;

// Costruisce il frammento di testo da inviare all'AI per un campo.
// Se la citazione attuale si trova oltre CAP_AI char, usa una finestra centrata sulla posizione.
// Se la citazione non si trova (testo cambiato), usa i primi CAP_AI char come fallback.
function _finestraTesto(nuovoTesto, citazione, normalizza) {
  const testoNorm = normalizza(nuovoTesto);
  const citNorm = normalizza(citazione);
  const idx = testoNorm.indexOf(citNorm.slice(0, 40)); // cerca i primi 40 char per posizione approssimata
  if (idx < 0 || idx < CAP_AI) return nuovoTesto.slice(0, CAP_AI);
  // Citazione oltre il cap: finestra centrata
  const start = Math.max(0, idx - FINESTRA_CHAR);
  const end = Math.min(nuovoTesto.length, idx + citazione.length + FINESTRA_CHAR);
  return nuovoTesto.slice(start, end);
}

// Importazione lazy per evitare cicli (aiRouterService → altri service)
async function proponiValoriDaAI(voce, nuovoTesto, campi, anno) {
  if (!campi.length) return [];
  const { chiamaAI } = await import('./aiRouterService.js');
  const { normalizzaPerCitazione } = await import('./fontiNormativeService.js');
  const testoNorm = normalizzaPerCitazione(nuovoTesto);

  const valide = [];

  // Processa ogni campo con la propria finestra di testo (B2: supera il cap 8000 char fisso)
  for (const campo of campi) {
    const frammento = _finestraTesto(nuovoTesto, campo.citazione, normalizzaPerCitazione);
    const prompt = `Sei un consulente fiscale italiano. Il seguente frammento di documento normativo è stato aggiornato:
--- FRAMMENTO ---
${frammento}
--- FINE FRAMMENTO ---

Controlla se il seguente campo fiscale del regime forfettario ${anno} ha un valore aggiornato nel frammento:
- ${campo.campo}: valore attuale ${JSON.stringify(campo.valore)}, citazione di riferimento: "${campo.citazione}"

Se trovi un valore aggiornato, rispondi SOLO con un array JSON:
[{"campo": "${campo.campo}", "valoreProposto": <valore>, "citazione": "frase esatta dal frammento"}]

Se il campo non è presente o non è cambiato, rispondi con: []
Regole: citazione ESATTA, stesso tipo del valore attuale (${typeof campo.valore}), solo JSON.`;

    let testo;
    try {
      ({ testo } = await chiamaAI(prompt, { soloApiKey: true }));
    } catch (err) {
      logger.warn(`monitoraggioFonti: AI non disponibile per ${campo.campo}`, { errore: err.message });
      continue;
    }

    const json = testo.replace(/^```[^\n]*\n?/m, '').replace(/```$/m, '').trim();
    let proposte;
    try {
      proposte = JSON.parse(json);
      if (!Array.isArray(proposte)) continue;
    } catch {
      logger.warn('monitoraggioFonti: risposta AI non è JSON valido', { risposta: testo.slice(0, 200) });
      continue;
    }

    for (const p of proposte) {
      if (p.campo !== campo.campo) continue; // solo il campo richiesto
      if (p.valoreProposto === undefined || !p.citazione) continue;
      if (typeof p.valoreProposto !== typeof campo.valore) continue;
      const citNorm = normalizzaPerCitazione(p.citazione);
      if (!testoNorm.includes(citNorm)) continue; // verifica citazione nel testo completo
      valide.push(p);
    }
  }
  return valide;
}

// Esegue il controllo di tutte le fonti del registro.
export async function controllaFonti() {
  if (inCorso) {
    logger.info('monitoraggioFonti: controllo già in corso, skip');
    return { saltato: true };
  }
  inCorso = true;
  const FONTI_DIR = path.join(import.meta.dirname, '..', 'data', 'fonti');

  try {
    const registroRaw = await readFile(path.join(FONTI_DIR, 'registro.json'), 'utf-8');
    const voci = JSON.parse(registroRaw);

    // Hash visti nell'ultima run: { id: ultimoHash }
    const ultimiHash = (await readJson('fonti-ultimi-hash.json')) ?? {};
    const fonteCambiate = (await readJson('fonti-cambiate.json')) ?? {};

    let nuoveCambiate = 0;
    let proposteAggiunte = 0;
    const annoCorrente = new Date().getFullYear();

    for (const voce of voci) {
      if (!voce.url && !voce.urlDownload) continue; // nessun URL → skip silenzioso

      let risultato;
      try {
        risultato = await scaricaFonte(voce);
      } catch (err) {
        logger.warn(`monitoraggioFonti: errore fetch ${voce.id}`, { errore: err.message });
        continue;
      }

      const hashPrecedente = ultimiHash[voce.id];
      ultimiHash[voce.id] = risultato.hash;

      if (!hashPrecedente) continue; // prima run: salva baseline, nessun allarme

      if (risultato.hash === hashPrecedente) continue;
      if (risultato.hashByte === hashPrecedente) continue; // migrazione baseline PDF byte→testo, file invariato

      // Hash cambiato rispetto all'ultima run
      // Se già noto (stesso newHash): skip — evita di ri-chiamare l'AI ad ogni tick
      if (fonteCambiate[voce.id]?.newHash === risultato.hash) continue;

      nuoveCambiate++;
      fonteCambiate[voce.id] = { rilevatoIl: new Date().toISOString(), oldHash: hashPrecedente, newHash: risultato.hash };

      // AI solo per fonti con testo estratto e archiviato (HTML e PDF; XLS: hash-only)
      if (risultato.testo && voce.file) {
        try {
          // Leggi il pacchetto regole dell'anno corrente per trovare i campi citanti questa fonte
          const { leggiPacchettoVersionato } = await import('./regoleFiscaliService.js');
          const pacchetto = await leggiPacchettoVersionato(annoCorrente);
          if (pacchetto) {
            const campi = campiCitantiFonte(pacchetto, voce.id);
            if (campi.length) {
              const proposte = await proponiValoriDaAI(voce, risultato.testo, campi, annoCorrente);
              if (proposte.length) {
                proposteAggiunte += proposte.length;
                // Scrivi in regole-proposte/<anno>.json (merge con eventuali proposte esistenti)
                const esistenti = (await readJson(`regole-proposte/${annoCorrente}.json`)) ?? {};
                for (const p of proposte) {
                  esistenti[p.campo] = { ...p, idFonte: voce.id, rilevatoIl: new Date().toISOString() };
                }
                await writeJson(`regole-proposte/${annoCorrente}.json`, esistenti);
              }
            }
          }
        } catch (err) {
          logger.warn(`monitoraggioFonti: proposta AI fallita per ${voce.id}`, { errore: err.message });
        }
      }
    }

    await writeJson('fonti-ultimi-hash.json', ultimiHash);
    await writeJson('fonti-cambiate.json', fonteCambiate);
    const statoPrec = (await readJson('monitoraggio-ultimo-controllo.json')) ?? {};
    await writeJson('monitoraggio-ultimo-controllo.json', { ...statoPrec, eseguitoIl: new Date().toISOString() });

    if (nuoveCambiate > 0) {
      notifica('Fonti normative modificate', `${nuoveCambiate} fonte${nuoveCambiate > 1 ? ' aggiornate' : ' aggiornata'} — apri Impostazioni`);
    }

    logger.info('monitoraggioFonti: controllo completato', { nuoveCambiate, proposteAggiunte });
    return { nuoveCambiate, proposteAggiunte };
  } finally {
    inCorso = false;
  }
}

export function avviaMonitoraggioFonti() {
  if (timer) return;
  // Controlla al primo avvio se è il momento (asincrono, non blocca l'avvio del server)
  _controllaSeNecessario();
  timer = setInterval(_controllaSeNecessario, TICK_MS);
}

export function fermaMonitoraggioFonti() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function _controllaSeNecessario() {
  try {
    const stato = await readJson('monitoraggio-ultimo-controllo.json');
    if (stato?.eseguitoIl) {
      const giorni = (Date.now() - new Date(stato.eseguitoIl).getTime()) / 86_400_000;
      if (giorni < giorniAttesa()) {
        // Anche senza controllo fonti, verifica il promemorio trimestrale
        await _promemoriTrimestrale();
        return;
      }
    }
    await controllaFonti();
    await _promemoriTrimestrale();
  } catch (err) {
    logger.error('monitoraggioFonti: errore nel tick periodico', { errore: err.message });
  }
}

// Promemoria fisso (gen/apr/giu/nov): "controlla se ci sono novità normative per l'anno".
// Una sola notifica per mese-anno (dedup su chiave mese).
// ponytail: testo generico — evita dati fiscali sul lock screen
async function _promemoriTrimestrale() {
  const MESI_PROMEMORIA = [1, 4, 6, 11]; // gen/apr/giu/nov
  const oggi = new Date();
  const mese = oggi.getMonth() + 1;
  if (!MESI_PROMEMORIA.includes(mese)) return;

  const chiave = `promemoria-${oggi.getFullYear()}-${String(mese).padStart(2, '0')}`;
  const dedup = (await readJson('monitoraggio-ultimo-controllo.json')) ?? {};
  if (dedup.promemorioInviato === chiave) return;

  notifica('Aggiornamento normativo', 'Verifica se ci sono novità fiscali per l\'anno — apri Impostazioni');
  await writeJson('monitoraggio-ultimo-controllo.json', { ...dedup, promemorioInviato: chiave });
}

// Stato per l'API: fonti cambiate + proposte pendenti.
export async function statoMonitoraggio() {
  const cambiate = await readJson('fonti-cambiate.json') ?? {};
  const annoCorrente = new Date().getFullYear();
  const proposte = await readJson(`regole-proposte/${annoCorrente}.json`) ?? {};
  return {
    fonteCambiate: Object.entries(cambiate).map(([id, v]) => ({ id, ...v })),
    proposte: Object.values(proposte),
    ultimoControllo: (await readJson('monitoraggio-ultimo-controllo.json'))?.eseguitoIl ?? null,
  };
}
