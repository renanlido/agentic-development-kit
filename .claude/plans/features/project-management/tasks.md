# Tasks: project-management

## Overview

This feature implements optional integration with ClickUp for project management visibility.
Tasks are ordered following TDD principles: **tests BEFORE implementation**.

Total Tasks: 32
Estimated Phases: 5 (Foundation → ClickUp Basic → Sync System → Robustness → Polish)

---

## Phase 1: Foundation (Core Infrastructure)

### Task 1: Define Provider Types and Interfaces
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: nenhuma
- **Arquivos**: `src/types/provider.ts`, `src/providers/types.ts`
- **Acceptance Criteria**:
  - [ ] Interface `ProjectProvider` defined with methods: `connect()`, `sync()`, `getStatus()`, `disconnect()`
  - [ ] Types for `SyncResult`, `SyncStatus`, `ProviderConfig` defined
  - [ ] Types for `RemoteFeature`, `RemoteTask` defined
  - [ ] All types exported and documented with JSDoc

### Task 2: Tests for Config Utils
- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: Task 1
- **Arquivos**: `tests/utils/config.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `loadConfig()` returns default when no config exists
  - [ ] Test `saveConfig()` persists configuration to file
  - [ ] Test `getIntegrationConfig()` extracts integration section
  - [ ] Test `updateIntegrationConfig()` merges partial updates
  - [ ] Test config file is created in correct location (`.adk/config.json`)
  - [ ] Test sensitive data validation (token not in config file)
  - [ ] Coverage >= 80%

### Task 3: Implement Config Utils
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 2
- **Arquivos**: `src/utils/config.ts`
- **Acceptance Criteria**:
  - [ ] `loadConfig()` reads from `.adk/config.json`
  - [ ] `saveConfig()` writes to `.adk/config.json`
  - [ ] `getIntegrationConfig()` returns integration section
  - [ ] `updateIntegrationConfig()` updates only integration section
  - [ ] Default config returned if file doesn't exist
  - [ ] All tests from Task 2 passing

### Task 4: Tests for Local Provider
- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: Task 1, Task 3
- **Arquivos**: `tests/providers/local.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `LocalProvider` implements `ProjectProvider` interface
  - [ ] Test `connect()` always succeeds (local is always available)
  - [ ] Test `sync()` is a no-op for local provider
  - [ ] Test `getStatus()` returns current feature state
  - [ ] Coverage >= 80%

### Task 5: Implement Local Provider
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 4
- **Arquivos**: `src/providers/local.ts`
- **Acceptance Criteria**:
  - [ ] Implements `ProjectProvider` interface
  - [ ] Wraps existing local file operations
  - [ ] `connect()` returns success immediately
  - [ ] `sync()` returns success (no-op)
  - [ ] `getStatus()` reads from local progress files
  - [ ] All tests from Task 4 passing

