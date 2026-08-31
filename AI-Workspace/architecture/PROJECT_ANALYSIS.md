# Project Analysis

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Stack versions

🟢 **Backend** (`backend/package.json`, ESM `type: module`): express ^5.2.1, express-session ^1.19.0, passport ^0.7.0, passport-google-oauth20 ^2.0.0, cors ^2.8.6, dotenv ^17.4.2, fast-xml-parser ^5.11.1, imapflow ^1.7.6, mailparser ^3.9.17, multer ^2.3.0, nodemailer ^9.0.6, xlsx ^0.18.5. No devDependencies.

🟢 **Frontend** (`frontend/package.json`, ESM): vue ^3.5.41, vue-router ^4.6.4, html2pdf.js ^0.14.0. Dev-only: @vitejs/plugin-vue ^6.0.8, vite ^8.2.2.

## Entry points

🟢 `backend/src/server.js` — port `process.env.PORT || 1969`. Middleware order: `express.json()` → `/api` request logger → `express-session` → `passport.initialize()` → `passport.session()`. Routes: `/auth` (unguarded) then `richiedeAutenticazione`-guarded `/api/config`, `/api/timesheet`, `/api/invoice`, `/api/oauth-config`, `/api/sdi`, `/api/import`, `/api/backup`, `/api/reminder`, `/api/forfettario`, `/api/mail`. Falls through to static `frontend/dist` + SPA catch-all, then global error handler. On listen: logs auth status, loads config, starts SDI polling (`avviaPollingSdi`).

🟢 `frontend/src/main.js` — creates Vue app, installs router, mounts `#app`. `frontend/index.html` — single `<div id="app">`, title "Timesheet & Fatturazione".

## NPM scripts

🟢 **Backend**: `start` → `node src/server.js`; `dev` → `node --watch src/server.js`; `test` → `node --experimental-test-module-mocks --test src/**/*.test.js`. No build step (plain Node).

🟢 **Frontend**: `dev` → `vite`; `build` → `vite build`; `preview` → `vite preview`. No test script.

## Environment configuration (`backend/.env.example`)

🟢 `PORT=1969` — app/API port. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials, empty disables login. `ALLOWED_EMAIL` — single-email access whitelist. `SESSION_SECRET` — express-session cookie signing secret. 🟡 A Gemini API key is also read by `envService.js`/`geminiAtecoService.js` for the optional ATECO-lookup wizard step — exact env var name not verified line-by-line.

## Folder map

🟢 `backend/src/lib/` — auth.js (passport/OAuth), jsonStore.js (flat-file persistence), logger.js (file+console logging), macNotifier.js (native mac notifications).

🟢 `backend/src/routes/` — one Express router per domain: auth, backup, config, forfettario, import, invoice, mail, oauth-config, reminder, sdi, timesheet.

🟢 `backend/src/services/` — backupService, configService, envService, fatturaPaXmlGenerator (+test), fatturaPaXmlValidator (+test), forfettarioService (+test), geminiAtecoService, invoiceService (+test), mailService, pecService (+test, +e2e test), reminderService, scartoSuggerimenti, sdiRicevuteService (+test), timeCalculator (+test), timesheetService, vmsTimesheetExporter, xlsTimesheetImporter, xmlInvoiceImporter.

🟢 `frontend/src/components/` — subfolders `common/` (AppSidebar, ClienteSwitcher, LogoPlaceholder, MonthSwitcher), `fattura/`, `timesheet/`, `wizard/` (by feature), plus top-level `DonutChart.vue`. `frontend/src/views/` — TimesheetView, FatturaView, DashboardView, ImportaStoricoView, ImpostazioniView, CronologiaPecView. `frontend/src/composables/` — useMailto, usePdfExport, useTimeCalculator, useValidazioneFiscale. `frontend/src/services/api.js` — HTTP client. `frontend/src/router/index.js` — route table.

## Data storage

🟢 `backend/src/lib/jsonStore.js`: `DATA_DIR = backend/data`, flat JSON per collection via `readJson`/`writeJson`/`listKeys`. Layout: `config.json` (root app config, `clienti[]` array), `invoices/<anno>-<mese>-<clienteId>.json`, `timesheets/<anno>-<mese>-<clienteId>.json`, `mail-outbox/` (generated PDF attachments for outgoing mail). No database.

## Test setup

🟢 Runner: Node built-in `node:test` (`node --experimental-test-module-mocks --test src/**/*.test.js`), assertions via `node:assert/strict`. Test files: `timeCalculator.test.js`, `fatturaPaXmlGenerator.test.js`, `fatturaPaXmlValidator.test.js`, `forfettarioService.test.js`, `invoiceService.test.js`, `pecService.test.js`, `pecService.e2e.js` (real-mailbox end-to-end, not run by default CI), `sdiRicevuteService.test.js`.

## Logging

🟢 `backend/src/lib/logger.js`: `LOG_DIR = backend/logs`, JSON-lines to file + mirrored console. Three loggers: `logger` → `app.log`, `pecLogger` → `pec.log`, `sdiLogger` → `sdi.log`. All three files are populated in normal operation (PEC has been exercised against a real mailbox).

---

## Review Checklist

- **Completeness:** stack, entry points, scripts, env vars, folder map, storage, tests, logging all covered.
- **Accuracy:** all claims read directly from package.json, server.js, .env.example, jsonStore.js, logger.js, and directory listings.
- **Consistency:** aligns with `PROJECT_CONTEXT.md` workflow description and `DESIGN_PATTERNS_AS_IS.md`.
- **TODO:** none outstanding.
- **Missing information:** exact shape/schema of `invoices/*.json`/`timesheets/*.json` not yet documented field-by-field; exact Gemini env var name unverified.
- **Open questions:** is `cors` dependency actually used anywhere, or vestigial? (See `ARCHITECTURE.md` — confirmed unused in `server.js`.)
- **Confidence level:** predominantly 🟢, one 🟡 inference (Gemini env var naming).
