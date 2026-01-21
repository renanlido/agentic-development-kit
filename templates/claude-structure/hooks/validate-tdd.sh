#!/bin/bash

FILE_PATH="$1"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ ! "$FILE_PATH" =~ ^src/.+\.tsx?$ ]]; then
  exit 0
fi

BASE_NAME=$(basename "$FILE_PATH" .ts)
BASE_NAME=$(basename "$BASE_NAME" .tsx)
DIR_NAME=$(dirname "$FILE_PATH" | sed 's|^src/||')

TEST_PATTERNS=(
  "tests/$DIR_NAME/$BASE_NAME.test.ts"
  "tests/$DIR_NAME/$BASE_NAME.spec.ts"
  "src/$DIR_NAME/__tests__/$BASE_NAME.test.ts"
  "src/$DIR_NAME/__tests__/$BASE_NAME.spec.ts"
)

for TEST_FILE in "${TEST_PATTERNS[@]}"; do
  if [ -f "$TEST_FILE" ]; then
    exit 0
  fi
done

echo "⚠️  TDD Warning: Creating file in src/ without corresponding test."
echo "   File: $FILE_PATH"
echo "   Expected test at: ${TEST_PATTERNS[0]}"
echo "   Alternative patterns: ${TEST_PATTERNS[1]}, ${TEST_PATTERNS[2]}, ${TEST_PATTERNS[3]}"
echo ""
echo "   This is a reminder to follow TDD. Tests should be written first."

exit 0
