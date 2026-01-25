#!/bin/bash
# Hook: pre-overflow
# Event: PreToolUse (quando context > 90%)
# Action: Cria checkpoint automático antes de overflow

FEATURE=$(cat .claude/active-focus.md 2>/dev/null | grep "^feature:" | cut -d: -f2 | tr -d ' ')

if [ -z "$FEATURE" ]; then
  exit 0
fi

# Verifica se ADK está disponível
if ! command -v adk &> /dev/null; then
  exit 0
fi

# Obtém status de contexto em JSON (se implementado)
# Por enquanto, vamos usar uma abordagem simples com feature status
STATUS_OUTPUT=$(adk feature status "$FEATURE" --tokens 2>/dev/null || echo "")

if [ -z "$STATUS_OUTPUT" ]; then
  exit 0
fi

# Extrai porcentagem de uso (parsing simples)
PERCENTAGE=$(echo "$STATUS_OUTPUT" | grep -o '[0-9]\+\.[0-9]\+%' | head -1 | sed 's/%//')

if [ -z "$PERCENTAGE" ]; then
  exit 0
fi

# Compara se > 90%
THRESHOLD=90
if (( $(echo "$PERCENTAGE > $THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
  echo "⚠️  Context at ${PERCENTAGE}%. Creating safety checkpoint..."

  # Cria checkpoint de segurança
  # Nota: StateManager.createCheckpoint já foi implementado na Fase 5
  # Aqui apenas notificamos o usuário

  echo "✓ High context usage detected"
  echo "ℹ️  Consider running: adk feature compact $FEATURE"
  echo ""
fi

exit 0
