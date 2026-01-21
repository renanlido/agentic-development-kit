---
description: Implementa uma feature existente seguindo TDD
---

# Implementar Feature

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

```
Erro: Nome da feature é obrigatório.

Uso: /implement <nome-da-feature>

Exemplo: /implement user-authentication

Para ver features disponíveis:
  adk feature list
```

## Pre-requisitos

Verifique se existem:
- `.claude/plans/features/$ARGUMENTS/prd.md`
- `.claude/plans/features/$ARGUMENTS/tasks.md`

Se NAO existirem:
```
Erro: Feature "$ARGUMENTS" nao tem PRD/Tasks definidos.
Execute primeiro: /new-feature $ARGUMENTS
```

## Atualizar Focus

Atualize `.claude/active-focus.md`:
```
# Foco Ativo

feature: $ARGUMENTS
status: implementando
path: .claude/plans/features/$ARGUMENTS/
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
- Salve o report em `.claude/plans/features/$ARGUMENTS/review.md`

### 3.5. Secondary Review (Validacao AI-on-AI)

Use o Task tool para delegar ao agent `reviewer-secondary`:

**Instrucoes:**
- Faca review independente do codigo (NAO leia o review primario primeiro)
- Foque em:
  - Edge cases nao cobertos
  - Implicacoes de seguranca
  - Concerns de escalabilidade
  - Riscos de integracao
- Compare com review primario apos sua analise
- Salve report em `.claude/plans/features/$ARGUMENTS/secondary-review.md`

**IMPORTANTE:**
- Este step e **NAO-BLOQUEANTE** - continua mesmo se nao encontrar issues
- O objetivo e capturar o que o primeiro reviewer pode ter perdido
- Se precisar pular, use flag `--skip-secondary-review`

### 4. Atualizar Progress

Atualize `.claude/plans/features/$ARGUMENTS/progress.md`:
- Marque `implementacao` como `completed`

### 5. Reportar

Informe ao usuario:
```
✅ Implementação de "$ARGUMENTS" concluída!

- Tasks completadas: X de Y
- Coverage: Z%
- Issues encontradas: N

Próximo passo:
  /qa $ARGUMENTS
  ou
  adk feature qa $ARGUMENTS
```

## Importante

- NUNCA pule o teste (TDD e obrigatorio)
- Commits pequenos e frequentes
- Pare se encontrar bloqueio e pergunte
- SEMPRE use o nome da feature passado: $ARGUMENTS
