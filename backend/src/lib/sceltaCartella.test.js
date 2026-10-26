import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scegliCartella } from './sceltaCartella.js';

test('macOS: percorso senza barra finale, annullamento = null, altri errori rilanciati', async () => {
  assert.equal(await scegliCartella({ piattaforma: 'darwin', eseguiComando: async () => '/mnt/Dropbox/' }), '/mnt/Dropbox');
  assert.equal(await scegliCartella({ piattaforma: 'darwin', eseguiComando: async () => { throw new Error('execution error: User canceled. (-128)'); } }), null);
  await assert.rejects(scegliCartella({ piattaforma: 'darwin', eseguiComando: async () => { throw new Error('boom'); } }), /boom/);
});

test('Windows: PowerShell con il file dello script; output vuoto = annullato', async () => {
  let chiamata;
  const r = await scegliCartella({ piattaforma: 'win32', iniziale: 'C:\\Dati', eseguiComando: async (f, a) => { chiamata = [f, a]; return 'D:\\OneDrive'; } });
  assert.equal(r, 'D:\\OneDrive');
  assert.equal(chiamata[0], 'powershell');
  assert.ok(chiamata[1].some((x) => x.endsWith('scegliCartellaWin.ps1')));
  assert.equal(await scegliCartella({ piattaforma: 'win32', eseguiComando: async () => '' }), null);
});

test('altri sistemi: errore chiaro', async () => {
  await assert.rejects(scegliCartella({ piattaforma: 'linux' }), /non è disponibile/);
});
