import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativizzaPercorsoSdi, risolviPercorsoSdi } from './percorsoSdi.js';

const dati = '/archivio/dati';

test('percorso SDI: un assoluto dentro la cartella dati diventa relativo, fuori resta com\'è', () => {
  assert.equal(relativizzaPercorsoSdi('/archivio/dati/ricevute', dati), 'ricevute');
  assert.equal(relativizzaPercorsoSdi('/mnt/Dropbox/SDI', dati), '/mnt/Dropbox/SDI');
  assert.equal(relativizzaPercorsoSdi('/archivio/dati', dati), '/archivio/dati');
  assert.equal(relativizzaPercorsoSdi('ricevute', dati), 'ricevute');
  assert.equal(relativizzaPercorsoSdi('', dati), '');
});

test('percorso SDI desktop: relativo risolto sulla cartella dati, assoluto e vuoto invariati', () => {
  assert.equal(risolviPercorsoSdi('ricevute', dati), '/archivio/dati/ricevute');
  assert.equal(risolviPercorsoSdi('/mnt/Dropbox/SDI', dati), '/mnt/Dropbox/SDI');
  assert.equal(risolviPercorsoSdi('', dati), '');
});

test('percorso SDI ambiente embedded: vuoto o assoluto estraneo usano la cartella predefinita', () => {
  assert.equal(risolviPercorsoSdi('', dati, 'ricevute-sdi'), '/archivio/dati/ricevute-sdi');
  assert.equal(risolviPercorsoSdi('/mnt/Dropbox/SDI', dati, 'ricevute-sdi'), '/archivio/dati/ricevute-sdi');
  assert.equal(risolviPercorsoSdi('/archivio/dati/ricevute', dati, 'ricevute-sdi'), '/archivio/dati/ricevute');
  assert.equal(risolviPercorsoSdi('ricevute', dati, 'ricevute-sdi'), '/archivio/dati/ricevute');
});

test('percorso SDI ambiente embedded: un assoluto dentro una cartella autorizzata resta valido', () => {
  const autorizzate = ['/Volumes/Nas/SDI'];
  assert.equal(risolviPercorsoSdi('/Volumes/Nas/SDI', dati, 'ricevute-sdi', autorizzate), '/Volumes/Nas/SDI');
  assert.equal(risolviPercorsoSdi('/Volumes/Nas/SDI/2026', dati, 'ricevute-sdi', autorizzate), '/Volumes/Nas/SDI/2026');
  assert.equal(risolviPercorsoSdi('/Volumes/Altro', dati, 'ricevute-sdi', autorizzate), '/archivio/dati/ricevute-sdi');
});
