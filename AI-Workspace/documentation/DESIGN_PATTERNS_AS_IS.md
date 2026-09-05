# Design Patterns — As Is

Factual inventory of architectural/design patterns actually present in the codebase. Not a recommendation, not a refactor target. Analysis only.

Confidence: 🟢 confirmed by code (implementation read directly) · 🟡 inferred (implied by naming/structure, not verified line-by-line) · 🔴 hypothesis

---

## Backend (`backend/src/**`)

- 🟢 **Layered routing → service → data-access.** `routes/invoiceRoutes.js` calls functions in `services/invoiceService.js` (e.g. `calcolaCompenso`, `getInvoice`, `saveInvoice`), which call the shared data-access module `lib/jsonStore.js`. No controller classes, no ORM/DB.
- 🟢 **Router-per-resource.** One Express `Router()` module per resource file under `routes/`, mounted in `server.js:41-47`. Not classic MVC — flat routes + services split, no models/views layer.
- 🟢 **Middleware chaining for auth.** `richiedeAutenticazione` (`lib/auth.js:34-38`) applied per-mount in front of protected routers (`server.js:41-47`).
- 🟢 **Session-based auth via Passport Google OAuth strategy.** `express-session` + `passport.session()` + `GoogleStrategy`, configured only when env vars are present (`lib/auth.js:1-32`, `server.js:32-39`). Single-email allowlist via `ALLOWED_EMAIL`.
- 🟢 **Feature-flagged auth (graceful degradation).** If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are absent, `isAuthConfigurato()` is false and the auth middleware becomes a no-op pass-through (`lib/auth.js:9-11,34-38`).
- 🟢 **Repository-like flat-file store.** `lib/jsonStore.js` exposes generic `readJson/writeJson/listKeys` over a `data/` directory, acting as the sole persistence layer — JSON-per-record, no real database. Records for timesheets/invoices are keyed `<anno>-<mese>-<clienteId>`, supporting multiple concurrent clients under one config (`clienti[]` array in `config.json`).
- 🟢 **Named singleton loggers.** `lib/logger.js` exports three module-level logger objects (`logger`, `pecLogger`, `sdiLogger`), each writing a distinct log file, imported directly wherever needed. No dependency injection.
- 🟢 **Shared `setInterval` polling pattern, reused across services.** `sdiRicevuteService.js` (`avviaPollingSdi`, SDI receipt polling), `backupService.js` (scheduled automatic backup), and `reminderService.js` (end-of-month timesheet reminder) each start their own `setInterval` timer, re-reading config on every tick rather than caching it. SDI polling starts once from the `app.listen` callback in `server.js:66-69`.
- 🟢 **Centralized error-handling middleware.** Single 4-arg Express error handler in `server.js:59-62` logs and returns a generic 500 JSON body.
- 🟢 **SPA fallback / static serving.** `server.js:50-54` serves the built Vue `dist` and falls back to `index.html` for non-API routes.

## Frontend (`frontend/src/**`)

- 🟢 **Composition API only, `<script setup>` exclusively.** All `.vue` files use `<script setup>` with `ref/computed/watch/onMounted` (e.g. `views/TimesheetView.vue:3`). No Options API components present.
- 🟢 **No global state library.** No Pinia/Vuex in `package.json`; no `provide/inject` usage found. State lives locally per-view (`ref`/`reactive`) and is re-fetched from the backend as needed.
- 🟢 **Composables for shared logic.** `composables/useTimeCalculator.js`, `usePdfExport.js`, `useValidazioneFiscale.js` follow Vue's `useXxx()` extraction convention, imported directly by the components that need them.
- 🟢 **Centralized API client (facade over `fetch`).** `services/api.js` exposes a single `api` object grouping backend calls by domain (config, timesheet, invoice, oauth, sdi, import), backed by a shared private `richiesta()` helper that wraps `fetch` with base URL, JSON headers, and uniform error extraction. Plain `fetch`, no axios.
- 🟢 **Separate `authApi` singleton.** Auth calls (`/auth/stato`, `/auth/logout`) are exported separately in `services/api.js`, bypassing the shared `richiesta()` wrapper.
- 🟢 **vue-router, flat route table, single history mode.** `router/index.js` uses `createWebHistory`, one root redirect, no nested routes, no navigation guards observed in this file.
- 🟡 **Component folder-by-feature.** `components/{common,fattura,timesheet,wizard}/` — structural convention grouping by feature area rather than flat or atomic-design layout.
- 🟢 **Multi-step wizard as component composition, step order externalized.** `components/wizard/WizardSteps.vue` plus `StepFornitore.vue`, `StepClienti.vue`, `StepFatturazione.vue`, `StepForfettario.vue`, `StepPec.vue`, `StepGemini.vue`, `StepGoogleAuth.vue`, `StepBackup.vue`, `StepPromemoria.vue` — step lists live in `wizardImpostazioniPassi.js`/`wizardImportaStoricoPassi.js`, shared between the wizard view and `AppSidebar.vue`'s breadcrumb.

---

## Review Checklist

- **Completeness:** covers routing, auth, persistence, logging, background jobs, and frontend state/API/routing/component conventions. Does not yet cover `backend/src/data` schema shapes or full route/service list per resource.
- **Accuracy:** all 🟢 items read from source directly; 🟡 items flagged as naming-based inference only.
- **Consistency:** terminology aligned with `AI-Workspace/WORKSPACE_MANIFEST.md` confidence legend.
- **TODO:** verify wizard step-switching logic line-by-line; enumerate all resource routes/services pairs; document JSON store record shapes.
- **Missing information:** no DB/schema (none exists — flat JSON files); test coverage patterns not surveyed.
- **Open questions:** is `express-session` store the default in-memory (not production-safe) or backed by something persistent? Not yet checked.
- **Confidence level:** predominantly 🟢, two 🟡 items pending deeper verification.
