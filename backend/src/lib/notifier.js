// Notifiche desktop native cross-platform via node-notifier (macOS, Windows, Linux).
// macOS: osascript. Windows: Snoretoast / PowerShell. Linux: notify-send.
// Tutti fire-and-forget: un fallimento non blocca il polling.
import notifier from 'node-notifier';
import { logger } from './logger.js';
import { readJson, writeJson } from './jsonStore.js';

const DEDUP_FILE = 'backend/data/notifiche-dedup.json';
export const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

export function dedupScaduta(stato, chiave, ora = Date.now()) {
  return !stato[chiave] || ora - stato[chiave] >= DEDUP_TTL_MS;
}

function inviaNotifica(titolo, messaggio) {
  notifier.notify({ title: titolo, message: messaggio }, (err) => {
    if (err) logger.warn('Notifica desktop fallita', { err: err.message });
  });
}

export async function notifica(titolo, messaggio) {
  const { getConfig } = await import('../services/configService.js');
  const config = await getConfig();
  if (config.notifiche?.abilitate === false) return;
  inviaNotifica(titolo, messaggio);
}

// ponytail: dedup 24h per chiave — evita spam da polling ripetuto per lo stesso evento
export async function notificaConDedup(chiave, titolo, messaggio) {
  const { getConfig } = await import('../services/configService.js');
  const config = await getConfig();
  if (config.notifiche?.abilitate === false) return;

  const stato = (await readJson(DEDUP_FILE, {})) ?? {};
  const ora = Date.now();
  if (!dedupScaduta(stato, chiave, ora)) return;

  stato[chiave] = ora;
  await writeJson(DEDUP_FILE, stato);
  inviaNotifica(titolo, messaggio);
}

export function cancellaDedup(chiave) {
  // ponytail: usato da OS.6 per ri-abilitare notifica dopo ripristino IMAP
  return readJson(DEDUP_FILE, {}).then(stato => {
    if (!stato || !(chiave in stato)) return;
    delete stato[chiave];
    return writeJson(DEDUP_FILE, stato);
  }).catch(() => {});
}
