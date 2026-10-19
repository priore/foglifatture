import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir } from '../lib/jsonStore.js';
import {
  parseCsv, parseNumero, aSatoshi, rilevaFormato, parseJsonImport, oscuraCella, promptMapping, importaDaFile,
} from './importFileBtcService.js';
import { leggiProposte, confermaProposta } from './importBtcService.js';
import { leggiMovimenti } from './movimentiBtcService.js';

const dirs = [];
beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'importfilebtc-'));
  dirs.push(dir);
  setDataDir(dir);
});
after(async () => {
  setDataDir(null);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

const TX1 = 'a'.repeat(64);
const TX2 = 'b'.repeat(64);

test('parseCsv: virgolette, virgola nel campo, separatore ; e BOM', () => {
  assert.deepEqual(parseCsv('﻿a,b\n"x,y","he said ""hi"""\n'), [['a', 'b'], ['x,y', 'he said "hi"']]);
  assert.deepEqual(parseCsv('a;b\r\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('parseNumero e aSatoshi', () => {
  assert.equal(parseNumero('1.234,56'), 1234.56);
  assert.equal(parseNumero('0,00100000'), 0.001);
  assert.equal(aSatoshi('-0.001'), -100000);
  assert.equal(aSatoshi('150000', 'auto'), 150000);
  assert.equal(aSatoshi('0.0015', 'auto'), 150000);
  assert.ok(Number.isNaN(aSatoshi('abc')));
});

test('rilevaFormato dall\'intestazione', () => {
  assert.equal(rilevaFormato(['Date (UTC)', 'Label', 'Value', 'Balance', 'Txid']), 'sparrow');
  assert.equal(rilevaFormato(['transaction_hash', 'label', 'confirmations', 'value', 'timestamp']), 'electrum');
  assert.equal(rilevaFormato(['txid', 'refid', 'time', 'type', 'asset', 'amount']), 'kraken');
  assert.equal(rilevaFormato(['Giorno', 'Quantita']), null);
});

test('Sparrow: ingresso e uscita, righe senza data scartate', async () => {
  const csv = `Date (UTC),Label,Value,Balance,Txid
2026-03-15 10:00:00,cliente,500000,500000,${TX1}
2026-04-01 09:00:00,spesa,-200000,300000,${TX2}
,non confermata,100,300100,${'c'.repeat(64)}`;
  const r = await importaDaFile(csv);
  assert.deepEqual([r.formato, r.nuove, r.scartate], ['sparrow', 2, 1]);
  const { proposte } = await leggiProposte();
  const uscita = proposte.find((p) => p.direzione === 'uscita');
  assert.equal(uscita.satoshi, 200000);
  assert.equal(uscita.fonte, 'import-file');
  assert.equal(uscita.txid, TX2);
});

test('reimport dello stesso file: nessuna proposta duplicata', async () => {
  const csv = `transaction_hash,label,confirmations,value,timestamp\n${TX1},,10,0.005,2026-03-15 10:00`;
  assert.equal((await importaDaFile(csv)).nuove, 1);
  const r = await importaDaFile(csv);
  assert.deepEqual([r.nuove, r.duplicate], [0, 1]);
});

test('Kraken: trade con controvalore EUR, depositi/prelievi ignorati', async () => {
  const csv = `"txid","refid","time","type","subtype","aclass","asset","wallet","amount","fee","balance"
"L1","R1","2026-05-01 10:00:00","trade","","currency","XXBT","spot / main","0.01000000","0","0.01"
"L2","R1","2026-05-01 10:00:00","trade","","currency","ZEUR","spot / main","-800.0000","1.2","0"
"L3","R2","2026-06-01 10:00:00","withdrawal","","currency","XXBT","spot / main","-0.00500000","0.0001","0.005"
"L4","R3","2026-07-01 10:00:00","trade","","currency","XXBT","spot / main","-0.00500000","0","0"
"L5","R3","2026-07-01 10:00:00","trade","","currency","ZEUR","spot / main","450.0000","0.7","450"`;
  const r = await importaDaFile(csv);
  assert.deepEqual([r.formato, r.nuove, r.ignorate], ['kraken', 2, 1]);
  const { proposte } = await leggiProposte();
  const acq = proposte.find((p) => p.direzione === 'ingresso');
  assert.deepEqual([acq.satoshi, acq.valoreEur, acq.tipoSuggerito, acq.txid], [1_000_000, 800, 'acquisto', undefined]);
  // conferma: costo EUR e tipo precompilati dal file
  await confermaProposta(acq.id);
  assert.equal((await leggiMovimenti()).ingressi[0].costoEur, 800);
  const vend = proposte.find((p) => p.direzione === 'uscita');
  await confermaProposta(vend.id);
  const { uscite } = await leggiMovimenti();
  assert.deepEqual([uscite[0].tipo, uscite[0].ricavoEur, uscite[0].fonte], ['vendita', 450, 'import-file']);
});

test('parseJsonImport: lista e oggetto transactions, timestamp unix', () => {
  const r = parseJsonImport(JSON.stringify({ transactions: [{ txid: TX1, timestamp: 1_800_000_000, bc_value: '-0.001' }, { value: '1' }] }));
  assert.equal(r[0].direzione, 'uscita');
  assert.equal(r[0].satoshi, 100000);
  assert.equal(r[1], null);
  assert.throws(() => parseJsonImport('{"a":1}'), /lista di transazioni/);
});

test('formato sconosciuto: richiede autorizzazione, poi propone mapping validato', async () => {
  const csv = 'Giorno,Quantita,Wallet\n2026-03-15,0.5,bc1qsegretissimoindirizzo000000000000\n';
  await assert.rejects(importaDaFile(csv, { config: { ai: {} } }), { codice: 'AUTORIZZAZIONE_RICHIESTA' });
  let promptInviato;
  const ai = async (p) => { promptInviato = p; return { testo: 'ok {"colonnaData":0,"colonnaImporto":1,"unita":"btc"}' }; };
  const r = await importaDaFile(csv, { config: { ai: { autorizzaDatiFiscali: true } }, ai });
  assert.equal(r.richiedeMapping, true);
  assert.equal(r.mappingProposto.colonnaImporto, 1);
  assert.ok(!promptInviato.includes('segretissimo'));
  await assert.rejects(importaDaFile(csv, { conferma: true, ai: async () => ({ testo: '{"colonnaData":9,"colonnaImporto":1,"unita":"btc"}' }) }), /Mapping/);
  assert.equal((await leggiProposte()).proposte.length, 0); // nulla salvato prima della conferma
});

test('mapping confermato dall\'utente: parsing con segno e colonna tipo', async () => {
  const csv = 'Giorno,Quantita,Verso\n2026-03-15,0.5,incoming\n2026-03-20,0.1,sell';
  const r = await importaDaFile(csv, { mapping: { colonnaData: 0, colonnaImporto: 1, unita: 'btc', colonnaTipo: 2 } });
  assert.deepEqual([r.formato, r.nuove], ['mapping', 2]);
  const { proposte } = await leggiProposte();
  assert.deepEqual(proposte.map((p) => [p.direzione, p.satoshi]), [['ingresso', 50_000_000], ['uscita', 10_000_000]]);
});

test('oscuraCella: numeri e date in chiaro, indirizzi/etichette hashati', () => {
  assert.equal(oscuraCella('0.5'), '0.5');
  assert.equal(oscuraCella('2026-03-15 10:00'), '2026-03-15 10:00');
  assert.match(oscuraCella('bc1qxyz'), /^h_[0-9a-f]{10}$/);
  assert.equal(oscuraCella('Mario Rossi'), oscuraCella('Mario Rossi'));
  assert.ok(!promptMapping(['a'], [['Mario Rossi']]).includes('Mario'));
});

test('Binance report fiscale: acquisto, vendita, deposito ignorato, righe non BTC scartate', async () => {
  const csv = `id,datetime_tz_CET,type,label,a,b,sent_amount,sent_currency,sent_value_EUR,c,received_amount,received_currency,received_value_EUR,d,fee_amount,fee_currency,fee_value_EUR
B1,2026-05-01 10:00:00,buy,,,,800,EUR,800,,0.01,BTC,800,,0,BTC,0
B2,2026-06-01 10:00:00,sell,,,,0.005,BTC,450,,450,EUR,450,,0,EUR,0
B3,2026-06-02 10:00:00,deposit,,,,,,,,0.1,BTC,9000,,0,BTC,0
B4,2026-06-03 10:00:00,buy,,,,100,EUR,100,,0.5,ETH,100,,0,EUR,0`;
  const r = await importaDaFile(csv);
  assert.deepEqual([r.formato, r.nuove, r.ignorate, r.scartate], ['binance', 2, 1, 2]);
  const { proposte } = await leggiProposte();
  const acq = proposte.find((p) => p.direzione === 'ingresso');
  assert.deepEqual([acq.satoshi, acq.valoreEur, acq.tipoSuggerito], [1_000_000, 800, 'acquisto']);
  const ven = proposte.find((p) => p.direzione === 'uscita');
  assert.deepEqual([ven.satoshi, ven.valoreEur, ven.tipoSuggerito], [500_000, 450, 'vendita']);
});

test('Coinbase: righe di presentazione prima dell\'intestazione, buy/sell/send', async () => {
  const csv = `Transactions
User,Mario Rossi,id-1
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
c1,2026-05-01T10:00:00Z,Buy,BTC,0.01,EUR,80000,800,805,5,
c2,2026-06-01T10:00:00Z,Sell,BTC,-0.005,EUR,90000,450,445,5,
c3,2026-06-02T10:00:00Z,Send,BTC,-0.001,EUR,90000,90,90,0,
c4,2026-06-03T10:00:00Z,Buy,ETH,1,EUR,2000,2000,2000,0,`;
  const r = await importaDaFile(csv);
  assert.deepEqual([r.formato, r.nuove, r.ignorate], ['coinbase', 2, 1]);
  const { proposte } = await leggiProposte();
  assert.deepEqual(proposte.map((p) => [p.direzione, p.satoshi, p.valoreEur]).sort(), [['ingresso', 1_000_000, 805], ['uscita', 500_000, 445]]);
});

test('One Trading: buy/sell su BTC_EUR, staking, deposito ignorato', async () => {
  const csv = `Transaction ID,Time,Type,Instrument,Price,Amount,Fee,Fee Currency,Total
o1,2026-05-01T10:00:00Z,Buy,BTC_EUR,80000,0.01,1,EUR,800
o2,2026-06-01T10:00:00Z,Sell,BTC_EUR,90000,0.005,1,EUR,450
o3,2026-06-02T10:00:00Z,Deposit,BTC,,0.1,0,BTC,0
o4,2026-06-03T10:00:00Z,Staking,BTC,,0.0001,0,BTC,0
o5,2026-06-04T10:00:00Z,Buy,ETH_EUR,2000,1,1,EUR,2000`;
  const r = await importaDaFile(csv);
  assert.deepEqual([r.formato, r.nuove, r.ignorate], ['onetrading', 3, 1]);
  const { proposte } = await leggiProposte();
  assert.equal(proposte.find((p) => p.tipoSuggerito === 'ricevuto').valoreEur, undefined);
});
