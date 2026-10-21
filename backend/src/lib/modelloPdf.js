// Modelli PDF ufficiali (F24, Redditi PF) descritti nel registro fonti: URL di download e impronta
// SHA-256 sono dati versionati, non costanti nel codice. Il modello non si ridistribuisce: si scarica
// dal sito AdE al primo uso in backend/data/modelli/<id>.pdf (escluso da git) e si verifica con SHA-256.
// Se l'AdE pubblica una nuova edizione l'impronta cambia e la stampa si blocca con un errore chiaro:
// meglio un errore che numeri nelle caselle sbagliate.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './jsonStore.js';
import { registro } from '../services/fontiNormativeService.js';

export function percorsoModelloPdf(id) {
  return path.join(DATA_DIR, 'modelli', `${id}.pdf`);
}

// Restituisce il Buffer del modello `id` (voce del registro fonti), scaricandolo se assente.
export async function caricaModelloPdf(id) {
  const voce = (await registro()).find((v) => v.id === id);
  if (!voce?.urlDownload || !voce.sha256Originale) throw new Error(`Modello ${id} non descritto nel registro fonti`);
  const dest = percorsoModelloPdf(id);
  if (!existsSync(dest)) {
    await mkdir(path.dirname(dest), { recursive: true });
    const res = await fetch(voce.urlDownload);
    if (!res.ok) throw new Error(`Impossibile scaricare il modello "${voce.titolo}" da AdE (${res.status}). Salvarlo manualmente in backend/data/modelli/${id}.pdf`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  }
  const buf = await readFile(dest);
  const hash = createHash('sha256').update(buf).digest('hex');
  if (hash !== voce.sha256Originale) {
    throw new Error(`Il modello "${voce.titolo}" ha un'impronta SHA-256 diversa (${hash}): l'AdE potrebbe aver pubblicato una nuova edizione e le coordinate non corrispondere più alle caselle. Ricalibrare le coordinate e aggiornare l'impronta nel registro fonti.`);
  }
  return buf;
}
