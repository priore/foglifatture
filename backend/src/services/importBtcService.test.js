import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir } from '../lib/jsonStore.js';
import {
  controllaIndirizzi, controllaOra, filtraTransazioni, leggiProposte,
  confermaProposta, scartaProposta, ripristinaProposta,
} from './importBtcService.js';
import { leggiMovimenti, aggiungiIngresso } from './movimentiBtcService.js';

const dirs = [];
beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'importbtc-'));
  dirs.push(dir);
  setDataDir(dir);
});
after(async () => {
  setDataDir(null);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

const MIO = 'bc1qmioindirizzo0000000000000000000';
const ALTRO = 'bc1qaltroindirizzo000000000000000000';
const TX_IN = 'a'.repeat(64);
const TX_OUT = 'b'.repeat(64);
const BLOCCO = 1_800_000_000; // 2027-01-15 UTC

const config = (extra = {}) => ({
  walletBtc: [{ etichetta: 'w', indirizzo: MIO }],
  importBtc: { confermeMinime: 3, urlPrimario: 'https://p1.test/api', urlFallback: 'https://p2.test/api', ...extra },
});

const tx = (txid, vin, vout, { height = 100, fee = 500 } = {}) => ({
  txid, fee, vin, vout, status: { confirmed: height != null, block_height: height, block_time: BLOCCO },
});
const ricezione = (txid, sat, opts) => tx(txid, [{ txid: 'c'.repeat(64), vout: 0, prevout: { scriptpubkey_address: ALTRO, value: sat + 500 } }],
  [{ scriptpubkey_address: MIO, value: sat }], opts);
const invio = (txid, sat, resto) => tx(txid,
  [{ txid: 'd'.repeat(64), vout: 0, prevout: { scriptpubkey_address: MIO, value: sat + resto + 500 } }],
  [{ scriptpubkey_address: ALTRO, value: sat }, { scriptpubkey_address: 'bc1qrestononconfigurato00000000000', value: resto }]);

// fetch finto: mappa URL -> lista tx per host; `giu` = host che rispondono 503.
function finto({ p1 = [], p2 = [], giu = [], tip = 102 } = {}) {
  const chiamate = [];
  const fn = async (url) => {
    chiamate.push(url);
    const host = new URL(url).host;
    if (giu.includes(host)) return { ok: false, status: 503 };
    const txs = host === 'p1.test' ? p1 : p2;
    return url.endsWith('/blocks/tip/height')
      ? { ok: true, text: async () => String(tip) }
      : { ok: true, json: async () => txs };
  };
  fn.chiamate = chiamate;
  return fn;
}
const opts = (fetchFn) => ({ fetchFn, attesaMs: 0 });

test('ingresso visto da entrambi i provider: candidato con conferme e data', async () => {
  const t = ricezione(TX_IN, 100_000);
  const r = await controllaIndirizzi(config(), opts(finto({ p1: [t], p2: [t] })));
  assert.equal(r.candidati.length, 1);
  assert.deepEqual(
    { d: r.candidati[0].direzione, s: r.candidati[0].satoshi, c: r.candidati[0].conferme, u: r.candidati[0].unaFonte, data: r.candidati[0].data },
    { d: 'ingresso', s: 100_000, c: 3, u: false, data: '2027-01-15' },
  );
});

test('provider discordanti: tx non proposta', async () => {
  const r = await controllaIndirizzi(config(), opts(finto({ p1: [ricezione(TX_IN, 100_000)], p2: [ricezione(TX_IN, 90_000)] })));
  assert.equal(r.candidati.length, 0);
  assert.deepEqual(r.discordanti, [TX_IN]);
});

test('un provider giù: proposta con unaFonte, errore riportato', async () => {
  const r = await controllaIndirizzi(config(), opts(finto({ p1: [ricezione(TX_IN, 100_000)], giu: ['p2.test'] })));
  assert.equal(r.candidati[0].unaFonte, true);
  assert.equal(r.errori.length, 1);
});

test('uscita: satoshi al netto del resto e della fee, con avviso change', async () => {
  const t = invio(TX_OUT, 40_000, 9_500); // input 50_000 = 40_000 + 9_500 + 500 fee
  const r = await controllaIndirizzi(config(), opts(finto({ p1: [t], p2: [t] })));
  const c = r.candidati[0];
  assert.equal(c.direzione, 'uscita');
  assert.equal(c.satoshi, 50_000 - 500); // inviati - ricevuti(0) - fee: il resto è su indirizzo non configurato
  assert.equal(c.feeSatoshi, 500);
  assert.match(c.avvisi[0], /resto/);
});

test('risposta con schema non valido: provider scartato', async () => {
  const fn = async (url) => (url.endsWith('/height') ? { ok: true, text: async () => '102' } : { ok: true, json: async () => [{ txid: 'x' }] });
  const r = await controllaIndirizzi(config(), opts(fn));
  assert.equal(r.candidati.length, 0);
  assert.equal(r.errori.length, 2);
});

test('errore 5xx ritentato, 4xx no', async () => {
  const f5 = finto({ giu: ['p1.test', 'p2.test'] });
  await controllaIndirizzi(config(), opts(f5));
  assert.equal(f5.chiamate.length, 6); // 2 provider x 3 tentativi sul tip
  const f4 = async () => ({ ok: false, status: 404 });
  let n = 0;
  await controllaIndirizzi(config(), opts(async (...a) => { n++; return f4(...a); }));
  assert.equal(n, 2);
});

test('nessun indirizzo configurato: nessuna chiamata', async () => {
  const f = finto();
  const r = await controllaIndirizzi({ ...config(), walletBtc: [] }, opts(f));
  assert.equal(f.chiamate.length, 0);
  assert.deepEqual(r.candidati, []);
});

test('filtraTransazioni: conferme minime, txid noti, già proposte', () => {
  const c = (txid, conferme) => ({ id: `PRP-${txid}`, txid, conferme });
  const out = filtraTransazioni([c('aa', 2), c('bb', 5), c('cc', 5), c('dd', 5)], {
    confermeMinime: 3, txidNoti: new Set(['bb']), proposteEsistenti: [{ id: 'PRP-cc' }],
  });
  assert.deepEqual(out.map((x) => x.txid), ['dd']);
});

test('controllaOra: salva proposte, non le ripropone, salta txid già registrati', async () => {
  const t = ricezione(TX_IN, 100_000);
  const f = finto({ p1: [t], p2: [t] });
  assert.equal((await controllaOra(config(), opts(f))).nuove.length, 1);
  assert.equal((await controllaOra(config(), opts(f))).nuove.length, 0);
  const { proposte, ultimoControllo } = await leggiProposte();
  assert.equal(proposte.length, 1);
  assert.ok(ultimoControllo);
  await aggiungiIngresso({ tipo: 'acquisto', data: '2027-01-01', satoshi: 1000, costoEur: 1, txid: 'e'.repeat(64) });
  const gia = ricezione('e'.repeat(64), 1000);
  assert.equal((await controllaOra(config(), opts(finto({ p1: [gia], p2: [gia] })))).nuove.length, 0);
});

test('conferma ingresso: crea il movimento; riconferma rifiutata', async () => {
  const t = ricezione(TX_IN, 100_000);
  await controllaOra(config(), opts(finto({ p1: [t], p2: [t] })));
  const [{ id }] = (await leggiProposte()).proposte;
  await confermaProposta(id, { costoEur: 70 });
  const { ingressi } = await leggiMovimenti();
  assert.equal(ingressi[0].txid, TX_IN);
  assert.equal(ingressi[0].costoEur, 70);
  await assert.rejects(() => confermaProposta(id, { costoEur: 70 }), /già confermata/);
});

test('conferma uscita: crea l\'uscita con fee e fonte import-polling', async () => {
  const t = invio(TX_OUT, 40_000, 9_500);
  await controllaOra(config(), opts(finto({ p1: [t], p2: [t] })));
  const [{ id }] = (await leggiProposte()).proposte;
  await confermaProposta(id, { tipo: 'vendita', ricavoEur: 30 });
  const { uscite } = await leggiMovimenti();
  assert.deepEqual([uscite[0].feeSatoshi, uscite[0].fonte, uscite[0].ricavoEur], [500, 'import-polling', 30]);
});

test('scarta e ripristina: scartata non viene riproposta', async () => {
  const t = ricezione(TX_IN, 100_000);
  const f = finto({ p1: [t], p2: [t] });
  await controllaOra(config(), opts(f));
  const [{ id }] = (await leggiProposte()).proposte;
  await scartaProposta(id);
  assert.equal((await controllaOra(config(), opts(f))).nuove.length, 0);
  assert.equal((await leggiProposte()).proposte[0].stato, 'scartata');
  await ripristinaProposta(id);
  assert.equal((await leggiProposte()).proposte[0].stato, 'proposta');
  await assert.rejects(() => ripristinaProposta(id), /già proposta/);
});
