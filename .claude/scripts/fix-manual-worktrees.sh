#!/bin/bash
set -e

MAIN_REPO=$(git rev-parse --show-toplevel)
MAIN_PLANS="$MAIN_REPO/.claude/plans"
WORKTREES_DIR="$MAIN_REPO/.worktrees"

echo "🔧 Corrigindo symlinks .claude/plans em diretórios .worktrees..."
echo ""

if [ ! -d "$WORKTREES_DIR" ]; then
  echo "⚠️  Diretório .worktrees não encontrado"
  exit 0
fi

find "$WORKTREES_DIR" -maxdepth 2 -type d -name ".claude" | while read -r claude_dir; do
  worktree_path=$(dirname "$claude_dir")
  plans_path="$claude_dir/plans"

  echo "📁 Verificando: $(basename "$worktree_path")"

  if [ -L "$plans_path" ]; then
    target=$(readlink "$plans_path")
    if [ "$target" = "$MAIN_PLANS" ]; then
      echo "  ✓ Já correto (symlink para main)"
      continue
    fi
  fi

  if [ -d "$plans_path" ] && [ ! -L "$plans_path" ]; then
    echo "  ⚠️  É diretório, convertendo para symlink..."
    rm -rf "$plans_path"
    ln -s "$MAIN_PLANS" "$plans_path"
    echo "  ✅ Convertido com sucesso"
  elif [ ! -e "$plans_path" ]; then
    echo "  🔗 Criando symlink..."
    ln -s "$MAIN_PLANS" "$plans_path"
    echo "  ✅ Symlink criado"
  else
    echo "  ❌ Estado desconhecido: $plans_path"
  fi

  echo ""
done

echo "✨ Concluído!"
