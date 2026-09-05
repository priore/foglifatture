# Decisions

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

Architectural/product decisions as observed in the codebase (not stated explicitly anywhere as an ADR — reconstructed from implementation choices). No decision here was told to the documenter directly; all are inferred from what was built.

## No database — flat JSON files

🟡 Decision: persist all data (config, invoices, timesheets) as flat JSON files via a custom `jsonStore.js`, not a real database. Consistent with a single-machine local app (`PROJECT_CONTEXT.md`) run by one operator, where transactional integrity and concurrent access aren't concerns. Trade-off: no query capability beyond `listKeys`/`readJson`, no schema enforcement. Scales to multiple clients via file-key composition (`<anno>-<mese>-<clienteId>`) rather than a relational model.

## Same-origin deployment (no CORS)

🟢 Decision: Express serves the built Vue frontend itself in production, keeping frontend and API on one origin/port. `cors` is a listed but unused dependency, confirming CORS support was considered but not needed once same-origin was chosen. See `ARCHITECTURE.md`.

## Single-email auth via Google OAuth, with a bootstrap escape hatch

🟢 Decision: rather than building a user/password system, auth is Google OAuth gated by a single allowed email (`ALLOWED_EMAIL`) — one operator, independent of how many clients that operator bills. If OAuth credentials are absent, auth is disabled entirely rather than blocking the app. This is a deliberate first-run/bootstrap design, not an oversight — it lets the owner reach Settings to configure OAuth before auth can be enforced. See `PROJECT_CONTEXT.md`.

## Composition API exclusively, no state management library

🟢 Decision: all Vue components use `<script setup>` (Composition API only), and no Pinia/Vuex is present — state is local per-view, re-fetched from the backend as needed. The active-client selection is passed via props/route state rather than a global store. See `DESIGN_PATTERNS_AS_IS.md`.

## Global CSS classes over component-scoped styles

🟢 Decision: no `.vue` file in the app declares a `<style>` block; all visuals come from global classes in one `style.css` driven by CSS custom properties. This keeps dark-mode support centralized (change tokens once, every surface updates) at the cost of no style encapsulation per component. See `DESIGN_SYSTEM.md`.

## Print views isolated from the app's design system

🟢 Decision: `FatturaPrintPreview.vue` and `TimesheetPrintPreview.vue` use separate stylesheets (`print-fattura.css`, `print-timesheet.css`) with independent, hardcoded palettes, because they replicate fixed legacy document layouts (A4 invoice, Excel-style timesheet) rather than the app's own visual identity. See `DESIGN_TOKENS.md`.

## Background polling over webhook/push, one shared pattern for every recurring job

🟢 Decision: SDI receipt checking, scheduled backup, and the end-of-month reminder all use the same `setInterval`-based pattern (re-reading config each tick) instead of a shared scheduler abstraction or a webhook mechanism. Consistent with PEC/SDI's actual protocol (no webhook equivalent exists in the Italian e-invoicing standard) and with keeping each job self-contained. See `DESIGN_PATTERNS_AS_IS.md`.

## Multi-client support via an array + shared invoice numbering

🟢 Decision: `config.clienti[]` replaced a single `cliente` object; each client gets a stable `id`, its own hourly rate, and its own timesheet/invoice files (`<anno>-<mese>-<clienteId>`), while invoice numbering stays one progressive sequence shared across all clients — a legal requirement tied to the VAT number, not the client. Soft-delete (`attivo:false`) keeps historical invoices/timesheets resolvable after a client is removed from active selectors. See `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`.

---

## Review Checklist

- **Completeness:** covers the major structural decisions surfaced across architecture and design docs.
- **Accuracy:** each decision ties to a confirmed implementation detail in a cited source document.
- **Consistency:** confidence tags match the originating documents' tags.
- **TODO:** none for this pass.
- **Missing information:** no explicit rationale text exists in-repo for any of these decisions — all reconstructed from implementation, not from commit messages or design notes.
- **Open questions:** were any of these decisions deliberate trade-offs discussed with a stakeholder, or default choices made under time constraints? Cannot be determined from code alone.
- **Confidence level:** predominantly 🟢, one 🟡 on the "why" behind the no-database choice, which is inferred rather than stated.
