# Research: v3-version

**Data:** 2026-02-02
**Status:** Completed
**Autor:** ADK Research Agent

---

## Current State Analysis

### What Exists (v2 Stable)

The ADK v2 codebase is a mature CLI toolkit with 576 lines in the main entry point (`cli.ts`) and extensive infrastructure:

| Component | Status | Location |
|-----------|--------|----------|
| CLI Entry | ✅ Stable | `src/cli.ts` |
| Feature Commands | ✅ 15+ subcommands | `src/commands/feature.ts` (~2000+ lines) |
| Claude Integration | ✅ Sync/Async | `src/utils/claude.ts` |
| Token Counter | ✅ Working | `src/utils/token-counter.ts` |
| Context Compaction | ✅ 4-level system | `src/utils/context-compactor.ts` |
| Progress Tracking | ✅ Working | `src/utils/progress.ts` |
| Snapshots | ✅ Working | `src/utils/snapshot-manager.ts` |
| Hook System | ✅ Basic | `.claude/hooks/*.sh` |
| Parallel Execution | ✅ Foundation | `src/utils/orchestrator.ts`, `wave-*.ts` |

### What's Already Started for v3

Significant v3 scaffolding exists and is partially implemented:

| File | Status | Purpose |
|------|--------|---------|
| `src/cli-v3.ts` | 🟡 Minimal (27 lines) | Entry point - only `status` command |
| `src/commands/feature-v3.ts` | 🟡 Minimal (95 lines) | Only `status` method implemented |
| `src/utils/session-store.ts` | ✅ Complete (149 lines) | Session persistence with 24h resumability |
| `src/utils/claude-v3.ts` | ✅ Complete (190 lines) | Async execution with session tracking |
| `src/types/session-v3.ts` | ✅ Complete (59 lines) | Session types and interfaces |

### What v2 Has That Works But Needs Enhancement

1. **Parallel Execution Framework** (`src/utils/orchestrator.ts`, `wave-executor.ts`, `wave-scheduler.ts`):
   - Wave-based task scheduling ✅
   - Model optimization per task ✅
   - Conflict detection ✅
   - Missing: Shared state between agents, proper worktree isolation

2. **Context Compaction** (`src/utils/context-compactor.ts`):
   - 4-level compaction (raw → compact → summarize → handoff) ✅
   - Token counting with tiktoken ✅
   - Missing: Two-threshold architecture (80% trigger, 50% target)

3. **Agent Router** (`src/utils/agent-router.ts`):
   - Task type detection ✅
   - Model selection per complexity ✅
   - Agent config mapping ✅
   - Missing: Initializer vs Coding agent distinction

---

## Similar Components

### 1. Session Management (Reference: `src/utils/session-store.ts`)

The existing session store provides a robust pattern:

```typescript
export class SessionStore {
  async save(feature: string, session: SessionInfoV3): Promise<void>
  async get(feature: string): Promise<SessionInfoV3 | null>
  async list(feature: string): Promise<SessionInfoV3[]>
  async update(feature: string, sessionId: string, updates: Partial<SessionInfoV3>): Promise<void>
  async isResumable(feature: string): Promise<boolean>
}
```

**Pattern to follow:**
- Atomic writes (temp file → move)
- History directory for all sessions
- 24-hour resumability window
- Separation of ADK session ID vs Claude CLI session ID

### 2. Wave Orchestrator (Reference: `src/utils/orchestrator.ts`)

```typescript
export class WaveOrchestrator {
  private enhanceTasks(tasks: ParsedTaskForParallel[]): EnhancedTask[]
  async execute(): Promise<OrchestratorResult>
  private async retryFailedTasks(wave: Wave, result: WaveExecutionResult): Promise<void>
}
```

**Pattern to follow:**
- Schedule plan creation before execution
- Wave-by-wave execution with progress display
- Retry with model upgrade (haiku → sonnet → opus)
- Conflict resolution after each wave

### 3. Context Compactor (Reference: `src/utils/context-compactor.ts`)

```typescript
export class ContextCompactor {
  async getContextStatus(feature: string): Promise<ContextStatus>
  async compact(feature: string, options: CompactOptions): Promise<CompactionResult>
  async summarize(feature: string): Promise<SummarizeResult>
  async createHandoffDocument(feature: string): Promise<HandoffDocument>
  async revertCompaction(feature: string, historyId: string): Promise<boolean>
}
```

