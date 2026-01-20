# Implementation Plan: progress-sync

**Feature:** Progress Sync System
**Date:** 2026-01-20
**Based on:** research.md, prd.md

---

## Overview

This plan breaks down the progress-sync feature into 5 phases with 30 tasks total. Each phase builds on the previous one, ensuring a solid foundation before adding complexity.

**Implementation Strategy:** TDD (Test-Driven Development) - tests first, then implementation.

---

## Phase 1: Foundation - Types & Core Parsing

**Objective:** Establish type system and implement core parsing capabilities for tasks.md

**Duration Estimate:** 8 story points

### Task 1.1: Define Core Types

**Objective:** Create TypeScript interfaces for unified state management

**Files to Create:**
- `src/types/progress-sync.ts`

**Types to Define:**
```typescript
- UnifiedFeatureState
- TaskState
- TaskStatus ('pending' | 'in_progress' | 'completed' | 'blocked')
- TransitionEntry
- Inconsistency
- SnapshotData
- PhaseMetrics
- SyncResult
```

**Tests Required:**
- Type exports are accessible
- Types are compatible with existing FeatureProgress

**Acceptance Criteria:**
- [ ] All interfaces defined with JSDoc documentation
- [ ] Types exported from `src/types/index.ts`
- [ ] Zod schemas created for runtime validation
- [ ] No TypeScript errors

**Dependencies:** None
**Story Points:** 2

---

### Task 1.2: Implement Task Parser - Basic Parsing

**Objective:** Parse tasks.md file into structured TasksDocument

**Files to Create:**
- `src/utils/task-parser.ts`
- `tests/utils/task-parser.test.ts`

**Functions to Implement:**
```typescript
parseTasksFile(content: string): TasksDocument
extractTaskStatus(line: string): TaskStatus
extractPriority(line: string): TaskPriority
```

**Test Cases:**
1. Parse empty file → returns empty TasksDocument
2. Parse single task with checkbox `[ ]` → status pending
3. Parse task with `[x]` → status completed
4. Parse task with `[~]` → status in_progress
5. Parse task with `[!]` → status blocked
6. Extract P0, P1, P2 priorities
7. Handle malformed lines gracefully
8. Parse nested subtasks

**Acceptance Criteria:**
- [ ] All test cases passing
- [ ] Handles multiple task formats (ADK style, generic markdown)
- [ ] Returns null for unparseable content (graceful degradation)
- [ ] Coverage >= 90%

**Dependencies:** Task 1.1
**Story Points:** 3

---

### Task 1.3: Implement Task Parser - Acceptance Criteria

**Objective:** Extract acceptance criteria from tasks.md

**Files to Modify:**
- `src/utils/task-parser.ts`
- `tests/utils/task-parser.test.ts`

**Functions to Add:**
```typescript
extractAcceptanceCriteria(content: string): AcceptanceCriterion[]
extractTaskNotes(taskBlock: string): string[]
```

**Test Cases:**
1. Extract criteria with `- [ ]` format
2. Extract criteria with `✓` and `✗` markers
3. Handle criteria without status markers
4. Extract notes after criteria
5. Associate criteria with parent task

**Acceptance Criteria:**
- [ ] Criteria extracted with individual status
- [ ] Notes preserved per task
- [ ] Handles various markdown checkbox formats
- [ ] Coverage >= 90%

**Dependencies:** Task 1.2
**Story Points:** 2

---

### Task 1.4: Implement StateManager - Basic Operations

**Objective:** Create StateManager class for unified state operations

**Files to Create:**
- `src/utils/state-manager.ts`
- `tests/utils/state-manager.test.ts`

**Class Structure:**
```typescript
class StateManager {
  loadUnifiedState(featureName: string): Promise<UnifiedFeatureState>
  saveUnifiedState(featureName: string, state: UnifiedFeatureState): Promise<void>
  calculateProgress(tasks: TaskState[]): number
  getStatePath(featureName: string): string
}
```

