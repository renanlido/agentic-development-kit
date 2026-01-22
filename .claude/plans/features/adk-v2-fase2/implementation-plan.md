# Implementation Plan: adk-v2-fase2

**Feature:** Session Management for Long-Running Agents
**Date:** 2026-01-21
**Status:** Planning Complete
**Estimated Effort:** 34 Story Points (8-13 days)

---

## Executive Summary

This plan implements a comprehensive session management system that enables:
- **Automatic checkpoints** when sessions end
- **Resume functionality** via `--resume` flag
- **Plain-text handoff documents** (claude-progress.txt)
- **Session history** per feature

The implementation extends existing infrastructure (StateManager, SnapshotManager, HistoryTracker) following the principle of composition over new classes.

---

## Implementation Phases

### Phase 1: Foundation - Types & Core Infrastructure
**Objective:** Establish TypeScript types and extend StateManager with session-related methods
**Story Points:** 8
**Priority:** Critical Path

#### Files to Create

| File | Purpose | Lines Est. |
|------|---------|------------|
| `src/types/session.ts` | Session-related TypeScript interfaces | ~60 |

#### Files to Modify

| File | Changes | Lines Est. |
|------|---------|------------|
| `src/utils/state-manager.ts` | Add session methods | +180-200 |
| `src/types/index.ts` | Export session types | +5 |

#### Implementation Details

**1.1 Create `src/types/session.ts`**
```typescript
export interface LongRunningSession {
  id: string
  feature: string
  startedAt: string
  lastActivity: string
  currentStep: string
  completedSteps: string[]
  pendingSteps: string[]
  contextSummary: string
  checkpoints: CheckpointRef[]
  status: SessionStatus
}

export type SessionStatus = 'active' | 'completed' | 'interrupted' | 'error'

export interface CheckpointRef {
  id: string
  createdAt: string
  step: string
  trigger: CheckpointReason
  commitHash?: string
  snapshotPath: string
}

export type CheckpointReason =
  | 'manual'
  | 'step_complete'
  | 'context_warning'
  | 'error_recovery'
  | 'time_limit'
  | 'task_complete'
  | 'session_end'

export interface SessionListItem {
  id: string
  feature: string
  startedAt: string
  endedAt: string | null
  duration: string
  status: SessionStatus
  stepsCompleted: number
  stepsTotal: number
}

export interface HandoffDocument {
  current: string
  done: string[]
  inProgress: string[]
  next: string[]
  files: string[]
  issues: string
}
```

**1.2 Extend StateManager Methods**

Add to `src/utils/state-manager.ts`:
- `getSessionsPath(feature: string): string`
- `listSessions(feature: string): Promise<SessionListItem[]>`
- `getLatestSession(feature: string): Promise<LongRunningSession | null>`
- `createSession(feature: string): Promise<string>`
- `updateSession(feature: string, sessionId: string, updates: Partial<LongRunningSession>): Promise<void>`
- `endSession(feature: string, sessionId: string, reason: CheckpointReason): Promise<void>`
- `resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState>`

#### Tests Required

| Test File | Coverage |
|-----------|----------|
| `tests/types/session.test.ts` | Type validation |
| `tests/utils/state-manager-sessions.test.ts` | New StateManager methods |

**Test Cases:**
1. `listSessions()` - empty, single, multiple sessions
2. `getLatestSession()` - no sessions, with sessions, multiple sessions
3. `createSession()` - creates session with correct structure
4. `updateSession()` - updates existing session, handles missing session
5. `endSession()` - marks session as ended, creates checkpoint
6. `resumeFromSnapshot()` - restores state, handles missing snapshot

#### Acceptance Criteria

- [ ] All session types are exported and documented
- [ ] StateManager correctly creates session entries in `sessions/` folder
- [ ] `listSessions()` returns sorted list by date (newest first)
- [ ] `getLatestSession()` correctly identifies interrupted sessions
- [ ] `resumeFromSnapshot()` loads state from specified or latest snapshot
- [ ] Atomic file writes using temp file pattern
- [ ] Thread-safe operations using mutex pattern from HistoryTracker

#### Dependencies

- `src/utils/snapshot-manager.ts` (existing)
- `src/utils/history-tracker.ts` (existing)
- `src/types/progress-sync.ts` (existing)

---

