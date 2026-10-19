// Import transazioni BTC da file CSV/JSON di wallet o exchange (AI-Workspace/Plans/REGISTRO_LOTTI_BTC.md,
// Step 11, FP-014). Il file è letto in locale; nulla viene registrato: le righe diventano proposte
// (stesso flusso e stesso file del polling, Step 10) che l'utente conferma o scarta.
// Formato non riconosciuto: l'AI propone il mapping colonne su un campione con dati sensibili
// sostituiti da hash; il mapping va confermato dall'utente prima del parsing.
import { createHash } from 'node:crypto';
import { chiamaAI } from './aiRouterService.js';
import { parseData } from './pagamentiFattureService.js';
import { leggiProposte, salvaProposte, txidNoti } from './importBtcService.js';

const HEX64 = /^[0-9a-fA-F]{64}$/;
const RIGHE_CAMPIONE_AI = 8;
const sha = (s) => createHash('sha256').update(s).digest('hex');

// ── Utilità pure ────────────────────────────────────────────────────────────

// CSV con virgolette; separatore tra , ; tab scelto sulla prima riga.
export function parseCsv(testo) {
  const t = testo.replace(/^﻿/, '');
  const prima = t.split(/\r?\n/, 1)[0];
  const sep = [';', '\t'].reduce((m, s) => (prima.split(s).length > prima.split(m).length ? s : m), ',');
  const righe = [];
  let riga = [];
  let cella = '';
  let tra = false;
  const chiudiRiga = () => {
    riga.push(cella);
    cella = '';
    if (riga.some((x) => x.trim() !== '')) righe.push(riga.map((x) => x.trim()));
    riga = [];
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tra) {
      if (c !== '"') cella += c;
      else if (t[i + 1] === '"') { cella += '"'; i++; } else tra = false;
    } else if (c === '"') tra = true;
    else if (c === sep) { riga.push(cella); cella = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      chiudiRiga();
    } else cella += c;
  }
  chiudiRiga();
  return righe;
}

