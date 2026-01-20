#!/bin/bash

FOCUS_FILE=".claude/active-focus.md"

if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

FPATH=$(grep "^path:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)
FEATURE=$(grep "^feature:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)

if [ -z "$FPATH" ] || [ -z "$FEATURE" ]; then
  exit 0
fi

CONSTRAINTS_FILE="${FPATH}constraints.md"

if [ ! -f "$CONSTRAINTS_FILE" ]; then
  exit 0
fi

ALLOWED_PATHS=$(grep -A 20 "^## Escopo Permitido" "$CONSTRAINTS_FILE" 2>/dev/null | grep "^-" | sed 's/^- //')

IN_SCOPE=false
while IFS= read -r allowed; do
  if [[ "$FILE_PATH" == *"$allowed"* ]]; then
    IN_SCOPE=true
    break
  fi
done <<< "$ALLOWED_PATHS"

if [ "$IN_SCOPE" = false ]; then
  echo ""
  echo "ALERTA: Edicao fora do escopo da feature '$FEATURE'"
  echo "Arquivo: $FILE_PATH"
  echo "Escopo permitido: $FPATH"
  echo ""
  echo "Se necessario, atualize constraints.md ou confirme com o usuario."
  echo ""
fi

exit 0
