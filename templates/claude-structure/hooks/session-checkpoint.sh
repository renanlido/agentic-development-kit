#!/bin/bash

ACTIVE_FOCUS=".claude/active-focus.md"

if [ ! -f "$ACTIVE_FOCUS" ]; then
  exit 0
fi

FEATURE=$(grep "^Feature:" "$ACTIVE_FOCUS" 2>/dev/null | sed 's/^Feature: *//' | tr -d '\n')

if [ -z "$FEATURE" ]; then
  exit 0
fi

FEATURE_DIR=".claude/plans/features/$FEATURE"

if [ ! -d "$FEATURE_DIR" ]; then
  exit 0
fi

SNAPSHOT_DIR="$FEATURE_DIR/.snapshots"
PROGRESS_FILE="$FEATURE_DIR/claude-progress.txt"
STATE_FILE="$FEATURE_DIR/state.json"

mkdir -p "$SNAPSHOT_DIR" 2>/dev/null || true

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SNAPSHOT_ID="session-end-$(date +%s)"
SNAPSHOT_FILE="$SNAPSHOT_DIR/$SNAPSHOT_ID.json"

cat > "$SNAPSHOT_FILE" <<EOF
{
  "id": "$SNAPSHOT_ID",
  "feature": "$FEATURE",
  "reason": "session_end",
  "timestamp": "$TIMESTAMP"
}
EOF

PHASE=$(grep "^Phase:" "$FEATURE_DIR/progress.md" 2>/dev/null | sed 's/^Phase: *//' | head -1)
PROGRESS=$(grep -o "[0-9]\+%" "$FEATURE_DIR/progress.md" 2>/dev/null | head -1 | tr -d '%')

cat > "$PROGRESS_FILE" <<EOF
=== FEATURE PROGRESS ===
Feature: $FEATURE
Updated: $TIMESTAMP

--- CURRENT STATE ---
Phase: ${PHASE:-unknown}
Progress: ${PROGRESS:-0}%

--- SNAPSHOT ---
Session ended. Checkpoint created for recovery.
Snapshot ID: $SNAPSHOT_ID
EOF

exit 0
