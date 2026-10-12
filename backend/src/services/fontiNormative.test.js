import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizzaPerCitazione, verificaCitazione, registro } from './fontiNormativeService.js';

const REGOLE_FILE = path.join(import.meta.dirname, '..', 'data', 'regole', '2026.json');
const FONTI_DIR = path.join(import.meta.dirname, '..', 'data', 'fonti');

function raccogliFonti(obj, risultati = []) {
  if (!obj || typeof obj !== 'object') return risultati;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'fonti') {
      for (const [fk, fv] of Object.entries(v)) {
        if (fv && fv.id && fv.citazione) {
          risultati.push({ id: fv.id, campo: fk, citazione: fv.citazione });
        }
      }
    } else {
      raccogliFonti(v, risultati);
    }
  }
  return risultati;
}

describe('Registro fonti normative', async () => {
  const regole = JSON.parse(await readFile(REGOLE_FILE, 'utf-8'));
  const reg = await registro();
  const tuttiId = new Set(reg.map(r => r.id));
  const fonti = raccogliFonti(regole);

  test('Ogni id di fonti in 2026.json esiste nel registro', () => {
    const mancanti = fonti
      .map(f => f.id)
      .filter(id => !tuttiId.has(id));
    const unici = [...new Set(mancanti)];
    assert.deepEqual(unici, [], `ID non nel registro: ${unici.join(', ')}`);
  });

  test('Ogni file nel registro esiste', async () => {
    const mancanti = [];
    for (const voce of reg) {
      if (!voce.file) continue;
      try {
        await readFile(path.join(FONTI_DIR, voce.file));
      } catch {
        mancanti.push(voce.id);
      }
    }
    assert.deepEqual(mancanti, [], `File mancanti per: ${mancanti.join(', ')}`);
  });

  test('Ogni citazione (con testo archiviato) è trovata nel testo', async () => {
    const errori = [];
    for (const { id, campo, citazione } of fonti) {
      const { trovata, motivazione } = await verificaCitazione(id, citazione);
      if (!trovata && motivazione !== 'testo non archiviato') {
        errori.push(`${id}/${campo}: "${citazione.slice(0, 80)}..."`);
      }
    }
    assert.deepEqual(errori, [], `Citazioni non trovate nel testo archiviato:\n  ${errori.join('\n  ')}`);
  });
});

describe('normalizzaPerCitazione', () => {
  test('Normalizza accenti e spazi', () => {
    const s = normalizzaPerCitazione('l’importo   non\nè  dovuto');
    assert.equal(s, "l'importo non è dovuto");
  });

  test('Rimuove solo marcatori Normattiva (( )), mantiene testo interno', () => {
    const s = normalizzaPerCitazione('testo ((nota)) fine');
    assert.equal(s, 'testo nota fine');
  });

  test('Gestisce sillabazione pdftotext', () => {
    const s = normalizzaPerCitazione('versamen-\nto rateale');
    assert.equal(s, 'versamento rateale');
  });
});
