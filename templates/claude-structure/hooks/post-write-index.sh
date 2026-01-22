#!/bin/bash

FILE_PATH="$1"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ ! "$FILE_PATH" =~ ^\.claude/.*\.md$ ]]; then
  exit 0
fi

ADK_CMD=$(command -v adk 2>/dev/null)

if [ -z "$ADK_CMD" ]; then
  exit 0
fi

"$ADK_CMD" memory queue "$FILE_PATH" >/dev/null 2>&1 &

exit 0
