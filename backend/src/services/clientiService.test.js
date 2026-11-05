import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import keytar from 'keytar';
import { setDataDir, writeJson, readJson, listKeys } from '../lib/jsonStore.js';
import { clientiConDati, eliminaCliente } from './clientiService.js';

// Il Keychain OS non esiste in CI (Linux senza secret service) e in locale non va toccato: finto in memoria.
keytar.getPassword = async () => null;
keytar.setPassword = async () => {};
keytar.deletePassword = async () => true;

const A = 'aaaa-1111';
const B = 'bbbb-2222';
const C = 'cccc-3333';

async function archivio() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'clienti-'));
  process.env.FOGLIFATTURE_PUNTATORE_DATI = path.join(base, 'puntatore.json');
  const dati = path.join(base, 'dati');
  await mkdir(dati, { recursive: true });
  setDataDir(dati);
  await writeJson('config.json', { clienti: [A, B, C].map((id) => ({ id, attivo: true, denominazione: id })) });
}

const giorno = (extra = {}) => ({ giorno: 1, inizioMattina: '', fineMattina: '', inizioPomeriggio: '', finePomeriggio: '', stato: '', note: '', ...extra });

test('clientiConDati: fattura o timesheet compilato contano, griglia vuota no', async () => {
  await archivio();
  await writeJson(`invoices/2026-01-${A}.json`, { numero: '1' });
  await writeJson(`timesheets/2026-02-${B}.json`, { giorni: [giorno({ inizioMattina: '09:00', fineMattina: '13:00' })] });
  await writeJson(`timesheets/2026-02-${C}.json`, { giorni: [giorno()] });
  assert.deepEqual((await clientiConDati()).sort(), [A, B]);
});

test('eliminaCliente: rifiuta se ha dati, altrimenti rimuove cliente e griglie vuote', async () => {
  await archivio();
  await writeJson(`invoices/2026-01-${A}.json`, { numero: '1' });
  await writeJson(`timesheets/2026-02-${C}.json`, { giorni: [giorno()] });
  await assert.rejects(eliminaCliente(A), /solo disattivare/);
  await eliminaCliente(C);
  assert.deepEqual((await readJson('config.json')).clienti.map((c) => c.id), [A, B]);
  assert.deepEqual(await listKeys('timesheets'), []);
});
