import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSIONE_TERMINI, TESTO_TERMINI, testoTermini, terminiAccettati } from './termini.js';

test('termini: accettati solo con versione corrente e approvazione specifica', () => {
  assert.equal(terminiAccettati({}), false);
  assert.equal(terminiAccettati({ termini: { versione: '1999-01', approvazioneSpecifica: true } }), false);
  assert.equal(terminiAccettati({ termini: { versione: VERSIONE_TERMINI } }), false);
  assert.equal(terminiAccettati({ termini: { versione: VERSIONE_TERMINI, approvazioneSpecifica: true } }), true);
});

test('termini: il nome del prodotto è quello del desktop salvo override dell\'app embedded', () => {
  assert.equal(testoTermini(), TESTO_TERMINI);
  globalThis.__nomeApp = 'FlatTax';
  try {
    assert.ok(testoTermini().includes('FlatTax è uno strumento'));
    assert.ok(!testoTermini().includes('Fogli & Fatture'));
  } finally {
    delete globalThis.__nomeApp;
  }
});