**Pattern to follow:**
- Threshold-based compaction levels
- Preserve critical content (decisions, ADRs, errors)
- 24-hour revert window
- Aggregate all feature files for analysis

---

## Technical Stack

### Current Dependencies (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| commander | ^14.0.2 | CLI framework |
| inquirer | ^13.2.0 | Interactive prompts |
| ora | ^9.0.0 | Spinners |
| chalk | ^5.6.2 | Terminal colors |
| fs-extra | ^11.3.3 | File operations |
| tiktoken | ^1.0.22 | Token counting |
| zod | ^4.3.5 | Schema validation |
| fuse.js | ^7.1.0 | Fuzzy search |
| simple-git | ^3.30.0 | Git operations |
| @anthropic-ai/sdk | ^0.32.1 | Anthropic API (for AI review) |

### Dependencies to Add

| Package | Purpose | Priority |
|---------|---------|----------|
| better-sqlite3 | Semantic index storage | Phase 7 |
| ink | React-based TUI | Phase 9 |
| transformers.js | Local embeddings | Phase 7 |

### Development Tools

| Tool | Version | Config |
|------|---------|--------|
| TypeScript | ^5.3.3 | `tsconfig.json` |
| Jest | ^30.2.0 | `jest.config.js` |
| Biome | ^2.3.11 | `biome.json` |
| Node.js | >= 18.0.0 | Engine requirement |

---

## Files to Create

### Phase 1: Infrastructure Base

- [x] `src/cli-v3.ts` - Exists, needs expansion
- [x] `src/utils/session-store.ts` - Complete
- [x] `src/utils/claude-v3.ts` - Complete
- [x] `src/types/session-v3.ts` - Complete

### Phase 2: Memory System (NEW)

- [ ] `src/utils/memory/core-state.ts` - Tier 1 state manager
- [ ] `src/utils/memory/session-notes.ts` - Tier 2 session context
- [ ] `src/utils/memory/compactor.ts` - Enhanced compaction with two-threshold
- [ ] `src/utils/memory/loader.ts` - Progressive loading by tier

### Phase 3: Agent Logic (NEW)

- [ ] `src/utils/prompts/initializer.ts` - Initializer Agent prompt builder
- [ ] `src/utils/prompts/coding.ts` - Coding Agent prompt builder
- [ ] `src/utils/feature-list.ts` - feature_list.json schema and operations

### Phase 4: Commands (EXPAND)

- [ ] `src/commands/feature-v3.ts` - Add `feature <name>`, `autopilot` methods
- [ ] `src/commands/memory-v3.ts` - Memory management commands

### Phase 5: Hooks (NEW)

- [ ] `.claude/hooks/inject-memory.sh` - PreToolUse context injection
- [ ] `.claude/hooks/auto-checkpoint.sh` - Stop event checkpoint
- [ ] `.claude/hooks/validate-no-stub.sh` - Write validation
- [ ] `.claude/hooks/comprehension-check.sh` - PreToolUse verification

### Phase 6: Parallel Execution (ENHANCE)

- [ ] `src/utils/parallel/shared-state.ts` - Tier 0 shared memory
- [ ] `src/utils/parallel/worktree-manager.ts` - Enhanced worktree handling
- [ ] `src/utils/parallel/aggregator.ts` - Result merge and decision consolidation

### Phase 7: Indexing (NEW)

- [ ] `src/utils/indexer/parser.ts` - AST parsing
- [ ] `src/utils/indexer/embedder.ts` - Local embedding generation
- [ ] `src/utils/indexer/searcher.ts` - Semantic search query engine

### Phase 8: Auto Memories (NEW)

- [ ] `src/utils/memories/detector.ts` - Pattern/decision detection
- [ ] `src/utils/memories/storage.ts` - Memory persistence
- [ ] `src/utils/memories/injector.ts` - Context injection

### Phase 9: Visual UI (NEW)

- [ ] `src/ui/dashboard.tsx` - Ink-based TUI dashboard
- [ ] `src/ui/progress.tsx` - Progress bar component
- [ ] `src/ui/agent-panel.tsx` - Agent status display

---

## Files to Modify

