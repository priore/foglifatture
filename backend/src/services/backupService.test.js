import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { randomBytes, scryptSync, createCipheriv } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

mock.module('../lib/logger.js', { exports: { logger: { info() {}, error() {} } } });
mock.module('../lib/notifier.js', { exports: { notifica() {} } });

const { setDataDir } = await import('../lib/jsonStore.js');
const { creaBackup, ripristinaBackup, percorsoBackupSicuro, CARTELLA_BACKUP_AUTOMATICI } = await import('./backupService.js');

const FILE = {
  'config.json': Buffer.from('{"a":1}'),
  'invoices/2026-8-x.json': Buffer.from('{"numero":"1"}'),
  'sotto/cartella/binario.bin': randomBytes(2_500_000), // più di due blocchi da 1 MiB
  'accenti è.json': Buffer.from('{}'),
};

function cartella(file = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ff-bks-'));
  for (const [rel, buf] of Object.entries(file)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), buf);
  }
  return dir;
}

// Backup nel formato precedente (TSBK1), per provare che resta ripristinabile.
function backupTsbk1(file, password) {
  const contenuti = Object.fromEntries(Object.entries(file).map(([k, v]) => [k, v.toString('base64')]));
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
  const cifrato = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(contenuti)))), cipher.final()]);
  return Buffer.concat([Buffer.from('TSBK1'), salt, iv, cipher.getAuthTag(), cifrato]);
}

function verifica(dir, file) {
  for (const [rel, buf] of Object.entries(file)) assert.deepEqual(readFileSync(path.join(dir, rel)), buf);
}

test('TSBK2: crea e ripristina, anche su più blocchi', async () => {
  const sorgente = cartella(FILE);
  const dest = cartella();
  try {
    setDataDir(sorgente);
    const backup = await creaBackup('password di prova');
    assert.equal(backup.subarray(0, 5).toString(), 'TSBK2');
    setDataDir(dest);
    assert.deepEqual(await ripristinaBackup(backup, 'password di prova'), { fileRipristinati: 4 });
    verifica(dest, FILE);
  } finally { setDataDir(null); rmSync(sorgente, { recursive: true }); rmSync(dest, { recursive: true }); }
});

test('TSBK1: i backup fatti finora si ripristinano ancora', async () => {
  const dest = cartella();
  try {
    setDataDir(dest);
    await ripristinaBackup(backupTsbk1(FILE, 'vecchia'), 'vecchia');
    verifica(dest, FILE);
  } finally { setDataDir(null); rmSync(dest, { recursive: true }); }
});

test('TSBK2: password errata, blocco alterato, troncamento e blocchi riordinati vengono rifiutati', async () => {
  const sorgente = cartella(FILE);
  const dest = cartella();
  try {
    setDataDir(sorgente);
    const backup = await creaBackup('pw');
    setDataDir(dest);
    await assert.rejects(ripristinaBackup(backup, 'altra'), /Password errata/);
    const alterato = Buffer.from(backup); alterato[alterato.length - 40] ^= 1;
    await assert.rejects(ripristinaBackup(alterato, 'pw'), /Password errata/);
    await assert.rejects(ripristinaBackup(backup.subarray(0, backup.length - 1_000_000), 'pw'));
    const testa = 29;
    const l0 = 4 + backup.readUInt32BE(testa) + 16;
    const l1 = 4 + backup.readUInt32BE(testa + l0) + 16;
    const scambiato = Buffer.concat([backup.subarray(0, testa), backup.subarray(testa + l0, testa + l0 + l1), backup.subarray(testa, testa + l0), backup.subarray(testa + l0 + l1)]);
    await assert.rejects(ripristinaBackup(scambiato, 'pw'));
    assert.equal(existsSync(path.join(dest, 'config.json')), false);
  } finally { setDataDir(null); rmSync(sorgente, { recursive: true }); rmSync(dest, { recursive: true }); }
});

test('percorsi che escono dalla cartella dati non sono sicuri', () => {
  for (const ok of ['a.json', 'a/b/c.json', 'accenti è.json']) assert.equal(percorsoBackupSicuro(ok), true, ok);
  for (const no of ['', '/x', '../x', 'a/../../x', 'a//b', './a', 'a\\b']) assert.equal(percorsoBackupSicuro(no), false, no);
});

test('i backup automatici degli ambienti embedded non entrano nel backup', async () => {
  const sorgente = cartella({ 'config.json': Buffer.from('{}'), [`${CARTELLA_BACKUP_AUTOMATICI}/vecchio.tsbk`]: randomBytes(100) });
  const dest = cartella();
  try {
    setDataDir(sorgente);
    const backup = await creaBackup('pw');
    setDataDir(dest);
    assert.deepEqual(await ripristinaBackup(backup, 'pw'), { fileRipristinati: 1 });
    assert.ok(!existsSync(path.join(dest, CARTELLA_BACKUP_AUTOMATICI)));
  } finally { setDataDir(null); rmSync(sorgente, { recursive: true }); rmSync(dest, { recursive: true }); }
});
