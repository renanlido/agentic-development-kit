#!/bin/bash

ACTIVE_FOCUS=".claude/active-focus.md"

if [ ! -f "$ACTIVE_FOCUS" ]; then
  exit 0
fi

FEATURE=$(grep "^Feature:" "$ACTIVE_FOCUS" 2>/dev/null | sed 's/^Feature: *//' | tr -d '\n')

if [ -z "$FEATURE" ]; then
  cat "$ACTIVE_FOCUS"
  exit 0
fi

CONSTRAINTS=".claude/plans/features/$FEATURE/constraints.md"

echo "=== ACTIVE CONTEXT ==="
cat "$ACTIVE_FOCUS"

if [ -f "$CONSTRAINTS" ]; then
  echo ""
  echo "=== CONSTRAINTS ==="
  cat "$CONSTRAINTS"
fi

exit 0
