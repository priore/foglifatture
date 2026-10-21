import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSIONE_TERMINI, terminiAccettati } from './termini.js';

test('termini: accettati solo con versione corrente e approvazione specifica', () => {
  assert.equal(terminiAccettati({}), false);
  assert.equal(terminiAccettati({ termini: { versione: '1999-01', approvazioneSpecifica: true } }), false);
  assert.equal(terminiAccettati({ termini: { versione: VERSIONE_TERMINI } }), false);
  assert.equal(terminiAccettati({ termini: { versione: VERSIONE_TERMINI, approvazioneSpecifica: true } }), true);
});
