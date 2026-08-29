import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('../lib/jsonStore.js', {
  exports: {
    readJson: async (relativePath) => {
      const chiave = relativePath.replace('invoices/', '').replace('.json', '');
      const store = {
        '2026-01': { anno: 2026, mese: 1, numero: '1' },
        '2026-02': { anno: 2026, mese: 2, numero: '2' },
      };
      return store[chiave] ?? null;
    },
    writeJson: async () => {},
    listKeys: async () => ['2026-01', '2026-02'],
  },
});

const { verificaIntegritaNumerazione } = await import('./invoiceService.js');

test('numero sequenziale successivo è valido', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 3, '3');
  assert.equal(risultato.valido, true);
});

test('numero con salto viene rifiutato', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 3, '5');
  assert.equal(risultato.valido, false);
  assert.match(risultato.errore, /non sequenziale/);
});

test('numero duplicato viene rifiutato', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 3, '2');
  assert.equal(risultato.valido, false);
  assert.match(risultato.errore, /già usato/);
});

test('rigenerazione dello stesso mese riusa il proprio numero senza falso duplicato', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 2, '2');
  assert.equal(risultato.valido, true);
});
