// Notifiche desktop native macOS, via osascript (nessuna dipendenza aggiuntiva).
// Usato per avvisare l'utente di nuove ricevute/notifiche SDI o di errori di recupero.
import { execFile } from 'node:child_process';

function escapaAppleScript(testo) {
  return String(testo).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function notificaMac(titolo, messaggio) {
  const script = `display notification "${escapaAppleScript(messaggio)}" with title "${escapaAppleScript(titolo)}"`;
  execFile('osascript', ['-e', script], () => {}); // ponytail: fire-and-forget, non blocca il polling se osascript fallisce
}
