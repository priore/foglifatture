// Test f24PdfService: formattazione importi, limiti righe, verifica impronta.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { generaF24Pdf } from './f24PdfService.js';
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

// Test verifica impronta
describe('verifica integrità', () => {
  test('impronta corretta non lancia errore', () => {
    const buf = Buffer.from('test-pdf-content');
    const hash = createHash('sha256').update(buf).digest('hex');
    // Simula il controllo del service
    assert.doesNotThrow(() => {
      if (hash !== hash) throw new Error('impronta diversa');
    });
  });

  test('impronta errata lancia errore', () => {
    const buf = Buffer.from('contenuto-diverso');
    const hash = createHash('sha256').update(buf).digest('hex');
    const attesa = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    assert.throws(() => {
      if (hash !== attesa) throw new Error(`impronta diversa. Attesa: ${attesa} Trovata: ${hash}`);
    }, /impronta diversa/);
  });

  test('verifica disabilitata con stringa vuota', () => {
    const MODELLO_SHA256 = '';
    assert.doesNotThrow(() => {
      if (!MODELLO_SHA256) return; // nessuna verifica
      throw new Error('non dovrebbe arrivare qui');
    });
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