### Phase 2: Handoff Document System
**Objective:** Implement plain-text handoff document generation per Anthropic recommendation
**Story Points:** 5
**Priority:** Critical Path

#### Files to Create

| File | Purpose | Lines Est. |
|------|---------|------------|
| `templates/claude-progress.txt` | Template for handoff document | ~30 |

#### Files to Modify

| File | Changes | Lines Est. |
|------|---------|------------|
| `src/utils/state-manager.ts` | Add handoff methods | +80-100 |
| `src/utils/session-checkpoint.ts` | Extend handoff format | +40-60 |

#### Implementation Details

**2.1 Create Template `templates/claude-progress.txt`**
```
CURRENT: [current task description] ([progress]% complete)

DONE:
[completed tasks list]

IN PROGRESS:
[tasks currently being worked on]

NEXT:
[numbered list of next tasks]

FILES: [comma-separated list of modified files]

ISSUES: [blocking issues or "None blocking"]
```

**2.2 Add Methods to StateManager**
- `createHandoffDocument(feature: string): Promise<string>`
- `parseHandoffDocument(content: string): HandoffDocument`
- `createContextSummary(feature: string): Promise<string>`

**2.3 Update `session-checkpoint.ts`**

Enhance `generateProgressText()` to use new format:
- Extract completed tasks from state.json
- Extract in-progress tasks
- Calculate next tasks
- List recently modified files
- Include any blocking issues

#### Tests Required

| Test File | Coverage |
|-----------|----------|
| `tests/utils/handoff-document.test.ts` | Handoff generation and parsing |

**Test Cases:**
1. `createHandoffDocument()` - generates correct format
2. `parseHandoffDocument()` - parses valid document
3. `parseHandoffDocument()` - tolerant to malformed input
4. `createContextSummary()` - generates concise summary
5. Integration with existing checkpoint system

#### Acceptance Criteria

- [ ] `claude-progress.txt` follows plain-text format (not JSON)
- [ ] Sections clearly delimited (CURRENT, DONE, IN PROGRESS, NEXT, FILES, ISSUES)
- [ ] Document is human-readable without tools
- [ ] Parser is tolerant to manual edits
- [ ] Falls back to state.json if document is corrupted
- [ ] Generation completes in < 300ms

#### Dependencies

- Phase 1 completion (types and base methods)
- `src/utils/task-parser.ts` (existing)

---

### Phase 3: CLI Integration - Resume Functionality
**Objective:** Add `--resume` flag to agent and feature commands
**Story Points:** 8
**Priority:** Critical Path

#### Files to Modify

| File | Changes | Lines Est. |
|------|---------|------------|
| `src/commands/agent.ts` | Add `--resume` flag to run command | +60-80 |
| `src/commands/feature.ts` | Add `--resume` flag to implement | +50-70 |
| `src/cli.ts` | Register new options | +10-15 |

#### Implementation Details

**3.1 Modify `agent.ts` - Add Resume to Run**

```typescript
async run(name: string, options: AgentOptions): Promise<void> {
  // If --resume flag is set
  if (options.resume) {
    const session = await stateManager.getLatestSession(options.feature)
    if (session && session.status === 'interrupted') {
      // Load handoff document
      const handoff = await stateManager.loadHandoffDocument(options.feature)
      // Inject context into prompt
      context = this.buildResumeContext(session, handoff)
    } else {
      logger.warn('No interrupted session found. Starting fresh.')
    }
  }
  // ... existing run logic
}
```

**3.2 Add Session Detection**

When running without `--resume`, detect if there's a pending session:
```typescript
const pendingSession = await stateManager.getLatestSession(feature)
if (pendingSession && pendingSession.status === 'interrupted') {
  console.log(chalk.yellow('Interrupted session found.'))
  console.log(chalk.gray(`  Last activity: ${pendingSession.lastActivity}`))
  console.log(chalk.gray(`  Progress: ${pendingSession.completedSteps.length}/${pendingSession.completedSteps.length + pendingSession.pendingSteps.length}`))
  // Suggest using --resume
}
```

**3.3 Modify `feature.ts` - Add Resume to Implement**

Follow existing `askToResume` pattern but integrate with session system:
- Check for existing session
- Load handoff document
- Inject context into implementation prompt

#### Tests Required

