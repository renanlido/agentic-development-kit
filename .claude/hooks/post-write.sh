#!/bin/bash

# Hook: PostToolUse - Executa apos escrever arquivos
# Pode ser usado para:
#   - Auto-formatar codigo
#   - Validar syntax
#   - Atualizar indices

# Le input JSON via stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Se nao tem file_path, sair
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Obter extensao do arquivo
EXT="${FILE_PATH##*.}"

# Auto-format baseado na extensao (descomente se quiser)
# case "$EXT" in
#   ts|tsx|js|jsx)
#     # Formatar com prettier/biome se disponivel
#     if command -v npx &> /dev/null; then
#       npx biome format --write "$FILE_PATH" 2>/dev/null || true
#     fi
#     ;;
#   py)
#     # Formatar com black se disponivel
#     if command -v black &> /dev/null; then
#       black "$FILE_PATH" 2>/dev/null || true
#     fi
#     ;;
#   go)
#     # Formatar com gofmt
#     if command -v gofmt &> /dev/null; then
#       gofmt -w "$FILE_PATH" 2>/dev/null || true
#     fi
#     ;;
# esac

exit 0
