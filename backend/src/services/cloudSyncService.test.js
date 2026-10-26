import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir, readJson, writeJson, DATA_DIR } from '../lib/jsonStore.js';
import { creaFinto } from '../lib/cloudProviders.fake.js';
import { registraNumero, azzeraIdDispositivo } from './numerazioneService.js';
import {
  dipendenze, _azzera, avviaLogin, completaLogin, scegliArchivio, statoCloud, sincronizza,
  sincronizzaPrimaDiEmettere, disconnetti, riprendiCloud, _dimenticaAccesso,
} from './cloudSyncService.js';

const CLI = 'a1b2c3d4-cliX';
let finto;
let segreti;
let dati;

beforeEach(async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'cloud-'));
  process.env.FOGLIFATTURE_CLOUD_DIR = path.join(base, 'cloud');
  process.env.FOGLIFATTURE_ID_DISPOSITIVO = path.join(base, 'id.json');
  azzeraIdDispositivo();
  await _azzera();
  dati = path.join(base, 'dati');
  setDataDir(dati);
  finto = creaFinto('dropbox');
  segreti = new Map();
  dipendenze.http = finto.http;
  dipendenze.segreti = {
    getPassword: async (s, a) => segreti.get(a) ?? null,
    setPassword: async (s, a, v) => { segreti.set(a, v); },
    deletePassword: async (s, a) => segreti.delete(a),
  };
  dipendenze.puntaDati = async (dir) => { if (path.resolve(dir) === path.resolve(DATA_DIR)) throw new Error('Il percorso indicato è già quello attuale'); setDataDir(dir); }; // come apriArchivioEsistente
  dipendenze.clienti = () => ({ clientId: 'id-prova' });
});
afterEach(async () => { await _azzera(); });

const collega = async () => {
  await avviaLogin({ provider: 'dropbox' });
  return completaLogin({ codice: 'codice', senzaState: true });
};
const archivioLocale = async () => {
  await writeJson('config.json', { fornitore: { denominazione: 'Esempio Srl' } });
  await writeJson(`invoices/2026-01-${CLI}.json`, { numero: '1' });
};
const remoto = (p) => finto.file.get(p)?.dati.toString();

test('login: provider disponibile, indirizzo di ritorno controllato, state verificato', async () => {
  dipendenze.clienti = () => ({ clientId: '' });
  await assert.rejects(avviaLogin({ provider: 'dropbox' }), /non è ancora disponibile/);
  dipendenze.clienti = () => ({ clientId: 'id-prova' });
  await assert.rejects(avviaLogin({ provider: 'dropbox', redirectUri: 'https://evil.example/api/cloud/callback' }), /non ammesso/);
  await assert.rejects(avviaLogin({ provider: 'onedrive' }), /indirizzo di ritorno/);
  dipendenze.http = creaFinto('onedrive').http;
  const { url, state } = await avviaLogin({ provider: 'onedrive', redirectUri: 'http://127.0.0.1:1969/api/cloud/callback' });
  assert.match(url, /code_challenge=/);
  await assert.rejects(completaLogin({ codice: 'c', state: 'sbagliato' }), /state/);
  assert.equal((await completaLogin({ codice: 'c', state })).connesso, true);
  assert.equal(segreti.get('cloud.onedrive.refreshToken'), 'refresh-valido');
});

test('carica: i dati locali vanno sul provider, la copia diventa la cartella dati', async () => {
  await archivioLocale();
  assert.equal((await collega()).remoto, 'vuoto');
  const stato = await scegliArchivio('carica');
  assert.equal(stato.archivio, true);
  assert.deepEqual([...finto.file.keys()].sort(), ['config.json', `invoices/2026-01-${CLI}.json`]);
  assert.match(await readFile(path.join(process.env.FOGLIFATTURE_CLOUD_DIR, 'copia', 'config.json'), 'utf-8'), /Esempio Srl/);
  assert.equal((await readJson('config.json')).fornitore.denominazione, 'Esempio Srl');
});

test('carica rifiuta un provider non vuoto, apri rifiuta uno senza archivio', async () => {
  await archivioLocale();
  finto.scrivi('altro.txt', Buffer.from('x'));
  assert.equal((await collega()).remoto, 'estraneo');
  await assert.rejects(scegliArchivio('carica'), /già qualcosa/);
  await assert.rejects(scegliArchivio('apri'), /estranei/);
});

