import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previsioneSoglia } from './forfettarioService.js';

const BASE = { sogliaAnnua: 85000, sogliaUscitaImmediata: 100000, limitePersonale: 0 };

test('previsioneSoglia: ok sotto l\'80%', () => {
  const r = previsioneSoglia({ incassato: 50000, daIncassare: 0, importoFattura: 1000, ...BASE });
  assert.equal(r.livelloSoglia, 'ok');
  assert.equal(r.livelloUscita, 'ok');
  assert.equal(r.livelloLimitePersonale, 'ok');
});

test('previsioneSoglia: vicino tra 80% e 100% della soglia 85k', () => {
  const r = previsioneSoglia({ incassato: 68000, daIncassare: 0, importoFattura: 1000, ...BASE });
  assert.equal(r.livelloSoglia, 'vicino');
  assert.equal(r.livelloUscita, 'ok');
});

test('previsioneSoglia: oltre soglia 85k → uscitaAnnoSuccessivo', () => {
  const r = previsioneSoglia({ incassato: 84000, daIncassare: 0, importoFattura: 2000, ...BASE });
  assert.equal(r.livelloSoglia, 'oltre');
  assert.equal(r.livelloUscita, 'uscitaAnnoSuccessivo');
});

test('previsioneSoglia: oltre 100k → uscitaImmediata', () => {
  const r = previsioneSoglia({ incassato: 99000, daIncassare: 0, importoFattura: 2000, ...BASE });
  assert.equal(r.livelloUscita, 'uscitaImmediata');
});

test('previsioneSoglia: limite personale 80k → vicino a 64k', () => {
  const r = previsioneSoglia({ incassato: 64000, daIncassare: 0, importoFattura: 1000, ...BASE, limitePersonale: 80000 });
  assert.equal(r.livelloLimitePersonale, 'vicino');
  assert.equal(r.livelloSoglia, 'ok');
});

test('previsioneSoglia: limite personale 0 → sempre ok', () => {
  const r = previsioneSoglia({ incassato: 90000, daIncassare: 0, importoFattura: 1000, ...BASE, limitePersonale: 0 });
  assert.equal(r.livelloLimitePersonale, 'ok');
});
