---
name: ui-shot-diff
description: Before/after Playwright verification of a UI layout/grid change (light+dark, 2 viewports). Use when editing frontend layout, grid or styling.
disable-model-invocation: true
---

Follow `.claude/memory/ui_changes_pre_post_screenshot.md`.

1. BEFORE editing: for each of light/dark and two viewports (e.g. 1440x900, 390x844) use `browser_resize`, `browser_navigate` to the affected view, `browser_snapshot` (structure) and `browser_take_screenshot` into `shots/before-<theme>-<width>.png`.
2. Make the change, rebuild frontend (`npm run build` in `frontend/`), restart backend via `/riavvia-backend`.
3. AFTER: repeat into `shots/after-...`.
4. Compare. Root-cause every unexplained difference before declaring done. `shots/` is gitignored.