### Task 6: Tests for Provider Factory
- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: Task 5
- **Arquivos**: `tests/providers/index.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `getProvider('local')` returns LocalProvider instance
  - [ ] Test `getProvider('clickup')` returns ClickUpProvider instance when available
  - [ ] Test `getProvider('unknown')` throws descriptive error
  - [ ] Test `getConfiguredProvider()` returns provider based on config
  - [ ] Test `isProviderConfigured()` returns boolean
  - [ ] Coverage >= 80%

### Task 7: Implement Provider Factory
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 6
- **Arquivos**: `src/providers/index.ts`
- **Acceptance Criteria**:
  - [ ] `getProvider(name)` factory function
  - [ ] `getConfiguredProvider()` reads config and returns appropriate provider
  - [ ] `isProviderConfigured()` checks if integration is set up
  - [ ] Registry of available providers
  - [ ] All tests from Task 6 passing

---

## Phase 2: ClickUp Provider (Basic)

### Task 8: Define ClickUp Types
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 1
- **Arquivos**: `src/types/clickup.ts`, `src/providers/clickup/types.ts`
- **Acceptance Criteria**:
  - [ ] Types for ClickUp API responses (Team, Space, List, Task)
  - [ ] Types for ClickUp request payloads
  - [ ] Types for custom fields mapping
  - [ ] Zod schemas for runtime validation

### Task 9: Tests for ClickUp HTTP Client
- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: Task 8
- **Arquivos**: `tests/providers/clickup/client.test.ts`
- **Acceptance Criteria**:
  - [ ] Test client initialization with token
  - [ ] Test `getTeams()` API call
  - [ ] Test `getSpaces()` API call
  - [ ] Test `createTask()` API call
  - [ ] Test `updateTask()` API call
  - [ ] Test `getTask()` API call
  - [ ] Test authentication header is set correctly
  - [ ] Test error handling for 401 Unauthorized
  - [ ] Test error handling for 429 Rate Limit
  - [ ] Test error handling for network failures
  - [ ] Mocked HTTP responses (no real API calls)
  - [ ] Coverage >= 80%

### Task 10: Implement ClickUp HTTP Client
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 9
- **Arquivos**: `src/providers/clickup/client.ts`
- **Acceptance Criteria**:
  - [ ] Uses native `fetch` (Node.js 18+)
  - [ ] Base URL: `https://api.clickup.com/api`
  - [ ] Authorization header with token
  - [ ] JSON content type header
  - [ ] Methods: `getTeams()`, `getSpaces()`, `getLists()`, `createTask()`, `updateTask()`, `getTask()`
  - [ ] Error class `ClickUpApiError` with status code and message
  - [ ] Rate limit detection via response headers
  - [ ] All tests from Task 9 passing

### Task 11: Tests for ClickUp Mapper
- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: Task 8
- **Arquivos**: `tests/providers/clickup/mapper.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `featureToTask()` maps ADK feature to ClickUp task
  - [ ] Test `taskToFeature()` maps ClickUp task to ADK feature
  - [ ] Test `phaseToStatus()` maps ADK phases to ClickUp statuses
  - [ ] Test `statusToPhase()` maps ClickUp statuses to ADK phases
  - [ ] Test `progressToCustomField()` maps progress percentage
  - [ ] Test mapping preserves IDs correctly
  - [ ] Coverage >= 80%

### Task 12: Implement ClickUp Mapper
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 11
- **Arquivos**: `src/providers/clickup/mapper.ts`
- **Acceptance Criteria**:
  - [ ] `featureToTask(feature)` returns ClickUp task payload
  - [ ] `taskToFeature(task)` returns ADK feature data
  - [ ] `phaseToStatus(phase)` returns ClickUp status string
  - [ ] `statusToPhase(status)` returns ADK phase string
  - [ ] `progressToCustomField(progress)` returns custom field value
  - [ ] Handles missing/null values gracefully
  - [ ] All tests from Task 11 passing

### Task 13: Tests for ClickUp Provider
- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: Task 10, Task 12
- **Arquivos**: `tests/providers/clickup/index.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `connect()` validates token with API call
  - [ ] Test `connect()` stores workspace/space info
  - [ ] Test `sync()` creates new task when remote doesn't exist
  - [ ] Test `sync()` updates existing task when remote exists
  - [ ] Test `getStatus()` returns sync status
  - [ ] Test `disconnect()` clears stored state
  - [ ] Test handles API errors gracefully
  - [ ] Mocked client (no real API calls)
  - [ ] Coverage >= 80%

### Task 14: Implement ClickUp Provider
- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: Task 13
- **Arquivos**: `src/providers/clickup/index.ts`
- **Acceptance Criteria**:
  - [ ] Implements `ProjectProvider` interface
  - [ ] Uses ClickUpClient for API calls
  - [ ] Uses ClickUpMapper for data transformation
  - [ ] `connect()` validates credentials and fetches workspace info
  - [ ] `sync()` creates or updates remote task
  - [ ] `getStatus()` returns current sync state
  - [ ] `disconnect()` resets provider state
  - [ ] All tests from Task 13 passing

