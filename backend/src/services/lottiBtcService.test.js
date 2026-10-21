import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lottiDaFatture, unisciLotti, calcolaLifo, saldoDaLotti, nettiPerAnno, applicaRiporto, calcolaIvcaDaLotti,
} from './lottiBtcService.js';

const lotto = (id, data, satoshi, costoEur) => ({ id, data, satoshi, costoEur });
const uscita = (id, data, satoshi, ricavoEur, tipo = 'vendita') => ({ id, tipo, data, satoshi, ricavoEur });
const L1 = lotto('L1', '2026-01-10', 1_000_000, 100);
const L2 = lotto('L2', '2026-02-10', 1_000_000, 200);

test('lotti da fatture: solo rate BTC, suffisso se txid ripetuto nella stessa fattura', () => {
  const txid = 'a'.repeat(64);
  const btc = { txid, satoshi: 5_000_000, cambioEurBtc: 90000, indirizzoDestinatario: 'bc1q' };
  const lotti = lottiDaFatture([
    { anno: 2026, mese: 3, clienteId: 'ACME', pagamenti: [{ data: '2026-03-15', importo: 450, btc }, { data: '2026-03-16', importo: 450, btc }, { data: '2026-03-17', importo: 9 }] },
  ]);
  assert.deepEqual(lotti.map((l) => l.id), [`IN-${'a'.repeat(12)}-2026-03-ACME`, `IN-${'a'.repeat(12)}-2026-03-ACME-2`]);
  assert.equal(lotti[0].costoEur, 450);
});

test('unisci lotti: ordinati per data, costoPerBtc per ingressi manuali', () => {
  const l = unisciLotti([L2], [{ id: 'M', data: '2026-01-01', satoshi: 1e8, costoEur: 50000, tipo: 'acquisto' }]);
  assert.deepEqual(l.map((x) => x.id), ['M', 'L2']);
  assert.equal(l[0].costoPerBtc, 50000);
});

test('LIFO base: uscita parziale consuma il lotto più recente', () => {
  const { lotti, cessioni } = calcolaLifo([L1, L2], [uscita('U', '2026-03-01', 400_000, 300)]);
  assert.equal(lotti[1].residui, 600_000);
  assert.equal(lotti[0].residui, 1_000_000);
  assert.equal(cessioni[0].costoEur, 80); // 200 * 0.4
  assert.equal(cessioni[0].plusvalenza, 220);
});

test('LIFO: uscita su più lotti', () => {
  const { lotti, cessioni } = calcolaLifo([L1, L2], [uscita('U', '2026-03-01', 1_500_000, 500)]);
  assert.deepEqual(lotti.map((l) => l.residui), [500_000, 0]);
  assert.equal(cessioni[0].costoEur, 250); // 200 + 100*0.5
  assert.equal(cessioni[0].plusvalenza, 250);
});

test('LIFO: non consuma lotti successivi alla data di uscita', () => {
  const { cessioni } = calcolaLifo([L1, L2], [uscita('U', '2026-01-20', 500_000, 100)]);
  assert.equal(cessioni[0].costoEur, 50);
});

test('uscita oltre il saldo noto: costo zero sul non coperto + satoshiNonCoperti', () => {
  const { cessioni } = calcolaLifo([L1], [uscita('U', '2026-03-01', 1_500_000, 300)]);
  assert.equal(cessioni[0].satoshiNonCoperti, 500_000);
  assert.equal(cessioni[0].plusvalenza, 200);
});

test('trasferimento: nessun consumo né plusvalenza', () => {
  const { lotti, cessioni } = calcolaLifo([L1], [uscita('T', '2026-03-01', 500_000, 0, 'trasferimento')]);
  assert.equal(lotti[0].residui, 1_000_000);
  assert.deepEqual(cessioni, []);
});

test('minusvalenza: vendita sotto costo', () => {
  const { cessioni } = calcolaLifo([L2], [uscita('U', '2026-03-01', 1_000_000, 150)]);
  assert.equal(cessioni[0].plusvalenza, -50);
});

test('uscita ante-2026 consuma i lotti ma non entra nei netti', () => {
  const vecchio = lotto('V', '2024-05-01', 1_000_000, 100);
  const { lotti, cessioni } = calcolaLifo([vecchio], [uscita('U', '2025-06-01', 400_000, 500)]);
  assert.equal(lotti[0].residui, 600_000);
  assert.deepEqual(nettiPerAnno(cessioni), {});
});

test('lotto ante-2026 usato come costo di una cessione 2026', () => {
  const vecchio = lotto('V', '2024-05-01', 1_000_000, 100);
  const { cessioni } = calcolaLifo([vecchio], [uscita('U', '2026-06-01', 1_000_000, 300)]);
  assert.deepEqual(nettiPerAnno(cessioni), { 2026: 200 });
});

