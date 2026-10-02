---
name: riavvia-backend
description: Restart the Timesheet backend (port 1969) so code or frontend/dist changes take effect. Use when the user asks to restart the backend ("riavvia").
disable-model-invocation: true
---

1. If the user's prompt did not contain "riavvia"/"riavvio", ask confirmation first via AskUserQuestion (see `.claude/memory/restart_explicit_prompt.md`).
2. `pid=$(lsof -i :1969 -sTCP:LISTEN -t)`; if set, `kill $pid`.
3. `cd backend && nohup node src/server.js > /dev/null 2>&1 &`
4. Wait until `lsof -i :1969 -sTCP:LISTEN -t` returns a PID (single `until` loop, max ~10s). Report the new PID or the failure.
