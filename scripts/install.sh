#!/bin/bash
# Installa l'app come servizio launchd: parte all'avvio del Mac e si riavvia da solo
# se va in crash. Un solo comando, nessuna finestra di terminale da tenere aperta.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.prioregroup.fatturazione"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$PROJECT_DIR/logs"

# ── Homebrew (strumento usato per installare Node.js, Git e GitHub CLI) ──────
# Il suo installer richiede anche i Command Line Tools e chiede la password di amministratore.
if ! command -v brew >/dev/null 2>&1; then
  for B in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$B" ] && eval "$("$B" shellenv)" && break
  done
fi
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew non trovato: installazione..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || echo "  Installazione Homebrew non riuscita."
  for B in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$B" ] && eval "$("$B" shellenv)" && break
  done
fi

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

# ── Git (serve agli aggiornamenti automatici) ─────────────────────────────────
# Su macOS /usr/bin/git esiste sempre ma senza Command Line Tools fallisce: si verifica l'esecuzione.
if ! git --version >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Git non trovato: installazione tramite Homebrew..."
    brew install git
  else
    echo "Git non trovato: installazione Command Line Tools (conferma nella finestra che si apre, poi rilancia lo script)..."
    xcode-select --install 2>/dev/null || true
    exit 1
  fi
fi

# ── Google Antigravity CLI (agy) — provider AI gratuito via OAuth Google ──────
# Verifica che sia il vero agy Google (non un altro binario con lo stesso nome)
if ! command -v agy >/dev/null 2>&1; then
  echo "Installazione Google Antigravity CLI..."
  curl -fsSL https://antigravity.google/cli/install.sh | bash
  export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
  command -v agy >/dev/null 2>&1 && echo "Google Antigravity CLI installato." || echo "  Installazione agy non riuscita — scarica manualmente da antigravity.google"
else
  echo "Google Antigravity CLI già installato."
fi

# ── GitHub CLI + estensione Copilot — provider AI gratuito via OAuth GitHub ───
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI non trovato."
  if command -v brew >/dev/null 2>&1; then
    echo "Installazione tramite Homebrew..."
    brew install gh
  else
    echo "  Homebrew non disponibile — scarica manualmente da cli.github.com"
  fi
else
  echo "GitHub CLI già installato."
fi
if command -v gh >/dev/null 2>&1 && ! gh extension list 2>/dev/null | grep -q "gh-copilot"; then
  echo "Installazione estensione GitHub Copilot..."
  gh extension install github/gh-copilot 2>/dev/null || echo "  Impossibile installare gh-copilot (potrebbe richiedere login GitHub prima)."
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
