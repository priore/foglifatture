import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cartelleCloudLocali, radiciGoogleDrive, vecchiaPosizione, SOTTOCARTELLA, sottocartellaDi } from './cartelleCloudLocali.js';

const nuovaHome = async () => mkdtemp(path.join(os.tmpdir(), 'home-'));

test('macOS: trova Dropbox e OneDrive personale (non quello aziendale); Google Drive non è una scelta', async () => {
  const home = await nuovaHome();
  await mkdir(path.join(home, 'Dropbox'));
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'OneDrive-Personale'), { recursive: true });
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'OneDrive-Azienda'), { recursive: true });
  await mkdir(path.join(home, 'Library', 'CloudStorage', 'GoogleDrive-utente@example.com', 'Il mio Drive'), { recursive: true });
  const trovate = cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} });
  assert.deepEqual(trovate.map((t) => t.provider), ['dropbox', 'onedrive']);
  assert.deepEqual(radiciGoogleDrive({ home, piattaforma: 'darwin' }).map((r) => path.basename(r)), ['Il mio Drive']);
  assert.ok(trovate.every((t) => t.percorso.endsWith(`${path.sep}${sottocartellaDi()}`) && t.stato === 'assente'));
  assert.deepEqual(trovate.map((t) => t.sottocartella), [path.join('Apps', SOTTOCARTELLA), path.join('Apps', SOTTOCARTELLA)]);
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
  const sotto = path.join(radice, sottocartellaDi());
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
  assert.deepEqual(esaminaRadice(radice, 'dropbox'), { radice, sottocartella: path.join('Apps', SOTTOCARTELLA), percorso: path.join(radice, 'Apps', SOTTOCARTELLA), stato: 'assente' });
  assert.throws(() => esaminaRadice(path.join(radice, 'non-esiste'), 'dropbox'), /non esiste/);
});

test('vecchiaPosizione riconosce <client>/FogliFatture per Dropbox, OneDrive e Google; altrove null', async () => {
  const home = await nuovaHome();
  const radici = {
    dropbox: path.join(home, 'Dropbox'),
    onedrive: path.join(home, 'Library', 'CloudStorage', 'OneDrive-Personal'),
    google: path.join(home, 'Library', 'CloudStorage', 'GoogleDrive-utente@example.com', 'My Drive'),
  };
  for (const [provider, radice] of Object.entries(radici)) {
    await mkdir(path.join(radice, SOTTOCARTELLA), { recursive: true });
    const v = vecchiaPosizione(path.join(radice, SOTTOCARTELLA), { home, piattaforma: 'darwin', env: {} });
    assert.equal(v?.provider, provider);
    // La nuova posizione Apps/FogliFatture non è la vecchia.
    assert.equal(vecchiaPosizione(path.join(radice, 'Apps', SOTTOCARTELLA), { home, piattaforma: 'darwin', env: {} }), null);
  }
  assert.equal(vecchiaPosizione(path.join(home, 'altrove'), { home, piattaforma: 'darwin', env: {} }), null);
});

test('cartella delle app localizzata: si usa quella già presente nella radice (Applicazioni), altrimenti Apps', async () => {
  const home = await nuovaHome();
  const radice = path.join(home, 'Dropbox');
  await mkdir(path.join(radice, 'Applicazioni', SOTTOCARTELLA), { recursive: true });
  assert.equal(sottocartellaDi(radice), path.join('Applicazioni', SOTTOCARTELLA));
  const altra = path.join(home, 'OneDrive');
  await mkdir(altra, { recursive: true });
  assert.equal(sottocartellaDi(altra), path.join('Apps', SOTTOCARTELLA));
  const [d] = cartelleCloudLocali({ home, piattaforma: 'darwin', env: {} });
  assert.equal(d.percorso, path.join(radice, 'Applicazioni', SOTTOCARTELLA));
});
