// Import automatico transazioni BTC (AI-Workspace/Plans/REGISTRO_LOTTI_BTC.md, Step 10, FP-014).
// Interroga SOLO gli indirizzi di config.walletBtc[] su due explorer Esplora-compatibili (mempool.space,
// blockstream.info) e confronta le risposte. Non registra mai nulla da sé: produce proposte in
// data/btcImportProposte.json (gitignored con backend/data/) che l'utente conferma o scarta.
// Stesso pattern setInterval di reminderService.js: rilegge la config a ogni giro.
import { readJson, writeJson } from '../lib/jsonStore.js';
import { logger } from '../lib/logger.js';
import { notifica } from '../lib/notifier.js';
import { aggiungiIngresso, aggiungiUscita, leggiMovimenti } from './movimentiBtcService.js';
import { costruisciLotti } from './lottiBtcService.js';

const FILE = 'btcImportProposte.json';
const TIMEOUT_MS = 10_000;
const TENTATIVI = 3;
const HEX64 = /^[0-9a-fA-F]{64}$/;
const INDIRIZZO = /^[a-zA-Z0-9]{14,100}$/;

// ── Rete: timeout, backoff esponenziale, validazione schema ─────────────────

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// Riprova solo su errori temporanei (rete, timeout, 429, 5xx); un 4xx è definitivo.
async function fetchConRetry(url, { fetchFn = fetch, timeoutMs = TIMEOUT_MS, attesaMs = 500 } = {}) {
  let ultimo;
  for (let n = 0; n < TENTATIVI; n++) {
    if (n > 0) await attendi(attesaMs * 2 ** (n - 1));
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      ultimo = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) throw Object.assign(ultimo, { definitivo: true });
    } catch (err) {
      if (err.definitivo) throw err;
      ultimo = err;
    }
  }
  throw ultimo;
}

function txValida(tx) {
  return tx && typeof tx === 'object' && HEX64.test(tx.txid ?? '')
    && Array.isArray(tx.vin) && Array.isArray(tx.vout)
    && typeof tx.status?.confirmed === 'boolean'
    && Number.isInteger(tx.fee ?? 0)
    && tx.vout.every((o) => Number.isInteger(o.value))
    && tx.vin.every((i) => !i.prevout || Number.isInteger(i.prevout.value));
}

async function txIndirizzo(base, indirizzo, opts) {
  const res = await fetchConRetry(`${base}/address/${encodeURIComponent(indirizzo)}/txs`, opts);
  const dati = await res.json();
  if (!Array.isArray(dati) || !dati.every(txValida)) throw new Error('Risposta del provider non valida');
  return dati;
}

async function altezzaTip(base, opts) {
  const n = Number(await (await fetchConRetry(`${base}/blocks/tip/height`, opts)).text());
  if (!Number.isInteger(n) || n <= 0) throw new Error('Altezza blocchi non valida');
  return n;
}

// ── Nucleo puro ─────────────────────────────────────────────────────────────

// Impronta dei soli dati economici: se due provider differiscono, la tx è discordante.
const impronta = (tx) => JSON.stringify([
  tx.fee ?? 0,
  tx.vin.map((i) => [i.txid, i.vout, i.prevout?.scriptpubkey_address, i.prevout?.value]),
  tx.vout.map((o) => [o.scriptpubkey_address, o.value]),
]);

// Effetto netto di una tx sul wallet (tutti gli indirizzi configurati insieme).
// Con input nostri è un'uscita (al netto del resto); altrimenti un ingresso. Restituisce null
// se non cambia il saldo (consolidamento tra indirizzi propri).
export function analizzaTx(tx, indirizzi) {
  const nostro = (a) => indirizzi.has(a);
  const ricevuti = tx.vout.filter((o) => nostro(o.scriptpubkey_address)).reduce((s, o) => s + o.value, 0);
  const inviati = tx.vin.filter((i) => nostro(i.prevout?.scriptpubkey_address)).reduce((s, i) => s + i.prevout.value, 0);
  if (inviati === 0) return ricevuti > 0 ? { direzione: 'ingresso', satoshi: ricevuti, avvisi: [] } : null;
  const tuttiNostri = tx.vin.every((i) => nostro(i.prevout?.scriptpubkey_address));
  const fee = tuttiNostri ? (tx.fee ?? 0) : 0;
  const satoshi = inviati - ricevuti - fee;
  if (satoshi <= 0) return null;
  const haEsterni = tx.vout.some((o) => !nostro(o.scriptpubkey_address));
  return {
    direzione: 'uscita',
    satoshi,
    ...(fee ? { feeSatoshi: fee } : {}),
    avvisi: haEsterni
      ? ['Output verso indirizzi non configurati: se uno è il resto del tuo wallet, l\'importo uscito potrebbe essere inferiore. Verifica prima di confermare.']
      : [],
  };
}

