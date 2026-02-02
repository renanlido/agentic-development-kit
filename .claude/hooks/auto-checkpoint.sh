#!/bin/bash

FOCUS_FILE=".claude/active-focus.md"

if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

FEATURE=$(grep "^feature:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)
FPATH=$(grep "^path:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)

if [ -z "$FEATURE" ]; then
  exit 0
fi

FEATURE_DIR=".claude/plans/features/$FEATURE"

if [ ! -d "$FEATURE_DIR" ]; then
  exit 0
fi

CHECKPOINTS_DIR="$FEATURE_DIR/checkpoints"
CORE_STATE="${FPATH}core-state.json"

mkdir -p "$CHECKPOINTS_DIR" 2>/dev/null || true

TIMESTAMP=$(date +%s)
TIMESTAMP_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CHECKPOINT_FILE="$CHECKPOINTS_DIR/checkpoint-$TIMESTAMP.json"
LATEST_FILE="$CHECKPOINTS_DIR/latest.json"

CORE_STATE_CONTENT="null"
if [ -f "$CORE_STATE" ]; then
  if command -v jq &> /dev/null; then
    CORE_STATE_CONTENT=$(jq -c '.' "$CORE_STATE" 2>/dev/null || echo "null")
  else
    CORE_STATE_CONTENT=$(cat "$CORE_STATE" 2>/dev/null | tr -d '\n' || echo "null")
  fi
fi

GIT_STATUS=""
if command -v git &> /dev/null; then
  if git rev-parse --is-inside-work-tree &> /dev/null; then
    GIT_STATUS=$(git status --porcelain 2>/dev/null | head -20)
  fi
fi

GIT_STATUS_ESCAPED=$(echo "$GIT_STATUS" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' '|' | sed 's/|$//')

if command -v jq &> /dev/null; then
  jq -n \
    --arg timestamp "$TIMESTAMP_ISO" \
    --arg feature "$FEATURE" \
    --argjson coreState "$CORE_STATE_CONTENT" \
    --arg gitStatus "$GIT_STATUS_ESCAPED" \
    '{
      timestamp: $timestamp,
      feature: $feature,
      coreState: $coreState,
      gitStatus: $gitStatus
    }' > "$CHECKPOINT_FILE"
else
  cat > "$CHECKPOINT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP_ISO",
  "feature": "$FEATURE",
  "coreState": $CORE_STATE_CONTENT,
  "gitStatus": "$GIT_STATUS_ESCAPED"
}
EOF
fi

if [ -L "$LATEST_FILE" ]; then
  rm -f "$LATEST_FILE"
elif [ -f "$LATEST_FILE" ]; then
  rm -f "$LATEST_FILE"
fi

ln -s "checkpoint-$TIMESTAMP.json" "$LATEST_FILE"

exit 0
