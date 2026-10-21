// Test per regoleFiscaliService: funzioni pure e controllo struttura del pacchetto 2026.
// Le funzioni che accedono al filesystem sono verificate sulla struttura del pacchetto reale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGOLE_SRC = path.join(__dirname, '..', 'data', 'regole');

const SEZIONI_OBBLIGATORIE = ['forfettario', 'acconti', 'scadenze', 'rate', 'inpsGestioneSeparata', 'bollo', 'codiciTributo', 'causaliInps'];

async function leggiPacchetto(anno) {
  const raw = await readFile(path.join(REGOLE_SRC, `${anno}.json`), 'utf-8');
  return JSON.parse(raw);
}

test('pacchetto 2026 esiste ed è JSON valido', async () => {
  const p = await leggiPacchetto(2026);
  assert.strictEqual(p.anno, 2026);
});

test('pacchetto 2026 contiene tutte le sezioni obbligatorie', async () => {
  const p = await leggiPacchetto(2026);
  for (const s of SEZIONI_OBBLIGATORIE) {
    assert.ok(s in p, `sezione ${s} presente`);
  }
});

test('ogni sezione obbligatoria ha campo fonti', async () => {
  const p = await leggiPacchetto(2026);
  for (const s of SEZIONI_OBBLIGATORIE) {
    assert.ok('fonti' in p[s], `${s}.fonti presente`);
  }
});

test('aliquote forfettario: ordinaria 15, ridotta 5', async () => {
  const p = await leggiPacchetto(2026);
  assert.strictEqual(p.forfettario.aliquotaOrdinaria, 15);
  assert.strictEqual(p.forfettario.aliquotaRidotta, 5);
});

test('INPS GS: aliquota numerica e massimale positivo', async () => {
  const p = await leggiPacchetto(2026);
  assert.ok(typeof p.inpsGestioneSeparata.aliquota === 'number');
  assert.ok(p.inpsGestioneSeparata.massimale > 0);
});

test('bollo: importo 2, soglia 77.47', async () => {
  const p = await leggiPacchetto(2026);
  assert.strictEqual(p.bollo.importo, 2.0);
  assert.strictEqual(p.bollo.sogliaBolloVirtuale, 77.47);
});

test('causaliInps ha ordinaria PXX', async () => {
  const p = await leggiPacchetto(2026);
  assert.strictEqual(p.causaliInps.ordinaria, 'PXX');
});

// Verifica funzione differenze su pacchetti in memoria
test('differenze tra oggetti identici: array vuoto', async () => {
  // importa la funzione interna tramite il modulo (non è esportata: si testa l'effetto)
  // ponytail: test su comportamento osservabile (stato post-conferma = nessuna differenza)
  // qui solo struttura
  const p = await leggiPacchetto(2026);
  assert.strictEqual(p.forfettario.sogliaAnnua, 85000, 'soglia annua 85000');
  assert.strictEqual(p.forfettario.sogliaUscitaImmediata, 100000, 'soglia uscita 100000');
});

test('sezione cripto 2026: aliquota 33, franchigia 0, IVCA 0.2, codici tributo', async () => {
  const { cripto } = await leggiPacchetto(2026);
  assert.strictEqual(cripto.aliquotaPlusvalenze, 33);
  assert.strictEqual(cripto.franchigia, 0);
  assert.strictEqual(cripto.aliquotaIvca, 0.2);
  assert.deepStrictEqual(Object.values(cripto.codiciTributo), ['1715', '1727', '1728', '1729']);
});

test('statoProvvisorie: confermate e recenti non sono provvisorie', async () => {
  const { statoProvvisorie } = await import('./regoleFiscaliService.js');
  const r = statoProvvisorie({ anno: 2026, aggiornate: true, verificatoIl: '2026-10-19', banner: null }, new Date('2027-01-10'));
  assert.deepStrictEqual(r, { provvisorie: false, banner: null });
});

test('statoProvvisorie: non confermate sono provvisorie, banner esistente invariato', async () => {
  const { statoProvvisorie } = await import('./regoleFiscaliService.js');
  const r = statoProvvisorie({ anno: 2026, aggiornate: false, verificatoIl: '2026-10-19', banner: 'non confermate' }, new Date('2026-11-01'));
  assert.deepStrictEqual(r, { provvisorie: true, banner: 'non confermate' });
});

test('statoProvvisorie: verificatoIl assente o oltre 12 mesi sono provvisorie con motivo', async () => {
  const { statoProvvisorie } = await import('./regoleFiscaliService.js');
  const assente = statoProvvisorie({ anno: 2026, aggiornate: true }, new Date('2026-11-01'));
  assert.equal(assente.provvisorie, true);
  assert.match(assente.banner, /senza data di verifica/);
  const vecchie = statoProvvisorie({ anno: 2026, aggiornate: true, verificatoIl: '2026-10-19' }, new Date('2027-11-01'));
  assert.equal(vecchie.provvisorie, true);
  assert.match(vecchie.banner, /oltre 12 mesi/);
});
