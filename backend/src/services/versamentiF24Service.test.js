import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contributiInpsVersati, accontiImpostaVersati, accontiIvcaVersati } from './versamentiF24Service.js';

const versamenti = [
  { id: '1', data: '2026-06-30', tipo: 'Imposta sostitutiva', importo: 500, codice: '1792' },
  { id: '2', data: '2026-06-30', tipo: 'Imposta sostitutiva', importo: 400, codice: '1790' },
  { id: '3', data: '2026-11-30', tipo: 'Imposta sostitutiva', importo: 400, codice: '1791' },
  { id: '4', data: '2026-06-30', tipo: 'INPS', importo: 300 },
  { id: '5', data: '2026-11-30', tipo: 'INPS', importo: 200 },
  { id: '6', data: '2025-06-30', tipo: 'INPS', importo: 100 },
];

describe('contributiInpsVersati', () => {
  it('somma solo tipo INPS nell anno richiesto', () => {
    assert.equal(contributiInpsVersati(versamenti, 2026), 500);
  });
  it('restituisce 0 se nessun INPS nell anno', () => {
    assert.equal(contributiInpsVersati(versamenti, 2024), 0);
  });
  it('non include anni diversi', () => {
    assert.equal(contributiInpsVersati(versamenti, 2025), 100);
  });
});

describe('accontiImpostaVersati', () => {
  it('somma 1790 e 1791 nell anno', () => {
    assert.equal(accontiImpostaVersati(versamenti, 2026), 800);
  });
  it('restituisce null se nessun versamento con codice', () => {
    const senzaCodice = [
      { id: '1', data: '2026-06-30', tipo: 'Imposta sostitutiva', importo: 500 },
    ];
    assert.equal(accontiImpostaVersati(senzaCodice, 2026), null);
  });
  it('restituisce null per anno senza versamenti', () => {
    assert.equal(accontiImpostaVersati(versamenti, 2024), null);
  });
  it('non include il saldo 1792', () => {
    const soloSaldo = [{ id: '1', data: '2026-06-30', tipo: 'Imposta sostitutiva', importo: 500, codice: '1792' }];
    assert.equal(accontiImpostaVersati(soloSaldo, 2026), null);
  });
  it('A5: esclude la quota maggiorazione dal totale acconti', () => {
    const conMaggiorazione = [
      { id: '1', data: '2026-06-30', tipo: 'Imposta sostitutiva', importo: 402, codice: '1790', maggiorazione: 2 },
      { id: '2', data: '2026-11-30', tipo: 'Imposta sostitutiva', importo: 400, codice: '1791' },
    ];
    assert.equal(accontiImpostaVersati(conMaggiorazione, 2026), 800);
  });
  it('A5: maggiorazione assente trattata come zero (retrocompatibile)', () => {
    assert.equal(accontiImpostaVersati(versamenti, 2026), 800);
  });
});

describe('accontiIvcaVersati', () => {
  const v = [
    { data: '2026-06-30', importo: 40, codice: '1728' },
    { data: '2026-11-30', importo: 60, codice: '1729' },
    { data: '2026-06-30', importo: 400, codice: '1790' },
  ];
  it('somma 1728 e 1729 senza toccare 1790', () => assert.equal(accontiIvcaVersati(v, 2026), 100));
  it('null se nessun acconto IVCA', () => assert.equal(accontiIvcaVersati(v, 2025), null));
});
