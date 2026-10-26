import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cartelleCloudLocali, SOTTOCARTELLA } from './cartelleCloudLocali.js';

const nuovaHome = async () => mkdtemp(path.join(os.tmpdir(), 'home-'));

test('macOS: trova Dropbox, OneDrive personale e Google Drive (anche in italiano), non quello aziendale', async () => {
  const home = await nuovaHome();
  await mkdir(path.join(home, 'Dropbox'));
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'OneDrive-Personale'), { recursive: true });
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'OneDrive-Azienda'), { recursive: true });
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'GoogleDrive-utente@example.com', 'Il mio Drive'), { recursive: true });
  const trovate = cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} });
  assert.deepEqual(trovate.map((t) => t.provider), ['dropbox', 'onedrive', 'google']);
  assert.ok(trovate.every((t) => t.percorso.endsWith(`${path.sep}${SOTTOCARTELLA}`) && t.stato === 'assente'));
});

test('niente client installati: elenco vuoto', async () => {
  assert.deepEqual(cartelleCloudLocali({ home: await nuovaHome(), piattaforma: 'darwin', env: {} }), []);
});

test('Dropbox: il percorso di info.json vince su quello predefinito', async () => {
  const home = await nuovaHome();
  const personalizzata = path.join(home, 'Altrove', 'Dropbox');
  await mkdir(personalizzata, { recursive: true });
  await mkdir(path.join(home, '.dropbox'));
  await writeFile(path.join(home, '.dropbox', 'info.json'), JSON.stringify({ personal: { path: personalizzata } }));
  const [d] = cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} });
  assert.equal(d.radice, personalizzata);
});

test('stato della sottocartella: vuota, archivio, estranea', async () => {
  const home = await nuovaHome();
  const radice = path.join(home, 'Dropbox');
  const sotto = path.join(radice, SOTTOCARTELLA);
  await mkdir(sotto, { recursive: true });
  assert.equal(cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} })[0].stato, 'vuota');
  await writeFile(path.join(sotto, 'x.txt'), 'x');
  assert.equal(cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} })[0].stato, 'estranea');
  await writeFile(path.join(sotto, 'config.json'), JSON.stringify({ fornitore: { denominazione: 'Esempio' } }));
  assert.equal(cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} })[0].stato, 'archivio');
});

test('esaminaRadice: sottocartella fissa FogliFatture e suo stato; cartella inesistente rifiutata', async () => {
  const { esaminaRadice } = await import('./cartelleCloudLocali.js');
  const radice = await nuovaHome();
  assert.deepEqual(esaminaRadice(radice), { radice, percorso: path.join(radice, SOTTOCARTELLA), stato: 'assente' });
  assert.throws(() => esaminaRadice(path.join(radice, 'non-esiste')), /non esiste/);
});
