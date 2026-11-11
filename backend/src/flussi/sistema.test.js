// Flusso utente: impostazioni di sistema (cartella dati spostata/aperta, termini d'uso, promemoria,
// segreti mai restituiti dall'API). Sandbox: puntatori e cartelle temporanee.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, CLI, ANNO } from './datiModello.js';

const FILE_ARCHIVIO = 'config' + '.json';

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

test('GET configurazione: nessuna password in chiaro verso il client', async () => {
  const r = await amb.api('GET', '/api/config');
  assert.equal(r.stato, 200);
  assert.ok(!/BEGIN (RSA|PRIVATE)|sk-[A-Za-z0-9]{20}/.test(r.testo));
  for (const [sezione, campo] of [['pec', 'passwordMittente'], ['backup', 'password']]) {
    const v = r.corpo[sezione][campo];
    assert.ok(!v || /^[•*]+$/.test(v) || /placeholder/i.test(v), `${sezione}.${campo} esposto`);
  }
});

test("termini d'uso: senza approvazione specifica non si accettano, poi accettati e ricordati", async () => {
  const t = (await amb.api('GET', '/api/termini')).corpo;
  assert.equal(t.accettati, false);
  assert.equal((await amb.api('POST', '/api/termini/accetta', {})).stato, 400);
  assert.equal((await amb.api('POST', '/api/termini/accetta', { approvazioneSpecifica: 'si' })).stato, 400);
  assert.equal((await amb.api('POST', '/api/termini/accetta', { approvazioneSpecifica: true })).stato, 200);
  assert.equal((await amb.api('GET', '/api/termini')).corpo.accettati, true);
});

test('promemoria fine mese: attivazione e disattivazione persistono', async () => {
  assert.equal((await amb.api('PUT', '/api/reminder/impostazioni', { abilitato: true })).corpo.abilitato, true);
  assert.equal((await amb.api('GET', '/api/config')).corpo.reminder.abilitato, true);
  assert.equal((await amb.api('PUT', '/api/reminder/impostazioni', { abilitato: false })).corpo.abilitato, false);
});

test("cartella dati: percorso mancante o uguale all'attuale rifiutati; cartella non vuota rifiutata", async () => {
  assert.equal((await amb.api('PUT', '/api/config/percorso-dati', {})).stato, 400);
  assert.equal((await amb.api('PUT', '/api/config/percorso-dati', { percorso: amb.dati })).stato, 400);
  const piena = path.join(amb.radice, 'piena');
  await mkdir(piena, { recursive: true });
  await writeFile(path.join(piena, 'altro.txt'), 'x');
  const r = await amb.api('PUT', '/api/config/percorso-dati', { percorso: piena });
  assert.equal(r.stato, 400);
  assert.match(r.corpo.errore, /non è vuota/);
  assert.equal((await amb.api('GET', `/api/invoice/${ANNO}/1/${CLI.it}`)).stato, 200, 'dati attuali intatti');
});

test('cartella dati: spostamento in cartella vuota conserva fatture, timesheet e puntatore', async () => {
  const prima = (await amb.api('GET', `/api/invoice/${ANNO}/1/${CLI.it}`)).corpo;
  const nuova = path.join(amb.radice, 'nuova-cartella');
  const r = await amb.api('PUT', '/api/config/percorso-dati', { percorso: nuova });
  assert.equal(r.stato, 200, r.testo.slice(0, 200));
  assert.deepEqual((await amb.api('GET', `/api/invoice/${ANNO}/1/${CLI.it}`)).corpo, prima);
  assert.ok((await amb.api('GET', '/api/timesheet')).corpo.length >= 15);
  const puntatore = JSON.parse(await readFile(process.env.FOGLIFATTURE_PUNTATORE_DATI, 'utf-8'));
  assert.equal(puntatore.percorso, nuova);
  const nuovoPag = await amb.api('POST', '/api/forfettario/pagamenti/conferma', { anno: ANNO, mese: 3, clienteId: CLI.it, dataPagamento: `${ANNO}-06-01`, importo: 10 });
  assert.equal(nuovoPag.stato, 200);
});

test('apri archivio esistente: cartella senza archivio rifiutata, con archivio valido aperta senza copiare', async () => {
  const vuota = path.join(amb.radice, 'vuota');
  await mkdir(vuota, { recursive: true });
  assert.equal((await amb.api('PUT', '/api/config/percorso-dati/apri', { percorso: vuota })).stato, 400);
  assert.equal((await amb.api('PUT', '/api/config/percorso-dati/apri', {})).stato, 400);
  const altro = path.join(amb.radice, 'altro-archivio');
  await mkdir(altro, { recursive: true });
  await writeFile(path.join(altro, FILE_ARCHIVIO), JSON.stringify({
    fornitore: { denominazione: 'Altro Studio', partitaIva: '01234567890', codiceFiscale: 'RSSMRA80A01H501Z' }, clienti: [],
  }));
  const ok = await amb.api('PUT', '/api/config/percorso-dati/apri', { percorso: altro });
  assert.equal(ok.stato, 200);
  assert.equal((await amb.api('GET', '/api/config')).corpo.fornitore.denominazione, 'Altro Studio');
});
