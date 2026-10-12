import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rateizzaScadenza, applicaMaggiorazioneRighe, maxRateConsentite } from './stimaVersamentiService.js';

const regole = {
  codiciTributo: { interessiRateazione: '1668' },
  causaliInps: {
    ordinaria: 'PXX',
    aliquotaRidotta: 'P10',
    rateazioneOrdinaria: 'PXXR',
    rateazioneRidotta: 'P10R',
    interessi: 'DPPI',
  },
};

const config = { forfettario: { altraCoperturaPrevidenziale: false } };
const configRidotta = { forfettario: { altraCoperturaPrevidenziale: true } };

const scadenzaBase = {
  data: '2026-06-30',
  righe: [
    { sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 600, descrizione: 'Saldo imposta' },
    { sezione: 'inps', codice: 'PXX', annoRiferimento: 2025, importo: 300, descrizione: 'Saldo INPS' },
  ],
  totale: 900,
  totaleConMaggiorazione: 903.6,
};

describe('rateizzaScadenza', () => {
  it('n=1 restituisce la scadenza invariata', () => {
    const result = rateizzaScadenza(scadenzaBase, 1, regole, config);
    assert.equal(result.length, 1);
    assert.equal(result[0], scadenzaBase);
  });

  it('n=3 produce 3 rate', () => {
    const result = rateizzaScadenza(scadenzaBase, 3, regole, config);
    assert.equal(result.length, 3);
  });

  it('rate INPS usano causale PXXR (non PXX)', () => {
    const result = rateizzaScadenza(scadenzaBase, 3, regole, config);
    const righeInps = result.flatMap((s) => s.righe.filter((r) => r.sezione === 'inps' && r.codice !== 'DPPI'));
    assert.ok(righeInps.every((r) => r.codice === 'PXXR'), 'atteso PXXR');
  });

  it('rate INPS con aliquota ridotta usano P10R', () => {
    const result = rateizzaScadenza(scadenzaBase, 3, regole, configRidotta);
    const righeInps = result.flatMap((s) => s.righe.filter((r) => r.sezione === 'inps' && r.codice !== 'DPPI'));
    assert.ok(righeInps.every((r) => r.codice === 'P10R'), 'atteso P10R');
  });

  it('interessi INPS su DPPI in riga separata dalla rata 2 in poi', () => {
    // Importo INPS 30.000 per avere interessi > 1,03 €
    const scadenzaGrande = {
      ...scadenzaBase,
      righe: [
        { sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 60000, descrizione: 'Saldo imposta' },
        { sezione: 'inps', codice: 'PXX', annoRiferimento: 2025, importo: 30000, descrizione: 'Saldo INPS' },
      ],
    };
    const result = rateizzaScadenza(scadenzaGrande, 3, regole, config);
    const dppi = result.flatMap((s) => s.righe.filter((r) => r.codice === 'DPPI'));
    assert.ok(dppi.length >= 1, 'almeno una riga DPPI attesa');
  });

  it('interessi erario su 1668 in riga separata dalla rata 2 in poi', () => {
    const scadenzaGrande = {
      ...scadenzaBase,
      righe: [
        { sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 60000, descrizione: 'Saldo imposta' },
      ],
    };
    const result = rateizzaScadenza(scadenzaGrande, 3, regole, config);
    const interessi1668 = result.flatMap((s) => s.righe.filter((r) => r.codice === '1668'));
    assert.ok(interessi1668.length >= 1, 'almeno una riga 1668 attesa');
  });

  it('campo rateazione nel formato NNRR (es. "0103" = prima di 3)', () => {
    const result = rateizzaScadenza(scadenzaBase, 3, regole, config);
    const prima = result[0].righe.find((r) => r.sezione === 'erario');
    assert.equal(prima.rateazione, '0103');
  });

  it('la somma degli importi delle rate erario = totale originale', () => {
    const result = rateizzaScadenza(scadenzaBase, 3, regole, config);
    const sommEr = result.flatMap((s) => s.righe.filter((r) => r.sezione === 'erario' && r.codice !== '1668')).reduce((t, r) => t + r.importo, 0);
    assert.equal(Number(sommEr.toFixed(2)), 600);
  });

  it('tronca rate oltre 16 dicembre', () => {
    // Data base 1 novembre: con 6 rate arriverebbe a maggio dell'anno dopo
    const scadenzaNov = { ...scadenzaBase, data: '2026-11-01' };
    const result = rateizzaScadenza(scadenzaNov, 6, regole, config);
    assert.ok(result.length < 6, 'devono essere meno di 6 rate');
    assert.ok(result.at(-1).dataNominale <= '2026-12-16', 'ultima rata nominale entro 16/12');
  });

  it('30/6 con 7 rate: tutte e 7 prodotte (nessun timezone bug)', () => {
    // maxRateConsentite('2026-06-30') = 7; rateizzaScadenza deve concordare
    const sc = { ...scadenzaBase, data: '2026-06-30' };
    const result = rateizzaScadenza(sc, 7, regole, config);
    assert.equal(result.length, 7);
    assert.equal(result.at(-1).dataNominale, '2026-12-16');
  });
});

describe('maxRateConsentite (pre-req A9)', () => {
  it('30/6 → massimo 7 rate (30/6, 16/7, …, 16/12)', () => {
    assert.equal(maxRateConsentite(new Date('2026-06-30')), 7);
  });

  it('1/11 → massimo 2 rate (16/11 e 16/12)', () => {
    assert.equal(maxRateConsentite(new Date('2026-11-01')), 2);
  });

  it('16/12 → 1 sola rata (nessuna successiva ≤ 16/12)', () => {
    assert.equal(maxRateConsentite(new Date('2026-12-16')), 1);
  });
});

