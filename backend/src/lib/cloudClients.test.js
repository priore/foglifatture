import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { clientCloud } from './cloudClients.js';

test('legge il file scaricato da Google così com\'è e il formato semplice degli altri', async () => {
  const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'clienti-')), 'c.json');
  await writeFile(file, JSON.stringify({
    google: { installed: { client_id: 'id.apps.example.com', project_id: 'p', auth_uri: 'x', token_uri: 'y', client_secret: 'seg', redirect_uris: ['http://localhost'] } },
    dropbox: { clientId: 'chiave' },
  }));
  process.env.FOGLIFATTURE_CLOUD_CLIENTS = file;
  assert.deepEqual(clientCloud('google'), { clientId: 'id.apps.example.com', clientSecret: 'seg' });
  assert.deepEqual(clientCloud('dropbox'), { clientId: 'chiave', clientSecret: undefined });
  assert.equal(clientCloud('onedrive').clientId, '');
  process.env.FOGLIFATTURE_CLOUD_GOOGLE_CLIENT_ID = 'da-ambiente';
  assert.equal(clientCloud('google').clientId, 'da-ambiente');
  delete process.env.FOGLIFATTURE_CLOUD_GOOGLE_CLIENT_ID;
  process.env.FOGLIFATTURE_CLOUD_CLIENTS = path.join(path.dirname(file), 'assente.json');
  assert.equal(clientCloud('google').clientId, '');
  delete process.env.FOGLIFATTURE_CLOUD_CLIENTS;
});
