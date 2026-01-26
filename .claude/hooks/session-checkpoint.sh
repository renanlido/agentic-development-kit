#!/bin/bash

ACTIVE_FOCUS=".claude/active-focus.md"

if [ ! -f "$ACTIVE_FOCUS" ]; then
  exit 0
fi

FEATURE=$(grep -i "^feature:" "$ACTIVE_FOCUS" 2>/dev/null | sed 's/^[Ff]eature: *//' | tr -d '\n')

if [ -z "$FEATURE" ]; then
  exit 0
fi

FEATURE_DIR=".claude/plans/features/$FEATURE"

if [ ! -d "$FEATURE_DIR" ]; then
  exit 0
fi

TASKS_FILE="$FEATURE_DIR/tasks.md"
PROGRESS_FILE="$FEATURE_DIR/progress.md"
SNAPSHOT_DIR="$FEATURE_DIR/.snapshots"
PROGRESS_OUTPUT="$FEATURE_DIR/claude-progress.txt"

mkdir -p "$SNAPSHOT_DIR" 2>/dev/null || true

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SNAPSHOT_ID="session-end-$(date +%s)"
SNAPSHOT_FILE="$SNAPSHOT_DIR/$SNAPSHOT_ID.json"

analyze_tasks() {
  local tasks_file="$1"

  if [ ! -f "$tasks_file" ]; then
    echo "0|0|0|unknown"
    return
  fi

  local total_tasks=0
  local completed_tasks=0
  local current_fase=""
  local incomplete_fases=""

  while IFS= read -r line; do
    if echo "$line" | grep -qE "^## Fase [0-9]+"; then
      current_fase=$(echo "$line" | sed 's/## //')
    fi

    if echo "$line" | grep -qE "^\s*- \[x\]"; then
      ((completed_tasks++))
      ((total_tasks++))
    elif echo "$line" | grep -qE "^\s*- \[ \]"; then
      ((total_tasks++))
      if [ -n "$current_fase" ]; then
        if ! echo "$incomplete_fases" | grep -q "$current_fase"; then
          if [ -n "$incomplete_fases" ]; then
            incomplete_fases="$incomplete_fases, $current_fase"
          else
            incomplete_fases="$current_fase"
          fi
        fi
      fi
    fi
  done < "$tasks_file"

  local percentage=0
  if [ "$total_tasks" -gt 0 ]; then
    percentage=$((completed_tasks * 100 / total_tasks))
  fi

  echo "$completed_tasks|$total_tasks|$percentage|$incomplete_fases"
}

get_next_incomplete_task() {
  local tasks_file="$1"

  if [ ! -f "$tasks_file" ]; then
    return
  fi

  local current_fase=""
  local current_task=""

  while IFS= read -r line; do
    if echo "$line" | grep -qE "^## Fase [0-9]+"; then
      current_fase=$(echo "$line" | sed 's/## //')
    fi

    if echo "$line" | grep -qE "^### Task"; then
      current_task=$(echo "$line" | sed 's/### //')
    fi

    if echo "$line" | grep -qE "^\s*- \[ \]" && [ -n "$current_task" ]; then
      echo "$current_fase: $current_task"
      return
    fi
  done < "$tasks_file"
}

get_current_in_progress_task() {
  local tasks_file="$1"

  if [ ! -f "$tasks_file" ]; then
    return
  fi

  local current_fase=""
  local current_task=""

  while IFS= read -r line; do
    if echo "$line" | grep -qE "^## Fase [0-9]+"; then
      current_fase=$(echo "$line" | sed 's/## //')
    fi

    if echo "$line" | grep -qE "^### Task"; then
      current_task=$(echo "$line" | sed 's/### //')
    fi

    if echo "$line" | grep -qE "^\s*- \[~\]" && [ -n "$current_task" ]; then
      echo "$current_fase: $current_task"
      return
    fi
  done < "$tasks_file"
}

get_current_phase() {
  local progress_file="$1"

  if [ ! -f "$progress_file" ]; then
    echo "unknown"
    return
  fi

  grep "^\*\*Phase\*\*:" "$progress_file" 2>/dev/null | sed 's/.*: *//' | head -1
}

