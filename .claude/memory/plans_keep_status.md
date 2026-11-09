---
name: plans_keep_status
description: Never prune or delete content from plan docs; keep the record of what was done, only update status or move the file
metadata:
  type: feedback
---

When tidying `AI-Workspace/Plans/`, move whole files (`completati/`, `scartati/`) and update status marks, but never cut sections, rows or items out of a plan.

**Why:** the user wants each plan to keep the record of what was done. Removing finished or low-value items to leave "only the to-do" was rejected.

**How to apply:** a finished item stays in the table marked ✅ with date/commit; a dropped idea stays marked as dropped. Reorganize by file location, not by deleting content. Links between plans stay relative and are recomputed after each move. See [[plans_self_contained]].
