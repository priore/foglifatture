import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { arricchisciStatoPagamento } from './invoiceService.js';

mock.module('./invoiceService.js', {
  exports: {
    arricchisciStatoPagamento,
    listMesiFatturati: async () => [
      { chiave: '2026-01-cliA', anno: 2026, mese: 1, clienteId: 'cliA' },
      { chiave: '2026-01-cliB', anno: 2026, mese: 1, clienteId: 'cliB' },
      { chiave: '2026-02-cliA', anno: 2026, mese: 2, clienteId: 'cliA' },
    ],
    getInvoice: async (anno, mese, clienteId) => {
      const chiave = `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
      const store = {
        '2026-01-cliA': {
          anno: 2026, mese: 1, clienteId: 'cliA', imponibile: 1000, numero: 1, nettoAPagare: 1000,
          pagamenti: [{ data: '2026-03-10', importo: 1000, btc: { txid: 'abc123', satoshi: 2000000, cambioEurBtc: 50000, fonteCambio: 'test', dataOraCambio: '2026-03-10T10:00:00Z', indirizzoDestinatario: 'bc1qtest' } }],
        },
        '2026-01-cliB': { anno: 2026, mese: 1, clienteId: 'cliB', imponibile: 1000, numero: 2, dataPagamento: null, nettoAPagare: 1000 },
        '2026-02-cliA': { anno: 2026, mese: 2, clienteId: 'cliA', imponibile: 500, numero: 3, dataPagamento: '2027-01-15', nettoAPagare: 500 },
      };
      return store[chiave] ?? null;
    },
  },
});

const { calcolaDashboardForfettario, aliquotaImposta } = await import('./forfettarioService.js');

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

test('accontoStimato usa la base cassa del piano F24 (incassi proiettati, non fatturato emesso)', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // cassa 2026 = 1000 incassati in 1 solo mese (marzo) -> proiezione 12000, coefficiente 78%,
  // aliquota 15% (nessuna dataInizioAttivita), nessun INPS versato -> 12000*0.78*0.15 = 1404
  assert.equal(risultato.accontoStimato, 1404);
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

test('cassa.btc aggrega solo le rate con btc valorizzato (misto bonifico+BTC)', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  // Unica rata BTC: cliA-01, 1000 EUR / 0.02 BTC (2000000 sat) -> cambio medio 50000.
  assert.equal(risultato.cassa.btc.rate, 1);
  assert.equal(risultato.cassa.btc.eur, 1000);
  assert.equal(risultato.cassa.btc.satoshi, 2000000);
  assert.equal(risultato.cassa.btc.cambioMedio, 50000);
  assert.equal(risultato.cassa.btc.elenco[0].txid, 'abc123');
  // 1000 EUR BTC su 1000 EUR incassato-cassa totale 2026 -> 100%.
  assert.equal(risultato.cassa.btc.percentualeSuIncassato, 100);
  assert.equal(risultato.cassa.btc.walletConfigurati, false);
});

test('cassa.btc su anno senza incassi BTC restituisce rate/importi a zero', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2027, meseCorrente: 12 });
  assert.equal(risultato.cassa.btc.rate, 0);
  assert.equal(risultato.cassa.btc.eur, 0);
  assert.equal(risultato.cassa.btc.cambioMedio, 0);
  assert.deepEqual(risultato.cassa.btc.elenco, []);
});

// --- aliquotaImposta: flag requisitiAliquotaRidotta ---

test('aliquotaImposta: senza flag (default false) restituisce aliquota ordinaria anche con data inizio recente', async () => {
  // dataInizioAttivita 2024: nei primi 5 anni, ma senza il flag rimane al 15%
  const aliquota = await aliquotaImposta('2024-01-01', 2026);
  assert.equal(aliquota, 15);
});

test('aliquotaImposta: con flag true e data inizio recente restituisce aliquota ridotta 5%', async () => {
  const aliquota = await aliquotaImposta('2024-01-01', 2026, true);
  assert.equal(aliquota, 5);
});

test('aliquotaImposta: con flag true ma fuori dai 5 anni restituisce aliquota ordinaria', async () => {
  const aliquota = await aliquotaImposta('2010-01-01', 2026, true);
  assert.equal(aliquota, 15);
});

test('aliquotaImposta: senza dataInizioAttivita restituisce sempre aliquota ordinaria', async () => {
  const aliquota = await aliquotaImposta('', 2026, true);
  assert.equal(aliquota, 15);
});

// --- calcolaDashboardForfettario: soggettoIsa nel risultato ---

test('calcolaDashboardForfettario espone soggettoIsa dal config (default true)', async () => {
  const risultato = await calcolaDashboardForfettario(configBase, { anno: 2026, meseCorrente: 12 });
  assert.equal(risultato.soggettoIsa, true);
});

test('calcolaDashboardForfettario espone soggettoIsa false se impostato nel config', async () => {
  const configNoIsa = { forfettario: { ...configBase.forfettario, soggettoIsa: false } };
  const risultato = await calcolaDashboardForfettario(configNoIsa, { anno: 2026, meseCorrente: 12 });
  assert.equal(risultato.soggettoIsa, false);
});

test('calcolaDashboardForfettario: requisitiAliquotaRidotta true usa aliquota 5% con data inizio recente', async () => {
  const configConRequisiti = {
    forfettario: { ...configBase.forfettario, dataInizioAttivita: '2024-01-01', requisitiAliquotaRidotta: true },
  };
  const risultato = await calcolaDashboardForfettario(configConRequisiti, { anno: 2026, meseCorrente: 12 });
  assert.equal(risultato.aliquota, 5);
  // impostaStimata = ricaviCumulati(2500) * coefficiente(0.78) * aliquota(0.05)
  assert.equal(risultato.impostaStimata, 97.5);
});

test('calcolaDashboardForfettario: requisitiAliquotaRidotta false (default) usa 15% anche con data inizio recente', async () => {
  const configSenzaRequisiti = {
    forfettario: { ...configBase.forfettario, dataInizioAttivita: '2024-01-01', requisitiAliquotaRidotta: false },
  };
  const risultato = await calcolaDashboardForfettario(configSenzaRequisiti, { anno: 2026, meseCorrente: 12 });
  assert.equal(risultato.aliquota, 15);
});

test('impostaCassaAnno espone i ricavi di cassa, distinti dal reddito forfettario', async () => {
  const { impostaCassaAnno } = await import('./forfettarioService.js');
  const tutte = [{ anno: 2026, pagamenti: [{ data: '2026-05-10', importo: 100000 }], residuo: 0 }];
  const r = await impostaCassaAnno(2026, tutte, configBase, [], {});
  assert.equal(r.ricavi, 100000);
  assert.equal(r.redditoForfettario, 78000);
});

test('roundEuro: euro interi, da 50 centesimi per eccesso', async () => {
  const { roundEuro } = await import('./forfettarioService.js');
  assert.equal(roundEuro(100.49), 100);
  assert.equal(roundEuro(100.5), 101);
});

test('accontoInpsAnnoSuccessivo: 80% del reddito N con aliquota N+1, tetto al massimale', async () => {
  const { accontoInpsAnnoSuccessivo } = await import('./forfettarioService.js');
  const regoleN1 = { inpsGestioneSeparata: { aliquota: 27, aliquotaAltreAttivita: 24, massimale: 100000 } };
  assert.equal(accontoInpsAnnoSuccessivo(50000, regoleN1), 10800); // 0,8 × 50000 × 27%
  assert.equal(accontoInpsAnnoSuccessivo(150000, regoleN1), 21600); // tetto 100000
  assert.equal(accontoInpsAnnoSuccessivo(50000, regoleN1, true), 9600); // aliquota ridotta 24%
});

test('impostaCassaAnno: reddito, contributo INPS e imposta in euro interi', async () => {
  const { impostaCassaAnno } = await import('./forfettarioService.js');
  const tutte = [{ anno: 2026, pagamenti: [{ data: '2026-05-10', importo: 1234.56 }], residuo: 0 }];
  const config = { forfettario: { ...configBase.forfettario, gestionePrevidenziale: 'gestioneSeparata' } };
  const r = await impostaCassaAnno(2026, tutte, config, [], { inpsGestioneSeparata: { aliquota: 26.07, massimale: 119650 } });
  assert.equal(r.redditoForfettario, 963); // 962,96
  assert.equal(r.inps, 251); // 963 × 26,07% = 251,05
  assert.equal(Number.isInteger(r.imposta), true);
});
