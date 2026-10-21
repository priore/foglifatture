import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { caricaModelloPdf, percorsoModelloPdf } from './modelloPdf.js';
import { registro } from '../services/fontiNormativeService.js';

test('modello non descritto nel registro: errore esplicito', async () => {
  await assert.rejects(caricaModelloPdf('modello-inesistente'), /non descritto nel registro/);
});

test('i modelli PDF del registro hanno URL e impronta SHA-256', async () => {
  for (const id of ['f24-ordinario', 'pf3-modello-2026']) {
    const voce = (await registro()).find((v) => v.id === id);
    assert.ok(voce?.urlDownload && /^[0-9a-f]{64}$/.test(voce.sha256Originale), id);
  }
});

// Senza il modello già scaricato non si fa rete nei test.
for (const id of ['f24-ordinario', 'pf3-modello-2026']) {
  test(`modello ${id} scaricato: l'impronta coincide col registro`, { skip: !existsSync(percorsoModelloPdf(id)) }, async () => {
    const voce = (await registro()).find((v) => v.id === id);
    const hash = createHash('sha256').update(await readFile(percorsoModelloPdf(id))).digest('hex');
    assert.equal(hash, voce.sha256Originale);
    assert.ok((await caricaModelloPdf(id)).length > 0);
  });
}
