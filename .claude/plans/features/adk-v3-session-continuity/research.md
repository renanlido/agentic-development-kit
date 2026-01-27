# Research: adk-v3-session-continuity

**Data:** 2026-01-25
**Status:** Complete
**Sprints Scope:** 0 (Setup) + 1 (Session Store)

---

## Current State Analysis

### Core Problem: Zero Context Continuity

The current ADK v2 has a fundamental architectural problem - **each phase execution creates an entirely new Claude session**, resulting in 0% context continuity between development phases.

```
Current Flow (Problematic):
adk feature research → Session 1 (knows PRD)
adk feature tasks    → Session 2 (lost research context)
adk feature plan     → Session 3 (lost tasks context)
adk feature implement → Session 4 (lost plan context)
adk feature qa       → Session 5 (lost implement context)
adk feature docs     → Session 6 (lost everything)
adk feature finish   → Session 7 (lost everything)

Result: 7 isolated sessions, 0% context continuity
```

### `executeClaudeCommand()` Analysis (src/utils/claude.ts:25-73)

```typescript
const result = spawnSync('claude', args, {
  input,
  encoding: 'utf-8',
  stdio: ['pipe', 'inherit', 'inherit'],  // Output goes to terminal!
})
return ''  // ALWAYS returns empty string!
```

**Problems identified:**
| Issue | Impact |
|-------|--------|
| Uses `spawnSync` (synchronous) | Blocking, no streaming support |
| `stdio: ['pipe', 'inherit', 'inherit']` | Cannot capture output |
| Returns empty string `''` | Cannot get Claude's response |
| No `--print-session-id` flag | Cannot track session IDs |
| No `--resume` support | Cannot resume sessions |
| Function marked `async` but is sync | Misleading API |

### StateManager Session Code (src/utils/state-manager.ts)

The StateManager has **complete session management code that is never used**:

```typescript
createSession(feature: string): Promise<string>       // Lines 352-386 - NEVER CALLED
updateSession(feature, sessionId, updates)            // Lines 388-412 - NEVER CALLED
endSession(feature, sessionId, reason)                // Lines 414-460 - NEVER CALLED
resumeFromSnapshot(feature, snapshotId?)              // Lines 462-499 - NEVER CALLED
listSessions(feature)                                 // Lines 289-332 - NEVER CALLED
getLatestSession(feature)                             // Lines 334-350 - NEVER CALLED
```

**Verification via grep:** No calls to these methods exist in any command file.

### Existing Session Types (src/types/session.ts)

Well-defined interfaces already exist:

```typescript
interface LongRunningSession {
  id: string
  feature: string
  startedAt: string
  lastActivity: string
  currentStep: string
  completedSteps: string[]
  pendingSteps: string[]
  contextSummary: string
  checkpoints: CheckpointRef[]
  status: SessionStatus  // 'active' | 'completed' | 'interrupted' | 'error'
}

interface SessionListItem {
  id: string
  feature: string
  startedAt: string
  endedAt: string | null
  duration: string
  status: SessionStatus
  stepsCompleted: number
  stepsTotal: number
}
```

---

## Similar Components

### StateManager (src/utils/state-manager.ts)
- Manages unified feature state
- Has session CRUD methods (unused)
- Integrates with context compactor
- Uses atomic writes (temp file → move pattern)
- Pattern to follow for SessionStore

### Session Checkpoint (src/utils/session-checkpoint.ts)
- Creates snapshots on session end
- Generates `claude-progress.txt`
- Stores in `.snapshots/` directory
- Good reference for checkpoint logic

### WorkflowCommand (src/commands/workflow.ts)
- Example of command class pattern
- Uses `ora` spinners
- Uses `logger` for output
- Calls `executeClaudeCommand()`
- Pattern to follow for feature-v3.ts

### ModelType Enum (src/types/model.ts)
```typescript
enum ModelType {
  OPUS = 'opus',
  SONNET = 'sonnet',
  HAIKU = 'haiku',
}
```
Will reuse in claude-v3.ts options.

---

## Technical Stack

| Technology | Version | Usage in v3 |
|------------|---------|-------------|
| Node.js | >= 18.0.0 | Runtime |
| TypeScript | >= 5.0.0 | Language |
| Commander.js | v14 | CLI parsing |
| fs-extra | v11 | File operations |
| chalk | v5 | Terminal colors |
| ora | v9 | Spinners |
| Jest | v30 | Testing |
| ts-jest | v29 | TS test transform |