test('apri: scarica l\'archivio esistente nella copia locale', async () => {
  finto.scrivi('config.json', Buffer.from('{"fornitore":{"denominazione":"Altro dispositivo"}}'));
  finto.scrivi(`invoices/2026-02-${CLI}.json`, Buffer.from('{"numero":"7"}'));
  assert.equal((await collega()).remoto, 'archivio');
  await scegliArchivio('apri');
  assert.equal((await readJson('config.json')).fornitore.denominazione, 'Altro dispositivo');
  assert.equal((await readJson(`invoices/2026-02-${CLI}.json`)).numero, '7');
});

test('push: una scrittura locale arriva sul provider; pull: una modifica remota arriva in locale', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  await writeJson('timesheets/2026-01.json', { ore: 8 });
  assert.equal((await statoCloud()).inAttesa, 1);
  await sincronizza();
  assert.equal(remoto('timesheets/2026-01.json'), JSON.stringify({ ore: 8 }, null, 2));
  assert.equal((await statoCloud()).inAttesa, 0);

  finto.scrivi('timesheets/2026-02.json', Buffer.from('{"ore":4}'));
  await sincronizza();
  assert.equal((await readJson('timesheets/2026-02.json')).ore, 4);
});

test('conflitto: file modificato qui e sul provider, vince il provider e la copia locale resta in conflitti/', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  await writeJson('timesheets/2026-01.json', { ore: 8 });
  finto.scrivi('timesheets/2026-01.json', Buffer.from('{"ore":99}'));
  const stato = await sincronizza();
  assert.equal((await readJson('timesheets/2026-01.json')).ore, 99);
  assert.equal(stato.conflitti.length, 1);
  const salvata = await readJson(stato.conflitti[0]);
  assert.equal(salvata.ore, 8);
  assert.equal(stato.inAttesa, 0);
});

test('offline: lo stato riporta l\'errore, le scritture restano in coda, l\'emissione è bloccata', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  dipendenze.http = async () => { throw new TypeError('fetch failed'); };
  await writeJson('timesheets/2026-01.json', { ore: 8 });
  const stato = await sincronizza();
  assert.match(stato.errore, /non riuscita/);
  assert.equal(stato.inAttesa, 1);
  await assert.rejects(sincronizzaPrimaDiEmettere(), /Emissione bloccata/);
});

test('token revocato: stato disconnesso, emissione rifiutata, ricollegando si riprende dalla coda', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  segreti.set('cloud.dropbox.refreshToken', 'revocato');
  _dimenticaAccesso();
  await writeJson('timesheets/2026-01.json', { ore: 8 });
  const stato = await sincronizza();
  assert.equal(stato.connesso, false);
  assert.match(stato.errore, /ricollega/);
  await assert.rejects(registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI }), /disconnesso/);

  const riconnesso = await collega();
  assert.equal(riconnesso.archivio, true);
  assert.equal(riconnesso.inAttesa, 1);
  await sincronizza();
  assert.ok(remoto('timesheets/2026-01.json'));
});

test('numerazione: il registro si scrive sul provider con la rev, due dispositivi non prendono lo stesso numero', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI });
  assert.equal(JSON.parse(remoto('numerazione.json')).numeri['1'].clienteId, CLI);
  assert.equal((await readJson('numerazione.json')).ultimoNumero, 1);

  // Un altro dispositivo prende il 2 mentre questo sta per prenderlo: la scrittura condizionale fallisce, si rilegge.
  let primoGiro = true;
  finto.dopoLettura = (p) => {
    if (p !== 'numerazione.json' || !primoGiro) return;
    primoGiro = false;
    const registro = JSON.parse(remoto('numerazione.json'));
    registro.numeri['2'] = { anno: 2026, mese: 1, clienteId: 'altro-cliente', idDispositivo: 'B', data: 'x' };
    registro.ultimoNumero = 2;
    finto.scrivi('numerazione.json', Buffer.from(JSON.stringify(registro)));
  };
  await assert.rejects(registraNumero(2, { anno: 2026, mese: 1, clienteId: CLI }), /già prenotato/);
  const registro = JSON.parse(remoto('numerazione.json'));
  assert.equal(registro.numeri['2'].clienteId, 'altro-cliente');
  await registraNumero(3, { anno: 2026, mese: 1, clienteId: CLI });
  assert.deepEqual(Object.keys(JSON.parse(remoto('numerazione.json')).numeri), ['1', '2', '3']);
});

