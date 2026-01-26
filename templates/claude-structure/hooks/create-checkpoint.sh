#!/bin/bash

FEATURE_NAME="$1"
TASK_ID="$2"
DESCRIPTION="$3"

if [ -z "$FEATURE_NAME" ] || [ -z "$TASK_ID" ]; then
  echo "Usage: create-checkpoint.sh <feature-name> <task-id> [description]"
  exit 1
fi

FEATURE_DIR=".claude/plans/features/$FEATURE_NAME"
CHECKPOINT_FILE="$FEATURE_DIR/.task-checkpoint.md"
TASKS_FILE="$FEATURE_DIR/tasks.md"

if [ ! -d "$FEATURE_DIR" ]; then
  echo "Error: Feature directory not found: $FEATURE_DIR"
  exit 1
fi

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

analyze_tasks() {
  local tasks_file="$1"

  if [ ! -f "$tasks_file" ]; then
    echo "0|0|0|unknown"
    return
  fi

  local total=0
  local completed=0
  local next_task=""
  local found_next=0

  while IFS= read -r line; do
    if echo "$line" | grep -qE "^\s*- \[x\]"; then
      ((completed++))
      ((total++))
    elif echo "$line" | grep -qE "^\s*- \[ \]"; then
      ((total++))
      if [ $found_next -eq 0 ]; then
        next_task=$(echo "$line" | sed 's/^\s*- \[ \]\s*//')
        found_next=1
      fi
    elif echo "$line" | grep -qE "^\s*- \[~\]"; then
      ((total++))
    fi
  done < "$tasks_file"

  local percentage=0
  if [ "$total" -gt 0 ]; then
    percentage=$((completed * 100 / total))
  fi

  echo "$completed|$total|$percentage|$next_task"
}

TASK_ANALYSIS=$(analyze_tasks "$TASKS_FILE")
COMPLETED=$(echo "$TASK_ANALYSIS" | cut -d'|' -f1)
TOTAL=$(echo "$TASK_ANALYSIS" | cut -d'|' -f2)
PERCENTAGE=$(echo "$TASK_ANALYSIS" | cut -d'|' -f3)
NEXT_TASK=$(echo "$TASK_ANALYSIS" | cut -d'|' -f4)

get_recent_files() {
  git diff --name-only HEAD~1 2>/dev/null | head -10 | sed 's/^/  - /' | tr '\n' '\n'
}

RECENT_FILES=$(get_recent_files)
if [ -z "$RECENT_FILES" ]; then
  RECENT_FILES="  - (run git status to see changes)"
fi

cat > "$CHECKPOINT_FILE" <<EOF
# Task Checkpoint

> Created: $TIMESTAMP

## ✅ Task Completada

- **ID**: $TASK_ID
- **Descrição**: ${DESCRIPTION:-"Task implementada"}
- **Status**: Completed (marcada como [x] em tasks.md)

### Arquivos Modificados
$RECENT_FILES

### Testes
- Execute: \`npm test\` para verificar
- Coverage: Execute \`npm run test:coverage\`

---

## 📋 Próxima Task

**Próxima task pendente:**
\`\`\`
$NEXT_TASK
\`\`\`

### Contexto Mínimo Necessário
- Leia tasks.md para ver dependências
- Revise implementation-plan.md se necessário
- Verifique que task anterior está [x]

---

## 📊 Estado Atual

- **Progresso**: $COMPLETED / $TOTAL tasks completas ($PERCENTAGE%)
- **Fase**: Implementação
- **Checkpoint**: $TIMESTAMP

---

## 🔄 Como Continuar

### 1. Limpe o Contexto
\`\`\`bash
# No Claude Code, pressione Ctrl+C e execute:
claude clear

# Ou use o comando de limpar contexto do seu IDE
\`\`\`

### 2. Retome a Implementação
\`\`\`bash
adk feature implement $FEATURE_NAME

# Ou continue com autopilot:
adk feature autopilot $FEATURE_NAME
\`\`\`

### 3. O Sistema Vai
- Ler este checkpoint
- Verificar tasks.md
- Continuar da próxima task pendente [ ]
- NÃO refazer tasks que estão [x]

---

**⚠️ IMPORTANTE**: NÃO delete este arquivo. Ele é usado para recuperar o contexto na próxima sessão.
EOF

echo ""
echo "✅ CHECKPOINT CRIADO"
echo ""
echo "📄 Arquivo: $CHECKPOINT_FILE"
echo "📊 Progresso: $COMPLETED/$TOTAL tasks ($PERCENTAGE%)"
echo ""
echo "⚠️  PRÓXIMO PASSO: LIMPE O CONTEXTO"
echo ""
echo "1. Ctrl+C para sair desta sessão"
echo "2. Execute: claude clear"
echo "3. Execute: adk feature implement $FEATURE_NAME"
echo ""
echo "O checkpoint foi salvo. A próxima sessão continuará automaticamente."
echo ""