### DO NOT MODIFY (v2 Frozen)

| File | Reason |
|------|--------|
| `src/cli.ts` | v2 entry point - must remain stable |
| `src/commands/feature.ts` | v2 feature commands - must remain stable |
| `src/utils/claude.ts` | v2 Claude integration - must remain stable |

### Modify with Care

| File | Change | Risk |
|------|--------|------|
| `package.json` | Add `"adk3": "node dist/cli-v3.js"` | Low |
| `tsconfig.json` | May need JSX for Ink | Medium |
| `src/types/parallel.ts` | Add SharedState types | Low |

---

## Dependencies

### External (npm packages)

| Package | Existing | New | Notes |
|---------|----------|-----|-------|
| commander | ✅ | | CLI framework |
| fs-extra | ✅ | | File operations |
| tiktoken | ✅ | | Token counting |
| ora | ✅ | | Spinners |
| chalk | ✅ | | Colors |
| better-sqlite3 | | ✅ | For semantic index |
| ink | | ✅ | For TUI (Phase 9) |
| @anthropic-ai/sdk | ✅ | | Already present |

### Internal (module dependencies)

```
cli-v3.ts
  └── commands/feature-v3.ts
        ├── utils/session-store.ts (exists)
        ├── utils/claude-v3.ts (exists)
        ├── utils/memory/core-state.ts (new)
        ├── utils/memory/loader.ts (new)
        ├── utils/prompts/initializer.ts (new)
        ├── utils/prompts/coding.ts (new)
        └── utils/orchestrator.ts (exists, enhance)
              ├── utils/wave-executor.ts (exists)
              ├── utils/wave-scheduler.ts (exists)
              └── utils/parallel/shared-state.ts (new)
```

---

## Risks

### Risk 1: Claude CLI Session Flags Availability

**Description:** The PRD assumes `--session-id` and `--resume` flags exist in Claude CLI.

**Impact:** High - core functionality depends on session resumability

**Mitigation:**
- Verified: `--resume` flag exists (referenced in claude-v3.ts)
- Fallback: Store conversation context and re-inject if flags unavailable
- Test early in Phase 1

### Risk 2: AI Continues Producing Stubs

**Description:** Despite 5-layer guarantee, AI may still produce placeholder code.

**Impact:** High - defeats purpose of v3

**Mitigation:**
- Hook `validate-no-stub.sh` blocks writes with stub patterns
- Comprehension checkpoint forces reading before writing
- Strategic redundancy (same constraint in 5+ places)
- TDD enforcement (test must exist before implementation)

### Risk 3: Parallel Execution Conflicts

**Description:** Multiple agents modifying same files causes merge conflicts.

**Impact:** Medium - reduces parallel efficiency

**Mitigation:**
- Pre-execution conflict detection (wave-scheduler.ts already does this)
- File ownership in shared-state.json
- Two-step merge: structure-first + auto-dedupe
- Fallback to sequential execution

### Risk 4: Memory System Complexity

**Description:** 4-tier memory hierarchy is complex to implement correctly.

**Impact:** Medium - may delay delivery

**Mitigation:**
- Implement incrementally: Tier 1 first, then expand
- Each tier has clear boundaries and loading rules
- Reuse existing compactor.ts patterns

### Risk 5: Context Overflow During Long Sessions

**Description:** Even with compaction, context may grow too large.

**Impact:** Medium - session interruption

**Mitigation:**
- Two-threshold compaction (80% trigger, 50% target)
- Handoff document generation at 95%
- Automatic session archival

### Risk 6: Breaking v2 Compatibility

**Description:** Changes to shared code may break v2.

**Impact:** High - existing users affected

**Mitigation:**
- **NEVER** modify `src/cli.ts`, `src/commands/feature.ts`, `src/utils/claude.ts`
- Create all v3 code in new files (`*-v3.ts`)
- Separate entry points (`adk` vs `adk3`)
- Git tag v2.0.0 before starting

---

## Patterns to Follow

### 1. Command Structure (from `src/commands/feature.ts`)

```typescript
class FeatureV3Command {
  private async validateFeatureName(name: string): void
  private async getFeatureState(name: string): Promise<FeatureState>
  private async loadContext(options: FeatureOptions): Promise<string>

  async feature(name: string, options: FeatureOptions): Promise<void>
  async autopilot(name: string, options: FeatureOptions): Promise<void>
}

export const featureV3Command = new FeatureV3Command()
```

