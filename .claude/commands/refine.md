---
description: Refina artefatos de uma feature (PRD, research, tasks) com contexto adicional
argument-hint: [feature-name] [--prd] [--research] [--tasks] [--all] [--cascade]
allowed-tools: Read, Write, Edit, Bash(adk:*), Glob, Grep
---

# Refine Feature Artifacts

## Argumento Recebido

Feature solicitada: `$ARGUMENTS`

## Verificacao Inicial

Primeiro, verifique se o argumento foi fornecido:

Se `$ARGUMENTS` estiver vazio, pergunte ao usuario qual feature refinar ou use a feature ativa:

```bash
cat .claude/active-focus.md 2>/dev/null || echo "Nenhuma feature ativa"
```

## Estado Atual da Feature

Verifique o estado da feature:

```bash
adk feature list 2>/dev/null | grep -E "^[├└]" || echo "Nenhuma feature encontrada"
```

## Artefatos Disponiveis

Leia os artefatos existentes para entender o contexto:

- PRD: @.claude/plans/features/$1/prd.md
- Research: @.claude/plans/features/$1/research.md
- Tasks: @.claude/plans/features/$1/tasks.md
- Progress: @.claude/plans/features/$1/progress.md

## Processo de Refinamento Interativo

### 1. Coleta de Contexto

Pergunte ao usuario:

1. **"Que contexto adicional voce quer incluir?"**
   - Novos requisitos descobertos
   - Restricoes tecnicas identificadas
   - Feedback de stakeholders
   - Mudancas de escopo

2. **"Quais artefatos precisam de refinamento?"**
   - [ ] PRD - Adicionar/modificar requisitos
   - [ ] Research - Novas descobertas tecnicas
   - [ ] Tasks - Refinar/adicionar tasks pendentes

3. **"Ha cenarios ou edge cases nao cobertos?"**
   - Liste cenarios faltantes
   - Identifique gaps no coverage

### 2. Analise de Impacto

Antes de refinar, analise:

- Quais tasks ja foram iniciadas/completadas?
- O refinamento afeta tasks em progresso?
- Ha dependencias que precisam ser atualizadas?

**Regras de Protecao:**
- Tasks `[x]` (completed) - NAO MODIFICAR
- Tasks `[~]` (in_progress) - NAO MODIFICAR
- Tasks `[ ]` (pending) - Pode refinar/remover
- Tasks `[!]` (blocked) - Pode refinar

### 3. Execucao do Refinamento

#### Para PRD:

Adicione uma secao de refinamento:

```markdown
---

## Refinamento (YYYY-MM-DD)

### Contexto Adicional
[Contexto fornecido pelo usuario]

### Mudancas Aplicadas
- [Lista de mudancas]

### Impacto em Outras Fases
- [Impacto identificado]
```

#### Para Research:

Adicione secao de descobertas:

```markdown
---

## Descobertas Adicionais (YYYY-MM-DD)

### Novos Insights
[Descobertas baseadas no contexto]

### Riscos Atualizados
[Novos riscos identificados]
```

#### Para Tasks:

1. Preserve tasks completed/in_progress
2. Refine tasks pending conforme contexto
3. Adicione novas tasks com prefixo `[REFINAMENTO]`:

```markdown
## Tasks Adicionadas em Refinamento

- [ ] [REFINAMENTO] Nova task baseada no contexto
- [ ] [REFINAMENTO] Outra task necessaria
```

### 4. Cascata (Opcional)

Se o PRD foi refinado, pergunte:

> "O PRD foi atualizado. Deseja propagar as mudancas para Research e Tasks?"

Se sim, atualize em cascata:
1. Research - Adicione descobertas relevantes
2. Tasks - Gere tasks para novos requisitos

### 5. Finalizacao

Apos refinamento, execute:

```bash
adk feature refine $1 --context "[contexto-resumido]"
```

Ou se preferir usar o CLI diretamente com opcoes:

```bash
adk feature refine $1 --prd --cascade
adk feature refine $1 --tasks
adk feature refine $1 --all
```

## Output Esperado

Ao finalizar, mostre:

```
Refinamento concluido!

Artefatos atualizados:
- [x] PRD (3 secoes adicionadas)
- [x] Research (2 descobertas)
- [x] Tasks (+4 novas tasks)

Proximos passos:
- Revise as mudancas em .claude/plans/features/<nome>/
- Execute: adk feature next <nome>
```

## Dicas

- Use `--all` para refinar todos os artefatos elegiveis
- Use `--cascade` para propagar mudancas automaticamente
- O refinamento cria snapshot antes de modificar (rollback possivel)
- Tasks em progresso sao sempre preservadas
