#!/bin/bash
# Costruisce FogliFatture-x.y.z.pkg per macOS
# Richiede: Xcode CLT, account Apple Developer con certificato "Developer ID Installer"
# Per test senza firma: commenta le sezioni SIGN e NOTARIZE
set -euo pipefail

VERSION="${1:-1.4.1}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$REPO_ROOT/packaging/build/mac"
PKG_ROOT="$BUILD_DIR/pkgroot"
SCRIPTS_DIR="$REPO_ROOT/packaging/mac/scripts"
OUTPUT="$REPO_ROOT/packaging/dist/FogliFatture-${VERSION}-mac-universal.pkg"

# --- Icona: genera .icns da favicon.svg se non già presente ---
ICNS_OUT="$REPO_ROOT/packaging/mac/FogliFatture.icns"
if [ ! -f "$ICNS_OUT" ]; then
  echo "Genero .icns da frontend/public/favicon.svg..."
  SVG_SRC="$REPO_ROOT/frontend/public/favicon.svg"
  ICONSET="$BUILD_DIR/FogliFatture.iconset"
  mkdir -p "$ICONSET"
  # qlmanage converte SVG -> PNG; sips scala le taglie
  qlmanage -t -s 512 -o "$BUILD_DIR" "$SVG_SRC" >/dev/null 2>&1 || true
  PNG_SRC="$BUILD_DIR/favicon.svg.png"
  if [ ! -f "$PNG_SRC" ]; then
    echo "WARN: qlmanage non ha prodotto PNG — icona non generata, bundle .app senza icona personalizzata"
  else
    for SIZE in 16 32 128 256 512; do
      sips -z $SIZE $SIZE "$PNG_SRC" --out "$ICONSET/icon_${SIZE}x${SIZE}.png" 2>/dev/null || true
      [ $SIZE -le 256 ] && cp "$ICONSET/icon_${SIZE}x${SIZE}.png" "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" 2>/dev/null || true
    done
    cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_512x512@2x.png" 2>/dev/null || true
    iconutil -c icns "$ICONSET" -o "$ICNS_OUT" 2>/dev/null || echo "WARN: iconutil fallito"
  fi
fi

# --- Struttura pkgroot (file installati dal .pkg — solo bootstrapper) ---
mkdir -p "$PKG_ROOT"
# Il .pkg non installa codice sorgente: il postinstall clona il repo.
# pkgroot è quasi vuoto — serve solo per pkgbuild.
mkdir -p "$PKG_ROOT/tmp/FogliFatture-placeholder"

# --- Build .pkg ---
mkdir -p "$(dirname "$OUTPUT")"
chmod +x "$SCRIPTS_DIR/postinstall"

pkgbuild \
  --root "$PKG_ROOT" \
  --scripts "$SCRIPTS_DIR" \
  --identifier "com.prioregroup.foglifatture" \
  --version "$VERSION" \
  --install-location "/" \
  "$BUILD_DIR/FogliFatture-unsigned.pkg"

# --- SIGN (richiede certificato "Developer ID Installer") ---
# Commenta questo blocco per test senza firma
if security find-identity -v -p basic | grep -q "Developer ID Installer"; then
  SIGNING_ID="$(security find-identity -v -p basic | grep 'Developer ID Installer' | head -1 | awk '{print $2}')"
  productsign \
    --sign "$SIGNING_ID" \
    "$BUILD_DIR/FogliFatture-unsigned.pkg" \
    "$OUTPUT"
  echo "Firmato: $OUTPUT"
else
  cp "$BUILD_DIR/FogliFatture-unsigned.pkg" "$OUTPUT"
  echo "WARN: certificato 'Developer ID Installer' non trovato — .pkg non firmato"
  echo "      Gatekeeper bloccherà l'installazione su macchine utente."
fi

# --- NOTARIZE ---
# Prerequisito una tantum: xcrun notarytool store-credentials "FogliFatture" --apple-id EMAIL --team-id JQRB98RUML --password APP_PASSWORD
if xcrun notarytool history --keychain-profile "FogliFatture" >/dev/null 2>&1; then
  echo "Notarizzazione in corso (può richiedere 1-5 minuti)..."
  xcrun notarytool submit "$OUTPUT" --keychain-profile "FogliFatture" --wait
  xcrun stapler staple "$OUTPUT"
  echo "Notarizzato e stapled."
else
  echo "WARN: profilo 'FogliFatture' non trovato in Keychain — notarizzazione saltata"
  echo "      Esegui: xcrun notarytool store-credentials \"FogliFatture\" --apple-id EMAIL --team-id JQRB98RUML --password APP_PASSWORD"
fi

echo ""
echo "Output: $OUTPUT"
echo "Dimensione: $(du -sh "$OUTPUT" | cut -f1)"
echo ""
echo "Test sandbox (non altera sistema corrente):"
echo "  installer -pkg \"$OUTPUT\" -target CurrentUserHomeDirectory -dumplog"
echo "  oppure: open \"$OUTPUT\" (wizard grafico, installa solo per utente corrente)"
