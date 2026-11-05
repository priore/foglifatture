// Casi di riferimento calcolati a mano dalle formule di legge, indipendenti dal dataset di prova.
// Ogni caso riporta il calcolo: se il codice cambia un risultato, il test dice quale formula non torna.
// Fonti delle formule: L. 190/2014 c. 64-65 (imposta sostitutiva sul reddito dopo la deduzione dei contributi versati),
// Circ. INPS 8/2026 (aliquota Gestione Separata 26,07%), Ris. AdE 59/E/2015 (codici 1790, 1791, 1792).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { impostaCassaAnno } from './forfettarioService.js';
import { bolloPerTrimestre } from './bolloTrimestrale.js';
import { calcolaLifo, nettiPerAnno } from './lottiBtcService.js';

const tutteConIncasso = (importo) => [{ anno: 2026, pagamenti: [{ data: '2026-05-10', importo }], residuo: 0 }];
const config = (extra = {}) => ({ forfettario: { sogliaAnnua: 85000, coefficenteRedditivita: 78, dataInizioAttivita: '', ...extra } });
const regole = { inpsGestioneSeparata: { aliquota: 26.07, massimale: 122295 } };

test('caso 1: ricavi 35.000, coefficiente 78%, contributi versati 3.000 → imposta 3.645', async () => {
  // reddito = 35.000 × 78% = 27.300; base = 27.300 − 3.000 = 24.300; imposta = 24.300 × 15% = 3.645
  const versamenti = [{ tipo: 'INPS', data: '2026-06-30', importo: 3000 }];
  const r = await impostaCassaAnno(2026, tutteConIncasso(35000), config(), versamenti, regole);
  assert.equal(r.redditoForfettario, 27300);
  assert.equal(r.imposta, 3645);
});

test('caso 2: la Gestione Separata si calcola sul reddito forfettario (ricavi 10.000, 30.000, 60.000)', async () => {
  const gs = config({ gestionePrevidenziale: 'gestioneSeparata' });
  // 10.000 × 78% = 7.800 → 7.800 × 26,07% = 2.033,46 → 2.033
  assert.equal((await impostaCassaAnno(2026, tutteConIncasso(10000), gs, [], regole)).inps, 2033);
  // 30.000 × 78% = 23.400 → 23.400 × 26,07% = 6.100,38 → 6.100
  assert.equal((await impostaCassaAnno(2026, tutteConIncasso(30000), gs, [], regole)).inps, 6100);
  // 60.000 × 78% = 46.800 → 46.800 × 26,07% = 12.200,76 → 12.201
  assert.equal((await impostaCassaAnno(2026, tutteConIncasso(60000), gs, [], regole)).inps, 12201);
});

test('caso 3: oltre il massimale la Gestione Separata si ferma (reddito 150.000, massimale 122.295)', async () => {
  const gs = config({ gestionePrevidenziale: 'gestioneSeparata', coefficenteRedditivita: 100 });
  // il reddito 150.000 supera il massimale: 122.295 × 26,07% = 31.882,3065 → 31.882
  assert.equal((await impostaCassaAnno(2026, tutteConIncasso(150000), gs, [], regole)).inps, 31882);
});

test('caso 4: senza contributi versati l\'imposta è sul reddito intero (ricavi 20.000 → 15.600 × 15% = 2.340)', async () => {
  const r = await impostaCassaAnno(2026, tutteConIncasso(20000), config(), [], regole);
  assert.equal(r.imposta, 2340);
});

test('caso 5: i contributi di un altro anno non si deducono', async () => {
  const versamenti = [{ tipo: 'INPS', data: '2025-11-30', importo: 5000 }];
  const r = await impostaCassaAnno(2026, tutteConIncasso(20000), config(), versamenti, regole);
  assert.equal(r.imposta, 2340);
});

test('caso 6: bollo da 2 € per ogni fattura sopra 77,47 €, sommato per trimestre', () => {
  const f = (mese, bollo) => ({ anno: 2026, mese, bolloApplicabile: bollo > 0, bollo });
  // 5 fatture con bollo nel primo trimestre = 10 €, una sola nel terzo = 2 €
  const [q1, q2, q3, q4] = bolloPerTrimestre(2026, [f(1, 2), f(1, 2), f(2, 2), f(3, 2), f(3, 2), f(8, 2), f(5, 0)]);
  assert.deepEqual([q1, q2, q3, q4], [10, 0, 2, 0]);
});

test('caso 7: plusvalenza bitcoin LIFO, aliquota 33% (acquisto 1 BTC a 20.000 €, 0,5 BTC a 30.000 €, vendita di 0,5 BTC a 25.000 €)', () => {
  const lotti = [
    { id: 'A', data: '2026-01-10', satoshi: 100_000_000, costoEur: 20000 },
    { id: 'B', data: '2026-03-10', satoshi: 50_000_000, costoEur: 15000 },
  ];
  const uscite = [{ id: 'V', tipo: 'vendita', data: '2026-06-01', satoshi: 50_000_000, ricavoEur: 25000 }];
  const { cessioni } = calcolaLifo(lotti, uscite);
  // LIFO: la vendita consuma il lotto più recente (B): costo 15.000 → plusvalenza 25.000 − 15.000 = 10.000
  assert.equal(cessioni[0].costoEur, 15000);
  assert.equal(cessioni[0].plusvalenza, 10000);
  // imposta sostitutiva 33% = 3.300
  assert.equal(Number((nettiPerAnno(cessioni)[2026] * 0.33).toFixed(2)), 3300);
});
