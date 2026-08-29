# Project Context

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Purpose

🟢 Local (single-machine) app for monthly timesheet management and Italian electronic invoicing under "regime forfettario" (Italian flat-tax scheme for freelancers/sole proprietors). Source: `README.md` — "App locale per gestione timesheet mensile e fatturazione elettronica in regime forfettario".

🟡 Built for a single freelance consultant billing one client based on hours worked (timesheet → hourly rate → invoice). Inferred from `FatturaView.vue` (compenso computed from timesheet) and the single cliente/fornitore wizard steps (no multi-client model observed).

## Users

🟢 Single-user, single-tenant. Runs locally (README describes a `launchd` service on `localhost:1969`).

🟢 Access control: Google OAuth whitelist of exactly one email (`ALLOWED_EMAIL` in `backend/.env.example`, enforced in `backend/src/lib/auth.js`). If OAuth credentials are blank, auth is fully disabled (`isAuthConfigurato()` false) so the owner can reach Settings on first run — a deliberate bootstrap escape hatch, not a bug.

## Domain concepts (Italian e-invoicing)

- 🟢 **FatturaPA** — mandatory Italian e-invoice XML format. `backend/src/services/fatturaPaXmlGenerator.js` generates schema v1.2.2, `FormatoTrasmissione FPR12`, `RegimeFiscale RF19` (flat-tax), `Natura IVA N2.2` (forfettario — VAT-exempt), virtual stamp duty (`DatiBollo`) above threshold, no INPS rivalsa, no ritenuta d'acconto.
- 🟢 **SDI (Sistema di Interscambio)** — Italy's state invoice-exchange system; routes e-invoices to recipients and returns delivery/outcome receipts. Confirmed via `pecService.js` (official SDI address `sdi01@pec.fatturapa.it`) and `sdiRicevuteService.js` (recognizes receipt types RC/NS/MC/NE/EC/DT/AT).
- 🟢 **PEC (Posta Elettronica Certificata)** — Italian certified email, the legally required transport channel to submit invoices to SDI and receive receipts. `pecService.js` sends via SMTP; `sdiRicevuteService.js` polls the same mailbox via IMAP (read-only), filtering senders to `@pec.fatturapa.it`.
- 🟢 **Timesheet-based billing** — daily/monthly logged hours drive the hourly-rate calculation feeding the invoice (`TimesheetView.vue`, `timeCalculator.js`).

## End-to-end workflow

1. 🟢 Configure supplier/client data, hourly rate, fiscal data, PEC mailbox, optional Google login via a Settings wizard (`ImpostazioniView.vue` → `WizardSteps.vue` → Step components: Fornitore, Cliente, Fatturazione, Pec, GoogleAuth).
2. 🟢 Log daily hours for the month in the Timesheet view; export/print PDF (`TimesheetView.vue`, `usePdfExport.js`).
3. 🟢 Generate a "Fattura Pro-Forma" preview computed server-side from the timesheet, then produce the FatturaPA XML (`FatturaView.vue`, `invoiceService.js`, `fatturaPaXmlGenerator.js`).
4. 🟢 Send the XML invoice via PEC to SDI (`pecService.js` — `inviaFatturaViaPec`).
5. 🟢 Poll the PEC mailbox via IMAP for SDI receipt notifications, archive them locally, trigger a desktop notification (`sdiRicevuteService.js`, `macNotifier.js`).
6. 🟢 Separate one-off import flow for historical timesheets (XLS) and already-issued invoices (FatturaPA XML) — `ImportaStoricoView.vue`, `xlsTimesheetImporter.js`, `xmlInvoiceImporter.js`.

🟢 **Caveat, stated by the project itself:** PEC send/receive is implemented but "not tested with real mailbox sending" (README.md and `pecService.js` comments, verbatim: "Il modulo è predisposto... ma non testato con invio reale").

## Business goals

🟡 Reduce manual effort of producing compliant FatturaPA invoices for a forfettario freelancer, and close the loop on delivery confirmation (SDI receipts) without manual PEC-mailbox checking. Inferred from the polling/notification design — no explicit goals statement found in repo.

---

## Review Checklist

- **Completeness:** purpose, users, domain concepts, workflow, and stated caveats covered. Multi-currency/multi-client scenarios not addressed (none observed in code).
- **Accuracy:** all 🟢 claims read from source files directly (README, auth.js, fatturaPaXmlGenerator.js, pecService.js, sdiRicevuteService.js, view files).
- **Consistency:** terminology matches `AI-Workspace/documentation/DESIGN_PATTERNS_AS_IS.md` and confidence legend in `WORKSPACE_MANIFEST.md`.
- **TODO:** confirm single-client assumption by reading `configService.js` data shape; check whether app supports more than one "cliente" record.
- **Missing information:** no `prompt.txt` found at repo root (BOOTSTRAP.md referenced it as possible source — absent, not used).
- **Open questions:** is PEC send/receive still untested in production, or has that changed since README was last updated? Requires re-check against `CHANGELOG.md` once populated.
- **Confidence level:** predominantly 🟢, two 🟡 inferences (single-client model, business goals) flagged for verification.
