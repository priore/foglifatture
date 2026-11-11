// Harness per i test di simulazione utente nel browser (Chromium via playwright-core).
// Sandbox: server in-process con cartella dati temporanea e modello dati fittizio, porta casuale,
// nessuna rete esterna (le route non montate rispondono 404). Mai la porta 1969 né dati reali.
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { creaAmbiente } from '../../backend/src/flussi/ambiente.js';
import { popolaModello } from '../../backend/src/flussi/datiModello.js';

function eseguibileChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const radice = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const cartelle = fs.existsSync(radice) ? fs.readdirSync(radice).filter((d) => d.startsWith('chromium-')).sort() : [];
  const candidati = cartelle.map((d) => path.join(radice, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
  const trovato = candidati.reverse().find((p) => fs.existsSync(p));
  if (!trovato) throw new Error('Chromium per Playwright non trovato: eseguire `npx playwright-core install chromium` o impostare PLAYWRIGHT_CHROMIUM');
  return trovato;
}

// Errori di console attesi e innocui: risorse 404 delle route volutamente non montate in sandbox
// e dei GET di dati non ancora creati (es. fattura di un mese mai emessa).
// 400/409: rifiuti di validazione del server davanti a input sbagliati (la UI li mostra all'utente).
const ATTESI = [/status of 404/, /status of 503/, /status of 40[09] /];

export async function avviaUi({ terminiAccettati = true, viewport = { width: 1280, height: 900 } } = {}) {
  const amb = await creaAmbiente({ statico: true });
  const modello = await popolaModello(amb);
  if (terminiAccettati) await amb.api('POST', '/api/termini/accetta', { approvazioneSpecifica: true });
  const browser = await chromium.launch({ executablePath: eseguibileChromium() });
  const contesto = await browser.newContext({ viewport, acceptDownloads: true });
  // Sandbox di rete: il browser non esce mai verso servizi esterni (es. quotazioni BTC); le richieste
  // esterne ricevono 503 con CORS aperto, così la UI esercita il proprio ramo «servizio non disponibile».
  await contesto.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname), (route) => route.fulfill({
    status: 503, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}',
  }));
  const page = await contesto.newPage();
  page.setDefaultTimeout(5000);
  const errori = [];
  page.on('console', (m) => { if (m.type() === 'error' && !ATTESI.some((r) => r.test(m.text()))) errori.push(`console: ${m.text().slice(0, 300)} @ ${m.location().url.replace(amb.base, '')}`); });
  page.on('pageerror', (e) => errori.push(`pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')} @ ${page.url().replace(amb.base, '')}`));
  page.on('dialog', (d) => { errori.push(`dialog nativo inatteso: ${d.message()}`); d.dismiss(); });

  const vai = async (percorso) => { errori.length = 0; await page.goto(amb.base + percorso); await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {}); /* alcune viste fanno polling: basta il load */ };
  return {
    amb, modello, page, errori, vai,
    // Nessun errore JS/console inatteso durante il test.
    verificaNessunErrore() {
      if (errori.length) throw new Error(`Errori nel browser:\n${errori.join('\n')}`);
    },
    async chiudi() { await browser.close(); await amb.chiudi(); },
  };
}

// Campo di un form identificato dalla sua etichetta (label seguita dal suo input/textarea).
export const campo = (page, etichetta) => page.locator(`xpath=//label[starts-with(normalize-space(.),"${etichetta}")]/following-sibling::*[self::input or self::textarea][1]`).filter({ visible: true }).first();

// DateField: apre il calendario sul campo n-esimo e sceglie il giorno del mese visualizzato.
export async function scegliData(page, indiceCampo, giorno, ambito = '.cal-box ') {
  await page.locator(`${ambito}.date-field`).nth(indiceCampo).click();
  await page.locator('.cal-box .cal-giorno', { hasText: new RegExp(`^${giorno}$`) }).first().click();
  await page.locator('.cal-box').getByRole('button', { name: 'OK' }).click();
}

export const popup = (page) => page.locator('.cal-box').last();

// Pulsante visibile per nome (la UI ha cloni responsive nascosti per layout compatto/esteso).
export const pulsante = (page, nome, opzioni = {}) => page.getByRole('button', { name: nome, ...opzioni }).filter({ visible: true });
