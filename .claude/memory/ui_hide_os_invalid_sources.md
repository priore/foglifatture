---
name: ui_hide_os_invalid_sources
description: Data sources (or options) not valid for the current OS are hidden, not shown disabled; temporary states of valid sources stay disabled with explanation
metadata:
  type: feedback
---

An option that can never work on the current operating system (e.g. "cartella libera" on iOS, iCloud on Windows if unsupported) is **not shown at all**. This is a project exception to the general "never hide, always disable with explanation" rule, alongside the already-decided hiding of sandbox-impossible features in the macOS app.

**Why:** the user stated it as a project UI rule (2026-10-20) while reviewing the cloud-storage analysis; showing an option that can never be enabled on that OS is noise.

**How to apply:** hide by OS/platform capability (via `capacita`). Keep "visible + disabled + explanation" for temporary or fixable states of a valid option: provider disconnected, token expired, offline, invoice emission blocked by a numbering anomaly. An unverified feature still under spike is not hidden: it stays in the design and gets analyzed.
