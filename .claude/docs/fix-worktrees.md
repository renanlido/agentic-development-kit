# Fix Worktrees - Guia de Correção

## Problema

Quando `.claude/plans` é um **diretório** em vez de **symlink** na worktree, ela fica dessincrona com a branch principal, causando estado incorreto.

## Soluções

### 1️⃣ Worktrees Git (criadas com `git worktree add`)

Use o comando ADK built-in:

```bash
adk feature fix-worktrees
```

Este comando:
- Encontra todas as worktrees Git registradas
- Recria todos os symlinks `.claude/` corretamente
- Usa a função `setupClaudeSymlink()` para garantir consistência

### 2️⃣ Diretórios Manuais (em `.worktrees/`)

Se você tem diretórios em `.worktrees/` que não são worktrees Git:

```bash
./.claude/scripts/fix-manual-worktrees.sh
```

Este script:
- Varre todos os diretórios em `.worktrees/`
- Converte `plans/` de diretório para symlink
- Mantém a sincronia com `.claude/plans` principal

### 3️⃣ Worktrees Git com filtro customizado

Para worktrees Git em locais não-padrão:

```bash
./.claude/scripts/fix-worktree-plans.sh
```

Este script:
- Usa `git worktree list` para encontrar todas as worktrees
- Corrige apenas o symlink `plans/`
- Funciona em qualquer localização

## Como Identificar o Problema

```bash
# Em cada worktree, verifique:
ls -la .worktrees/*/. claude/plans

# Correto (symlink):
lrwxr-xr-x  plans -> /path/to/main/.claude/plans

# Incorreto (diretório):
drwxr-xr-x  plans
```

## Prevenção

O ADK já previne este problema automaticamente:
- `src/utils/worktree-utils.ts:222` - `'plans'` na lista de symlinks
- Ao criar worktrees com `adk`, os symlinks são configurados corretamente
- Função `setupClaudeSymlink()` garante consistência

## Referência

- Código: `src/utils/worktree-utils.ts:199-281` (`setupClaudeSymlink`)
- CLI: `src/cli.ts:132-134` (`feature fix-worktrees`)
- Arquitetura: Ver `CLAUDE.md` seção "Worktree Symlink Architecture"
