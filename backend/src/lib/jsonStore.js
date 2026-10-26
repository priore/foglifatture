// Archiviazione dati su file JSON semplice (flat file), portabile e senza dipendenze da DB.
// Ogni "collezione" è una cartella; ogni record è un file <chiave>.json al suo interno.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR_DEFAULT = path.join(import.meta.dirname, '..', '..', 'data');

// Mutabile: cambiata da configService dopo lo spostamento fisico dei file (percorso dati
// configurabile da Impostazioni). Il binding `export let` è live per chi importa DATA_DIR,
// niente riavvio del processo necessario.
export let DATA_DIR = DATA_DIR_DEFAULT;

// Usata da configService per applicare l'override letto da config.json all'avvio, prima
// di qualunque altra lettura/scrittura su disco.
export function setDataDir(dir) {
  DATA_DIR = dir || DATA_DIR_DEFAULT;
}

// Notifica dopo ogni scrittura (percorso relativo): la sincronizzazione con i provider cloud
// sa così quali file caricare. Un solo ascoltatore; un suo errore non fa fallire la scrittura.
let dopoScrittura = null;
export function setDopoScrittura(fn) {
  dopoScrittura = fn;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

// Legge un file JSON; restituisce defaultValue se non esiste ancora.
export async function readJson(relativePath, defaultValue = null) {
  const file = path.join(DATA_DIR, relativePath);
  try {
    const raw = await readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}

// Scrive un oggetto come JSON leggibile (indentato) su file, creando le cartelle necessarie.
export async function writeJson(relativePath, data) {
  const file = path.join(DATA_DIR, relativePath);
  await ensureDir(path.dirname(file));
  await writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  try { dopoScrittura?.(relativePath); } catch { /* la scrittura locale è riuscita */ }
}

// Elenca i nomi (senza estensione) dei file .json presenti in una cartella dell'archivio.
export async function listNomi(relativeDir) {
  const dir = path.join(DATA_DIR, relativeDir);
  try {
    const files = await readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Elenca le chiavi (nomi file senza estensione) di una sottocartella. Con `formato` (RegExp)
// restano solo i nomi che lo rispettano: copie in conflitto dei provider cloud e file estranei
// ("x (conflicted copy).json") non diventano record; vedi listEstranei per segnalarli.
export async function listKeys(relativeDir, formato) {
  const nomi = await listNomi(relativeDir);
  return formato ? nomi.filter(n => formato.test(n)) : nomi;
}

// Nomi che NON rispettano il formato: l'altra metà di listKeys(dir, formato).
export async function listEstranei(relativeDir, formato) {
  return (await listNomi(relativeDir)).filter(n => !formato.test(n));
}
