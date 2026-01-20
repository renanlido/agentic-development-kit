# Tasks: project-managemen

> Feature: Centralized Path Resolution with Git Worktree Support
> Created: 2026-01-19
> Based on: research.md findings

---

## Phase 1: Testing Foundation

### Task 1: Create unit tests for git-paths.ts existing functions
- Tipo: Test
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: src/utils/git-paths.test.ts
- Acceptance Criteria:
  - [ ] Tests for `getMainRepoPath()` in main repo context
  - [ ] Tests for `getMainRepoPath()` in worktree context (mocked)
  - [ ] Tests for `getMainRepoPath()` fallback when not in git repo
  - [ ] Tests for `isInWorktree()` returning true/false
  - [ ] Tests for `getCurrentWorktreePath()` returning path or null
  - [ ] Tests for `getClaudePath()` path construction
  - [ ] Tests for `getFeaturesBasePath()` path construction
  - [ ] Tests for `getFeaturePath()` with segments
  - [ ] Tests for `getAgentsPath()` path construction
  - [ ] Coverage >= 80% for git-paths.ts

### Task 2: Create integration tests for progress.ts worktree sync
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1
- Arquivo: src/utils/progress.test.ts
- Acceptance Criteria:
  - [ ] Tests for `loadProgress()` sync behavior
  - [ ] Tests for `saveProgress()` dual-write behavior
  - [ ] Tests for progress sync when worktree has newer file
  - [ ] Tests for progress sync when main repo has newer file
  - [ ] Tests for fallback when no progress file exists
  - [ ] Coverage >= 80% for progress.ts

---

## Phase 2: Migration Completion

### Task 3: Update update.ts to use git-paths utilities
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1
- Arquivo: src/commands/update.ts
- Acceptance Criteria:
  - [ ] Import `getMainRepoPath` and `getClaudePath` from git-paths
  - [ ] Replace `process.cwd()` with `getMainRepoPath()` on line 26
  - [ ] Replace manual path.join for .claude with `getClaudePath()`
  - [ ] Works correctly when run from worktree
  - [ ] Works correctly when run from main repo
  - [ ] All existing tests pass

### Task 4: Verify and test agent.ts path handling
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3
- Arquivo: src/commands/agent.ts
- Acceptance Criteria:
  - [ ] Verify agent.ts uses git-paths utilities
  - [ ] Test agent commands work from worktree context
  - [ ] Test agent commands work from main repo context
  - [ ] No direct `process.cwd()` for .claude paths

### Task 5: Verify and test memory.ts path handling
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3
- Arquivo: src/commands/memory.ts
- Acceptance Criteria:
  - [ ] Confirm memory.ts uses `getFeaturePath`, `getFeaturesBasePath` from git-paths
  - [ ] Test memory commands work from worktree context
  - [ ] Test memory commands work from main repo context
  - [ ] Memory files always written to main repo location

---

## Phase 3: Validation & Cleanup

### Task 6: Remove deleted paths.ts references
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5
- Arquivos: All files that may reference old paths.ts
- Acceptance Criteria:
  - [ ] No imports from `../utils/paths` anywhere in codebase
  - [ ] All path utilities imported from `git-paths.ts`
  - [ ] Build succeeds without errors
  - [ ] No TypeScript compilation errors

### Task 7: Create end-to-end test for worktree workflow
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 6
- Arquivo: tests/e2e/worktree-workflow.test.ts
- Acceptance Criteria:
  - [ ] Test: Create feature in main repo
  - [ ] Test: Run implement phase creates worktree
  - [ ] Test: Progress syncs between main and worktree
  - [ ] Test: Commands run correctly from worktree
  - [ ] Test: Memory/agent status files in main repo

### Task 8: Run full test suite and lint check
- Tipo: Config
- Prioridade: P0
- Dependencias: Task 7
- Acceptance Criteria:
  - [ ] `npm test` passes all tests
  - [ ] `npm run check` passes lint and format
  - [ ] `npm run type-check` passes
  - [ ] Coverage >= 80% overall
  - [ ] No regressions in existing functionality

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | Tasks 1-2 | Testing foundation (TDD) |
| 2 | Tasks 3-5 | Migration completion |
| 3 | Tasks 6-8 | Validation and cleanup |

**Total Tasks:** 8
**Test Tasks:** 3 (Tasks 1, 2, 7)
**Implementation Tasks:** 4 (Tasks 3, 4, 5, 6)
**Config Tasks:** 1 (Task 8)

**Critical Path:** Task 1 → Task 3 → Task 6 → Task 8
