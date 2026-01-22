# Project Management Integration

Optional integration with project management platforms for visual tracking and bidirectional sync. Designed as **opt-in** and **offline-first**.

## Provider Architecture

```
src/providers/
├── types.ts         # Core interfaces (ProjectProvider, SyncResult)
├── index.ts         # Provider registry and factory
├── local.ts         # Local-only provider (default fallback)
└── clickup/
    ├── index.ts     # ClickUpProvider implementation
    ├── client.ts    # HTTP client for ClickUp API v2
    ├── mapper.ts    # ADK ↔ ClickUp data mapping
    └── types.ts     # ClickUp-specific types
```

**ProjectProvider Interface:**
- `connect(credentials)` - Authenticate
- `createFeature(feature)` - Create in remote
- `updateFeature(id, data)` - Update existing
- `syncFeature(feature, remoteId?)` - Smart create-or-update
- `getRemoteChanges(since)` - Get changes since timestamp

## Configuration

**File:** `.adk/config.json` (non-versioned)

```json
{
  "version": "1.0.0",
  "integration": {
    "provider": "clickup",
    "enabled": true,
    "autoSync": false,
    "syncOnPhaseChange": true,
    "conflictStrategy": "local-wins"
  },
  "providers": {
    "clickup": {
      "workspaceId": "123456",
      "spaceId": "789012",
      "listId": "345678"
    }
  }
}
```

**API tokens in `.env`:**
```bash
CLICKUP_API_TOKEN=pk_12345678_XXXXXXXXXXXX
```

## CLI Commands

```bash
# Configuration
adk config integration clickup   # Interactive setup
adk config integration --show    # View current
adk config integration --disable # Disable

# Synchronization
adk sync                    # Sync all pending
adk sync <feature-name>     # Sync specific
adk sync --force            # Re-sync already synced

# Import
adk import                  # Import all tasks
adk import --list           # List without importing
adk import --dry-run        # Preview
adk import --id <task-id>   # Import specific
```

## Offline Queue

Failed operations queued in `.adk/sync-queue.json`:
- Max 3 retries with exponential backoff
- `adk sync` processes pending queue
- Queue persists across sessions

**Utilities** (`src/utils/sync-queue.ts`):
- `createSyncQueue()`, `enqueue()`, `dequeue()`
- `getPendingCount()`, `hasFeaturePending(name)`

## Conflict Resolution

| Strategy | Behavior |
|----------|----------|
| `local-wins` | Local overrides remote (default) |
| `remote-wins` | Remote overrides local |
| `newest-wins` | Compare timestamps |
| `manual` | Generate conflict report |

## ClickUp Mapping

| ADK | ClickUp |
|-----|---------|
| Feature name | Task name |
| Phase | Task status |
| Progress (%) | Custom field |
| PRD content | Task description |

**Status mapping:**
- "to do", "open" → `prd`
- "in progress" → `implement`
- "review", "testing" → `qa`
- "complete", "done" → `done`

## Adding New Providers

1. Create `src/providers/<name>/`
2. Implement `ProjectProvider` interface
3. Create HTTP client with rate limiting
4. Add mapper for data translation
5. Register in `src/providers/index.ts`
6. Add to `SUPPORTED_PROVIDERS` in `src/commands/config.ts`
