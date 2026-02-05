# Research: v3-version

**Date:** 2026-02-02
**Status:** Complete
**Researcher:** Claude Opus 4.5

---

## Current State Analysis

### v2 Architecture Overview

ADK v2 is a CLI toolkit implementing the CADD framework with **7 separate commands** for feature development:

| Command | Purpose |
|---------|---------|
| `adk feature new` | Create feature structure |
| `adk feature research` | Research phase |
| `adk feature plan` | Planning phase |
| `adk feature implement` | Implementation phase |
| `adk feature qa` | Quality assurance |
| `adk feature docs` | Documentation |
| `adk feature finish` | Complete feature |

**Problems with v2:**
- **Context Loss**: ~0% context preserved between commands
- **Decision Paralysis**: User must decide which command to run
- **Premature Completion**: ~40% of features left incomplete
- **Manual Recovery**: No automatic recovery after crashes
- **Stub Rate**: ~20% of generated code is placeholder

### Existing Infrastructure (Reusable)

The codebase already has substantial foundation for v3:

| Component | Location | Lines | v3 Readiness |
|-----------|----------|-------|--------------|
| Session Store | `src/utils/session-store.ts` | 149 | ✅ Complete |
| Claude v3 Execution | `src/utils/claude-v3.ts` | 190 | ✅ Complete |
| Session Types | `src/types/session-v3.ts` | 59 | ✅ Complete |
| Tiered Memory | `src/utils/tiered-memory.ts` | 233 | ✅ Complete |
| Context Compactor | `src/utils/context-compactor.ts` | 502 | ✅ Complete |
| State Manager | `src/utils/state-manager.ts` | 764 | ✅ Complete |
| CLI v3 Entry | `src/cli-v3.ts` | 27 | 🔶 Scaffold only |
| Feature v3 Command | `src/commands/feature-v3.ts` | 95 | 🔶 Status only |

### Parallel Execution System (Already Implemented)

v2 already has sophisticated parallel execution:

| File | Purpose | Lines |
|------|---------|-------|
| `src/utils/orchestrator.ts` | Wave orchestration | 336 |
| `src/utils/wave-executor.ts` | Wave execution | ~300 |
| `src/utils/wave-scheduler.ts` | Task scheduling | ~250 |
| `src/utils/parallel-executor.ts` | Agent execution | ~400 |
| `src/utils/parallel-display.ts` | Real-time TUI | 389 |

### Hook System (Partially Implemented)

| Hook | File | Status |
|------|------|--------|
| `inject-memory.sh` | `.claude/hooks/` | ✅ Exists, injects core-state and anti-stub rules |
| `auto-checkpoint.sh` | `.claude/hooks/` | ✅ Exists, creates checkpoint on session end |
| `mark-task.sh` | `.claude/hooks/` | ✅ Exists |
| `validate-no-stub.sh` | `.claude/hooks/` | ❌ Not yet implemented |
| `comprehension-check.sh` | `.claude/hooks/` | ❌ Not yet implemented |

---

## Similar Components

### Session Store Pattern (`src/utils/session-store.ts`)

The existing session store provides a complete implementation:

```typescript
export class SessionStore {
  async save(feature: string, session: SessionInfoV3): Promise<void>
  async get(feature: string): Promise<SessionInfoV3 | null>
  async list(feature: string): Promise<SessionInfoV3[]>
  async update(feature: string, sessionId: string, updates): Promise<void>
  async isResumable(feature: string): Promise<boolean>
}
```

Key patterns:
- Atomic writes via temp file + move
- 24-hour resumability window
- History directory for session archive
- Path validation to prevent traversal

### Claude v3 Execution Pattern (`src/utils/claude-v3.ts`)

```typescript
export async function executeClaudeCommandV3(
  prompt: string,
  options: ClaudeV3Options
): Promise<ClaudeV3Result>

export async function executeWithSessionTracking(
  feature: string,
  prompt: string,
  options: ClaudeV3Options
): Promise<ClaudeV3Result>
```

Key patterns:
- Async spawn with stdout/stderr capture
- Session ID extraction via regex
- Automatic resume detection
- Configurable timeout (default 5 min)
- Output streaming callback

### State Manager Pattern (`src/utils/state-manager.ts`)

Manages unified feature state from multiple sources:

