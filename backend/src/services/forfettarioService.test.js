import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('./invoiceService.js', {
  exports: {
    listMesiFatturati: async () => [
      { chiave: '2026-01-cliA', anno: 2026, mese: 1, clienteId: 'cliA' },
      { chiave: '2026-01-cliB', anno: 2026, mese: 1, clienteId: 'cliB' },
      { chiave: '2026-02-cliA', anno: 2026, mese: 2, clienteId: 'cliA' },
    ],
    getInvoice: async (anno, mese, clienteId) => {
      const chiave = `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
      const store = {
        '2026-01-cliA': { anno: 2026, mese: 1, clienteId: 'cliA', imponibile: 1000, numero: 1, dataPagamento: '2026-03-10', nettoAPagare: 1000 },
        '2026-01-cliB': { anno: 2026, mese: 1, clienteId: 'cliB', imponibile: 1000, numero: 2, dataPagamento: null, nettoAPagare: 1000 },
        '2026-02-cliA': { anno: 2026, mese: 2, clienteId: 'cliA', imponibile: 500, numero: 3, dataPagamento: '2027-01-15', nettoAPagare: 500 },
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

test('cassa.ricaviCumulati conta solo fatture incassate nell\'anno, non quelle emesse', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // Fattura 2026-01 (1000, entry cliA+cliB risolvono alla stessa) incassata 2026-03: fa cumulo cassa 2026.
  // Fattura 2026-02 (500) incassata 2027-01: NON fa cumulo cassa 2026, slitta al 2027.
  assert.equal(risultato.cassa.ricaviCumulati, 1000);
  assert.notEqual(risultato.cassa.ricaviCumulati, risultato.ricaviCumulati);
});

test('cassa.fattureACavalloAnno segnala fattura emessa 2026 incassata 2027', async () => {
  const risultato2026 = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  assert.equal(risultato2026.cassa.fattureACavalloAnno.length, 1);
  assert.equal(risultato2026.cassa.fattureACavalloAnno[0].annoIncasso, 2027);

  const risultato2027 = await calcolaDashboardForfettario(configBase, { anno: 2027, meseCorrente: 12 });
  // Stessa fattura visibile anche lato 2027: il suo incasso ha contribuito al fatturato-cassa 2027.
  assert.equal(risultato2027.cassa.ricaviCumulati, 500);
  assert.equal(risultato2027.cassa.fattureACavalloAnno.length, 1);
});

test('cassa.nonIncassateEmesseAnno elenca le fatture dell\'anno senza dataPagamento', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // cliB (2026-01) non ha dataPagamento: resta fuori dal fatturato cassa ma va segnalata come in attesa.
  assert.equal(risultato.cassa.nonIncassateEmesseAnno.length, 1);
  assert.equal(risultato.cassa.nonIncassateEmesseAnno[0].clienteId, 'cliB');
});
