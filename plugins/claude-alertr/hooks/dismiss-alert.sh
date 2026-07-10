#!/usr/bin/env bash
#
# claude-alertr: Dismiss hook
# Fires when the user submits a prompt, cancelling any pending idle alert.
#
set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' | tr -cd 'a-zA-Z0-9_-')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

ALERT_DIR="/tmp/claude-alertr"
ALERT_FILE="$ALERT_DIR/$SESSION_ID"
PID_FILE="$ALERT_DIR/${SESSION_ID}.pid"

# Kill the background timer if it's still running.
# PID + start-time are checked together, since the raw PID alone could have
# been recycled by an unrelated process since idle-alert.sh recorded it.
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(sed -n '1p' "$PID_FILE" 2>/dev/null || true)
  OLD_STARTED=$(sed -n '2p' "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && [ -n "$OLD_STARTED" ]; then
    CUR_STARTED=$(ps -o lstart= -p "$OLD_PID" 2>/dev/null | awk '{$1=$1;print}')
    if [ -n "$CUR_STARTED" ] && [ "$CUR_STARTED" = "$OLD_STARTED" ]; then
      kill "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

# Remove the alert marker file
rm -f "$ALERT_FILE"

exit 0