### Build System
- TypeScript compiled to `dist/`
- Entry point: `dist/cli.js`
- New entry: `dist/cli-v3.js`
- Module: CommonJS

---

## Files to Create

### Sprint 0: Setup
- [ ] `src/cli-v3.ts` - v3 entry point with Commander
- [ ] `src/commands/feature-v3.ts` - Basic feature commands
- [ ] `src/utils/prompts/.gitkeep` - Directory for future prompts

### Sprint 1: Session Store
- [ ] `src/utils/session-store.ts` - Session persistence class
- [ ] `src/utils/claude-v3.ts` - Async Claude with session tracking
- [ ] `tests/utils/session-store.test.ts` - Unit tests
- [ ] `tests/utils/claude-v3.test.ts` - Unit tests

---

## Files to Modify

### Sprint 0
- [ ] `package.json` - Add scripts:
  ```json
  {
    "scripts": {
      "adk3": "node dist/cli-v3.js",
      "adk3:dev": "ts-node src/cli-v3.ts"
    }
  }
  ```

### DO NOT MODIFY (Critical Constraint)
- ❌ `src/cli.ts` - Frozen v2 CLI
- ❌ `src/commands/feature.ts` - Frozen v2 commands
- ❌ Any other v2 file

---

## Dependencies

### External (npm packages)
| Package | Already Installed | Purpose |
|---------|------------------|---------|
| commander | ✅ v14 | CLI parsing |
| fs-extra | ✅ v11 | File operations |
| chalk | ✅ v5 | Terminal colors |
| ora | ✅ v9 | Spinners |

**No new dependencies needed for Sprint 0-1.**

### Internal (modules to import)
```typescript
import { logger } from '../utils/logger'
import { ModelType } from '../types/model'
import type { LongRunningSession, SessionListItem } from '../types/session'
```

---

## Risks

### R1: Accidental v2 Modification
- **Risk:** Developer modifies cli.ts or feature.ts
- **Impact:** HIGH - Could break production workflows
- **Mitigation:**
  - Add CI check: `git diff src/cli.ts src/commands/feature.ts` must be empty
  - Document constraint prominently

### R2: npm link During Development
- **Risk:** Developer runs `npm link` to test
- **Impact:** HIGH - Could override working v2 binary
- **Mitigation:**
  - Document: Use `npm run adk3` only
  - Never run `npm link` until v3 validated

### R3: Claude CLI Flag Changes
- **Risk:** `--print-session-id` or `--resume` behavior changes
- **Impact:** MEDIUM - Session tracking would break
- **Mitigation:**
  - Isolate parsing in dedicated function
  - Add integration tests
  - Monitor Claude CLI changelog

### R4: Session ID Not Persistent
- **Risk:** Claude sessions may expire or not support resume
- **Impact:** MEDIUM - Core feature wouldn't work
- **Mitigation:**
  - Test with real Claude CLI before implementing
  - Verify `--resume` functionality manually

### R5: Performance with Many Sessions
- **Risk:** Slow reads with 100+ session files
- **Impact:** LOW - Unlikely scenario
- **Mitigation:**
  - Implement session cleanup (>30 days)
  - Use `current.json` for active session

---

## Patterns to Follow

### 1. Command Class Pattern (from workflow.ts)
```typescript
class FeatureV3Command {
  async status(name: string): Promise<void> {
    const spinner = ora('Loading feature status...').start()
    try {
      // ... implementation
      spinner.succeed('Status loaded')
    } catch (error) {
      spinner.fail('Error loading status')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const featureV3Command = new FeatureV3Command()
```

### 2. Atomic Write Pattern (from state-manager.ts)
```typescript
const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)
await fs.writeJSON(tempPath, data, { spaces: 2 })
await fs.move(tempPath, targetPath, { overwrite: true })
```

### 3. Test Structure (from state-manager-sessions.test.ts)
```typescript
describe('SessionStore', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('save', () => {
    it('should persist session to disk', async () => {
      // Arrange, Act, Assert
    })
  })
})
```

