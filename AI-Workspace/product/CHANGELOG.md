# Changelog

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

🟢 Condensed summary of `git log`, grouped by theme rather than commit-by-commit — `git log` remains the authoritative detailed record. 46 commits, all dated 2026-08-30/31.

## 2026-08-30 — Initial build

🟢 Vue 3 + Express Italian e-invoicing app: timesheet → FatturaPA XML → PEC send → SDI receipt polling, single client, no database. Invoice-numbering integrity check, encrypted backup/restore, Windows install/uninstall scripts, dark-mode toggle, forfettario dashboard + SDI receipt timeline, config field validation (P.IVA/PEC/codice SDI), free-amount invoicing (no timesheet required), end-of-month timesheet reminder.

## 2026-08-30 — Multi-client support

🟢 `config.cliente` (single object) replaced by `config.clienti[]` (array); timesheet/invoice storage re-keyed to `<anno>-<mese>-<clienteId>`, invoice numbering kept as one sequence shared across all clients (legal requirement). New client-list management UI and a searchable client-switcher dropdown (Timesheet/Fattura views). Settings wizard moved from horizontal tabs to a vertical sidebar submenu.

## 2026-08-31 — Refinements and fixes

🟢 Live time formatting + row copy/paste in the timesheet grid; client emailing via `mailto` (with real PDF attachment, not inline); CSV timesheet export for VMS; Gemini-assisted ATECO code updates; historical XML/timesheet import edge-case fixes (client matching, months without a timesheet); FatturaPA XML compliance fixes (IdTrasmittente uses codice fiscale not P.IVA, alphanumeric ProgressivoInvio/SDI progressivo formatting); global PEC history view; sidebar/UI polish; hard-coded button colors moved to CSS variables.

## 2026-08-31 — Secrets moved to OS Keychain

🟢 `pec.passwordMittente` and `backup.password` no longer stored in plaintext in `config.json`; moved to the OS Keychain via `keytar`, with automatic one-time migration of any pre-existing plaintext value on first read. `GET /api/config` returns a masked placeholder instead of the real password; `PUT /api/config` treats the placeholder as "unchanged", an empty string as "clear", any other value as "set".

---

## Review Checklist

- **Completeness:** every commit accounted for under one of the three theme groups above.
- **Accuracy:** grouped from `git log --reverse --format="%ad %s" --date=short`, verified 2026-08-31.
- **Consistency:** matches feature claims in `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DECISIONS.md`.
- **TODO:** append new entries as future commits land — don't backfill, don't repeat `git log` verbatim.
- **Missing information:** none — full history is in-repo.
- **Open questions:** none.
- **Confidence level:** 🟢 — grouped directly from commit history.
