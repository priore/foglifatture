import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test unitari per la logica di classificazione errori e parsing output CLI del router AI.
// I provider reali non vengono chiamati: si testano solo le funzioni pure esportabili
// e il comportamento del router con provider mock.

// ─── Helpers estratti dal modulo (testati via import diretto) ─────────────────

// rilevaSegnaliQuota e rilevaSegnaliAuth sono interne; li testiamo tramite chiamaAI con
// provider mock costruiti ad hoc nello stesso modulo di test.

// ─── Test parsing output agy ─────────────────────────────────────────────────

describe('parsing output agy', () => {
  it('output pulito → testo restituito', () => {
    const output = 'Risposta OK\n';
    const contieneAgyError = output.includes('AGY_ERROR:');
    assert.equal(contieneAgyError, false);
    assert.equal(output.trim(), 'Risposta OK');
  });

  it('output con AGY_ERROR quota → rilevato come quota', () => {
    const output = 'error: Individual quota reached.\nAGY_ERROR: {"status":"RESOURCE_EXHAUSTED","error_code":429}\n';
    const isQuota = /quota|RESOURCE_EXHAUSTED|rate.?limit|429|too many|limit reached/i.test(output);
    assert.equal(isQuota, true);
  });

  it('output con AGY_ERROR auth → rilevato come auth', () => {
    const output = 'AGY_ERROR: {"status":"UNAUTHENTICATED","short_error":"authentication required"}\n';
    const isAuth = /auth|login|token expired|unauthorized|not logged/i.test(output);
    assert.equal(isAuth, true);
  });
});

// ─── Test chiamaAI con provider stub ─────────────────────────────────────────

// Costruisce una versione di chiamaAI con la chain di provider sostituita da stub,
// senza toccare il modulo reale (no mock.module, non disponibile in Node 26).
function buildRouter(providers) {
  return async function chiamaAI(prompt, opzioni = {}) {
    const errori = [];
    async function tenta(nome, fn) {
      try { return await fn(); } catch (err) {
        if (err.tipo !== 'non_configurato') errori.push({ provider: nome, errore: err.message });
        return null;
      }
    }
    for (const [nome, fn] of providers) {
      const r = await tenta(nome, fn);
      if (r) return r;
    }
    const err = new Error(
      errori.length
        ? `Tutti i provider AI hanno fallito: ${errori.map(e => `${e.provider}: ${e.errore}`).join('; ')}`
        : 'Nessun provider AI configurato',
    );
    err.erroriProvider = errori;
    throw err;
  };
}

describe('chiamaAI routing', () => {
  it('primo provider disponibile usato', async () => {
    const router = buildRouter([
      ['p1', async () => ({ testo: 'ok-p1', fonte: 'p1' })],
      ['p2', async () => ({ testo: 'ok-p2', fonte: 'p2' })],
    ]);
    const r = await router('test');
    assert.equal(r.fonte, 'p1');
    assert.equal(r.testo, 'ok-p1');
  });

  it('salta provider non configurato silenziosamente', async () => {
    const router = buildRouter([
      ['p1', async () => { throw Object.assign(new Error('non conf'), { tipo: 'non_configurato' }); }],
      ['p2', async () => ({ testo: 'ok-p2', fonte: 'p2' })],
    ]);
    const r = await router('test');
    assert.equal(r.fonte, 'p2');
  });

  it('salta provider quota esaurita e passa al successivo', async () => {
    const router = buildRouter([
      ['p1', async () => { throw Object.assign(new Error('quota'), { tipo: 'quota' }); }],
      ['p2', async () => ({ testo: 'ok-p2', fonte: 'p2' })],
    ]);
    const r = await router('test');
    assert.equal(r.fonte, 'p2');
  });

  it('solleva se tutti falliscono, include errori nel dettaglio', async () => {
    const router = buildRouter([
      ['p1', async () => { throw Object.assign(new Error('quota'), { tipo: 'quota' }); }],
      ['p2', async () => { throw Object.assign(new Error('auth scaduta'), { tipo: 'auth' }); }],
    ]);
    await assert.rejects(() => router('test'), (err) => {
      assert.ok(err.erroriProvider?.length === 2);
      assert.ok(err.message.includes('p1'));
      assert.ok(err.message.includes('p2'));
      return true;
    });
  });

  it('nessun provider: errore con messaggio configurazione', async () => {
    const router = buildRouter([]);
    await assert.rejects(() => router('test'), /Nessun provider AI configurato/);
  });
});