---

## Phase 3: CLI Commands and Integration

### Task 15: Tests for Config Command
- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: Task 3, Task 7
- **Arquivos**: `tests/commands/config.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `config integration clickup` prompts for required fields
  - [ ] Test validates token format (starts with `pk_`)
  - [ ] Test saves configuration to correct location
  - [ ] Test displays success message with next steps
  - [ ] Test `config integration --disable` disables integration
  - [ ] Test `config integration --show` displays current config (masked token)
  - [ ] Coverage >= 80%

### Task 16: Implement Config Command
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 15
- **Arquivos**: `src/commands/config.ts`
- **Acceptance Criteria**:
  - [ ] Command class `ConfigCommand` with `integration()` method
  - [ ] Interactive prompts for token, workspace, space
  - [ ] Token validation before saving
  - [ ] Saves to `.adk/config.json` and `.env`
  - [ ] Options: `--disable`, `--show`
  - [ ] Progress spinner during validation
  - [ ] All tests from Task 15 passing

### Task 17: Tests for Sync Command
- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: Task 7, Task 14
- **Arquivos**: `tests/commands/sync.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `sync` syncs all features with pending changes
  - [ ] Test `sync <feature>` syncs specific feature
  - [ ] Test displays progress for each feature
  - [ ] Test handles sync failures gracefully
  - [ ] Test shows summary of synced/failed features
  - [ ] Test when no integration configured shows message
  - [ ] Coverage >= 80%

### Task 18: Implement Sync Command
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 17
- **Arquivos**: `src/commands/sync.ts`
- **Acceptance Criteria**:
  - [ ] Command class `SyncCommand` with `run()` method
  - [ ] Accepts optional feature name argument
  - [ ] Lists features with pending sync
  - [ ] Calls provider.sync() for each feature
  - [ ] Shows progress with ora spinner
  - [ ] Summary at end: X synced, Y failed, Z skipped
  - [ ] All tests from Task 17 passing

### Task 19: Register Commands in CLI
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 16, Task 18
- **Arquivos**: `src/cli.ts`
- **Acceptance Criteria**:
  - [ ] `adk config integration <provider>` registered
  - [ ] `adk config integration --disable` registered
  - [ ] `adk config integration --show` registered
  - [ ] `adk sync [feature]` registered
  - [ ] Help text for all new commands

### Task 20: Integrate Sync with Feature Command
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 14, Task 19
- **Arquivos**: `src/commands/feature.ts`
- **Acceptance Criteria**:
  - [ ] `feature new` calls provider.sync() after creation
  - [ ] `feature research` calls provider.sync() after completion
  - [ ] `feature plan` calls provider.sync() after completion
  - [ ] `feature implement` calls provider.sync() after phase completion
  - [ ] `--no-sync` flag skips synchronization
  - [ ] Sync failures don't block local operations

---

## Phase 4: Offline Support and Robustness

### Task 21: Tests for Sync Queue
- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: Task 1
- **Arquivos**: `tests/utils/queue.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `enqueue()` adds operation to queue
  - [ ] Test `dequeue()` removes and returns oldest operation
  - [ ] Test `peek()` returns oldest without removing
  - [ ] Test `getAll()` returns all pending operations
  - [ ] Test `clear()` removes all operations
  - [ ] Test queue persists to file
  - [ ] Test queue loads from file on init
  - [ ] Coverage >= 80%

### Task 22: Implement Sync Queue
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 21
- **Arquivos**: `src/utils/queue.ts`
- **Acceptance Criteria**:
  - [ ] Interface `SyncOperation` with type, feature, timestamp
  - [ ] Class `SyncQueue` with FIFO operations
  - [ ] Persists to `.adk/sync-queue.json`
  - [ ] Loads queue on instantiation
  - [ ] Thread-safe file operations
  - [ ] All tests from Task 21 passing

### Task 23: Tests for Sync Utils with Retry
- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: Task 22, Task 14
- **Arquivos**: `tests/utils/sync.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `syncFeature()` calls provider sync
  - [ ] Test retries on transient failures (max 3)
  - [ ] Test exponential backoff between retries
  - [ ] Test adds to queue when offline
  - [ ] Test processes queue when back online
  - [ ] Test `isSyncPending()` returns boolean
  - [ ] Test `getPendingChanges()` returns list
  - [ ] Coverage >= 80%