// "1.234,56" / "1,234.56" / "0,001" / "0.001" -> numero. L'ultimo separatore è il decimale.
export function parseNumero(valore) {
  const s = String(valore ?? '').replace(/[\s'+]/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return NaN;
  const dec = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (dec === -1) return Number(s);
  return Number(`${s.slice(0, dec).replace(/[.,]/g, '')}.${s.slice(dec + 1)}`);
}

// unita: 'btc' | 'satoshi' | 'auto' (con separatore decimale = BTC, intero = satoshi).
export function aSatoshi(valore, unita = 'btc') {
  const n = parseNumero(valore);
  if (!Number.isFinite(n)) return NaN;
  const btc = unita === 'btc' || (unita === 'auto' && /[.,]/.test(String(valore)));
  return Math.round(btc ? n * 1e8 : n);
}

function dataDa(v) {
  if (typeof v === 'number') return new Date((v > 1e12 ? v : v * 1000)).toISOString().slice(0, 10);
  return v ? parseData(v) : null;
}

// ── Formati noti (🟡 intestazioni da verificare su export reali, vedi piano §11a) ──

const normalizza = (intestazioni) => intestazioni.map((h) => h.trim().toLowerCase());

export function rilevaFormato(intestazioni) {
  const h = normalizza(intestazioni);
  if (h.includes('date (utc)') && h.includes('value') && h.includes('txid')) return 'sparrow';
  if (h.includes('transaction_hash') && h.includes('value')) return 'electrum';
  if (h.includes('refid') && h.includes('asset') && h.includes('amount')) return 'kraken';
  if (['datetime_tz_cet', 'sent_value_eur', 'received_value_eur', 'fee_value_eur'].every((x) => h.includes(x))) return 'binance';
  if (h.includes('transaction type') && h.includes('quantity transacted')) return 'coinbase';
  if (['transaction id', 'time', 'type', 'instrument', 'fee currency', 'total'].every((x) => h.includes(x))) return 'onetrading';
  return null;
}

// Costruisce un movimento dal valore con segno; null se riga inutilizzabile.
function movimento({ valore, unita, data, txid, valoreEur, tipoSuggerito, riferimento }) {
  const firmato = aSatoshi(valore, unita);
  if (!Number.isFinite(firmato) || firmato === 0 || !data) return null;
  return {
    direzione: firmato > 0 ? 'ingresso' : 'uscita',
    satoshi: Math.abs(firmato),
    data,
    ...(HEX64.test(txid ?? '') ? { txid: txid.toLowerCase() } : {}),
    ...(Number.isFinite(valoreEur) && valoreEur > 0 ? { valoreEur: Number(valoreEur.toFixed(2)) } : {}),
    ...(tipoSuggerito ? { tipoSuggerito } : {}),
    ...(riferimento ? { riferimento } : {}),
  };
}

function conIndice(intestazioni, ...nomi) {
  const h = normalizza(intestazioni);
  return nomi.map((n) => h.indexOf(n));
}

function parseSparrow([intest, ...righe]) {
  const [d, v, t] = conIndice(intest, 'date (utc)', 'value', 'txid');
  return righe.map((r) => movimento({ valore: r[v], unita: 'auto', data: parseData(r[d]), txid: r[t] }));
}

function parseElectrum([intest, ...righe]) {
  const [h, v, ts] = conIndice(intest, 'transaction_hash', 'value', 'timestamp');
  return righe.map((r) => movimento({ valore: r[v], data: parseData(r[ts]), txid: r[h] }));
}

// Ledger Kraken: righe BTC raggruppate per refid. Solo trade/spend/receive, con controvalore dal
// lato EUR dello stesso refid. Depositi e prelievi sono spostamenti tra custodie proprie (un
// ingresso proposto raddoppierebbe i lotti): ignorati e contati. Il txid Kraken non è on-chain.
function parseKraken([intest, ...righe]) {
  const [rid, tm, tp, as, am] = conIndice(intest, 'refid', 'time', 'type', 'asset', 'amount');
  const eur = new Map();
  for (const r of righe) if (/^(Z?EUR)$/i.test(r[as])) eur.set(r[rid], Math.abs(parseNumero(r[am])));
  let ignorate = 0;
  const movimenti = righe.filter((r) => /^(X?XBT|BTC)$/i.test(r[as])).map((r) => {
    if (!/^(trade|spend|receive)$/i.test(r[tp])) { ignorate++; return null; }
    const firmato = parseNumero(r[am]);
    return movimento({
      valore: r[am], data: parseData(r[tm]), valoreEur: eur.get(r[rid]), riferimento: r[rid],
      tipoSuggerito: firmato > 0 ? 'acquisto' : 'vendita',
    });
  });
  return { movimenti, ignorate };
}

// Exchange (Binance tax report, Coinbase, One Trading): colonne per nome, solo righe BTC.
// Logica ripresa da Crypto-RW (Exchanges/*.swift), ma per intestazione e non per posizione.
// Deposit/withdrawal/send/receive sono spostamenti tra custodie proprie: ignorati e contati
// (come Kraken), per non duplicare i lotti. Il controvalore EUR è preso solo se già in EUR.
const BTC = /^(X?XBT|BTC)$/i;
const SPOSTAMENTO = /deposit|withdraw|transfer|^send$|^receive$/i;
const REDDITO = /reward|staking|bonus|airdrop|interest|referral/i;
const eurPos = (v) => { const n = Math.abs(parseNumero(v)); return Number.isFinite(n) && n > 0 ? n : undefined; };

function parseExchange([intest, ...righe], mappa) {
  const h = normalizza(intest);
  const idx = Object.fromEntries(Object.entries(mappa.colonne).map(([k, nomi]) => [k, h.findIndex((x) => [].concat(nomi).some((n) => x.startsWith(n)))]));
  let ignorate = 0;
  const movimenti = righe.map((r) => {
    const col = Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, i === -1 ? '' : r[i] ?? '']));
    const m = mappa.riga(col);
    if (m === 'ignora') { ignorate++; return null; }
    return m && movimento({ data: parseData(col.data), ...m });
  });
  return { movimenti, ignorate };
}

