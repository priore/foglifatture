// Registro delle fonti normative archiviate con citazione verificata (FP-019).
// Ogni fonte ha un testo estratto in src/data/fonti/testi/<id>.txt.
// La funzione `estratto` restituisce il brano del testo archiviato con
// la citazione evidenziata, usata dalla UI di "Regole fiscali".
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FONTI_DIR = path.join(import.meta.dirname, '..', 'data', 'fonti');
const REGISTRO_FILE = path.join(FONTI_DIR, 'registro.json');

let _registro = null;

export async function registro() {
  if (!_registro) {
    const raw = await readFile(REGISTRO_FILE, 'utf-8');
    _registro = JSON.parse(raw);
  }
  return _registro;
}

export function normalizzaPerCitazione(s) {
  s = s.toLowerCase();
  // apostrofi e virgolette tipografiche → standard
  s = s.replace(/[‘’‛]/g, "'");
  s = s.replace(/[«»“”]/g, '"');
  // sillabazioni a fine riga (pdftotext)
  s = s.replace(/-\n/g, '');
  // spazi bianchi → spazio singolo
  s = s.replace(/[\n\r\t]/g, ' ').replace(/ {2,}/g, ' ');
  // marcatori Normattiva (( )) — rimuove solo i marker, mantiene il testo dentro
  s = s.replace(/\(\(/g, '').replace(/\)\)/g, '');
  return s.trim();
}

// Divide una citazione con "..." o "…" in frammenti.
function frammenti(citazione) {
  return citazione.split(/\.{2,}|…/).map(f => f.trim()).filter(Boolean);
}

// Legge il testo archiviato per un id. Restituisce null se mancante.
async function leggiTesto(id) {
  const voce = (await registro()).find(r => r.id === id);
  if (!voce?.file) return null;
  try {
    return await readFile(path.join(FONTI_DIR, voce.file), 'utf-8');
  } catch {
    return null;
  }
}

// Verifica che ogni frammento della citazione sia presente nel testo archiviato.
// Ritorna { trovata: bool, frammmentiMancanti: string[] }
export async function verificaCitazione(id, citazione) {
  const testo = await leggiTesto(id);
  if (!testo) return { trovata: false, frammmentiMancanti: [citazione], motivazione: 'testo non archiviato' };
  const testoNorm = normalizzaPerCitazione(testo);
  const parti = frammenti(normalizzaPerCitazione(citazione));
  const mancanti = parti.filter(p => !testoNorm.includes(p));
  return { trovata: mancanti.length === 0, frammmentiMancanti: mancanti };
}

// Restituisce un brano del testo archiviato (±200 car) con la citazione in evidenza.
// Usato dalla UI per mostrare il contesto della citazione.
// Ritorna { testo, inizio, fine } dove inizio/fine sono indici nel brano per l'highlight.
export async function estratto(id, citazione) {
  const testo = await leggiTesto(id);
  if (!testo) return null;
  const testoNorm = normalizzaPerCitazione(testo);
  const parti = frammenti(normalizzaPerCitazione(citazione));
  if (!parti.length) return null;

  // Trova il primo frammento
  const idx = testoNorm.indexOf(parti[0]);
  if (idx < 0) return null;

  // Trova l'ultimo frammento per calcolare la fine
  const ultimaFrase = parti[parti.length - 1];
  const idxUltimo = testoNorm.lastIndexOf(ultimaFrase, idx + 1000);
  const fine = idxUltimo >= 0 ? idxUltimo + ultimaFrase.length : idx + parti[0].length;

  // Mappa indice nella stringa normalizzata → indice nel testo originale.
  // normalizzaPerCitazione comprime whitespace e rimuove (( )) — le lunghezze divergono.
  // Ricostruiamo la mappa carattere per carattere per allineare i due cursori.
  function normToOrig(normIdx) {
    let n = 0, o = 0;
    const orig = testo;
    while (o < orig.length && n < normIdx) {
      const ch = orig[o];
      // sillabazione -\n viene rimossa (2 char orig → 0 char norm)
      if (ch === '-' && orig[o + 1] === '\n') { o += 2; continue; }
      // (( e )) vengono rimossi (2 char orig → 0 char norm)
      if (ch === '(' && orig[o + 1] === '(') { o += 2; continue; }
      if (ch === ')' && orig[o + 1] === ')') { o += 2; continue; }
      // whitespace multiplo: norm ha 1 spazio, orig può averne N
      if (/[\n\r\t ]/.test(ch)) {
        let cnt = 0;
        while (o < orig.length && /[\n\r\t ]/.test(orig[o])) { o++; cnt++; }
        n++; // 1 spazio norm
        continue;
      }
      n++; o++;
    }
    return o;
  }

  const origIdx = normToOrig(idx);
  const origFine = normToOrig(fine);

  const CONTESTO = 200;
  const start = Math.max(0, origIdx - CONTESTO);
  const end = Math.min(testo.length, origFine + CONTESTO);
  const brano = testo.slice(start, end);

  return {
    brano,
    highlightInizio: origIdx - start,
    highlightFine: origFine - start,
  };
}

// Voce del registro per un id.
export async function voceRegistro(id) {
  return (await registro()).find(r => r.id === id) ?? null;
}
