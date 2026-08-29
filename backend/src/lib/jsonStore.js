// Archiviazione dati su file JSON semplice (flat file), portabile e senza dipendenze da DB.
// Ogni "collezione" è una cartella; ogni record è un file <chiave>.json al suo interno.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, '..', '..', 'data');

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
}

// Elenca le chiavi (nomi file senza estensione) presenti in una sottocartella della collezione.
export async function listKeys(relativeDir) {
  const dir = path.join(DATA_DIR, relativeDir);
  try {
    const files = await readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export { DATA_DIR };
