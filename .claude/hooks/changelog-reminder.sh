#!/bin/bash
# PreToolUse Bash: su git commit feat/fix avvisa se CHANGELOG.md non e' in staging.
cmd=$(jq -r '.tool_input.command // empty')
echo "$cmd" | grep -qE '\bgit\s+commit\b' || exit 0
echo "$cmd" | grep -qE -- '-m\s*"?'"'"'?(feat|fix)' || exit 0
git diff --cached --name-only | grep -qx 'CHANGELOG.md' && exit 0
jq -n '{systemMessage:"feat/fix senza CHANGELOG.md in staging: aggiungere voce sotto [Unreleased] (IT), salvo modifica non user-facing."}'
exit 0
