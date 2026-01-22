# Progress Sync System

The Progress Sync System maintains state consistency between `progress.md` and `tasks.md`, providing intelligent synchronization, conflict detection, and historical tracking.

## Architecture

Components in `src/utils/`:

| Component | Purpose |
|-----------|---------|
| `state-manager.ts` | Unified state management, caching in `state.json` |
| `sync-engine.ts` | Bidirectional sync orchestration |
| `task-parser.ts` | Parses tasks.md (status: `[ ]`, `[x]`, `[~]`, `[!]`) |
| `progress-conflict.ts` | Inconsistency detection & resolution |
| `history-tracker.ts` | Transition audit trail (max 50 entries) |
| `snapshot-manager.ts` | State snapshots (max 10, auto-cleanup) |
| `metrics-collector.ts` | Phase metrics collection |

## File Structure

```
.claude/plans/features/<feature>/
├── progress.md      # High-level phase status
├── tasks.md         # Detailed task breakdown
├── state.json       # Cached unified state
├── history.json     # Transition history
├── metrics.json     # Aggregated metrics
└── .snapshots/      # State snapshots
```

## CLI Commands

### feature sync
```bash
adk feature sync <name>                           # Merge strategy (default)
adk feature sync <name> --strategy tasks-wins     # Tasks drive state
adk feature sync <name> --strategy progress-wins  # Progress drives state
adk feature sync <name> --dry-run                 # Preview changes
```

### feature restore
```bash
adk feature restore <name> --list              # List snapshots
adk feature restore <name> --to <snapshot-id>  # Restore to snapshot
```

### feature history
```bash
adk feature history <name>           # Full history
adk feature history <name> --limit 5 # Last 5 transitions
```

### feature status --unified
```bash
adk feature status <name> --unified  # Full consolidated view
```

## Conflict Resolution Strategies

| Strategy | Behavior |
|----------|----------|
| `merge` (default) | Intelligent combination from both sources |
| `progress-wins` | Phase status overrides task status |
| `tasks-wins` | Task completion updates phase status |
| `manual` | Generates `conflict-report.md` for human intervention |

## Unified State Schema

```typescript
interface UnifiedFeatureState {
  feature: string
  currentPhase: string
  progress: number              // 0-100 calculated from tasks
  tasks: TaskState[]
  transitions: TransitionEntry[]
  lastUpdated: string
  lastSynced: string
}

interface TaskState {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority?: number
  phase?: string
  startedAt?: string
  completedAt?: string
}
```

## Automatic Integration

Sync runs automatically after phase commands via `syncProgressState()`:
- `adk feature create/research/plan/implement`
- `adk workflow qa`

## Performance

| Operation | Target | Actual |
|-----------|--------|--------|
| Full sync (50 tasks) | < 500ms | ~300ms |
| Load unified state | < 100ms | ~50ms |
| Create snapshot | < 200ms | ~150ms |
| Parse tasks.md | < 50ms | ~20ms |

## Programmatic API

```typescript
import { StateManager } from './utils/state-manager'
import { SyncEngine } from './utils/sync-engine'

const manager = new StateManager()
const state = await manager.loadUnifiedState('my-feature')

const engine = new SyncEngine({ strategy: 'merge' })
const result = await engine.sync('my-feature')
```

## Important Notes

**Two different sync systems exist:**
1. **Progress Sync** (this doc) - Syncs `progress.md` ↔ `tasks.md` locally
2. **Project Management Sync** - Syncs with external tools (ClickUp)

The `adk sync` command = Project Management sync.
The `adk feature sync` command = Progress sync.