### 4. Path Resolution Pattern (from state-manager.ts)
```typescript
private getBasePath(): string {
  if (process.env.TEST_FEATURE_PATH) {
    return process.env.TEST_FEATURE_PATH
  }
  return process.cwd()
}
```

---

## Performance Considerations

### File I/O
- **Requirement:** Session read/write < 50ms
- **Approach:**
  - Single JSON file per session
  - Atomic writes via temp file
  - Keep `current.json` for active session (fast lookup)

### Session Cleanup
- Sessions older than 30 days should be prunable
- Mark old sessions as `resumable: false`
- History folder for completed sessions

### Memory Usage
- Load sessions on-demand
- Don't cache all sessions in memory
- Stream large outputs if needed

---

## Security Considerations

### Data at Rest
- Sessions stored in `.claude/` directory
- No sensitive data in session metadata
- Session IDs are timestamps, not secrets

### Command Injection
- Validate feature names (alphanumeric + hyphens only)
- Never interpolate user input into shell commands
- Use argument arrays, not string concatenation

### File Path Security
- Validate paths stay within project directory
- Use `path.join()` for all path construction
- No user-controlled path segments

---

## API Design (Sprint 1)

### SessionStore Interface
```typescript
interface SessionInfo {
  id: string
  feature: string
  startedAt: string
  lastActivity: string
  status: 'active' | 'completed' | 'interrupted'
  resumable: boolean
}

class SessionStore {
  async save(feature: string, session: SessionInfo): Promise<void>
  async get(feature: string): Promise<SessionInfo | null>
  async getLatest(feature: string): Promise<SessionInfo | null>
  async list(feature: string): Promise<SessionInfo[]>
  async update(feature: string, sessionId: string, updates: Partial<SessionInfo>): Promise<void>
  async clear(feature: string): Promise<void>
}
```

### ClaudeV3 Interface
```typescript
interface ClaudeV3Options {
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string        // Session ID to resume
  printSessionId?: boolean
  timeout?: number       // ms, default 300000 (5min)
}

interface ClaudeV3Result {
  output: string
  sessionId: string | null
  exitCode: number
  duration: number       // ms
}

async function executeClaudeCommandV3(
  prompt: string,
  options?: ClaudeV3Options
): Promise<ClaudeV3Result>

function parseSessionId(output: string): string | null
```

---

## Directory Structure After Sprint 1

```
src/
├── cli.ts              # v2 CLI (FROZEN)
├── cli-v3.ts           # v3 CLI entry point
├── commands/
│   ├── feature.ts      # v2 commands (FROZEN)
│   └── feature-v3.ts   # v3 commands
└── utils/
    ├── claude.ts       # v2 Claude executor (FROZEN)
    ├── claude-v3.ts    # v3 with session tracking
    ├── session-store.ts # Session persistence
    └── prompts/        # Future: prompt templates
        └── .gitkeep

tests/
└── utils/
    ├── session-store.test.ts
    └── claude-v3.test.ts

.claude/plans/features/{feature-name}/sessions/
├── current.json        # Active session
└── history/
    └── session-YYYYMMDD-HHMMSS.json
```

---

## Validation Checklist

### Sprint 0 Complete When:
- [ ] `npm run build` compiles `cli-v3.ts` without errors
- [ ] `npm run adk3 -- --version` shows version
- [ ] `npm run adk3 -- --help` shows help
- [ ] `npm run adk3 -- feature status test` executes (even without sessions)
- [ ] `git diff src/cli.ts` returns empty
- [ ] `git diff src/commands/feature.ts` returns empty

### Sprint 1 Complete When:
- [ ] SessionStore saves session correctly
- [ ] SessionStore retrieves session by feature
- [ ] SessionStore lists history
- [ ] executeClaudeCommandV3 uses async spawn
- [ ] executeClaudeCommandV3 captures output
- [ ] executeClaudeCommandV3 extracts session ID
- [ ] executeClaudeCommandV3 supports --resume
- [ ] Test coverage >= 80%
- [ ] `npm test` passes
- [ ] No v2 files modified

---

## References

- PRD: `.claude/plans/features/adk-v3-session-continuity/prd.md`
- Context docs: `.claude/docs/v3-planning/`
- Existing session code: `src/utils/state-manager.ts:284-500`
- Session types: `src/types/session.ts`
- Test examples: `tests/utils/state-manager-sessions.test.ts`
