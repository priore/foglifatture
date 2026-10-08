// Scadenze fiscali (imposta sostitutiva, INPS) del regime forfettario.
// Le date "ordinarie" (INPS gestione separata/artigiani-commercianti, saldo e acconti imposta
// sostitutiva) sono fissate da norme stabili e calcolabili: giorno/mese fisso, spostato al primo
// giorno lavorativo successivo se cade di sabato, domenica o festivo nazionale. Vengono quindi
// hardcodate qui (funzione scadenzeBaseAnno) invece di richiederle a un modello ogni volta.
// Il rischio reale è la proroga: quasi ogni anno un DPCM sposta il termine ordinario (es. 30
// giugno → 31 luglio con maggiorazione). Per questo si tiene comunque un controllo via Gemini/
// Claude con ricerca web, ma solo 1 volta l'anno (cache 365gg) e mai bloccante: se l'AI non è
// configurata o fallisce, la dashboard mostra comunque le date ordinarie invece di un errore.
import { readJson, writeJson } from '../lib/jsonStore.js';
import { chiamaAI } from './aiRouterService.js';

const FILE = 'scadenzeFiscali.json';
const GIORNI_VALIDITA_CACHE = 365;

// Festività nazionali italiane fisse (mese, giorno). Pasquetta è calcolata a parte (algoritmo
// di Gauss, data mobile). Sufficienti per lo spostamento scadenze: non serve un calendario
// festività completo, solo sapere se un giorno specifico è non lavorativo.
const FESTIVITA_FISSE = [
  [1, 1], [1, 6], [4, 25], [5, 1], [6, 2], [8, 15], [11, 1], [12, 8], [12, 25], [12, 26],
];
// Festività introdotte dopo il 2025 (mese, giorno, annoInizio).
// 4 ottobre: Festa nazionale per centenario della Protezione Civile (L. 151/2025), dal 2026.
const FESTIVITA_CON_ANNO = [
  [10, 4, 2026],
];

function pasquetta(anno) {
  // Algoritmo di Gauss per la Pasqua, +1 giorno per il Lunedì dell'Angelo.
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno + 1);
}

