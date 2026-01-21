# ADK Hooks

This directory contains shell scripts that automatically enforce ADK best practices during Claude Code sessions.

## Installed Hooks

### SessionStart Hook (`session-bootstrap.sh`)
- **When:** Session starts
- **What:** Injects active feature context from `.claude/active-focus.md`
- **Why:** Eliminates "cold start" - Claude always knows which feature is active

### Stop Hook (`session-checkpoint.sh`)
- **When:** Session ends
- **What:** Creates automatic snapshot with current state
- **Why:** Ensures recovery point exists even if session interrupted

### TDD Validation (`validate-tdd.sh`)
- **When:** Before creating file in `src/`
- **What:** Warns if test file doesn't exist
- **Why:** Reminds to follow TDD (warning only, doesn't block)

### State Sync (`sync-state.sh`)
- **When:** After file write/edit
- **What:** Updates `progress.md` and `state.json` with modifications
- **Why:** Keeps state synchronized automatically

### Other Hooks

- `inject-focus.sh` - Injects feature focus on every prompt
- `scope-check.sh` - Alerts when editing outside feature scope
- `validate-bash.sh` - Blocks dangerous bash commands
- `post-write.sh` - Post-write validations
- `update-state.sh` - Legacy state update (replaced by sync-state.sh)
- `context-recall.sh` - Recalls context from memory

## Configuration

Hooks are registered in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [...],
    "Stop": [...],
    "UserPromptSubmit": [...],
    "PreToolUse": [...],
    "PostToolUse": [...]
  }
}
```

## Design Principles

All hooks follow:
1. **Fail-silent** - Exit 0 if precondition not met
2. **Fast** - Execute in < 100ms
3. **Defensive** - Validate inputs, handle errors gracefully
4. **Non-blocking** - Warnings only, never prevent operations

## Customization

To disable a hook temporarily:
```bash
mv .claude/hooks/validate-tdd.sh .claude/hooks/validate-tdd.sh.disabled
```

To re-enable:
```bash
mv .claude/hooks/validate-tdd.sh.disabled .claude/hooks/validate-tdd.sh
```

## More Info

See main documentation in project's `CLAUDE.md` under "ADK v2: Enforcement Hooks"
