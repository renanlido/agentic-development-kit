# Tasks: Multi AI Provider Support (gemini-integration)

**Data**: 2026-01-28
**Total Tasks**: 24
**Total Story Points**: 50
**Baseado em**: implementation-plan.md

---

## Phase 1: Foundation (8 SP)

### Task 1.1: Core Types Definition
- [x] **Status**: completed
- **SP**: 2
- **Files to create**: `src/ai-providers/types.ts`
- **Tests**: `tests/ai-providers/types.test.ts`
- **Acceptance Criteria**:
  - [x] AIProviderName type exported
  - [x] ModelTier type exported
  - [x] AIProviderModel interface exported
  - [x] AIProviderOptions interface exported
  - [x] AIProviderResult interface exported
  - [x] AIProvider interface exported
  - [x] AIProviderConfig interface exported
  - [x] Type guards working
  - [x] Re-export in `src/types/ai-provider.ts`

### Task 1.2: Stream Parser Types
- [x] **Status**: completed
- **SP**: 2
- **Files to create**: `src/ai-providers/stream-parsers/types.ts`
- **Tests**: `tests/ai-providers/stream-parsers/types.test.ts`
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - [x] NormalizedEventType union exported
  - [x] NormalizedStreamEvent interface exported
  - [x] StreamParser interface exported
  - [x] Type guards for event types
  - [x] Compatible with CollectedMetrics

### Task 1.3: Base Provider Abstract Class
- [x] **Status**: completed
- **SP**: 2
- **Files to create**: `src/ai-providers/base-provider.ts`
- **Tests**: `tests/ai-providers/base-provider.test.ts`
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - [x] `isInstalled()` with caching
  - [x] `validateModel()` working
  - [x] Abstract methods defined
  - [x] Logger integrated
  - [x] Uses execFileNoThrow for safety

### Task 1.4: AI Provider Registry
- [x] **Status**: completed
- **SP**: 2
- **Files to create**: `src/ai-providers/index.ts`
- **Tests**: `tests/ai-providers/registry.test.ts`
- **Dependencies**: Task 1.1, Task 1.3
- **Acceptance Criteria**:
  - [x] `register()` and `get()` working
  - [x] `getAll()` returns all providers
  - [x] `getConfigured()` respects config
  - [x] Auto-fallback when provider not installed
  - [x] Clear error messages with installation guide

---

## Phase 2: Claude Provider Refactor (8 SP)

### Task 2.1: Claude Stream Parser
- [~] **Status**: pending
- **SP**: 3
- **Files to create**:
  - `src/ai-providers/stream-parsers/base-parser.ts`
  - `src/ai-providers/stream-parsers/claude-parser.ts`
- **Files to modify**: `src/utils/stream-parser.ts`
- **Tests**: `tests/ai-providers/stream-parsers/claude-parser.test.ts`
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - [ ] Parse `system.init` event
  - [ ] Parse `assistant` with text
  - [ ] Parse `assistant` with tool_use
  - [ ] Parse `user` with tool_result
  - [ ] Parse `result` with metrics
  - [ ] Invalid lines return null
  - [ ] Test coverage >= 90%

### Task 2.2: Claude Provider Implementation
- [~] **Status**: pending
- **SP**: 3
- **Files to create**: `src/ai-providers/claude-provider.ts`
- **Tests**: `tests/ai-providers/claude-provider.test.ts`
- **Dependencies**: Task 1.3, Task 2.1
- **Acceptance Criteria**:
  - [ ] `isInstalled()` detects Claude CLI
  - [ ] `getDefaultModel()` returns 'sonnet'
  - [ ] `mapModelTier()` correct mapping
  - [ ] `validateModel()` accepts opus/sonnet/haiku
  - [ ] `buildArgs()` generates correct args
  - [ ] `execute()` interactive mode working
  - [ ] `executeHeadless()` with metrics working
  - [ ] Same behavior as current `executeClaudeCommand()`

