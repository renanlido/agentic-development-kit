# Research: techniques-implementation

## Current State Analysis

The ADK codebase is a mature CLI toolkit with **35+ implemented components** across 6 main areas:
- **CLI Commands** (12 main commands in `src/cli.ts`)
- **Agents** (9 agents in `.claude/agents/`)
- **Skills** (4 skills in `.claude/skills/`)
- **Slash Commands** (10 commands in `.claude/commands/`)
- **State Management Utilities** (7 utilities in `src/utils/`)
- **Hooks** (5 hooks in `.claude/hooks/`)

### Value Delivery Gap Identified

| Component | Implemented | Exposed/Integrated | Gap |
|-----------|-------------|-------------------|-----|
| StateManager | ✅ | ❌ No CLI | Need `feature sync` |
| SyncEngine | ✅ | ❌ No CLI | Need `feature sync` |
| SnapshotManager | ✅ | ❌ No CLI | Need `feature restore` |
| HistoryTracker | ✅ | ❌ No CLI | Need `feature history` |
| MetricsCollector | ✅ | ❌ No CLI | Need `--unified` flag |
| reviewer-secondary | ✅ | ❌ Not in pipeline | Need `/implement` integration |
| documenter | ✅ | ❌ No slash command | Need `/docs` command |

## Similar Components

### Existing Subcommand Pattern (src/commands/feature.ts)

The feature command class uses a consistent pattern for subcommands:

```typescript
async methodName(name: string, options: FeatureOptions = {}): Promise<void> {
  const spinner = ora('Message...').start()

  try {
    // 1. Validate worktree requirement (if needed)
    if (!this.isInWorktreeForFeature(name)) {
      // Handle worktree setup
    }

    // 2. Load/update progress
    let progress = await loadProgress(name)
    progress = updateStepStatus(progress, 'step', 'in_progress')
    await saveProgress(name, progress)

    // 3. Execute Claude prompt or utility
    await executeClaudeCommand(prompt, { model })

    // 4. Update progress and sync
    progress = updateStepStatus(progress, 'step', 'completed')
    await saveProgress(name, progress)
    await this.syncProgressState(name, 'from', 'to', 'trigger')

    // 5. Update focus and memory
    await this.setActiveFocus(name, 'status')
    await memoryCommand.save(name, { phase: 'step' })

    spinner.succeed('Success message')
  } catch (error) {
    spinner.fail('Error message')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

### Slash Command Pattern (.claude/commands/*.md)

Slash commands follow this structure:

```markdown
---
description: Brief description
---

# Command Name

## Argumento Recebido
O argumento passado foi: `$ARGUMENTS`

## Validar Argumento
[Validation logic with error messages]

## Processo
### 1. Step One
[Instructions for step]

### 2. Step Two
[Instructions using Task tool to delegate to agent]

## Output
[Success message format]

