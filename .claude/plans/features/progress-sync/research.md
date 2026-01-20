# Research: progress-sync

**Date:** 2026-01-20
**Feature:** Progress Sync System
**PRD:** ./prd.md

---

## Current State Analysis

### Existing Progress System (`src/utils/progress.ts`)

The current system manages `progress.md` files with basic functionality:

1. **Data Model**: `FeatureProgress` interface with steps array
2. **Parsing**: Regex-based parsing of markdown format
3. **Synchronization**: Simple timestamp-based sync between main repo and worktrees
4. **Limitations**:
   - No `tasks.md` integration
   - Timestamp-only conflict resolution (line 64-70)
   - Silent overwrites without history
   - No snapshot capability

**Key Functions**:
- `loadProgress(featureName)` - Returns `FeatureProgress`
- `saveProgress(featureName, progress)` - Writes to both main repo and worktree
- `updateStepStatus(progress, stepName, status)` - Updates step and calculates nextStep
- `syncProgressFiles(mainPath, worktreePath)` - Timestamp-based bidirectional sync

### Current Sync Limitations

```typescript
if (worktreeModTime > mainModTime) {
  const content = await fs.readFile(worktreePath, 'utf-8')
  await fs.writeFile(mainPath, content)  // Silent overwrite!
}
```

This causes the problems identified in the PRD:
- Data loss when either side has unique information
- No merge strategy
- No conflict detection

---

## Similar Components

### 1. Sync Conflict System (`src/utils/sync-conflict.ts`)

**Relevance**: HIGH - This is the conflict resolution pattern to extend

```typescript
export interface SyncConflict {
  field: string
  localValue: unknown
  remoteValue: unknown
  localTimestamp: string
  remoteTimestamp: string
}

export async function detectConflicts(
  local: LocalFeature,
  remote: RemoteFeature
): Promise<SyncConflict[]>

export async function resolveConflicts(
  conflicts: SyncConflict[],
  strategy: ConflictStrategy
): Promise<ConflictResolution>
```

**Pattern to Follow**: Field-by-field comparison with strategy-based resolution

### 2. Sync Queue System (`src/utils/sync-queue.ts`)

**Relevance**: MEDIUM - Pattern for offline/retry operations

```typescript
export interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  feature: string
  data: unknown
  createdAt: string
  retries: number
  lastError?: string
}
```

**Pattern to Follow**: FIFO queue with retry support, persisted to JSON file

### 3. Memory History Pattern (`src/types/memory.ts`)

**Relevance**: HIGH - Model for history tracking

```typescript
export interface PhaseHistory {
  date: string
  phase: MemoryPhase
  result: PhaseResult
}

export interface MemoryContent {
  // ...
  history: PhaseHistory[]
}
```

**Pattern to Follow**: Append-only history with timestamp and result

### 4. Provider Types (`src/types/provider.ts`)

**Relevance**: MEDIUM - Local vs Remote state separation

```typescript
export interface LocalFeature {
  name: string
  phase: string
  progress: number
  lastUpdated: string
}

export interface RemoteFeature {
  id: string
  name: string
  status: string
  phase?: string
  updatedAt: string
}
```

**Pattern to Follow**: Clear separation between local state and unified/synced state

---

## Technical Stack

### Dependencies Already Available

| Package | Version | Use for Progress Sync |
|---------|---------|----------------------|
| `fs-extra` | ^11.x | Atomic file operations, ensureDir, readJson/writeJson |
| `chalk` | ^5.x | CLI output formatting |
| `ora` | ^9.x | Progress spinners |
| `zod` | ^3.x | Schema validation (can use for state.json validation) |
| `fuse.js` | ^7.x | Not needed for this feature |
| `simple-git` | ^3.x | Git operations for metrics (files changed) |

### Runtime Requirements
- Node.js >= 18.0.0
- TypeScript ES2020 target
- CommonJS modules

---

## Files to Create

### Core Components

- [ ] `src/types/progress-sync.ts`
  - `UnifiedFeatureState` interface
  - `TaskState` interface
  - `TransitionEntry` interface
  - `Inconsistency` interface
  - `SnapshotData` interface

- [ ] `src/utils/task-parser.ts`
  - `parseTasksFile(content: string): TasksDocument`
  - `extractTaskStatus(line: string): TaskStatus`
  - `extractAcceptanceCriteria(content: string): Criterion[]`

- [ ] `src/utils/state-manager.ts`
  - `StateManager` class
  - `loadUnifiedState(featureName): UnifiedFeatureState`
  - `saveUnifiedState(featureName, state): void`
  - `calculateProgress(): number`

- [ ] `src/utils/sync-engine.ts`
  - `SyncEngine` class
  - `syncProgressAndTasks(featureName): SyncResult`
  - `detectInconsistencies(): Inconsistency[]`
  - `applyStrategy(strategy): ResolvedState`

- [ ] `src/utils/history-tracker.ts`
  - `HistoryTracker` class
  - `recordTransition(entry: TransitionEntry): void`
  - `getHistory(limit?: number): TransitionEntry[]`
  - `pruneHistory(maxEntries: number): void`

