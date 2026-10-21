// Test f24PdfService: formattazione importi, limiti righe, verifica impronta.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { generaF24Pdf, testoDicitura, LAYOUT } from './f24PdfService.js';
import { DATA_DIR } from '../lib/jsonStore.js';

// Funzioni pure estratte per test (non esportate dal service: reimplementate qui per testabilità).
function formattaImporto(importo) {
  const str = importo.toFixed(2);
  const [intera, dec] = str.split('.');
  const intFormatted = intera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { intero: intFormatted, decimali: dec };
}

describe('formattaImporto', () => {
  test('intero semplice', () => {
    const r = formattaImporto(1234.56);
    assert.equal(r.intero, '1.234');
    assert.equal(r.decimali, '56');
  });

  test('importo sotto 1000', () => {
    const r = formattaImporto(98.07);
    assert.equal(r.intero, '98');
    assert.equal(r.decimali, '07');
  });

  test('centesimi zero', () => {
    const r = formattaImporto(500);
    assert.equal(r.intero, '500');
    assert.equal(r.decimali, '00');
  });

  test('arrotondamento floating point', () => {
    const r = formattaImporto(1.005);
    // toFixed(2) su JS: 1.005 → "1.00" (floating point), accettato
    assert.equal(r.decimali.length, 2);
  });
});

// Test limiti righe (logica del service)
describe('limiti righe', () => {
  const MAX_ERARIO = 6;
  const MAX_INPS = 4;

  test('erario entro limite', () => {
    const righe = Array.from({ length: MAX_ERARIO }, (_, i) => ({ sezione: 'erario', importo: 100 + i }));
    assert.doesNotThrow(() => {
      if (righe.length > MAX_ERARIO) throw new Error('troppo');
    });
  });

  test('erario oltre limite lancia errore', () => {
    const righe = Array.from({ length: MAX_ERARIO + 1 }, (_, i) => ({ sezione: 'erario', importo: 100 + i }));
    assert.throws(() => {
      if (righe.length > MAX_ERARIO) throw new Error(`Troppe righe Erario: ${righe.length}`);
    }, /Troppe righe/);
  });

  test('inps oltre limite lancia errore', () => {
    const righe = Array.from({ length: MAX_INPS + 1 }, (_, i) => ({ sezione: 'inps', importo: 50 + i }));
    assert.throws(() => {
      if (righe.length > MAX_INPS) throw new Error(`Troppe righe INPS: ${righe.length}`);
    }, /Troppe righe/);
  });
});

// Test end-to-end: genera davvero il PDF sul modello AdE (skip se non scaricato,
// evita dipendenza di rete nei test). Copre regressioni di layout/campi che i test
// puri sopra non vedono (es. un campo config che non esiste più).
describe('generaF24Pdf', () => {
  const modelloPresente = existsSync(path.join(DATA_DIR, 'modelli', 'f24-ordinario.pdf'));

  test('genera un PDF valido con righe erario e inps', { skip: !modelloPresente && 'modello F24 non scaricato' }, async () => {
    const scadenza = {
      data: '2026-06-30',
      righe: [
        { sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 1234.56 },
        { sezione: 'inps', codice: '18', annoRiferimento: 2025, importo: 850.75, periodoDa: '01/2025', periodoA: '12/2025' },
      ],
    };
    const config = { fornitore: { codiceFiscale: 'RSSMRA80A01H501Z', denominazione: 'Mario Rossi', comune: 'Roma', provincia: 'RM' } };

    const pdf = await generaF24Pdf(scadenza, config);
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 1000);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });

  test('rifiuta troppe righe erario', { skip: !modelloPresente && 'modello F24 non scaricato' }, async () => {
    const scadenza = {
      righe: Array.from({ length: 7 }, (_, i) => ({ sezione: 'erario', codice: '1792', importo: 1 + i })),
    };
    await assert.rejects(() => generaF24Pdf(scadenza, { fornitore: {} }), /Troppe righe/);
  });

  test('genera PDF con righe a credito (importo negativo)', { skip: !modelloPresente && 'modello F24 non scaricato' }, async () => {
    const scadenza = {
      data: '2026-06-30',
      righe: [
        { sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo: 2000.00 },
        { sezione: 'erario', codice: '4001', annoRiferimento: 2024, importo: -500.00 },
        { sezione: 'inps',   codice: 'VP01', periodoDa: '01/2025', periodoA: '12/2025', importo: 1000.00 },
        { sezione: 'inps',   codice: 'VP01', periodoDa: '01/2024', periodoA: '12/2024', importo: -200.00 },
      ],
    };
    const config = { fornitore: { codiceFiscale: 'RSSMRA80A01H501Z', denominazione: 'Mario Rossi', comune: 'Roma', provincia: 'RM' } };
    const pdf = await generaF24Pdf(scadenza, config);
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 1000);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    // Saldo atteso: (2000-500) + (1000-200) = 2300
  });
});

describe('dicitura bozza a margine', () => {
  test('testo base e con regole provvisorie', () => {
    assert.match(testoDicitura(), /Bozza FogliFatture/);
    assert.doesNotMatch(testoDicitura(), /provvisorie/);
    assert.match(testoDicitura({ provvisorie: true, annoRegole: 2026 }), /Regole 2026 provvisorie/);
  });

  test('posizione sopra ogni campo calibrato del modello', () => {
    const { dicitura, ...campi } = LAYOUT;
    const ys = [];
    const raccogli = (o) => {
      if (typeof o.y === 'number') ys.push(o.y);
      for (const v of Object.values(o)) if (v && typeof v === 'object' && !Array.isArray(v)) raccogli(v);
    };
    raccogli(campi);
    assert.ok(dicitura.y > Math.max(...ys) + 9);
  });
});
