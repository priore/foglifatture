---
name: backward_compatibility
description: Fundamental rule - every change stays backward compatible with data, config, rule files and older app builds already in use
metadata:
  type: feedback
---

Every change must keep backward compatibility. Existing user data, config, tax-rule files (`regole/<anno>.json`), persisted JSON in `backend/data/`, backups, API responses and the signed update manifest must keep working for installs and app builds that predate the change.

**Why:** the user stated it as a fundamental rule. Users hold real fiscal data (invoices, BTC ledger, declared years) and older installed builds receive updates remotely, so a breaking change corrupts data or breaks a shipped app that cannot be updated at once.

**How to apply:**
- New fields are optional with a default; never rename or remove a persisted field without a migration that reads the old shape.
- Readers accept old and new shapes; writers do not drop unknown fields.
- Rule files: add keys, do not change the meaning of existing ones; an older build must ignore what it does not know.
- Remote core/manifest changes must work with builds already in review or released.
- If a break is unavoidable, stop and ask via AskUserQuestion before proceeding.
- Plans state the compatibility impact of each phase. See [[plans_keep_status]].