| Test File | Coverage |
|-----------|----------|
| `tests/commands/agent-resume.test.ts` | Agent resume functionality |
| `tests/commands/feature-resume.test.ts` | Feature resume functionality |

**Test Cases:**
1. `adk agent run <name> --resume` - with interrupted session
2. `adk agent run <name> --resume` - without session (graceful fallback)
3. `adk feature implement <name> --resume` - resumes correctly
4. Session detection when running without `--resume`
5. Context injection includes handoff document

#### Acceptance Criteria

- [ ] `--resume` flag is available on `adk agent run`
- [ ] `--resume` flag is available on `adk feature implement`
- [ ] Running without `--resume` suggests it when session exists
- [ ] Resume correctly loads handoff document
- [ ] Resume injects context summary into prompt
- [ ] Clear CLI messages indicate resume vs fresh start

#### Dependencies

- Phase 1 (session types and methods)
- Phase 2 (handoff document)
- `src/utils/claude.ts` (existing)

---

### Phase 4: CLI Integration - Sessions Command
**Objective:** Implement `adk agent sessions` command for listing and viewing sessions
**Story Points:** 5
**Priority:** High

#### Files to Modify

| File | Changes | Lines Est. |
|------|---------|------------|
| `src/commands/agent.ts` | Add sessions subcommand | +80-100 |
| `src/cli.ts` | Register sessions command | +15-20 |

#### Implementation Details

**4.1 Add Sessions Subcommand to `agent.ts`**

```typescript
async sessions(feature: string, options: SessionOptions): Promise<void> {
  const spinner = ora('Loading sessions...').start()

  try {
    const sessions = await stateManager.listSessions(feature)

    if (sessions.length === 0) {
      spinner.info('No sessions found for this feature')
      return
    }

    if (options.latest) {
      const latest = sessions[0]
      this.displaySessionDetails(latest)
    } else if (options.id) {
      const session = sessions.find(s => s.id === options.id)
      if (!session) {
        spinner.fail(`Session ${options.id} not found`)
        return
      }
      this.displaySessionDetails(session)
    } else {
      this.displaySessionTable(sessions)
    }

    spinner.stop()
  } catch (error) {
    spinner.fail('Error loading sessions')
    logger.error(error instanceof Error ? error.message : String(error))
  }
}
```

**4.2 Display Format**

Table format for list:
```
Sessions for feature: auth-feature

ID                          Started              Duration    Status       Progress
──────────────────────────────────────────────────────────────────────────────────
session-20260122-143000     2026-01-22 14:30     2h 15m      interrupted  5/8 (62%)
session-20260122-103000     2026-01-22 10:30     1h 45m      completed    8/8 (100%)

Use: adk agent run <name> --resume to continue the latest session
```

**4.3 Register in CLI**

```typescript
program
  .command('agent')
  .command('sessions <feature>')
  .description('List sessions for a feature')
  .option('--latest', 'Show details of latest session')
  .option('--id <id>', 'Show details of specific session')
  .action((feature, options) => agentCommand.sessions(feature, options))
```

#### Tests Required

| Test File | Coverage |
|-----------|----------|
| `tests/commands/agent-sessions.test.ts` | Sessions command |

**Test Cases:**
1. `adk agent sessions <feature>` - empty list
2. `adk agent sessions <feature>` - with sessions
3. `adk agent sessions <feature> --latest` - shows details
4. `adk agent sessions <feature> --id <id>` - shows specific session
5. Output format matches specification

#### Acceptance Criteria

- [ ] `adk agent sessions <feature>` lists all sessions
- [ ] `--latest` flag shows detailed view of most recent session
- [ ] `--id` flag allows viewing specific session
- [ ] Table output is properly formatted
- [ ] Includes helpful message about resuming
- [ ] Command completes in < 100ms

#### Dependencies

- Phase 1 (session types and listSessions method)

---

### Phase 5: Task-Complete Hook
**Objective:** Implement hook for granular checkpoints on task completion
**Story Points:** 3
**Priority:** Medium

#### Files to Create

| File | Purpose | Lines Est. |
|------|---------|------------|
| `.claude/hooks/task-complete.sh` | Hook script | ~40 |
| `templates/claude-structure/hooks/task-complete.sh` | Template for new projects | ~40 |

#### Files to Modify

| File | Changes | Lines Est. |
|------|---------|------------|
| `.claude/settings.json` | Register hook | +5 |

