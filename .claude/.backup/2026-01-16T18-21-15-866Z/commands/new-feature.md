---
description: Inicia processo completo de criacao de nova feature (PRD + Tasks)
---

# Nova Feature: $ARGUMENTS

Voce vai criar uma nova feature chamada "$ARGUMENTS".

## Processo

### 1. Criar Estrutura

Crie a pasta da feature:
```
.claude/plans/features/$ARGUMENTS/
```

### 2. Criar PRD

Use o Task tool para delegar ao agent `prd-creator`:

**Instrucoes para o agent:**
- Leia `.claude/memory/project-context.md` para entender o projeto
- Use o template em `.claude/skills/prd-writing/templates/prd-template.md`
- Faca perguntas ao usuario para entender os requisitos
- Salve o PRD em `.claude/plans/features/$ARGUMENTS/prd.md`

### 3. Criar Tasks

Apos o PRD estar completo, use o Task tool para delegar ao agent `task-breakdown`:

**Instrucoes para o agent:**
- Leia o PRD criado em `.claude/plans/features/$ARGUMENTS/prd.md`
- Use o template em `.claude/skills/task-planning/templates/task-template.md`
- Quebre em tasks implementaveis
- Salve em `.claude/plans/features/$ARGUMENTS/tasks.md`

### 4. Reportar

Informe ao usuario:
- PRD criado em: `.claude/plans/features/$ARGUMENTS/prd.md`
- Tasks criadas em: `.claude/plans/features/$ARGUMENTS/tasks.md`
- Proximo passo: `/implement $ARGUMENTS`

## Importante

- Faca perguntas para entender bem os requisitos
- Nao assuma - pergunte ao usuario
- Use os templates como base
- Mantenha consistencia com o projeto
