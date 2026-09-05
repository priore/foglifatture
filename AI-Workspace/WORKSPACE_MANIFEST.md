# Workspace Manifest

Index of the AI Workspace Knowledge Base. Source of truth for what exists, why, in what order, and when each document counts as done.

Confidence levels used throughout the workspace: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

---

## Document Registry

| Document | Path | Purpose | Depends on | Status | Priority | Recommended model |
|---|---|---|---|---|---|---|
| README | [README.md](AI-Workspace/README.md) | Entry point: what the workspace is, how to navigate it | — | 🟢 complete | High | Any |
| PROJECT_CONTEXT | [architecture/PROJECT_CONTEXT.md](AI-Workspace/architecture/PROJECT_CONTEXT.md) | Product purpose, users, domain (fatturazione/invoicing), business goals | — | 🟢 complete | Critical | Claude Opus |
| PROJECT_ANALYSIS | [architecture/PROJECT_ANALYSIS.md](AI-Workspace/architecture/PROJECT_ANALYSIS.md) | Codebase inventory: stack, folder map, entry points, scripts, env config | PROJECT_CONTEXT | 🟢 complete | Critical | Claude Opus |
| ARCHITECTURE | [architecture/ARCHITECTURE.md](AI-Workspace/architecture/ARCHITECTURE.md) | System architecture: frontend/backend boundary, data flow, integrations (IMAP/mail, OAuth, XLSX, PDF export) | PROJECT_ANALYSIS | 🟢 complete | Critical | Claude Opus |
| UI_ANALYSIS | [architecture/UI_ANALYSIS.md](AI-Workspace/architecture/UI_ANALYSIS.md) | Vue views/components inventory, routing, state, user flows | ARCHITECTURE | 🟢 complete | High | Claude Sonnet |
| DESIGN_SYSTEM | [design/DESIGN_SYSTEM.md](AI-Workspace/design/DESIGN_SYSTEM.md) | Visual language as implemented: light glass + dark mode, accessibility posture | UI_ANALYSIS | 🟢 complete | Medium | Claude Sonnet |
| DESIGN_TOKENS | [design/DESIGN_TOKENS.md](AI-Workspace/design/DESIGN_TOKENS.md) | Concrete tokens (color, spacing, radius, typography, shadow/glass values) extracted from CSS | DESIGN_SYSTEM | 🟢 complete | Medium | Claude Sonnet |
| COMPONENT_LIBRARY | [design/COMPONENT_LIBRARY.md](AI-Workspace/design/COMPONENT_LIBRARY.md) | Catalog of reusable Vue components, props, variants, usage sites | DESIGN_TOKENS, UI_ANALYSIS | 🟢 complete | Medium | Claude Sonnet |
| ROADMAP | [product/ROADMAP.md](AI-Workspace/product/ROADMAP.md) | Planned/likely future work inferred from code state and stated intent | ARCHITECTURE | 🟢 complete (🔴 speculative content — no roadmap exists in-repo) | Low | Any |
| DECISIONS | [product/DECISIONS.md](AI-Workspace/product/DECISIONS.md) | Architectural/product decisions log (ADR-style) as observed or told | ARCHITECTURE | 🟢 complete | Low | Any |
| KNOWN_ISSUES | [product/KNOWN_ISSUES.md](AI-Workspace/product/KNOWN_ISSUES.md) | Observed bugs, gaps, tech debt — documented only, never fixed here | ARCHITECTURE, UI_ANALYSIS | 🟢 complete | Medium | Any |
| CHANGELOG | [product/CHANGELOG.md](AI-Workspace/product/CHANGELOG.md) | Running log of what changed in the codebase over time | PROJECT_ANALYSIS | 🟢 complete (baseline entry only — no git history) | Low | Any |
| GLOSSARY | [product/GLOSSARY.md](AI-Workspace/product/GLOSSARY.md) | Domain and codebase terms (invoicing terminology, internal naming) | PROJECT_CONTEXT | 🟢 complete | Low | Any |
| DESIGN_PATTERNS_AS_IS | [documentation/DESIGN_PATTERNS_AS_IS.md](AI-Workspace/documentation/DESIGN_PATTERNS_AS_IS.md) | Factual architectural/design pattern inventory (backend + frontend) | PROJECT_ANALYSIS | 🟢 complete | Medium | Claude Sonnet |

Support directories (no fixed document set, populated incrementally as work happens):

| Directory | Purpose |
|---|---|
| [prompts/](AI-Workspace/prompts/) | Reusable prompts for generating/updating specific documents |
| [templates/](AI-Workspace/templates/) | Document templates (section skeletons, review checklist template) |
| [workflows/](AI-Workspace/workflows/) | Repeatable AI workflows for maintaining the workspace |
| [reviews/](AI-Workspace/reviews/) | Point-in-time review outputs against the Review Checklist |
| [tasks/](AI-Workspace/tasks/) | Task briefs, one per incremental documentation task |
| [documentation/](AI-Workspace/documentation/) | Overflow/reference material that doesn't fit the fixed documents above |

---

## Recommended Generation Order

```
Phase 1  PROJECT_CONTEXT
   ↓
Phase 2  PROJECT_ANALYSIS
   ↓
Phase 3  ARCHITECTURE
   ↓
Phase 4  UI_ANALYSIS
   ↓
Phase 5  DESIGN_SYSTEM
   ↓
Phase 6  DESIGN_TOKENS
   ↓
Phase 7  COMPONENT_LIBRARY
   ↓
Phase 8  ROADMAP, DECISIONS, KNOWN_ISSUES, GLOSSARY (parallel, any order)
   ↓
Phase 9  CHANGELOG (ongoing, updated after each phase)
```

Rationale: each phase reads only documents already produced by earlier phases, never the reverse. Design docs (5–7) depend on UI_ANALYSIS having already named the components and views they describe. Product docs (8) depend on architecture being settled so decisions/issues reference real structure, not guesses.

---

## Rules for Every Document

- One document per task. Never batch-generate.
- Every claim tagged 🟢/🟡/🔴.
- No code changes, no fixes, no refactors — analysis and documentation only.
- Every document ends with the Review Checklist: Completeness, Accuracy, Consistency, TODO, Missing information, Open questions, Confidence level.
- Documents are living — update in place as the codebase evolves, don't fork new versions.

## Completion Criteria (per document)

A document is "done" for its current pass when:
1. Every section in its template is filled or explicitly marked TODO.
2. Every factual claim carries a confidence tag.
3. Review Checklist is filled out, not left as a header.
4. No unresolved dependency on a document that doesn't exist yet (i.e., it doesn't assume facts only a later-phase document would establish).

## Status Legend

🔴 empty — file created, no content yet
🟡 draft — partially filled or inferred, needs verification
🟢 complete — filled, reviewed, confidence levels assigned
