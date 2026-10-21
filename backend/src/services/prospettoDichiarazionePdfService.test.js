import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { registro } from './fontiNormativeService.js';
import { CAMPI, generaProspettoPdf } from './prospettoDichiarazionePdfService.js';
import { percorsoModelloPdf } from '../lib/modelloPdf.js';

const regole = JSON.parse(await readFile(path.join(import.meta.dirname, '..', 'data', 'regole', '2026.json'), 'utf-8'));
const decl = regole.dichiarazione;

test('il modello PDF delle regole è descritto nel registro fonti con URL e impronta', async () => {
  const voce = (await registro()).find((v) => v.id === decl.modelloPdf.id);
  assert.ok(voce?.urlDownload && /^[0-9a-f]{64}$/.test(voce.sha256Originale));
  assert.ok(decl.modelloPdf.pagineQuadroLm.length > 0);
});

test('ogni campo del PDF ha un rigo nelle regole', () => {
  const mancanti = Object.keys(CAMPI).filter((k) => !(k in decl.righi));
  assert.deepEqual(mancanti, []);
});

// Senza il modello già scaricato non si fa rete nei test.
const modello = percorsoModelloPdf(decl.modelloPdf.id);
test('genera le due pagine del quadro LM', { skip: !existsSync(modello) }, async () => {
  const pdf = await generaProspettoPdf(
    { modelloPdf: decl.modelloPdf, righe: [{ rigo: 'LM34.3', valore: 24858 }, { rigo: 'LM37.5', valore: null }] },
    { fornitore: { codiceFiscale: 'RSSMRA80A01H501U' } },
  );
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