**Test Cases:**
1. Load state from existing state.json
2. Create default state when file doesn't exist
3. Save state with atomic write (temp file + rename)
4. Calculate progress: 0% when no tasks
5. Calculate progress: 50% when half completed
6. Calculate progress: 100% when all completed
7. Validate state schema on load

**Acceptance Criteria:**
- [ ] Atomic write operations (no partial writes)
- [ ] Schema validation with Zod
- [ ] Backward compatible with features without state.json
- [ ] Coverage >= 85%

**Dependencies:** Task 1.1, Task 1.2
**Story Points:** 3

---

### Task 1.5: Integrate Task Parser with StateManager

**Objective:** StateManager should read from both progress.md and tasks.md

**Files to Modify:**
- `src/utils/state-manager.ts`
- `tests/utils/state-manager.test.ts`

**Functions to Add:**
```typescript
private loadProgressData(featureName: string): Promise<ProgressData>
private loadTasksData(featureName: string): Promise<TasksData>
mergeProgressAndTasks(progress: ProgressData, tasks: TasksData): UnifiedFeatureState
```

**Test Cases:**
1. Merge progress.md with tasks.md
2. Handle missing tasks.md (graceful degradation)
3. Handle missing progress.md
4. Preserve task details from tasks.md
5. Preserve phase status from progress.md

**Acceptance Criteria:**
- [ ] Both files read and merged correctly
- [ ] Missing files don't cause errors
- [ ] State includes data from both sources
- [ ] No data loss during merge

**Dependencies:** Task 1.4
**Story Points:** 2

---

## Phase 1 Checkpoint

**Verification:**
1. Run all Phase 1 tests: `npm test -- tests/utils/task-parser.test.ts tests/utils/state-manager.test.ts`
2. Verify types compile: `npm run type-check`
3. Check coverage: `npm run test:coverage`
4. Manual test: Create sample tasks.md and verify parsing

---

## Phase 2: History & Snapshots

**Objective:** Implement traceability through history tracking and snapshot creation

**Duration Estimate:** 6 story points

### Task 2.1: Implement HistoryTracker

**Objective:** Track all state transitions for audit trail

**Files to Create:**
- `src/utils/history-tracker.ts`
- `tests/utils/history-tracker.test.ts`

**Class Structure:**
```typescript
class HistoryTracker {
  recordTransition(featureName: string, entry: TransitionEntry): Promise<void>
  getHistory(featureName: string, limit?: number): Promise<TransitionEntry[]>
  pruneHistory(featureName: string, maxEntries: number): Promise<number>
  getHistoryPath(featureName: string): string
}
```

**Test Cases:**
1. Record first transition creates history.json
2. Record subsequent transitions appends to array
3. Get history returns in chronological order
4. Get history with limit returns last N entries
5. Prune history removes oldest entries
6. Handle corrupted history.json gracefully

**Acceptance Criteria:**
- [ ] History stored in `.claude/plans/features/<name>/history.json`
- [ ] Max 50 entries by default (configurable)
- [ ] Entries include: timestamp, fromPhase, toPhase, trigger, duration
- [ ] Atomic writes to prevent corruption
- [ ] Coverage >= 85%

**Dependencies:** Task 1.1
**Story Points:** 2

---

### Task 2.2: Implement SnapshotManager - Creation

**Objective:** Create snapshots at critical transition points

**Files to Create:**
- `src/utils/snapshot-manager.ts`
- `tests/utils/snapshot-manager.test.ts`

**Class Structure:**
```typescript
class SnapshotManager {
  createSnapshot(featureName: string, trigger: string): Promise<string>
  getSnapshotPath(featureName: string): string
  listSnapshots(featureName: string): Promise<SnapshotMeta[]>
}

interface SnapshotMeta {
  id: string
  trigger: string
  createdAt: string
  files: string[]
}
```

**Test Cases:**
1. Create snapshot with semantic name (pre-implement-2026-01-20)
2. Snapshot includes progress.md content
3. Snapshot includes tasks.md content
4. Snapshot includes state.json content
5. Snapshot metadata saved correctly
6. List snapshots returns all available

