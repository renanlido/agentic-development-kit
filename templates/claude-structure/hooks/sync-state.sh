#!/bin/bash

FILE_PATH="$1"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

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

PROGRESS_FILE="$FEATURE_DIR/progress.md"
STATE_FILE="$FEATURE_DIR/state.json"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ ! -f "$PROGRESS_FILE" ]; then
  exit 0
fi

if ! grep -q "## Files Modified" "$PROGRESS_FILE"; then
  echo "" >> "$PROGRESS_FILE"
  echo "## Files Modified" >> "$PROGRESS_FILE"
fi

if ! grep -q "$FILE_PATH" "$PROGRESS_FILE"; then
  sed -i.bak "/## Files Modified/a\\
- $FILE_PATH ($TIMESTAMP)
" "$PROGRESS_FILE"
  rm -f "$PROGRESS_FILE.bak"
fi

if [ -f "$STATE_FILE" ]; then
  TMP_FILE=$(mktemp)
  jq --arg ts "$TIMESTAMP" --arg file "$FILE_PATH" \
    '.lastModified = $ts | .lastModifiedFile = $file' \
    "$STATE_FILE" > "$TMP_FILE" 2>/dev/null && mv "$TMP_FILE" "$STATE_FILE" || rm -f "$TMP_FILE"
fi

exit 0