### Task 24: Implement Sync Utils
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 23
- **Arquivos**: `src/utils/sync.ts`
- **Acceptance Criteria**:
  - [ ] `syncFeature(feature, provider)` orchestrates sync
  - [ ] Retry logic with exponential backoff (1s, 2s, 4s)
  - [ ] Network error detection
  - [ ] Queue operations when offline
  - [ ] `processQueue()` syncs pending operations
  - [ ] `isSyncPending(feature)` checks queue
  - [ ] `getPendingChanges()` lists pending ops
  - [ ] All tests from Task 23 passing

### Task 25: Tests for Conflict Detection
- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: Task 24
- **Arquivos**: `tests/utils/conflict.test.ts`
- **Acceptance Criteria**:
  - [ ] Test detects conflict when local and remote differ
  - [ ] Test no conflict when timestamps match
  - [ ] Test `resolveConflict()` with strategy 'local-wins'
  - [ ] Test `resolveConflict()` with strategy 'remote-wins'
  - [ ] Test `getConflicts()` returns list of conflicts
  - [ ] Coverage >= 80%

### Task 26: Implement Conflict Detection
- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: Task 25
- **Arquivos**: `src/utils/conflict.ts`
- **Acceptance Criteria**:
  - [ ] Interface `Conflict` with local, remote, field
  - [ ] `detectConflicts(local, remote)` compares states
  - [ ] `resolveConflict(conflict, strategy)` applies resolution
  - [ ] Strategies: 'local-wins', 'remote-wins', 'manual'
  - [ ] `getConflicts(feature)` returns pending conflicts
  - [ ] All tests from Task 25 passing

---

## Phase 5: Polish and Additional Features

### Task 27: Update Progress Utils for Sync Metadata
- **Tipo**: Implementation
- **Prioridade**: P2
- **Dependencias**: Task 3
- **Arquivos**: `src/utils/progress.ts`, `src/types/memory.ts`
- **Acceptance Criteria**:
  - [ ] `FeatureProgress` includes `remoteId?: string`
  - [ ] `FeatureProgress` includes `lastSynced?: string`
  - [ ] `FeatureProgress` includes `syncStatus?: SyncStatus`
  - [ ] `saveProgress()` persists sync metadata
  - [ ] `loadProgress()` loads sync metadata
  - [ ] Backward compatible with existing progress files