**Acceptance Criteria:**
- [ ] Snapshots stored in `.claude/plans/features/<name>/.snapshots/`
- [ ] Semantic naming: `{trigger}-{YYYY-MM-DD}.json`
- [ ] Include all relevant state files
- [ ] No secrets in snapshots (filter env vars)
- [ ] Coverage >= 85%

**Dependencies:** Task 1.4
**Story Points:** 2

---

### Task 2.3: Implement SnapshotManager - Restore & Cleanup

**Objective:** Restore from snapshots and auto-cleanup old ones

**Files to Modify:**
- `src/utils/snapshot-manager.ts`
- `tests/utils/snapshot-manager.test.ts`

**Functions to Add:**
```typescript
restoreSnapshot(featureName: string, snapshotId: string): Promise<void>
cleanupOldSnapshots(featureName: string, maxCount: number): Promise<number>
```

**Test Cases:**
1. Restore snapshot overwrites current state files
2. Restore creates backup of current state first
3. Cleanup keeps only N most recent snapshots
4. Cleanup returns count of deleted snapshots
5. Invalid snapshot ID throws descriptive error
6. Restore records transition in history

**Acceptance Criteria:**
- [ ] Restore is atomic (all-or-nothing)
- [ ] Backup created before restore
- [ ] Auto-cleanup keeps max 10 snapshots (configurable)
- [ ] Coverage >= 85%

**Dependencies:** Task 2.2
**Story Points:** 2

---

### Task 2.4: Integrate Snapshots at Phase Transitions

**Objective:** Automatically create snapshots before critical phases

**Files to Modify:**
- `src/commands/feature.ts`
- `src/utils/state-manager.ts`

**Integration Points:**
- Before `implement` command: create "pre-implement" snapshot
- Before `qa` command: create "pre-qa" snapshot
- Before `finish` command: create "pre-finish" snapshot

**Test Cases:**
1. Implement command creates snapshot
2. QA command creates snapshot
3. Finish command creates snapshot
4. Snapshot not created if phase already completed
5. Snapshot creation failure doesn't block command

**Acceptance Criteria:**
- [ ] Snapshots created automatically at correct points
- [ ] Failure is logged but doesn't block workflow
- [ ] Snapshot includes timestamp in metadata
- [ ] History records snapshot creation

**Dependencies:** Task 2.2, Task 2.3
**Story Points:** 1

---

## Phase 2 Checkpoint

**Verification:**
1. Run all Phase 2 tests: `npm test -- tests/utils/history-tracker.test.ts tests/utils/snapshot-manager.test.ts`
2. Manual test: Execute `adk feature implement test-feature` and verify snapshot created
3. Check `.snapshots/` directory structure
4. Verify history.json records transitions

---

## Phase 3: Conflict Resolution

**Objective:** Detect and resolve inconsistencies between progress.md and tasks.md

**Duration Estimate:** 6 story points

### Task 3.1: Implement Inconsistency Detection

**Objective:** Detect when progress.md and tasks.md are out of sync

**Files to Create:**
- `src/utils/progress-conflict.ts`
- `tests/utils/progress-conflict.test.ts`

**Types:**
```typescript
interface ProgressInconsistency {
  type: 'phase_mismatch' | 'task_status_mismatch' | 'orphan_task' | 'missing_required'
  severity: 'warning' | 'error'
  description: string
  field: string
  progressValue?: unknown
  tasksValue?: unknown
}
```

**Functions:**
```typescript
detectInconsistencies(state: UnifiedFeatureState): ProgressInconsistency[]
```

**Test Cases:**
1. Phase "completed" but P0 tasks pending → error
2. Tasks "in_progress" but phase already advanced → warning
3. Task exists in tasks.md but no corresponding phase → warning (orphan)
4. Phase "completed" with all tasks done → no inconsistency
5. Empty tasks.md → no inconsistency (graceful degradation)

**Acceptance Criteria:**
- [ ] Detects all inconsistency types from PRD
- [ ] Assigns appropriate severity levels
- [ ] Provides actionable descriptions
- [ ] Coverage >= 90%

**Dependencies:** Task 1.5
**Story Points:** 2

---

### Task 3.2: Implement Resolution Strategies

