#!/usr/bin/env bash
#
# claude-alertr: Notification hook
# Fires when Claude Code sends a notification (idle, permission request, etc.)
# Starts a 60-second timer. If the user hasn't responded by then, sends an alert.
#
set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

NOTIF_TYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' | tr -cd 'a-zA-Z0-9_-')

# Only act on notifications that indicate Claude is waiting for input
case "$NOTIF_TYPE" in
  idle_prompt|permission_prompt|elicitation_dialog) ;;
  *) exit 0 ;;
esac

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Load config (safe key-value parsing, no arbitrary code execution)
CONFIG_FILE="$HOME/.claude-alertr/config"
if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

ALERTR_URL=$(grep -E '^CLAUDE_ALERTR_URL=' "$CONFIG_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
ALERTR_TOKEN=$(grep -E '^CLAUDE_ALERTR_TOKEN=' "$CONFIG_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
ALERT_DELAY=$(grep -E '^CLAUDE_ALERTR_DELAY=' "$CONFIG_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
ALERT_DELAY="${ALERT_DELAY:-60}"

if [ -z "$ALERTR_URL" ]; then
  exit 0
fi

ALERT_DIR="/tmp/claude-alertr"
mkdir -p "$ALERT_DIR"
ALERT_FILE="$ALERT_DIR/$SESSION_ID"
PID_FILE="$ALERT_DIR/${SESSION_ID}.pid"

# Cancel any existing timer for this session (prevents duplicate alerts)
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ]; then
    kill "$OLD_PID" 2>/dev/null || true
  fi
fi

# Write the notification data with a timestamp
echo "$INPUT" | jq --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '. + {timestamp: $ts}' > "$ALERT_FILE"

# Spawn background timer process
(
  sleep "$ALERT_DELAY"
  if [ -f "$ALERT_FILE" ]; then
    curl -s -X POST "${ALERTR_URL}/alert" \
      -H "Content-Type: application/json" \
      ${ALERTR_TOKEN:+-H "Authorization: Bearer $ALERTR_TOKEN"} \
      -d @"$ALERT_FILE" > /dev/null 2>&1 || true
    rm -f "$ALERT_FILE"
  fi
  rm -f "$PID_FILE"
) &

echo $! > "$PID_FILE"

exit 0
