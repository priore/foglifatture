# Decisions

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

Architectural/product decisions as observed in the codebase (not stated explicitly anywhere as an ADR — reconstructed from implementation choices). No decision here was told to the documenter directly; all are inferred from what was built.

## No database — flat JSON files

🟡 Decision: persist all data (config, invoices, timesheets) as flat JSON files via a custom `jsonStore.js`, not a real database. Consistent with a single-user, single-machine local app (`PROJECT_CONTEXT.md`) where transactional integrity and concurrent access aren't concerns. Trade-off: no query capability beyond `listKeys`/`readJson`, no schema enforcement.

## Same-origin deployment (no CORS)

🟢 Decision: Express serves the built Vue frontend itself in production, keeping frontend and API on one origin/port. `cors` is a listed but unused dependency, confirming CORS support was considered but not needed once same-origin was chosen. See `ARCHITECTURE.md`.

## Single-user auth via Google OAuth + email whitelist, with a bootstrap escape hatch

🟢 Decision: rather than building a user/password system, auth is Google OAuth gated by a single allowed email (`ALLOWED_EMAIL`). If OAuth credentials are absent, auth is disabled entirely rather than blocking the app. This is a deliberate first-run/bootstrap design, not an oversight — it lets the owner reach Settings to configure OAuth before auth can be enforced. See `PROJECT_CONTEXT.md`.

## Composition API exclusively, no state management library

🟢 Decision: all 18 Vue components use `<script setup>` (Composition API only), and no Pinia/Vuex is present — state is local per-view, re-fetched from the backend as needed. Consistent with a small, single-user app where cross-view shared state isn't a major concern. See `DESIGN_PATTERNS_AS_IS.md`.

## Global CSS classes over component-scoped styles

🟢 Decision: no `.vue` file in the app declares a `<style>` block; all visuals come from global classes in one `style.css` driven by CSS custom properties. This keeps dark-mode support centralized (change tokens once, every surface updates) at the cost of no style encapsulation per component. See `DESIGN_SYSTEM.md`.

## Print views isolated from the app's design system

🟢 Decision: `FatturaPrintPreview.vue` and `TimesheetPrintPreview.vue` use separate stylesheets (`print-fattura.css`, `print-timesheet.css`) with independent, hardcoded palettes, because they replicate fixed legacy document layouts (A4 invoice, Excel-style timesheet) rather than the app's own visual identity. See `DESIGN_TOKENS.md`.

## Background polling over webhook/push for SDI receipts

🟢 Decision: SDI receipt checking uses `setInterval`-based IMAP polling (`avviaPollingSdi`), not a push/webhook mechanism — consistent with PEC/SDI's actual protocol (there is no webhook equivalent in the Italian e-invoicing standard; polling a mailbox is the standard integration pattern). See `ARCHITECTURE.md`.

---

## Review Checklist

- **Completeness:** covers the major structural decisions surfaced across architecture and design docs.
- **Accuracy:** each decision ties to a confirmed implementation detail in a cited source document.
- **Consistency:** confidence tags match the originating documents' tags.
- **TODO:** none for this pass.
- **Missing information:** no explicit rationale text exists in-repo for any of these decisions — all reconstructed from implementation, not from commit messages or design notes (none found).
- **Open questions:** were any of these decisions deliberate trade-offs discussed with a stakeholder, or default choices made under time constraints? Cannot be determined from code alone.
- **Confidence level:** predominantly 🟢 (decision existence), 🟡 only on the "why" behind the no-database choice, which is inferred rather than stated.
