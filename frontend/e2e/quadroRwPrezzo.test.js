// Simulazione utente: Quadro RW Bitcoin, prezzo EUR/BTC al 31/12 recuperato in automatico dall'exchange di
// riferimento, fonte mostrata, correzione a mano («Inserito a mano»), ripristino e cambio exchange.
// Le quotazioni degli exchange sono simulate: il server di prova non esce mai in rete.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { avviaUi, pulsante } from './ui.js';

const T = Date.UTC(2025, 11, 31);
const fetchReale = globalThis.fetch;
const json = (corpo) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } });
let ui;
before(async () => {
  globalThis.fetch = async (url, ...resto) => {
    const u = String(url);
    if (u.includes('api.binance.com')) return json([[T, '1', '2', '3', '74354.81']]);
    if (u.includes('api.kraken.com')) return json({ error: [], result: { XXBTZEUR: [[T / 1000, '1', '2', '3', '74500.1']] } });
    if (u.includes('coinbase.com')) return json([[T / 1000, 1, 2, 3, 74473.24, 5]]);
    return fetchReale(url, ...resto);
  };
  ui = await avviaUi();
});
after(async () => { globalThis.fetch = fetchReale; await ui.chiudi(); });

const prezzi = async () => (await ui.amb.api('GET', '/api/forfettario/btc/rw?anno=2026')).corpo.prezzi;

test('Quadro RW: il prezzo mancante al 31/12 si recupera da solo e mostra la fonte', async () => {
  const { page } = ui;
  await ui.vai('/dashboard');
  await page.locator('.tab-toggle').getByRole('button', { name: 'Bitcoin' }).click();
  await page.getByText('Binance, chiusura UTC 31/12/2025').waitFor();
  const p = (await prezzi()).inizio;
  assert.equal(p.valore, 74354.81);
  assert.match(p.fonte, /Binance/);
  assert.ok(!p.manuale);
  ui.verificaNessunErrore();
});

test('Quadro RW: correzione a mano → «Inserito a mano», poi ripristino automatico', async () => {
  const { page } = ui;
  await page.locator('#prezzo-inizio').fill('70000');
  await pulsante(page, 'Salva').first().click();
  await page.getByText('Inserito a mano').waitFor();
  assert.equal((await prezzi()).inizio.manuale, true);
  await page.getByText('Ripristina il valore automatico').click();
  await page.getByText('Binance, chiusura UTC 31/12/2025').waitFor();
  assert.equal((await prezzi()).inizio.valore, 74354.81);
  ui.verificaNessunErrore();
});

test('Quadro RW: cambio exchange riallinea il prezzo automatico; exchange senza prezzo → messaggio, valore invariato', async () => {
  const { page } = ui;
  await page.getByText(/^Automatico:/).click();
  await page.locator('.cal-box, .lista-popup, [role="dialog"]').getByText('Kraken').first().click();
  await pulsante(page, 'OK').click();
  await page.getByText('Kraken, chiusura UTC 31/12/2025').waitFor();
  assert.equal((await prezzi()).inizio.valore, 74500.1);
  // exchange noto ma senza API storica: errore leggibile, prezzo precedente conservato
  await ui.amb.api('PUT', '/api/forfettario/btc/rw/exchange-riferimento', { exchange: 'pippo' }).then((r) => assert.equal(r.stato, 400));
  const r = await ui.amb.api('GET', '/api/forfettario/btc/rw/prezzo-storico?anno=2025&exchange=onetrading');
  assert.equal(r.stato, 400);
  assert.match(r.corpo.errore, /non disponibile per/);
  assert.equal((await prezzi()).inizio.valore, 74500.1);
  ui.verificaNessunErrore();
});
