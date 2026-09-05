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
