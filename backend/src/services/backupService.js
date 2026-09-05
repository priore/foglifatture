// Backup/restore di backend/data/: tutti i file letti ricorsivamente, serializzati in un
// unico JSON, compressi e cifrati (AES-256-GCM) con una master password fornita dall'utente.
// Un solo file binario portabile, non uno zip: non serve compatibilità con unzip esterni,
// serve solo poter ripristinare i dati su un'altra macchina.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { DATA_DIR } from '../lib/jsonStore.js';
import { logger } from '../lib/logger.js';
import { notificaMac } from '../lib/macNotifier.js';

const MAGIC = 'TSBK1'; // firma file di backup + versione formato
const SALT_LEN = 16;
const IV_LEN = 12; // GCM

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

// Crea l'archivio cifrato in memoria e lo restituisce come Buffer pronto da scrivere/scaricare.
export async function creaBackup(password) {
  if (!password) throw new Error('Password mancante');

  const fileRelativi = await elencaFileRicorsivo(DATA_DIR).catch(err => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });

  const contenuti = {};
  for (const relativo of fileRelativi) {
    const buf = await readFile(path.join(DATA_DIR, relativo));
    contenuti[relativo] = buf.toString('base64');
  }

  const payload = gzipSync(Buffer.from(JSON.stringify(contenuti), 'utf-8'));

  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const chiave = derivaChiave(password, salt);
  const cipher = createCipheriv('aes-256-gcm', chiave, iv);
  const cifrato = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    Buffer.from(MAGIC, 'utf-8'),
    salt,
    iv,
    authTag,
    cifrato,
  ]);
}

// Decifra e riscrive tutti i file su disco, sovrascrivendo quelli esistenti.
export async function ripristinaBackup(bufferBackup, password) {
  if (!password) throw new Error('Password mancante');
  const magic = bufferBackup.subarray(0, MAGIC.length).toString('utf-8');
  if (magic !== MAGIC) throw new Error('File di backup non valido');

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
  const fileScritti = Object.keys(contenuti);
  for (const relativo of fileScritti) {
    const destinazione = path.join(DATA_DIR, relativo);
    await mkdir(path.dirname(destinazione), { recursive: true });
    await writeFile(destinazione, Buffer.from(contenuti[relativo], 'base64'));
  }
  return { fileRipristinati: fileScritti.length };
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
      notificaMac('Backup fallito', err.message);
    }
  }, intervalloMs);
}

export function fermaBackupAutomatico() {
  if (timerBackup) clearInterval(timerBackup);
  timerBackup = null;
}