test('numerazione: lo stesso documento è idempotente anche sul provider', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI });
  const rev = finto.file.get('numerazione.json').rev;
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI });
  assert.equal(finto.file.get('numerazione.json').rev, rev);
});

test('disconnetti: segreti cancellati, la copia resta la cartella dati ma non si sincronizza più', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  assert.equal((await disconnetti()).collegato, false);
  assert.equal(segreti.size, 0);
  assert.equal((await statoCloud()).collegato, false);
  await writeJson('timesheets/2026-03.json', { ore: 1 });
  await sincronizza();
  assert.equal(remoto('timesheets/2026-03.json'), undefined);
  // Al riavvio la copia resta la cartella dati.
  await _azzera();
  setDataDir(dati);
  assert.equal(await riprendiCloud(), path.join(process.env.FOGLIFATTURE_CLOUD_DIR, 'copia'));
  assert.equal((await readJson('config.json')).fornitore.denominazione, 'Esempio Srl');
});

test('riprendiCloud: senza archivio cloud non cambia nulla', async () => {
  assert.equal(await riprendiCloud(), null);
});

test('callback: lo state è obbligatorio, il codice incollato non vale per un login con indirizzo di ritorno', async () => {
  const { state } = await avviaLogin({ provider: 'onedrive', redirectUri: 'http://localhost:1969/api/cloud/callback' });
  dipendenze.http = creaFinto('onedrive').http;
  await assert.rejects(completaLogin({ codice: 'c' }), /state/);
  await assert.rejects(completaLogin({ codice: 'c', state: '' }), /state/);
  await assert.rejects(completaLogin({ codice: 'c', senzaState: true }), /state/);
  assert.equal((await completaLogin({ codice: 'c', state })).connesso, true);
});

test('carica copia anche i file non JSON nella nuova cartella dati, ma sul provider vanno solo i JSON', async () => {
  await archivioLocale();
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(path.join(dati, 'ricevute-sdi'), { recursive: true });
  await writeFile(path.join(dati, 'ricevute-sdi', 'IT01_RC_001.xml'), '<ricevuta/>');
  await collega();
  await scegliArchivio('carica');
  assert.equal(await readFile(path.join(process.env.FOGLIFATTURE_CLOUD_DIR, 'copia', 'ricevute-sdi', 'IT01_RC_001.xml'), 'utf-8'), '<ricevuta/>');
  assert.equal([...finto.file.keys()].some((k) => k.endsWith('.xml')), false);
});

test('scollega, ricollega e scegli un provider non vuoto: i dati in uso restano intatti', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  await disconnetti();
  finto.file.clear();
  finto.scrivi('altro.txt', Buffer.from('x'));
  const stato = await collega();
  assert.equal(stato.remoto, 'estraneo');
  await assert.rejects(scegliArchivio('carica'), /già qualcosa/);
  await assert.rejects(scegliArchivio('apri'), /estranei/);
  assert.equal((await readJson('config.json')).fornitore.denominazione, 'Esempio Srl');
  // Dopo il nuovo login il puntatore alla copia non si perde.
  await _azzera();
  setDataDir(dati);
  assert.equal(await riprendiCloud(), path.join(process.env.FOGLIFATTURE_CLOUD_DIR, 'copia'));
});

test('carica da una copia già in uso (dopo scollegamento) su un provider vuoto: i dati passano nella copia nuova', async () => {
  await archivioLocale();
  await collega();
  await scegliArchivio('carica');
  await disconnetti();
  finto.file.clear();
  await collega();
  await scegliArchivio('carica');
  assert.equal((await readJson('config.json')).fornitore.denominazione, 'Esempio Srl');
  assert.ok(remoto('config.json'));
});

test('lo stato dice quali provider sono disponibili in questa build', async () => {
  dipendenze.clienti = (p) => ({ clientId: p === 'dropbox' ? 'x' : '' });
  const { disponibili } = await statoCloud();
  assert.deepEqual(disponibili, { dropbox: true, onedrive: false, google: false });
});
