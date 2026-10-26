// Backup/restore di backend/data/: tutti i file letti ricorsivamente, compressi e cifrati
// (AES-256-GCM) con una master password fornita dall'utente.
// Un solo file binario portabile, non uno zip: non serve compatibilità con unzip esterni,
// serve solo poter ripristinare i dati su un'altra macchina.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { DATA_DIR } from '../lib/jsonStore.js';
import { logger } from '../lib/logger.js';
import { notifica } from '../lib/notifier.js';

const MAGIC = 'TSBK1'; // firma file di backup + versione formato
const SALT_LEN = 16;
const IV_LEN = 12; // GCM

// Cartella dei backup automatici degli ambienti embedded, dentro l'archivio: non entra nel backup.
export const CARTELLA_BACKUP_AUTOMATICI = 'backup-automatici';

async function elencaFileRicorsivo(dir, base = dir) {
  const voci = await readdir(dir, { withFileTypes: true });
  const risultati = [];
  for (const voce of voci) {
    const percorsoAssoluto = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      risultati.push(...await elencaFileRicorsivo(percorsoAssoluto, base));
    } else {
      risultati.push(path.relative(base, percorsoAssoluto));
    }
  }
  return risultati;
}

function derivaChiave(password, salt) {
  return scryptSync(password, salt, 32);
}

// Formati (entrambi AES-256-GCM, chiave scrypt dalla password):
//  - TSBK1: file di backup fino a oggi: magic | salt | iv | tag | cifrato, contenuto = gzip di un JSON { percorso: base64 }.
//  - TSBK2: a blocchi da 1 MiB, così gli ambienti embedded ripristinano a memoria costante. Contenuto = gzip di voci
//    (u16 lunghezza percorso | percorso UTF-8 | u64 dimensione | byte) chiuse da u16 0.
//      magic | salt (16) | prefisso nonce (8) | { u32 lunghezza | cifrato | tag (16) }*
//    nonce = prefisso | numero del blocco (u32 BE); AAD = magic | salt | prefisso | 1 se ultimo blocco, altrimenti 0.
// Si scrive sempre TSBK2; si leggono entrambi.
const MAGIC2 = 'TSBK2';
const PREFISSO_LEN = 8;
const BLOCCO = 1024 * 1024;
const BLOCCO_MAX = BLOCCO + 1024;
const TAG_LEN = 16;

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

// Percorso relativo senza uscite dalla cartella dati: un backup non fidato non scrive fuori da DATA_DIR.
export function percorsoBackupSicuro(relativo) {
  const comp = relativo.split('/');
  return relativo !== '' && !relativo.startsWith('/') && !relativo.includes('\\') && !comp.some((c) => c === '' || c === '.' || c === '..');
}

// Crea l'archivio cifrato in memoria e lo restituisce come Buffer pronto da scrivere/scaricare.
export async function creaBackup(password) {
  if (!password) throw new Error('Password mancante');

  const fileRelativi = (await elencaFileRicorsivo(DATA_DIR).catch(err => {
    if (err.code === 'ENOENT') return [];
    throw err;
  })).filter(relativo => !relativo.startsWith(`${CARTELLA_BACKUP_AUTOMATICI}${path.sep}`));

  const voci = [];
  for (const relativo of fileRelativi) {
    const percorso = Buffer.from(relativo.split(path.sep).join('/'), 'utf-8');
    const contenuto = await readFile(path.join(DATA_DIR, relativo));
    const intestazione = Buffer.alloc(2 + percorso.length + 8);
    intestazione.writeUInt16BE(percorso.length, 0);
    percorso.copy(intestazione, 2);
    intestazione.writeBigUInt64BE(BigInt(contenuto.length), 2 + percorso.length);
    voci.push(intestazione, contenuto);
  }
  voci.push(Buffer.alloc(2));
  const payload = gzipSync(Buffer.concat(voci));

  const salt = randomBytes(SALT_LEN);
  const prefisso = randomBytes(PREFISSO_LEN);
  const chiave = derivaChiave(password, salt);
  const aadBase = Buffer.concat([Buffer.from(MAGIC2, 'utf-8'), salt, prefisso]);
  const parti = [aadBase];
  const blocchi = Math.max(1, Math.ceil(payload.length / BLOCCO));
  for (let i = 0; i < blocchi; i++) {
    const cipher = createCipheriv('aes-256-gcm', chiave, Buffer.concat([prefisso, u32(i)]));
    cipher.setAAD(Buffer.concat([aadBase, Buffer.from([i === blocchi - 1 ? 1 : 0])]));
    const cifrato = Buffer.concat([cipher.update(payload.subarray(i * BLOCCO, (i + 1) * BLOCCO)), cipher.final()]);
    parti.push(u32(cifrato.length), cifrato, cipher.getAuthTag());
  }
  return Buffer.concat(parti);
}

