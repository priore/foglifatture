import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prezzoChiusura3112 } from './prezzoStoricoBtcService.js';
import { exchangePrevalente } from './movimentiBtcService.js';

const t = Date.UTC(2025, 11, 31);
const risposta = (corpo, ok = true) => async () => ({ ok, status: ok ? 200 : 429, json: async () => corpo });

test('binance: chiusura della candela del 31/12', async () => {
  const r = await prezzoChiusura3112(2025, 'binance', risposta([[t, '1', '2', '3', '74354.81']]));
  assert.equal(r.prezzoEurBtc, 74354.81);
  assert.match(r.fonte, /Binance/);
});
test('kraken: candela giusta tra quelle restituite', async () => {
  const corpo = { error: [], result: { XXBTZEUR: [[t / 1000 - 86400, '1', '2', '3', '70000'], [t / 1000, '1', '2', '3', '75523.1']], last: 1 } };
  assert.equal((await prezzoChiusura3112(2025, 'kraken', risposta(corpo))).prezzoEurBtc, 75523.1);
});
test('errori: anno futuro/non valido, exchange non supportato, servizio giù, candela assente', async () => {
  await assert.rejects(prezzoChiusura3112(2999, 'binance', risposta([])), /non esiste ancora/);
  await assert.rejects(prezzoChiusura3112('x', 'binance', risposta([])), /non valido/);
  await assert.rejects(prezzoChiusura3112(2025, 'onetrading', risposta([])), /non disponibile per/);
  await assert.rejects(prezzoChiusura3112(2025, 'binance', risposta({}, false)), /non raggiungibile/);
  await assert.rejects(prezzoChiusura3112(2025, 'binance', risposta([[t + 1, '1', '2', '3', '5']])), /non disponibile su/);
  await assert.rejects(prezzoChiusura3112(2025, 'kraken', risposta({ result: { X: [] } })), /non disponibile su/);
});

test('exchange prevalente: per numero di movimenti, non per BTC; trasferimenti esclusi', () => {
  const mov = {
    ingressi: [{ exchange: 'kraken', data: '2025-01-01', satoshi: 1 }, { exchange: 'kraken', data: '2025-02-01', satoshi: 1 }, { exchange: 'binance', data: '2025-03-01', satoshi: 9e8 }],
    uscite: [{ exchange: 'binance', tipo: 'trasferimento', data: '2025-04-01' }, { data: '2025-05-01', tipo: 'vendita' }],
  };
  assert.equal(exchangePrevalente(mov), 'kraken');
  assert.equal(exchangePrevalente({ ingressi: [{ exchange: 'a', data: '2025-01-01' }, { exchange: 'b', data: '2025-06-01' }], uscite: [] }), 'b'); // parità: più recente
  assert.equal(exchangePrevalente({ ingressi: [{ data: '2025-01-01' }], uscite: [] }), null);
});

test('coinbase: candela [time, low, high, open, close, volume]', async () => {
  const r = await prezzoChiusura3112(2025, 'coinbase', risposta([[t / 1000, 1, 2, 3, 74473.24, 5]]));
  assert.equal(r.prezzoEurBtc, 74473.24);
  await assert.rejects(prezzoChiusura3112(2025, 'coinbase', risposta([])), /non disponibile su/);
});
