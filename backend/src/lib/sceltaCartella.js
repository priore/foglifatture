// Finestra di sistema per scegliere una cartella (Finder su macOS, Esplora risorse su Windows).
// Restituisce il percorso, o null se l'utente annulla. Il processo gira nella sessione dell'utente: la finestra compare sul suo schermo.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_WIN = fileURLToPath(new URL('../scripts/scegliCartellaWin.ps1', import.meta.url));

const esegui = (file, args) => new Promise((resolve, reject) => {
  execFile(file, args, (err, stdout, stderr) => (err ? reject(Object.assign(new Error(stderr || err.message), { stderr })) : resolve(stdout.trim())));
});

// Testo fisso e una sola riga su macOS: nessun valore dell'utente finisce dentro lo script.
const SCRIPT_MAC = 'POSIX path of (choose folder with prompt "Scegli la cartella del servizio cloud")';

export async function scegliCartella({ iniziale = '', piattaforma = process.platform, eseguiComando = esegui } = {}) {
  if (piattaforma === 'darwin') {
    try {
      return (await eseguiComando('osascript', ['-e', SCRIPT_MAC])).replace(/(.)\/$/, '$1') || null;
    } catch (err) {
      if (/-128|User canceled/i.test(err.message)) return null;
      throw err;
    }
  }
  if (piattaforma === 'win32') {
    return (await eseguiComando('powershell', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT_WIN, 'Scegli la cartella del servizio cloud', iniziale])) || null;
  }
  throw new Error('La scelta della cartella non è disponibile su questo sistema: inserisci il percorso a mano');
}