**Objective:** Apply resolution strategies to fix inconsistencies

**Files to Modify:**
- `src/utils/progress-conflict.ts`
- `tests/utils/progress-conflict.test.ts`

**Types:**
```typescript
type ProgressConflictStrategy = 'progress-wins' | 'tasks-wins' | 'merge' | 'manual'

interface ResolutionResult {
  applied: boolean
  changes: Change[]
  requiresManual: boolean
}
```

**Functions:**
```typescript
resolveInconsistencies(
  state: UnifiedFeatureState,
  inconsistencies: ProgressInconsistency[],
  strategy: ProgressConflictStrategy
): ResolutionResult
```

**Test Cases:**
1. progress-wins: Phase status overrides task status
2. tasks-wins: Task completion updates phase status
3. merge: Combines information from both (union)
4. manual: Returns requiresManual=true without changes
5. Resolution updates lastSynced timestamp

**Acceptance Criteria:**
- [ ] All 4 strategies implemented
- [ ] Changes tracked for audit
- [ ] No data loss during resolution
- [ ] Coverage >= 85%

**Dependencies:** Task 3.1
**Story Points:** 2

---

### Task 3.3: Implement SyncEngine

**Objective:** Orchestrate full sync between progress.md and tasks.md

**Files to Create:**
- `src/utils/sync-engine.ts`
- `tests/utils/sync-engine.test.ts`

**Class Structure:**
```typescript
class SyncEngine {
  constructor(options: SyncEngineOptions)

  sync(featureName: string, options?: SyncOptions): Promise<SyncResult>
  dryRun(featureName: string): Promise<SyncPreview>

  private detectChanges(): Promise<Changes>
  private applyChanges(changes: Changes): Promise<void>
}

interface SyncResult {
  success: boolean
  changesApplied: Change[]
  inconsistenciesResolved: number
  snapshotCreated?: string
  duration: number
}
```

**Test Cases:**
1. Sync with no changes returns success with empty changes
2. Sync detects and resolves inconsistencies
3. Sync creates snapshot before applying changes
4. Sync updates both progress.md and tasks.md
5. Dry run returns preview without making changes
6. Sync failure rolls back to pre-sync state

**Acceptance Criteria:**
- [ ] Atomic sync (all-or-nothing)
- [ ] Rollback on failure
- [ ] Dry-run mode for preview
- [ ] Records transition in history
- [ ] Coverage >= 85%

**Dependencies:** Task 3.1, Task 3.2, Task 2.2
**Story Points:** 3

---

### Task 3.4: Implement `feature sync` Command

**Objective:** Add CLI command for manual sync

**Files to Modify:**
- `src/commands/feature.ts`
- `src/cli.ts`

**Command Signature:**
```bash
adk feature sync <name> [--strategy <progress|tasks|merge>] [--dry-run] [--verbose]
```

**Test Cases:**
1. Command executes sync with default strategy
2. --strategy flag overrides default
3. --dry-run shows preview without changes
4. --verbose shows detailed log
5. Error message when feature doesn't exist
6. Success message with summary of changes

**Acceptance Criteria:**
- [ ] Command registered in CLI
- [ ] All flags working correctly
- [ ] Clear output messages
- [ ] Exit code 0 on success, 1 on failure

**Dependencies:** Task 3.3
**Story Points:** 1

---

## Phase 3 Checkpoint

**Verification:**
1. Run all Phase 3 tests
2. Manual test: Create feature with mismatched progress.md and tasks.md
3. Run `adk feature sync test-feature --dry-run` and verify preview
4. Run `adk feature sync test-feature` and verify resolution
5. Check history.json includes sync transition

---

## Phase 4: Metrics & UX

**Objective:** Add metrics collection and improve user experience with unified status

**Duration Estimate:** 6 story points

### Task 4.1: Implement MetricsCollector

**Objective:** Collect and aggregate feature metrics automatically

**Files to Create:**
- `src/utils/metrics-collector.ts`
- `tests/utils/metrics-collector.test.ts`

