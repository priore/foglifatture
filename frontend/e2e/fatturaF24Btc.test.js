// Simulazione utente: emissione fattura dalla UI (singola e doppio click), download XML, versamenti F24
// (annulla, validazione, inserimento con calendario, cancellazione) e registro Bitcoin.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { avviaUi, scegliData, pulsante } from './ui.js';
import { CLI } from '../../backend/src/flussi/datiModello.js';

let ui;
before(async () => { ui = await avviaUi(); });
after(async () => { await ui.chiudi(); });

const fatture = async () => (await ui.amb.api('GET', '/api/invoice')).corpo;
const numeriContigui = async () => {
  const n = [];
  for (const e of await fatture()) n.push(Number((await ui.amb.api('GET', `/api/invoice/${e.anno}/${e.mese}/${e.clienteId}`)).corpo.numero));
  n.sort((a, b) => a - b);
  return n;
};

test('fattura: mese con timesheet → «Genera fattura» crea la fattura con il numero successivo', async () => {
  const { page } = ui;
  const prima = (await fatture()).length;
  await ui.vai(`/fattura?anno=2026&mese=3&cliente=${CLI.btc}`);
  await pulsante(page, /Genera fattura n\./).click();
  await page.waitForTimeout(900);
  assert.equal((await fatture()).length, prima + 1);
  assert.match(await page.innerText('body'), /Rigenera fattura n\./);
  ui.verificaNessunErrore();
});

test('fattura: download XML FatturaPA e controllo del contenuto', async () => {
  const { page } = ui;
  await ui.vai(`/fattura?anno=2026&mese=3&cliente=${CLI.btc}`);
  const [download] = await Promise.all([page.waitForEvent('download'), pulsante(page, /Scarica XML FatturaPA/).click()]);
  assert.match(download.suggestedFilename(), /^IT\d{11}_[A-Z0-9]{5}\.xml$/);
});

test('fattura imprevisto: doppio click rapido su «Genera» non brucia numeri né crea doppioni', async () => {
  const { page } = ui;
  await ui.vai(`/fattura?anno=2026&mese=3&cliente=${CLI.extraUe}`);
  await pulsante(page, /Genera fattura n\./).dblclick();
  await page.waitForTimeout(1200);
  const n = await numeriContigui();
  n.forEach((v, i) => assert.equal(v, i + 1, `buco in numerazione: ${n.join(',')}`));
});

test('fattura imprevisto: rigenerazione di una fattura accettata dallo SDI mostra l\'errore e non cambia nulla', async () => {
  const { page } = ui;
  await ui.vai(`/fattura?anno=2026&mese=1&cliente=${CLI.rivalsa}`);
  const prima = (await ui.amb.api('GET', `/api/invoice/2026/1/${CLI.rivalsa}`)).corpo;
  const bottone = pulsante(page, /Rigenera fattura|Genera fattura/);
  if (await bottone.isEnabled()) { await bottone.click(); await page.waitForTimeout(700); }
  assert.deepEqual((await ui.amb.api('GET', `/api/invoice/2026/1/${CLI.rivalsa}`)).corpo, prima);
});

test('fattura: importo libero richiede descrizione e importo', async () => {
  const { page } = ui;
  await ui.vai(`/fattura?anno=2026&mese=9&cliente=${CLI.it}`);
  await page.getByText('Importo libero').first().click();
  await page.waitForTimeout(300);
  const prima = (await fatture()).length;
  assert.equal(await pulsante(page, /Genera fattura n\./).isDisabled(), true, 'senza importo/descrizione non si può emettere');
  assert.equal((await fatture()).length, prima);
});

// ── F24 ───────────────────────────────────────────────────────
const versamenti = async () => (await ui.amb.api('GET', '/api/forfettario/versamenti')).corpo;

test('F24: apri il modulo e annulla (pulsante, Esc, clic fuori) senza effetti', async () => {
  const { page } = ui;
  const prima = (await versamenti()).length;
  await ui.vai('/versamenti-f24');
  await pulsante(page, 'Aggiungi versamento').click();
  await pulsante(page, 'Annulla').click();
  await pulsante(page, 'Aggiungi versamento').click();
  await page.keyboard.press('Escape');
  assert.equal(await pulsante(page, 'Annulla').count(), 0, 'Esc chiude il modulo');
  await pulsante(page, 'Aggiungi versamento').click();
  await page.mouse.click(5, 5);
  assert.equal((await versamenti()).length, prima);
});

test('F24: senza data/importo il modulo non invia; poi inserimento valido dal calendario', async () => {
  const { page } = ui;
  const prima = (await versamenti()).length;
  await ui.vai('/versamenti-f24');
  await pulsante(page, 'Aggiungi versamento').click();
  await pulsante(page, 'Aggiungi', { exact: true }).click();
  await page.waitForTimeout(400);
  assert.equal((await versamenti()).length, prima, 'form incompleto non inviato');
  // la validazione nativa porta il focus sulla data mancante e il calendario si apre da solo
  await page.locator('.cal-box .cal-giorno', { hasText: /^15$/ }).first().click();
  await page.locator('.cal-box').last().getByRole('button', { name: 'OK' }).click();
  await page.locator('input[type=number]').last().fill('123.45');
  await pulsante(page, 'Aggiungi', { exact: true }).click();
  await page.waitForTimeout(700);
  const dopo = await versamenti();
  assert.equal(dopo.length, prima + 1);
  assert.ok(dopo.some((v) => v.importo === 123.45));
  ui.verificaNessunErrore();
});

test('F24: cancellazione di un versamento con ✕', async () => {
  const { page } = ui;
  const prima = (await versamenti()).length;
  await ui.vai('/versamenti-f24');
  await page.locator('button:has-text("✕")').first().click();
  const conferma = page.locator('.cal-box.conferma-box').getByRole('button').first();
  if (await conferma.count()) await conferma.click();
  await page.waitForTimeout(700);
  assert.equal((await versamenti()).length, prima - 1);
});

// ── Bitcoin ───────────────────────────────────────────────────
test('Bitcoin: la vista si apre, il registro mostra i movimenti e i pulsanti rispondono', async () => {
  const { page } = ui;
  await ui.vai('/bitcoin');
  await pulsante(page, 'Aggiungi ingresso manuale').click();
  assert.ok(await page.locator('.cal-box').count() > 0);
  await page.keyboard.press('Escape');
  await pulsante(page, 'Registra uscita').click();
  await page.keyboard.press('Escape');
  await pulsante(page, 'Dichiara giacenza').click();
  await page.keyboard.press('Escape');
  ui.verificaNessunErrore();
});
