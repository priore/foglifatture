---
name: plans_self_contained
description: Nothing outside AI-Workspace/Plans may reference a plan doc; Plans root holds only live plans, done ones in completati/, dropped in scartati/
metadata:
  type: feedback
---

No source comment, public doc or product doc outside `AI-Workspace/Plans/` names or links a plan document or section (`PAGAMENTI_BTC.md F3`, `Plans/...`). Plans root keeps only plans still to start or finish; completed go to `Plans/completati/`, discarded or infeasible to `Plans/scartati/`.

**Why:** Plans are private (removed by `sync-public`), so references from public code leak private paths and rot as plans move. The user asked for the rule and to keep the root clean.

**How to apply:** when writing a code comment, state the rule inline and cite FP-/K-ids, never a plan name. When a plan is finished or dropped, move it with `git mv` and fix the relative links between plans. Operational pointers inside `.claude/rules` and `.claude/skills` are the only allowed exception.
