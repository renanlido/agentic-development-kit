#!/bin/bash

# Hook: PreToolUse - Valida comandos bash antes de executar
# Exit codes:
#   0 = permitir
#   2 = bloquear (mensagem vai para Claude)

INPUT=$(cat)

if ! command -v jq &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf /\*"
  "rm -rf ~"
  "dd if="
  "mkfs"
  "> /dev/"
  "chmod 777"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qF "$pattern"; then
    echo "BLOQUEADO: Comando potencialmente perigoso detectado: $pattern" >&2
    exit 2
  fi
done

if echo "$COMMAND" | grep -qE "git push.*--force.*(main|master)"; then
  echo "BLOQUEADO: Push force em branch principal nao permitido" >&2
  exit 2
fi

exit 0