const dataDa = (blockTime) => new Date(blockTime * 1000).toISOString().slice(0, 10);

// Scarta conferme insufficienti, tx già registrate (txid noti) e già proposte/scartate/confermate.
export function filtraTransazioni(candidati, { confermeMinime, txidNoti = new Set(), proposteEsistenti = [] }) {
  const giaViste = new Set(proposteEsistenti.map((p) => p.id));
  return candidati.filter((c) => c.conferme >= confermeMinime
    && !txidNoti.has(c.txid.toLowerCase())
    && !giaViste.has(c.id));
}

// Confronta i provider tx per tx. `risposte` = [{ provider, tip, perIndirizzo: Map<indirizzo, tx[]> }]
// per i soli provider raggiungibili. Pura: testabile senza rete.
export function unisciRisposte(risposte, indirizzi) {
  const perTx = new Map(); // txid -> [{ provider, tip, tx }]
  for (const { provider, tip, perIndirizzo } of risposte) {
    const viste = new Set();
    for (const txs of perIndirizzo.values()) {
      for (const tx of txs) {
        if (viste.has(tx.txid)) continue;
        viste.add(tx.txid);
        if (!perTx.has(tx.txid)) perTx.set(tx.txid, []);
        perTx.get(tx.txid).push({ provider, tip, tx });
      }
    }
  }
  const candidati = [];
  const discordanti = [];
  for (const [txid, versioni] of perTx) {
    if (new Set(versioni.map((v) => impronta(v.tx))).size > 1) { discordanti.push(txid); continue; }
    const effetto = analizzaTx(versioni[0].tx, indirizzi);
    if (!effetto) continue;
    const conferme = Math.min(...versioni.map(({ tip, tx }) => (tx.status.confirmed ? tip - tx.status.block_height + 1 : 0)));
    const unaFonte = versioni.length < 2;
    const { tx } = versioni[0];
    candidati.push({
      id: `PRP-${txid.slice(0, 16)}-${effetto.direzione}`,
      txid,
      ...effetto,
      avvisi: [...effetto.avvisi, ...(unaFonte ? ['Confermata da un solo provider.'] : [])],
      data: tx.status.confirmed ? dataDa(tx.status.block_time) : null,
      conferme,
      providers: versioni.map((v) => v.provider),
      unaFonte,
    });
  }
  return { candidati, discordanti };
}

// ── Rete → candidati ────────────────────────────────────────────────────────

// Per ogni indirizzo configurato interroga entrambi i provider (cross-check). Un provider
// irraggiungibile non blocca: le tx vengono proposte con `unaFonte`. Una tx con dati diversi
// tra i provider è `discordante` e non viene proposta. Solo la prima pagina di tx per indirizzo
// (ponytail: paginazione /txs/chain/{ultimo} se un wallet supera le ~25 tx tra due controlli).
export async function controllaIndirizzi(config, opts = {}) {
  const cfg = config.importBtc;
  const indirizzi = [...new Set((config.walletBtc ?? []).map((w) => w.indirizzo).filter((a) => INDIRIZZO.test(a ?? '')))];
  if (!indirizzi.length) return { candidati: [], discordanti: [], errori: [] };
  const providers = [...new Set([cfg.urlPrimario, cfg.urlFallback].filter(Boolean).map((u) => u.replace(/\/+$/, '')))];
  const errori = [];
  const risposte = [];
  for (const provider of providers) {
    try {
      const tip = await altezzaTip(provider, opts);
      const perIndirizzo = new Map();
      for (const a of indirizzi) perIndirizzo.set(a, await txIndirizzo(provider, a, opts));
      risposte.push({ provider, tip, perIndirizzo });
    } catch (err) {
      errori.push(`${provider}: ${err.message}`);
    }
  }
  if (!risposte.length) return { candidati: [], discordanti: [], errori };
  return { ...unisciRisposte(risposte, new Set(indirizzi)), errori };
}

// ── Persistenza proposte ────────────────────────────────────────────────────

const vuoto = () => ({ proposte: [], ultimoControllo: null, ultimoErrore: null });

export async function leggiProposte() {
  return { ...vuoto(), ...(await readJson(FILE, {})) };
}

export async function salvaProposte(nuove, meta = {}) {
  const dati = await leggiProposte();
  const adesso = new Date().toISOString();
  dati.proposte.push(...nuove.map((p) => ({ fonte: 'import-polling', ...p, stato: 'proposta', creataIl: adesso })));
  await writeJson(FILE, { ...dati, ...meta });
  return dati.proposte;
}