## Importante
[Key constraints and rules]
```

### State Management Components

**StateManager** (`src/utils/state-manager.ts:237 lines`)
- `loadUnifiedState(feature)` - Consolidates progress.md + tasks.md
- `saveUnifiedState(feature, state)` - Persists unified state
- `calculateProgress(tasks)` - Returns 0-100 percentage
- Uses atomic writes with temp files

**SyncEngine** (`src/utils/sync-engine.ts:131 lines`)
- `sync(feature, options)` - Full synchronization with history tracking
- `dryRun(feature)` - Preview changes without applying
- Creates snapshots automatically on conflicts
- Returns `ProgressSyncResult` with changes and duration

**SnapshotManager** (`src/utils/snapshot-manager.ts:139 lines`)
- `createSnapshot(feature, trigger)` - Creates timestamped backup
- `listSnapshots(feature)` - Returns sorted list with metadata
- `restoreSnapshot(feature, snapshotId)` - Restores with pre-restore backup
- `cleanupOldSnapshots(feature, keepCount)` - Maintains 10 max

**HistoryTracker** (`src/utils/history-tracker.ts:118 lines`)
- `recordTransition(feature, entry)` - Thread-safe with mutex
- `getHistory(feature, limit?)` - Retrieves transition log
- `pruneHistory(feature, keepCount)` - Auto-prunes at 50 entries
- Uses atomic writes with temp files

**MetricsCollector** (`src/utils/metrics-collector.ts:141 lines`)
- `collectPhaseMetrics(feature, phase)` - Per-phase statistics
- `aggregateMetrics(feature)` - Combined metrics
- Integrates with HistoryTracker and TaskParser

## Technical Stack

### Core Dependencies (Already in package.json)
- **Commander.js v14** - CLI argument parsing (used extensively)
- **Inquirer v13** - Interactive prompts (already used for confirmations)
- **Ora v9** - Terminal spinners (used in all commands)
- **Chalk v5** - Terminal colors (used throughout)
- **fs-extra v11** - File operations (standard in codebase)

### Runtime Requirements
- Node.js >= 18.0.0
- Claude Code CLI installed
- Git repository (for worktree operations)

## Files to Create

- [ ] `.claude/commands/docs.md` - New slash command for `/docs`
  - Delegates to `documenter` agent
  - Supports scope parameter (api, readme, changelog)

## Files to Modify

### Phase 1: Quick Wins

- [ ] `.claude/commands/implement.md` - Add `reviewer-secondary` to pipeline
  - After Step 3 (Review), add Step 3.5 (Secondary Review)
  - Use Task tool to delegate to `reviewer-secondary` agent
  - Save output to `secondary-review.md`

### Phase 2: CLI Enhancement

- [ ] `src/commands/feature.ts` - Add 4 new subcommands
  - `async sync(name, options)` - Uses existing SyncEngine
  - `async restore(name, options)` - Uses existing SnapshotManager
  - `async history(name)` - Uses existing HistoryTracker
  - Modify `async status(name)` to add `--unified` flag

- [ ] `src/cli.ts` - Register new subcommands
  - Add `feature sync <name>` with flags: `--strategy`, `--dry-run`, `--verbose`
  - Add `feature restore <name>` with flags: `--list`, `--to <id>`
  - Add `feature history <name>` with optional `--limit`
  - Add `--unified` flag to existing `feature status` (if exists)

### Phase 3: Workflow Optimization

- [ ] `.claude/commands/new-feature.md` - Integrate Plan Mode
  - Add interview pattern with structured questions
  - Add `--skip-plan` flag documentation
  - Require approval before proceeding

### Phase 4: Documentation

- [ ] `CLAUDE.md` - Document all new commands
  - New CLI commands section for sync/restore/history
  - Update workflow documentation
  - Add MCP integration examples section

## Dependencies

### External (Already Available)
- `commander` - CLI registration
- `inquirer` - Interactive prompts
- `ora` - Progress spinners
- `chalk` - Terminal colors
- `fs-extra` - File operations

### Internal (Ready for Reuse)
- `StateManager` from `src/utils/state-manager.ts`
- `SyncEngine` from `src/utils/sync-engine.ts`
- `SnapshotManager` from `src/utils/snapshot-manager.ts`
- `HistoryTracker` from `src/utils/history-tracker.ts`
- `MetricsCollector` from `src/utils/metrics-collector.ts`
- `documenter` agent from `.claude/agents/documenter.md`
- `reviewer-secondary` agent from `.claude/agents/reviewer-secondary.md`

## Risks

### Risk 1: Parallel Execution Complexity
**Description:** Implementing parallel agent execution (Phase 3) is complex and may introduce race conditions.
**Impact:** High
**Probability:** Medium
**Mitigation:**
- Start with research phase to understand Claude Code parallelism
- Use existing `Promise.all` patterns for simple parallelism
- Implement mutex/locks for shared resources
- Consider deferring full parallelism to future iteration

### Risk 2: Breaking Changes to implement.md
**Description:** Adding reviewer-secondary to the pipeline may break existing workflows.
**Impact:** Medium
**Probability:** Low
**Mitigation:**
- Add as optional step (non-blocking if agent fails)
- Allow skip via `--skip-secondary-review` flag
- Keep existing output intact, add new file

### Risk 3: State Sync Edge Cases
**Description:** The SyncEngine may not handle all edge cases when files are partially modified.
**Impact:** Medium
**Probability:** Medium
**Mitigation:**
- Always create snapshot before sync
- Implement dry-run mode (already exists)
- Graceful fallback on parsing errors (already implemented)

### Risk 4: CLI Complexity Growth
**Description:** Adding 4 new subcommands increases CLI surface area.
**Impact:** Low
**Probability:** Low
**Mitigation:**
- Keep consistent with existing patterns
- Comprehensive help text
- Update CLAUDE.md documentation

## Patterns to Follow

### Pattern 1: Subcommand Registration (src/cli.ts:53-124)
```typescript
feature
  .command('sync <name>')
  .description('Sincroniza estado progress.md com tasks.md')
  .option('--strategy <type>', 'Estratégia: merge|tasks-wins|progress-wins', 'merge')
  .option('--dry-run', 'Mostra mudanças sem aplicar')
  .option('--verbose', 'Saída detalhada')
  .action((name, options) => featureCommand.sync(name, options))
