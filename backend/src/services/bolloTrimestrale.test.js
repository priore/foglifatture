// node --test — funzioni pure di bolloTrimestrale.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bolloPerTrimestre, applicaRinviBollo } from './bolloTrimestrale.js';

const fatture2026 = [
  { anno: 2026, mese: 1, bolloApplicabile: true,  bollo: 2 },
  { anno: 2026, mese: 2, bolloApplicabile: true,  bollo: 2 },
  { anno: 2026, mese: 3, bolloApplicabile: false, bollo: 0 },   // sotto soglia
  { anno: 2026, mese: 4, bolloApplicabile: true,  bollo: 2 },
  { anno: 2026, mese: 7, bolloApplicabile: true,  bollo: 2 },
  { anno: 2026, mese: 10, bolloApplicabile: true, bollo: 2 },
  { anno: 2025, mese: 12, bolloApplicabile: true, bollo: 2 },   // anno diverso: esclusa
];

describe('bolloPerTrimestre', () => {
  it('somma bollo per trimestre, esclude altri anni', () => {
    const [q1, q2, q3, q4] = bolloPerTrimestre(2026, fatture2026);
    assert.equal(q1, 4);   // gen(2) + feb(2)
    assert.equal(q2, 2);   // apr(2)
    assert.equal(q3, 2);   // lug(2)
    assert.equal(q4, 2);   // ott(2)
  });

  it('esclude fatture senza bolloApplicabile', () => {
    const [q1] = bolloPerTrimestre(2026, fatture2026);
    // mar non ha bollo, gen+feb = 4
    assert.equal(q1, 4);
  });
});

describe('applicaRinviBollo', () => {
  const SOGLIA = 5000;

  it('Q1 ≤ soglia ma Q1+Q2 > soglia → rinvia solo Q1 al Q2', () => {
    // Q1=100≤5000 → fonde in Q2; poi Q1+Q2=100+5000=5100 > 5000 → nessun ulteriore rinvio
    const [r1, r2, r3, r4] = applicaRinviBollo([100, 5000, 2, 2], SOGLIA);
    assert.equal(r1, 0);
    assert.equal(r2, 5100); // 100+5000
    assert.equal(r3, 2);
    assert.equal(r4, 2);
  });

  it('Q1+Q2 ≤ soglia → rinvia tutto al Q3', () => {
    const [r1, r2, r3, r4] = applicaRinviBollo([4, 6, 2, 2], 20);
    assert.equal(r1, 0);
    assert.equal(r2, 0);
    assert.equal(r3, 12); // 4+6+2
    assert.equal(r4, 2);
  });

  it('Q1 > soglia → nessun rinvio', () => {
    const [r1, r2, r3, r4] = applicaRinviBollo([6000, 200, 100, 50], SOGLIA);
    assert.equal(r1, 6000);
    assert.equal(r2, 200);
    assert.equal(r3, 100);
    assert.equal(r4, 50);
  });

  it('tutti zero → tutti zero', () => {
    const r = applicaRinviBollo([0, 0, 0, 0], SOGLIA);
    assert.deepEqual(r, [0, 0, 0, 0]);
  });
});
