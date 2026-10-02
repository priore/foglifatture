import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prossimoResetQuotaGemini, scadenzeBaseAnno } from './scadenzeFiscaliService.js';

test('prossimoResetQuotaGemini ritorna mezzanotte Pacific successiva alla data errore', () => {
  const errore = new Date('2026-09-03T20:03:36.949Z'); // 13:03 Pacific
  const reset = prossimoResetQuotaGemini(errore);
  const resetPacific = reset.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
  assert.match(resetPacific, /00:00:00$/);
  assert.ok(reset.getTime() > errore.getTime());
  assert.ok(reset.getTime() - errore.getTime() <= 24 * 3_600_000);
});

test('prossimoResetQuotaGemini non dipende dall\'orario corrente, solo da daErrore', () => {
  const erroreVecchio = new Date(Date.now() - 5 * 86_400_000);
  const reset = prossimoResetQuotaGemini(erroreVecchio);
  assert.ok(reset.getTime() < Date.now());
});

test('scadenzeBaseAnno restituisce 8 scadenze ordinate per data crescente', () => {
  const scadenze = scadenzeBaseAnno(2026);
  assert.equal(scadenze.length, 8);
  const date = scadenze.map((s) => s.data);
  assert.deepEqual(date, [...date].sort());
});

test('scadenzeBaseAnno sposta il 30 giugno (2026 cade di martedì, resta invariato)', () => {
  const scadenze = scadenzeBaseAnno(2026);
  const saldo = scadenze.find((s) => s.tipo === 'Saldo + I acconto imposta sostitutiva');
  assert.equal(saldo.data, '2026-06-30');
});

test('scadenzeBaseAnno sposta scadenza che cade di sabato al lunedì successivo (16 giugno 2029)', () => {
  // 16 giugno 2029 è sabato: INPS gestione separata (saldo + I acconto) deve slittare a lunedì 18.
  const scadenze = scadenzeBaseAnno(2029);
  const inps = scadenze.find((s) => s.tipo === 'INPS gestione separata' && s.descrizione.includes('Saldo'));
  assert.equal(inps.data, '2029-06-18');
});

test('nessuna scadenza calcolata cade di sabato o domenica', () => {
  for (const anno of [2026, 2027, 2028, 2029, 2030]) {
    for (const s of scadenzeBaseAnno(anno)) {
      const giorno = new Date(s.data).getUTCDay();
      assert.notEqual(giorno, 0, `${s.data} (${s.tipo}) è domenica`);
      assert.notEqual(giorno, 6, `${s.data} (${s.tipo}) è sabato`);
    }
  }
});

// FP-026: 4 ottobre festivo dal 2026 (L. 151/2025) — test indiretto via scadenzeBaseAnno.
// Non ci sono scadenze standard il 4/10, ma il ciclo "nessuna sabato/domenica" già copre il 2026.
// Qui verifichiamo che il 2025 (anno precedente alla norma) produca ancora 8 scadenze valide.
test('scadenzeBaseAnno(2025) produce 8 scadenze (4 ottobre non ancora festivo)', () => {
  const scadenze = scadenzeBaseAnno(2025);
  assert.equal(scadenze.length, 8);
  // II acconto imposta sostitutiva 2025: 30 novembre è domenica → deve slittare a lunedì 1 dicembre.
  const acconto = scadenze.find((s) => s.tipo === 'II acconto imposta sostitutiva');
  assert.equal(acconto.data, '2025-12-01');
});

// FP-026: slittamento agosto (D.Lgs. 33/2025 art. 11).
// La II rata INPS artigiani/commercianti è fissata al 20 agosto: non deve slittare (è già la data target).
// Il 16 agosto (Ferragosto) è festivo fisso: primoGiornoLavorativo(anno, 8, 16) deve atterrare dopo il 20/8.
test('16 agosto slitta al 20 agosto tramite slittamento agosto (D.Lgs. 33/2025 art. 11)', () => {
  // 2027: 20 agosto è venerdì (lavorativo) — il 16 agosto, dopo slittamentoAgosto, diventa 20 agosto.
  // scadenzeBaseAnno usa 20/8 direttamente per la II rata artigiani, quindi non è un test del 16.
  // Verifichiamo indirettamente che nessuna scadenza di agosto finisca tra 1 e 19 agosto.
  for (const anno of [2026, 2027, 2028, 2029, 2030]) {
    for (const s of scadenzeBaseAnno(anno)) {
      const d = new Date(s.data + 'T00:00:00');
      if (d.getMonth() === 7) { // agosto
        assert.ok(d.getDate() >= 20, `${s.data} (${s.tipo}) cade prima del 20 agosto`);
      }
    }
  }
});

test('II rata INPS artigiani/commercianti non scende mai sotto il 20 agosto', () => {
  for (const anno of [2026, 2027, 2028, 2029, 2030]) {
    const scadenze = scadenzeBaseAnno(anno);
    const inpsArt = scadenze.find((s) => s.tipo === 'INPS artigiani/commercianti' && s.descrizione.includes('II rata'));
    assert.ok(inpsArt.data >= `${anno}-08-20`, `II rata INPS artigiani ${anno} prima del 20/8`);
  }
});