```typescript
class StateManager {
  async loadUnifiedState(feature): UnifiedFeatureState
  async saveUnifiedState(feature, state): Promise<void>
  async getContextStatus(feature): ContextStatus
  async triggerCompaction(feature, level?): CompactionResult
  async createHandoffDocument(feature): string
}
```

Key patterns:
- Merges progress.md + tasks.md into unified state
- Token usage tracking integrated
- Compaction triggers at thresholds (70%, 85%, 95%)
- Handoff document generation for context overflow

### Tiered Memory Pattern (`src/utils/tiered-memory.ts`)

Implements 4-tier memory hierarchy:

```typescript
interface MemoryHierarchy {
  session: SessionMemory      // Tier 1: Always present
  phase?: TieredMemory        // Tier 2: Per phase
  feature?: TieredMemory      // Tier 3: Per feature
  project?: TieredMemory      // Tier 4: Global
}
```

Key patterns:
- Priority-based flattening (session > phase > feature > project)
- Line deduplication across tiers
- Freshness scoring (decay over 30 days)
- Lazy loading with session-level caching

---

## Technical Stack

### Dependencies (Already Present)

| Package | Version | Usage in v3 |
|---------|---------|-------------|
| `commander` | v14.0.2 | CLI parsing |
| `inquirer` | v13.2.0 | Interactive prompts |
| `ora` | v9.0.0 | Spinners |
| `chalk` | v5.6.2 | Terminal colors |
| `fs-extra` | v11.3.3 | File operations |
| `tiktoken` | v1.0.22 | Token counting |
| `simple-git` | v3.30.0 | Git operations |
| `fuse.js` | v7.1.0 | Fuzzy search (memory fallback) |
| `zod` | v4.3.5 | Schema validation |

### Dependencies (To Add - Phase 2)

| Package | Purpose |
|---------|---------|
| `ink` | React-based TUI for visual progress |
| `better-sqlite3` | Codebase index storage |

### Node.js Requirements

- Node.js >= 18.0.0 (already required by v2)

---

## Files to Create

### Phase 1: Core Infrastructure

- [ ] `src/utils/memory/core-state.ts` - Tier 1 core state management
- [ ] `src/utils/memory/session-notes.ts` - Tier 2 session notes management
- [ ] `src/utils/memory/compactor-v3.ts` - Enhanced compaction with two-threshold
- [ ] `src/utils/memory/decisions-manager.ts` - Decision log management

### Phase 2: Prompt System

- [ ] `src/utils/prompts/initializer-agent.ts` - First-run agent prompt
- [ ] `src/utils/prompts/coding-agent.ts` - Subsequent-run agent prompt
- [ ] `src/utils/prompts/qa-agent.ts` - QA validation prompt

### Phase 3: Feature Commands

- [ ] Expand `src/commands/feature-v3.ts` with:
  - `work` subcommand (unified workflow)
  - `autopilot` subcommand (automatic mode)
  - Migration from v2 features

### Phase 4: Support Utilities

- [ ] `src/utils/feature-list.ts` - `feature_list.json` generator/parser
- [ ] `src/utils/init-script.ts` - `init.sh` generator
- [ ] `src/utils/migration-v3.ts` - v2 → v3 migration logic

### Phase 5: Anti-Stub Hooks

- [ ] `.claude/hooks/validate-no-stub.sh` - Block stub patterns on Write
- [ ] `.claude/hooks/comprehension-check.sh` - Verify context reading

### Phase 6: Memory Directory Structure

Create for each feature:
```
.claude/plans/features/{name}/
├── memory/
│   ├── core-state.json      # Tier 1
│   ├── session-notes.md     # Tier 2
│   ├── decisions.md         # Tier 2
│   ├── breadcrumbs.md       # Tier 2
│   └── archive/             # Compacted sessions
└── checkpoints/
    └── latest.json
```

---

## Files to Modify

### Expand Existing Files

| File | Changes Required |
|------|------------------|
| `src/cli-v3.ts` | Add `work`, `autopilot`, `memory` commands |
| `src/commands/feature-v3.ts` | Full implementation of unified workflow |
| `package.json` | Already has `adk3` script ✅ |

### v2 Files (FROZEN - DO NOT MODIFY)

| File | Reason |
|------|--------|
| `src/cli.ts` | Critical isolation - v2 must remain stable |
| `src/commands/feature.ts` | Contains production v2 logic |
| `src/utils/claude.ts` | v2 execution logic |

---

## Dependencies

