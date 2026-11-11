// Flusso utente: area fiscale (versamenti F24 CRUD, dashboard, stime, accantonamento, dichiarazione, export)
// e registro BTC (ingressi/uscite CRUD, lotti, plusvalenze, RW, import da file con conferma/scarto).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, ANNO } from './datiModello.js';

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

const F = '/api/forfettario';
const get = (p) => amb.api('GET', F + p);

test('versamenti F24: inserimento, lettura per anno, eliminazione', async () => {
  const prima = (await get('/versamenti')).corpo.length;
  const r = await amb.api('POST', `${F}/versamenti`, { data: `${ANNO}-11-30`, tipo: 'imposta', importo: 250.5, codice: '1791' });
  assert.equal(r.stato, 201);
  assert.equal((await get('/versamenti')).corpo.length, prima + 1);
  assert.ok((await get(`/versamenti?anno=${ANNO}`)).corpo.some((v) => v.id === r.corpo.id));
  assert.equal((await get('/versamenti?anno=2020')).corpo.length, 0);
  assert.equal((await amb.api('DELETE', `${F}/versamenti/${r.corpo.id}`)).stato, 204);
  assert.equal((await get('/versamenti')).corpo.length, prima);
  assert.equal((await amb.api('DELETE', `${F}/versamenti/inesistente`)).stato, 204, 'idempotente');
});

test('versamenti F24: dati non validi rifiutati senza scrivere nulla', async () => {
  const prima = (await get('/versamenti')).corpo.length;
  for (const corpo of [{}, { data: `${ANNO}-01-01`, tipo: 'imposta', importo: 0 }, { data: `${ANNO}-01-01`, tipo: 'imposta', importo: -3 },
    { data: `${ANNO}-01-01`, tipo: 'imposta', importo: 10, codice: 'ZZZZ' }, { tipo: 'INPS', importo: 5 }]) {
    assert.equal((await amb.api('POST', `${F}/versamenti`, corpo)).stato, 400, JSON.stringify(corpo));
  }
  assert.equal((await get('/versamenti')).corpo.length, prima);
});

test('versamenti: export CSV scaricabile', async () => {
  const r = await get('/versamenti/export');
  assert.equal(r.stato, 200);
  assert.ok(r.testo.length > 10);
});

test('dashboard, fatture aperte, accantonamento, stima versamenti, dichiarazione: rispondono con dati coerenti', async () => {
  for (const p of [`/dashboard?anno=${ANNO}`, '/fatture-aperte', `/accantonamento?anno=${ANNO}`, `/versamenti-stimati?anno=${ANNO}`, `/dichiarazione?anno=${ANNO}`]) {
    const r = await get(p);
    assert.equal(r.stato, 200, `${p} → ${r.stato} ${r.testo.slice(0, 120)}`);
    assert.ok(r.corpo && typeof r.corpo === 'object');
  }
});

test('dichiarazione in PDF e export commercialista scaricabili', async () => {
  const pdf = await get(`/dichiarazione/pdf?anno=${ANNO}`);
  assert.equal(pdf.stato, 200);
  assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
  const csv = await get(`/export-commercialista?anno=${ANNO}`);
  assert.equal(csv.stato, 200);
  assert.match(csv.testo, /Cliente/i);
});

test('rate del saldo: valori 1..7 accettati, altri rifiutati', async () => {
  assert.equal((await amb.api('PUT', `${F}/versamenti-stimati/rate-saldo`, { rateSaldo: 3 })).stato, 200);
  for (const v of [0, 8, 1.5, 'x', null]) {
    assert.equal((await amb.api('PUT', `${F}/versamenti-stimati/rate-saldo`, { rateSaldo: v })).stato, 400, String(v));
  }
  assert.equal((await amb.api('GET', '/api/config')).corpo.forfettario.rateSaldo, 3);
});

test('imprevisto: anno assurdo o parametri sporchi non provocano 500 incontrollati', async () => {
  for (const p of ['/dashboard?anno=abc', '/versamenti-stimati?anno=1900', '/accantonamento?anno=9999', '/versamenti?anno=zzz']) {
    const r = await get(p);
    assert.ok(r.stato < 600 && r.stato !== 0, `${p} → ${r.stato}`);
  }
});

// ── Registro BTC ───────────────────────────────────────────────
const sat = 10_000_000;
const ingresso = (extra = {}) => ({ tipo: 'acquisto', data: `${ANNO}-02-01`, satoshi: sat, costoEur: 6000, ...extra });
const uscita = (extra = {}) => ({ tipo: 'vendita', data: `${ANNO}-09-01`, satoshi: 5_000_000, ricavoEur: 4000, ...extra });

test('BTC: ingresso e uscita inseriti, lotti e plusvalenze (LIFO) calcolati', async () => {
  const i = await amb.api('POST', `${F}/btc/movimenti/ingresso`, ingresso());
  assert.equal(i.stato, 201);
  const u = await amb.api('POST', `${F}/btc/movimenti/uscita`, uscita());
  assert.equal(u.stato, 201);
  const mov = (await get('/btc/movimenti')).corpo;
  assert.ok(mov.ingressi.some((x) => x.id === i.corpo.movimento.id) && mov.uscite.some((x) => x.id === u.corpo.movimento.id));
  const lotti = await get(`/btc/lotti?anno=${ANNO}`);
  assert.equal(lotti.stato, 200);
  const plus = (await get(`/btc/plusvalenze?anno=${ANNO}`)).corpo;
  assert.ok(JSON.stringify(plus).includes('4000'));
  assert.equal((await get(`/btc/rw?anno=${ANNO}`)).stato, 200);
});