**Class Structure:**
```typescript
class MetricsCollector {
  collectPhaseMetrics(featureName: string, phase: string): Promise<PhaseMetrics>
  getFilesChanged(featureName: string, since?: string): Promise<string[]>
  aggregateMetrics(featureName: string): Promise<AggregatedMetrics>
  getMetricsPath(featureName: string): string
}

interface PhaseMetrics {
  phase: string
  startedAt: string
  completedAt?: string
  duration?: number
  tasksCompleted: number
  tasksTotal: number
  filesModified: string[]
}

interface AggregatedMetrics {
  totalDuration: number
  phasesDuration: Record<string, number>
  filesModified: number
  testsAdded: number
}
```

**Test Cases:**
1. Collect metrics for phase with git diff
2. Handle phase without git changes
3. Aggregate metrics from all phases
4. Save metrics to metrics.json
5. Load existing metrics

**Acceptance Criteria:**
- [ ] Uses simple-git for file change detection
- [ ] Metrics stored in `.claude/plans/features/<name>/metrics.json`
- [ ] Duration calculated from history timestamps
- [ ] Coverage >= 80%

**Dependencies:** Task 2.1
**Story Points:** 2

---

### Task 4.2: Implement `--unified` Flag for Status

**Objective:** Add unified view to feature status command

**Files to Modify:**
- `src/commands/feature.ts`

**Command Enhancement:**
```bash
adk feature status <name> --unified
```

**Output Format:**
```
Feature: my-feature
Phase: implement (in_progress)
Progress: 65% (13/20 tasks)

Tasks by Status:
  ✓ Completed: 13
  ⟳ In Progress: 2
  ○ Pending: 5
  ! Blocked: 0

Tasks by Priority:
  P0: 5/5 (100%)
  P1: 6/8 (75%)
  P2: 2/7 (29%)

⚠ Inconsistencies Detected: 1
  - Phase 'implement' is in_progress but has pending P0 tasks

Recent Transitions:
  - 2026-01-20 10:30 - tasks → arquitetura (adk feature next)
  - 2026-01-20 14:15 - arquitetura → implement (adk feature next)

Recommended Action: Complete P0 tasks before moving to QA
```

**Test Cases:**
1. Status without flag shows basic info
2. Status with --unified shows full view
3. Inconsistencies highlighted with warning color
4. Recent transitions from history
5. Recommended action based on state

**Acceptance Criteria:**
- [ ] Flag working correctly
- [ ] Output formatted with chalk
- [ ] Inconsistencies shown prominently
- [ ] History limited to last 5 entries

**Dependencies:** Task 1.5, Task 3.1
**Story Points:** 2

---

### Task 4.3: Implement Restore Command

**Objective:** Allow restoring feature state from snapshot

**Files to Modify:**
- `src/commands/feature.ts`
- `src/cli.ts`

**Command Signature:**
```bash
adk feature restore <name> --to <snapshot-id>
adk feature restore <name> --list
```

**Test Cases:**
1. --list shows available snapshots
2. --to with valid ID restores snapshot
3. --to with invalid ID shows error
4. Restore prompts for confirmation
5. Restore creates backup before overwriting

**Acceptance Criteria:**
- [ ] List shows snapshots with dates and triggers
- [ ] Confirmation prompt before restore
- [ ] Backup created automatically
- [ ] History records restore operation

**Dependencies:** Task 2.3
**Story Points:** 1

---

### Task 4.4: Automatic Sync After Phase Commands

**Objective:** Trigger sync automatically after phase completion

**Files to Modify:**
- `src/commands/feature.ts`

**Integration Points:**
- After `feature prd <name>` completes
- After `feature research <name>` completes
- After `feature plan <name>` completes
- After `feature implement <name>` completes
- After `workflow qa <name>` completes

**Test Cases:**
1. Sync triggered after prd command
2. Sync failure logged but doesn't block command
3. --no-sync flag skips automatic sync
4. Sync updates both files

**Acceptance Criteria:**
- [ ] Sync automatic and transparent
- [ ] Errors logged but don't block
- [ ] --no-sync respected
- [ ] Performance < 500ms for sync

