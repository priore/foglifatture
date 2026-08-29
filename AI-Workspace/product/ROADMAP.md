# Roadmap

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

🔴 **No explicit roadmap exists in the repository.** README.md, `.env.example`, and code comments state current functionality and one caveat (PEC untested) but no forward-looking plan, TODO list, or issue tracker was found in-repo. Everything below is inferred purely from `KNOWN_ISSUES.md` gaps — treat as candidate items, not commitments.

## Candidate next steps (inferred from known gaps)

- 🔴 Validate PEC send/receive against a real SDI mailbox — the single most consequential open gap per the project's own README caveat. See `KNOWN_ISSUES.md`.
- 🔴 Decide whether the "light glass" design intent should be implemented literally (backdrop-filter/blur) or the current translucency approach should be documented as the final design language. See `DESIGN_SYSTEM.md`.
- 🔴 Either wire up a manual dark-mode toggle (the CSS hook already exists via `data-theme`) or remove the unused override selector. See `KNOWN_ISSUES.md`.
- 🔴 Remove the unused `cors` dependency, or document why it's kept for a future non-same-origin deployment scenario.
- 🔴 Assess whether basic accessibility (ARIA roles, alt text beyond logos) is in scope given the single-user nature of the app.

---

## Review Checklist

- **Completeness:** honestly reflects the absence of a stated roadmap rather than fabricating one.
- **Accuracy:** confirmed no roadmap/TODO/issue-tracker artifacts exist in-repo (README, BOOTSTRAP.md, code comments checked).
- **Consistency:** candidate items trace 1:1 to entries in `KNOWN_ISSUES.md`.
- **TODO:** replace this document's content wholesale if the user provides an actual roadmap/backlog source (e.g. a ticket tracker) — flag as reference in `AI-Workspace/documentation/`.
- **Missing information:** no stakeholder input, deadlines, or priorities available.
- **Open questions:** does a roadmap exist outside this repo (e.g. in a task tracker not yet linked)? See `AI-Workspace/WORKSPACE_MANIFEST.md` reference-type memory guidance — ask the user.
- **Confidence level:** entirely 🔴 — this document is speculative by necessity, clearly labeled as such.
