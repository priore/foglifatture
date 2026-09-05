# Known Issues

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

Observed gaps and inconsistencies. Documentation only — nothing here is fixed by this workspace.

## Sparse backend test coverage

🟢 Only one test file exists (`backend/src/services/pecService.test.js`), using Node's built-in `--test` runner (see `code-quality.md`). Most `backend/src/services/*Service.js` have no tests. `.claude/rules/dev-workflow.md` now asks for a test on every non-trivial backend service change going forward, but existing services remain uncovered.

---

## Review Checklist

- **Completeness:** captures issues surfaced during architecture, UI, and design passes. Not an exhaustive bug hunt (out of scope — documentation only).
- **Accuracy:** each item traces to a confirmed source document listed inline.
- **Consistency:** confidence tags match originating documents.
- **TODO:** re-scan after a data-schema note (config.json/invoices/timesheets shapes) is written — may surface more issues.
- **Missing information:** no runtime/production incident history available in-repo to cross-check against.
- **Open questions:** which of these are acceptable-as-is vs. genuinely worth fixing — product decision, not answered here.
- **Confidence level:** mixed 🟢/🟡, each tagged individually above.
