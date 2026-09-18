import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { arricchisciStatoPagamento } from './invoiceService.js';

const fatture = new Map();

function chiave(anno, mese, clienteId) {
  return `${anno}-${mese}-${clienteId}`;
}

mock.module('./invoiceService.js', {
  exports: {
    arricchisciStatoPagamento,
    listMesiFatturati: async () => Array.from(fatture.keys()).map((k) => {
      const [anno, mese, clienteId] = k.split('-');
      return { anno: Number(anno), mese: Number(mese), clienteId };
    }),
    getInvoice: async (anno, mese, clienteId) => fatture.get(chiave(anno, mese, clienteId)) ?? null,
    saveInvoice: async (anno, mese, clienteId, invoice) => {
      fatture.set(chiave(anno, mese, clienteId), invoice);
      return invoice;
    },
  },
});

const { fattureAperte, proponiAbbinamenti, confermaPagamento, eliminaPagamento } = await import('./pagamentiFattureService.js');

function reset(fixture) {
  fatture.clear();
  for (const invoice of fixture) fatture.set(chiave(invoice.anno, invoice.mese, invoice.clienteId), invoice);
}

test('somma pagamenti con residuo floating-point vicino a zero risulta pagata', async () => {
  reset([
    { anno: 2026, mese: 1, clienteId: 'c1', numero: '1', nettoAPagare: 0.3, pagamenti: [{ data: '2026-01-01', importo: 0.1 }, { data: '2026-01-02', importo: 0.2 }] },
  ]);
  const arricchita = arricchisciStatoPagamento(fatture.get('2026-1-c1'));
  assert.equal(arricchita.residuo, 0);
  assert.equal(arricchita.stato, 'pagata');
  const aperte = await fattureAperte();
  assert.equal(aperte.length, 0);
});

test('proponiAbbinamenti ordina i candidati ambigui per vicinanza al residuo', async () => {
  reset([
    { anno: 2026, mese: 1, clienteId: 'a', numero: '1', nettoAPagare: 101, pagamenti: [] },
    { anno: 2026, mese: 2, clienteId: 'b', numero: '2', nettoAPagare: 105, pagamenti: [] },
    { anno: 2026, mese: 3, clienteId: 'c', numero: '3', nettoAPagare: 200, pagamenti: [] },
  ]);
  const [proposta] = await proponiAbbinamenti([{ data: '2026-01-15', importo: 100.5, descrizione: 'bonifico' }]);
  assert.equal(proposta.ambiguo, true);
  assert.deepEqual(proposta.candidati.map((c) => c.numero), ['1', '2', '3']);
});

test('confermaPagamento fa append senza sovrascrivere pagamenti precedenti', async () => {
  reset([
    { anno: 2026, mese: 1, clienteId: 'x', numero: '1', nettoAPagare: 600, pagamenti: [{ data: '2026-01-01', importo: 400 }] },
  ]);
  const aggiornata = await confermaPagamento(2026, 1, 'x', '2026-03-01', 200);
  assert.equal(aggiornata.pagamenti.length, 2);
  assert.equal(aggiornata.residuo, 0);
  assert.equal(aggiornata.stato, 'pagata');
});

test('confermaPagamento con importo in eccesso produce residuo negativo (credito)', async () => {
  reset([
    { anno: 2026, mese: 1, clienteId: 'y', numero: '1', nettoAPagare: 100, pagamenti: [] },
  ]);
  const aggiornata = await confermaPagamento(2026, 1, 'y', '2026-01-10', 120);
  assert.equal(aggiornata.residuo, -20);
  assert.equal(aggiornata.stato, 'pagata');
});

test('eliminaPagamento ricalcola il residuo', async () => {
  reset([
    { anno: 2026, mese: 1, clienteId: 'z', numero: '1', nettoAPagare: 600, pagamenti: [{ data: '2026-01-01', importo: 400 }, { data: '2026-03-01', importo: 200 }] },
  ]);
  const aggiornata = await eliminaPagamento(2026, 1, 'z', 1);
  assert.equal(aggiornata.pagamenti.length, 1);
  assert.equal(aggiornata.residuo, 200);
});

test('eliminaPagamento su indice fuori range lancia errore', async () => {
  reset([
    { anno: 2026, mese: 1, clienteId: 'w', numero: '1', nettoAPagare: 100, pagamenti: [{ data: '2026-01-01', importo: 100 }] },
  ]);
  await assert.rejects(() => eliminaPagamento(2026, 1, 'w', 5), /non trovato/);
});
