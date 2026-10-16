# Project Analysis

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Stack e dipendenze

🟢 **Backend** (`backend/package.json`, ESM): express ^5.2.1, express-session, passport + passport-google-oauth20, dotenv, fast-xml-parser, imapflow, mailparser, multer, nodemailer, keytar, node-notifier, pdf-lib, pdf2json, xlsx (tarball SheetJS 0.20.3). Nessuna devDependency.

🟢 **Frontend** (`frontend/package.json`, ESM): vue ^3.5, vue-router ^4.6, handlebars (rendering template di stampa), html2pdf.js, qrcode-generator. Dev: vite, @vitejs/plugin-vue.

## Entry point

🟢 `backend/src/server.js` — porta `PORT || 1969`. Serve `frontend/dist` e le API (dettaglio in `ARCHITECTURE.md`). All'avvio avvia i job in background: polling SDI, backup automatico (se abilitato), promemoria fine mese (se abilitato), promemoria scarti SDI, monitoraggio fonti normative, notifiche fiscali.

🟢 `backend/src/mcpStdio.js` — entry point alternativo del server MCP via stdio, lanciato dal client AI come processo figlio. Non avvia Express né polling.

🟢 `frontend/src/main.js` — monta l'app Vue con router su `#app`.

## Script npm

🟢 **Backend**: `start` (`node src/server.js`), `dev` (`node --watch`), `test` (`node --experimental-test-module-mocks --test` su tutti i `*.test.js` sotto `src`).

🟢 **Frontend**: `dev` (vite, proxy di `/api` e `/auth` su `localhost:1969`), `build`, `preview`. Nessun test.

## Configurazione

🟢 `backend/.env` (da `.env.example`): `PORT`, `GOOGLE_CLIENT_ID`, `ALLOWED_EMAIL`, `SESSION_SECRET`, `GEMINI_MODEL`, `GROQ_MODEL`. `envService.js` gestisce anche `CLAUDE_MODEL`, `CLAUDE_WORKSPACE_ID`, `LLM_LOCALE_URL`, `AI_PROVIDER_DISABILITATI`.

🟢 Segreti nel Keychain OS via `keytar`, servizio `Timesheet-Fatturazione`: client secret Google, API key Gemini/Groq/Claude, password PEC, password backup. Non finiscono in `config.json`, `.env` o backup.

🟢 Dati di dominio in `backend/data/config.json` (gitignored). Il percorso dati è sovrascrivibile da Impostazioni (`config.dati.percorso`, applicato all'avvio da `applicaPercorsoDatiAllAvvio`).

## Mappa cartelle

🟢 `backend/src/lib/` — `auth.js`, `jsonStore.js`, `logger.js`, `notifier.js` (node-notifier cross-platform), `iban.js`, `email.js`, `pagamento.js`, `zipReader.js` (ZIP minimale, solo stdlib).

🟢 `backend/src/routes/` — un router per dominio: auth, config, timesheet, invoice, oauthConfig, sdi, pec, import, backup, reminder, forfettario, mail, sistema, update, template, regoleFiscali, mcp, chat.

🟢 `backend/src/services/` — logica di dominio, raggruppabile così:
- **Fatturazione**: `invoiceService`, `fatturaPaXmlGenerator`, `fatturaPaXmlValidator`, `scartoSuggerimenti`, `clienteEsteroService`, `cambiValutaService`, `templateService`, `exportService`
- **PEC/SDI**: `pecService`, `pecProvaService`, `sdiRicevuteService`, `sdiScartoReminderService`, `mailService`
- **Timesheet**: `timesheetService`, `timeCalculator`, `vmsTimesheetExporter`
- **Fiscale**: `forfettarioService`, `stimaVersamentiService`, `versamentiF24Service`, `f24StateService`, `f24PdfService`, `bolloTrimestrale`, `creditiService`, `scadenzeFiscaliService`, `pagamentiFattureService`
- **Regole e fonti**: `regoleFiscaliService`, `fontiNormativeService`, `monitoraggioFontiService`, `notificheFiscaliService`
- **AI**: `aiRouterService`, `geminiAtecoService`, `chatService`, `mcpService`, `envService`
- **Import/backup**: `xlsTimesheetImporter`, `xmlInvoiceImporter`, `importZipService`, `backupService`
- **Sistema**: `configService`, `reminderService`, `updateService`

🟢 `backend/src/data/` (versionata) — `atecoSettori.json`, `sediInps.json`, `gestoriPec.json`, `regole/<anno>.json`, `fonti/registro.json` + `fonti/testi/`.

🟢 `backend/src/templates-default/` — 10 template di stampa (5 fattura, 5 timesheet), ognuno con `layout.html`, `layout.css`, `template.json`.

🟢 `frontend/src/` — `views/` (9 viste), `components/` (`common/`, `timesheet/`, `wizard/` più grafici e chat), `composables/` (8), `services/api.js`, `router/index.js`, `style.css`, `wizardImpostazioniPassi.js`, `wizardImportaStoricoPassi.js`.

🟢 Fuori da `backend/`/`frontend/`: `scripts/` (install/uninstall/update per mac e Windows), `packaging/` (build `.pkg` macOS e installer Windows), `.github/workflows/` (CI, CodeQL, gitleaks, license-check, scorecard, CLA, dependabot), `docs/`.

## Storage

🟢 `jsonStore.js`: `readJson`/`writeJson`/`listKeys` su `DATA_DIR` (default `backend/data/`, mutabile con `setDataDir`). Nessun database. Layout principale:
- `config.json` — configurazione (fornitore, `clienti[]`, fatturazione, pec, sdi, backup, reminder, forfettario, dati, ai, mcp, notifiche, `walletBtc`)
- `invoices/<anno>-<mese>-<clienteId>.json`, `timesheets/<anno>-<mese>-<clienteId>.json`
- `f24Versamenti.json`, `crediti.json`, `scadenzeFiscali.json`, `pagamentiMappingColonne.json`
- `regole-attive/<anno>.json`, `regole-proposte/<anno>.json`, `fonti-cambiate.json`
- `cambi/` (cache cambi), `modelli/f24-ordinario.pdf` (modello AdE scaricato al primo uso, impronta SHA-256 verificata), `mail-outbox/` (PDF allegati)

## Test

🟢 Runner built-in `node:test`, asserzioni `node:assert/strict`. 35 file `*.test.js` (servizi e lib). `pecService.e2e.js` è un test su casella reale, escluso dall'esecuzione di default.

🟢 CI (`.github/workflows/ci.yml`): `backend-test` (Node 26, installa libsecret per keytar) e `frontend-build` (Node 20).

## Logging

🟢 `lib/logger.js`: JSON-lines su `backend/logs/` con tre logger — `logger` (`app.log`), `pecLogger` (`pec.log`), `sdiLogger` (`sdi.log`) — mirror su console.

---

## Review Checklist

- **Completeness:** stack, entry point, script, config, cartelle, storage, test, log.
- **Accuracy:** verificato su `package.json`, `server.js`, `.env.example`, `jsonStore.js`, `envService.js`, listing directory (2026-10-13).
- **Consistency:** coerente con `ARCHITECTURE.md` e `PROJECT_CONTEXT.md`.
- **TODO:** nessuno.
- **Missing information:** schema campo per campo di `invoices/*.json` e `timesheets/*.json`.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
