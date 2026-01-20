---
description: Implementa uma feature existente seguindo TDD
---

# Implementar: $ARGUMENTS

Voce vai implementar a feature "$ARGUMENTS".

## Pre-requisitos

Verifique se existem:
- `.claude/plans/features/$ARGUMENTS/prd.md`
- `.claude/plans/features/$ARGUMENTS/tasks.md`

Se NAO existirem:
```
Erro: Feature "$ARGUMENTS" nao tem PRD/Tasks definidos.
Execute primeiro: /new-feature $ARGUMENTS
```

## Processo

### 1. Analise Arquitetural

Use o Task tool para delegar ao agent `architect`:

**Instrucoes:**
- Analise o codebase existente
- Leia `.claude/memory/architecture.md`
- Identifique padroes a seguir
- Crie `.claude/plans/features/$ARGUMENTS/implementation-plan.md`
- Atualize `.claude/memory/architecture.md` se necessario

### 2. Implementacao TDD

Use o Task tool para delegar ao agent `implementer`:

**Instrucoes:**
- Leia `.claude/plans/features/$ARGUMENTS/tasks.md`
- Siga o skill `tdd-development`
- Para cada task:
  1. RED: Escreva teste que falha
  2. GREEN: Implemente codigo minimo
  3. REFACTOR: Melhore codigo
  4. Commit
- Atualize tasks.md marcando tasks completas
- Atualize `.claude/memory/current-state.md`

### 3. Review

Use o Task tool para delegar ao agent `reviewer`:

**Instrucoes:**
- Analise o codigo implementado
- Use skill `code-review`
- Reporte issues encontradas

### 4. Reportar

Informe ao usuario:
- Tasks completadas: X de Y
- Coverage: Z%
- Issues encontradas: N
- Proximo passo: `/qa $ARGUMENTS` ou continuar implementacao

## Importante

- NUNCA pule o teste (TDD e obrigatorio)
- Commits pequenos e frequentes
- Pare se encontrar bloqueio e pergunte