#### Implementation Details

**5.1 Create `.claude/hooks/task-complete.sh`**

```bash
#!/bin/bash

FEATURE_NAME="$1"
TASK_NAME="$2"
COMMIT_MESSAGE="$3"

if [ -z "$FEATURE_NAME" ]; then
  echo "Error: Feature name required"
  exit 1
fi

FEATURE_DIR=".claude/plans/features/$FEATURE_NAME"

if [ ! -d "$FEATURE_DIR" ]; then
  echo "Error: Feature directory not found"
  exit 1
fi

# Update claude-progress.txt
node -e "
const fs = require('fs-extra');
const path = require('path');

async function updateProgress() {
  const progressPath = path.join('$FEATURE_DIR', 'claude-progress.txt');
  const statePath = path.join('$FEATURE_DIR', 'state.json');

  // Load current state
  const state = await fs.readJSON(statePath);

  // Mark task as completed
  const task = state.tasks.find(t => t.name === '$TASK_NAME');
  if (task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
  }

  // Save state
  await fs.writeJSON(statePath, state, { spaces: 2 });

  console.log('Task marked as completed: $TASK_NAME');
}

updateProgress().catch(console.error);
"

# Create commit if there are staged changes
if git diff --cached --quiet; then
  echo "No staged changes, skipping commit"
else
  git commit -m "${COMMIT_MESSAGE:-feat: complete task $TASK_NAME}"
  echo "Commit created for task: $TASK_NAME"
fi

echo "✓ Task checkpoint created"
```

**5.2 Register Hook in Settings**

Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "task-complete": {
      "script": ".claude/hooks/task-complete.sh",
      "description": "Create checkpoint when task is completed"
    }
  }
}
```

#### Tests Required

| Test File | Coverage |
|-----------|----------|
| `tests/hooks/task-complete.test.ts` | Hook functionality |

**Test Cases:**
1. Hook updates state.json correctly
2. Hook creates commit when changes are staged
3. Hook handles missing feature gracefully
4. Hook updates claude-progress.txt

#### Acceptance Criteria

- [ ] Hook script is executable
- [ ] Hook updates task status in state.json
- [ ] Hook creates git commit when changes exist
- [ ] Hook fails gracefully with missing feature
- [ ] Hook completes in < 200ms
- [ ] Template is included for new projects

#### Dependencies

- Phase 1 (session types)
- Phase 2 (handoff document)

---

### Phase 6: Testing & Quality Assurance
**Objective:** Comprehensive test coverage and integration testing
**Story Points:** 5
**Priority:** Critical

#### Files to Create

| File | Purpose | Lines Est. |
|------|---------|------------|
| `tests/utils/session-management.test.ts` | Unit tests | ~300 |
| `tests/commands/agent-sessions.test.ts` | CLI integration | ~200 |
| `tests/e2e/session-lifecycle.test.ts` | E2E scenarios | ~250 |

#### Test Scenarios

**Unit Tests (session-management.test.ts)**

```typescript
describe('StateManager - Session Methods', () => {
  describe('listSessions()', () => {
    it('returns empty array when no sessions exist')
    it('returns sessions sorted by date descending')
    it('handles corrupted session files gracefully')
  })

  describe('getLatestSession()', () => {
    it('returns null when no sessions')
    it('returns most recent session')
    it('identifies interrupted sessions correctly')
  })

  describe('createSession()', () => {
    it('creates session with correct ID format')
    it('initializes all required fields')
    it('stores in correct directory')
  })

  describe('resumeFromSnapshot()', () => {
    it('restores state from specified snapshot')
    it('uses latest snapshot when none specified')
    it('throws when snapshot not found')
    it('preserves session continuity')
  })

  describe('createHandoffDocument()', () => {
    it('generates valid plain-text format')
    it('includes all sections')
    it('calculates progress correctly')
  })

  describe('parseHandoffDocument()', () => {
    it('parses valid document')
    it('tolerates malformed sections')
    it('returns default on complete corruption')
  })
})
```

**Integration Tests (agent-sessions.test.ts)**

```typescript
describe('adk agent sessions', () => {
  it('lists sessions in table format')
  it('shows helpful message when empty')
  it('--latest shows detailed view')
  it('--id shows specific session')
})

