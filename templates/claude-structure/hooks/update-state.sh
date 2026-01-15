#!/bin/bash

# Hook: Stop - Atualiza estado ao final de cada sessao
# Atualiza .claude/memory/current-state.md com estado atual

STATE_FILE=".claude/memory/current-state.md"

# Verificar se arquivo existe
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Obter data atual
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)

# Obter status do git
GIT_STATUS=""
if command -v git &> /dev/null && [ -d ".git" ]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  CHANGES=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
  GIT_STATUS="Branch: $BRANCH | Arquivos modificados: $CHANGES"
fi

# Atualizar header do arquivo
# Nota: Esta e uma versao simples. Em producao, usar sed ou outra ferramenta
# para atualizar apenas a linha de data sem reescrever todo o arquivo.

# Por enquanto, apenas logamos que o hook executou
# Para evitar conflitos com edicoes do usuario

echo "ADK: Sessao finalizada em $DATE $TIME"
echo "Estado: $GIT_STATUS"

exit 0
