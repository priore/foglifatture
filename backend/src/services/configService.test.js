import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaConfigCripto } from './configService.js';

test('config cripto: valori validi e assenti accettati', () => {
  validaConfigCripto({});
  validaConfigCripto({ metodoPlusvalenze: 'lifo', importBtc: { confermeMinime: 3, intervalloMinuti: 30, urlPrimario: 'https://mempool.space/api' } });
});

test('config cripto: valori non validi rifiutati', () => {
  assert.throws(() => validaConfigCripto({ metodoPlusvalenze: 'fifo' }), /lifo/);
  assert.throws(() => validaConfigCripto({ importBtc: { confermeMinime: 0 } }), /Conferme/);
  assert.throws(() => validaConfigCripto({ importBtc: { intervalloMinuti: 1.5 } }), /Intervallo/);
  assert.throws(() => validaConfigCripto({ importBtc: { urlFallback: 'ftp://x' } }), /URL/);
  assert.throws(() => validaConfigCripto({ importBtc: { urlPrimario: 'non-url' } }), /URL/);
});

// --- percorso dati: sposta, riavvio simulato, lettura dalla nuova cartella ---
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir, readJson } from '../lib/jsonStore.js';
import { spostaPercorsoDati, applicaPercorsoDatiAllAvvio } from './configService.js';

async function ambiente() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'percorsodati-'));
  const predefinita = path.join(base, 'default');
  await mkdir(predefinita);
  process.env.FOGLIFATTURE_PUNTATORE_DATI = path.join(base, 'puntatore.json');
  setDataDir(predefinita); // la "cartella di default" del test
  return { base, predefinita, riavvia: () => setDataDir(predefinita) };
}

test('percorso dati: dopo sposta e riavvio i dati si leggono dalla nuova cartella', async () => {
  const { base, predefinita, riavvia } = await ambiente();
  try {
    await writeFile(path.join(predefinita, 'config.json'), JSON.stringify({ fornitore: { nome: 'Esempio' } }));
    const nuova = path.join(base, 'nuova');
    await spostaPercorsoDati(nuova);

    riavvia();
    await applicaPercorsoDatiAllAvvio();
    assert.equal((await readJson('config.json')).fornitore.nome, 'Esempio');
  } finally {
    setDataDir(null);
    await rm(base, { recursive: true, force: true });
  }
});

test('percorso dati: migrazione da config.json legacy nella cartella di default', async () => {
  const { base, predefinita } = await ambiente();
  try {
    const vera = path.join(base, 'vera');
    await mkdir(vera);
    await writeFile(path.join(vera, 'config.json'), JSON.stringify({ fornitore: { nome: 'Esempio' } }));
    await writeFile(path.join(predefinita, 'config.json'), JSON.stringify({ dati: { percorso: vera } }));

    await applicaPercorsoDatiAllAvvio();
    assert.equal((await readJson('config.json')).fornitore.nome, 'Esempio');
    assert.equal(JSON.parse(await readFile(process.env.FOGLIFATTURE_PUNTATORE_DATI, 'utf-8')).percorso, vera);
  } finally {
    setDataDir(null);
    await rm(base, { recursive: true, force: true });
  }
});

test('percorso dati: cartella puntata assente blocca l\'avvio, senza puntatore resta il default', async () => {
  const { base, predefinita } = await ambiente();
  try {
    await applicaPercorsoDatiAllAvvio(); // nessun puntatore, nessun legacy: no-op
    await writeFile(process.env.FOGLIFATTURE_PUNTATORE_DATI, JSON.stringify({ percorso: path.join(base, 'scollegata') }));
    await assert.rejects(applicaPercorsoDatiAllAvvio(), /Cartella dati non trovata/);
    assert.equal(await readJson('config.json', null), null);
    assert.ok(predefinita);
  } finally {
    setDataDir(null);
    await rm(base, { recursive: true, force: true });
  }
});

test('percorso dati: una cartella dati già esistente viene collegata senza spostare nulla', async () => {
  const { base, predefinita, riavvia } = await ambiente();
  try {
    const esistente = path.join(base, 'esistente');
    await mkdir(esistente);
    await writeFile(path.join(esistente, 'config.json'), JSON.stringify({ fornitore: { nome: 'Esempio' } }));
    await writeFile(path.join(predefinita, 'altro.json'), '{}');
    await spostaPercorsoDati(esistente);

    assert.equal((await readJson('config.json')).fornitore.nome, 'Esempio');
    assert.equal((await readFile(path.join(predefinita, 'altro.json'), 'utf-8')), '{}');
    riavvia();
    await applicaPercorsoDatiAllAvvio();
    assert.equal((await readJson('config.json')).fornitore.nome, 'Esempio');
  } finally {
    setDataDir(null);
    await rm(base, { recursive: true, force: true });
  }
});
