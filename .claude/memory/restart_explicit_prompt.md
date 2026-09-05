---
name: restart-explicit-prompt
description: when the user explicitly types "riavvio"/"riavvia" (restart) in the prompt, skip the AskUserQuestion confirmation and restart directly
metadata:
  type: feedback
---

If the user explicitly types "riavvio" or "riavvia" (the Italian verb for restart) in their prompt, proceed to restart the backend without asking for confirmation via AskUserQuestion.

**Why:** the "confirm before restart" rule in this `CLAUDE.md` exists for implicit restarts — but when the restart request is already explicit in the prompt, the confirmation is redundant.

**How to apply:** the "confirm before restart" rule still applies when the restart is an implicit consequence of another request (e.g. "I made a fix, sort it out" without mentioning restart). Ask for confirmation ONLY in those implicit cases; if the user writes "riavvia"/"riavvio" in the prompt, it's already an explicit direct request — proceed immediately (build frontend if needed, kill the process on port 1969, `nohup node src/server.js &`).
