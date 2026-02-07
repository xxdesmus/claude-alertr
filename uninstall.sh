#!/usr/bin/env bash
#
# claude-alertr uninstaller
# Removes hooks from Claude Code settings and cleans up installed files.
#
set -euo pipefail

INSTALL_DIR="$HOME/.claude-alertr"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "=== claude-alertr uninstaller ==="
echo ""

# --- Remove only claude-alertr hooks from Claude Code settings ---
if [ -f "$CLAUDE_SETTINGS" ]; then
  UPDATED=$(jq '
    if .hooks then
      .hooks.Notification = [(.hooks.Notification // [])[] | select((.hooks[0].command // "") | test("claude-alertr") | not)] |
      .hooks.UserPromptSubmit = [(.hooks.UserPromptSubmit // [])[] | select((.hooks[0].command // "") | test("claude-alertr") | not)] |
      if .hooks.Notification == [] then del(.hooks.Notification) else . end |
      if .hooks.UserPromptSubmit == [] then del(.hooks.UserPromptSubmit) else . end |
      if .hooks == {} then del(.hooks) else . end
    else . end
  ' "$CLAUDE_SETTINGS")
  echo "$UPDATED" | jq '.' > "$CLAUDE_SETTINGS"
  echo "Removed claude-alertr hooks from $CLAUDE_SETTINGS"
else
  echo "No Claude settings found at $CLAUDE_SETTINGS"
fi

# --- Remove installed files ---
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "Removed $INSTALL_DIR"
else
  echo "No installation directory found at $INSTALL_DIR"
fi

# --- Clean up temp files ---
if [ -d "/tmp/claude-alertr" ]; then
  rm -rf "/tmp/claude-alertr"
  echo "Cleaned up /tmp/claude-alertr"
fi

echo ""
echo "=== Uninstall complete ==="
echo "Note: The Cloudflare Worker is still deployed. To remove it:"
echo "  wrangler delete claude-alertr"
