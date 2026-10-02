---
name: shell-inline-scripts
description: JS that builds/executes external scripts (osascript, AppleScript, shell) — when to extract to a dedicated file
metadata:
  type: feedback
---

When JS code builds and executes an external script (e.g. AppleScript via `osascript`, shell commands, etc.):
- **One line**: inline as a template string is fine (passed directly to `execFile`/`spawn`).
- **Multi-line**: extract to a dedicated file (e.g. `backend/src/scripts/nome.applescript`), passing parameters via argv (`osascript file.scpt arg1 arg2...`) instead of interpolating strings in the JS source.

**Why:** separating code from script improves readability and removes the risk of manual escaping bugs on multi-line strings; direct interpolation in long blocks is harder to maintain and review.

**How to apply:** check both Windows/Mac branches (commands differ per platform) and any JS that shells out to an external script — verify whether the generated script is multi-line before writing it inline. Applied example: `backend/src/services/mailService.js` → multi-line AppleScript extracted to `backend/src/scripts/mailAppMac.applescript`, args passed via argv instead of manual escaping (`escapaAppleScript` removed, no longer needed).
