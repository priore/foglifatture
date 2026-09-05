#!/bin/bash
# Applica un aggiornamento: checkout del tag di release, install/build, scrittura VERSION,
# poi termina il processo Node del backend — launchd (KeepAlive) lo rilancia da solo con
# la build nuova. Lanciato da updateService.js, ma eseguibile anche a mano per test:
#   scripts/update.sh v1.2.3 <pid-processo-backend>
set -euo pipefail

TAG="${1:?tag mancante (es. v1.2.3)}"
BACKEND_PID="${2:?pid processo backend mancante}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/update.log"
cd "$PROJECT_DIR"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG_FILE"; }

log "Avvio aggiornamento a $TAG"

if [ -n "$(git status --porcelain)" ]; then
  log "ERRORE: modifiche locali non committate, aggiornamento annullato"
  exit 1
fi

git fetch --tags origin
git checkout "$TAG"

# npm install è no-op veloce se il lockfile non è cambiato: nessun bisogno di diff manuale.
log "Install dipendenze"
(cd backend && npm install --silent)
(cd frontend && npm install --silent)

log "Build frontend"
(cd frontend && npm run build --silent)

echo "$TAG" > backend/VERSION
log "Aggiornamento a $TAG completato, riavvio processo backend (pid $BACKEND_PID)"

kill "$BACKEND_PID" 2>/dev/null || true
