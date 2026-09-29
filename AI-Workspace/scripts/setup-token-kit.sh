#!/bin/bash
set -e

PROJ_DIR="."
KIT_REPO="${KIT_REPO:-/Users/danilo/Documents/Prioregroup/KitToken}"

echo "=== Token-saving kit setup ==="

# Detect tech
TECH=""
if find "$PROJ_DIR" -maxdepth 2 \( -name "*.csproj" -o -name "*.sln" \) | grep -q .; then
  TECH="csharp"
elif find "$PROJ_DIR" -maxdepth 1 -name "*.xcodeproj" -type d | grep -q .; then
  TECH="swift"
elif [ -f "$PROJ_DIR/build.gradle" ] || [ -f "$PROJ_DIR/build.gradle.kts" ]; then
  TECH="android"
elif [ -f "$PROJ_DIR/package.json" ]; then
  if grep -q '"@angular' "$PROJ_DIR/package.json" 2>/dev/null; then
    TECH="javascript"
  elif grep -q 'xcode' "$PROJ_DIR/package.json" 2>/dev/null; then
    TECH="javascript"
  else
    TECH="javascript"
  fi
elif [ -f "$PROJ_DIR/go.mod" ]; then
  TECH="go"
elif [ -f "$PROJ_DIR/Cargo.toml" ]; then
  TECH="rust"
elif [ -f "$PROJ_DIR/pyproject.toml" ] || [ -f "$PROJ_DIR/setup.py" ]; then
  TECH="python"
fi

if [ -z "$TECH" ]; then
  # Fallback: detect from folder name
  FOLDER_NAME=$(basename "$(pwd)")
  case "$FOLDER_NAME" in
    *ios*|*swift*)
      TECH="swift"
      echo "⚠ Detected from folder name: $TECH"
      ;;
    *android*)
      TECH="android"
      echo "⚠ Detected from folder name: $TECH"
      ;;
    *)
      if [ -n "$FORCE_TECH" ]; then
        TECH="$FORCE_TECH"
        echo "⚠ Using forced tech: $TECH"
      else
        echo "ERROR: Could not detect tech stack. Checked for: C#, Swift, Android, JS, Go, Rust, Python"
        echo "Usage: FORCE_TECH=swift ./AI-Workspace/scripts/setup-token-kit.sh"
        exit 1
      fi
      ;;
  esac
fi

echo "✓ Detected tech: $TECH"
echo

# Create .claude/token-savings
mkdir -p "$PROJ_DIR/.claude/token-savings/hooks"

# Copy core rules
cp "$KIT_REPO/core/rules.md" "$PROJ_DIR/.claude/token-savings/"
echo "✓ Copied core rules"

# Copy tech-specific install.sh if exists
if [ -f "$KIT_REPO/modules/$TECH/install.sh" ]; then
  cp "$KIT_REPO/modules/$TECH/install.sh" "$PROJ_DIR/.claude/token-savings/"
  echo "✓ Copied install.sh for $TECH"
else
  # Create minimal install.sh
  echo "#!/bin/bash
echo '✓ Token-saving kit: $TECH module'
exit 0" > "$PROJ_DIR/.claude/token-savings/install.sh"
  chmod +x "$PROJ_DIR/.claude/token-savings/install.sh"
  echo "⚠ Created minimal install.sh (no external tools for $TECH)"
fi

# Copy or create hook
case "$TECH" in
  csharp)
    cp "$KIT_REPO/modules/csharp/hooks/dotnet-output.py" "$PROJ_DIR/.claude/token-savings/hooks/"
    HOOK_CMD='python3 "$CLAUDE_PROJECT_DIR/.claude/token-savings/hooks/dotnet-output.py"'
    ;;
  android)
    cp "$KIT_REPO/modules/android/README.md" "$PROJ_DIR/.claude/token-savings/" 2>/dev/null || true
    HOOK_CMD='echo "{}"'  # No hook needed for gradle -q
    ;;
  javascript)
    HOOK_CMD='echo "{}"'  # Jest/vitest handle quiet mode natively
    ;;
  swift)
    if [ -f "$KIT_REPO/modules/swift/hooks/xcode-output.py" ]; then
      cp "$KIT_REPO/modules/swift/hooks/xcode-output.py" "$PROJ_DIR/.claude/token-savings/hooks/"
      HOOK_CMD='python3 "$CLAUDE_PROJECT_DIR/.claude/token-savings/hooks/xcode-output.py"'
    else
      HOOK_CMD='echo "{}"'
    fi
    ;;
  *)
    HOOK_CMD='echo "{}"'
    ;;
esac

echo "✓ Configured hook for $TECH"
echo

# Update settings.json
SETTINGS_FILE="$PROJ_DIR/.claude/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "enabledPlugins": {
    "ponytail@ponytail": true,
    "caveman@caveman": true
  },
  "extraKnownMarketplaces": {
    "ponytail": {
      "source": {
        "source": "github",
        "repo": "DietrichGebert/ponytail"
      }
    },
    "caveman": {
      "source": {
        "source": "github",
        "repo": "JuliusBrussee/caveman"
      }
    }
  }
}
EOF
  echo "✓ Created settings.json"
fi

# Add hook to settings.json (if not already present)
if ! grep -q '"PreToolUse"' "$SETTINGS_FILE"; then
  python3 << PYEOF
import json
import sys

with open("$SETTINGS_FILE") as f:
    settings = json.load(f)

if "hooks" not in settings:
    settings["hooks"] = {"PreToolUse": []}

# Only add if not already there
if not settings["hooks"].get("PreToolUse"):
    settings["hooks"]["PreToolUse"] = [{
        "matcher": "Bash",
        "hooks": [{
            "type": "command",
            "command": "$HOOK_CMD",
            "timeout": 5
        }]
    }]

with open("$SETTINGS_FILE", "w") as f:
    json.dump(settings, f, indent=2)
PYEOF
  echo "✓ Registered hook in settings.json"
fi

# Update CLAUDE.md
CLAUDE_FILE="$PROJ_DIR/.claude/CLAUDE.md"
if [ -f "$CLAUDE_FILE" ]; then
  if ! grep -q "token-savings" "$CLAUDE_FILE"; then
    echo "" >> "$CLAUDE_FILE"
    echo "**Token-saving rules:** see [.claude/token-savings/rules.md](.claude/token-savings/rules.md)" >> "$CLAUDE_FILE"
    echo "✓ Added token-savings pointer to CLAUDE.md"
  fi
fi

echo
echo "✓ Token-saving kit setup complete for $TECH"
echo "Run: bash .claude/token-savings/install.sh"
