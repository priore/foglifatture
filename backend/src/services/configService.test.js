import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaConfigCripto } from './configService.js';

test('config cripto: valori validi e assenti accettati', () => {
  validaConfigCripto({});
  validaConfigCripto({ metodoPlusvalenze: 'lifo', importBtc: { confermeMinime: 3, intervalloMinuti: 30, urlPrimario: 'https://mempool.space/api' } });
});

test('config cripto: valori non validi rifiutati', () => {
  assert.throws(() => validaConfigCripto({ metodoPlusvalenze: 'fifo' }), /lifo/);
  assert.throws(() => validaConfigCripto({ importBtc: { confermeMinime: 0 } }), /Conferme/);
  assert.throws(() => validaConfigCripto({ importBtc: { intervalloMinuti: 1.5 } }), /Intervallo/);
  assert.throws(() => validaConfigCripto({ importBtc: { urlFallback: 'ftp://x' } }), /URL/);
  assert.throws(() => validaConfigCripto({ importBtc: { urlPrimario: 'non-url' } }), /URL/);
});
