import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir, readJson } from '../lib/jsonStore.js';
import { controllaPacchettiRegole } from './regoleScaricateService.js';
import { leggiPacchettoVersionato, elencoAnni } from './regoleFiscaliService.js';

const dirs = [];
beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'regolescaricate-'));
  dirs.push(dir);
  setDataDir(dir);
});
after(async () => {
  setDataDir(null);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

const sha = (t) => createHash('sha256').update(t).digest('hex');
const pacchetto = (anno, extra = {}) => JSON.stringify({
  anno, verificatoIl: '2099-01-01', forfettario: {}, acconti: {}, scadenze: [], rate: {}, inpsGestioneSeparata: {}, bollo: {}, codiciTributo: {}, causaliInps: {}, ...extra,
});

// fetch finto: mappa url → { status, corpo }
const rete = (mappa) => async (url) => {
  const r = mappa[url];
  if (!r) throw new TypeError('fetch failed');
  return { ok: r.status === 200, status: r.status, arrayBuffer: async () => new TextEncoder().encode(r.corpo).buffer };
};
const INDICE = 'https://indice.test/regole-indice.json';

test('scarica un pacchetto con hash corretto e lo preferisce all\'incluso', async () => {
  const corpo = pacchetto(2027);
  const fetchFn = rete({
    [INDICE]: { status: 200, corpo: JSON.stringify({ pacchetti: [{ anno: 2027, url: 'https://indice.test/2027.json', sha256: sha(corpo) }] }) },
    'https://indice.test/2027.json': { status: 200, corpo },
  });
  const esito = await controllaPacchettiRegole({ fetchFn, url: INDICE });
  assert.deepEqual(esito, { scaricati: [2027], rifiutati: [] });
  assert.equal((await leggiPacchettoVersionato(2027)).anno, 2027);
  assert.ok((await elencoAnni()).some((a) => a.anno === 2027 && !a.confermato), 'compare da confermare');
});

test('rifiuta un pacchetto con hash errato e non lo salva', async () => {
  const fetchFn = rete({
    [INDICE]: { status: 200, corpo: JSON.stringify({ pacchetti: [{ anno: 2027, url: 'https://indice.test/2027.json', sha256: sha('altro') }] }) },
    'https://indice.test/2027.json': { status: 200, corpo: pacchetto(2027) },
  });
  const esito = await controllaPacchettiRegole({ fetchFn, url: INDICE });
  assert.deepEqual(esito.scaricati, []);
  assert.equal(esito.rifiutati[0].motivo, 'Hash non corrispondente');
  assert.equal(await readJson('regole-scaricate/2027.json'), null);
});

test('rifiuta l\'indirizzo di un pacchetto senza https', async () => {
  const corpo = pacchetto(2027);
  const fetchFn = rete({
    [INDICE]: { status: 200, corpo: JSON.stringify({ pacchetti: [{ anno: 2027, url: 'http://indice.test/2027.json', sha256: sha(corpo) }] }) },
    'http://indice.test/2027.json': { status: 200, corpo },
  });
  const esito = await controllaPacchettiRegole({ fetchFn, url: INDICE });
  assert.equal(esito.rifiutati[0].motivo, 'Solo https');
});

test('rifiuta un pacchetto incompleto, con l\'hash giusto', async () => {
  const corpo = JSON.stringify({ anno: 2027, verificatoIl: '2099-01-01' });
  const fetchFn = rete({
    [INDICE]: { status: 200, corpo: JSON.stringify({ pacchetti: [{ anno: 2027, url: 'https://indice.test/2027.json', sha256: sha(corpo) }] }) },
    'https://indice.test/2027.json': { status: 200, corpo },
  });
  const esito = await controllaPacchettiRegole({ fetchFn, url: INDICE });
  assert.match(esito.rifiutati[0].motivo, /mancano/);
});

test('un pacchetto scaricato più vecchio dell\'incluso non lo sostituisce', async () => {
  const corpo = pacchetto(2026, { verificatoIl: '2000-01-01', marcatore: 'scaricato' });
  const fetchFn = rete({
    [INDICE]: { status: 200, corpo: JSON.stringify({ pacchetti: [{ anno: 2026, url: 'https://indice.test/2026.json', sha256: sha(corpo) }] }) },
    'https://indice.test/2026.json': { status: 200, corpo },
  });
  await controllaPacchettiRegole({ fetchFn, url: INDICE });
  assert.equal((await leggiPacchettoVersionato(2026)).marcatore, undefined);
});

test('una volta al giorno; indice assente (404) non è un errore; la rete assente lancia', async () => {
  const adesso = Date.parse('2026-10-23T10:00:00Z');
  assert.deepEqual(await controllaPacchettiRegole({ fetchFn: rete({ [INDICE]: { status: 404, corpo: '' } }), url: INDICE, adesso }), { scaricati: [], rifiutati: [], nessunIndice: true });
  assert.deepEqual(await controllaPacchettiRegole({ fetchFn: rete({}), url: INDICE, adesso: adesso + 3600_000 }), { saltato: true });
  await assert.rejects(controllaPacchettiRegole({ fetchFn: rete({}), url: INDICE, adesso: adesso + 25 * 3600_000 }), /fetch failed/);
});
