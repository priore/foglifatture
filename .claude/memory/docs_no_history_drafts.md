---
name: docs_no_history_drafts
description: AI-Workspace plan/analysis docs are drafts rewritten in place; no change history, no "corrects X / replaces decision Y" notes
metadata:
  type: feedback
---

When a decision changes, rewrite the affected sections of every plan in `AI-Workspace/` to the current state. Do not add notes like "sostituisce la decisione…", "correzione rispetto a…", "non più bloccante", "decisione dell'utente del <data>", or append a pointer saying "where this differs, the other doc wins".

**Why:** the user said these documents are first drafts and the history is of no interest (2026-10-20). It also matches the WORKSPACE_MANIFEST rule "si aggiornano sul posto: niente storia".

**How to apply:** after a decision, grep the related plans for outdated statements and rewrite them in place; cross-references between docs point to the current content only.
