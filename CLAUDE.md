# Project rules — Timesheet/Fatturazione

Stack: Node ESM backend (`backend/`, Express, port 1969) + Vue 3 `<script setup>` frontend (`frontend/`). Test commands: see test-completi.md.

Rules split by topic, loaded only when relevant:

- @.claude/rules/sensitive-data.md — `.gitignore`/secrets check before adding any new file or persistence mechanism
- @.claude/rules/code-quality.md — layering, naming, dependency, and framework conventions
- `.claude/rules/ui-design.md` (path-scoped to `frontend/src/**`) — popup/dialog button order, colors, sizing, dismiss behavior, date fields
- @.claude/rules/dev-workflow.md — backend restart, `AI-Workspace/` docs, `CHANGELOG.md`
- @.claude/rules/test-completi.md — full-suite gate with user-flow tests before review/deploy, failure protocol, mandatory full re-run

Project-specific conventions learned over time, not derivable from code: @.claude/memory/MEMORY.md

Codebase structure/architecture/product context — check before a full scan: @AI-Workspace/WORKSPACE_MANIFEST.md
