# Known Issues

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

Observed gaps and inconsistencies. Documentation only — nothing here is fixed by this workspace.

## Unreferenced dead file: `StepCliente.vue`

🟢 `frontend/src/components/wizard/StepCliente.vue` (singular, single-client form) is never imported anywhere in the app — superseded by `StepClienti.vue` (plural, multi-client list) but never deleted. See `COMPONENT_LIBRARY.md`.

## Unused `cors` dependency

🟢 `cors` is listed in `backend/package.json` but `cors()` middleware is never applied in `server.js`. The app is same-origin by design (Express serves the built frontend itself), making it currently unnecessary. See `ARCHITECTURE.md`.

## Minimal accessibility coverage

🟢 Only 2 `alt=` attributes exist across the entire frontend; no `aria-*` or explicit `role=` attributes anywhere. All interactivity relies on native HTML semantics. Not a defect per se, but a gap if accessibility compliance becomes a requirement. See `UI_ANALYSIS.md`.

## Session store is in-memory (unscaled, acceptable for stated use)

🟡 `express-session` has no explicit store configured, defaulting to `MemoryStore`. Not production-safe for multi-instance deployments, but consistent with the app's single-machine, single-operator deployment shape — flagged for awareness only, not as a defect given current scope.

## No formal design-token scale for spacing/radius/font-size

🟡 Colors and shadows are tokenized as CSS custom properties; spacing, border-radius, and font sizes are hardcoded per rule with no `--space-*`/`--radius-*`/`--font-size-*` scale. See `DESIGN_TOKENS.md`.

## "Light glass" design intent vs. implementation

🟡 The app describes its visual design as "light glass," but `style.css` has zero `backdrop-filter`/`blur()` rules. The effect is approximated via translucency and shadow only. Not necessarily a bug — may be an intentional simplification — but the gap between stated intent and implementation is worth a product decision. See `DESIGN_SYSTEM.md`.

---

## Review Checklist

- **Completeness:** captures issues surfaced during architecture, UI, and design passes. Not an exhaustive bug hunt (out of scope — documentation only).
- **Accuracy:** each item traces to a confirmed source document listed inline.
- **Consistency:** confidence tags match originating documents.
- **TODO:** re-scan after a data-schema note (config.json/invoices/timesheets shapes) is written — may surface more issues.
- **Missing information:** no runtime/production incident history available in-repo to cross-check against.
- **Open questions:** which of these are acceptable-as-is vs. genuinely worth fixing — product decision, not answered here.
- **Confidence level:** mixed 🟢/🟡, each tagged individually above.
