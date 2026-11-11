// "Scimmia" dell'interfaccia: un utente che clicca e digita a caso, con seme riproducibile, su tutte le viste.
// Obiettivo: nessun errore JS, nessuna pagina bianca, nessun dialogo nativo, archivio ancora leggibile.
// Riproduzione: SEME=<numero> PASSI=<n> npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { avviaUi } from './ui.js';

const SEME = Number(process.env.SEME) || 20261109;
const PASSI = Number(process.env.PASSI) || 120;
const ROTTE = (process.env.ROTTE || '/dashboard,/timesheet,/fattura,/bitcoin,/versamenti-f24,/clienti,/impostazioni,/importa-storico,/pec-cronologia').split(',');
const VIETATI = /esporta|scarica|invia|controlla ora|riavvia|ripristina|importa|elimina|accetta|chat/i; // download, rete, distruttivi su file reali

function prng(seme) { let s = seme >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

let ui;
before(async () => { ui = await avviaUi(); });
after(async () => { await ui.chiudi(); });

test(`utente casuale: ${PASSI} azioni su ${ROTTE.length} viste (seme ${SEME})`, async () => {
  const rnd = prng(SEME);
  const scegli = (v) => v[Math.floor(rnd() * v.length)];
  const { page } = ui;
  const testi = ['', 'x', '0', '-1', '99999999', '<b>ciao</b>', '😀', 'a'.repeat(200), '31/02/2026', '09:00', 'IT60X0542811101000000123456'];
  const traccia = [];

  for (let i = 0; i < PASSI; i++) {
    if (i % 12 === 0) { const r = scegli(ROTTE); traccia.push(`vai ${r}`); await ui.vai(r); }
    const azione = rnd();
    try {
      if (azione < 0.55) {
        const bottoni = page.locator('button:visible, a.btn:visible, [role=button]:visible');
        const n = await bottoni.count();
        if (n) {
          const b = bottoni.nth(Math.floor(rnd() * n));
          const etichetta = ((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label')) || '').trim();
          if (!VIETATI.test(etichetta)) { traccia.push(`clic "${etichetta.slice(0, 30)}"`); await b.click({ timeout: 800 }); }
        }
      } else if (azione < 0.8) {
        const campi = page.locator('input:visible:not([type=file]):not([type=checkbox]):not([type=radio]), textarea:visible');
        const n = await campi.count();
        if (n) { const t = scegli(testi); traccia.push(`scrivi "${t.slice(0, 15)}"`); await campi.nth(Math.floor(rnd() * n)).fill(t, { timeout: 800 }); }
      } else if (azione < 0.9) {
        const tasto = scegli(['Escape', 'Tab', 'Enter', 'ArrowDown']); traccia.push(`tasto ${tasto}`); await page.keyboard.press(tasto);
      } else if (azione < 0.95) {
        traccia.push('indietro'); await page.goBack().catch(() => {});
        // tornare prima della prima pagina porta fuori dall'app (about:blank): l'utente riaprirebbe l'app
        if (!page.url().startsWith(ui.amb.base)) await ui.vai(ROTTE[0]);
      } else {
        traccia.push('ricarica'); await page.reload();
      }
    } catch { /* elemento sparito o coperto: un utente vero riproverebbe altrove */ }
    await page.waitForTimeout(40);
    assert.equal(ui.errori.length, 0, `seme ${SEME}, passo ${i}: ${ui.errori.join(' | ')}\nUltime azioni:\n${traccia.slice(-8).join('\n')}`);
    // la pagina può essere ancora in caricamento dopo un «indietro»: si concede un attimo prima di dirla bianca
    await page.waitForFunction(() => document.body.innerText.length > 20, null, { timeout: 3000 }).catch(() => {});
    const url = page.url().replace(ui.amb.base, '');
    assert.ok((await page.innerText('body').catch(() => 'x')).length > 20, `pagina bianca al passo ${i} su ${url}\n${traccia.slice(-8).join('\n')}`);
  }
  const config = await ui.amb.api('GET', '/api/config');
  assert.equal(config.stato, 200, "l'archivio resta leggibile");
  assert.equal((await ui.amb.api('GET', '/api/invoice/sequenza')).corpo.ok, true);
});
