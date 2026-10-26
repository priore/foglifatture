// Cartelle di sincronizzazione dei client desktop di Dropbox, OneDrive e Google Drive presenti su questo computer.
// Il client del provider è già collegato all'account dell'utente del PC: l'app usa la cartella `FogliFatture` al suo
// interno, senza chiavi API né login propri. Solo desktop Node (macOS e Windows): gli ambienti embedded non leggono cartelle altrui.
// Il file system, la home e la piattaforma si iniettano per i test.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SOTTOCARTELLA = 'FogliFatture';
const NOMI_DRIVE = ['My Drive', 'Il mio Drive'];

const eCartella = (fs, p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function dropbox({ fs, home, piattaforma, env }) {
  const infoFile = piattaforma === 'win32'
    ? [env.APPDATA, env.LOCALAPPDATA].filter(Boolean).map((b) => path.join(b, 'Dropbox', 'info.json'))
    : [path.join(home, '.dropbox', 'info.json')];
  for (const f of infoFile) {
    try {
      const personale = JSON.parse(fs.readFileSync(f, 'utf-8')).personal?.path;
      if (personale && eCartella(fs, personale)) return [personale];
    } catch { /* il client usa il percorso predefinito */ }
  }
  return [path.join(home, 'Dropbox'), path.join(home, 'Library', 'CloudStorage', 'Dropbox')].filter((p) => eCartella(fs, p));
}

// Solo l'OneDrive personale: quello aziendale (`OneDrive - Azienda`) non è un account supportato.
// Su macOS la cartella si chiama `OneDrive-Personal` o, con il sistema in italiano, `OneDrive-Personale`.
function onedrive({ fs, home, piattaforma, env }) {
  const base = path.join(home, 'Library', 'CloudStorage');
  let personali = [];
  try { personali = fs.readdirSync(base).filter((v) => /^OneDrive-Personal/.test(v)).map((v) => path.join(base, v)); } catch { /* nessun client */ }
  const candidati = piattaforma === 'win32'
    ? [env.OneDriveConsumer, path.join(home, 'OneDrive')]
    : [...personali, path.join(home, 'OneDrive')];
  // `~/OneDrive` è spesso un collegamento alla stessa cartella di CloudStorage: si tiene una voce sola.
  const reale = (p) => { try { return fs.realpathSync?.(p) ?? p; } catch { return p; } };
  const viste = new Set();
  return candidati.filter((p) => p && eCartella(fs, p) && !viste.has(reale(p)) && viste.add(reale(p)));
}

function googleDrive({ fs, home, piattaforma }) {
  if (piattaforma === 'win32') {
    const lettere = Array.from({ length: 24 }, (_, i) => `${String.fromCharCode(67 + i)}:\\`);
    return [
      ...lettere.flatMap((l) => NOMI_DRIVE.map((n) => path.win32.join(l, n))),
      ...NOMI_DRIVE.map((n) => path.join(home, n)),
    ].filter((p) => eCartella(fs, p));
  }
  const base = path.join(home, 'Library', 'CloudStorage');
  let voci = [];
  try { voci = fs.readdirSync(base).filter((v) => v.startsWith('GoogleDrive-')); } catch { /* nessun client */ }
  return voci.flatMap((v) => NOMI_DRIVE.map((n) => path.join(base, v, n))).filter((p) => eCartella(fs, p));
}

const PROVIDER = [
  ['dropbox', 'Dropbox', dropbox],
  ['onedrive', 'OneDrive', onedrive],
  ['google', 'Google Drive', googleDrive],
];

// Stato della sottocartella dell'app: 'assente', 'vuota', 'archivio' (c'è config.json con il fornitore) o 'estranea'.
export function statoSottocartella(fs, cartella) {
  if (!eCartella(fs, cartella)) return 'assente';
  const voci = fs.readdirSync(cartella).filter((v) => v !== '.DS_Store');
  if (!voci.length) return 'vuota';
  try {
    return JSON.parse(fs.readFileSync(path.join(cartella, 'config.json'), 'utf-8')).fornitore ? 'archivio' : 'estranea';
  } catch {
    return 'estranea';
  }
}

// Percorso `FogliFatture` dentro una cartella scelta dall'utente e suo stato (la sottocartella non è modificabile).
export function esaminaRadice(radice, { fs = { statSync, readdirSync, readFileSync, existsSync, realpathSync } } = {}) {
  if (!radice || !eCartella(fs, radice)) throw new Error('La cartella scelta non esiste');
  const percorso = path.join(radice, SOTTOCARTELLA);
  return { radice, percorso, stato: statoSottocartella(fs, percorso) };
}

export function cartelleCloudLocali({
  fs = { statSync, readdirSync, readFileSync, existsSync, realpathSync }, home = os.homedir(), piattaforma = process.platform, env = process.env,
} = {}) {
  const ctx = { fs, home, piattaforma, env };
  return PROVIDER.flatMap(([provider, nome, trova]) => trova(ctx).map((radice) => {
    const percorso = path.join(radice, SOTTOCARTELLA);
    return { provider, nome, radice, percorso, stato: statoSottocartella(fs, percorso) };
  }));
}
