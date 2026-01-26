#!/bin/bash

FEATURE_NAME="$1"
TASK_PATTERN="$2"
STATUS="${3:-completed}"

if [ -z "$FEATURE_NAME" ] || [ -z "$TASK_PATTERN" ]; then
  echo "Usage: mark-task.sh <feature-name> <task-pattern> [status]"
  echo "Status: completed (x), in_progress (~), blocked (!), pending ( )"
  exit 1
fi

ACTIVE_FOCUS=".claude/active-focus.md"
FEATURE_DIR=".claude/plans/features/$FEATURE_NAME"
TASKS_FILE="$FEATURE_DIR/tasks.md"
PROGRESS_FILE="$FEATURE_DIR/progress.md"

if [ ! -f "$TASKS_FILE" ]; then
  echo "Error: tasks.md not found for feature $FEATURE_NAME"
  exit 1
fi

case "$STATUS" in
  completed|x)
    CHECKBOX="x"
    ;;
  in_progress|~)
    CHECKBOX="~"
    ;;
  blocked|!)
    CHECKBOX="!"
    ;;
  pending|" ")
    CHECKBOX=" "
    ;;
  *)
    echo "Invalid status: $STATUS"
    exit 1
    ;;
esac

TEMP_FILE=$(mktemp)
FOUND=0
CURRENT_TASK=""

while IFS= read -r line; do
  if echo "$line" | grep -qE "^### Task"; then
    CURRENT_TASK=$(echo "$line" | sed 's/### //')
  fi

  if echo "$line" | grep -qE "^\s*- \[[ x~!]\].*$TASK_PATTERN"; then
    if [ -n "$CURRENT_TASK" ]; then
      echo "✓ Found task: $CURRENT_TASK"
      echo "  Pattern: $TASK_PATTERN"
      echo "  Status: $STATUS ($CHECKBOX)"
    fi

    line=$(echo "$line" | sed "s/- \[[ x~!]\]/- [$CHECKBOX]/")
    FOUND=1
  fi

  echo "$line" >> "$TEMP_FILE"
done < "$TASKS_FILE"

if [ "$FOUND" -eq 1 ]; then
  mv "$TEMP_FILE" "$TASKS_FILE"

  if [ -f "$PROGRESS_FILE" ]; then
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    sed -i.bak "s/Last updated:.*/Last updated: $TIMESTAMP/" "$PROGRESS_FILE" 2>/dev/null
    rm -f "$PROGRESS_FILE.bak"
  fi

  echo ""
  echo "✅ Task updated in tasks.md"
else
  rm "$TEMP_FILE"
  echo "⚠️  Task pattern not found: $TASK_PATTERN"
  exit 1
fi