**Dependencies:** Task 3.3
**Story Points:** 1

---

### Task 4.5: Integration Tests

**Objective:** End-to-end tests for complete workflow

**Files to Create:**
- `tests/integration/progress-sync.test.ts`

**Test Scenarios:**
1. Full feature lifecycle with sync at each phase
2. Inconsistency detection and resolution
3. Snapshot creation and restore
4. Worktree sync (main → worktree → main)
5. Metrics collection across phases

**Acceptance Criteria:**
- [ ] All scenarios passing
- [ ] Tests use temp directories
- [ ] Cleanup after each test
- [ ] Coverage contribution >= 5%

**Dependencies:** All Phase 1-4 tasks
**Story Points:** 2

---

## Phase 4 Checkpoint

**Verification:**
1. Run integration tests
2. Manual E2E test: Create feature, go through all phases
3. Verify metrics.json populated
4. Test `adk feature status test-feature --unified`
5. Test `adk feature restore test-feature --list`

---

## Phase 5: Worktree Integration

**Objective:** Full integration with git worktrees for parallel development

**Duration Estimate:** 4 story points

### Task 5.1: Update Worktree Sync to Use SyncEngine

**Objective:** Replace timestamp-based sync with intelligent merge

**Files to Modify:**
- `src/utils/progress.ts`
- `tests/utils/progress.test.ts`

**Changes:**
1. `syncProgressFiles()` should use SyncEngine internally
2. Detect conflicts between main and worktree
3. Apply configured strategy (default: newest-wins)
4. Merge history from both sources

**Test Cases:**
1. Worktree newer than main → worktree data merged to main
2. Main newer than worktree → main data merged to worktree
3. Both modified → conflict detected and resolved
4. History merged without duplicates
5. Metrics preserved from both sources

**Acceptance Criteria:**
- [ ] Backward compatible with existing behavior
- [ ] No data loss during sync
- [ ] Conflicts resolved automatically
- [ ] History includes entries from both

**Dependencies:** Task 3.3
**Story Points:** 2

---

### Task 5.2: Handle Offline Queue Scenarios

**Objective:** Queue sync operations when worktree is offline

**Files to Modify:**
- `src/utils/sync-engine.ts`
- `src/utils/sync-queue.ts`

**Enhancement:**
```typescript
interface ProgressSyncQueuedOperation extends QueuedOperation {
  type: 'progress-sync'
  sourcePath: string
  targetPath: string
}
```

**Test Cases:**
1. Sync failure queues operation
2. Queue processed on next successful connection
3. Queue has max retry count
4. Old queued items expire

**Acceptance Criteria:**
- [ ] Uses existing sync-queue.ts patterns
- [ ] Max 3 retries per operation
- [ ] Queue persisted to file
- [ ] Expiration after 7 days

**Dependencies:** Task 5.1
**Story Points:** 1

---

### Task 5.3: Final QA & Polish

**Objective:** Quality assurance and edge case handling

**Activities:**
1. Run full test suite with coverage report
2. Manual testing of all commands
3. Performance profiling
4. Edge case testing

**Edge Cases to Test:**
1. Empty feature (no files)
2. Very large tasks.md (100+ tasks)
3. Corrupted JSON files
4. Concurrent sync attempts
5. Missing git repository

**Acceptance Criteria:**
- [ ] Coverage >= 85% overall
- [ ] No regressions in existing tests
- [ ] All edge cases handled gracefully
- [ ] Performance targets met

**Dependencies:** All previous tasks
**Story Points:** 1

---

## Phase 5 Checkpoint

**Verification:**
1. Run complete test suite: `npm test`
2. Check coverage: `npm run test:coverage`
3. Run lint: `npm run check`
4. Manual E2E with worktrees
5. Performance test with large feature

---

## Implementation Order Summary

