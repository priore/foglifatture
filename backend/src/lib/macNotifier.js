// Notifiche desktop native macOS, via osascript (nessuna dipendenza aggiuntiva).
// Usato per avvisare l'utente di nuove ricevute/notifiche SDI o di errori di recupero.
// Su altri OS (Windows/Linux) è un no-op: nessun equivalente nativo cross-platform
// senza dipendenze, i chiamanti restano invariati (fire-and-forget).
import { execFile } from 'node:child_process';
import { logger } from './logger.js';

function escapaAppleScript(testo) {
  return String(testo).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function notificaMac(titolo, messaggio) {
  if (process.platform !== 'darwin') {
    logger.info('Notifica desktop non disponibile su questo OS', { titolo, messaggio });
    return;
  }
  const script = `display notification "${escapaAppleScript(messaggio)}" with title "${escapaAppleScript(titolo)}"`;
  execFile('osascript', ['-e', script], () => {}); // ponytail: fire-and-forget, non blocca il polling se osascript fallisce
}
