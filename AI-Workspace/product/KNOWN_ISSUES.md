# Known Issues

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

Observed gaps and inconsistencies. Documentation only — nothing here is fixed by this workspace.

## PEC send/receive untested against a real mailbox

🟢 The project's own README and `pecService.js` comments state the PEC module is "predisposto... ma non testato con invio reale" (implemented but not tested with real sending). Source: `AI-Workspace/architecture/product/PROJECT_CONTEXT.md`. Risk: the core send/receive loop (invoice → PEC → SDI → receipt) may fail silently in production against a real SDI mailbox.

## "Light glass" design intent vs. implementation

🟡 BOOTSTRAP.md/README describe the visual design as "light glass," but `style.css` has zero `backdrop-filter`/`blur()` rules. The effect is approximated via translucency and shadow only. Not necessarily a bug — may be an intentional simplification — but the gap between stated intent and implementation is worth a product decision. See `DESIGN_SYSTEM.md`.

## Dark-mode manual toggle: dead CSS path

🟡 `style.css` defines a `:root[data-theme="dark"]` override selector, but no JS anywhere in `frontend/src` ever sets `data-theme`. Today dark mode is OS-preference-only; the explicit-toggle CSS path is unreachable. Either unfinished scaffolding for a future toggle, or leftover dead code. See `UI_ANALYSIS.md`.

## Unused `cors` dependency

🟢 `cors` is listed in `backend/package.json` but `cors()` middleware is never applied in `server.js`. The app is same-origin by design (Express serves the built frontend itself), making it currently unnecessary. See `ARCHITECTURE.md`.

## Minimal accessibility coverage

🟢 Only 2 `alt=` attributes exist across the entire frontend; no `aria-*` or explicit `role=` attributes anywhere. All interactivity relies on native HTML semantics. Not a defect per se, but a gap if accessibility compliance becomes a requirement. See `UI_ANALYSIS.md`.

## Session store is in-memory (unscaled, acceptable for stated use)

🟡 `express-session` has no explicit store configured, defaulting to `MemoryStore`. Not production-safe for multi-instance deployments, but consistent with the app's confirmed single-user, single-machine design (`PROJECT_CONTEXT.md`) — flagged for awareness only, not as a defect given current scope.

## No formal design-token scale for spacing/radius/font-size

🟡 Colors and shadows are tokenized as CSS custom properties; spacing, border-radius, and font sizes are hardcoded per rule with no `--space-*`/`--radius-*`/`--font-size-*` scale. See `DESIGN_TOKENS.md`.

---

## Review Checklist

- **Completeness:** captures issues surfaced during PROJECT_CONTEXT, ARCHITECTURE, UI_ANALYSIS, and DESIGN_SYSTEM passes. Not an exhaustive bug hunt (out of scope — documentation only).
- **Accuracy:** each item traces to a confirmed source document listed inline.
- **Consistency:** confidence tags match originating documents.
- **TODO:** re-scan after PROJECT_ANALYSIS data-schema gaps are resolved (config.json/invoices/timesheets shapes undocumented — may surface more issues).
- **Missing information:** no runtime/production incident history available in-repo to cross-check against.
- **Open questions:** which of these are acceptable-as-is for a single-user local tool vs. genuinely worth fixing? Product decision, not answered here.
- **Confidence level:** mixed 🟢/🟡, each tagged individually above.