- [ ] `src/utils/snapshot-manager.ts`
  - `SnapshotManager` class
  - `createSnapshot(featureName, trigger): string`
  - `restoreSnapshot(featureName, snapshotId): void`
  - `listSnapshots(featureName): SnapshotMeta[]`
  - `cleanupOldSnapshots(maxCount): number`

- [ ] `src/utils/metrics-collector.ts`
  - `MetricsCollector` class
  - `collectPhaseMetrics(featureName, phase): PhaseMetrics`
  - `getFilesChanged(since?: string): string[]`
  - `aggregateMetrics(): AggregatedMetrics`

### Tests (TDD approach)

- [ ] `tests/utils/task-parser.test.ts`
- [ ] `tests/utils/state-manager.test.ts`
- [ ] `tests/utils/sync-engine.test.ts`
- [ ] `tests/utils/history-tracker.test.ts`
- [ ] `tests/utils/snapshot-manager.test.ts`
- [ ] `tests/utils/metrics-collector.test.ts`
- [ ] `tests/integration/progress-sync.test.ts`

---

## Files to Modify

### Command Integration

- [ ] `src/commands/feature.ts`
  - Add sync trigger after phase completion (create, research, plan, implement, qa, docs)
  - Add `--unified` flag to `status` subcommand
  - Add `sync` subcommand
  - Import and use `SyncEngine`

- [ ] `src/utils/progress.ts`
  - Extend `syncProgressFiles()` to use new `SyncEngine`
  - Add hook point for history tracking
  - Maintain backward compatibility

### Type Extensions

- [ ] `src/providers/types.ts`
  - Add `ProgressSyncConfig` interface
  - Export new sync-related types

- [ ] `src/utils/config.ts`
  - Add progress-sync configuration options
  - Add `getProgressSyncConfig()` function

---

## Dependencies

### External Dependencies

**No new dependencies required** - All functionality can be built with existing packages:

- `fs-extra` for file operations (already v11.x)
- `zod` for schema validation (already v3.x)
- `simple-git` for git metrics (already v3.x)

### Internal Dependencies

| Component | Depends On |
|-----------|-----------|
| `task-parser.ts` | (standalone) |
| `state-manager.ts` | `progress.ts`, `task-parser.ts`, `git-paths.ts` |
| `sync-engine.ts` | `state-manager.ts`, `sync-conflict.ts` |
| `history-tracker.ts` | `git-paths.ts` |
| `snapshot-manager.ts` | `state-manager.ts`, `git-paths.ts` |
| `metrics-collector.ts` | `simple-git` |
| `feature.ts` (modified) | All new components |

---

## Risks

### Risk 1: Corrupted State During Sync

**Description**: If sync fails mid-operation, both `progress.md` and `tasks.md` could be in inconsistent state.

**Impact**: HIGH

**Mitigation**:
1. Implement backup-before-write pattern
2. Use atomic write operations (write to temp file, then rename)
3. Validate state integrity after write
4. Automatic rollback on validation failure

**Implementation Pattern**:
```typescript
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await fs.writeFile(tempPath, content)
  await fs.rename(tempPath, filePath)
}
```

### Risk 2: tasks.md Parsing Complexity

**Description**: The tasks.md format has many variations (status patterns, nested structures, acceptance criteria).

**Impact**: MEDIUM

**Mitigation**:
1. Support multiple status formats: `[ ] Pendente`, `[x] Completo`, etc.
2. Graceful degradation when parsing fails
3. Comprehensive test coverage with real-world examples
4. Log parse warnings without failing sync

### Risk 3: Performance with Large Features

**Description**: Features with 50+ tasks and complex history could slow down sync operations.

**Impact**: MEDIUM

**Mitigation**:
1. Lazy loading of history and metrics
2. Cache parsed state in `state.json`
3. Limit history to 50 entries (configurable)
4. Profile and optimize regex patterns

### Risk 4: Worktree Sync Conflicts

**Description**: Changes made simultaneously in main repo and worktree could conflict.

**Impact**: MEDIUM

**Mitigation**:
1. Use file locking during sync (advisory)
2. Detect concurrent modifications before write
3. Queue conflicts for manual resolution
4. Merge history from both sources

### Risk 5: Backward Compatibility

**Description**: Existing features without `tasks.md` or with old `progress.md` format could break.

**Impact**: HIGH

**Mitigation**:
1. Make `tasks.md` optional (graceful degradation)
2. Detect and migrate old `progress.md` format automatically
3. All new fields in `progress.md` are optional
4. Add version field to `state.json` for future migrations

---

## Patterns to Follow

### 1. Existing Test Pattern (`tests/utils/progress.test.ts`)

```typescript
describe('FeatureName', () => {
  const testDir = path.join(process.cwd(), '.test-feature-name')

  beforeEach(async () => {
    await fs.ensureDir(testDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  // Mock git operations
  jest.mock('node:child_process', () => ({
    execFileSync: jest.fn().mockReturnValue('.git'),
  }))
})
```

