#!/bin/bash

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [[ "$COMMAND" == *"git commit"* ]]; then
  if [[ "$COMMAND" == *"Co-Authored-By"* ]] || \
     [[ "$COMMAND" == *"co-authored-by"* ]] || \
     [[ "$COMMAND" == *"Claude"* ]] || \
     [[ "$COMMAND" == *"claude"* ]] || \
     [[ "$COMMAND" == *"noreply@anthropic"* ]]; then

    echo '{"decision": "block", "reason": "BLOQUEADO: Commit contém menção a AI/Claude. Remova Co-Authored-By e referências a Claude da mensagem de commit. Veja CLAUDE.md: NUNCA mencione IA, Claude, ou geração automática nos commits."}'
    exit 0
  fi
fi

echo '{"decision": "allow"}'