```
Phase 1: Foundation (8 SP)
├── Task 1.1: Core Types [2 SP]
├── Task 1.2: Task Parser - Basic [3 SP]
├── Task 1.3: Task Parser - Criteria [2 SP]
├── Task 1.4: StateManager - Basic [3 SP]
└── Task 1.5: Integration [2 SP]
         │
         ▼
Phase 2: History & Snapshots (6 SP)
├── Task 2.1: HistoryTracker [2 SP]
├── Task 2.2: SnapshotManager - Create [2 SP]
├── Task 2.3: SnapshotManager - Restore [2 SP]
└── Task 2.4: Phase Integration [1 SP]
         │
         ▼
Phase 3: Conflict Resolution (6 SP)
├── Task 3.1: Inconsistency Detection [2 SP]
├── Task 3.2: Resolution Strategies [2 SP]
├── Task 3.3: SyncEngine [3 SP]
└── Task 3.4: feature sync Command [1 SP]
         │
         ▼
Phase 4: Metrics & UX (6 SP)
├── Task 4.1: MetricsCollector [2 SP]
├── Task 4.2: --unified Flag [2 SP]
├── Task 4.3: Restore Command [1 SP]
├── Task 4.4: Automatic Sync [1 SP]
└── Task 4.5: Integration Tests [2 SP]
         │
         ▼
Phase 5: Worktree Integration (4 SP)
├── Task 5.1: Worktree SyncEngine [2 SP]
├── Task 5.2: Offline Queue [1 SP]
└── Task 5.3: Final QA [1 SP]
```

**Total:** 30 story points across 18 tasks

---

## Testing Strategy

### Unit Tests (per component)
- Target: >= 85% coverage
- Location: `tests/utils/<component>.test.ts`
- Pattern: AAA (Arrange, Act, Assert)
- Mocking: Jest mocks for fs-extra, simple-git

### Integration Tests
- Location: `tests/integration/progress-sync.test.ts`
- Scenarios: Full workflow, error recovery, edge cases
- Environment: Temp directories, isolated git repos

### Manual Testing Checklist
- [ ] Create new feature with `adk feature new test-sync`
- [ ] Progress through phases: prd → research → plan → implement
- [ ] Verify snapshots created at each critical point
- [ ] Intentionally create inconsistency
- [ ] Run `adk feature sync test-sync --dry-run`
- [ ] Run `adk feature sync test-sync`
- [ ] Check `adk feature status test-sync --unified`
- [ ] Restore from snapshot: `adk feature restore test-sync --to pre-implement`
- [ ] Test in worktree environment

---

## Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Full sync (50 tasks) | < 500ms | `console.time()` |
| Load unified state | < 100ms | `console.time()` |
| Create snapshot | < 200ms | `console.time()` |
| Parse tasks.md | < 50ms | `console.time()` |
| Existing command overhead | < 10% | Benchmark comparison |

---

## Risk Mitigation

### Risk: Corrupted State
**Mitigation:** All writes are atomic (temp file + rename). Backup created before any destructive operation.

### Risk: tasks.md Parsing Complexity
**Mitigation:** Comprehensive test suite with real-world examples. Graceful degradation when parsing fails.

### Risk: Performance Degradation
**Mitigation:** Lazy loading, caching, and profiling. Performance tests in CI.

### Risk: Backward Compatibility
**Mitigation:** All new fields are optional. Features without tasks.md continue to work.

---

## Files Summary

### New Files (12)
```
src/types/progress-sync.ts
src/utils/task-parser.ts
src/utils/state-manager.ts
src/utils/sync-engine.ts
src/utils/history-tracker.ts
src/utils/snapshot-manager.ts
src/utils/metrics-collector.ts
src/utils/progress-conflict.ts
tests/utils/task-parser.test.ts
tests/utils/state-manager.test.ts
tests/utils/sync-engine.test.ts
tests/integration/progress-sync.test.ts
```

### Modified Files (4)
```
src/commands/feature.ts
src/utils/progress.ts
src/cli.ts
src/types/index.ts
```

---

## Definition of Done

- [ ] All tests passing (`npm test`)
- [ ] Coverage >= 85% (`npm run test:coverage`)
- [ ] No lint errors (`npm run check`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All acceptance criteria met for each task
- [ ] Manual testing completed
- [ ] Performance targets achieved
- [ ] No regressions in existing functionality