### Task 2.3: Retrocompatibility Proxy
- [~] **Status**: pending
- **SP**: 1
- **Files to modify**: `src/utils/claude.ts`
- **Tests**: `tests/utils/claude.test.ts` (existing must pass)
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - [ ] All existing tests pass unchanged
  - [ ] @deprecated JSDoc added
  - [ ] Identical functionality
  - [ ] No breaking changes

### Task 2.4: Claude Provider Bootstrap
- [~] **Status**: pending
- **SP**: 1
- **Files to modify**: `src/ai-providers/index.ts`
- **Tests**: `tests/ai-providers/bootstrap.test.ts`
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - [ ] Claude available after module import
  - [ ] `getAIProvider('claude')` works
  - [ ] No unwanted side effects

---

## Phase 3: Gemini Provider (13 SP)

### Task 3.1: Gemini Stream Parser
- [~] **Status**: pending
- **SP**: 3
- **Files to create**: `src/ai-providers/stream-parsers/gemini-parser.ts`
- **Tests**: `tests/ai-providers/stream-parsers/gemini-parser.test.ts`
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - [ ] Parse `init` event
  - [ ] Parse `message` (user and assistant)
  - [ ] Parse `tool_use`
  - [ ] Parse `tool_result` (success and error)
  - [ ] Parse `error` event
  - [ ] Parse `result` with metrics
  - [ ] Test coverage >= 90%

### Task 3.2: Gemini Provider Implementation
- [x] **Status**: completed
- **SP**: 3
- **Files to create**: `src/ai-providers/gemini-provider.ts`
- **Tests**: `tests/ai-providers/gemini-provider.test.ts`
- **Dependencies**: Task 1.3, Task 3.1
- **Acceptance Criteria**:
  - [x] `isInstalled()` detects Gemini CLI
  - [x] `getDefaultModel()` returns 'gemini-2.5-flash'
  - [x] `mapModelTier()` correct mapping
  - [x] `validateModel()` accepts Gemini models
  - [x] `buildArgs()` includes `--yolo` for skip permissions
  - [x] `execute()` interactive mode
  - [x] `executeHeadless()` with metrics

### Task 3.3: Gemini Provider Bootstrap
- [~] **Status**: pending
- **SP**: 1
- **Files to modify**: `src/ai-providers/index.ts`
- **Tests**: `tests/ai-providers/bootstrap.test.ts`
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - [ ] Gemini available after module import
  - [ ] `getAIProvider('gemini')` works
  - [ ] Does not fail if Gemini CLI not installed
  - [ ] `getAll()` returns both providers

### Task 3.4: Unified Display Handler
- [~] **Status**: pending
- **SP**: 3
- **Files to create**: `src/ai-providers/stream-display.ts`
- **Tests**: `tests/ai-providers/stream-display.test.ts`
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - [ ] `handleEvent()` for all event types
  - [ ] Metrics accumulated correctly
  - [ ] Spinner managed correctly
  - [ ] Works with events from both providers
  - [ ] Consistent visual output

### Task 3.5: Integration Tests
- [~] **Status**: pending
- **SP**: 3
- **Files to create**:
  - `tests/ai-providers/integration/claude.integration.test.ts`
  - `tests/ai-providers/integration/gemini.integration.test.ts`
  - `tests/ai-providers/integration/fallback.integration.test.ts`
- **Dependencies**: Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - [ ] Claude execution test (skip if not installed)
  - [ ] Gemini execution test (skip if not installed)
  - [ ] Fallback test: Claude → Gemini
  - [ ] Fallback test: Gemini → Claude

---

## Phase 4: Integration (13 SP)

### Task 4.1: Model Router Extension
- [~] **Status**: pending
- **SP**: 2
- **Files to modify**:
  - `src/utils/model-router.ts`
  - `src/types/model.ts`
