// Test per creditiService: funzione pura compensaCrediti + regole limite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compensaCrediti } from './creditiService.js';

const REGOLE_BASE = { compensazione: { sogliaOrizzontale: 5000 } };

const debitoErario = (importo) => ({ sezione: 'erario', codice: '1792', annoRiferimento: 2025, importo });
const debitoInps  = (importo) => ({ sezione: 'inps', codice: 'PXX', annoRiferimento: 2025, importo });
const creditoVert  = (importo, id = 'c1') => ({ id, sezione: 'erario', codice: '1792', annoRiferimento: 2024, importo, residuo: importo, disponibile: true });
const creditoOriz  = (importo, id = 'c2') => ({ id, sezione: 'erario', codice: 'IRPEF', annoRiferimento: 2024, importo, residuo: importo, disponibile: true });
const creditoNonAncora = (importo) => ({ id: 'c3', sezione: 'erario', codice: '1792', annoRiferimento: 2024, importo, residuo: importo, disponibile: false });

test('copertura parziale verticale: debito ridotto, nessun avviso visto', () => {
  const debiti = [debitoErario(1000)];
  const crediti = [{ ...creditoVert(300), _residuoDisp: 300 }];
  const { righeDebito, righeCredito, totaleNetto, avvisi } = compensaCrediti(debiti, crediti, REGOLE_BASE);
  assert.strictEqual(righeDebito[0].importo, 700);
  assert.strictEqual(righeCredito[0].importo, 300);
  assert.strictEqual(totaleNetto, 700);
  // Verticale: nessun avviso visto di conformità
  assert.ok(!avvisi.some((a) => a.includes('visto di conformità') && a.includes('verticale')));
});

test('copertura totale verticale: F24 a saldo zero', () => {
  const debiti = [debitoErario(500)];
  const crediti = [{ ...creditoVert(500), _residuoDisp: 500 }];
  const { totaleNetto, f24AZero, avvisi } = compensaCrediti(debiti, crediti, REGOLE_BASE);
  assert.strictEqual(totaleNetto, 0);
  assert.strictEqual(f24AZero, true);
  assert.ok(avvisi.some((a) => a.includes('telematica')));
});

test('compensazione orizzontale entro soglia: avviso dichiarazione ma non blocco', () => {
  const debiti = [debitoInps(2000)];
  const crediti = [{ ...creditoOriz(1000), _residuoDisp: 1000 }];
  const { totaleNetto, avvisi } = compensaCrediti(debiti, crediti, REGOLE_BASE);
  assert.strictEqual(totaleNetto, 1000);
  assert.ok(avvisi.some((a) => a.includes('10 giorni prima')));
});

test('soglia 5000 orizzontale: credito eccedente non compensato, avviso visto', () => {
  const debiti = [debitoInps(8000)];
  const crediti = [{ ...creditoOriz(6000), _residuoDisp: 6000 }];
  const { totaleNetto, avvisi } = compensaCrediti(debiti, crediti, REGOLE_BASE);
  // Solo 5000 compensati
  assert.strictEqual(totaleNetto, 3000);
  assert.ok(avvisi.some((a) => a.includes('visto di conformità')));
});

test('credito non ancora disponibile non viene usato', () => {
  const debiti = [debitoErario(500)];
  const crediti = [{ ...creditoNonAncora(500), _residuoDisp: 500 }];
  const { totaleNetto, righeCredito } = compensaCrediti(debiti, crediti, REGOLE_BASE);
  // Il credito non è disponibile: non compensato
  assert.strictEqual(totaleNetto, 500);
  assert.strictEqual(righeCredito.length, 0);
});

test('verticale non conta verso la soglia orizzontale', () => {
  // 4900 verticale + 4900 orizzontale: solo orizzontale conta verso 5000
  const debiti = [debitoErario(4900), debitoInps(4900)];
  const credVert = { ...creditoVert(4900), _residuoDisp: 4900 };
  const credOriz = { ...creditoOriz(4900, 'c2'), _residuoDisp: 4900 };
  const { righeCredito, avvisi } = compensaCrediti(debiti, [credVert, credOriz], REGOLE_BASE);
  // Entrambi i crediti usati (vert. esente, oriz. entro 5000)
  assert.strictEqual(righeCredito.length, 2);
  // Nessun avviso di soglia raggiunta
  assert.ok(!avvisi.some((a) => a.includes('raggiunto')));
});

test('senza crediti: righe invariate', () => {
  const debiti = [debitoErario(1000)];
  const { righeDebito, righeCredito, totaleNetto } = compensaCrediti(debiti, [], REGOLE_BASE);
  assert.strictEqual(righeDebito[0].importo, 1000);
  assert.strictEqual(righeCredito.length, 0);
  assert.strictEqual(totaleNetto, 1000);
});
