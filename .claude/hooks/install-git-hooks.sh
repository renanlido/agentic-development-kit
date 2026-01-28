#!/bin/bash

# Instala hooks do ADK no repositório git atual

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null)"

if [ -z "$GIT_DIR" ]; then
  echo "❌ Não está em um repositório git"
  exit 1
fi

HOOKS_DIR="$GIT_DIR/hooks"

# Copia prepare-commit-msg
if [ -f "$SCRIPT_DIR/prepare-commit-msg" ]; then
  cp "$SCRIPT_DIR/prepare-commit-msg" "$HOOKS_DIR/prepare-commit-msg"
  chmod +x "$HOOKS_DIR/prepare-commit-msg"
  echo "✓ Instalado: prepare-commit-msg (remove Co-Authored-By)"
fi

echo ""
echo "✨ Hooks instalados em $HOOKS_DIR"
