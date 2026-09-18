import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { arricchisciStatoPagamento } from './invoiceService.js';

mock.module('./invoiceService.js', {
  exports: {
    arricchisciStatoPagamento,
    listMesiFatturati: async () => [
      { chiave: '2026-01-cliA', anno: 2026, mese: 1, clienteId: 'cliA' },
      { chiave: '2026-06-cliA', anno: 2026, mese: 6, clienteId: 'cliA' },
    ],
    getInvoice: async (anno, mese, clienteId) => {
      const chiave = `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
      const store = {
        // Emessa 2026, incassata 2027: rilevante per cassa 2027, non 2026.
        '2026-01-cliA': { anno: 2026, mese: 1, clienteId: 'cliA', numero: 1, data: '2026-01-31', imponibile: 1000, bollo: 2, nettoAPagare: 1000, dataPagamento: '2027-01-10' },
        // Emessa e incassata nel 2026: rilevante per entrambi i criteri.
        '2026-06-cliA': { anno: 2026, mese: 6, clienteId: 'cliA', numero: 2, data: '2026-06-30', imponibile: 500, bollo: 2, nettoAPagare: 500, dataPagamento: '2026-07-05' },
      };
      return store[chiave] ?? null;
    },
  },
});

const { esportaReportCommercialistaCsv } = await import('./exportService.js');

const configBase = {
  clienti: [{ id: 'cliA', denominazione: 'Cliente A', partitaIva: '12345678901' }],
  forfettario: { sogliaAnnua: 85000, coefficenteRedditivita: 78, dataInizioAttivita: '' },
};

test('export 2026: elenco emesse include entrambe, elenco cassa solo quella incassata nel 2026', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  assert.match(csv, /Fatture emesse nel 2026 \(competenza\)/);
  assert.match(csv, /Fatture incassate nel 2026 \(cassa/);
  // Fattura 1 (incassata 2027) non deve comparire nella sezione cassa del 2026.
  const sezioneCassa = csv.split('Fatture incassate nel 2026')[1];
  assert.doesNotMatch(sezioneCassa.split('\n\n')[0] ?? sezioneCassa, /^1,/m);
});

test('riepilogo cassa 2026 conta solo il ricavo incassato nel 2026 (500), non quello emesso (1500)', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  const righe = csv.split('\n');
  const rigaCassa = righe.find((r) => r.startsWith('Ricavi cumulati,500.00'));
  assert.ok(rigaCassa, 'atteso "Ricavi cumulati,500.00" nel riepilogo cassa');
});

test('export 2027: la fattura emessa nel 2026 ma incassata nel 2027 compare nell\'elenco cassa 2027', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2027);
  const sezioneCassa = csv.split('Fatture incassate nel 2027')[1];
  assert.match(sezioneCassa, /^1,/m);
});