```

### Pattern 2: Error Handling with Spinner (src/commands/feature.ts)
```typescript
const spinner = ora('Syncing...').start()
try {
  // work
  spinner.succeed('Sync completed')
} catch (error) {
  spinner.fail('Sync failed')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### Pattern 3: Slash Command Agent Delegation
```markdown
### N. Step Name

Use o Task tool para delegar ao agent `agent-name`:

**Instruções:**
- Leia arquivo X
- Execute ação Y
- Salve em arquivo Z
```

### Pattern 4: Interactive Prompts (src/commands/feature.ts:375-400)
```typescript
const { action } = await inquirer.prompt([
  {
    type: 'list',
    name: 'action',
    message: 'O que deseja fazer?',
    choices: [
      { name: 'Option 1', value: 'opt1' },
      { name: 'Option 2', value: 'opt2' },
    ],
  },
])
```

## Performance Considerations

### Current Performance (from tests)
| Operation | Target | Actual |
|-----------|--------|--------|
| Full sync (50 tasks) | < 500ms | ~300ms |
| Load unified state | < 100ms | ~50ms |
| Create snapshot | < 200ms | ~150ms |
| Parse tasks.md | < 50ms | ~20ms |

### Recommendations
1. **Caching:** StateManager already caches in `state.json` - reuse this
2. **Atomic Writes:** All utilities use temp files + move - maintain this pattern
3. **Lazy Loading:** Only load full state when `--unified` flag used
4. **Parallel I/O:** When possible, use `Promise.all` for independent file operations

## Security Considerations

### Input Validation
- All feature names should be sanitized (already done via `replace(/[^a-zA-Z0-9-]/g, '-')`)
- Snapshot IDs should be validated before restore
- Strategy options should be from whitelist

### File Operations
- Restore should create pre-restore snapshot (already implemented)
- Never expose full file paths in user-facing output
- Validate feature exists before operations

### No New Secrets
- No new API keys or tokens required
- Uses existing project configuration patterns

## Implementation Priority

### Phase 1: Quick Wins (Lowest Risk, Highest Value)
1. Add `reviewer-secondary` to `/implement` pipeline
2. Create `/docs` slash command
3. Document `/daily` workflow

### Phase 2: CLI Enhancement (Medium Risk, High Value)
4. Implement `adk feature sync`
5. Implement `adk feature restore`
6. Implement `adk feature history`
7. Add `--unified` to status

### Phase 3: Workflow Optimization (Higher Risk, Medium Value)
8. Plan Mode integration
9. Parallel execution research
10. Parallel implementation

### Phase 4: Documentation (Low Risk, Required)
11. Update CLAUDE.md
12. MCP integration docs
13. Extended Thinking docs

## Test Coverage Requirements

All new functionality must maintain >= 80% coverage:

| Component | Current Coverage | Required |
|-----------|-----------------|----------|
| state-manager.ts | 87% | >= 80% |
| sync-engine.ts | 85% | >= 80% |
| snapshot-manager.ts | 88% | >= 80% |
| history-tracker.ts | 86% | >= 80% |
| **New sync command** | N/A | >= 80% |
| **New restore command** | N/A | >= 80% |
| **New history command** | N/A | >= 80% |

## Conclusion

This feature has **low implementation risk** because:
1. Core functionality already exists in utilities
2. Patterns are well-established in codebase
3. Changes are additive, not breaking

The main work is **wiring existing components** to CLI and slash commands, following established patterns. Phase 1 can be completed quickly, providing immediate value. Phases 2-4 follow incrementally.
