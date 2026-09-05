# AI Workspace

Evolving Knowledge Base for the **Fatturazione** project (Timesheet & Italian e-invoicing app). Source of truth for any AI agent — or human — working on this codebase.

Rules governing this workspace: [`CLAUDE.md`](../CLAUDE.md) at repo root.

## Start here

- [`WORKSPACE_MANIFEST.md`](WORKSPACE_MANIFEST.md) — full document registry, dependency order, status, priority.
- [`architecture/PROJECT_CONTEXT.md`](architecture/PROJECT_CONTEXT.md) — what this app is, who it's for, the end-to-end workflow.

## Structure

```
architecture/
  PROJECT_CONTEXT.md           — purpose, users, domain, workflow
  PROJECT_ANALYSIS.md          — stack, entry points, scripts, env, folders
  ARCHITECTURE.md              — system shape, request pipeline, integrations, data flow
  UI_ANALYSIS.md               — routes, views, components, state
design/
  DESIGN_SYSTEM.md             — visual language, dark mode, accessibility (as implemented)
  DESIGN_TOKENS.md             — exact color/shadow/typography values
  COMPONENT_LIBRARY.md         — reusable Vue components and shared UI primitives
product/
  ROADMAP.md                   — candidate next steps (no formal roadmap exists in-repo)
  DECISIONS.md                 — architectural decisions as observed
  KNOWN_ISSUES.md              — gaps and inconsistencies found during analysis
  CHANGELOG.md                 — ongoing log (baseline: 2026-08-29, no prior git history)
  GLOSSARY.md                  — domain and codebase terminology
documentation/
  DESIGN_PATTERNS_AS_IS.md     — factual pattern inventory (backend + frontend)
prompts/  templates/  workflows/  reviews/  tasks/  — support material, populated as work happens
```

## Confidence legend

🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis — every claim in every document is tagged.

## Maintaining this workspace

- One document per task, never batch-edit unless explicitly told to.
- Every document ends with a Review Checklist (Completeness, Accuracy, Consistency, TODO, Missing information, Open questions, Confidence level).
- Update documents in place as the code evolves — this is a living workspace, not a point-in-time snapshot.

---

## Review Checklist

- **Completeness:** links every document currently in the workspace.
- **Accuracy:** structure matches the actual `AI-Workspace/` tree on disk.
- **Consistency:** matches `WORKSPACE_MANIFEST.md` registry.
- **TODO:** update this map if new documents are added to `documentation/`, `prompts/`, `templates/`, `workflows/`, `reviews/`, or `tasks/`.
- **Missing information:** none for a navigation document.
- **Open questions:** none.
- **Confidence level:** 🟢 — structural facts only.
