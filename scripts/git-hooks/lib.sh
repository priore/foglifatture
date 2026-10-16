# Helper condivisi degli hook git (sh POSIX, nessuna dipendenza).
# Nessun controllo (nemmeno sui nomi file) sul repo privato di sviluppo: li' e' ammesso tutto.
# Modalita': i controlli scattano solo se il repo ha un remote github.com
# (clone pubblico o fork di un contributor); FOGLIFATTURE_HOOKS_MODE=force li impone sempre, =off li disattiva.
# Pattern/identita' private del maintainer: file fuori dal repo (mai versionato), vedi PRIVATE_FILE.

PRIVATE_FILE=${FOGLIFATTURE_PRIVATE_PATTERNS:-$HOME/.config/foglifatture/private-patterns}
FORBIDDEN_NAMES='(^|/)(config\.json|\.env|[^/]*\.key|[^/]*\.pem)$|^backend/(data|logs)/|^AI-Workspace/Output/'
GENERIC_PATTERNS='/Users/[A-Za-z0-9._-]+/
C:\\Users\\[A-Za-z0-9._-]+\\
(^|[^0-9.])(10\.[0-9]+|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]+\.[0-9]+($|[^0-9])
[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|icloud)\.[A-Za-z]+
-----BEGIN [A-Z ]*PRIVATE KEY-----'

content_checks_enabled() {
  case "${FOGLIFATTURE_HOOKS_MODE:-auto}" in
    off) return 1 ;;
    force) return 0 ;;
  esac
  git remote -v 2>/dev/null | grep -q 'github\.com'
}

private_patterns() {
  [ -f "$PRIVATE_FILE" ] || return 0
  grep -vE '^[[:space:]]*($|#|identity:)' "$PRIVATE_FILE"
}

allowed_emails() {
  [ -f "$PRIVATE_FILE" ] || return 0
  sed -n 's/^identity:.*<\(.*\)>.*/\1/p' "$PRIVATE_FILE"
}

is_skipped_path() {
  case "$1" in scripts/git-hooks/*|*package-lock.json) return 0 ;; esac
  root=$(git rev-parse --show-toplevel)
  [ -f "$root/.hooksignore" ] && printf '%s\n' "$1" | grep -qE -f "$root/.hooksignore"
}

# stdin: righe da controllare; stdout: righe che violano. Esce 0 se ne trova.
scan_lines() {
  pats=$(mktemp)
  { printf '%s\n' "$GENERIC_PATTERNS"; private_patterns; } | grep -v '^$' > "$pats"
  grep -vE 'hooks:allow|tuonome|192\.168\.1\.10' | grep -E -f "$pats"
  rc=$?
  rm -f "$pats"
  return $rc
}

# args: argomenti di `git diff` (es. --cached, oppure BASE HEAD). Esce 1 se trova violazioni.
check_diff() {
  status=0
  if content_checks_enabled; then
    git diff "$@" --name-only --diff-filter=ACMR | while IFS= read -r f; do
      if printf '%s\n' "$f" | grep -qE "$FORBIDDEN_NAMES"; then
        echo "BLOCCATO file sensibile: $f"; echo "$f" >> "$VIOLATIONS"
      fi
    done
    git diff "$@" --name-only --diff-filter=ACMR | while IFS= read -r f; do
      is_skipped_path "$f" && continue
      git diff "$@" -U0 -- "$f" | grep '^+' | grep -v '^+++' | scan_lines | while IFS= read -r l; do
        echo "BLOCCATO dato personale in $f: $l"; echo "$f" >> "$VIOLATIONS"
      done
    done
  fi
  [ ! -s "$VIOLATIONS" ] || status=1
  return $status
}

# arg: range di commit. Verifica author/committer contro le identita' consentite (se definite).
check_identity() {
  emails=$(allowed_emails)
  [ -n "$emails" ] || return 0
  bad=0
  git log --format='%h %ae %ce' "$1" | while read -r h a c; do
    for e in "$a" "$c"; do
      printf '%s\n' "$emails" | grep -qxF "$e" || { echo "BLOCCATA identita' non consentita in $h: $e"; echo "$h" >> "$VIOLATIONS"; }
    done
  done
  [ ! -s "$VIOLATIONS" ]
}
