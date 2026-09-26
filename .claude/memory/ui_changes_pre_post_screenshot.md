---
name: ui-changes-pre-post-screenshot
description: any UI/layout change requires a Playwright pre/post screenshot comparison before proposing a commit
metadata:
  type: project
---

Any change touching layout, CSS grid/flex structure, or shared component markup in the frontend must be verified with a Playwright screenshot comparison: full-page screenshots before and after the change, light and dark theme, at least two viewport widths (e.g. 1440 and 1024).

**Why:** small structural edits (e.g. merging two CSS grids into one) can look risk-free in the diff but shift shared column/row sizing across unrelated cards — caught in practice on the dashboard reorderable-cards work (frontend/src/views/DashboardView.vue), where unifying two grids into one made an unrelated donut-chart legend wrap because a `BarChart` in another row shared its grid column (`1fr` without `minmax(0, 1fr)` lets one cell's min-content stretch the whole column across all rows).

**How to apply:** screenshot before touching the code; after building and restarting, screenshot again with the same viewport/theme combinations; diff visually (and via pixel/dimension checks with `sips`/PIL when the visual diff is subtle) before proposing the change as done. Any unexplained pixel/dimension difference must be root-caused (e.g. via `getComputedStyle`/`getBoundingClientRect` in `browser_evaluate`) before deciding whether it's an acceptable side-effect or a regression to fix. See also [[feedback_confirm_side_effect_fixes]] (in the cross-project, non-versioned memory) — a side-effect discovered this way is not to be fixed silently, ask first.
