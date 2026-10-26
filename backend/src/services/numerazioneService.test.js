import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setDataDir, readJson, writeJson, listKeys } from '../lib/jsonStore.js';
import { registraNumero, leggiRegistro, liberaPrenotazioniOrfane, azzeraIdDispositivo } from './numerazioneService.js';
import { scansionaSequenza, verificaSequenzaPerEmissione, verificaIntegritaNumerazione, prossimoNumeroFattura, prossimoNumeroInSequenza } from './invoiceService.js';
import { apriArchivioEsistente } from './configService.js';

const CLI_X = 'a1b2c3d4-cliX';
const CLI_Y = 'e5f6a7b8-cliY';

async function archivio() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'numerazione-'));
  process.env.FOGLIFATTURE_ID_DISPOSITIVO = path.join(base, 'id.json');
  process.env.FOGLIFATTURE_PUNTATORE_DATI = path.join(base, 'puntatore.json');
  azzeraIdDispositivo();
  const dati = path.join(base, 'dati');
  await mkdir(path.join(dati, 'invoices'), { recursive: true });
  setDataDir(dati);
  return { base, dati };
}

const fattura = (mese, clienteId, numero) =>
  writeJson(`invoices/2026-${String(mese).padStart(2, '0')}-${clienteId}.json`, { anno: 2026, mese, clienteId, numero: String(numero) });

test('listKeys con formato scarta copie in conflitto e file estranei', async () => {
  await archivio();
  await fattura(1, CLI_X, 1);
  await writeJson(`invoices/2026-01-${CLI_X} (conflicted copy).json`, {});
  await writeJson('invoices/note.json', {});
  assert.deepEqual(await listKeys('invoices', /^\d{4}-\d{2}-[A-Za-z0-9_-]+$/), [`2026-01-${CLI_X}`]);
});

test('registro: prenota, è idempotente per lo stesso documento e rifiuta un altro documento', async () => {
  await archivio();
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_X });
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_X });
  await assert.rejects(registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_Y }), /già prenotato/);
  const registro = await leggiRegistro();
  assert.equal(registro.ultimoNumero, 1);
  assert.match(registro.numeri['1'].idDispositivo, /^[0-9a-f-]{36}$/);
});

test('registro: richieste concorrenti dello stesso numero, ne passa una sola', async () => {
  await archivio();
  const esiti = await Promise.allSettled([
    registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_X }),
    registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_Y }),
  ]);
  assert.deepEqual(esiti.map((e) => e.status).sort(), ['fulfilled', 'rejected']);
});

test('numero prenotato da un altro dispositivo, fattura non ancora arrivata: non si riusa', async () => {
  await archivio();
  await fattura(1, CLI_X, 1);
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_X });
  await registraNumero(2, { anno: 2026, mese: 1, clienteId: CLI_Y }); // fattura 2 non sincronizzata
  assert.equal(await prossimoNumeroInSequenza(), '3');
  assert.equal(await prossimoNumeroFattura(2026, 2, CLI_X), '3');
  assert.equal((await verificaIntegritaNumerazione(2026, 2, CLI_X, '2')).valido, false);
  assert.equal((await verificaIntegritaNumerazione(2026, 2, CLI_X, '3')).valido, true);
  assert.deepEqual((await scansionaSequenza()).inAttesa, [2]);
});

test('scansione: archivio pulito, nessun blocco; i buchi non bloccano', async () => {
  await archivio();
  await fattura(1, CLI_X, 1);
  await fattura(2, CLI_X, 3);
  const scan = await scansionaSequenza();
  assert.equal(scan.ok, true);
  assert.deepEqual(scan.buchi, [2]);
});

test('doppione da due dispositivi: il documento non ancora uscito passa al numero libero', async () => {
  await archivio();
  await registraNumero(5, { anno: 2026, mese: 1, clienteId: CLI_Y }); // registro stantio: non deve decidere
  await fattura(1, CLI_X, 5); // dispositivo A, nel registro
  await fattura(1, CLI_Y, 5); // dispositivo B, nessun conflitto di file
  const esito = await verificaSequenzaPerEmissione();
  assert.equal(esito.ok, true);
  assert.deepEqual(esito.riparati.map(({ clienteId, da, a }) => [clienteId, da, a]), [[CLI_Y, 5, 6]]);
  assert.equal((await readJson(`invoices/2026-01-${CLI_X}.json`)).numero, '5');
  assert.equal((await readJson(`invoices/2026-01-${CLI_Y}.json`)).numero, '6');
  assert.equal((await leggiRegistro()).numeri[6].clienteId, CLI_Y);
});