### External Dependencies

| Dependency | Type | Already Installed |
|------------|------|-------------------|
| Claude CLI | Runtime | Yes (required) |
| Git | Runtime | Yes |
| Node.js 18+ | Runtime | Yes |

### Internal Dependencies

| Module | Path | Used By |
|--------|------|---------|
| SessionStore | `src/utils/session-store.ts` | feature-v3, claude-v3 |
| ClaudeV3 | `src/utils/claude-v3.ts` | feature-v3 commands |
| StateManager | `src/utils/state-manager.ts` | Memory system |
| ContextCompactor | `src/utils/context-compactor.ts` | Compaction |
| TokenCounter | `src/utils/token-counter.ts` | Token monitoring |
| TieredMemory | `src/utils/tiered-memory.ts` | Memory hierarchy |
| ProgressTracker | `src/utils/progress.ts` | progress.md updates |
| TaskParser | `src/utils/task-parser.ts` | tasks.md parsing |

---

## Risks

### Risk 1: Claude CLI API Changes

**Description:** Claude CLI flags may change without notice
**Likelihood:** Medium
**Impact:** High - breaks session management

**Mitigation:**
- Verify flags via `claude --help` before each sprint
- Create abstraction layer in `claude-v3.ts`
- Add flag validation on startup

### Risk 2: Context Window Overflow

**Description:** Long sessions may exceed context limits
**Likelihood:** High
**Impact:** Medium - degraded performance, forgotten context

**Mitigation:**
- Two-threshold compaction already implemented (70%, 85%, 95%)
- Checkpoint system preserves state
- Handoff document generation at emergency threshold

### Risk 3: Session Recovery Failures

**Description:** `--resume` may not restore full context
**Likelihood:** Medium
**Impact:** High - lost work

**Mitigation:**
- Frequent checkpoints (every 30 min)
- Core state in JSON (quick reload)
- Session notes for manual recovery

### Risk 4: Infinite QA Loops

**Description:** QA keeps failing, corrections don't fix issues
**Likelihood:** High
**Impact:** Medium - wasted tokens, user frustration

**Mitigation:**
- Max 3 auto-correction attempts per task
- Pattern detection for repeated errors
- Escalation to human after threshold

### Risk 5: v2/v3 Interference

**Description:** Modifying v2 files breaks production workflows
**Likelihood:** Low (if rules followed)
**Impact:** Critical

**Mitigation:**
- v2 files marked as FROZEN in CLAUDE.md
- Separate CLI entry point (`adk3`)
- No `npm link` during development
- Branch isolation (`feature/adk-v3`)

### Risk 6: Multi-Agent Conflicts

**Description:** Parallel agents editing same files
**Likelihood:** Medium
**Impact:** High - merge conflicts, lost work

**Mitigation:**
- File ownership in `shared-state.json`
- Pre-execution conflict detection
- Same-file tasks forced sequential

---

## Patterns to Follow

### Pattern 1: Atomic File Writes

From `session-store.ts:33-48`:
```typescript
const tempPath = path.join(os.tmpdir(), `session-${Date.now()}-${randomId}.json`)
await fs.writeJSON(tempPath, session, { spaces: 2 })
await fs.move(tempPath, currentPath, { overwrite: true })
```

### Pattern 2: Command Class Singleton

From `feature-v3.ts`:
```typescript
class FeatureV3Command {
  async status(name: string): Promise<void> { /* ... */ }
  async work(name: string): Promise<void> { /* ... */ }
}
export const featureV3Command = new FeatureV3Command()
```

### Pattern 3: Spinner + Try/Catch + Logger

From codebase convention:
```typescript
const spinner = ora(`Loading ${name}...`).start()
try {
  // ... operations
  spinner.succeed(`Loaded ${name}`)
} catch (error) {
  spinner.fail('Error loading')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### Pattern 4: Feature Name Validation

From `session-store.ts:18-21`:
```typescript
private validateFeatureName(feature: string): void {
  if (/[/\\]|\.\./.test(feature)) {
    throw new Error(`Invalid feature name: ${feature}`)
  }
}
```

### Pattern 5: Path Construction

From `state-manager.ts`:
```typescript
private getBasePath(): string {
  if (process.env.TEST_FEATURE_PATH) {
    return process.env.TEST_FEATURE_PATH
  }
  return process.cwd()
}

