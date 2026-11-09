// Migrazione guidata per chi ha già l'archivio nella vecchia posizione `<client>/FogliFatture`.
// Dropbox e OneDrive: stessa cartella del client, un livello sotto (`Apps/FogliFatture`, quella che vede l'app mobile).
// Google Drive: la migrazione passa dal login e dall'API (cloudSyncService), qui si riconosce soltanto la situazione.
// Nulla parte da solo: l'aggiornamento non tocca i dati, lo spostamento avviene solo su conferma dell'utente.
import path from 'node:path';
import * as fsSync from 'node:fs';
import { DATA_DIR, readJson, writeJson } from '../lib/jsonStore.js';
import { relativizzaPercorsoSdi } from '../lib/percorsoSdi.js';
import { vecchiaPosizione, statoSottocartella, sottocartellaDi } from '../lib/cartelleCloudLocali.js';
import { spostaPercorsoDati, apriArchivioEsistente } from './configService.js';

export const dipendenze = { vecchiaPosizione, percorsoDati: () => DATA_DIR };

// null se non c'è nulla da migrare. Per Dropbox e OneDrive riporta anche la nuova cartella e il suo stato.
export function situazioneMigrazione() {
  const v = dipendenze.vecchiaPosizione(dipendenze.percorsoDati());
  if (!v) return null;
  if (v.provider === 'google') return { provider: v.provider, nome: v.nome, vecchio: v.vecchio };
  const nuovo = path.join(v.radice, sottocartellaDi(v.radice));
  return { provider: v.provider, nome: v.nome, vecchio: v.vecchio, nuovo, statoNuovo: statoSottocartella(fsSync, nuovo) };
}

// 'sposta': i dati si muovono nella nuova cartella (la vecchia, svuotata, sparisce: resta una sola posizione).
// 'apri': nella nuova cartella c'è già un archivio (creato dal mobile): si collega quello, la vecchia resta intatta.
// Mai una fusione di due archivi.
export async function migraClient(azione) {
  const s = situazioneMigrazione();
  if (!s || s.provider === 'google') throw new Error('Niente da migrare per questo archivio');
  if (azione !== 'sposta' && azione !== 'apri') throw new Error('Azione non valida');
  if (s.statoNuovo === 'estranea') throw new Error(`La cartella ${s.nuovo} contiene file che non sono un archivio: svuotala e riprova`);
  if (azione === 'apri') {
    if (s.statoNuovo !== 'archivio') throw new Error('Nella nuova cartella non c\'è nessun archivio da aprire');
    return { percorso: await apriArchivioEsistente(s.nuovo) };
  }
  if (s.statoNuovo === 'archivio') throw new Error('Nella nuova cartella c\'è già un archivio: aprilo invece di spostare i dati');
  // Un percorso assoluto delle ricevute SDI dentro la vecchia cartella diventa relativo, così non punta a una cartella eliminata.
  const config = await readJson('config.json', null);
  const sdi = config?.sdi;
  if (sdi?.percorsoArchivio) {
    const relativo = relativizzaPercorsoSdi(sdi.percorsoArchivio, DATA_DIR);
    if (relativo !== sdi.percorsoArchivio) await writeJson('config.json', { ...config, sdi: { ...sdi, percorsoArchivio: relativo } });
  }
  return { percorso: await spostaPercorsoDati(s.nuovo) };
}