test('riporto minusvalenze: compensa le più vecchie, scade dopo 4 anni', () => {
  const r = applicaRiporto({ 2026: -100, 2027: 60 }, 2027);
  assert.equal(r.compensate, 60);
  assert.equal(r.baseImponibile, 0);
  assert.deepEqual(r.minusvalenzeRiportabili, [{ anno: 2026, residuo: 40 }]);
  const scaduta = applicaRiporto({ 2026: -100, 2031: 50 }, 2031); // 2031-2026 = 5 > 4
  assert.equal(scaduta.baseImponibile, 50);
  assert.deepEqual(applicaRiporto({ 2026: -100 }, 2030).minusvalenzeRiportabili, [{ anno: 2026, residuo: 100 }]);
});

test('zero movimenti: tutto a zero, nessun errore', () => {
  const { lotti, cessioni } = calcolaLifo([], []);
  assert.deepEqual(saldoDaLotti(lotti), { satoshi: 0, costoTotaleEur: 0 });
  assert.deepEqual(cessioni, []);
  const ivca = calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: 90000, aliquota: 0.2 });
  assert.equal(ivca.impostaLorda, 0);
  assert.equal(ivca.valoreInizio, 0);
  assert.equal(ivca.mancaValoreMercato, false);
});

test('IVCA: lotto speso in corso d\'anno, giorni inclusivi dal 01/03 al 15/08 = 168', () => {
  const l = lotto('L', '2026-03-01', 1e8, 50000);
  const { lotti } = calcolaLifo([l], [uscita('U', '2026-08-15', 1e8, 60000)]);
  const ivca = calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: null, aliquota: 0.2 });
  assert.equal(ivca.dettaglioPerLotto[0].giorni, 168);
  assert.equal(ivca.impostaLorda, 55.23); // 60000 * 0.002 * 168/365
  assert.equal(ivca.impostaDaVersare, 55.23);
  assert.equal(ivca.mancaValoreMercato, false);
});

test('IVCA: lotto detenuto al 31/12 usa il prezzo di fine anno, anno intero = 365 giorni', () => {
  const l = lotto('L', '2025-06-01', 1e8, 50000);
  const { lotti } = calcolaLifo([l], []);
  const ivca = calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: 100000, prezzoInizio: 80000, aliquota: 0.2 });
  assert.equal(ivca.dettaglioPerLotto[0].giorni, 365);
  assert.equal(ivca.impostaLorda, 200);
  assert.equal(ivca.valoreInizio, 80000);
  assert.equal(ivca.valoreFine, 100000);
});

test('IVCA: valoreInizio (RW col. 7) = lotti a inizio anno al prezzo 31/12 prec. + costo dei lotti acquistati nell\'anno', () => {
  const { lotti } = calcolaLifo([lotto('A', '2025-06-01', 1e8, 50000), lotto('B', '2026-03-01', 1e8, 70000)], []);
  assert.equal(calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: 100000, prezzoInizio: 80000, aliquota: 0.2 }).valoreInizio, 150000);
  assert.equal(calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: 100000, aliquota: 0.2 }).valoreInizio, null);
});

test('IVCA: prezzo 31/12 mancante segnalato; sotto 12 EUR non si versa', () => {
  const l = lotto('L', '2026-01-01', 1e8, 1000);
  const { lotti } = calcolaLifo([l], []);
  assert.equal(calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: null, aliquota: 0.2 }).mancaValoreMercato, true);
  const piccolo = calcolaIvcaDaLotti(lotti, 2026, { prezzoFine: 3000, aliquota: 0.2 });
  assert.equal(piccolo.impostaLorda, 6);
  assert.equal(piccolo.impostaDaVersare, 0);
});

test('caso anonimizzato: tre acquisti, vendita in perdita su due lotti, poi vendita in utile sul residuo', () => {
  const lotti = [
    lotto('A1', '2026-01-10', 1_000_000, 400),
    lotto('A2', '2026-02-10', 1_000_000, 600),
    lotto('A3', '2026-03-10', 1_000_000, 800),
  ];
  const { lotti: stato, cessioni } = calcolaLifo(lotti, [
    uscita('V1', '2026-04-01', 1_500_000, 900),
    uscita('V2', '2026-06-01', 1_250_000, 1500),
  ]);
  // V1 consuma A3 (800) + metà di A2 (300) = 1100 → minusvalenza 200
  assert.equal(cessioni[0].costoEur, 1100);
  assert.equal(cessioni[0].plusvalenza, -200);
  // V2 consuma metà A2 (300) + 750.000 sat di A1 (300) = 600 → plusvalenza 900
  assert.equal(cessioni[1].costoEur, 600);
  assert.equal(cessioni[1].plusvalenza, 900);
  assert.deepEqual(saldoDaLotti(stato), { satoshi: 250_000, costoTotaleEur: 100 });
});
