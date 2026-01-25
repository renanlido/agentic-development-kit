#!/bin/bash

ACTIVE_FOCUS=".claude/active-focus.md"

if [ ! -f "$ACTIVE_FOCUS" ]; then
  exit 0
fi

FEATURE=$(grep -i "^feature:" "$ACTIVE_FOCUS" 2>/dev/null | sed 's/^[Ff]eature: *//' | tr -d '\n')

if [ -z "$FEATURE" ]; then
  exit 0
fi

FEATURE_DIR=".claude/plans/features/$FEATURE"
TASKS_FILE="$FEATURE_DIR/tasks.md"

if [ ! -f "$TASKS_FILE" ]; then
  exit 0
fi

TOOL_INPUT="$1"

if echo "$TOOL_INPUT" | grep -qE "feature qa|feature docs|feature finish"; then
  TOTAL_TASKS=$(grep -cE "^\s*- \[" "$TASKS_FILE" 2>/dev/null || echo "0")
  COMPLETED_TASKS=$(grep -cE "^\s*- \[x\]" "$TASKS_FILE" 2>/dev/null || echo "0")
  INCOMPLETE_TASKS=$((TOTAL_TASKS - COMPLETED_TASKS))

  if [ "$INCOMPLETE_TASKS" -gt 0 ]; then
    echo "BLOCKED"
    echo ""
    echo "=== PHASE ADVANCE BLOCKED ==="
    echo ""
    echo "Cannot advance to QA/Docs/Finish with incomplete tasks."
    echo ""
    echo "Task Status: $COMPLETED_TASKS / $TOTAL_TASKS completed"
    echo "Incomplete: $INCOMPLETE_TASKS tasks remaining"
    echo ""
    echo "Incomplete tasks:"
    grep -E "^### Task" "$TASKS_FILE" | while read -r task_line; do
      task_name=$(echo "$task_line" | sed 's/### //')
      echo "  - $task_name"
    done | head -10
    echo ""
    echo "Complete all tasks before advancing to the next phase."
    echo ""
    exit 1
  fi
fi

exit 0
