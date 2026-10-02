#!/bin/bash
# PostToolUse Edit|Write: test mirato del service modificato + promemoria riavvio backend.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */backend/src/*.test.js|*/backend/src/*.e2e.js) exit 0 ;;
  */backend/src/*.js) ;;
  *) exit 0 ;;
esac
msg="Backend modificato: serve riavvio (chiedere conferma con AskUserQuestion)."
t="${f%.js}.test.js"
if [ -f "$t" ]; then
  out=$(cd "$(dirname "$f")/../.." && node --experimental-test-module-mocks --test "$t" 2>&1 | grep -E '^ℹ (pass|fail)|✖|Error' | head -15)
  msg="$msg Test $(basename "$t"):
$out"
fi
jq -n --arg m "$msg" '{systemMessage:$m}'
exit 0