getStatePath(feature: string): string {
  return path.join(this.getBasePath(), '.claude', 'plans', 'features', feature, 'state.json')
}
```

### Pattern 6: JSON Schema with Validators

From `progress-sync.ts:129-154`:
```typescript
function validateUnifiedState(data: any): UnifiedFeatureState {
  if (!data.feature || !data.currentPhase ||
      typeof data.progress !== 'number' || !Array.isArray(data.tasks)) {
    throw new Error('Invalid UnifiedFeatureState')
  }
  return data as UnifiedFeatureState
}
export const UnifiedFeatureStateSchema = { parse: validateUnifiedState }
```

---

## Performance Considerations

### Token Budget Management

| Level | Threshold | Action | Target After |
|-------|-----------|--------|--------------|
| Normal | < 70% | Continue | N/A |
| Warning | 70-85% | Compact | 50% |
| Critical | 85-95% | Summarize | 50% |
| Emergency | > 95% | Handoff | New session |

### Memory Tier Sizes

| Tier | Max Tokens | When Loaded |
|------|------------|-------------|
| Core State | ~2K | Always |
| Session Context | ~8-16K | Session start |
| Feature Context | ~20-50K | Task change |
| Project Context | Unlimited | On demand |

### Parallel Execution Limits

| Metric | Limit | Reason |
|--------|-------|--------|
| Max agents | 3-4 | Merge complexity |
| Max tasks/wave | 4 | Manageability |
| Max files/agent | 5 | Focus quality |

---

## Security Considerations

### Path Traversal Prevention

All feature name inputs must be validated:
```typescript
if (!/^[a-zA-Z0-9_-]+$/.test(featureName)) {
  throw new Error(`Invalid feature name: "${featureName}"`)
}
```

Path resolution must be verified:
```typescript
const resolvedPath = path.resolve(featurePath)
const expectedBase = path.resolve(basePath)
if (!resolvedPath.startsWith(expectedBase)) {
  throw new Error('Path traversal detected')
}
```

### Sensitive Data Handling

- No credentials stored in session files
- Environment variables not persisted
- Git status truncated to prevent token leakage

### Hook Execution

- Hooks execute with user permissions
- No elevated privileges
- Exit codes respected (non-zero blocks operation)

---

## Implementation Strategy

### Phase 1: Core Infrastructure (Sprint 1-2)

1. Implement `core-state.ts` with full schema
2. Implement `session-notes.ts` with template
3. Implement `decisions-manager.ts`
4. Create memory directory structure

### Phase 2: Prompt System (Sprint 3)

1. Create Initializer Agent prompt
2. Create Coding Agent prompt
3. Integrate with `executeWithSessionTracking`

### Phase 3: Feature Commands (Sprint 4-5)

1. Implement `adk3 feature work <name>`
2. Implement `adk3 feature autopilot <name>`
3. Add QA two-layer system
4. Add escalation logic

### Phase 4: Anti-Stub Enforcement (Sprint 6)

1. Implement `validate-no-stub.sh`
2. Implement `comprehension-check.sh`
3. Integrate with Write tool hook

### Phase 5: Migration & Testing (Sprint 7)

1. v2 → v3 feature migration
2. Integration testing
3. Documentation update

### Phase 6: Advanced Features (Phase 2)

1. Codebase indexing
2. Auto memories
3. Visual TUI with Ink
4. Web dashboard

---

## References

### Planning Documents

| Document | Content |
|----------|---------|
| `03-v3-decisions.md` | Approved decisions, objectives |
| `04-context-memory-implementation.md` | Memory specs, anti-stub, hooks |
| `05-implementation-guide.md` | Step-by-step guide, schemas |

### Existing Codebase

| File | Relevant Patterns |
|------|-------------------|
| `src/utils/session-store.ts` | Atomic writes, history tracking |
| `src/utils/claude-v3.ts` | Session tracking, resume logic |
| `src/utils/state-manager.ts` | Unified state, compaction |
| `src/utils/tiered-memory.ts` | Memory hierarchy |
| `src/utils/context-compactor.ts` | Two-threshold compaction |

### External References

| Source | Topic |
|--------|-------|
| Anthropic | Context Engineering, Long-Running Agents |
| MemGPT Paper | Hierarchical memory architecture |
| Tessl.io | Parallel agent isolation strategies |
| Factory.ai | Context compression techniques |

---

*Research completed: 2026-02-02*
*Ready for Planning phase*
