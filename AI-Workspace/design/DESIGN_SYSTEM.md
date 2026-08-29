# Design System — As Implemented

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Visual language

🟢 Single global stylesheet (`frontend/src/style.css`) is the sole source of truth — no `<style>` block exists in any `.vue` file app-wide (`grep -rl "<style" components views` → zero matches). All UI primitives (buttons, cards, tables, form fields, pills) are defined once globally and reused, never duplicated per component.

🟢 Typography: three font families loaded via Google Fonts `@import` — **Fraunces** (headings/brand, weights 500/600/700), **Inter** (body text, 400–700), **IBM Plex Mono** (numeric/monospace values, e.g. amounts and hours).

## "Light glass" look — how it's actually built

🟡 README/BOOTSTRAP describe the design as "light glass," but `style.css` contains **zero** `backdrop-filter`/`blur()` rules (grep-confirmed). The glass-like effect is approximated instead through:
- translucent overlays: `rgba(255,255,255,.08)` / `.06` on active/hover nav states;
- `color-mix(in srgb, var(--line) 40%, transparent)` for subtle row tinting (weekend rows in the timesheet table);
- a soft two-layer `--shadow` token for elevation instead of blur.

This is a naming mismatch worth tracking: the design intent (glassmorphism) and the implementation (translucency + soft shadow, no blur) don't fully match. Flagged in Review Checklist and `KNOWN_ISSUES.md`.

## Dark mode

🟢 Implemented via CSS custom properties re-assigned in two override blocks in `style.css`: one gated by `@media (prefers-color-scheme: dark)` combined with `:root:not([data-theme="light"])`, one by an explicit `:root[data-theme="dark"]` attribute selector. 🟡 Per `UI_ANALYSIS.md`, no JS anywhere sets `data-theme` — dark mode today is **OS-preference-driven only**; the explicit-attribute override path is present in CSS but currently unreachable (dead code, no toggle UI exists).

## Accessibility

🟢 Minimal by current implementation: only 2 `alt=` attributes exist in the whole frontend (both on logo images), no `aria-*`, no explicit `role=` anywhere. All interactivity relies on native HTML semantics (buttons, `<a>`, form elements) with no ARIA layer. See `UI_ANALYSIS.md`.

## Componentization philosophy

🟢 Global-class-driven, not component-scoped-style-driven: components consume shared classes (`.btn`, `.card`, `.field`, `.data-table`, `.pill`) that read CSS custom properties (`var(--ink)`, `var(--accent)`, etc.), making every themed surface automatically dark-mode-aware without per-component work.

🟢 Print views (`FatturaPrintPreview.vue`, `TimesheetPrintPreview.vue`) are a deliberate exception: they use separate, isolated stylesheets (`print-fattura.css`, `print-timesheet.css`) with their own hardcoded palette, because they replicate fixed legacy document layouts (A4 invoice, Excel-style timesheet) rather than following the app's theme. See `DESIGN_TOKENS.md` for exact values.

---

## Review Checklist

- **Completeness:** visual language, glass mechanism, dark mode, accessibility, and componentization approach covered.
- **Accuracy:** all claims read directly from `style.css` and repo-wide greps for `backdrop-filter`, `data-theme`, `<style`, `aria-`.
- **Consistency:** aligns with `UI_ANALYSIS.md` (dark mode / a11y findings) and `DESIGN_TOKENS.md` (exact values).
- **TODO:** none for this pass.
- **Missing information:** no design-intent documentation exists in-repo explaining the "light glass" phrase's origin (BOOTSTRAP.md only, not the codebase).
- **Open questions:** is the glassmorphism gap (no blur) an intentional simplification or an unfinished feature? Recorded as an open question in `KNOWN_ISSUES.md`.
- **Confidence level:** predominantly 🟢, two 🟡 inferences (glass-effect mismatch, dead dark-mode toggle path).
