#!/bin/bash

# Hook: PreToolUse - Valida comandos bash antes de executar
# Exit codes:
#   0 = permitir
#   2 = bloquear (mensagem vai para Claude)

# Le input JSON via stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Lista de comandos perigosos
DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf /*"
  "rm -rf ~"
  "dd if="
  "mkfs"
  "> /dev/"
  "chmod 777"
  "curl.*|.*sh"
  "wget.*|.*sh"
)

# Verifica padroes perigosos
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOQUEADO: Comando potencialmente perigoso detectado: $pattern"
    exit 2
  fi
done

# Bloqueia push force em main/master
if echo "$COMMAND" | grep -qE "git push.*--force.*(main|master)"; then
  echo "BLOQUEADO: Push force em branch principal nao permitido"
  exit 2
fi

# Bloqueia reset hard sem confirmacao
if echo "$COMMAND" | grep -qE "git reset --hard"; then
  echo "AVISO: git reset --hard pode perder alteracoes. Confirme antes de executar."
  # Nao bloqueia, apenas avisa (exit 0)
fi

# Permitir comando
exit 0
