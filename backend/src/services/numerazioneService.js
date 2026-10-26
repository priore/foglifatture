// Registro di numerazione: file unico `numerazione.json` alla radice dell'archivio (fuori da
// invoices/, dove un file di servizio sarebbe scartato in silenzio). Ogni emissione lo
// aggiorna, così due dispositivi che emettono per clienti diversi (file diversi, nessun
// conflitto del provider) si scontrano comunque sullo stesso file.
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson } from '../lib/jsonStore.js';
import { ConflittoRev } from '../lib/cloudProviders.js';
import { remotoPerNumerazione } from '../lib/cloudHook.js';

export const FILE_REGISTRO = 'numerazione';
const REGISTRO_VUOTO = { ultimoNumero: 0, numeri: {} };

// Identificatore del dispositivo: dato locale, FUORI dall'archivio condiviso e non versionato
// (.gitignore), generato al primo uso come il puntatore al percorso dati. Gli ambienti embedded girano
// senza file locali scrivibili: l'host fornisce l'id con `globalThis.__idDispositivo`.
let idCache = null;
async function idDispositivo() {
  if (globalThis.__idDispositivo) return globalThis.__idDispositivo();
  if (idCache) return idCache;
  const file = process.env.FOGLIFATTURE_ID_DISPOSITIVO
    || path.join(import.meta.dirname, '..', '..', '.id-dispositivo.json');
  try {
    idCache = JSON.parse(await readFile(file, 'utf-8')).id;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (!idCache) {
    idCache = randomUUID();
    await writeFile(file, JSON.stringify({ id: idCache }, null, 2), 'utf-8');
  }
  return idCache;
}

// Solo per i test: l'id si rilegge dal file indicato dall'ambiente.
export function azzeraIdDispositivo() { idCache = null; }

export async function leggiRegistro() {
  return normalizza(await readJson(`${FILE_REGISTRO}.json`, null));
}

// Le registrazioni dello stesso processo si serializzano: leggi-modifica-scrivi non è atomico.
let coda = Promise.resolve();

const normalizza = (registro) => ({ ...REGISTRO_VUOTO, ...registro, numeri: registro?.numeri ?? {} });

// Aggiunge il numero al registro in memoria. Lo stesso numero per lo stesso documento (rigenerazione) è
// idempotente (false: niente da scrivere); per un documento diverso è un errore e il numero non si riusa mai.
async function prenota(registro, numero, { anno, mese, clienteId, nota, riassegna = false }) {
  const chiave = String(numero);
  const presente = registro.numeri[chiave];
  if (presente) {
    if (presente.anno === anno && presente.mese === mese && presente.clienteId === clienteId && Boolean(presente.nota) === nota) return false;
    if (!riassegna) throw new Error(`Numero fattura ${chiave} già prenotato per ${presente.anno}-${String(presente.mese).padStart(2, '0')} (altro documento o altro dispositivo)`);
  }
  registro.numeri[chiave] = {
    anno, mese, clienteId, ...(nota ? { nota: true } : {}),
    idDispositivo: await idDispositivo(), data: new Date().toISOString(),
  };
  registro.ultimoNumero = Math.max(registro.ultimoNumero, Number(numero));
  return true;
}

// Con un archivio cloud il registro si aggiorna direttamente sul provider, con la precondizione sulla rev letta:
// se un altro dispositivo ha scritto nel frattempo, si rilegge e si riprova (il numero preso da altri non si riusa).
async function aggiornaSulProvider(remoto, modifica) {
  const file = `${FILE_REGISTRO}.json`;
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const letto = await remoto.leggi(file);
    const registro = normalizza(letto ? JSON.parse(letto.dati.toString('utf-8')) : null);
    if (!await modifica(registro)) return;
    const dati = Buffer.from(JSON.stringify(registro, null, 2), 'utf-8');
    try {
      const rev = await remoto.scrivi(file, dati, { rev: letto ? letto.rev : null });
      await remoto.registraLocale(file, dati, rev);
      return;
    } catch (err) {
      if (!(err instanceof ConflittoRev)) throw err;
    }
  }
  throw new Error('Registro di numerazione in conflitto con un altro dispositivo, riprova');
}

// Legge il registro (dal provider se c'è un archivio cloud), applica `modifica` e lo riscrive se ha cambiato qualcosa.
function aggiornaRegistro(modifica) {
  const esegui = async () => {
    const remoto = await remotoPerNumerazione();
    if (remoto) return aggiornaSulProvider(remoto, modifica);
    const registro = await leggiRegistro();
    if (await modifica(registro)) await writeJson(`${FILE_REGISTRO}.json`, registro);
  };
  const risultato = coda.then(esegui);
  coda = risultato.catch(() => {});
  return risultato;
}

// Prenota `numero` per il documento indicato PRIMA di scrivere la fattura.
// `riassegna`: solo per la riparazione dei doppioni, sposta la prenotazione sul documento che tiene il numero.
export function registraNumero(numero, { anno, mese, clienteId, nota = false, riassegna = false }) {
  const meta = { anno, mese, clienteId, nota, riassegna };
  return aggiornaRegistro((registro) => prenota(registro, numero, meta));
}

// Libera le prenotazioni in coda senza documento (emissione fallita, o numero perso in una riparazione): più alte
// dell'ultimo documento esistente e più vecchie di `etaMinimaMs`, così non tocca un'emissione in corso su un altro
// dispositivo. I buchi in mezzo restano: un numero non si riassegna a un documento con data successiva.
export function liberaPrenotazioniOrfane(numeriEsistenti, etaMinimaMs = 10 * 60 * 1000) {
  const esistenti = new Set(numeriEsistenti);
  const massimo = Math.max(0, ...esistenti);
  return aggiornaRegistro((registro) => {
    const orfane = Object.entries(registro.numeri)
      .filter(([k, v]) => Number(k) > massimo && Date.now() - Date.parse(v.data) > etaMinimaMs)
      .map(([k]) => k);
    for (const k of orfane) delete registro.numeri[k];
    if (orfane.length) registro.ultimoNumero = Math.max(massimo, ...Object.keys(registro.numeri).map(Number));
    return orfane.length > 0;
  });
}
