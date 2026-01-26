#!/bin/bash
set -e

MAIN_REPO=$(git rev-parse --show-toplevel)
MAIN_PLANS="$MAIN_REPO/.claude/plans"

echo "🔧 Corrigindo symlinks .claude/plans nas worktrees..."
echo ""

git worktree list --porcelain | grep '^worktree ' | cut -d' ' -f2 | while read -r worktree_path; do
  if [ "$worktree_path" = "$MAIN_REPO" ]; then
    echo "⏭️  Pulando repositório principal: $worktree_path"
    continue
  fi

  worktree_plans="$worktree_path/.claude/plans"

  if [ ! -d "$worktree_path/.claude" ]; then
    echo "⚠️  Sem .claude em: $worktree_path"
    continue
  fi

  if [ -L "$worktree_plans" ]; then
    target=$(readlink "$worktree_plans")
    if [ "$target" = "$MAIN_PLANS" ]; then
      echo "✓ Já correto: $worktree_path"
      continue
    fi
  fi

  if [ -e "$worktree_plans" ]; then
    echo "🗑️  Removendo: $worktree_plans"
    rm -rf "$worktree_plans"
  fi

  echo "🔗 Criando symlink: $worktree_plans -> $MAIN_PLANS"
  ln -s "$MAIN_PLANS" "$worktree_plans"
  echo "✅ Corrigido: $worktree_path"
  echo ""
done

echo ""
echo "✨ Concluído!"
