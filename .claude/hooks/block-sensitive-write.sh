#!/bin/bash
# PreToolUse Edit|Write: blocca scrittura diretta su dati runtime e segreti.
f=$(jq -r '.tool_input.file_path // empty')
if echo "$f" | grep -qE '(/backend/data/|(^|/)\.env$|\.key$|\.pem$|(^|/)config\.json$)'; then
  jq -n --arg f "$f" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:("File sensibile/dati runtime, non modificare direttamente (usa jsonStore/servizi): " + $f)}}'
fi
exit 0
