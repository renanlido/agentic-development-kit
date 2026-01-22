---
description: Inicia processo completo de criacao de nova feature (PRD + Tasks)
---

# Nova Feature

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

```
Erro: Nome da feature é obrigatório.

Uso: /new-feature <nome-da-feature>

Exemplo: /new-feature user-authentication
```

Caso contrário, use `$ARGUMENTS` como nome da feature.

## Processo

### 1. Criar Estrutura

Crie a pasta da feature:
```bash
mkdir -p .claude/plans/features/$ARGUMENTS
```

### 2. Atualizar Focus

Atualize o arquivo `.claude/active-focus.md`:
```
# Foco Ativo

feature: $ARGUMENTS
status: criando PRD
path: .claude/plans/features/$ARGUMENTS/
```

### 3. Criar PRD

Use o Task tool para delegar ao agent `prd-creator`:

**Instrucoes para o agent:**
- Leia `.claude/memory/project-context.md` para entender o projeto
- Use o template em `.claude/skills/prd-writing/templates/prd-template.md`
- Faca perguntas ao usuario para entender os requisitos
- Salve o PRD em `.claude/plans/features/$ARGUMENTS/prd.md`

### 4. Criar Tasks

Apos o PRD estar completo, use o Task tool para delegar ao agent `task-breakdown`:

**Instrucoes para o agent:**
- Leia o PRD criado em `.claude/plans/features/$ARGUMENTS/prd.md`
- Use o template em `.claude/skills/task-planning/templates/task-template.md`
- Quebre em tasks implementaveis
- Salve em `.claude/plans/features/$ARGUMENTS/tasks.md`

### 5. Criar Progress

Crie o arquivo de progresso `.claude/plans/features/$ARGUMENTS/progress.md`:
```yaml
feature: $ARGUMENTS
created: <data-atual>
steps:
  - name: prd
    status: completed
  - name: research
    status: pending
  - name: tasks
    status: completed
  - name: arquitetura
    status: pending
  - name: implementacao
    status: pending
  - name: qa
    status: pending
  - name: docs
    status: pending
```

### 6. Reportar

Informe ao usuario:
```
✨ Feature "$ARGUMENTS" criada!

Arquivos:
  - PRD: .claude/plans/features/$ARGUMENTS/prd.md
  - Tasks: .claude/plans/features/$ARGUMENTS/tasks.md
  - Progress: .claude/plans/features/$ARGUMENTS/progress.md

Próximo passo:
  /next-step $ARGUMENTS
  ou
  adk feature research $ARGUMENTS
```

## Importante

- Faca perguntas para entender bem os requisitos
- Nao assuma - pergunte ao usuario
- Use os templates como base
- Mantenha consistencia com o projeto
- SEMPRE passe o nome da feature nos proximos comandos
