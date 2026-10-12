import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambioPer } from './cambiValutaService.js';

function rates(codice, cambio) {
  // La Banca d'Italia può restituire { rates: [...] } o { dailyRates: [...] } — il service legge entrambi.
  return { rates: [{ isoCode: codice, avgRate: cambio, exchangeConventionCode: 'C' }] };
}

function deps(fetchFn, cache = new Map()) {
  return {
    fetch: fetchFn,
    readJson: async (k) => cache.get(k) ?? null,
    writeJson: async (k, v) => { cache.set(k, v); },
  };
}

test('restituisce cambio per data con quotazione', async () => {
  const d = deps(async () => ({ ok: true, json: async () => rates('USD', 1.0823) }));
  const r = await cambioPer('USD', '2026-10-09', d);
  assert.strictEqual(r.cambio, 1.0823);
  assert.strictEqual(r.fonte, 'Banca d\'Italia');
});

test('EUR restituisce 1 senza fetch', async () => {
  let chiamata = false;
  const d = deps(async () => { chiamata = true; });
  const r = await cambioPer('EUR', '2026-10-09', d);
  assert.strictEqual(r.cambio, 1);
  assert.ok(!chiamata);
});

test('usa cache se già presente', async () => {
  const cache = new Map();
  // La cache salva l'array flat (rates.rates), non l'oggetto wrapper.
  cache.set('cambi/2026-10-09', [{ isoCode: 'GBP', avgRate: 0.8341, exchangeConventionCode: 'C' }]);
  let chiamata = false;
  const d = deps(async () => { chiamata = true; }, cache);
  const r = await cambioPer('GBP', '2026-10-09', d);
  assert.strictEqual(r.cambio, 0.8341);
  assert.ok(!chiamata);
});

test('ripiego al giorno precedente se non c\'è quotazione', async () => {
  let chiamate = 0;
  const d = deps(async (url) => {
    chiamate++;
    if (url.includes('2026-10-11')) return { ok: true, json: async () => ({ rates: [] }) };
    if (url.includes('2026-10-10')) return { ok: true, json: async () => rates('CHF', 0.9412) };
    return { ok: true, json: async () => ({ rates: [] }) };
  });
  const r = await cambioPer('CHF', '2026-10-11', d);
  assert.strictEqual(r.cambio, 0.9412);
  assert.strictEqual(r.data, '2026-10-10');
  assert.ok(chiamate >= 2);
});

test('lancia errore se non trova quotazione nei 7 giorni', async () => {
  const d = deps(async () => ({ ok: true, json: async () => [] }));
  await assert.rejects(() => cambioPer('XXX', '2026-10-09', d), /Nessuna quotazione/);
});

test('lancia errore se fetch fallisce al primo tentativo', async () => {
  const d = deps(async () => ({ ok: false, status: 503 }));
  await assert.rejects(() => cambioPer('USD', '2026-10-09', d), /Banca d'Italia/);
});

test('data non valida lancia errore', async () => {
  const d = deps(async () => {});
  await assert.rejects(() => cambioPer('USD', 'non-una-data', d), /Data non valida/);
});