### Task 28: Tests for Remote Status Command
- **Tipo**: Test
- **Prioridade**: P2
- **Dependencias**: Task 14, Task 24
- **Arquivos**: `tests/commands/status-remote.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `status --remote` shows ClickUp status
  - [ ] Test shows divergences between local and remote
  - [ ] Test shows link to ClickUp item
  - [ ] Test shows pending sync operations
  - [ ] Test handles no integration configured
  - [ ] Coverage >= 80%

### Task 29: Implement Remote Status Flag
- **Tipo**: Implementation
- **Prioridade**: P2
- **Dependencias**: Task 28
- **Arquivos**: `src/commands/feature.ts`, `src/cli.ts`
- **Acceptance Criteria**:
  - [ ] `feature status --remote` flag added
  - [ ] Fetches current state from ClickUp
  - [ ] Compares with local state
  - [ ] Shows differences if any
  - [ ] Shows direct link to ClickUp item
  - [ ] All tests from Task 28 passing

### Task 30: Tests for Import Command
- **Tipo**: Test
- **Prioridade**: P2
- **Dependencias**: Task 14
- **Arquivos**: `tests/commands/import.test.ts`
- **Acceptance Criteria**:
  - [ ] Test `import clickup <list-id>` fetches tasks
  - [ ] Test creates feature directory for each task
  - [ ] Test imports description as PRD
  - [ ] Test imports subtasks as tasks.md
  - [ ] Test preserves mapping IDs
  - [ ] Test asks confirmation before overwriting
  - [ ] Coverage >= 80%

### Task 31: Implement Import Command
- **Tipo**: Implementation
- **Prioridade**: P2
- **Dependencias**: Task 30
- **Arquivos**: `src/commands/import.ts`, `src/cli.ts`
- **Acceptance Criteria**:
  - [ ] Command `import clickup <list-id>` registered
  - [ ] Fetches all tasks from ClickUp list
  - [ ] Creates feature structure for each task
  - [ ] Maps description to PRD content
  - [ ] Maps subtasks to tasks.md
  - [ ] Saves remote ID mapping
  - [ ] Confirmation prompt before creating
  - [ ] All tests from Task 30 passing

### Task 32: Documentation
- **Tipo**: Implementation
- **Prioridade**: P2
- **Dependencias**: Task 31
- **Arquivos**: `CLAUDE.md`, `.claude/plans/features/project-management/docs.md`
- **Acceptance Criteria**:
  - [ ] CLAUDE.md updated with new commands section
  - [ ] Integration setup guide created
  - [ ] ClickUp configuration steps documented
  - [ ] Troubleshooting guide for common issues
  - [ ] Examples of sync workflow

---

## Task Dependencies Graph

```
Phase 1 (Foundation):
Task 1 ──┬──> Task 2 ──> Task 3 ──┬──> Task 4 ──> Task 5 ──> Task 6 ──> Task 7
         │                        │
         └──> Task 8 ─────────────┘

Phase 2 (ClickUp Basic):
Task 8 ──┬──> Task 9 ──> Task 10 ──┐
         │                         ├──> Task 13 ──> Task 14
         └──> Task 11 ──> Task 12 ─┘

Phase 3 (CLI Integration):
Task 3 ──┬──> Task 15 ──> Task 16 ──┐
Task 7 ──┤                          ├──> Task 19 ──> Task 20
Task 14 ─┴──> Task 17 ──> Task 18 ──┘

Phase 4 (Robustness):
Task 1 ──> Task 21 ──> Task 22 ──> Task 23 ──> Task 24 ──> Task 25 ──> Task 26

Phase 5 (Polish):
Task 3 ──> Task 27
Task 14, Task 24 ──> Task 28 ──> Task 29
Task 14 ──> Task 30 ──> Task 31 ──> Task 32
```

---

## Summary by Type

| Tipo | Count | Tasks |
|------|-------|-------|
| Test | 14 | 2, 4, 6, 9, 11, 13, 15, 17, 21, 23, 25, 28, 30 |
| Implementation | 18 | 1, 3, 5, 7, 8, 10, 12, 14, 16, 18, 19, 20, 22, 24, 26, 27, 29, 31, 32 |

## Summary by Priority

| Prioridade | Count | Description |
|------------|-------|-------------|
| P0 | 14 | Core infrastructure, must be done first |
| P1 | 12 | Main functionality, needed for MVP |
| P2 | 6 | Polish and extras, nice to have |

---

## Implementation Notes

1. **TDD Enforcement**: Every implementation task (except pure type definitions) has a corresponding test task that MUST be completed first
2. **Atomic Tasks**: Each task is designed to be completable in 1-2 hours
3. **No Breaking Changes**: All new functionality is additive; existing commands continue to work unchanged
4. **Offline First**: Local operations always succeed; sync is secondary
5. **Security**: Tokens are never stored in versionable files; use `.env` or OS keychain
