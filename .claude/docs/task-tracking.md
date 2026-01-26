# Task Tracking Durante Implementação

## Problema

Durante a implementação de uma feature, as tasks no `tasks.md` não eram atualizadas automaticamente quando o trabalho era concluído. Isso causava dois problemas:

1. **Documentação desatualizada**: Progress.md e tasks.md ficavam desatualizados durante a sessão
2. **Perda de contexto**: Ao retomar com `adk feature autopilot`, o sistema não sabia qual task específica estava em andamento

## Solução

### 1. Session Checkpoint Aprimorado

O hook `session-checkpoint.sh` agora captura:
- Tasks marcadas como `[~]` (in_progress)
- Próxima task pendente `[ ]`
- Salva ambas no snapshot JSON

### 2. Autopilot com Continuidade

O comando `adk feature autopilot` agora:
- Lê o último snapshot ao retomar
- Mostra qual task estava in_progress
- Permite continuar de onde parou

### 3. Script Helper para Atualização Manual

Script `.claude/hooks/mark-task.sh` permite marcar tasks durante a sessão.

## Como Usar

### Durante Implementação

Quando Claude terminar uma subtask, ele pode executar:

```bash
.claude/hooks/mark-task.sh <feature-name> "<task-pattern>" <status>
```

**Exemplos:**

```bash
# Marcar task como concluída
.claude/hooks/mark-task.sh adk-v2-fase3 "Task 2.1" completed

# Marcar como em andamento
.claude/hooks/mark-task.sh adk-v2-fase3 "Task 2.2" in_progress

# Marcar como bloqueada
.claude/hooks/mark-task.sh adk-v2-fase3 "Task 2.3" blocked
```

**Status disponíveis:**
- `completed` ou `x` → `[x]`
- `in_progress` ou `~` → `[~]`
- `blocked` ou `!` → `[!]`
- `pending` ou ` ` → `[ ]`

### Fluxo Recomendado

1. **Iniciar task**: Marcar como `in_progress`
   ```bash
   .claude/hooks/mark-task.sh myfeature "Task 1.1" in_progress
   ```

2. **Trabalhar na task**: Implementar, testar, etc.

3. **Concluir task**: Marcar como `completed`
   ```bash
   .claude/hooks/mark-task.sh myfeature "Task 1.1" completed
   ```

4. **Repetir** para próxima task

### Ao Retomar Sessão

Quando executar `adk feature autopilot <name>` novamente:

```
🚀 ADK Autopilot (Subprocess Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Última sessão estava trabalhando em:
   Fase 2: Task 2.2 - Implementar TokenCounter
```

O sistema continuará da última task marcada como `in_progress`.

## Formato tasks.md

```markdown
## Fase 1: Setup

### Task 1.1: Instalar dependencias
- [x] Instalar pacote X
- [x] Configurar Y
- [ ] Testar Z

### Task 1.2: Criar tipos
- [~] Definir interfaces  ← IN PROGRESS
- [ ] Exportar tipos
```

## Snapshot JSON

```json
{
  "id": "session-end-1737820305",
  "feature": "adk-v2-fase3",
  "timestamp": "2026-01-25T17:05:05Z",
  "tasks": {
    "completed": 12,
    "total": 25,
    "percentage": 48,
    "canAdvanceToQA": false,
    "inProgressTask": "Fase 2: Task 2.2 - Implementar TokenCounter",
    "nextTask": "Fase 2: Task 2.3 - Testes do TokenCounter"
  }
}
```

## Verificação Automática de Progresso

O sistema agora **verifica automaticamente** se todas as tasks foram concluídas antes de marcar uma fase como completa:

### Implementação

Ao finalizar `adk feature implement <name>`:

- ✅ **Se 100% das tasks estão `[x]`**: Marca fase como `completed`, permite avançar para QA
- ⚠️ **Se < 100% das tasks**: Marca como `in_progress`, **bloqueia** avanço para QA

```
⚠️  12/25 tasks concluídas (48%)
   Restam 13 tasks pendentes em tasks.md

📝 Para continuar implementando:
   adk feature autopilot myfeature
```

### Autopilot

O `adk feature autopilot` agora:

1. Verifica tasks.md após cada sessão de implementação
2. **Não avança** para QA se tasks < 100%
3. Mostra progresso detalhado e instrui como continuar
4. Só prossegue quando TODAS as tasks estiverem `[x]`

## Benefícios

1. ✅ Documentação sempre atualizada
2. ✅ Continuidade precisa ao retomar sessão
3. ✅ Rastreabilidade granular do progresso
4. ✅ Melhor coordenação entre múltiplas sessões
5. ✅ Snapshots detalhados para debugging
6. ✅ **Garante que implementação está 100% antes de QA**
7. ✅ **Previne pulos prematuros de fases**