describe('adk agent run --resume', () => {
  it('loads context from interrupted session')
  it('injects handoff document')
  it('warns when no session exists')
  it('suggests --resume when session detected')
})
```

**E2E Tests (session-lifecycle.test.ts)**

```typescript
describe('Session Lifecycle E2E', () => {
  it('full session: start → checkpoint → resume → complete')
  it('interrupted session recovery')
  it('multiple sessions for same feature')
  it('backward compatibility with pre-v2 features')
  it('concurrent session protection')
})
```

#### Acceptance Criteria

- [ ] Unit test coverage >= 80%
- [ ] All edge cases covered (empty, corrupted, missing files)
- [ ] Integration tests pass for all CLI commands
- [ ] E2E tests cover full session lifecycle
- [ ] No regressions in existing tests
- [ ] Performance tests validate timing requirements

#### Dependencies

- All previous phases

---

### Phase 7: Documentation & Finalization
**Objective:** Update documentation and finalize release
**Story Points:** 2
**Priority:** High

#### Files to Modify

| File | Changes | Lines Est. |
|------|---------|------------|
| `CLAUDE.md` | Document session management | +50-80 |
| `.claude/docs/session-management.md` | Detailed documentation | +200 |

#### Documentation Updates

**7.1 Update CLAUDE.md**

Add to Quick Reference section:
```markdown
### Session Management
```bash
adk agent sessions <feature>           # List sessions
adk agent sessions <feature> --latest  # Latest session details
adk agent run <name> --resume          # Resume interrupted session
adk feature implement <name> --resume  # Resume feature implementation
```

Sessions are stored in `.claude/plans/features/<name>/sessions/` with handoff documents in `claude-progress.txt`.
```

**7.2 Create `.claude/docs/session-management.md`**

Comprehensive documentation:
- Overview and rationale
- How sessions work
- CLI command reference
- Handoff document format
- Troubleshooting guide
- API reference for StateManager methods

#### Acceptance Criteria

- [ ] CLAUDE.md updated with session commands
- [ ] Detailed documentation in .claude/docs/
- [ ] Examples for all new commands
- [ ] Troubleshooting section included
- [ ] API documentation for new methods

#### Dependencies

- All previous phases complete

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION SEQUENCE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Foundation (8 SP)                                             │
│  ├─ src/types/session.ts                                                │
│  └─ src/utils/state-manager.ts extensions                               │
│       │                                                                  │
│       ▼                                                                  │
│  Phase 2: Handoff Document (5 SP)                                       │
│  ├─ templates/claude-progress.txt                                       │
│  └─ createHandoffDocument() methods                                     │
│       │                                                                  │
│       ├─────────────────────────────────────┐                           │
│       ▼                                     ▼                           │
│  Phase 3: Resume CLI (8 SP)         Phase 4: Sessions CLI (5 SP)        │
│  ├─ --resume flag                   └─ adk agent sessions               │
│  └─ Session detection                                                   │
│       │                                     │                           │
│       └─────────────────┬───────────────────┘                           │
│                         ▼                                               │
│  Phase 5: Task-Complete Hook (3 SP)                                     │
│  └─ .claude/hooks/task-complete.sh                                      │
│       │                                                                  │
│       ▼                                                                  │
│  Phase 6: Testing (5 SP)                                                │
│  ├─ Unit tests                                                          │
│  ├─ Integration tests                                                   │
│  └─ E2E tests                                                           │
│       │                                                                  │
│       ▼                                                                  │
│  Phase 7: Documentation (2 SP)                                          │
│  └─ CLAUDE.md + detailed docs                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Verification Checkpoints

### Checkpoint 1: After Phase 1
**Criteria:**
- [ ] All session types compile without errors
- [ ] StateManager methods return correct data structures
- [ ] Unit tests for new methods pass
- [ ] Atomic file operations verified

**Verification Command:**
```bash
npm run type-check && npm test -- tests/utils/state-manager-sessions.test.ts
```

### Checkpoint 2: After Phase 2
**Criteria:**
- [ ] claude-progress.txt generates in correct format
- [ ] Parser handles edge cases
- [ ] Integration with session-checkpoint.ts verified

**Verification Command:**
```bash
npm test -- tests/utils/handoff-document.test.ts
adk feature status my-feature  # Verify format
```

### Checkpoint 3: After Phase 3 + 4
**Criteria:**
- [ ] `adk agent run --resume` works end-to-end
- [ ] `adk agent sessions` displays correctly
- [ ] Session detection prompts user correctly

**Verification Command:**
```bash
npm test -- tests/commands/agent-*.test.ts
adk agent sessions test-feature  # Manual verification
```

### Checkpoint 4: After Phase 5
**Criteria:**
- [ ] Hook executes without errors
- [ ] state.json updated correctly
- [ ] Commits created when appropriate

**Verification Command:**
```bash
npm test -- tests/hooks/task-complete.test.ts
```

### Checkpoint 5: Final Verification
**Criteria:**
- [ ] All tests pass: `npm test`
- [ ] Coverage >= 80%: `npm run test:coverage`
- [ ] Lint passes: `npm run check`
- [ ] Type-check passes: `npm run type-check`
- [ ] E2E scenarios complete successfully

**Verification Command:**
```bash
npm run check && npm run type-check && npm run test:coverage
```

---

## Testing Strategy

### Test Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  5%  - Full lifecycle tests
                    │   Tests     │
                    └─────────────┘
               ┌─────────────────────┐
               │   Integration       │  25% - CLI command tests
               │      Tests          │
               └─────────────────────┘
          ┌─────────────────────────────┐
          │        Unit Tests           │  70% - StateManager, parsers
          │                             │
          └─────────────────────────────┘
```