const FORMATI_EXCHANGE = {
  binance: {
    colonne: { id: 'id', data: 'datetime_tz_cet', tipo: 'type', inviato: 'sent_amount', valInv: 'sent_currency', eurInv: 'sent_value_eur', ricevuto: 'received_amount', valRic: 'received_currency', eurRic: 'received_value_eur' },
    riga: (c) => {
      const entra = BTC.test(c.valRic);
      const esce = BTC.test(c.valInv);
      if (entra === esce) return null;
      if (SPOSTAMENTO.test(c.tipo)) return 'ignora';
      const reddito = REDDITO.test(c.tipo);
      return {
        valore: entra ? c.ricevuto : `-${String(c.inviato).replace(/^-/, '')}`, unita: 'btc', riferimento: c.id,
        valoreEur: eurPos(entra ? c.eurRic : c.eurInv), tipoSuggerito: entra ? (reddito ? 'ricevuto' : 'acquisto') : 'vendita',
      };
    },
  },
  coinbase: {
    colonne: { data: 'timestamp', tipo: 'transaction type', asset: 'asset', qta: 'quantity transacted', valuta: ['spot price currency', 'price currency'], prezzo: ['spot price at transaction', 'price at transaction'], totale: 'total', id: 'id' },
    riga: (c) => {
      if (!BTC.test(c.asset)) return null;
      if (SPOSTAMENTO.test(c.tipo)) return 'ignora';
      const q = parseNumero(c.qta);
      if (!Number.isFinite(q) || q === 0) return null;
      const t = c.tipo.toLowerCase();
      const entra = /buy|income|reward/.test(t) || (/convert/.test(t) && q > 0);
      const eur = /^eur$/i.test(c.valuta) ? (/^(buy|sell)$/.test(t) ? eurPos(c.totale) : eurPos(String(Math.abs(q) * parseNumero(c.prezzo)))) : undefined;
      return {
        valore: `${entra ? '' : '-'}${Math.abs(q)}`, unita: 'btc', valoreEur: eur, riferimento: c.id || `${c.data}|${t}`,
        tipoSuggerito: entra ? (REDDITO.test(t) ? 'ricevuto' : 'acquisto') : 'vendita',
      };
    },
  },
  onetrading: {
    colonne: { id: 'transaction id', data: 'time', tipo: 'type', strumento: 'instrument', qta: 'amount', totale: 'total' },
    riga: (c) => {
      const t = c.tipo.toLowerCase();
      const [cripto, fiat] = c.strumento.split('_');
      if (!BTC.test(cripto)) return null;
      if (SPOSTAMENTO.test(t)) return 'ignora';
      const scambio = /^(buy|sell)$/.test(t);
      if (!scambio && !REDDITO.test(t)) return null;
      return {
        valore: `${t === 'sell' ? '-' : ''}${Math.abs(parseNumero(c.qta))}`, unita: 'btc', riferimento: c.id,
        valoreEur: scambio && /^eur$/i.test(fiat) ? eurPos(c.totale) : undefined,
        tipoSuggerito: t === 'sell' ? 'vendita' : scambio ? 'acquisto' : 'ricevuto',
      };
    },
  },
};

const PARSER_CSV = { sparrow: parseSparrow, electrum: parseElectrum };

// JSON generico (export `electrum history` e simili): lista, o oggetto con transactions/history/txs.
export function parseJsonImport(contenuto) {
  const dati = JSON.parse(contenuto);
  const lista = Array.isArray(dati) ? dati : dati?.transactions ?? dati?.history ?? dati?.txs;
  if (!Array.isArray(lista)) throw new Error('JSON non riconosciuto: attesa una lista di transazioni');
  return lista.map((t) => movimento({
    valore: t.bc_value ?? t.value,
    data: dataDa(t.timestamp ?? t.date),
    txid: t.txid ?? t.tx_hash ?? t.transaction_hash,
  }));
}

// ── Mapping colonne con AI (formato sconosciuto) ────────────────────────────

// Solo numeri, date e poche parole di tipo restano in chiaro; il resto (indirizzi, txid, etichette)
// diventa un hash troncato, uguale per valori uguali (11a-bis). Le intestazioni non sono dati.
const CELLA_NEUTRA = /^([-+]?[\d.,\s]+|\d{4}-\d{2}-\d{2}.*|\d{1,2}[/.]\d{1,2}[/.]\d{4}.*|buy|sell|send|sent|receive|received|in|out|incoming|outgoing|deposit|withdrawal|trade|acquisto|vendita|entrata|uscita)$/i;
export const oscuraCella = (c) => (c === '' || CELLA_NEUTRA.test(c) ? c : `h_${sha(c).slice(0, 10)}`);

export function promptMapping(intestazioni, righe) {
  const campione = righe.slice(0, RIGHE_CAMPIONE_AI).map((r) => r.map(oscuraCella));
  return `Questo è un file CSV di transazioni Bitcoin esportato da un wallet o da un exchange.
Intestazioni: ${JSON.stringify(intestazioni)}
Prime righe (indirizzi, txid ed etichette sono sostituiti da hash): ${JSON.stringify(campione)}

Indica l'indice (0-based) delle colonne. Rispondi SOLO con un oggetto JSON, senza altro testo:
{"colonnaData":0,"colonnaImporto":1,"unita":"btc","colonnaTxid":null,"colonnaEur":null,"colonnaTipo":null}
- colonnaImporto: quantità di BTC; se ha segno (negativo = uscita) basta così
- unita: "btc" oppure "satoshi"
- colonnaTipo: solo se il verso (entrata/uscita) NON è dato dal segno dell'importo
- colonnaEur: solo se esiste una colonna col controvalore in EUR
- usa null per le colonne assenti`;
}

export function validaMapping(m, nColonne) {
  const ok = (i, obbligatoria) => (i == null ? !obbligatoria : Number.isInteger(i) && i >= 0 && i < nColonne);
  if (!m || !ok(m.colonnaData, true) || !ok(m.colonnaImporto, true) || !['btc', 'satoshi'].includes(m.unita)
    || !ok(m.colonnaTxid) || !ok(m.colonnaEur) || !ok(m.colonnaTipo)) throw new Error('Mapping colonne non valido');
  return m;
}

