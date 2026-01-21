# ADK v2: Advanced Agentic Techniques

This document describes the advanced techniques implemented in ADK v2 for long-running agent sessions.

## Mandatory Techniques

### 1. TDD-First Development

**Rule:** All production code in `src/` MUST have corresponding tests written FIRST.

**Enforcement:**
- `validate-tdd.sh` hook triggers on `PreToolUse:Write`
- Warns (does not block) when creating TypeScript files in `src/` without tests
- Acceptable test patterns:
  - `tests/<path>/<file>.test.ts`
  - `tests/<path>/<file>.spec.ts`
  - `src/<path>/__tests__/<file>.test.ts`
  - `src/<path>/__tests__/<file>.spec.ts`

**Example:**
```bash
# Creating src/commands/new-feature.ts will trigger:
⚠️  TDD Warning: Creating file in src/ without corresponding test.
   Expected test at: tests/commands/new-feature.test.ts
```

### 2. Automatic State Synchronization

**Rule:** Feature state is automatically synchronized after every file write.

**Enforcement:**
- `sync-state.sh` hook triggers on `PostToolUse:Write`
- Updates `progress.md` with modified files
- Updates `state.json` with timestamp
- Non-blocking (async execution)

**What gets synced:**
- Modified file paths with timestamps
- Last modification time in state.json
- Automatically appends to "Files Modified" section

### 3. Session Checkpoints

**Rule:** Session state is automatically checkpointed when session ends.

**Enforcement:**
- `session-checkpoint.sh` hook triggers on `Stop` event
- Creates snapshot in `.snapshots/` directory
- Updates `claude-progress.txt` for recovery
- Includes timestamp and reason (`session_end`)

**Checkpoint includes:**
- Snapshot ID (e.g., `session-end-1737426432`)
- Feature name
- Current phase and progress percentage
- Timestamp

**Recovery:**
```bash
# Resume from last checkpoint
adk agent run <name> --resume
```

### 4. Context Bootstrapping

**Rule:** Active feature context is injected at session start.

**Enforcement:**
- `session-bootstrap.sh` hook triggers on `SessionStart` event
- Loads `.claude/active-focus.md`
- Loads `.claude/plans/features/<feature>/constraints.md`
- Displays context in session preamble

**What gets loaded:**
- Current feature name and status
- Allowed scope (files/directories)
- Restrictions and constraints

## Hook System Architecture

### Hook Execution Flow

```
SessionStart → session-bootstrap.sh → Load context
     ↓
UserPrompt → inject-focus.sh → Inject active feature
     ↓
PreToolUse:Write → validate-tdd.sh → Check for tests (warning only)
                 → scope-check.sh → Check file scope
     ↓
[File Write Operation]
     ↓
PostToolUse:Write → post-write.sh → Post-write validations
                  → sync-state.sh → Update progress.md & state.json
     ↓
Stop → session-checkpoint.sh → Create snapshot
```

### Hook Guarantees

1. **Non-blocking:** Hooks execute with timeout (max 2s)
2. **Fail-safe:** Hooks exit gracefully if preconditions not met
3. **Idempotent:** Multiple executions produce consistent results
4. **Fast:** < 500ms for session-bootstrap, < 2s for checkpoint

## TypeScript Utilities

ADK v2 provides TypeScript utilities that hooks can leverage:

### `session-bootstrap.ts`
```typescript
import { loadSessionContext } from './src/utils/session-bootstrap'

const result = await loadSessionContext()
// Returns: { context: string, loaded: string[], warnings: string[] }
```

### `session-checkpoint.ts`
```typescript
import { createSessionCheckpoint } from './src/utils/session-checkpoint'

const result = await createSessionCheckpoint('feature-name')
// Returns: { snapshotCreated: boolean, snapshotPath?: string, ... }
```

### `tdd-validator.ts`
```typescript
import { validateTDD } from './src/utils/tdd-validator'

const result = await validateTDD('src/commands/feature.ts')
// Returns: { isValid: boolean, warnings: string[], testFile?: string }
```

### `state-sync-hook.ts`
```typescript
import { syncStateAfterWrite } from './src/utils/state-sync-hook'

const result = await syncStateAfterWrite('src/file.ts')
// Returns: { synced: boolean, filesUpdated: string[], errors: string[] }
```

## Best Practices

### For Developers

1. **Always write tests first** - Don't ignore TDD warnings
2. **Check active-focus.md** - Know which feature you're working on
3. **Stay within scope** - Respect constraint boundaries
4. **Review progress regularly** - Check `claude-progress.txt`

### For Long-Running Sessions

1. **Create checkpoints manually** when reaching milestones
2. **Use `--resume` flag** to continue interrupted work
3. **Monitor context size** - Checkpoints help prevent overflow
4. **Review snapshots** - Understand what was accomplished

## Configuration

### Settings Location
`.claude/settings.json`

### Registered Hooks

| Event | Hook | Purpose |
|-------|------|---------|
| SessionStart | session-bootstrap.sh | Load context |
| Stop | session-checkpoint.sh | Create checkpoint |
| UserPromptSubmit | inject-focus.sh | Inject focus |
| PreToolUse:Write | validate-tdd.sh | TDD validation |
| PreToolUse:Write | scope-check.sh | Scope validation |
| PostToolUse:Write | post-write.sh | Post-write checks |
| PostToolUse:Write | sync-state.sh | State sync |

### Disabling Hooks

To temporarily disable a hook:
```bash
# Comment out in .claude/settings.json
# { "type": "command", "command": ".claude/hooks/validate-tdd.sh" }
```

## Troubleshooting

### Hook not executing
- Check `.claude/settings.json` registration
- Verify hook file has execute permissions: `chmod +x .claude/hooks/*.sh`
- Check hook timeout (max 2s)

### TDD warnings too noisy
- Write tests first (best practice)
- Or temporarily disable validate-tdd.sh in settings.json

### State not syncing
- Ensure `.claude/active-focus.md` exists
- Check feature directory exists: `.claude/plans/features/<name>/`
- Verify `progress.md` has write permissions

## Testing

All hooks have corresponding TypeScript utility tests with >= 80% coverage:

```bash
npm test -- tests/utils/session-bootstrap.test.ts
npm test -- tests/utils/session-checkpoint.test.ts
npm test -- tests/utils/tdd-validator.test.ts
npm test -- tests/utils/state-sync-hook.test.ts
```

## Future Enhancements (Fase 1+)

- MCP Memory RAG for semantic search
- Context compaction for overflow prevention
- Constitution/Powers pattern for context optimization
- Git commits as natural checkpoints
- Circuit breaker for resilience
