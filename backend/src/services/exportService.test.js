import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { arricchisciStatoPagamento } from './invoiceService.js';

mock.module('./invoiceService.js', {
  exports: {
    arricchisciStatoPagamento,
    listMesiFatturati: async () => [
      { chiave: '2026-01-cliA', anno: 2026, mese: 1, clienteId: 'cliA' },
      { chiave: '2026-06-cliA', anno: 2026, mese: 6, clienteId: 'cliA' },
      { chiave: '2026-09-cliA', anno: 2026, mese: 9, clienteId: 'cliA' },
    ],
    getInvoice: async (anno, mese, clienteId) => {
      const chiave = `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
      const store = {
        // Emessa 2026, incassata 2027: rilevante per cassa 2027, non 2026.
        '2026-01-cliA': { anno: 2026, mese: 1, clienteId: 'cliA', numero: 1, data: '2026-01-31', imponibile: 1000, bollo: 2, nettoAPagare: 1000, dataPagamento: '2027-01-10' },
        // Emessa e incassata nel 2026: rilevante per entrambi i criteri.
        '2026-06-cliA': { anno: 2026, mese: 6, clienteId: 'cliA', numero: 2, data: '2026-06-30', imponibile: 500, bollo: 2, nettoAPagare: 500, dataPagamento: '2026-07-05' },
        '2026-09-cliA': {
          anno: 2026, mese: 9, clienteId: 'cliA', numero: 3, data: '2026-09-01', imponibile: 300, bollo: 0, nettoAPagare: 300,
          pagamenti: [{ data: '2026-09-05', importo: 300, btc: { txid: 'a'.repeat(64), satoshi: 300000, cambioEurBtc: 100000, fonteCambio: 'Kraken' } }],
        },
      };
      return store[chiave] ?? null;
    },
  },
});

// Stato cripto mutabile: ogni test BTC lo imposta, di default nessun movimento.
const cripto = { lotti: [], uscite: [], applicabile: true };
mock.module('./lottiBtcService.js', {
  exports: {
    lottiConStato: async () => cripto.lotti,
    riepilogoAnnuale: async () => ({
      plusvalenze: cripto.applicabile
        ? { applicabile: true, cessioni: cripto.uscite.filter((u) => u.tipo !== 'trasferimento').map((u) => ({ uscita: u, plusvalenza: 50 })), netto: 50, compensate: 0, baseImponibile: 50, aliquota: 33, imposta: 16.5, minusvalenzeRiportabili: [] }
        : { applicabile: false, cessioni: [] },
      saldo: { satoshi: 2000000, costoTotaleEur: 1000, valoreEur: 1900 },
      ivca: { impostaLorda: 3.8, mancaValoreMercato: false },
      rw8: { totaleImposta: 0, accontiVersati: 0, saldo: 0 },
    }),
  },
});
mock.module('./movimentiBtcService.js', {
  exports: { leggiMovimenti: async () => ({ ingressi: [], uscite: cripto.uscite, valoriMercato: {} }) },
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

test('riepilogo cassa 2026 conta solo il ricavo incassato nel 2026 (800 = 500 bonifico + 300 BTC), non quello emesso (1800)', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  const righe = csv.split('\n');
  const rigaCassa = righe.find((r) => r.startsWith('Ricavi cumulati,800.00'));
  assert.ok(rigaCassa, 'atteso "Ricavi cumulati,800.00" nel riepilogo cassa');
});

test('rata BTC (F6): colonna Metodo=BTC, TXID, satoshi in BTC, cambio e fonte popolate', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  assert.match(csv, /,BTC,a{64},0\.00300000,100000\.00,Kraken/);
});

test('export 2027: la fattura emessa nel 2026 ma incassata nel 2027 compare nell\'elenco cassa 2027', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2027);
  const sezioneCassa = csv.split('Fatture incassate nel 2027')[1];
  assert.match(sezioneCassa, /^1,/m);
});

test('rata a bonifico (senza btc) ha colonna Metodo=bonifico e colonne BTC vuote', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  assert.match(csv, /,bonifico,,,,/);
});

test('senza lotti né uscite BTC non compaiono sezioni cripto', async () => {
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  assert.doesNotMatch(csv, /Registro lotti BTC|Uscite BTC|Riepilogo cripto/);
});

test('con movimenti BTC: sezioni lotti, uscite (con plusvalenza, trasferimento vuoto) e riepilogo in coda', async () => {
  cripto.lotti = [{ data: '2026-03-15', tipo: 'incasso', satoshi: 5000000, residui: 2000000, costoEur: 450, txid: 'b'.repeat(64) }];
  cripto.uscite = [
    { id: 'OUT-1', data: '2026-08-20', tipo: 'vendita', satoshi: 3000000, ricavoEur: 350, txid: '' },
    { id: 'OUT-2', data: '2026-09-01', tipo: 'trasferimento', satoshi: 100000, ricavoEur: 0, txid: '' },
    { id: 'OUT-3', data: '2025-09-01', tipo: 'vendita', satoshi: 1, ricavoEur: 1, txid: '' },
  ];
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  assert.ok(csv.indexOf('Registro lotti BTC') > csv.indexOf('% soglia raggiunta'), 'sezioni cripto in coda');
  assert.match(csv, /^2026-03-15,incasso,0\.05000000,450\.00,b{64},0\.02000000$/m);
  assert.match(csv, /^2026-08-20,vendita,0\.03000000,350\.00,50\.00,$/m);
  assert.match(csv, /^2026-09-01,trasferimento,0\.00100000,0\.00,,$/m);
  assert.doesNotMatch(csv, /2025-09-01,vendita/);
  assert.match(csv, /^Imposta sostitutiva 33% EUR,16\.50$/m);
  assert.match(csv, /^RW8 saldo EUR,0\.00$/m);
});

test('regole cripto non attive: riepilogo lo segnala senza righe imposta', async () => {
  cripto.applicabile = false;
  const csv = await esportaReportCommercialistaCsv(configBase, 2026);
  assert.match(csv, /regole cripto non attive/);
  assert.doesNotMatch(csv, /Imposta sostitutiva \d+%/);
});
