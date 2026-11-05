import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daRimborsareNota, anteprimaManuale, indirizzoBech32NonValido } from './useCalcoliFattura.js';
import { quotaIncasso, barrePianoCassa, barreRicaviMensili, fetteSoglia, storicoGiornaliero } from './useCalcoliDashboard.js';

test('daRimborsareNota: senza nota 0, con nota solo l\'eccedenza', () => {
  assert.equal(daRimborsareNota({ nettoAPagare: 100 }), 0);
  assert.equal(daRimborsareNota({ nettoAPagare: 100, notaCredito: { nettoAPagare: 40 }, pagamenti: [{ importo: 100 }] }), 40);
  assert.equal(daRimborsareNota({ nettoAPagare: 100, notaCredito: { nettoAPagare: 100 }, pagamenti: [{ importo: 20 }] }), 20);
  assert.equal(daRimborsareNota({ nettoAPagare: 100, notaCredito: { nettoAPagare: 40 }, pagamenti: [] }), 0);
});

test('anteprimaManuale: bollo oltre soglia, rivalsa cliente vince sulla config', () => {
  const base = { sogliaBolloVirtuale: 77.47, importoBollo: 2, rivalsaCliente: null, rivalsaConfig: true };
  assert.deepEqual(anteprimaManuale(1000, base), { imponibile: 1000, bolloApplicabile: true, bollo: 2, rivalsaInps: 40, nettoAPagare: 1040 });
  assert.equal(anteprimaManuale(50, base).bollo, 0);
  assert.equal(anteprimaManuale(1000, { ...base, rivalsaCliente: false }).rivalsaInps, 0);
  assert.equal(anteprimaManuale('abc', base).imponibile, 0);
});

test('indirizzoBech32NonValido', () => {
  assert.equal(indirizzoBech32NonValido('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), false);
  assert.equal(indirizzoBech32NonValido('bc1qbr0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), true);
  assert.equal(indirizzoBech32NonValido('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), false);
});

test('quotaIncasso e barrePianoCassa', () => {
  assert.equal(quotaIncasso(1000, 25), 250);
  assert.equal(quotaIncasso(1000, null), 0);
  const [b] = barrePianoCassa([{ data: '2026-06-30', scoperto: true, residuo: -50 }]);
  assert.equal(b.etichetta, 'Giu 2026');
  assert.equal(b.colore, 'var(--warn)');
  assert.equal(b.valore, 50);
  assert.match(b.valoreTesto, /^scoperto 50,00/);
});

test('barreRicaviMensili e fetteSoglia', () => {
  assert.equal(barreRicaviMensili([{ mese: 3, ricavi: 10 }])[0].etichetta, 'Mar');
  const f = fetteSoglia(85000, 90000, true, 'Incassato');
  assert.equal(f[0].colore, 'var(--warn)');
  assert.equal(f[1].valore, 0);
});

test('storicoGiornaliero: un punto al giorno, l\'ultimo vince', () => {
  const s = storicoGiornaliero([[new Date(2026, 0, 1, 1).getTime(), 1], [new Date(2026, 0, 1, 22).getTime(), 2], [new Date(2026, 0, 2, 5).getTime(), 3]]);
  assert.deepEqual(s.map((p) => p.valore), [2, 3]);
});

test('storicoGiornaliero: raggruppa per giorno locale, non UTC', () => {
  const s = storicoGiornaliero([[new Date(2026, 0, 1, 0, 30).getTime(), 1], [new Date(2026, 0, 1, 23, 30).getTime(), 2]]);
  assert.deepEqual(s.map((p) => [p.etichetta, p.valore]), [['01/01', 2]]);
});
