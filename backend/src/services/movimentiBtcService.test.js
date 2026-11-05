import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir } from '../lib/jsonStore.js';
import { leggiMovimenti, aggiungiIngresso, aggiungiUscita, eliminaIngresso, eliminaUscita, impostaValoreMercato, dichiaraGiacenza, dataUltimaGiacenza } from './movimentiBtcService.js';
import { anteprimaUscita, lottiConStato } from './lottiBtcService.js';

const dirs = [];
beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'movbtc-'));
  dirs.push(dir);
  setDataDir(dir);
});
after(async () => {
  setDataDir(null);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

const ingresso = { tipo: 'acquisto', data: '2099-06-10', satoshi: 10_000_000, costoEur: 800 };
const vendita = { tipo: 'vendita', data: '2099-08-20', satoshi: 3_000_000, ricavoEur: 350 };

test('file mancante: default vuoto', async () => {
  assert.deepEqual(await leggiMovimenti(), { ingressi: [], uscite: [], valoriMercato: {} });
});

test('CRUD ingresso e uscita, valoriMercato preservato', async () => {
  const { movimento: i } = await aggiungiIngresso(ingresso);
  const { movimento: u } = await aggiungiUscita(vendita);
  assert.match(i.id, /^IN-MAN-/);
  assert.match(u.id, /^OUT-/);
  assert.equal(i.fonte, 'manuale');
  let mov = await leggiMovimenti();
  assert.equal(mov.ingressi.length, 1);
  assert.equal(mov.uscite.length, 1);
  await eliminaIngresso(i.id);
  await eliminaUscita(u.id);
  mov = await leggiMovimenti();
  assert.deepEqual([mov.ingressi, mov.uscite, mov.valoriMercato], [[], [], {}]);
  await assert.rejects(() => eliminaUscita(u.id), /non trovato/);
});

test('validazione ingresso', async () => {
  await assert.rejects(() => aggiungiIngresso({ ...ingresso, tipo: 'x' }), /Tipo/);
  await assert.rejects(() => aggiungiIngresso({ ...ingresso, data: '2099-02-30' }), /Data/);
  await assert.rejects(() => aggiungiIngresso({ ...ingresso, satoshi: 1.5 }), /Satoshi/);
  await assert.rejects(() => aggiungiIngresso({ ...ingresso, satoshi: 0 }), /Satoshi/);
  await assert.rejects(() => aggiungiIngresso({ ...ingresso, txid: 'abc' }), /TXID/);
  await assert.rejects(() => aggiungiIngresso({ ...ingresso, costoEur: -1 }), /Costo/);
  await aggiungiIngresso({ ...ingresso, txid: 'a'.repeat(64) });
});

test('validazione uscita: ricavo per tipo', async () => {
  await assert.rejects(() => aggiungiUscita({ ...vendita, ricavoEur: 0 }), /Ricavo/);
  await assert.rejects(() => aggiungiUscita({ ...vendita, tipo: 'spesa', ricavoEur: undefined }), /Ricavo/);
  await assert.rejects(() => aggiungiUscita({ ...vendita, tipo: 'trasferimento' }), /trasferimento/);
  const { movimento } = await aggiungiUscita({ ...vendita, tipo: 'trasferimento', ricavoEur: undefined });
  assert.equal(movimento.ricavoEur, 0);
  await assert.rejects(() => aggiungiUscita({ ...vendita, feeSatoshi: -1 }), /Fee/);
});

test('avviso solo per anno già chiuso', async () => {
  assert.deepEqual((await aggiungiIngresso(ingresso)).avvisi, []);
  const { avvisi } = await aggiungiIngresso({ ...ingresso, data: '2020-01-01' });
  assert.equal(avvisi.length, 1);
});

test('valore mercato 31/12: salva e valida', async () => {
  assert.deepEqual(await impostaValoreMercato(2026, 95000), { 2026: 95000 });
  assert.equal((await leggiMovimenti()).valoriMercato[2026], 95000);
  await assert.rejects(() => impostaValoreMercato(2026, 0), /Valore/);
  await assert.rejects(() => impostaValoreMercato(26, 100), /Anno/);
});

test('anteprima uscita: LIFO senza salvare', async () => {
  await aggiungiIngresso({ ...ingresso, data: '2026-01-10' });
  const { cessione, avvisi } = await anteprimaUscita({ ...vendita, data: '2026-08-20' });
  assert.equal(cessione.costoEur, 240); // 3M di 10M sat a 800 EUR
  assert.equal(cessione.plusvalenza, 110);
  assert.deepEqual(avvisi, []);
  assert.equal((await leggiMovimenti()).uscite.length, 0);
  const [lotto] = await lottiConStato(2026);
  assert.equal(lotto.stato, 'intatto');
  await assert.rejects(() => anteprimaUscita({ ...vendita, ricavoEur: 0 }), /Ricavo/);
});

test('giacenza: costo assente = 0 con avviso, nessuna scrittura se esiste già senza modalità', async () => {
  const g = { data: '2099-01-01', satoshi: 50_000_000, custodia: 'Ledger' };
  const { movimento, avvisi } = await dichiaraGiacenza(g);
  assert.equal(movimento.tipo, 'saldo-iniziale');
  assert.equal(movimento.costoNonDocumentato, true);
  assert.ok(avvisi.some((a) => /Costo non documentato/.test(a)));
  const doppio = await dichiaraGiacenza({ ...g, custodia: ' ledger ' });
  assert.equal(doppio.esistente.id, movimento.id);
  assert.equal((await leggiMovimenti()).ingressi.length, 1);
});

test('giacenza: somma e sovrascrivi sullo stesso wallet, wallet diverso = giacenza separata', async () => {
  const base = { data: '2099-01-01', satoshi: 10_000_000, costoEur: 100, custodia: 'Ledger' };
  const { movimento: m } = await dichiaraGiacenza(base);
  const somma = await dichiaraGiacenza({ ...base, data: '2099-03-01', satoshi: 5_000_000, costoEur: 70 }, 'somma');
  assert.deepEqual([somma.movimento.id, somma.movimento.satoshi, somma.movimento.costoEur, somma.movimento.data], [m.id, 15_000_000, 170, '2099-03-01']);
  const sovr = await dichiaraGiacenza({ ...base, satoshi: 2_000_000 }, 'sovrascrivi');
  assert.equal(sovr.movimento.satoshi, 2_000_000);
  assert.equal(sovr.movimento.costoNonDocumentato, undefined);
  await dichiaraGiacenza({ ...base, custodia: 'Trezor' });
  assert.equal((await leggiMovimenti()).ingressi.length, 2);
  assert.equal(await dataUltimaGiacenza(), '2099-01-01');
  await assert.rejects(dichiaraGiacenza(base, 'boh'), /Modalità/);
});

test('giacenza: il lotto entra nel saldo', async () => {
  await dichiaraGiacenza({ data: '2099-01-01', satoshi: 10_000_000 });
  const lotti = await lottiConStato(2099);
  assert.equal(lotti.reduce((t, l) => t + l.residui, 0), 10_000_000);
});
