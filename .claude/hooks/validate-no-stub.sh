#!/bin/bash

INPUT=$(cat)

CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
if [[ -z "$CONTENT" ]]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
fi

if [[ -z "$CONTENT" ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

BLOCKED=""

if echo "$CONTENT" | grep -qF "throw new Error('Not implemented')"; then
  BLOCKED="throw new Error(Not implemented)"
elif echo "$CONTENT" | grep -qF 'throw new Error("Not implemented")'; then
  BLOCKED="throw new Error(Not implemented)"
elif echo "$CONTENT" | grep -qF "throw new Error('TODO')"; then
  BLOCKED="throw new Error(TODO)"
elif echo "$CONTENT" | grep -qF 'throw new Error("TODO")'; then
  BLOCKED="throw new Error(TODO)"
elif echo "$CONTENT" | grep -qF "// TODO:"; then
  BLOCKED="// TODO:"
elif echo "$CONTENT" | grep -qF "// FIXME:"; then
  BLOCKED="// FIXME:"
elif echo "$CONTENT" | grep -qF "/* TODO:"; then
  BLOCKED="/* TODO:"
elif echo "$CONTENT" | grep -qF "/* FIXME:"; then
  BLOCKED="/* FIXME:"
elif echo "$CONTENT" | grep -qF "// stub"; then
  BLOCKED="// stub"
elif echo "$CONTENT" | grep -qF "/* stub"; then
  BLOCKED="/* stub"
elif echo "$CONTENT" | grep -qF "pass # stub"; then
  BLOCKED="pass # stub"
elif echo "$CONTENT" | grep -qF "pass  # stub"; then
  BLOCKED="pass # stub"
elif echo "$CONTENT" | grep -qF "pass # TODO"; then
  BLOCKED="pass # TODO"
elif echo "$CONTENT" | grep -qF "pass  # TODO"; then
  BLOCKED="pass # TODO"
elif echo "$CONTENT" | grep -qF "NotImplementedError"; then
  BLOCKED="NotImplementedError"
fi

if [[ -n "$BLOCKED" ]]; then
  echo "{\"decision\": \"block\", \"reason\": \"BLOCKED: Stub code detected. Pattern found: $BLOCKED. You MUST implement complete, working code. Never use placeholders, TODOs, or throw Not implemented errors.\"}"
  exit 0
fi

echo '{"decision": "allow"}'
