# Project Context

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Purpose

🟢 Local (single-machine) app for monthly timesheet management and Italian electronic invoicing under "regime forfettario" (Italian flat-tax scheme for freelancers/sole proprietors).

🟢 Supports multiple concurrent clients: each client has its own hourly rate, timesheet, and invoice history, tracked under a shared, legally-mandated single invoice-numbering sequence. Source: `backend/src/services/configService.js` (`clienti: []` array, replaced a single `cliente` object), data files keyed `<anno>-<mese>-<clienteId>.json`.

🟢 Two independent billing paths: timesheet-driven (hours × rate) and free-form (arbitrary amount + description, no timesheet required) — `invoiceRoutes.js`.

## Users

🟢 Single human operator (freelancer/consultant), multiple clients. Runs locally (README describes a `launchd`/Task Scheduler service on `localhost:1969`).

🟢 Access control: Google OAuth whitelist of exactly one email (`ALLOWED_EMAIL` in `backend/.env.example`, enforced in `backend/src/lib/auth.js`). If OAuth credentials are blank, auth is fully disabled (`isAuthConfigurato()` false) so the owner can reach Settings on first run — a deliberate bootstrap escape hatch, not a bug.

## Domain concepts (Italian e-invoicing)

- 🟢 **FatturaPA** — mandatory Italian e-invoice XML format. `backend/src/services/fatturaPaXmlGenerator.js` generates schema v1.2.2, `FormatoTrasmissione FPR12`, `RegimeFiscale RF19` (flat-tax), `Natura IVA N2.2` (forfettario — VAT-exempt), virtual stamp duty (`DatiBollo`) above threshold, no INPS rivalsa, no ritenuta d'acconto. `fatturaPaXmlValidator.js` validates generated XML against the schema before send.
- 🟢 **SDI (Sistema di Interscambio)** — Italy's state invoice-exchange system; routes e-invoices to recipients and returns delivery/outcome receipts. Confirmed via `pecService.js` (official SDI address `sdi01@pec.fatturapa.it`) and `sdiRicevuteService.js` (recognizes receipt types RC/NS/MC/NE/EC/DT/AT).
- 🟢 **PEC (Posta Elettronica Certificata)** — Italian certified email, the legally required transport channel to submit invoices to SDI and receive receipts. `pecService.js` sends via SMTP; `sdiRicevuteService.js` polls the same mailbox via IMAP (read-only), filtering senders to `@pec.fatturapa.it`. Tested end-to-end against a real mailbox (Postecert) — see `pecService.e2e.js`.
- 🟢 **Timesheet-based billing** — daily/monthly logged hours drive the hourly-rate calculation feeding the invoice (`TimesheetView.vue`, `timeCalculator.js`), per selected client.
- 🟢 **Regime forfettario dashboard** — running totals/limits for the flat-tax scheme (`forfettarioService.js`, `DashboardView.vue`).

## End-to-end workflow

1. 🟢 Configure supplier data, one or more clients (each with own hourly rate), fiscal data, PEC mailbox, optional Google login via a Settings wizard (`ImpostazioniView.vue` → `WizardSteps.vue` → Step components: Fornitore, Clienti, Fatturazione, Forfettario, Pec, GoogleAuth, Backup, Promemoria, Gemini).
2. 🟢 Pick the active client (`ClienteSwitcher.vue`), log daily hours for the month in the Timesheet view; export/print PDF (`TimesheetView.vue`, `usePdfExport.js`).
3. 🟢 Generate a "Fattura Pro-Forma" preview — either computed server-side from the timesheet, or entered as a free amount/description — then produce the FatturaPA XML (`FatturaView.vue`, `invoiceService.js`, `fatturaPaXmlGenerator.js`). Invoice numbering stays a single progressive sequence across all clients (legal requirement tied to the VAT number, not the client).
4. 🟢 Send the XML invoice via PEC to SDI (`pecService.js` — `inviaFatturaViaPec`).
5. 🟢 Poll the PEC mailbox via IMAP for SDI receipt notifications, archive them locally (`CronologiaPecView.vue` shows history across all clients), trigger a desktop notification (`sdiRicevuteService.js`, `macNotifier.js`).
6. 🟢 Separate one-off import flow for historical timesheets (XLS) and already-issued invoices (FatturaPA XML) — `ImportaStoricoView.vue`, `xlsTimesheetImporter.js`, `xmlInvoiceImporter.js`.
7. 🟢 Encrypted data export/backup, optional scheduled automatic backup (`backupService.js`, `StepBackup.vue`).
8. 🟢 Optional end-of-month timesheet reminder (`reminderService.js`, `StepPromemoria.vue`) and optional Gemini-based ATECO code lookup during setup (`geminiAtecoService.js`, `StepGemini.vue`).

## Business goals

🟡 Reduce manual effort of producing compliant FatturaPA invoices for a forfettario freelancer serving multiple clients, and close the loop on delivery confirmation (SDI receipts) without manual PEC-mailbox checking. Inferred from the polling/notification/reminder design — no explicit goals statement found in repo.

---

## Review Checklist

- **Completeness:** purpose, users, domain concepts, workflow, and multi-client model covered.
- **Accuracy:** all 🟢 claims read from source files directly (README, auth.js, configService.js, fatturaPaXmlGenerator.js, pecService.js, sdiRicevuteService.js, view files).
- **Consistency:** terminology matches `AI-Workspace/documentation/DESIGN_PATTERNS_AS_IS.md` and confidence legend in `WORKSPACE_MANIFEST.md`.
- **TODO:** none outstanding.
- **Missing information:** none.
- **Open questions:** none.
- **Confidence level:** predominantly 🟢, one 🟡 inference (business goals).
