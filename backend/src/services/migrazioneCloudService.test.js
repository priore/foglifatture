import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir } from '../lib/jsonStore.js';
import { vecchiaPosizione } from '../lib/cartelleCloudLocali.js';
import { dipendenze, situazioneMigrazione, migraClient } from './migrazioneCloudService.js';

let home;
const esiste = (p) => stat(p).then(() => true, () => false);
const scrivi = (dir, nome, contenuto) => mkdir(dir, { recursive: true }).then(() => writeFile(path.join(dir, nome), JSON.stringify(contenuto)));

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'migra-'));
  process.env.FOGLIFATTURE_PUNTATORE_DATI = path.join(home, 'puntatore.json');
  dipendenze.vecchiaPosizione = (p) => vecchiaPosizione(p, { home, piattaforma: 'darwin', env: {} });
});

const archivioIn = async (dir, extra = {}) => {
  await scrivi(dir, 'config.json', { fornitore: { denominazione: 'Esempio Srl' }, ...extra });
  await scrivi(path.join(dir, 'invoices'), 'a.json', { numero: '1' });
  setDataDir(dir);
  dipendenze.percorsoDati = () => dir;
};

test('nessuna migrazione se i dati non stanno in una cartella FogliFatture di un client', async () => {
  await mkdir(path.join(home, 'Dropbox'), { recursive: true });
  await archivioIn(path.join(home, 'altrove'));
  assert.equal(situazioneMigrazione(), null);
});

test('Dropbox: riconosce la vecchia posizione e la nuova cartella (assente)', async () => {
  await archivioIn(path.join(home, 'Dropbox', 'FogliFatture'));
  const s = situazioneMigrazione();
  assert.equal(s.provider, 'dropbox');
  assert.equal(s.nuovo, path.join(home, 'Dropbox', 'Apps', 'FogliFatture'));
  assert.equal(s.statoNuovo, 'assente');
});

test('Dropbox: sposta i dati nella nuova cartella e la vecchia sparisce; SDI assoluto diventa relativo', async () => {
  const vecchio = path.join(home, 'Dropbox', 'FogliFatture');
  await archivioIn(vecchio, { sdi: { percorsoArchivio: path.join(vecchio, 'sdi') } });
  const nuovo = path.join(home, 'Dropbox', 'Apps', 'FogliFatture');
  const { percorso } = await migraClient('sposta');
  assert.equal(percorso, nuovo);
  assert.ok(await esiste(path.join(nuovo, 'invoices', 'a.json')));
  assert.equal(await esiste(vecchio), false);
  const config = JSON.parse(await readFile(path.join(nuovo, 'config.json'), 'utf-8'));
  assert.equal(config.sdi.percorsoArchivio, 'sdi');
});

test('OneDrive: nuova cartella già con un archivio: sposta rifiutato, apri la collega e la vecchia resta intatta', async () => {
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'OneDrive-Personal'), { recursive: true });
  const radice = path.join(home, 'Library', 'CloudStorage', 'OneDrive-Personal');
  const vecchio = path.join(radice, 'FogliFatture');
  await archivioIn(vecchio);
  const nuovo = path.join(radice, 'Apps', 'FogliFatture');
  await scrivi(nuovo, 'config.json', { fornitore: { denominazione: 'Dal mobile' } });
  assert.equal(situazioneMigrazione().statoNuovo, 'archivio');
  await assert.rejects(migraClient('sposta'), /già un archivio/);
  const { percorso } = await migraClient('apri');
  assert.equal(percorso, nuovo);
  assert.ok(await esiste(path.join(vecchio, 'invoices', 'a.json')));
});

test('nuova cartella con file estranei: nessuna azione', async () => {
  await archivioIn(path.join(home, 'Dropbox', 'FogliFatture'));
  await scrivi(path.join(home, 'Dropbox', 'Apps', 'FogliFatture'), 'x.json', {});
  await assert.rejects(migraClient('sposta'), /non sono un archivio/);
});

test('Google: riconosciuta ma la migrazione passa dal login, non da migraClient', async () => {
  const radice = path.join(home, 'Library', 'CloudStorage', 'GoogleDrive-utente@example.com', 'My Drive');
  await archivioIn(path.join(radice, 'FogliFatture'));
  const s = situazioneMigrazione();
  assert.equal(s.provider, 'google');
  assert.equal(s.nuovo, undefined);
  await assert.rejects(migraClient('sposta'), /Niente da migrare/);
});
