# Architecture

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## System shape

🟢 Monolithic Express backend + Vue 3 SPA frontend, single deployable: in production Express serves the built `frontend/dist` and answers `/api` and `/auth` itself (one origin, one port `1969`). In dev, Vite runs separately and proxies `/api` and `/auth` to `http://localhost:1969` (`frontend/vite.config.js`). No database — flat JSON files via `jsonStore.js`.

## Request pipeline (`backend/src/server.js`)

🟢 Middleware order: `express.json()` → `/api` request logger (`logger`) → `express-session` → `passport.initialize()` → `passport.session()` → routers → `express.static(frontend/dist)` → SPA fallback (`GET /{*splat}` → `index.html`) → global 4-arg error handler (logs via `logger.error`, responds `500 { errore: 'Errore interno del server' }`).

🟢 Routers mounted: `/auth` → `authRoutes.js` (unguarded); all of `/api/config`, `/api/timesheet`, `/api/invoice`, `/api/oauth-config`, `/api/sdi`, `/api/import`, `/api/backup`, `/api/reminder`, `/api/forfettario`, `/api/mail` wrapped in `richiedeAutenticazione` (`lib/auth.js`).

🟢 Session: `express-session({ secret: process.env.SESSION_SECRET || 'segreto-di-sviluppo', resave: false, saveUninitialized: false })`. No explicit store configured — default in-memory `MemoryStore`. 🟡 Acceptable for a single-machine app with one auth-whitelisted operator; not production-safe for multi-instance deployments (not a concern for this deployment shape).

🟢 `cors` is a listed dependency (`package.json`) but `cors()` middleware is never applied in `server.js` — 🟡 inferred vestigial/unused dependency (same-origin architecture makes it unnecessary).

🟢 Startup: listens on `process.env.PORT || 1969`; on listen, logs auth status, awaits `getConfig()`, then starts background job `avviaPollingSdi(getConfig, config.sdi.intervalloPollingMinuti)`.

## Frontend ↔ backend communication

🟢 `frontend/src/services/api.js`: `BASE_URL = '/api'`, relative/same-origin, all calls via native `fetch` (no axios). Shared private `richiesta()` helper adds JSON headers and uniform error extraction.

🟢 `authApi` (stato/logout) calls `/auth/...` directly, bypassing the `/api` wrapper.

## Key flow: generate and send an invoice

🟢 Full trace, function-level:
1. `FatturaView.vue` `generaFattura()` → `api.generaFattura(anno, mese, clienteId, dati)` → `POST /api/invoice/:anno/:mese/:clienteId/genera`.
2. `invoiceRoutes.js` handler: `getConfig()`, resolves the client by id, `getTimesheet()`, `calcolaRiepilogo()`, `calcolaCompenso()` (`invoiceService.js`/`timesheetService.js`) — or, for a free-amount invoice, takes the amount/description directly — computes numero/data/descrizione (numbering is one shared progressive sequence across all clients) → `saveInvoice()` (JSON persist).
3. Download: `api.urlDownloadXml` opens `GET /api/invoice/:anno/:mese/:clienteId/xml`; route loads saved invoice + config, calls `generaXmlFatturaPA()` + `generaNomeFileXml()` (`fatturaPaXmlGenerator.js`), validates via `fatturaPaXmlValidator.js`, streams XML as attachment.
4. Send: `FatturaView.vue` `inviaPec()` → `POST /api/invoice/:anno/:mese/:clienteId/invia-pec`; route regenerates XML, calls `inviaFatturaViaPec(config.pec, { nomeFile, contenutoXml })` (`pecService.js`, nodemailer).
5. Receipts: `FatturaView.vue` `api.controllaRicevuteSdi()` → `POST /api/sdi/controlla` → `controllaRicevuteSdi()` (`sdiRicevuteService.js`) — manual trigger; the same function also runs periodically from the boot-time `avviaPollingSdi()` background job. History across all clients viewable in `CronologiaPecView.vue`.

🟢 PEC send/receive has been tested against a real mailbox (Postecert) — `backend/src/services/pecService.e2e.js`. No longer an open gap (see `KNOWN_ISSUES.md`).

## External integrations

| Integration | Library | Used in | Purpose |
|---|---|---|---|
| 🟢 Google OAuth | `passport-google-oauth20` | `lib/auth.js` | App login only (single-email whitelist), `callbackURL: /auth/google/callback`. |
| 🟢 PEC/SMTP send | `nodemailer` | `services/pecService.js` | Sends FatturaPA XML as email attachment to SDI's PEC address; also used by `mailService.js` for other outgoing mail (e.g. reminders). |
| 🟢 IMAP polling | `imapflow` + `mailparser` | `services/sdiRicevuteService.js` | Polls PEC mailbox, parses incoming SDI receipt emails, saves attachments to disk. |
| 🟢 XLSX import | `xlsx` | `services/xlsTimesheetImporter.js` | Imports historical timesheets. |
| 🟢 XML import/validate | `fast-xml-parser` | `services/xmlInvoiceImporter.js`, `fatturaPaXmlValidator.js` | Imports previously issued FatturaPA XML invoices; validates generated XML against schema before send. |
| 🟡 Gemini API | — | `services/geminiAtecoService.js` | Optional ATECO business-code lookup during setup wizard (`StepGemini.vue`); not wired to `/api` auth guard list, low-risk optional feature. |

## Data persistence — entities

🟢 No database. `jsonStore.js` (`readJson`/`writeJson`/`listKeys`) over `backend/data/`:
- `config.json` — single app config: `fornitore` (supplier), `clienti[]` (array of clients, each with a stable `id` and own hourly rate — replaced a single `cliente` object), `fatturazione`, `pec`, `sdi` settings — `configService.js`.
- `invoices/<anno>-<mese>-<clienteId>.json` — one file per client per month — `invoiceService.js` (`listMesiFatturati` uses `listKeys('invoices')`).
- `timesheets/<anno>-<mese>-<clienteId>.json` — one file per client per month — `timesheetService.js`.
- `mail-outbox/` — generated PDF attachments for outgoing mail (e.g. timesheet PDFs sent via reminder/mail flows).
- 🟡 SDI receipt attachments saved as raw files (not JSON) under an archive path via `mkdir`/`writeFile` in `sdiRicevuteService.js` — bypasses `jsonStore.js` entirely (binary/email attachments, not JSON records).

Invoice numbering stays a single progressive sequence across all clients, independent of the per-client file keying — a legal requirement tied to the VAT number.

---

## Review Checklist

- **Completeness:** request pipeline, all routers, integrations, key flow trace (multi-client + free-amount), and persistence entities covered.
- **Accuracy:** all 🟢 items read directly from `server.js`, `api.js`, route/service files, `configService.js`, `vite.config.js`.
- **Consistency:** function names match `PROJECT_ANALYSIS.md` and `PROJECT_CONTEXT.md` workflow steps.
- **TODO:** none outstanding.
- **Missing information:** JSON schema of `invoices/*.json`/`timesheets/*.json` not fully itemized field-by-field.
- **Open questions:** is unused `cors` dependency safe to remove, or reserved for a future non-same-origin deployment?
- **Confidence level:** predominantly 🟢, two 🟡 inferences flagged inline (session store scaling, Gemini integration scope).
