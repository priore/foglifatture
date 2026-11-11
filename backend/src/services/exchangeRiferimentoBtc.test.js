import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { setDataDir } from '../lib/jsonStore.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir;
before(async () => { dir = await mkdtemp(join(tmpdir(), 'btc-')); setDataDir(dir); });
after(async () => { setDataDir(null); await rm(dir, { recursive: true, force: true }); });

test('valore mercato: fonte salvata, «manuale» senza fonte; exchange di riferimento validato', async () => {
  const m = await import('./movimentiBtcService.js');
  await m.impostaValoreMercato(2025, 74354.81, 'Binance, chiusura UTC 31/12/2025');
  await m.impostaValoreMercato(2024, 90000);
  let mov = await m.leggiMovimenti();
  assert.deepEqual(mov.fontiValoreMercato[2025], { fonte: 'Binance, chiusura UTC 31/12/2025' });
  assert.deepEqual(mov.fontiValoreMercato[2024], { manuale: true });
  assert.equal(m.exchangeEffettivo(mov), 'binance'); // nessun exchange noto: predefinito
  await assert.rejects(m.impostaExchangeRiferimento('pippo'), /non valido/);
  await m.impostaExchangeRiferimento('kraken');
  mov = await m.leggiMovimenti();
  assert.equal(m.exchangeEffettivo(mov), 'kraken');
  await m.impostaExchangeRiferimento(null);
  assert.equal((await m.leggiMovimenti()).exchangeRiferimento, null);
});
