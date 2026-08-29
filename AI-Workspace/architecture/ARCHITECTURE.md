# Architecture

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## System shape

🟢 Monolithic Express backend + Vue 3 SPA frontend, single deployable: in production Express serves the built `frontend/dist` and answers `/api` and `/auth` itself (one origin, one port `1969`). In dev, Vite runs separately and proxies `/api` and `/auth` to `http://localhost:1969` (`frontend/vite.config.js`). No database — flat JSON files via `jsonStore.js`.

## Request pipeline (`backend/src/server.js`)

🟢 Middleware order: `express.json()` → `/api` request logger (`logger`) → `express-session` → `passport.initialize()` → `passport.session()` → routers → `express.static(frontend/dist)` → SPA fallback (`GET /{*splat}` → `index.html`) → global 4-arg error handler (logs via `logger.error`, responds `500 { errore: 'Errore interno del server' }`).

🟢 Routers mounted: `/auth` → `authRoutes.js` (unguarded); all of `/api/config`, `/api/timesheet`, `/api/invoice`, `/api/oauth-config`, `/api/sdi`, `/api/import` wrapped in `richiedeAutenticazione` (`lib/auth.js`).

🟢 Session: `express-session({ secret: process.env.SESSION_SECRET || 'segreto-di-sviluppo', resave: false, saveUninitialized: false })`. No explicit store configured. 🟡 Inferred: default in-memory `MemoryStore` — acceptable for a single-user local app, not production-safe at scale (not a concern here given `PROJECT_CONTEXT.md`'s single-user model).

🟢 `cors` is a listed dependency (`package.json`) but `cors()` middleware is never applied in `server.js` — 🟡 inferred vestigial/unused dependency (same-origin architecture makes it unnecessary).

🟢 Startup: listens on `process.env.PORT || 1969`; on listen, logs auth status, awaits `getConfig()`, then starts background job `avviaPollingSdi(getConfig, config.sdi.intervalloPollingMinuti)`.

## Frontend ↔ backend communication

🟢 `frontend/src/services/api.js`: `BASE_URL = '/api'`, relative/same-origin, all calls via native `fetch` (no axios). Shared private `richiesta()` helper adds JSON headers and uniform error extraction.

🟢 `authApi` (stato/logout) calls `/auth/...` directly, bypassing the `/api` wrapper.

## Key flow: generate and send an invoice

🟢 Full trace, function-level:
1. `FatturaView.vue` `generaFattura()` → `api.generaFattura(anno, mese, dati)` → `POST /api/invoice/:anno/:mese/genera`.
2. `invoiceRoutes.js` handler: `getConfig()`, `getTimesheet()`, `calcolaRiepilogo()`, `calcolaCompenso()` (`invoiceService.js`/`timesheetService.js`) → computes numero/data/descrizione → `saveInvoice()` (JSON persist).
3. Download: `api.urlDownloadXml` opens `GET /api/invoice/:anno/:mese/xml`; route loads saved invoice + config, calls `generaXmlFatturaPA()` + `generaNomeFileXml()` (`fatturaPaXmlGenerator.js`), streams XML as attachment.
4. Send: `FatturaView.vue` `inviaPec()` → `POST /api/invoice/:anno/:mese/invia-pec`; route regenerates XML, calls `inviaFatturaViaPec(config.pec, { nomeFile, contenutoXml })` (`pecService.js`, nodemailer).
5. Receipts: `FatturaView.vue` `api.controllaRicevuteSdi()` → `POST /api/sdi/controlla` → `controllaRicevuteSdi()` (`sdiRicevuteService.js`) — manual trigger; the same function also runs periodically from the boot-time `avviaPollingSdi()` background job.

## External integrations

| Integration | Library | Used in | Purpose |
|---|---|---|---|
| 🟢 Google OAuth | `passport-google-oauth20` | `lib/auth.js` | App login only (single-user whitelist), `callbackURL: /auth/google/callback`. 🟡 Scope assumed default profile/email — not fully confirmed. |
| 🟢 PEC/SMTP send | `nodemailer` | `services/pecService.js` | Sends FatturaPA XML as email attachment to SDI's PEC address. |
| 🟢 IMAP polling | `imapflow` + `mailparser` | `services/sdiRicevuteService.js` | Polls PEC mailbox, parses incoming SDI receipt emails, saves attachments to disk. |
| 🟢 XLSX import | `xlsx` | `services/xlsTimesheetImporter.js` | Imports historical timesheets. |
| 🟢 XML import | `fast-xml-parser` | `services/xmlInvoiceImporter.js` | Imports previously issued FatturaPA XML invoices. |

## Data persistence — entities

🟢 No database. `jsonStore.js` (`readJson`/`writeJson`/`listKeys`) over `backend/data/`:
- `config.json` — single app config (fornitore, cliente, pec, fatturazione, sdi settings) — `configService.js`.
- `invoices/<anno>-<mese>.json` — one file per month — `invoiceService.js` (`listMesiFatturati` uses `listKeys('invoices')`).
- `timesheets/<anno>-<mese>.json` — one file per month — `timesheetService.js`.
- 🟡 SDI receipt attachments saved as raw files (not JSON) under an archive path via `mkdir`/`writeFile` in `sdiRicevuteService.js` — inferred to bypass `jsonStore.js` entirely (binary/email attachments, not JSON records).

---

## Review Checklist

- **Completeness:** request pipeline, integrations, key flow trace, and persistence entities covered. Auth OAuth scope detail incomplete.
- **Accuracy:** all 🟢 items read directly from `server.js`, `api.js`, route/service files, `vite.config.js`.
- **Consistency:** function names match `PROJECT_ANALYSIS.md` and `PROJECT_CONTEXT.md` workflow steps.
- **TODO:** confirm exact Google OAuth scopes in `lib/auth.js`; confirm SDI attachment archive path.
- **Missing information:** JSON schema of `config.json`/`invoices/*.json`/`timesheets/*.json`.
- **Open questions:** is unused `cors` dependency safe to note as dead, or reserved for a future non-same-origin deployment?
- **Confidence level:** predominantly 🟢, three 🟡 inferences flagged inline.
