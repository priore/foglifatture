import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traduciErrorePec } from './pecProvaService.js';

test('errori tipici tradotti in italiano', () => {
  assert.match(traduciErrorePec({ code: 'EAUTH', message: 'x' }), /Accesso rifiutato/);
  assert.match(traduciErrorePec({ authenticationFailed: true, message: 'x' }), /Accesso rifiutato/);
  assert.match(traduciErrorePec({ code: 'ENOTFOUND', message: 'x' }), /non trovato/);
  assert.match(traduciErrorePec({ code: 'ECONNREFUSED', message: 'x' }), /porta/);
  assert.match(traduciErrorePec({ code: 'ETIMEDOUT', message: 'x' }), /timeout/);
  assert.match(traduciErrorePec(new Error('self signed certificate')), /certificato/);
  assert.equal(traduciErrorePec(new Error('boh')), 'boh');
});
