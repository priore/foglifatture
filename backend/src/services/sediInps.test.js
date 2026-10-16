// Test elenco sedi INPS (J.1): integrità dei dati e validazione del campo in config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validaConfig } from './configService.js';

const dati = JSON.parse(await readFile(new URL('../data/sediInps.json', import.meta.url), 'utf-8'));

test('elenco sedi: codici di 4 cifre e nomi presenti', () => {
  assert.ok(dati.sedi.length > 200);
  for (const s of dati.sedi) {
    assert.match(s.codice, /^\d{4}$/);
    assert.ok(s.nome.trim());
  }
});

test('elenco sedi: fonte e data di verifica dichiarate', () => {
  assert.match(dati.fonteUrl, /agenziaentrate\.gov\.it/);
  assert.match(dati.verificatoIl, /^\d{4}-\d{2}-\d{2}$/);
});

test('validaConfig: codice sede INPS vuoto o di 4 cifre ok, altro rifiutato', () => {
  assert.deepEqual(validaConfig({ forfettario: { codiceSedeInps: '' } }), []);
  assert.deepEqual(validaConfig({ forfettario: { codiceSedeInps: '4900' } }), []);
  assert.equal(validaConfig({ forfettario: { codiceSedeInps: '49' } }).length, 1);
  assert.equal(validaConfig({ forfettario: { codiceSedeInps: 'abcd' } }).length, 1);
});
