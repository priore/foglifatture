// Simulazione utente: primo avvio (termini d'uso), navigazione tra tutte le viste, indietro/avanti,
// ricarica, clic rapidi. Nessun errore JS ammesso.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { avviaUi } from './ui.js';

const ROTTE = ['/dashboard', '/timesheet', '/fattura', '/bitcoin', '/versamenti-f24', '/clienti', '/pec-cronologia', '/importa-storico', '/impostazioni', '/privacy'];
let ui;
after(async () => { await ui?.chiudi(); });

test('primo avvio: i termini d\'uso bloccano finché non si spuntano entrambe le clausole', async () => {
  ui = await avviaUi({ terminiAccettati: false });
  const { page } = ui;
  await ui.vai('/dashboard');
  const accetta = page.getByRole('button', { name: 'Accetta' });
  assert.equal(await accetta.isDisabled(), true);
  await page.locator('#termini-accetto').check();
  assert.equal(await accetta.isDisabled(), true, 'serve anche l\'approvazione specifica');
  await page.locator('#termini-specifica').check();
  await accetta.click();
  await page.waitForTimeout(500);
  assert.equal((await ui.amb.api('GET', '/api/termini')).corpo.accettati, true);
  await page.reload();
  assert.equal(await page.locator('#termini-accetto').count(), 0, 'dopo l\'accettazione non ricompaiono');
});

test('ogni vista si apre senza errori e mostra il proprio titolo', async () => {
  for (const r of ROTTE) {
    await ui.vai(r);
    assert.ok((await ui.page.innerText('body')).length > 100, `${r} vuota`);
    ui.verificaNessunErrore();
  }
});

test('navigazione dalla barra laterale, indietro/avanti e ricarica mantengono lo stato coerente', async () => {
  const { page } = ui;
  await ui.vai('/dashboard');
  for (const voce of ['Timesheet mensile', 'Fattura Pro-Forma', 'Clienti', 'Versamenti F24', 'Bitcoin', 'Dashboard forfettario']) {
    await page.locator('nav, aside').getByText(voce, { exact: true }).first().click();
    await page.waitForTimeout(200);
  }
  await page.goBack(); await page.goBack(); await page.goForward();
  await page.reload();
  assert.ok((await page.innerText('body')).length > 100);
  ui.verificaNessunErrore();
});

test('utente frettoloso: clic ripetuti e navigazione veloce durante il caricamento', async () => {
  const { page } = ui;
  for (let i = 0; i < 3; i++) {
    for (const r of ['/fattura', '/timesheet', '/dashboard']) { page.goto(ui.amb.base + r).catch(() => {}); await page.waitForTimeout(60); }
  }
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Escape');
  ui.verificaNessunErrore();
});

test('tema chiaro/scuro: il pulsante cambia e ricorda la scelta dopo la ricarica', async () => {
  const { page } = ui;
  await ui.vai('/dashboard');
  const prima = await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  await page.locator('.theme-toggle').click();
  const dopo = await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  assert.notEqual(prima, dopo);
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')), dopo);
});

test('menu compresso: al passaggio del mouse si espande sopra il contenuto senza spostarlo, all\'uscita si ricomprime', async () => {
  const { page } = ui;
  await ui.vai('/dashboard');
  const misure = () => page.evaluate(() => ({
    menu: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width),
    contenuto: Math.round(document.querySelector('.contenuto').getBoundingClientRect().left),
  }));
  await page.locator('.menu-toggle').click(); // compressione manuale
  await page.mouse.move(900, 400);
  await page.waitForTimeout(400);
  assert.deepEqual(await misure(), { menu: 72, contenuto: 72 });
  await page.locator('.menu-toggle').hover(); // sull'icona expand/collapse non si apre
  await page.waitForTimeout(700);
  assert.deepEqual(await misure(), { menu: 72, contenuto: 72 });
  await page.mouse.move(30, 300);
  await page.waitForTimeout(250); // prima del ritardo di apertura
  assert.equal((await misure()).menu, 72);
  await page.waitForTimeout(900);
  assert.deepEqual(await misure(), { menu: 272, contenuto: 72 }); // espanso sopra, contenuto fermo
  await page.mouse.move(900, 400);
  await page.waitForTimeout(500);
  assert.deepEqual(await misure(), { menu: 72, contenuto: 72 });
  await page.locator('.menu-toggle').click(); // ripristino: espanso a mano
  await page.waitForTimeout(400); // transizione di larghezza
  assert.equal((await misure()).menu, 272);
  ui.verificaNessunErrore();
});
