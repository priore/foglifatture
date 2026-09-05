# Code quality rules

Follow the conventions already in the codebase — don't introduce a new pattern when an existing one covers the case.

- **Data access**: go through `backend/src/lib/jsonStore.js` (`readJson`/`writeJson`). Don't read/write `backend/data/*.json` directly from a service or route.
- **Layering**: routes (`backend/src/routes/*Routes.js`) stay thin — validation + calling a service. Business logic lives in `backend/src/services/*Service.js`. Don't put logic in routes.
- **Domain naming stays Italian**: variables, functions, and comments describing invoicing/timesheet domain concepts (`fattura`, `fornitore`, `cliente`, `numerazione`) keep their existing Italian names — this is a deliberate, established convention, not something to "fix" to English. This is separate from the AI-infra-English rule, which only covers files meant to be read by an AI (CLAUDE.md, agent/skill configs, memory), not application code.
- **No new dependencies for what a few lines of stdlib/already-installed packages can do.** Check `backend/package.json`/`frontend/package.json` before adding one.
- **Single-user auth, multi-client data.** One operator (`ALLOWED_EMAIL` whitelist) can bill multiple concurrent clients (`config.clienti[]`, one shared invoice-numbering sequence). Don't refactor toward multi-user/multi-tenant auth unless explicitly asked — that's a different axis from the existing multi-client support.
- **No test framework is configured.** `backend/package.json` runs tests via Node's built-in `--test` runner (`*.test.js` files, see `pecService.test.js`). Use that pattern for new backend tests; don't add Jest/Vitest/Mocha.
- Before adding a new file or service, check whether an existing one already does something close (e.g. `backupService.js`/`sdiRicevuteService.js`/`reminderService.js` all share the same `setInterval` polling pattern — reuse it, don't reinvent).
- **Colors/spacing/theme tokens**: CSS variables only, never hard-coded hex/px in components or inline styles. Add new tokens to the existing `:root` variable block, don't invent a parallel one.
- **Vue 3**: Composition API + `<script setup>`, matching existing components — don't mix in Options API. Reuse existing composables before writing a new one.
- **Backend is ESM** (`"type": "module"`): `import`/`export`, no `require`. Async routes/services use `async`/`await`, not raw `.then()` chains.
- **Express routes**: errors go through the existing error-handling middleware/pattern already in `backend/src/routes/` — don't add a one-off `try/catch` + custom JSON error shape per route.
- Project-specific rules learned over time (not derivable from code alone) live in `.claude/memory/` (versioned, checked out with the repo) — indexed in `.claude/memory/MEMORY.md`. Check it for established conventions before making a judgment call the codebase doesn't already show.
