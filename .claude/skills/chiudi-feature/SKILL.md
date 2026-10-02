---
name: chiudi-feature
description: Closing checklist for a completed feature/fix in Timesheet (tests, CHANGELOG, FEATURE_PROPOSALS sync, restart reminder). Never commits.
disable-model-invocation: true
---

1. Backend logic changed with non-trivial branching? Ensure a `*.test.js` exists/updated; run `cd backend && node --experimental-test-module-mocks --test src/**/<name>.test.js`.
2. User-facing change? Add one Italian line under `## [Unreleased]` in root `CHANGELOG.md` (multi-aspect: bold title + bullets). Skip internal-only changes.
3. Feature came from a numbered `AI-Workspace/product/FEATURE_PROPOSALS.md` entry (or `KNOWN_ISSUES.md`)? Mark it ✅ with date and commit.
4. Remind about backend restart if backend/frontend dist changed.
5. Do NOT commit; wait for explicit user go-ahead.