### 2. Session Persistence (from `src/utils/session-store.ts`)

```typescript
const tempPath = path.join(os.tmpdir(), `session-${Date.now()}-${randomId}.json`)
await fs.writeJSON(tempPath, session, { spaces: 2 })
await fs.move(tempPath, currentPath, { overwrite: true })
```

### 3. Feature Path Resolution (from `src/utils/git-paths.ts`)

```typescript
export function getFeaturePathUtil(name: string): string {
  const mainRepo = getMainRepoPathUtil()
  return path.join(mainRepo, '.claude', 'plans', 'features', name)
}
```

### 4. Error Handling (from feature.ts)

```typescript
const spinner = ora(`Loading...`).start()
try {
  // operation
  spinner.succeed(`Done`)
} catch (error) {
  spinner.fail(`Error`)
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 5. Async Execution with Metrics (from `src/utils/claude.ts`)

```typescript
export async function executeHeadlessWithMetrics(
  prompt: string,
  options: ClaudeCommandOptions = {}
): Promise<HeadlessResult> {
  if (collectMetrics) enableMetricsCollection()
  // ... execution
  const metrics = collectMetrics ? getCollectedMetrics() : undefined
  if (collectMetrics) disableMetricsCollection()
  return { success: true, metrics }
}
```

---

## Anti-Patterns to Avoid

### 1. Modifying v2 Files

```typescript
// ❌ WRONG
import { featureCommand } from './commands/feature.js'
featureCommand.newMethod = () => { /* v3 logic */ }

// ✅ RIGHT
import { featureV3Command } from './commands/feature-v3.js'
```

### 2. Synchronous Claude Execution

```typescript
// ❌ WRONG - blocks
const result = spawnSync('claude', args)

// ✅ RIGHT - async with session tracking
const result = await executeWithSessionTracking(feature, prompt, options)
```

### 3. Hardcoded Paths

```typescript
// ❌ WRONG
const featurePath = `.claude/plans/features/${name}`

// ✅ RIGHT
const featurePath = getFeaturePathUtil(name)
```

### 4. Context Without Tiering

```typescript
// ❌ WRONG - loads everything
const context = await loadAllFeatureFiles(feature)

// ✅ RIGHT - tier-based loading
const tier1 = await loadCoreState(feature) // always
const tier2 = await loadSessionContext(feature) // on session start
const tier3 = await loadFeatureContext(feature) // on task change
```

### 5. Ignoring Compaction Thresholds

```typescript
// ❌ WRONG - no threshold check
await addToContext(newContent)

