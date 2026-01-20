#!/bin/bash

FOCUS_FILE=".claude/active-focus.md"

if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

FEATURE=$(grep "^feature:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)
STATUS=$(grep "^status:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)
FPATH=$(grep "^path:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)

if [ -z "$FEATURE" ]; then
  exit 0
fi

CONSTRAINTS_FILE="${FPATH}constraints.md"

echo ""
echo "FOCO ATIVO: $FEATURE"
echo "Status: $STATUS"
echo "Path: $FPATH"

if [ -f "$CONSTRAINTS_FILE" ]; then
  echo ""
  echo "CONSTRAINTS:"
  grep -A 20 "^## Escopo Permitido" "$CONSTRAINTS_FILE" 2>/dev/null | grep "^-" | head -5
  echo ""
  grep -A 20 "^## Restricoes" "$CONSTRAINTS_FILE" 2>/dev/null | grep "^-" | head -5
fi

echo ""
echo "Mantenha o foco. Consulte: ${FPATH}"
echo ""

exit 0