function decifraTsbk1(bufferBackup, password) {
  let offset = MAGIC.length;
  const salt = bufferBackup.subarray(offset, offset += SALT_LEN);
  const iv = bufferBackup.subarray(offset, offset += IV_LEN);
  const authTag = bufferBackup.subarray(offset, offset += 16);
  const cifrato = bufferBackup.subarray(offset);

  const chiave = derivaChiave(password, salt);
  const decipher = createDecipheriv('aes-256-gcm', chiave, iv);
  decipher.setAuthTag(authTag);

  let payload;
  try {
    payload = Buffer.concat([decipher.update(cifrato), decipher.final()]);
  } catch {
    throw new Error('Password errata o file di backup corrotto');
  }

  const contenuti = JSON.parse(gunzipSync(payload).toString('utf-8'));
  return Object.entries(contenuti).map(([relativo, b64]) => [relativo, Buffer.from(b64, 'base64')]);
}

function decifraTsbk2(bufferBackup, password) {
  const testa = MAGIC2.length + SALT_LEN + PREFISSO_LEN;
  if (bufferBackup.length < testa) throw new Error('File di backup non valido');
  const salt = bufferBackup.subarray(MAGIC2.length, MAGIC2.length + SALT_LEN);
  const prefisso = bufferBackup.subarray(MAGIC2.length + SALT_LEN, testa);
  const aadBase = bufferBackup.subarray(0, testa);
  const chiave = derivaChiave(password, salt);

  const chiari = [];
  let offset = testa;
  for (let i = 0; offset < bufferBackup.length; i++) {
    if (offset + 4 > bufferBackup.length) throw new Error('File di backup non valido');
    const n = bufferBackup.readUInt32BE(offset);
    const fine = offset + 4 + n + TAG_LEN;
    if (n > BLOCCO_MAX || fine > bufferBackup.length) throw new Error('File di backup non valido');
    const decipher = createDecipheriv('aes-256-gcm', chiave, Buffer.concat([prefisso, u32(i)]));
    decipher.setAAD(Buffer.concat([aadBase, Buffer.from([fine === bufferBackup.length ? 1 : 0])]));
    decipher.setAuthTag(bufferBackup.subarray(fine - TAG_LEN, fine));
    try {
      chiari.push(Buffer.concat([decipher.update(bufferBackup.subarray(offset + 4, fine - TAG_LEN)), decipher.final()]));
    } catch {
      throw new Error('Password errata o file di backup corrotto');
    }
    offset = fine;
  }

  const dati = gunzipSync(Buffer.concat(chiari));
  const voci = [];
  let pos = 0;
  for (;;) {
    if (pos + 2 > dati.length) throw new Error('File di backup non valido');
    const nPercorso = dati.readUInt16BE(pos); pos += 2;
    if (nPercorso === 0) break;
    const relativo = dati.subarray(pos, pos + nPercorso).toString('utf-8'); pos += nPercorso;
    const dimensione = Number(dati.readBigUInt64BE(pos)); pos += 8;
    if (pos + dimensione > dati.length) throw new Error('File di backup non valido');
    voci.push([relativo, dati.subarray(pos, pos + dimensione)]); pos += dimensione;
  }
  if (pos !== dati.length) throw new Error('File di backup non valido');
  return voci;
}

// Decifra e riscrive tutti i file su disco, sovrascrivendo quelli esistenti.
export async function ripristinaBackup(bufferBackup, password) {
  if (!password) throw new Error('Password mancante');
  const intestazione = bufferBackup.subarray(0, 5).toString('utf-8');
  if (intestazione !== MAGIC && intestazione !== MAGIC2) throw new Error('File di backup non valido');

  const voci = intestazione === MAGIC2 ? decifraTsbk2(bufferBackup, password) : decifraTsbk1(bufferBackup, password);
  // Prima si controllano tutti i percorsi: un backup con `..` non scrive nulla.
  if (intestazione === MAGIC2) {
    const cattivo = voci.find(([relativo]) => !percorsoBackupSicuro(relativo));
    if (cattivo) throw new Error(`Percorso non valido nel backup: ${cattivo[0]}`);
  }
  for (const [relativo, contenuto] of voci) {
    const destinazione = path.join(DATA_DIR, relativo);
    await mkdir(path.dirname(destinazione), { recursive: true });
    await writeFile(destinazione, contenuto);
  }
  return { fileRipristinati: voci.length };
}

let timerBackup = null;

// Backup automatico su disco, stesso pattern del polling ricevute SDI (sdiRicevuteService.js):
// rilegge la config ad ogni giro così un cambio di impostazioni non richiede riavvio.
export function avviaBackupAutomatico(getConfig, minuti) {
  fermaBackupAutomatico();
  const intervalloMs = Math.max(1, minuti) * 60 * 1000;
  timerBackup = setInterval(async () => {
    const config = await getConfig();
    const cfg = config.backup;
    if (!cfg?.abilitato || !cfg?.percorsoDestinazione || !cfg?.password) return;
    try {
      const buffer = await creaBackup(cfg.password);
      const nomeFile = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tsbk`;
      await mkdir(cfg.percorsoDestinazione, { recursive: true });
      await writeFile(path.join(cfg.percorsoDestinazione, nomeFile), buffer);
      logger.info(`Backup automatico creato: ${nomeFile}`);
    } catch (err) {
      logger.error('Errore backup automatico', { errore: err.message });
      notifica('Backup fallito', err.message);
    }
  }, intervalloMs);
}

export function fermaBackupAutomatico() {
  if (timerBackup) clearInterval(timerBackup);
  timerBackup = null;
}
