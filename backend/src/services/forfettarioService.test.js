import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('./invoiceService.js', {
  exports: {
    listMesiFatturati: async () => [
      { chiave: '2026-01-cliA', anno: 2026, mese: 1, clienteId: 'cliA' },
      { chiave: '2026-01-cliB', anno: 2026, mese: 1, clienteId: 'cliB' },
      { chiave: '2026-02-cliA', anno: 2026, mese: 2, clienteId: 'cliA' },
    ],
    getInvoice: async (anno, mese) => {
      const chiave = `${anno}-${String(mese).padStart(2, '0')}`;
      const store = {
        '2026-01': { anno: 2026, mese: 1, imponibile: 1000 },
        '2026-02': { anno: 2026, mese: 2, imponibile: 500 },
      };
      return store[chiave] ?? null;
    },
  },
});

const { calcolaDashboardForfettario } = await import('./forfettarioService.js');

const configBase = {
  forfettario: { sogliaAnnua: 85000, coefficenteRedditivita: 78, dataInizioAttivita: '' },
};

test('mesiFatturati conta mesi civili distinti, non entry (2 clienti stesso mese = 1 mese)', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // 3 chiavi (2026-01-cliA, 2026-01-cliB, 2026-02-cliA) ma solo 2 mesi civili distinti
  assert.equal(risultato.mesiFatturati, 2);
});

test('proiezione fine anno usa i mesi civili distinti, non le entry', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // 3 fatture (2 in gennaio da clienti diversi, 1 in febbraio): 1000+1000+500 = 2500 ricavi,
  // ma solo 2 mesi civili distinti fatturati -> proiezione 2500/2*12, non 2500/3*12.
  assert.equal(risultato.ricaviCumulati, 2500);
  assert.equal(risultato.ricaviProiettati, 15000);
});

test('accontoStimato usa metodo storico su ricavi proiettati fine anno, non sul consuntivo parziale', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // ricaviProiettati 15000, coefficiente 78%, aliquota 15% (nessuna dataInizioAttivita) -> 15000*0.78*0.15 = 1755
  assert.equal(risultato.accontoStimato, 1755);
  assert.notEqual(risultato.accontoStimato, risultato.impostaStimata);
});