async function aggiornaProposta(id, daStato, modifica) {
  const dati = await leggiProposte();
  const p = dati.proposte.find((x) => x.id === id);
  if (!p) throw new Error(`Proposta non trovata: ${id}`);
  if (!daStato.includes(p.stato)) throw new Error(`Proposta già ${p.stato}`);
  Object.assign(p, modifica);
  await writeJson(FILE, dati);
  return p;
}

// Conferma: la proposta diventa un ingresso o un'uscita. Il controvalore EUR non è sulla
// blockchain: lo fornisce l'utente (`costoEur` per gli ingressi, `ricavoEur` per le uscite).
// L'associazione a una rata di fattura resta il flusso manuale esistente (FatturaView).
export async function confermaProposta(id, dati = {}) {
  const { proposte } = await leggiProposte();
  const p = proposte.find((x) => x.id === id);
  if (!p) throw new Error(`Proposta non trovata: ${id}`);
  if (p.stato !== 'proposta') throw new Error(`Proposta già ${p.stato}`);
  if (!p.data) throw new Error('Transazione non ancora confermata: manca la data');
  const base = { data: p.data, satoshi: p.satoshi, txid: p.txid, note: dati.note };
  const tipo = dati.tipo ?? p.tipoSuggerito ?? 'vendita';
  const esito = p.direzione === 'ingresso'
    ? await aggiungiIngresso({ ...base, tipo: dati.tipo ?? p.tipoSuggerito ?? 'ricevuto', costoEur: dati.costoEur ?? p.valoreEur, custodia: dati.custodia })
    : await aggiungiUscita({
      ...base, tipo, ricavoEur: tipo === 'trasferimento' ? undefined : dati.ricavoEur ?? p.valoreEur, feeSatoshi: p.feeSatoshi,
      cambioEurBtc: dati.cambioEurBtc, fonteCambio: dati.fonteCambio, custodia: dati.custodia, fonte: p.fonte ?? 'import-polling',
    });
  await aggiornaProposta(id, ['proposta'], { stato: 'confermata', movimentoId: esito.movimento.id });
  return esito;
}

export const scartaProposta = (id) => aggiornaProposta(id, ['proposta'], { stato: 'scartata' });
export const ripristinaProposta = (id) => aggiornaProposta(id, ['scartata'], { stato: 'proposta' });

// ── Controllo completo e polling ────────────────────────────────────────────

export async function txidNoti() {
  const [lotti, { uscite }] = await Promise.all([costruisciLotti(), leggiMovimenti()]);
  return new Set([...lotti, ...uscite].map((m) => m.txid?.toLowerCase()).filter(Boolean));
}

export async function controllaOra(config, opts = {}) {
  const { candidati, discordanti, errori } = await controllaIndirizzi(config, opts);
  const { proposte } = await leggiProposte();
  const nuove = filtraTransazioni(candidati, {
    confermeMinime: config.importBtc.confermeMinime, txidNoti: await txidNoti(), proposteEsistenti: proposte,
  });
  // Errore registrato solo se nessun provider ha risposto; un provider giù è già coperto da `unaFonte`.
  const nessunaRisposta = errori.length > 0 && candidati.length === 0 && discordanti.length === 0;
  await salvaProposte(nuove, {
    ultimoControllo: new Date().toISOString(),
    ultimoErrore: nessunaRisposta ? errori.join('; ') : null,
  });
  if (discordanti.length) logger.error('Import BTC: transazioni discordanti tra provider, non proposte', { discordanti });
  return { nuove, discordanti, errori };
}

let timerBtc = null;
let inCorso = false;

// Tick ogni minuto; il controllo parte quando è trascorso `intervalloMinuti` dall'ultimo
// (persistito), così un cambio di intervallo o di abilitazione vale subito, senza riavvio.
// Non parte mai senza avviso privacy accettato (gli indirizzi vanno a servizi terzi).
export function avviaPollingBtc(getConfig, tickMs = 60_000) {
  fermaPollingBtc();
  timerBtc = setInterval(async () => {
    if (inCorso) return;
    inCorso = true;
    try {
      const config = await getConfig();
      const { abilitato, avvisoPrivacyAccettato, intervalloMinuti } = config.importBtc ?? {};
      if (!abilitato || !avvisoPrivacyAccettato || !config.walletBtc?.length) return;
      const { ultimoControllo } = await leggiProposte();
      if (ultimoControllo && Date.now() - Date.parse(ultimoControllo) < intervalloMinuti * 60_000) return;
      const { nuove } = await controllaOra(config);
      if (nuove.length) notifica('Import BTC', `${nuove.length} nuove transazioni BTC da confermare`);
    } catch (err) {
      logger.error('Errore import BTC', { errore: err.message });
    } finally {
      inCorso = false;
    }
  }, tickMs);
}

export function fermaPollingBtc() {
  if (timerBtc) clearInterval(timerBtc);
  timerBtc = null;
}
