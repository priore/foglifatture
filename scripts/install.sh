#!/bin/bash
# Installa l'app come servizio launchd: parte all'avvio del Mac e si riavvia da solo
# se va in crash. Un solo comando, nessuna finestra di terminale da tenere aperta.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.prioregroup.fatturazione"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$PROJECT_DIR/logs"

if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Node.js non trovato: installazione tramite Homebrew..."
    brew install node
  fi
fi

NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "Errore: node non trovato e installazione automatica non riuscita. Installa Node.js da nodejs.org e riprova."
  exit 1
fi

echo "Installazione build frontend e dipendenze backend..."
(cd "$PROJECT_DIR/frontend" && npm install --silent && npm run build --silent)
(cd "$PROJECT_DIR/backend" && npm install --silent)

if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
  cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
  echo "Creato backend/.env dai valori di default (nessuna credenziale Google configurata)."
fi

if grep -q '^SESSION_SECRET=cambia-questo-segreto$' "$PROJECT_DIR/backend/.env" 2>/dev/null; then
  RANDOM_SECRET="$("$NODE_BIN" -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  sed -i.bak "s/^SESSION_SECRET=cambia-questo-segreto$/SESSION_SECRET=$RANDOM_SECRET/" "$PROJECT_DIR/backend/.env"
  rm -f "$PROJECT_DIR/backend/.env.bak"
  echo "Generato SESSION_SECRET casuale."
fi

mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$PROJECT_DIR/backend/src/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR/backend</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/error.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo ""
echo "Installato e avviato: http://localhost:1969"
echo "Log:   $LOG_DIR/out.log"
echo "Stato: launchctl list | grep $LABEL"
echo "Disinstalla con: scripts/uninstall.sh"

sleep 2
open "http://localhost:1969" 2>/dev/null || true
