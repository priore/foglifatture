import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaProvider, pkce, ConflittoRev, NonAutorizzato } from './cloudProviders.js';
import { creaFinto } from './cloudProviders.fake.js';

const dati = (testo) => Buffer.from(testo);

test('pkce: il challenge è lo sha256 del verifier in base64url', async () => {
  const { verifier, challenge } = pkce();
  const atteso = Buffer.from(await crypto.subtle.digest('SHA-256', Buffer.from(verifier))).toString('base64url');
  assert.equal(challenge, atteso);
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
});

for (const nome of ['dropbox', 'onedrive', 'google']) {
  const nuovo = () => {
    const finto = creaFinto(nome);
    return { finto, p: creaProvider(nome, { clientId: 'id-prova', clientSecret: 'segreto', http: finto.http, token: async () => 'tok' }) };
  };

  test(`${nome}: login con PKCE e rinnovo del token`, async () => {
    const { p } = nuovo();
    const url = new URL(p.urlAutorizzazione({ redirectUri: 'http://127.0.0.1:1969/api/cloud/callback', challenge: 'CH', state: 'ST' }));
    assert.equal(url.searchParams.get('code_challenge'), 'CH');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('state'), 'ST');
    assert.equal(url.searchParams.get('client_id'), 'id-prova');
    const t = await p.scambia({ codice: 'c', verifier: 'v', redirectUri: 'http://127.0.0.1:1969/api/cloud/callback' });
    assert.equal(t.refreshToken, 'refresh-valido');
    assert.ok(t.scadenzaMs > Date.now());
    assert.equal((await p.rinnova('refresh-valido')).accessToken, 'tok');
    await assert.rejects(p.rinnova('revocato'), NonAutorizzato);
  });

  test(`${nome}: crea, legge, elenca (anche in sottocartelle), file assente`, async () => {
    const { p } = nuovo();
    assert.deepEqual(await p.elenca(), []);
    assert.equal(await p.leggi('config.json'), null);
    const rev = await p.scrivi('config.json', dati('{"a":1}'), { rev: null });
    await p.scrivi('invoices/2026-01-cli.json', dati('{"n":1}'), { rev: null });
    const letto = await p.leggi('config.json');
    assert.equal(letto.dati.toString(), '{"a":1}');
    assert.equal(letto.rev, rev);
    const elenco = (await p.elenca()).map((f) => f.percorso).sort();
    assert.deepEqual(elenco, ['config.json', 'invoices/2026-01-cli.json']);
  });

  test(`${nome}: scrittura condizionale, con rev vecchia viene rifiutata`, async () => {
    const { p } = nuovo();
    const r1 = await p.scrivi('numerazione.json', dati('{"v":1}'), { rev: null });
    const r2 = await p.scrivi('numerazione.json', dati('{"v":2}'), { rev: r1 });
    assert.notEqual(r1, r2);
    await assert.rejects(p.scrivi('numerazione.json', dati('{"v":3}'), { rev: r1 }), ConflittoRev);
    await assert.rejects(p.scrivi('numerazione.json', dati('{"v":3}'), { rev: null }), ConflittoRev);
    assert.equal((await p.leggi('numerazione.json')).dati.toString(), '{"v":2}');
    // Senza precondizione si sovrascrive.
    await p.scrivi('numerazione.json', dati('{"v":4}'));
    assert.equal((await p.leggi('numerazione.json')).dati.toString(), '{"v":4}');
  });

  test(`${nome}: token revocato (401) è NonAutorizzato`, async () => {
    const { finto, p } = nuovo();
    finto.token = 'altro';
    await assert.rejects(p.elenca(), NonAutorizzato);
  });
}
