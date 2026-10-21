import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const store = {
  '2026-01-cli': { anno: 2026, mese: 1, clienteId: 'cli', numero: '1', data: '2026-01-28', imponibile: 1000, rivalsaInps: 40, nettoAPagare: 1040, pagamenti: [] },
  '2026-02-cli': { anno: 2026, mese: 2, clienteId: 'cli', numero: '2', data: '2026-02-28', imponibile: 500, rivalsaInps: 0, nettoAPagare: 500, pagamenti: [] },
};
mock.module('../lib/jsonStore.js', {
  exports: {
    readJson: async (p) => store[p.replace('invoices/', '').replace('.json', '')] ?? null,
    writeJson: async (p, d) => { store[p.replace('invoices/', '').replace('.json', '')] = d; },
    listKeys: async () => Object.keys(store),
  },
});

const { emettiNotaCredito, fatturaDaNotaCredito } = await import('./notaCreditoService.js');
const { arricchisciStatoPagamento, verificaIntegritaNumerazione } = await import('./invoiceService.js');
const { generaXmlFatturaPA } = await import('./fatturaPaXmlGenerator.js');

test('nota totale: numero successivo in sequenza, rivalsa inclusa, fattura risulta stornata', async () => {
  const inv = await emettiNotaCredito(2026, 1, 'cli', { conferma: true });
  assert.equal(inv.notaCredito.numero, '3');
  assert.equal(inv.notaCredito.nettoAPagare, 1040);
  assert.equal(arricchisciStatoPagamento(inv).stato, 'stornata');
});

test('la nota occupa un numero della sequenza: la prossima fattura è la 4, non la 3', async () => {
  assert.equal((await verificaIntegritaNumerazione(2026, 3, 'cli', '3')).valido, false);
  assert.equal((await verificaIntegritaNumerazione(2026, 3, 'cli', '4')).valido, true);
});

test('seconda nota sulla stessa fattura e importo oltre l\'imponibile sono rifiutati', async () => {
  await assert.rejects(emettiNotaCredito(2026, 1, 'cli', {}), /già emessa/);
  await assert.rejects(emettiNotaCredito(2026, 2, 'cli', { importo: 501 }), /Importo non valido/);
});

test('nota parziale su fattura già pagata: segnala da rimborsare', async () => {
  store['2026-02-cli'].pagamenti = [{ data: '2026-03-01', importo: 500 }];
  const inv = await emettiNotaCredito(2026, 2, 'cli', { importo: 200 });
  const r = arricchisciStatoPagamento(inv);
  assert.equal(r.residuo, -200);
  assert.equal(r.daRimborsare, 200);
  assert.equal(r.stato, 'pagata');
});

test('XML TD04: tipo documento, fattura collegata, nessun DatiPagamento', async () => {
  const inv = store['2026-01-cli'];
  const xml = generaXmlFatturaPA({
    fornitore: { codiceFiscale: 'X', partitaIva: '1' },
    cliente: { codiceDestinatarioSdi: '0000000' },
    fattura: { ...fatturaDaNotaCredito(inv), progressivoInvio: 'AB12C' },
  });
  assert.match(xml, /<TipoDocumento>TD04<\/TipoDocumento>/);
  assert.match(xml, /<DatiFattureCollegate>\s*<IdDocumento>1<\/IdDocumento>\s*<Data>2026-01-28<\/Data>/);
  assert.doesNotMatch(xml, /DatiPagamento|DatiBollo/);
  assert.match(xml, /<ImportoTotaleDocumento>1040\.00</);
});
