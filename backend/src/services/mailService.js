// Invio PDF (timesheet/fattura) al cliente via client di posta OS predefinito, senza SMTP
// proprio. mailto: non supporta allegati su nessun OS, quindi il PDF va sempre salvato su
// disco prima:
// - macOS: AppleScript pilota Mail.app, crea il messaggio con l'allegato reale già inserito.
// - altri OS (Windows/Linux): nessun automatismo cross-client affidabile per l'allegato
//   (Outlook/Thunderbird/client di sistema variano troppo), quindi si rivela il file nel
//   file manager già selezionato e si lascia che il frontend apra mailto: con oggetto/corpo
//   precompilati — l'utente trascina l'allegato nella finestra di composizione già aperta.
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from '../lib/jsonStore.js';
import { logger } from '../lib/logger.js';

const SCRIPT_MAIL_APP_MAC = fileURLToPath(new URL('../scripts/mailAppMac.applescript', import.meta.url));

function eseguiOsascriptFile(percorsoScript, argv) {
  return new Promise((resolve, reject) => {
    execFile('osascript', [percorsoScript, ...argv], (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function rivelaFileNelFileManager(percorsoFile) {
  const comando = process.platform === 'win32'
    ? { file: 'explorer', args: [`/select,${percorsoFile}`] }
    : { file: 'xdg-open', args: [path.dirname(percorsoFile)] }; // linux: nessun "select" universale, apre la cartella
  execFile(comando.file, comando.args, () => {}); // ponytail: fire-and-forget, non blocca l'invio se il file manager non risponde
}

// Crea un messaggio in Mail.app con allegato reale già inserito (destinatari multipli
// separati da virgola supportati nativamente dalla proprietà "to recipients" di Mail).
async function inviaViaMailAppMac(destinatari, oggetto, corpo, percorsoFile) {
  await eseguiOsascriptFile(SCRIPT_MAIL_APP_MAC, [oggetto, corpo, percorsoFile, ...destinatari]);
}

// Salva il PDF nell'outbox locale e avvia il flusso di invio più adatto al sistema
// operativo corrente. Ritorna { modalita, mailtoUrl? } per il frontend.
export async function inviaPdfAlCliente({ bufferPdf, nomeFile, destinatari, oggetto, corpo }) {
  const cartellaOutbox = path.join(DATA_DIR, 'mail-outbox');
  await mkdir(cartellaOutbox, { recursive: true });
  const percorsoFile = path.join(cartellaOutbox, nomeFile);
  await writeFile(percorsoFile, bufferPdf);

  if (process.platform === 'darwin') {
    try {
      await inviaViaMailAppMac(destinatari, oggetto, corpo, percorsoFile);
      return { modalita: 'mail-app-mac' };
    } catch (err) {
      logger.error('Errore apertura Mail.app via AppleScript', { errore: err.message });
      // fallback: comportamento identico agli altri OS se Mail.app non è configurata/disponibile
    }
  }

  rivelaFileNelFileManager(percorsoFile);
  const mailtoUrl = `mailto:${destinatari.join(',')}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
  return { modalita: 'rivela-e-mailto', mailtoUrl };
}