function estraiJson(testo) {
  const a = testo.indexOf('{');
  const b = testo.lastIndexOf('}');
  if (a === -1 || b < a) throw new Error('Risposta AI senza mapping riconoscibile');
  return JSON.parse(testo.slice(a, b + 1));
}

const USCITA = /sell|send|sent|out|withdraw|vend|usc|spes/i;

function parseConMapping([, ...righe], m) {
  return righe.map((r) => {
    const n = parseNumero(r[m.colonnaImporto]);
    if (!Number.isFinite(n) || n === 0) return null;
    const verso = m.colonnaTipo == null ? Math.sign(n) : (USCITA.test(r[m.colonnaTipo]) ? -1 : 1);
    return movimento({
      valore: (verso * Math.abs(n)).toFixed(8), unita: m.unita, data: parseData(r[m.colonnaData]),
      txid: m.colonnaTxid == null ? undefined : r[m.colonnaTxid],
      valoreEur: m.colonnaEur == null ? undefined : Math.abs(parseNumero(r[m.colonnaEur])),
    });
  });
}

// ── Orchestrazione ──────────────────────────────────────────────────────────

const idProposta = (m) => (m.txid
  ? `PRP-${m.txid.slice(0, 16)}-${m.direzione}`
  : `PRP-F${sha([m.data, m.direzione, m.satoshi, m.riferimento ?? ''].join('|')).slice(0, 15)}-${m.direzione}`);

// Duplicati (stesso id in proposte esistenti o nel file, txid già in lotti/uscite) non diventano proposte.
async function salvaDaFile(movimenti, ignorate) {
  const validi = movimenti.filter(Boolean);
  const noti = await txidNoti();
  const viste = new Set((await leggiProposte()).proposte.map((p) => p.id));
  const nuove = [];
  for (const m of validi) {
    const id = idProposta(m);
    if (viste.has(id) || (m.txid && noti.has(m.txid))) continue;
    viste.add(id);
    nuove.push({
      ...m, id, conferme: null, providers: [], unaFonte: false, fonte: 'import-file',
      avvisi: m.direzione === 'uscita'
        ? ['Uscita da file: verifica tipo (vendita, spesa o trasferimento tra wallet propri) prima di confermare.'] : [],
    });
  }
  if (nuove.length) await salvaProposte(nuove);
  return { nuove: nuove.length, duplicate: validi.length - nuove.length, scartate: movimenti.length - validi.length, ignorate };
}

// Esito: { richiedeMapping, intestazioni, mappingProposto } se il formato CSV è sconosciuto e va
// confermato; altrimenti { formato, nuove, duplicate, scartate, ignorate }.
export async function importaDaFile(contenuto, { formato = 'auto', mapping, config, conferma = false, ai = chiamaAI } = {}) {
  if (formato === 'json' || (formato === 'auto' && /^\s*[[{]/.test(contenuto))) {
    return { formato: 'json', ...(await salvaDaFile(parseJsonImport(contenuto), 0)) };
  }
  let righe = parseCsv(contenuto);
  if (righe.length < 2) throw new Error('File vuoto o senza righe di dati');
  // Coinbase antepone alcune righe di presentazione all'intestazione: la cerco nelle prime 10.
  if (formato === 'auto' && !rilevaFormato(righe[0])) {
    const i = righe.slice(0, 10).findIndex((r) => rilevaFormato(r));
    if (i > 0) righe = righe.slice(i);
  }
  const noto = formato === 'auto' ? rilevaFormato(righe[0]) : formato;
  if (FORMATI_EXCHANGE[noto]) {
    const { movimenti, ignorate } = parseExchange(righe, FORMATI_EXCHANGE[noto]);
    return { formato: noto, ...(await salvaDaFile(movimenti, ignorate)) };
  }
  if (noto === 'kraken') {
    const { movimenti, ignorate } = parseKraken(righe);
    return { formato: noto, ...(await salvaDaFile(movimenti, ignorate)) };
  }
  if (PARSER_CSV[noto]) return { formato: noto, ...(await salvaDaFile(PARSER_CSV[noto](righe), 0)) };

  if (mapping) {
    validaMapping(mapping, righe[0].length);
    return { formato: 'mapping', ...(await salvaDaFile(parseConMapping(righe, mapping), 0)) };
  }
  // Righe (anche se hashate) e importi vanno al provider AI: stessa autorizzazione della chat (FP-009).
  if (!config?.ai?.autorizzaDatiFiscali && conferma !== true) {
    throw Object.assign(new Error('Invio dati fiscali all\'AI non autorizzato'), { codice: 'AUTORIZZAZIONE_RICHIESTA' });
  }
  const { testo } = await ai(promptMapping(righe[0], righe.slice(1)));
  const proposto = validaMapping(estraiJson(testo), righe[0].length);
  return { richiedeMapping: true, intestazioni: righe[0], mappingProposto: proposto };
}
