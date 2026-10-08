// node --test — funzioni pure di f24StateService (senza I/O).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { annullabileEntro, creaVersamentiDaF24 } from './f24StateService.js';

describe('annullabileEntro', () => {
  it('3 giorni lavorativi indietro su feriale', () => {
    // 2026-06-30 (martedì): -3 lavorativi → giovedì 25
    assert.equal(annullabileEntro('2026-06-30'), '2026-06-25');
  });

  it('salta il weekend', () => {
    // 2026-07-06 (lunedì): -3 lavorativi → venerdì 03, giovedì 02, mercoledì 01
    assert.equal(annullabileEntro('2026-07-06'), '2026-07-01');
  });

  it('salta sabato + domenica consecutivi', () => {
    // 2026-06-22 (lunedì): -3 lavorativi → venerdì 19, giovedì 18, mercoledì 17
    assert.equal(annullabileEntro('2026-06-22'), '2026-06-17');
  });
});

describe('creaVersamentiDaF24', () => {
  it('tipo imposta per righe erario', () => {
    const f24 = {
      id: 'f1',
      pagatoIl: '2026-06-30',
      righe: [{ sezione: 'erario', codice: '1790', importo: 200, annoRiferimento: 2025 }],
    };
    const v = creaVersamentiDaF24(f24);
    assert.equal(v.length, 1);
    assert.equal(v[0].tipo, 'imposta');
    assert.equal(v[0].codice, '1790');
    assert.equal(v[0].annoRiferimento, 2025);
    assert.equal(v[0].origine, 'f1');
    assert.equal(v[0].data, '2026-06-30');
  });

  it('tipo INPS per righe inps', () => {
    const f24 = {
      id: 'f2',
      pagatoIl: '2026-06-30',
      righe: [{ sezione: 'inps', codice: 'PXX', importo: 150 }],
    };
    const v = creaVersamentiDaF24(f24);
    assert.equal(v[0].tipo, 'INPS');
  });

  it('include maggiorazione se presente', () => {
    const f24 = {
      id: 'f3',
      pagatoIl: '2026-07-20',
      righe: [{ sezione: 'erario', codice: '1790', importo: 202, annoRiferimento: 2025, maggiorazione: 2 }],
    };
    const v = creaVersamentiDaF24(f24);
    assert.equal(v[0].maggiorazione, 2);
  });

  it('righe vuote → array vuoto', () => {
    const f24 = { id: 'f4', pagatoIl: '2026-06-30', righe: [] };
    assert.deepEqual(creaVersamentiDaF24(f24), []);
  });
});
