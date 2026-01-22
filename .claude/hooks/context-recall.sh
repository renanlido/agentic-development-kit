#!/bin/bash

MEMORY_DIR=".claude/memory"
PLANS_DIR=".claude/plans/features"
DOCS_DIR=".docs"

extract_keywords() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '\n' | sort -u | grep -E '.{3,}' | head -10
}

search_in_file() {
  local file="$1"
  local keyword="$2"
  if [ -f "$file" ]; then
    grep -l -i "$keyword" "$file" 2>/dev/null
  fi
}

USER_INPUT="$CLAUDE_USER_INPUT"

if [ -z "$USER_INPUT" ]; then
  exit 0
fi

KEYWORDS=$(extract_keywords "$USER_INPUT")

if [ -z "$KEYWORDS" ]; then
  exit 0
fi

MATCHES=""

if [ -d "$MEMORY_DIR" ]; then
  for keyword in $KEYWORDS; do
    for file in "$MEMORY_DIR"/*.md; do
      if [ -f "$file" ] && grep -q -i "$keyword" "$file" 2>/dev/null; then
        MATCHES="$MATCHES $file"
      fi
    done
  done
fi

FOCUS_FILE=".claude/active-focus.md"
if [ -f "$FOCUS_FILE" ]; then
  FEATURE=$(grep "^feature:" "$FOCUS_FILE" | cut -d':' -f2 | xargs)
  if [ -n "$FEATURE" ]; then
    FEATURE_DIR="$PLANS_DIR/$FEATURE"
    if [ -d "$FEATURE_DIR" ]; then
      for keyword in $KEYWORDS; do
        for file in "$FEATURE_DIR"/*.md; do
          if [ -f "$file" ] && grep -q -i "$keyword" "$file" 2>/dev/null; then
            MATCHES="$MATCHES $file"
          fi
        done
      done
    fi
  fi
fi

if [ -d "$DOCS_DIR" ]; then
  for keyword in $KEYWORDS; do
    for file in "$DOCS_DIR"/*.md; do
      if [ -f "$file" ] && grep -q -i "$keyword" "$file" 2>/dev/null; then
        MATCHES="$MATCHES $file"
      fi
    done
  done
fi

UNIQUE_MATCHES=$(echo "$MATCHES" | tr ' ' '\n' | sort -u | head -5)

if [ -n "$UNIQUE_MATCHES" ]; then
  echo ""
  echo "CONTEXT RECALL (arquivos relevantes detectados):"
  for file in $UNIQUE_MATCHES; do
    echo "  - $file"
  done
  echo ""
  echo "Considere ler estes arquivos se precisar de contexto adicional."
  echo ""
fi

exit 0