### Coverage Targets

| Module | Target |
|--------|--------|
| `src/types/session.ts` | 100% |
| `src/utils/state-manager.ts` (new methods) | 90% |
| `src/commands/agent.ts` (new methods) | 85% |
| `src/commands/feature.ts` (resume) | 85% |
| Overall new code | >= 80% |

### Test Data

Create fixtures in `tests/fixtures/sessions/`:
- `valid-session.json` - Complete session with all fields
- `interrupted-session.json` - Session with interrupted status
- `corrupted-session.json` - Malformed JSON for error handling
- `claude-progress-valid.txt` - Valid handoff document
- `claude-progress-malformed.txt` - For parser testing

---

## Risk Mitigation

### R1: StateManager Method Conflicts
**Status:** Medium probability, High impact
**Mitigation:**
- Add methods incrementally
- Extensive integration tests
- Review dependencies before each change

### R2: claude-progress.txt Corruption
**Status:** Medium probability, Medium impact
**Mitigation:**
- Tolerant parser implementation
- Fallback to state.json
- Validation before loading

### R3: Stop Hook Not Executing
**Status:** Low probability, High impact
**Mitigation:**
- Periodic checkpoint in long operations
- Detect incomplete session on start
- Auto-recovery mechanism

### R4: Session Storage Growth
**Status:** Low probability, Medium impact
**Mitigation:**
- Default limit of 10 sessions
- Auto-prune via SnapshotManager pattern
- Lazy loading of session details

### R5: Backward Compatibility
**Status:** Medium probability, Medium impact
**Mitigation:**
- StateManager handles missing files
- Create default state on first access
- Migration on first session start

### R6: Race Conditions
**Status:** Low probability, High impact
**Mitigation:**
- Use mutex pattern from HistoryTracker
- Atomic file writes with temp + rename
- File locking for concurrent access

---

## Performance Requirements

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Checkpoint creation | < 200ms | `console.time()` in tests |
| Session resume | < 500ms | CLI measurement |
| Session listing | < 100ms | CLI measurement |
| Handoff generation | < 300ms | Unit test |

---

## Summary

**Total Story Points:** 34
**Estimated Duration:** 8-13 days
**New Files:** 7
**Modified Files:** 8
**Test Files:** 4
**New Code Lines:** ~500-600

### Critical Success Factors

1. **Extend, don't duplicate:** Use composition with existing StateManager, SnapshotManager, HistoryTracker
2. **Plain-text handoff:** Follow Anthropic recommendation for token efficiency
3. **Atomic operations:** All file writes use temp + rename pattern
4. **Thread safety:** Mutex for concurrent operations
5. **Graceful degradation:** Handle corrupted files without crashing

### Definition of Done

- [ ] All phases implemented
- [ ] All checkpoints verified
- [ ] Test coverage >= 80%
- [ ] Documentation complete
- [ ] Zero regressions
- [ ] Code review approved
