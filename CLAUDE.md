# Project rules — Timesheet/Fatturazione

## Sensitive data and `.gitignore` — mandatory check

This repository is meant to be published/forked on GitHub. No sensitive data (credentials, config with secrets, local paths, databases, backups) must ever end up in a commit.

**Before adding any new file, folder, or persistence mechanism** (a new service that writes to disk, a new data folder, a new config/cache/log file, a new integration with credentials) — explicitly assess whether it contains or could contain sensitive data, and if so:

1. Add the path to `.gitignore` **in the same commit** that introduces it, not later.
2. If the file/folder is required to run but must not be versioned, make the code auto-generate it on first startup (as `configService.js` already does with `DEFAULT_CONFIG`), or provide a versioned `*.example` file with no secrets (like `backend/.env.example`) and have the install script copy it.
3. Before every push to a public remote (or any time something might have slipped through), verify no sensitive path was ever tracked:
   ```
   git ls-files | grep -E "config\.json|\.env$|\.key$|\.pem$"
   git log --all --full-history -- <suspect path>
   ```
   Both must return empty. If something shows up tracked, it must be removed from history (`git filter-repo` or equivalent) before publishing — removing it only from the working tree is not enough, it stays in past commits.

Don't treat `.gitignore` as a one-time static guarantee: re-check it every time a new data source is introduced, not just once at project start.

See also the full analysis in `AI-Workspace/product/FEATURE_PROPOSALS.md` → "Analisi di fattibilità — Export codice su GitHub".

## Code quality rules

Follow the conventions already in the codebase — don't introduce a new pattern when an existing one covers the case.

- **Data access**: go through `backend/src/lib/jsonStore.js` (`readJson`/`writeJson`). Don't read/write `backend/data/*.json` directly from a service or route.
- **Layering**: routes (`backend/src/routes/*Routes.js`) stay thin — validation + calling a service. Business logic lives in `backend/src/services/*Service.js`. Don't put logic in routes.
- **Domain naming stays Italian**: variables, functions, and comments describing invoicing/timesheet domain concepts (`fattura`, `fornitore`, `cliente`, `numerazione`) keep their existing Italian names — this is a deliberate, established convention, not something to "fix" to English. This is separate from the AI-infra-English rule above, which only covers files meant to be read by an AI (this `CLAUDE.md`, agent/skill configs, memory), not application code.
- **No new dependencies for what a few lines of stdlib/already-installed packages can do.** Check `backend/package.json`/`frontend/package.json` before adding one.
- **Single-tenant assumptions are intentional**, not an oversight (see `FEATURE_PROPOSALS.md` multi-tenant feasibility analysis) — don't refactor toward multi-user/multi-client support unless explicitly asked.
- **No test framework is configured.** `backend/package.json` runs tests via Node's built-in `--test` runner (`*.test.js` files, see `pecService.test.js`). Use that pattern for new backend tests; don't add Jest/Vitest/Mocha.
- Before adding a new file or service, check whether an existing one already does something close (e.g. `backupService.js`/`sdiRicevuteService.js`/`reminderService.js` all share the same `setInterval` polling pattern — reuse it, don't reinvent).

## Dev workflow

- Backend runs as a persistent background process on port 1969, serving `frontend/dist/` statically — no frontend dev-server hot-reload in this setup. After building the frontend, or after any backend code change, the running node process must be killed and restarted to pick up changes — it won't do so on its own. **Always ask the user for confirmation before restarting** (`lsof -i :1969 -sTCP:LISTEN -t` to find the PID, kill it, `nohup node src/server.js &` to relaunch); never do it silently.
- `AI-Workspace/` holds structured analysis/product docs, indexed by `AI-Workspace/WORKSPACE_MANIFEST.md` (see `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `UI_ANALYSIS.md`, `FEATURE_PROPOSALS.md`, etc.). These are analysis-only — no code changes there. Exception: when a completed feature originated from a numbered entry in `FEATURE_PROPOSALS.md` (or an issue in `KNOWN_ISSUES.md`), update that entry immediately (✅ implemented, date, commit) as the last step of the task — don't leave it stale.