// toISOString() converte in UTC (shift di un giorno per fusi come Europe/Rome): le date qui
// sono costruite in locale (new Date(anno, mese, giorno)), quindi vanno formattate in locale.
function isoData(data) {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

function eFestivo(data, festivitaMobili) {
  const giornoSettimana = data.getDay();
  if (giornoSettimana === 0 || giornoSettimana === 6) return true;
  const anno = data.getFullYear(), mese = data.getMonth() + 1, giorno = data.getDate();
  if (FESTIVITA_FISSE.some(([m, g]) => m === mese && g === giorno)) return true;
  if (FESTIVITA_CON_ANNO.some(([m, g, da]) => m === mese && g === giorno && anno >= da)) return true;
  return festivitaMobili.some((f) => isoData(f) === isoData(data));
}

// Scadenze dall'1 al 19 agosto slittano al 20 agosto (D.Lgs. 33/2025 art. 11).
// Il 20 agosto stesso non slita: è già la data target.
function slittamentoAgosto(data) {
  if (data.getMonth() === 7 && data.getDate() >= 1 && data.getDate() <= 19) {
    return new Date(data.getFullYear(), 7, 20);
  }
  return data;
}

// Sposta al primo giorno lavorativo successivo se la data cade di sabato/domenica/festivo.
// Applica prima lo slittamento di agosto (D.Lgs. 33/2025 art. 11).
export function primoGiornoLavorativo(anno, mese, giorno) {
  const festivitaMobili = [pasquetta(anno)];
  let data = slittamentoAgosto(new Date(anno, mese - 1, giorno));
  while (eFestivo(data, festivitaMobili)) data = new Date(data.getFullYear(), data.getMonth(), data.getDate() + 1);
  return isoData(data);
}

// Date ordinarie note e stabili nel tempo per un libero professionista in regime forfettario
// (persona fisica, no dipendenti): imposta sostitutiva (termini IRPEF ordinari) e INPS.
// Scadenze Intrastat servizi resi trimestrale: 25 del mese dopo il trimestre.
// Aggiunta solo se il fornitore è iscritto al VIES e ha fatturato ad aziende UE nell'anno.
// (DPR 633/72 art. 50 c. 6, D.Lgs. 18/2010)
export function scadenzeIntrastatAnno(anno) {
  return [
    { data: primoGiornoLavorativo(anno, 4, 25), tipo: 'Intrastat servizi resi', descrizione: `I trim. ${anno}: elenco riepilogativo servizi resi a soggetti passivi UE` },
    { data: primoGiornoLavorativo(anno, 7, 25), tipo: 'Intrastat servizi resi', descrizione: `II trim. ${anno}: elenco riepilogativo servizi resi a soggetti passivi UE` },
    { data: primoGiornoLavorativo(anno, 10, 25), tipo: 'Intrastat servizi resi', descrizione: `III trim. ${anno}: elenco riepilogativo servizi resi a soggetti passivi UE` },
    { data: primoGiornoLavorativo(anno + 1, 1, 25), tipo: 'Intrastat servizi resi', descrizione: `IV trim. ${anno}: elenco riepilogativo servizi resi a soggetti passivi UE` },
  ];
}

// L'anno successivo compare per le rate a cavallo (saldo INPS artigiani, acconto imposta anno+1).
export function scadenzeBaseAnno(anno) {
  return [
    { data: primoGiornoLavorativo(anno, 6, 30), tipo: 'Saldo + I acconto imposta sostitutiva', descrizione: `Saldo ${anno - 1} + I acconto ${anno} (termine ordinario, verificare proroghe)` },
    { data: primoGiornoLavorativo(anno, 11, 30), tipo: 'II acconto imposta sostitutiva', descrizione: `II acconto ${anno}` },
    { data: primoGiornoLavorativo(anno, 6, 30), tipo: 'INPS gestione separata', descrizione: `Saldo ${anno - 1} + I acconto ${anno}` },
    { data: primoGiornoLavorativo(anno, 11, 30), tipo: 'INPS gestione separata', descrizione: `II acconto ${anno}` },
    { data: primoGiornoLavorativo(anno, 5, 16), tipo: 'INPS artigiani/commercianti', descrizione: `I rata fissa ${anno}` },
    { data: primoGiornoLavorativo(anno, 8, 20), tipo: 'INPS artigiani/commercianti', descrizione: `II rata fissa ${anno}` },
    { data: primoGiornoLavorativo(anno, 11, 16), tipo: 'INPS artigiani/commercianti', descrizione: `III rata fissa ${anno}` },
    { data: primoGiornoLavorativo(anno + 1, 2, 16), tipo: 'INPS artigiani/commercianti', descrizione: `IV rata fissa ${anno}` },
  ].sort((x, y) => x.data.localeCompare(y.data));
}

// La quota gratuita Gemini (in particolare con google_search, molto più bassa della quota
// generateContent semplice) si resetta a mezzanotte Pacific Time, non dopo un tempo fisso
// dall'errore: ritentare ogni ora contro una quota giornaliera esaurita è inutile finché
// il reset reale non è passato. Calcola il primo mezzanotte Pacific successivo a `daErrore`.
export function prossimoResetQuotaGemini(daErrore) {
  const oraPacificErrore = new Date(daErrore.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const reset = new Date(oraPacificErrore);
  reset.setHours(24, 0, 0, 0);
  const differenzaMs = reset.getTime() - oraPacificErrore.getTime();
  return new Date(daErrore.getTime() + differenzaMs);
}

const PROMPT = `Per un libero professionista italiano in regime forfettario (persona fisica, partita IVA,
no dipendenti), per l'anno ${new Date().getFullYear()} verifica con ricerca web:
1. Eventuali proroghe ufficiali (DPCM o decreto) ai termini ordinari di versamento di imposta
   sostitutiva o contributi INPS gestione separata/artigiani-commercianti rispetto alle scadenze
   standard (30 giugno, 30 novembre, 16 maggio, 20 agosto, 16 novembre, 16 febbraio).
2. L'importo del contributo fisso INPS artigiani/commercianti (minimale) per l'anno corrente,
   pubblicato dall'INPS a inizio anno, se disponibile.

Rispondi SOLO con un array JSON valido (nessun testo, nessun markdown). Se non trovi nulla di
diverso dagli standard, rispondi con un array vuoto: []. Altrimenti un elemento per ciascuna
scadenza da correggere:
{"data": "YYYY-MM-DD", "tipo": "identico al tipo standard che sostituisce", "descrizione": "...",
"importo": 123.45}
"importo" è opzionale (solo se noto e pertinente, es. rata INPS artigiani/commercianti).`;

function estraiArrayJson(testo) {
  const inizio = testo.indexOf('[');
  const fine = testo.lastIndexOf(']');
  if (inizio === -1 || fine === -1) throw new Error('Risposta AI senza array JSON riconoscibile');
  return JSON.parse(testo.slice(inizio, fine + 1));
}

function cacheValida(cache, anno) {
  if (!cache?.aggiornatoIl || !Array.isArray(cache.proroghe) || cache.anno !== anno) return false;
  const giorni = (Date.now() - new Date(cache.aggiornatoIl).getTime()) / 86_400_000;
  return giorni < GIORNI_VALIDITA_CACHE;
}

function ritentareDopoErrore(cache) {
  if (!cache?.ultimoErroreIl) return true;
  // Attende il reset quota Gemini solo se l'ultimo errore era da Gemini; il router
  // tenterà automaticamente gli altri provider se disponibili.
  return Date.now() >= prossimoResetQuotaGemini(new Date(cache.ultimoErroreIl)).getTime();
}

async function interrogaAI() {
  // Questa ricerca richiede web search: usiamo solo provider API (soloApiKey) con i tool
  // specifici per Gemini e Claude, che supportano grounding/web search.
  const { testo, fonte } = await chiamaAI(PROMPT, {
    soloApiKey: true,
    strumentiGemini: [{ google_search: {} }],
    strumentiClaude: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
  });
  const proroghe = estraiArrayJson(testo);
  if (!Array.isArray(proroghe)) throw new Error('Risposta AI non è un array');
  return { proroghe, fonte };
}

// Applica eventuali proroghe (stesso "tipo") sopra le date base, sostituendone la data/descrizione.
function applicaProroghe(base, proroghe) {
  if (!proroghe?.length) return base;
  const risultato = base.map((voce) => {
    const proroga = proroghe.find((p) => p.tipo === voce.tipo);
    if (!proroga) return voce;
    return {
      ...voce,
      data: proroga.data,
      descrizione: proroga.descrizione ?? voce.descrizione,
      ...(proroga.importo != null ? { importo: proroga.importo } : {}),
      prorogata: true,
    };
  });
  return risultato.sort((a, b) => a.data.localeCompare(b.data));
}

// Prossime scadenze fiscali (imposta sostitutiva, INPS) per il regime forfettario: date base
// sempre disponibili (calcolate, vedi scadenzeBaseAnno), arricchite con eventuali proroghe
// note via AI. Non solleva mai errore bloccante: se l'AI non è configurata o fallisce, restituisce
// comunque le date ordinarie con fonte 'base'.
export async function prossimeScadenzeFiscali() {
  const anno = new Date().getFullYear();
  const base = scadenzeBaseAnno(anno);

  let cache = await readJson(FILE, null);
  if (!cacheValida(cache, anno) && ritentareDopoErrore(cache)) {
    try {
      const { proroghe, fonte } = await interrogaAI();
      cache = { anno, aggiornatoIl: new Date().toISOString(), proroghe, fonte };
      await writeJson(FILE, cache);
    } catch (err) {
      cache = { ...cache, anno, ultimoErroreIl: new Date().toISOString() };
      await writeJson(FILE, cache);
    }
  }

  const proroghe = cache?.anno === anno ? cache.proroghe : null;
  return {
    aggiornatoIl: cache?.anno === anno ? cache.aggiornatoIl : null,
    fonte: proroghe ? cache.fonte : 'base',
    scadenze: applicaProroghe(base, proroghe),
    prossimoRetryIl: null,
  };
}
