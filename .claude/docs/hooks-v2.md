# ADK v2: Enforcement Hooks

Automatic enforcement system ensuring ADK best practices in both CLI and autonomous Claude Code mode.

## Implemented Hooks

### 1. SessionStart: `session-bootstrap.sh`

**Purpose:** Inject active feature context at session start

- Reads `.claude/active-focus.md`
- Loads constraints from `constraints.md`
- Eliminates "cold start" problem

**Output:**
```
=== ACTIVE CONTEXT ===
Feature: adk-v2
Status: implementacao
Path: .claude/plans/features/adk-v2/
```

### 2. Stop: `session-checkpoint.sh`

**Purpose:** Auto-checkpoint when session ends

- Creates snapshot with reason `session_end`
- Updates `claude-progress.txt`
- Ensures recovery point exists

**Snapshot location:** `.claude/plans/features/<feature>/.snapshots/`

### 3. PreToolUse (Write): `validate-tdd.sh`

**Purpose:** TDD reminder (warning, not blocking)

- Detects `.ts`/`.tsx` creation in `src/`
- Checks for corresponding test file
- Displays warning if test missing

**Patterns checked:**
- `tests/<dir>/<name>.test.ts`
- `tests/<dir>/<name>.spec.ts`
- `src/<dir>/__tests__/<name>.test.ts`

### 4. PostToolUse (Write/Edit): `sync-state.sh`

**Purpose:** Keep state synchronized

- Records modifications in `progress.md`
- Updates `state.json` with timestamp
- Automatic, no manual sync needed

## Hook Configuration

In `.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": ".claude/hooks/session-bootstrap.sh" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": ".claude/hooks/session-checkpoint.sh" }] }],
    "PreToolUse": [{ "matcher": "Write", "hooks": [
      { "type": "command", "command": ".claude/hooks/scope-check.sh" },
      { "type": "command", "command": ".claude/hooks/validate-tdd.sh" }
    ]}],
    "PostToolUse": [{ "matcher": "Write", "hooks": [
      { "type": "command", "command": ".claude/hooks/post-write.sh" },
      { "type": "command", "command": ".claude/hooks/sync-state.sh" }
    ]}]
  }
}
```

## Design Principles

1. **Fail-Silent:** Exit 0 if precondition not met
2. **Fast:** < 100ms execution
3. **Non-Blocking:** Warnings only
4. **Idempotent:** Safe to run multiple times

## Performance

| Hook | Time |
|------|------|
| session-bootstrap.sh | ~30ms |
| session-checkpoint.sh | ~50ms |
| validate-tdd.sh | ~10ms |
| sync-state.sh | ~20ms |

## Troubleshooting

```bash
# Check permissions
chmod +x .claude/hooks/*.sh

# Disable temporarily
mv .claude/hooks/validate-tdd.sh .claude/hooks/validate-tdd.sh.disabled
```

## Future Phases

- **Fase 2:** Session Management (`--resume` flag)
- **Fase 3:** Context Compactor
- **Fase 4:** Constitution/Steering
- **Fase 5:** Git Commits as Checkpoints
- **Fase 6:** Resilience & Observability
