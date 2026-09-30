import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ibanValido, normalizzaIban } from './iban.js';

test('IBAN validi (con spazi e minuscole) e non validi', () => {
  assert.equal(ibanValido('IT60 X054 2811 1010 0000 0123 456'), true);
  assert.equal(ibanValido('it60x0542811101000000123456'), true);
  assert.equal(ibanValido('IT61X0542811101000000123456'), false); // cifre di controllo errate
  assert.equal(ibanValido('IT60'), false);
  assert.equal(normalizzaIban(' it60 x054 '), 'IT60X054');
});