### 2. Error Handling Pattern (`src/commands/feature.ts`)

```typescript
const spinner = ora('Doing something...').start()
try {
  // work
  spinner.succeed('Success')
} catch (error) {
  spinner.fail('Failed')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 3. Config Pattern (`src/utils/config.ts`)

```typescript
export interface MyConfig {
  enabled: boolean
  option1: string
}

export const DEFAULT_MY_CONFIG: MyConfig = {
  enabled: true,
  option1: 'default'
}

export async function getMyConfig(): Promise<MyConfig> {
  const config = await loadConfig()
  return config.myConfig ?? DEFAULT_MY_CONFIG
}
```

### 4. Type Export Pattern (`src/providers/types.ts`)

```typescript
export type MyStatus = 'pending' | 'completed' | 'failed'

export interface MyInterface {
  field1: string
  field2: MyStatus
}
```

---

## Performance Considerations

### Target Metrics (from PRD)

| Operation | Target |
|-----------|--------|
| Sync (50 tasks) | < 500ms |
| Read unified state | < 100ms |
| Create snapshot | < 200ms |
| Impact on existing commands | < 10% overhead |

### Optimization Strategies

1. **Caching**: Store parsed state in `state.json` to avoid re-parsing
2. **Lazy Loading**: Only load history/metrics when requested
3. **Batched Writes**: Group multiple file writes into single operation
4. **Efficient Regex**: Pre-compile regex patterns, use non-greedy quantifiers
5. **Incremental Updates**: Only re-parse changed sections

### File Size Considerations

- `state.json`: ~5-10KB for typical feature
- `history.json`: ~1KB per 50 entries
- `.snapshots/`: ~20-50KB per snapshot, limited to 10

---

## Security Considerations

### Data Sanitization

1. **No Secrets in Snapshots**: Filter environment variables, tokens
2. **Path Traversal Prevention**: Validate feature names, reject `../`
3. **Input Validation**: Use Zod schemas for all JSON parsing

### File Permissions

1. Follow parent directory permissions
2. Don't store executable permissions
3. Validate file ownership before write in shared environments

### Example Validation Schema

```typescript
import { z } from 'zod'

const UnifiedStateSchema = z.object({
  feature: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/),
  phase: z.string(),
  lastSynced: z.string().datetime(),
  // ... other fields
})

function validateState(data: unknown): UnifiedFeatureState {
  return UnifiedStateSchema.parse(data)
}
```

---

## Implementation Order Recommendation

### Phase 1: Foundation (Tasks 1-8)
Priority: Types and core parsing

1. Define `UnifiedFeatureState` and related types
2. Implement `task-parser.ts` with comprehensive tests
3. Implement `StateManager` with basic load/save
4. Write tests for each component

### Phase 2: History & Snapshots (Tasks 9-14)
Priority: Traceability

1. Implement `HistoryTracker` with pruning
2. Implement `SnapshotManager` with auto-cleanup
3. Integrate snapshots at phase transitions

### Phase 3: Conflict Resolution (Tasks 15-20)
Priority: Robustness

1. Extend `sync-conflict.ts` for progress/tasks
2. Implement inconsistency detection
3. Add `feature sync` command

### Phase 4: Metrics & Polish (Tasks 21-26)
Priority: UX

1. Implement `MetricsCollector`
2. Add `--unified` flag to status
3. Implement restore command
4. End-to-end testing

### Phase 5: Worktree Integration (Tasks 27-30)
Priority: Full integration

1. Update worktree sync to use SyncEngine
2. Handle offline queue scenarios
3. Final documentation and QA

---

## Questions to Resolve Before Implementation

1. **Conflict UI**: Should conflicts be resolved interactively or always use configured strategy?
   - Recommendation: Use configured strategy by default, add `--interactive` flag

2. **Snapshot Naming**: Use timestamps or semantic names (pre-implement, pre-qa)?
   - Recommendation: Use semantic names with timestamps: `pre-implement-2026-01-20.json`

3. **History Persistence**: JSON file per feature or single global history?
   - Recommendation: Per-feature `history.json` for isolation

4. **Metrics Source**: Git diff only or also parse test output?
   - Recommendation: Start with git diff, add test output parsing as enhancement

---

## Summary

The progress-sync feature builds on existing patterns in the codebase:

- **Conflict resolution**: Extends `sync-conflict.ts` patterns
- **Queue/retry**: Follows `sync-queue.ts` approach
- **History**: Uses `PhaseHistory` pattern from memory types
- **Testing**: Follows established test patterns with temp directories

**Key Technical Decisions**:
1. No new dependencies required
2. Backward-compatible with existing features
3. TDD approach for all new components
4. Atomic operations for data integrity
5. Zod validation for all JSON schemas

**Estimated Complexity**: Medium-High
**Risk Level**: Medium (mitigated by comprehensive testing)
**Dependencies**: No blockers identified