TASK_ANALYSIS=$(analyze_tasks "$TASKS_FILE")
COMPLETED=$(echo "$TASK_ANALYSIS" | cut -d'|' -f1)
TOTAL=$(echo "$TASK_ANALYSIS" | cut -d'|' -f2)
PERCENTAGE=$(echo "$TASK_ANALYSIS" | cut -d'|' -f3)
INCOMPLETE_FASES=$(echo "$TASK_ANALYSIS" | cut -d'|' -f4)

NEXT_TASK=$(get_next_incomplete_task "$TASKS_FILE")
IN_PROGRESS_TASK=$(get_current_in_progress_task "$TASKS_FILE")
CURRENT_PHASE=$(get_current_phase "$PROGRESS_FILE")

CAN_ADVANCE_TO_QA="false"
if [ "$COMPLETED" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
  CAN_ADVANCE_TO_QA="true"
fi

cat > "$SNAPSHOT_FILE" <<EOF
{
  "id": "$SNAPSHOT_ID",
  "feature": "$FEATURE",
  "reason": "session_end",
  "timestamp": "$TIMESTAMP",
  "tasks": {
    "completed": $COMPLETED,
    "total": $TOTAL,
    "percentage": $PERCENTAGE,
    "canAdvanceToQA": $CAN_ADVANCE_TO_QA,
    "inProgressTask": "${IN_PROGRESS_TASK:-}",
    "nextTask": "${NEXT_TASK:-}"
  }
}
EOF

cat > "$PROGRESS_OUTPUT" <<EOF
=== FEATURE PROGRESS: $FEATURE ===
Updated: $TIMESTAMP

--- TASK STATUS ---
Tasks Completed: $COMPLETED / $TOTAL ($PERCENTAGE%)
Current Phase: ${CURRENT_PHASE:-unknown}

--- INCOMPLETE PHASES ---
${INCOMPLETE_FASES:-"None - all tasks complete!"}

--- CURRENT TASK (IN PROGRESS) ---
${IN_PROGRESS_TASK:-"None"}

--- NEXT TASK (PENDING) ---
${NEXT_TASK:-"All tasks completed. Ready for QA."}

--- QA READINESS ---
EOF

if [ "$CAN_ADVANCE_TO_QA" = "true" ]; then
  echo "✅ Ready to advance to QA (all tasks complete)" >> "$PROGRESS_OUTPUT"
else
  echo "⛔ NOT ready for QA" >> "$PROGRESS_OUTPUT"
  echo "   Reason: $COMPLETED of $TOTAL tasks completed ($PERCENTAGE%)" >> "$PROGRESS_OUTPUT"
  if [ -n "$INCOMPLETE_FASES" ]; then
    echo "   Incomplete: $INCOMPLETE_FASES" >> "$PROGRESS_OUTPUT"
  fi
fi

cat >> "$PROGRESS_OUTPUT" <<EOF

--- SNAPSHOT ---
Checkpoint created: $SNAPSHOT_ID
EOF

if [ -f "$PROGRESS_FILE" ]; then
  CURRENT_IN_PROGRESS=$(grep "in progress" "$PROGRESS_FILE" | head -1)

  if [ -n "$NEXT_TASK" ] && [ -n "$CURRENT_IN_PROGRESS" ]; then
    FASE_NUM=$(echo "$NEXT_TASK" | grep -oE "Fase [0-9]+" | head -1)
    if [ -n "$FASE_NUM" ]; then
      NEW_STATUS="(in progress: $FASE_NUM - $PERCENTAGE% complete)"
      sed -i.bak "s/(in progress:.*)/$NEW_STATUS/" "$PROGRESS_FILE" 2>/dev/null
      rm -f "$PROGRESS_FILE.bak"
    fi
  fi

  sed -i.bak "s/Last updated:.*/Last updated: $TIMESTAMP/" "$PROGRESS_FILE" 2>/dev/null
  rm -f "$PROGRESS_FILE.bak"
fi

exit 0