test('doppione con un documento già trasmesso: tiene il numero, l\'altro si rinumera; due trasmessi bloccano', async () => {
  await archivio();
  await writeJson(`invoices/2026-01-${CLI_X}.json`, { anno: 2026, mese: 1, clienteId: CLI_X, numero: '5', invii: [{}] });
  await fattura(1, CLI_Y, 5);
  assert.equal((await verificaSequenzaPerEmissione()).ok, true);
  assert.equal((await readJson(`invoices/2026-01-${CLI_X}.json`)).numero, '5');
  await writeJson(`invoices/2026-01-${CLI_Y}.json`, { anno: 2026, mese: 1, clienteId: CLI_Y, numero: '5', invii: [{}] });
  const esito = await verificaSequenzaPerEmissione();
  assert.equal(esito.ok, false);
  assert.match(esito.errore, /numeri duplicati: 5/);
});

test('prenotazione orfana in coda: dopo l\'attesa si libera e il numero si riusa; i buchi in mezzo restano', async () => {
  await archivio();
  await fattura(1, CLI_X, 1);
  await fattura(2, CLI_X, 3);
  await registraNumero(2, { anno: 2026, mese: 9, clienteId: CLI_Y }); // buco in mezzo
  await registraNumero(5, { anno: 2026, mese: 9, clienteId: CLI_Y }); // orfana in coda, appena fatta
  await liberaPrenotazioniOrfane([1, 3]);
  assert.ok((await leggiRegistro()).numeri[5], 'giovane: resta, potrebbe essere un\'emissione in corso');
  await liberaPrenotazioniOrfane([1, 3], -1);
  const registro = await leggiRegistro();
  assert.equal(registro.numeri[5], undefined);
  assert.ok(registro.numeri[2]);
  assert.equal(registro.ultimoNumero, 3);
  assert.equal(await prossimoNumeroInSequenza(), '4');
});

test('scansione: file estranei e copie in conflitto bloccano e non contano come fatture', async () => {
  await archivio();
  await fattura(1, CLI_X, 1);
  await writeJson(`invoices/2026-01-${CLI_X} (conflicted copy).json`, { anno: 2026, mese: 1, clienteId: CLI_X, numero: '1' });
  await writeJson('invoices/.numero-prenotato.json', {});
  const esito = await verificaSequenzaPerEmissione();
  assert.equal(esito.ok, false);
  assert.equal(esito.scan.estranei.length, 2);
  assert.equal(esito.scan.duplicati.length, 0); // la copia non è letta come fattura
  assert.match(esito.errore, /copie in conflitto/);
});

test('scansione: copia in conflitto del registro blocca', async () => {
  await archivio();
  await registraNumero(1, { anno: 2026, mese: 1, clienteId: CLI_X });
  await writeJson('numerazione (conflicted copy).json', { ultimoNumero: 1, numeri: {} });
  const scan = await scansionaSequenza();
  assert.equal(scan.ok, false);
  assert.deepEqual(scan.registroConflitto, ['numerazione (conflicted copy)']);
});

test('apri archivio esistente: collega senza spostare, rifiuta cartelle senza fornitore', async () => {
  const { base, dati } = await archivio();
  await writeJson('config.json', { fornitore: { nome: 'Esempio' } });
  const altro = path.join(base, 'altro');
  await mkdir(altro);
  await assert.rejects(apriArchivioEsistente(altro), /archivio valido/);
  await writeFile(path.join(altro, 'config.json'), JSON.stringify({ fornitore: { nome: 'Altro' } }));
  await apriArchivioEsistente(altro);
  assert.equal((await readJson('config.json')).fornitore.nome, 'Altro');
  assert.equal(JSON.parse(await readFile(path.join(dati, 'config.json'), 'utf-8')).fornitore.nome, 'Esempio'); // intatto
  assert.equal(JSON.parse(await readFile(process.env.FOGLIFATTURE_PUNTATORE_DATI, 'utf-8')).percorso, altro);
});
