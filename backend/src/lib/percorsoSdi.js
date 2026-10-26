// Cartella delle ricevute SDI: su disco (config.json) è relativa alla cartella dati, così lo stesso archivio
// funziona su ogni dispositivo. Un percorso assoluto fuori dalla cartella dati (per esempio una cartella
// Dropbox scelta a mano sul desktop) resta valido com'è.
import path from 'node:path';

const dentro = (assoluto, dataDir) => {
  const rel = path.relative(dataDir, assoluto);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Valore da scrivere su disco: un assoluto dentro la cartella dati diventa relativo (migrazione silenziosa).
export function relativizzaPercorsoSdi(valore, dataDir) {
  if (!valore || !path.isAbsolute(valore)) return valore || '';
  return dentro(valore, dataDir) ? path.relative(dataDir, valore) : valore;
}

// Percorso reale da usare. `predefinito` (solo ambienti embedded, dove una cartella scelta a mano su un altro
// dispositivo non esiste) sostituisce il vuoto e gli assoluti fuori dalla cartella dati.
export function risolviPercorsoSdi(valore, dataDir, predefinito = '') {
  if (valore && !path.isAbsolute(valore)) return path.join(dataDir, valore);
  if (valore && !predefinito) return valore;
  if (valore && dentro(valore, dataDir)) return valore;
  return predefinito ? path.join(dataDir, predefinito) : '';
}