// ✅ RIGHT - check and compact
const status = await contextCompactor.getContextStatus(feature)
if (status.level !== 'raw') {
  await contextCompactor.compact(feature, { level: status.level })
}
await addToContext(newContent)
```

---

## Performance Considerations

### 1. Token Counting

**Current:** tiktoken with caching (3600s TTL, 1000 max entries)
**Recommendation:** Keep current implementation, already optimized

### 2. Parallel Execution Limits

**Research-based limits:**
- Max concurrent agents: 3-4 (source: Addy Osmani, Tessl.io)
- Max tasks per wave: 4 (source: Pragmatic Engineer)
- Recommended start: 2 agents

**Current implementation:** Respects these limits in `wave-scheduler.ts`

### 3. File I/O

**Pattern:** Atomic writes with temp file + move
**Already implemented:** `session-store.ts`, `context-compactor.ts`

### 4. Memory Loading

**Strategy:** Progressive loading by tier
- Tier 1 (2-4K): Always in context
- Tier 2 (8-16K): Per session
- Tier 3 (20-50K): On demand
- Tier 4 (unlimited): Rarely needed

### 5. Semantic Search (Phase 7)

**Concern:** Embedding generation can be slow
**Mitigation:**
- Use local transformers.js (no API calls)
- Incremental indexing on file change
- Cache embeddings in SQLite

---

## Security Considerations

### 1. Path Traversal Prevention

**Already implemented in session-store.ts:**
```typescript
private validateFeatureName(feature: string): void {
  if (/[/\\]|\.\./.test(feature)) {
    throw new Error(`Invalid feature name: ${feature}`)
  }
}
```

**Apply to:** All file operations with user-provided names

### 2. Hook Validation

**Existing hooks validate:**
- `block-ai-commits.sh` - Prevents AI mentions in commits
- Need to add: `validate-no-stub.sh` - Block stub patterns in writes

### 3. Worktree Isolation

**Purpose:** Prevent agents from modifying files outside their scope
**Implementation:** Each agent in separate git worktree with file ownership tracking

### 4. Token/API Key Protection

**Current:** Uses `CLAUDE_SESSION_ID` env var
**Recommendation:** Never log or persist API keys, use environment variables only

---

## Test Coverage Analysis

### Existing Tests for v3 Components

| Test File | Coverage | Notes |
|-----------|----------|-------|
| `tests/cli-v3.test.ts` | ✅ Basic | Tests help command |
| `tests/utils/session-store.test.ts` | ✅ Complete | Full coverage |
| `tests/utils/claude-v3.test.ts` | ✅ Complete | Mocked execution |
| `tests/commands/feature-v3.test.ts` | 🟡 Partial | Only status method |
| `tests/types/session-v3.test.ts` | ✅ Complete | Type validation |
| `tests/utils/wave-scheduler.test.ts` | ✅ Complete | Scheduling logic |
| `tests/utils/conflict-resolver.test.ts` | ✅ Complete | Conflict detection |

### Tests to Create

| Test File | Priority | Phase |
|-----------|----------|-------|
| `tests/utils/memory/core-state.test.ts` | High | 2 |
| `tests/utils/memory/loader.test.ts` | High | 2 |
| `tests/utils/prompts/initializer.test.ts` | High | 3 |
| `tests/utils/prompts/coding.test.ts` | High | 3 |
| `tests/commands/feature-v3-full.test.ts` | High | 4 |
| `tests/hooks/validate-no-stub.test.ts` | High | 5 |
| `tests/utils/parallel/shared-state.test.ts` | Medium | 6 |
| `tests/utils/indexer/*.test.ts` | Medium | 7 |
| `tests/e2e/v3-full-cycle.test.ts` | High | 10 |

---

## Implementation Roadmap Summary

| Phase | Name | Key Deliverables | Depends On |
|-------|------|------------------|------------|
| 1 | Infrastructure | Expand cli-v3.ts, validate Claude flags | - |
| 2 | Memory System | core-state.ts, loader.ts, compactor enhancements | 1 |
| 3 | Agent Logic | Initializer/Coding prompts, feature_list.json | 2 |
| 4 | Commands | feature-v3.ts full implementation | 2, 3 |
| 5 | Hooks | inject-memory, validate-no-stub, checkpoints | 2, 4 |
| 6 | Parallel | shared-state, enhanced worktrees | 4 |
| 7 | Indexing | Semantic search, embeddings | 4 |
| 8 | Auto Memories | Pattern detection, auto-capture | 7 |
| 9 | Visual UI | TUI dashboard with Ink | 6 |
| 10 | Integration | Full test, documentation, migration | All |

---

## References

### Internal Documents

| Document | Location | Purpose |
|----------|----------|---------|
| PRD | `.claude/plans/features/v3-version/prd.md` | Requirements |
| Master Index | `.claude/docs/v3-planning/00-MASTER-INDEX.md` | Overview |
| Decisions | `.claude/docs/v3-planning/03-v3-decisions.md` | Approved decisions |
| Memory Spec | `.claude/docs/v3-planning/04-context-memory-implementation.md` | Detailed memory specs |
| Implementation Guide | `.claude/docs/v3-planning/05-implementation-guide.md` | Step-by-step |

### External Sources

| Source | Topic | URL |
|--------|-------|-----|
| Anthropic | Context Engineering | anthropic.com/engineering/effective-context-engineering |
| Anthropic | Long-Running Agents | anthropic.com/engineering/effective-harnesses |
| Google ADK | Multi-Agent Framework | developers.googleblog.com/multi-agent-framework |
| Factory.ai | Context Compression | factory.ai/news/compressing-context |
| Tessl.io | Parallel AI Agents | tessl.io/blog/how-to-parallelize-ai-coding-agents |

---

*Research completed: 2026-02-02*
*Ready for planning phase*
