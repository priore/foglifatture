// Pacchetti di regole fiscali scaricati (ambienti embedded, senza una nuova versione dell'app): un indice pubblico elenca
// i pacchetti con il loro SHA-256; si salva solo ciò che corrisponde. Il pacchetto è un dato, non codice, e non si
// attiva da solo: finisce in regole-scaricate/<anno>.json e l'utente lo conferma col flusso esistente
// (regoleFiscaliService.leggiPacchettoVersionato lo preferisce all'incluso se più recente).
import { createHash } from 'node:crypto';
import { readJson, writeJson } from '../lib/jsonStore.js';
import { logger } from '../lib/logger.js';
import { notifica } from '../lib/notifier.js';
import { validaPacchetto } from './regoleFiscaliService.js';

// Asset di una release del repository pubblico: `latest/download` segue sempre l'ultima.
export const INDICE_URL = 'https://github.com/priore/foglifatture/releases/latest/download/regole-indice.json';
const STATO = 'regole-scaricate-stato.json';
const OGNI_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 15_000;

async function scarica(fetchFn, url) {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`Risposta troppo grande (${buf.length} byte)`);
  return buf;
}

// Un giro: al massimo una volta al giorno (`forza` lo salta). Restituisce { saltato } oppure
// { scaricati: [anno], rifiutati: [{ anno, motivo }], nessunIndice }. Un errore di rete lancia, dopo aver
// registrato il tentativo: si riprova al giorno dopo, non a ogni giro dei lavori.
export async function controllaPacchettiRegole({ fetchFn = (...a) => fetch(...a), url = INDICE_URL, adesso = Date.now(), forza = false } = {}) {
  const stato = (await readJson(STATO)) ?? {};
  if (!forza && stato.ultimoControllo && adesso - new Date(stato.ultimoControllo).getTime() < OGNI_MS) return { saltato: true };
  await writeJson(STATO, { ...stato, ultimoControllo: new Date(adesso).toISOString() });

  let indice;
  try {
    indice = JSON.parse((await scarica(fetchFn, url)).toString('utf8'));
  } catch (err) {
    if (err.status === 404) return { scaricati: [], rifiutati: [], nessunIndice: true }; // ancora nessuna release con l'indice
    throw err;
  }

  const hash = { ...(stato.hash ?? {}) };
  const scaricati = [];
  const rifiutati = [];
  for (const voce of Array.isArray(indice?.pacchetti) ? indice.pacchetti : []) {
    const anno = Number(voce?.anno);
    try {
      if (!Number.isInteger(anno) || !/^[0-9a-f]{64}$/.test(voce.sha256 ?? '') || typeof voce.url !== 'string') throw new Error('Voce dell\'indice non valida');
      if (hash[anno] === voce.sha256) continue;
      if (!voce.url.startsWith('https://')) throw new Error('Solo https');
      const buf = await scarica(fetchFn, voce.url);
      if (createHash('sha256').update(buf).digest('hex') !== voce.sha256) throw new Error('Hash non corrispondente');
      const pacchetto = JSON.parse(buf.toString('utf8'));
      if (pacchetto.anno !== anno) throw new Error('Anno del pacchetto diverso da quello dell\'indice');
      validaPacchetto(pacchetto);
      await writeJson(`regole-scaricate/${anno}.json`, pacchetto);
      hash[anno] = voce.sha256;
      scaricati.push(anno);
    } catch (err) {
      logger.warn('regoleScaricate: pacchetto rifiutato', { anno: voce?.anno, errore: err.message });
      rifiutati.push({ anno: voce?.anno ?? null, motivo: err.message });
    }
  }
  await writeJson(STATO, { ultimoControllo: new Date(adesso).toISOString(), hash });
  if (scaricati.length) notifica('Regole fiscali da confermare', 'Sono disponibili regole fiscali aggiornate — apri Impostazioni');
  return { scaricati, rifiutati };
}