- **Tests**: `tests/utils/model-router.test.ts`
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - [ ] `getModelForPhase()` accepts provider parameter
  - [ ] Uses `provider.mapModelTier()` for mapping
  - [ ] Backward compatible (no provider = Claude)
  - [ ] Works for both providers

### Task 4.2: Configuration System Extension
- [~] **Status**: pending
- **SP**: 2
- **Files to modify**:
  - `src/utils/config.ts`
  - `src/providers/types.ts`
- **Tests**: `tests/utils/config.test.ts`
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - [ ] `aiProvider` added to AdkConfig
  - [ ] `getAIProviderConfig()` with defaults
  - [ ] `updateAIProviderConfig()` persists
  - [ ] Validation of values

### Task 4.3: Environment Variable Support
- [~] **Status**: pending
- **SP**: 1
- **Files to modify**: `src/ai-providers/index.ts`
- **Tests**: `tests/ai-providers/env.test.ts`
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - [ ] `ADK_AI_PROVIDER=gemini` selects Gemini
  - [ ] Invalid values graceful fallback
  - [ ] Priority: ENV > config > default
  - [ ] Warning if CLI not installed

### Task 4.4: CLI Global Flags
- [~] **Status**: pending
- **SP**: 2
- **Files to modify**:
  - `src/cli.ts`
  - `src/cli-v3.ts`
- **Tests**: `tests/cli.test.ts`
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - [ ] `-P, --provider <name>` flag
  - [ ] `-M, --model <model>` flag
  - [ ] Flags available in all commands
  - [ ] Help updated
  - [ ] Correct propagation to commands

### Task 4.5: Command Updates
- [~] **Status**: pending
- **SP**: 3
- **Files to modify**:
  - `src/commands/feature.ts`
  - `src/commands/agent.ts`
  - `src/commands/workflow.ts`
- **Tests**: `tests/commands/feature.test.ts`
- **Dependencies**: Task 4.1, Task 4.3, Task 4.4
- **Acceptance Criteria**:
  - [ ] All commands use new provider system
  - [ ] Flags work correctly
  - [ ] Clear error messages
  - [ ] Metrics collected

### Task 4.6: Fallback Manager
- [~] **Status**: pending
- **SP**: 3
- **Files to create**: `src/ai-providers/fallback-manager.ts`
- **Tests**: `tests/ai-providers/fallback-manager.test.ts`
- **Dependencies**: Task 4.2, Task 3.5
- **Acceptance Criteria**:
  - [ ] Execution without fallback works
  - [ ] Fallback triggered when primary fails
  - [ ] No fallback when config disabled
  - [ ] Error propagated when both fail
  - [ ] Fallback in < 2 seconds
  - [ ] Clear logging of reason

---

## Phase 5: Polish (8 SP)

### Task 5.1: Config Providers Command
- [~] **Status**: pending
- **SP**: 2
- **Files to create**: `src/commands/config-providers.ts`
- **Files to modify**:
  - `src/commands/config.ts`
  - `src/cli.ts`
- **Tests**: `tests/commands/config-providers.test.ts`
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - [ ] `listProviders()` shows all providers
  - [ ] Installation status indicated
  - [ ] Models listed per provider
  - [ ] `setDefaultProvider()` updates config
  - [ ] Error for invalid provider

### Task 5.2: Type Exports
- [~] **Status**: pending
- **SP**: 1
- **Files to create**: `src/types/ai-provider.ts`
- **Files to modify**: `src/types/index.ts`
- **Tests**: `tests/types/exports.test.ts`
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - [ ] Public types exported correctly
  - [ ] No internal types exported
  - [ ] JSDoc on main types

### Task 5.3: Documentation Update
- [~] **Status**: pending
- **SP**: 2
- **Files to create**: `.claude/docs/multi-provider.md`
- **Files to modify**: `CLAUDE.md`
- **Dependencies**: All previous tasks
- **Acceptance Criteria**:
  - [ ] Clear and complete documentation
  - [ ] Working examples
  - [ ] CLAUDE.md updated with quick reference

