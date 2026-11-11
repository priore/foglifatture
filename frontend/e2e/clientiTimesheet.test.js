// Simulazione utente: anagrafica clienti (aggiunta, modifica, disattivazione, eliminazione, validazione)
// e timesheet (compilazione, salvataggio, modifica, doppio salvataggio, ricarica).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { avviaUi, campo, pulsante } from './ui.js';
import { CLI } from '../../backend/src/flussi/datiModello.js';

let ui;
before(async () => { ui = await avviaUi(); });
after(async () => { await ui.chiudi(); });

const clienti = async () => (await ui.amb.api('GET', '/api/config')).corpo.clienti;
const conferma = (nome) => ui.page.locator('.cal-box.conferma-box').getByRole('button', { name: nome });

test('clienti: nuovo cliente compilato dalla UI e salvato', async () => {
  const { page } = ui;
  await ui.vai('/clienti');
  await page.getByRole('button', { name: '+ Aggiungi cliente' }).click();
  await campo(page, 'Denominazione').fill('Cliente Nuovo UI S.r.l.');
  await campo(page, 'Partita IVA').fill('11223344556');
  await campo(page, 'Codice destinatario SDI').fill('ABCDEFG');
  await campo(page, 'Tariffa oraria').fill('42');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.waitForTimeout(700);
  const salvato = (await clienti()).find((c) => c.denominazione === 'Cliente Nuovo UI S.r.l.');
  assert.ok(salvato, 'cliente persistito');
  assert.equal(salvato.tariffaOraria, 42);
  ui.verificaNessunErrore();
});

test('clienti imprevisto: P.IVA non valida mostra errore e non salva nulla', async () => {
  const { page } = ui;
  const prima = (await clienti()).length;
  await ui.vai('/clienti');
  await page.getByRole('button', { name: '+ Aggiungi cliente' }).click();
  await campo(page, 'Denominazione').fill('Cliente Sbagliato');
  await campo(page, 'Partita IVA').fill('123');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.waitForTimeout(700);
  assert.match(await page.innerText('body'), /Errore|Partita IVA/i);
  assert.equal((await clienti()).length, prima);
});

test('clienti: Elimina disattivato se il cliente ha dati; eliminabile se vuoto, con conferma ed Esc che annulla', async () => {
  const { page } = ui;
  await ui.vai('/clienti');
  await page.waitForTimeout(800);
  const conDati = (await ui.amb.api('GET', '/api/config/clienti/con-dati')).corpo.length;
  const bottoni = pulsante(page, 'Elimina');
  let disabilitati = 0;
  for (let i = 0; i < await bottoni.count(); i++) if (await bottoni.nth(i).isDisabled()) disabilitati++;
  assert.equal(disabilitati, conDati, 'Elimina disattivato esattamente per i clienti con dati');

  await page.getByRole('button', { name: '+ Aggiungi cliente' }).click();
  const prima = (await clienti()).length;
  const elimina = pulsante(page, 'Elimina').last();
  await elimina.click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cal-box.conferma-box').count(), 0, 'Esc chiude senza eliminare');
  await elimina.click();
  await conferma('Elimina').click();
  await page.waitForTimeout(500);
  assert.equal((await clienti()).length, prima, 'cliente mai salvato: nulla su disco da togliere');
  ui.verificaNessunErrore();
});

test('clienti: disattivazione richiede due conferme; il cliente resta nell\'archivio', async () => {
  const { page } = ui;
  await ui.vai('/clienti');
  await pulsante(page, 'Disattiva', { exact: true }).nth(1).click();
  await conferma('Disattiva').click();
  await conferma('Disattiva').click();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.waitForTimeout(700);
  assert.ok((await clienti()).some((c) => !c.attivo && c.id === CLI.rivalsa));
  ui.verificaNessunErrore();
});

// ── Timesheet (mese corrente) ─────────────────────────────────
const riga = (page, giorno) => page.locator('table tbody tr').nth(Number(giorno) - 1);
const mc = () => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1]; };

test('timesheet: ore digitate e salvate, totale ricalcolato, persistenza dopo ricarica', async () => {
  const { page } = ui;
  await ui.vai('/timesheet');
  const r = riga(page, '02');
  const campi = r.locator('input');
  await campi.nth(0).fill('09:00'); await campi.nth(1).fill('13:00');
  await campi.nth(2).fill('14:00'); await campi.nth(3).fill('18:00');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.waitForTimeout(700);
  const [a, m] = mc();
  const t = (await ui.amb.api('GET', `/api/timesheet/${a}/${m}/${CLI.it}`)).corpo;
  assert.equal(t.riepilogo.totaleOreDecimale, 8);
  await page.reload();
  assert.equal(await riga(page, '02').locator('input').nth(0).inputValue(), '09:00');
});

test('timesheet imprevisto: doppio click su Salva, modifica e azzeramento di un giorno', async () => {
  const { page } = ui;
  await ui.vai('/timesheet');
  const campi = riga(page, '02').locator('input');
  await campi.nth(3).fill('17:00');
  const salva = page.getByRole('button', { name: 'Salva', exact: true });
  await salva.dblclick();
  await page.waitForTimeout(700);
  const [a, m] = mc();
  assert.equal((await ui.amb.api('GET', `/api/timesheet/${a}/${m}/${CLI.it}`)).corpo.riepilogo.totaleOreDecimale, 7);
  await campi.nth(0).fill(''); await campi.nth(1).fill(''); await campi.nth(2).fill(''); await campi.nth(3).fill('');
  await salva.click();
  await page.waitForTimeout(700);
  assert.equal((await ui.amb.api('GET', `/api/timesheet/${a}/${m}/${CLI.it}`)).corpo.riepilogo.totaleOreDecimale, 0);
  ui.verificaNessunErrore();
});

test('timesheet imprevisto: orario spazzatura nel campo non manda in errore la pagina', async () => {
  const { page } = ui;
  await ui.vai('/timesheet');
  const campi = riga(page, '03').locator('input');
  await campi.nth(0).fill('99:99'); await campi.nth(1).fill('abc');
  await campi.nth(0).blur();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.waitForTimeout(600);
  const [a, m] = mc();
  const t = (await ui.amb.api('GET', `/api/timesheet/${a}/${m}/${CLI.it}`)).corpo;
  assert.ok(Number.isFinite(t.riepilogo.totaleOreDecimale));
  ui.verificaNessunErrore();
});

test('timesheet: export CSV VMS scarica un file', async () => {
  const { page } = ui;
  await ui.vai('/timesheet');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Esporta CSV/ }).click()]);
  assert.match(download.suggestedFilename(), /\.csv$/);
});
