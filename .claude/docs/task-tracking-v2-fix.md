# Fix: Continuidade de Tasks (v2)

## Problema Original

Ao dar Ctrl+C durante implementação:
1. Session acabava
2. Ao retomar com `adk feature autopilot`, pulava direto para QA
3. Mesmo com várias tasks pendentes, marcava tudo como "completed"

## Solução Implementada

### 1. Verificação de Tasks no `implement`

O comando `adk feature implement` agora:

**ANTES:**
```typescript
// Sempre marcava como completed após sessão
progress = updateStepStatus(progress, 'implementacao', 'completed')
```

**DEPOIS:**
```typescript
// Verifica tasks.md antes de marcar como completed
const taskStatus = await this.checkTasksCompletion(name)

if (taskStatus.allDone) {
  // 100% das tasks → completed
  progress = updateStepStatus(progress, 'implementacao', 'completed')
} else {
  // < 100% das tasks → in_progress
  progress = updateStepStatus(progress, 'implementacao', 'in_progress')
  // Mostra quantas tasks faltam
  console.log(`⚠️ ${taskStatus.completed}/${taskStatus.total} tasks concluídas`)
}
```

### 2. Autopilot com Validação de Tasks

O `adk feature autopilot` agora:

**ANTES:**
```typescript
// Verificava apenas progress.md
const implementDone = isStepCompleted(progress, 'implementacao')

if (!implementDone) {
  await executeImplement()
}
// Sempre executava QA depois
await executeQA()
```

**DEPOIS:**
```typescript
// Verifica TANTO progress.md QUANTO tasks.md
const implementDone = isStepCompleted(progress, 'implementacao')
const taskStatus = await this.checkTasksCompletion(name)
const implementReallyDone = implementDone && taskStatus.allDone

if (!implementReallyDone) {
  await executeImplement()

  // Após implementar, RE-VERIFICA tasks
  const updatedTasks = await this.checkTasksCompletion(name)

  if (!updatedTasks.allDone) {
    // BLOQUEIA avanço para QA
    console.log('⚠️ IMPLEMENTAÇÃO INCOMPLETA')
    console.log(`Restam ${updatedTasks.total - updatedTasks.completed} tasks`)
    return // NÃO executa QA
  }
}

// Só executa QA se implementação 100%
if (implementReallyDone) {
  await executeQA()
}
```

### 3. Session Checkpoint com Task In-Progress

O hook `session-checkpoint.sh` agora salva no snapshot:

```json
{
  "tasks": {
    "completed": 12,
    "total": 25,
    "percentage": 48,
    "inProgressTask": "Fase 2: Task 2.2 - Implementar TokenCounter",
    "nextTask": "Fase 2: Task 2.3 - Testes do TokenCounter"
  }
}
```

## Fluxos de Uso

### Cenário 1: Implementação Interrompida (Ctrl+C)

```bash
# Sessão 1: Implementando
$ adk feature autopilot myfeature
# ... Claude implementa algumas tasks ...
# Ctrl+C (interrompe)

# Sessão 2: Retomando
$ adk feature autopilot myfeature

📌 Última sessão estava trabalhando em:
   Fase 2: Task 2.2 - Implementar TokenCounter

⚠️  12/25 tasks concluídas (48%)
   13 tasks ainda pendentes

# Continua implementando...
# Ao final da sessão:

⚠️  IMPLEMENTAÇÃO INCOMPLETA
   15/25 tasks concluídas (60%)
   Restam 10 tasks pendentes em tasks.md

📝 Para continuar implementando:
   adk feature autopilot myfeature

# NÃO executa QA automaticamente!
```

### Cenário 2: Implementação Completa

```bash
$ adk feature autopilot myfeature

# ... Claude implementa e marca todas as tasks como [x] ...

✓ 25/25 tasks concluídas (100%)

✅ Implementação concluída - todas as tasks completas!

# Agora SIM, avança para QA:

═══════════════════════════════════════════════════
  ETAPA 6: QA - REVISÃO DE QUALIDADE
═══════════════════════════════════════════════════
```

