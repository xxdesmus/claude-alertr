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

# Only act on notifications where Claude is genuinely blocked waiting for user action
case "$NOTIF_TYPE" in
  permission_prompt|elicitation_dialog) ;;
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
ALERT_DELAY=$(echo "$ALERT_DELAY" | tr -cd '0-9')
ALERT_DELAY="${ALERT_DELAY:-60}"

if [ -z "$ALERTR_URL" ]; then
  exit 0
fi

ALERT_DIR="/tmp/claude-alertr"
mkdir -p "$ALERT_DIR"
chmod 700 "$ALERT_DIR"
ALERT_FILE="$ALERT_DIR/$SESSION_ID"
PID_FILE="$ALERT_DIR/${SESSION_ID}.pid"

# Cancel any existing timer for this session (prevents duplicate alerts)
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ]; then
    kill "$OLD_PID" 2>/dev/null || true
  fi
fi

# Extract details from the transcript (what Claude is actually asking)
DETAILS=""
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  LAST_TOOL=$(tail -20 "$TRANSCRIPT" | jq -s '[.[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use")] | last' 2>/dev/null || true)
  if [ -n "$LAST_TOOL" ] && [ "$LAST_TOOL" != "null" ]; then
    TOOL_NAME=$(echo "$LAST_TOOL" | jq -r '.name // empty')
    case "$TOOL_NAME" in
      Bash)
        CMD=$(echo "$LAST_TOOL" | jq -r '.input.command // empty')
        DESC=$(echo "$LAST_TOOL" | jq -r '.input.description // empty')
        [ -n "$DESC" ] && DETAILS="$DESC: $CMD" || DETAILS="$CMD"
        ;;
      AskUserQuestion)
        DETAILS=$(echo "$LAST_TOOL" | jq -r '.input.questions[0].question // empty')
        ;;
      Edit|Write)
        FPATH=$(echo "$LAST_TOOL" | jq -r '.input.file_path // empty')
        DETAILS="$TOOL_NAME: $FPATH"
        ;;
      *)
        DESC=$(echo "$LAST_TOOL" | jq -r '.input.description // .input.command // .input.file_path // empty')
        [ -n "$DESC" ] && DETAILS="$TOOL_NAME: $DESC" || DETAILS="$TOOL_NAME"
        ;;
    esac
  fi
fi

# Write the notification data with a timestamp, details, and hostname
echo "$INPUT" | jq --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg details "$DETAILS" --arg host "$(hostname -s)" '. + {timestamp: $ts, details: $details, hostname: $host}' > "$ALERT_FILE"

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