// Verifica formula interessi A9 sulla tabella AdE (partenza 30/6).
// DM 21/5/2009 art. 5; Istr. Redditi PF 2026 fasc. 1 "Rateazione".
describe('percentualeInteressi A9 — tabella AdE partenza 30/6', () => {
  // Esportiamo rateizzaScadenza con importo grande per estrarre gli interessi
  const scadenzaGrande = {
    data: '2026-06-30',
    righe: [{ sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 100000, descrizione: 'Saldo' }],
    totale: 100000,
    totaleConMaggiorazione: 100000,
  };

  // Formula corretta: P2 = round2(4 × gg_comm(30/6, 16/7) / 360) = round2(4×16/360) = 0.18%
  // Pk = P2 + (k-2)×0.33 → P3 = 0.51%, P4 = 0.84%, ...
  it('rata 2 (16/7): interessi = 0.18% di quota', () => {
    const result = rateizzaScadenza(scadenzaGrande, 2, regole, config);
    const quota = Number((100000 / 2).toFixed(2));
    const interessi1668 = result[1].righe.find((r) => r.codice === '1668');
    assert.equal(interessi1668.importo, Number((quota * 0.18 / 100).toFixed(2)));
  });

  it('rata 3 (16/8): interessi = (0.18 + 0.33)% = 0.51% di quota', () => {
    const result = rateizzaScadenza(scadenzaGrande, 3, regole, config);
    const quota = Number((100000 / 3).toFixed(2));
    const interessi1668 = result[2].righe.find((r) => r.codice === '1668');
    assert.equal(interessi1668.importo, Number((quota * 0.51 / 100).toFixed(2)));
  });

  it('rata 4 (16/9): interessi = 0.84% di quota (tabella AdE 30/6)', () => {
    const result = rateizzaScadenza(scadenzaGrande, 4, regole, config);
    const quota = Number((100000 / 4).toFixed(2));
    const interessi1668 = result[3].righe.find((r) => r.codice === '1668');
    assert.equal(interessi1668.importo, Number((quota * 0.84 / 100).toFixed(2)));
  });
});

describe('soglia minima 1,03 € (A10) — rateizzaScadenza', () => {
  it('interessi INPS < 1,03 € non producono riga DPPI', () => {
    // Importo piccolo: interessi su 10 € × 0.18% ≈ 0,02 € → sotto soglia
    const piccola = {
      data: '2026-06-30',
      righe: [{ sezione: 'inps', codice: 'PXX', annoRiferimento: 2025, importo: 10, descrizione: 'Saldo INPS' }],
      totale: 10,
      totaleConMaggiorazione: 10,
    };
    const result = rateizzaScadenza(piccola, 2, regole, config);
    const dppi = result.flatMap((s) => s.righe.filter((r) => r.codice === 'DPPI'));
    assert.equal(dppi.length, 0, 'nessun DPPI sotto soglia minima');
  });

  it('interessi erario < 1,03 € non producono riga 1668', () => {
    const piccola = {
      data: '2026-06-30',
      righe: [{ sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 10, descrizione: 'Saldo' }],
      totale: 10,
      totaleConMaggiorazione: 10,
    };
    const result = rateizzaScadenza(piccola, 2, regole, config);
    const r1668 = result.flatMap((s) => s.righe.filter((r) => r.codice === '1668'));
    assert.equal(r1668.length, 0, 'nessuna riga 1668 sotto soglia minima');
  });
});

describe('applicaMaggiorazioneRighe (pre-req A4)', () => {
  const righe = [
    { sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 1000, descrizione: 'Saldo' },
    { sezione: 'inps', codice: 'PXX', annoRiferimento: 2025, importo: 500, descrizione: 'Saldo INPS' },
  ];

  it('erario: importo aumenta della maggiorazione, campo maggiorazione aggiunto', () => {
    const result = applicaMaggiorazioneRighe(righe, 0.40);
    const erario = result.find((r) => r.sezione === 'erario' && r.codice === '1792');
    assert.equal(erario.importo, 1004); // 1000 + 0.40%
    assert.equal(erario.maggiorazione, 4);
  });

  it('erario: codice tributo invariato (non riga separata)', () => {
    const result = applicaMaggiorazioneRighe(righe, 0.40);
    const codici = result.filter((r) => r.sezione === 'erario').map((r) => r.codice);
    assert.deepEqual(codici, ['1792']); // nessuna riga extra erario
  });

  it('inps: riga PXX invariata', () => {
    const result = applicaMaggiorazioneRighe(righe, 0.40);
    const pxx = result.find((r) => r.codice === 'PXX');
    assert.equal(pxx.importo, 500); // invariato
  });

  it('inps: riga DPPI aggiunta con importo = 0.40% di 500', () => {
    const result = applicaMaggiorazioneRighe(righe, 0.40);
    const dppi = result.find((r) => r.codice === 'DPPI');
    assert.ok(dppi, 'riga DPPI attesa');
    assert.equal(dppi.importo, 2); // 500 × 0.40% = 2.00
    assert.equal(dppi.sezione, 'inps');
  });

  it('inps: nessun DPPI se maggiorazione < 1,03 € (soglia minima A10)', () => {
    const piccola = [{ sezione: 'inps', codice: 'PXX', annoRiferimento: 2025, importo: 100 }];
    const result = applicaMaggiorazioneRighe(piccola, 0.40);
    // 100 × 0.40% = 0.40 < 1.03 → nessun DPPI
    assert.equal(result.find((r) => r.codice === 'DPPI'), undefined);
  });
});