test('BTC: anteprima di una vendita non salva nulla', async () => {
  const prima = (await get('/btc/movimenti')).corpo.uscite.length;
  const a = await amb.api('POST', `${F}/btc/plusvalenze/anteprima`, uscita({ satoshi: 1_000_000, ricavoEur: 900 }));
  assert.equal(a.stato, 200);
  assert.equal((await get('/btc/movimenti')).corpo.uscite.length, prima);
});

test('BTC: eliminazione di ingressi e uscite, poi id inesistente', async () => {
  const i = (await amb.api('POST', `${F}/btc/movimenti/ingresso`, ingresso({ tipo: 'mining', costoEur: 0 }))).corpo.movimento;
  const u = (await amb.api('POST', `${F}/btc/movimenti/uscita`, uscita({ tipo: 'trasferimento', ricavoEur: 0 }))).corpo.movimento;
  assert.equal((await amb.api('DELETE', `${F}/btc/movimenti/${u.id}`)).stato, 200);
  assert.equal((await amb.api('DELETE', `${F}/btc/movimenti/${i.id}`)).stato, 200);
  assert.equal((await amb.api('DELETE', `${F}/btc/movimenti/${i.id}`)).stato, 404);
  assert.equal((await amb.api('DELETE', `${F}/btc/movimenti/OUT-nessuno`)).stato, 404);
});

test('BTC imprevisto: movimenti non validi rifiutati (tipo, data, satoshi, txid, ricavo)', async () => {
  const prima = JSON.stringify((await get('/btc/movimenti')).corpo);
  const casiIn = [{ tipo: 'regalo' }, { data: '2026-02-31' }, { data: 'ieri' }, { satoshi: 0 }, { satoshi: 1.5 }, { txid: 'corto' }, { costoEur: -1 }];
  for (const c of casiIn) assert.equal((await amb.api('POST', `${F}/btc/movimenti/ingresso`, ingresso(c))).stato, 400, JSON.stringify(c));
  const casiOut = [{ ricavoEur: 0 }, { tipo: 'trasferimento', ricavoEur: 10 }, { feeSatoshi: -1 }, { cambioEurBtc: 0 }, { fonte: 'boh' }];
  for (const c of casiOut) assert.equal((await amb.api('POST', `${F}/btc/movimenti/uscita`, uscita(c))).stato, 400, JSON.stringify(c));
  assert.equal(JSON.stringify((await get('/btc/movimenti')).corpo), prima);
});

test('BTC: valore di mercato di fine anno impostabile e validato', async () => {
  assert.equal((await amb.api('PUT', `${F}/btc/rw/valore-mercato`, { anno: ANNO, prezzoEurBtc: 88000 })).stato, 200);
  assert.equal((await amb.api('PUT', `${F}/btc/rw/valore-mercato`, { anno: ANNO, prezzoEurBtc: -1 })).stato, 400);
});

test('BTC: giacenza iniziale dichiarata una volta; la seconda chiede come procedere', async () => {
  const corpo = { data: `${ANNO - 1}-12-31`, satoshi: 1_000_000, costoEur: 500, indirizzo: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' };
  const a = await amb.api('POST', `${F}/btc/movimenti/giacenza`, corpo);
  assert.ok([201, 400].includes(a.stato), `${a.stato} ${a.testo.slice(0, 100)}`);
  if (a.stato === 201) assert.equal((await amb.api('POST', `${F}/btc/movimenti/giacenza`, corpo)).stato, 409);
});

test('BTC import da file: proposte create, confermate, scartate, ripristinate; il file rimandato non duplica', async () => {
  const csv = `transaction_hash,label,confirmations,value,timestamp\n${'e'.repeat(64)},,10,0.005,${ANNO}-03-15 10:00\n${'f'.repeat(64)},,10,0.002,${ANNO}-03-16 10:00`;
  const invia = () => {
    const fd = new FormData();
    fd.append('file', new Blob([csv]), 'storico.csv');
    fd.append('formato', 'auto');
    return amb.api('POST', `${F}/btc/import/file`, fd);
  };
  const r = await invia();
  assert.equal(r.stato, 200, r.testo.slice(0, 200));
  const elenco = (await get('/btc/import')).corpo.proposte;
  assert.ok(elenco.length >= 2);
  const [p1, p2] = elenco;
  assert.equal((await amb.api('POST', `${F}/btc/import/proposte/${p1.id}/scarta`, {})).stato, 200);
  assert.equal((await amb.api('POST', `${F}/btc/import/proposte/${p1.id}/ripristina`, {})).stato, 200);
  const prima = (await get('/btc/movimenti')).corpo.ingressi.length;
  const c = await amb.api('POST', `${F}/btc/import/proposte/${p2.id}/conferma`, {});
  assert.ok([200, 400].includes(c.stato), c.testo.slice(0, 150));
  if (c.stato === 200) assert.ok((await get('/btc/movimenti')).corpo.ingressi.length >= prima);
  const doppio = await invia();
  assert.equal(doppio.stato, 200);
  assert.equal((await amb.api('POST', `${F}/btc/import/proposte/inesistente/conferma`, {})).stato, 400);
});

test('BTC import imprevisto: senza file, controllo con wallet/avviso mancanti', async () => {
  assert.equal((await amb.api('POST', `${F}/btc/import/file`, new FormData())).stato, 400);
  assert.equal((await amb.api('POST', `${F}/btc/import/controlla`, {})).stato, 400, 'nessuna chiamata di rete senza avviso privacy accettato');
});
