#!/bin/bash

INPUT=$(cat)

FEATURE_NAME=""
if [[ -f ".claude/active-focus.md" ]]; then
  FEATURE_NAME=$(grep -E "^feature:" .claude/active-focus.md 2>/dev/null | head -1 | sed 's/feature: *//')
fi

if [[ -z "$FEATURE_NAME" ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

CORE_STATE_PATH=".claude/plans/features/$FEATURE_NAME/memory/core-state.json"

if [[ ! -f "$CORE_STATE_PATH" ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

CURRENT_TASK=""
TASK_STATUS=""
CONSTRAINTS=""
BLOCKERS=""

if command -v jq &> /dev/null; then
  CURRENT_TASK=$(jq -r '.currentTask.name // "No task selected"' "$CORE_STATE_PATH" 2>/dev/null)
  TASK_STATUS=$(jq -r '.currentTask.status // "unknown"' "$CORE_STATE_PATH" 2>/dev/null)

  CONSTRAINTS_RAW=$(jq -r '.constraints // [] | .[]' "$CORE_STATE_PATH" 2>/dev/null | head -3)
  if [[ -n "$CONSTRAINTS_RAW" ]]; then
    CONSTRAINTS=$(echo "$CONSTRAINTS_RAW" | sed 's/^/  - /' | tr '\n' ' ')
  fi

  BLOCKERS_RAW=$(jq -r '.blockers // [] | .[]' "$CORE_STATE_PATH" 2>/dev/null | head -2)
  if [[ -n "$BLOCKERS_RAW" ]]; then
    BLOCKERS=$(echo "$BLOCKERS_RAW" | sed 's/^/  - /' | tr '\n' ' ')
  fi
fi

REMINDER="CONTEXT REMINDER - Feature: $FEATURE_NAME | Current Task: $CURRENT_TASK (Status: $TASK_STATUS)"

if [[ -n "$CONSTRAINTS" ]]; then
  REMINDER="$REMINDER | Key Constraints: $CONSTRAINTS"
fi

if [[ -n "$BLOCKERS" ]]; then
  REMINDER="$REMINDER | Blockers: $BLOCKERS"
fi

echo "{\"decision\": \"allow\", \"message\": \"$REMINDER\"}"
exit 0
