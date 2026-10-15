#!/bin/sh
# Attiva gli hook del repo (opt-in): sh scripts/git-hooks/install.sh
cd "$(git rev-parse --show-toplevel)" || exit 1
chmod +x scripts/git-hooks/pre-commit scripts/git-hooks/post-commit scripts/git-hooks/pre-push
git config core.hooksPath scripts/git-hooks
echo "Hook attivati (core.hooksPath=scripts/git-hooks)."