### Task 5.4: End-to-End Tests
- [~] **Status**: pending
- **SP**: 2
- **Files to create**: `tests/e2e/multi-provider.e2e.test.ts`
- **Dependencies**: All previous tasks
- **Acceptance Criteria**:
  - [ ] Provider selection via CLI flag
  - [ ] Provider selection via config
  - [ ] Provider listing command
  - [ ] Graceful skip if CLIs not installed
  - [ ] Cleanup after tests

### Task 5.5: Metrics Collection Update
- [~] **Status**: pending
- **SP**: 1
- **Files to modify**:
  - `src/ai-providers/stream-display.ts`
  - `src/types/parallel.ts`
- **Tests**: `tests/ai-providers/metrics.test.ts`
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - [ ] `provider` field in CollectedMetrics
  - [ ] Consistent metrics between providers
  - [ ] Compatible with existing system

---

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 1: Foundation | 4 | 4 | 100% |
| Phase 2: Claude Refactor | 4 | 0 | 0% |
| Phase 3: Gemini Provider | 5 | 1 | 20% |
| Phase 4: Integration | 6 | 0 | 0% |
| Phase 5: Polish | 5 | 0 | 0% |
| **Total** | **24** | **5** | **21%** |

---

## Implementation Order (Optimal)

```
1.1 → 1.2 → 1.3 → 1.4 (Foundation)
          ↓
        2.1 → 2.2 → 2.3 → 2.4 (Claude Refactor)
                      ↓
        3.1 ───────→ 3.2 → 3.3
          ↓           ↓
        3.4 ───────→ 3.5 (Gemini Provider)
                      ↓
4.2 → 4.3 → 4.4 → 4.1 → 4.5 → 4.6 (Integration)
                              ↓
        5.2 → 5.1 → 5.5 → 5.3 → 5.4 (Polish)
```

---

## Parallel Execution Opportunities

| Order | Tasks | Can Parallelize |
|-------|-------|-----------------|
| 1 | 1.1 | - |
| 2 | 1.2 | - |
| 3 | 1.3, 3.1 | Yes (3.1 only needs 1.2) |
| 4 | 1.4, 2.1 | Yes (independent after deps) |
| 5 | 2.2, 3.4 | Yes (independent) |
| 6 | 2.3, 3.2 | Yes (independent) |
| 7 | 2.4, 3.3 | Yes (independent) |
| 8 | 3.5 | - |
| 9 | 4.1, 4.2 | Yes (independent) |
| 10 | 4.3, 4.4 | Yes (independent) |
| 11 | 4.5 | - |
| 12 | 4.6 | - |
| 13 | 5.1, 5.2 | Yes (independent) |
| 14 | 5.3, 5.5 | Yes (independent) |
| 15 | 5.4 | - |

---

## Checkpoints

After each task completion:
1. Run `npm run type-check`
2. Run `npm test`
3. Mark task as completed in this file
4. Create checkpoint: `.claude/hooks/create-checkpoint.sh gemini-integration "Task X.X" "description"`
5. **STOP** - Clear context before next task (`claude clear`)

---

## Fixtures Required

### Claude Stream Events
- `tests/fixtures/claude-stream/init.json`
- `tests/fixtures/claude-stream/text.json`
- `tests/fixtures/claude-stream/tool_use.json`
- `tests/fixtures/claude-stream/tool_result.json`
- `tests/fixtures/claude-stream/result.json`

### Gemini Stream Events
- `tests/fixtures/gemini-stream/init.json`
- `tests/fixtures/gemini-stream/message.json`
- `tests/fixtures/gemini-stream/tool_use.json`
- `tests/fixtures/gemini-stream/tool_result.json`
- `tests/fixtures/gemini-stream/result.json`

---

*Tasks created: 2026-01-28*
*Last updated: 2026-01-28*
