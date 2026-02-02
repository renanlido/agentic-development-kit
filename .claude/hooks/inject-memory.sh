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

CORE_STATE="${FPATH}core-state.json"

echo ""
echo "MEMORY CONTEXT"
echo "=============="
echo "Feature: $FEATURE"
echo ""

if [ -f "$CORE_STATE" ]; then
  if command -v jq &> /dev/null; then
    TASK_ID=$(jq -r '.currentTask.id // empty' "$CORE_STATE" 2>/dev/null)
    TASK_NAME=$(jq -r '.currentTask.name // empty' "$CORE_STATE" 2>/dev/null)
    TASK_PHASE=$(jq -r '.currentTask.phase // empty' "$CORE_STATE" 2>/dev/null)
    TASK_STATUS=$(jq -r '.currentTask.status // empty' "$CORE_STATE" 2>/dev/null)

    if [ -n "$TASK_ID" ]; then
      echo "Current Task:"
      echo "  ID: $TASK_ID"
      echo "  Name: $TASK_NAME"
      echo "  Phase: $TASK_PHASE"
      echo "  Status: $TASK_STATUS"
      echo ""
    fi

    DECISIONS=$(jq -r '.decisions[]?.summary // empty' "$CORE_STATE" 2>/dev/null | head -5)
    if [ -n "$DECISIONS" ]; then
      echo "Recent Decisions:"
      echo "$DECISIONS" | while read -r decision; do
        if [ -n "$decision" ]; then
          echo "  - $decision"
        fi
      done
      echo ""
    fi

    FILES_COUNT=$(jq -r '.modifiedFiles | length' "$CORE_STATE" 2>/dev/null)
    if [ "$FILES_COUNT" -gt 0 ] 2>/dev/null; then
      echo "Modified Files: $FILES_COUNT"
      jq -r '.modifiedFiles[-5:][] | "  - [\(.action)] \(.path)"' "$CORE_STATE" 2>/dev/null
      echo ""
    fi
  fi
fi

echo "ANTI-STUB RULES"
echo "---------------"
echo "- NEVER use throw new Error(\"Not implemented\")"
echo "- NEVER leave TODO: or FIXME: in new code"
echo "- NEVER use pass # stub or similar placeholders"
echo "- ALWAYS implement complete, working code"
echo "- ALWAYS read files before modifying them"
echo ""

exit 0
