# Roadmap

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

🔴 **No explicit roadmap exists in the repository.** No TODO list or issue tracker was found in-repo — only `git log` and `KNOWN_ISSUES.md` gaps. Everything below is inferred purely from those gaps — treat as candidate items, not commitments.

## Candidate next steps (inferred from known gaps)

- 🔴 Delete the unreferenced dead file `wizard/StepCliente.vue` (superseded by `StepClienti.vue`). See `KNOWN_ISSUES.md`.
- 🔴 Decide whether the "light glass" design intent should be implemented literally (backdrop-filter/blur) or the current translucency approach should be documented as the final design language. See `DESIGN_SYSTEM.md`.
- 🔴 Remove the unused `cors` dependency, or document why it's kept for a future non-same-origin deployment scenario.
- 🔴 Assess whether basic accessibility (ARIA roles, alt text beyond logos) is worth adding given the app's single-operator, local-only usage pattern.

---

## Review Checklist

- **Completeness:** honestly reflects the absence of a stated roadmap rather than fabricating one.
- **Accuracy:** confirmed no roadmap/TODO/issue-tracker artifacts exist in-repo.
- **Consistency:** candidate items trace 1:1 to entries in `KNOWN_ISSUES.md`.
- **TODO:** replace this document's content wholesale if the user provides an actual roadmap/backlog source (e.g. a ticket tracker) — flag as reference in `AI-Workspace/documentation/`.
- **Missing information:** no stakeholder input, deadlines, or priorities available.
- **Open questions:** does a roadmap exist outside this repo? Ask the user.
- **Confidence level:** entirely 🔴 — this document is speculative by necessity, clearly labeled as such.