### Cenário 3: Marcar Tasks Manualmente

```bash
# Durante ou após implementação:
$ .claude/hooks/mark-task.sh myfeature "Task 2.1" completed
✓ Found task: Task 2.1: Criar tipos
✅ Task updated in tasks.md

# Verificar progresso:
$ adk feature status myfeature

Tasks: 13/25 completed (52%)
Status: in_progress (implementação)

# Quando todas estiverem [x]:
$ adk feature autopilot myfeature
✓ 25/25 tasks concluídas (100%)
# Agora avança para QA
```

## Função Helper: `checkTasksCompletion()`

Nova função em `feature.ts`:

```typescript
private async checkTasksCompletion(name: string): Promise<{
  completed: number
  total: number
  percentage: number
  allDone: boolean
}> {
  const tasksPath = path.join(featurePath, 'tasks.md')
  const content = await fs.readFile(tasksPath, 'utf-8')

  let completed = 0
  let total = 0

  for (const line of content.split('\n')) {
    if (/^\s*- \[x\]/i.test(line)) {
      completed++
      total++
    } else if (/^\s*- \[ \]/i.test(line)) {
      total++
    } else if (/^\s*- \[~\]/i.test(line)) {
      total++
    } else if (/^\s*- \[!\]/i.test(line)) {
      total++
    }
  }

  return {
    completed,
    total,
    percentage: total > 0 ? Math.floor((completed * 100) / total) : 0,
    allDone: total > 0 && completed === total
  }
}
```

## Testes

Para testar a correção:

```bash
# 1. Criar feature de teste
$ adk feature new test-continuity "Test task tracking"

# 2. Adicionar tasks no tasks.md (pelo menos 5 tasks)

# 3. Rodar autopilot
$ adk feature autopilot test-continuity

# 4. Durante implementação, dar Ctrl+C

# 5. Verificar progress.md:
$ cat .claude/plans/features/test-continuity/progress.md
# Deve mostrar: implementacao (in_progress) se tasks < 100%

# 6. Verificar snapshot:
$ cat .claude/plans/features/test-continuity/.snapshots/session-end-*.json | tail -1
# Deve ter: "inProgressTask" e "completed"/"total"

# 7. Retomar autopilot
$ adk feature autopilot test-continuity

# Deve mostrar:
# - Task in-progress da sessão anterior
# - Progresso atual (X/Y tasks)
# - NÃO deve pular para QA se tasks < 100%
```

## Arquivos Modificados

1. `src/commands/feature.ts`:
   - Método `checkTasksCompletion()` (novo)
   - Método `implement()` (verifica tasks antes de marcar completed)
   - Método `autopilot()` (verifica tasks antes de avançar para QA)

2. `.claude/hooks/session-checkpoint.sh`:
   - Função `get_current_in_progress_task()` (nova)
   - Salva `inProgressTask` e `nextTask` no snapshot

3. `.claude/hooks/mark-task.sh` (novo):
   - Script para marcar tasks manualmente

4. `.claude/docs/task-tracking.md`:
   - Documentação do sistema de task tracking

## Garantias

✅ **Implementação só marca como completed se 100% das tasks estiverem [x]**
✅ **Autopilot não avança para QA se implementação < 100%**
✅ **Snapshots registram task in-progress para continuidade**
✅ **Mensagens claras sobre o que falta para concluir**
✅ **Progresso granular visível (X/Y tasks)**

## Próximos Passos

Se ainda houver problemas:

1. Verificar se tasks.md está sendo atualizado corretamente
2. Confirmar que checkboxes seguem formato: `- [x]`, `- [ ]`, `- [~]`, `- [!]`
3. Validar que session-checkpoint está gerando snapshots com `inProgressTask`
4. Testar com feature real em desenvolvimento
