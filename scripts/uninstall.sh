#!/bin/bash
# Ferma e rimuove il servizio launchd. Non tocca dati, config o codice.
set -euo pipefail

LABEL="com.prioregroup.fatturazione"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
  echo "Servizio fermato e rimosso ($PLIST_PATH)."
else
  echo "Nessun servizio installato ($PLIST_PATH non trovato)."
fi
