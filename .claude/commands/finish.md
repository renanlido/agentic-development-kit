---
description: Finaliza worktree de feature (commit, merge/PR, cleanup)
---

# Finish Feature Worktree

Finaliza o trabalho em uma worktree de feature.

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

1. Tente obter da feature ativa em `.claude/active-focus.md`
2. Se não encontrar:
```
Erro: Nome da feature é obrigatório.

Uso: /finish <nome-da-feature>

Exemplo: /finish user-authentication

Para ver features disponíveis:
  adk feature list
```

## Detectar Contexto

Defina as variáveis:
- `FEATURE_NAME`: O argumento ou feature ativa
- `FEATURE_SLUG`: Nome normalizado (substitui caracteres especiais por `-`)
- `BRANCH_NAME`: `feature/$FEATURE_SLUG`
- `WORKTREE_PATH`: `.worktrees/$FEATURE_SLUG`
- `MAIN_REPO_PATH`: Diretório atual (se não estiver em worktree) ou resultado de `git rev-parse --git-common-dir` (pai)

## Validações

1. Verifique se o worktree existe:
```bash
ls -la .worktrees/$FEATURE_SLUG
```

Se NÃO existir:
```
Erro: Worktree não encontrado para feature "$ARGUMENTS".

Path esperado: .worktrees/$FEATURE_SLUG

Verifique se a feature foi implementada com worktree.
```

2. Verifique se a branch existe:
```bash
git branch --list "feature/$FEATURE_SLUG"
```

## Execução

### 1. Verificar mudanças pendentes no worktree

Execute DENTRO do worktree:
```bash
cd .worktrees/$FEATURE_SLUG
git status --porcelain
```

Se houver mudanças:
```bash
git add .
git status
```

Pergunte ao usuário:
```
Há mudanças pendentes. Deseja commitar?
- Sim, commitar com mensagem padrão
- Sim, deixe-me escrever a mensagem
- Não, descartar mudanças
- Cancelar
```

Se commitar (dentro do worktree):
```bash
cd .worktrees/$FEATURE_SLUG
git commit -m "feat($FEATURE_NAME): complete implementation"
```

### 2. Verificar se existe remote

```bash
git remote
```

### 3A. Se existir remote (origin)

Push a partir do worktree:
```bash
cd .worktrees/$FEATURE_SLUG
git push -u origin $BRANCH_NAME
```

Pergunte:
```
Push realizado. Deseja abrir PR?
- Sim, abrir PR
- Não, apenas push
```

Se abrir PR (do worktree):
```bash
cd .worktrees/$FEATURE_SLUG
gh pr create --base main --title "feat: $FEATURE_NAME" --body "## Summary
- Implementation of $FEATURE_NAME

## Test Plan
- [ ] Tests passing
- [ ] QA approved"
```

Mostre o link do PR.

### 3B. Se NÃO existir remote

Vá para o repo principal e faça merge:
```bash
git checkout main
git merge $BRANCH_NAME
```

Se houver conflitos, informe e pare.

### 4. Cleanup (após merge/PR)

Pergunte:
```
Deseja limpar o worktree agora?
- Sim, remover worktree e branch
- Não, manter para referência
```

Se sim (do repo principal):
```bash
git worktree remove .worktrees/$FEATURE_SLUG --force
git branch -d $BRANCH_NAME
```

## Output Final

```
✨ Feature "$FEATURE_NAME" finalizada!

Branch: $BRANCH_NAME
Status: [Merged / PR aberto: <link>]
Worktree: [Removido / Mantido em .worktrees/$FEATURE_SLUG]

Próximos passos:
  [Se PR] - Aguarde review e merge do PR
  [Se merged] - Feature integrada à main
```

## Atalhos

Se `$ARGUMENTS` contiver flags:
- `--no-commit`: Pula commit (assume que já foi feito)
- `--no-cleanup`: Não remove worktree após merge/PR
- `--force`: Executa sem confirmações

Exemplos:
```
/finish my-feature
/finish my-feature --force
/finish my-feature --no-cleanup
```
