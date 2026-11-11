---
name: chiudi-feature
description: Closing checklist for a completed feature/fix in Timesheet (tests, CHANGELOG, FEATURE_PROPOSALS sync, restart reminder). Never commits.
disable-model-invocation: true
---

1. Tests, per `.claude/rules/test-completi.md`: ensure the feature has its unit test AND its user-flow test (normal, edge, unexpected-user cases), then run the **whole** suite (backend incl. flow tests, frontend unit, `npm run build` + `npm run test:e2e` browser UI simulation, Apple if touched); everything in sandbox, never only the changed file. On failure: analyze cause, report, ask before fixing, then re-run the whole suite until a full run is green.
2. User-facing change? Add one Italian line under `## [Unreleased]` in root `CHANGELOG.md` (multi-aspect: bold title + bullets). Skip internal-only changes.
3. Feature came from a numbered `AI-Workspace/product/FEATURE_PROPOSALS.md` entry (or `KNOWN_ISSUES.md`)? Mark it ✅ with date and commit.
4. Remind about backend restart if backend/frontend dist changed.
5. Do NOT commit; wait for explicit user go-ahead.
