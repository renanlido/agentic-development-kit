# Tasks: adk-v3-session-continuity-4

**Feature:** ADK v3 Session Continuity - Complete Implementation
**Total Story Points:** 37
**Status:** Planning Complete
**Created:** 2026-01-26

---

## Sprint 2: Dual-Agent Prompts (13 pts)

### Task 2.1: Session Detection Module [3 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** nenhuma

**Files:**
- Create: `src/utils/session-detection.ts`
- Create: `tests/utils/session-detection.test.ts`

**Acceptance Criteria:**
- [ ] `isFirstSession(feature)` returns true if no `feature_list.json`
- [ ] `isFirstSession(feature)` returns true if no `claude-progress.txt`
- [ ] `isFirstSession(feature)` returns false if both files exist
- [ ] `getSessionContext(feature)` returns typed context
- [ ] Path traversal validation on feature name
- [x] Test coverage >= 80%

**Tests Required (Write First):**
- should return true when feature_list.json does not exist
- should return true when claude-progress.txt does not exist
- should return false when both indicator files exist
- should return true for new feature directory
- should handle path traversal attempts
- should return session context with all required fields

---

### Task 2.2: Feature List Types & Schema [3 pts]
- **Status:** [x] Completed
- **Tipo:** Types + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** nenhuma (can run parallel with 2.1)

**Files:**
- Create: `src/types/feature-list-v3.ts`
- Create: `tests/types/feature-list-v3.test.ts`

**Acceptance Criteria:**
- [ ] `FeatureTest` interface: id, description, category, priority, steps, passes, lastTested, notes
- [ ] `FeatureList` interface: feature, version, createdAt, tests[], summary
- [ ] `FeatureListSummary`: total, passing, failing, pending
- [ ] Zod schema for runtime validation
- [ ] Type guards: `isFeatureList()`, `isFeatureTest()`
- [x] Test coverage >= 80%

**Dependencies to Add:**
- `zod` package

**Tests Required (Write First):**
- should validate correct feature list structure
- should reject missing required fields
- should validate test categories (functional, ui, integration)
- should validate priority values (high, medium, low)
- should calculate summary correctly
- should handle empty tests array

---

### Task 2.3: Initializer Agent Prompt Generator [5 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** Task 2.2

**Files:**
- Create: `src/utils/prompts/initializer-agent.ts`
- Create: `tests/utils/prompts/initializer-agent.test.ts`

**Acceptance Criteria:**
- [x] `generateInitializerPrompt(feature, prdContent)` returns prompt string
- [x] Prompt includes PRD analysis instructions
- [x] Prompt includes feature_list.json schema + example
- [x] Prompt includes init.sh template (whitelisted commands only)
- [x] Prompt includes verification checklist
- [x] Security: no arbitrary command execution
- [x] Test coverage >= 80%

**Tests Required (Write First):**
- should include feature name in prompt
- should inject PRD content correctly
- should include feature_list schema
- should include init.sh template
- should not allow arbitrary shell commands
- should include verification checklist

---

### Task 2.4: Coding Agent Prompt Generator [2 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** Task 2.2

**Files:**
- Create: `src/utils/prompts/coding-agent.ts`
- Create: `tests/utils/prompts/coding-agent.test.ts`

**Acceptance Criteria:**
- [x] `generateCodingPrompt(context)` returns prompt string
- [x] Includes startup checklist (pwd, progress, feature_list, git log, init.sh)
- [x] Emphasizes ONE feature at a time
- [x] Requires real testing before `passes: true`
- [x] Includes git commit instructions
- [x] Test coverage >= 80%

**Tests Required (Write First):**
- should include startup checklist
- should inject feature_list content
- should inject recent git commits
- should emphasize single-feature work
- should require test verification
- should include commit instructions

---

## Sprint 3: Feature List & Init Script (11 pts)

### Task 3.1: Feature List Manager [3 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** Task 2.2

**Files:**
- Create: `src/utils/feature-list.ts`
- Create: `tests/utils/feature-list.test.ts`

**Acceptance Criteria:**
- [ ] `read(feature)` returns FeatureList or null
- [ ] `write(feature, list)` uses atomic write pattern
- [ ] `updateTest(feature, testId, updates)` modifies single test
- [ ] `markTestPassing(feature, testId)` sets passes=true, lastTested=now
- [ ] `getSummary(feature)` returns pass/fail stats
- [ ] `isComplete(feature)` returns true when 100% pass
- [ ] Schema validation on read/write
- [x] Test coverage >= 80%

**Tests Required (Write First):**
- should read existing feature list
- should return null for non-existent list
- should write with atomic pattern
- should validate schema on write
- should update single test by id
- should mark test as passing with timestamp
- should calculate summary correctly
- should return true when 100% passing

---

### Task 3.2: Init Script Types & Generator [3 pts]
- **Status:** [x] Completed
- **Tipo:** Types + Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** nenhuma (can run parallel with 3.1)

**Files:**
- Create: `src/types/init-script-v3.ts`
- Create: `src/utils/init-script.ts`
- Create: `tests/utils/init-script.test.ts`

**Acceptance Criteria:**
- [ ] `InitScriptConfig` interface defined
- [ ] `generateInitScript(config)` returns shell script string
- [ ] Only whitelisted commands (npm install, cp, mkdir, echo)
- [ ] Includes `set -e` for error handling
- [ ] Script is idempotent (can run multiple times)
- [x] Test coverage >= 80%

**Whitelisted Operations:**
- npm install (no arbitrary packages)
- cp (only for .env.example → .env)
- mkdir (only project-local)
- echo (only for status messages)
- npm run build (explicit, optional)

**Tests Required (Write First):**
- should generate valid shell script
- should include shebang and set -e
- should include npm install if needed
- should copy .env.example if exists
- should be idempotent
- should not include dangerous commands

---

### Task 3.3: PRD Parser for Feature Extraction [3 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** nenhuma (can run parallel with 3.1, 3.2)

**Files:**
- Create: `src/utils/prd-parser.ts`
- Create: `tests/utils/prd-parser.test.ts`

**Acceptance Criteria:**
- [x] `extractRequirements(prdContent)` returns array of testable items
- [x] Identifies functional requirements (RF01, RF02, etc.)
- [x] Identifies user story acceptance criteria
- [x] Categorizes as functional/ui/integration
- [x] Assigns priority based on markers
- [x] Generates unique test IDs
- [x] Test coverage >= 80%

**Tests Required (Write First):**
- should extract RFxx requirements
- should extract user story acceptance criteria
- should categorize requirements correctly
- should assign priorities
- should generate unique test IDs
- should handle empty PRD
- should handle malformed markdown

---

### Task 3.4: Initializer Agent Integration [2 pts]
- **Status:** [x] Completed
- **Tipo:** Integration + Test
- **Prioridade:** P0
- **Dependencias:** Tasks 2.1, 2.3, 3.1, 3.2, 3.3

**Files:**
- Create: `src/utils/initializer-flow.ts`
- Create: `tests/utils/initializer-flow.test.ts`
- Modify: `src/commands/feature-v3.ts`

**Acceptance Criteria:**
- [x] `runInitializerFlow(feature)` orchestrates first-session setup
- [x] Reads PRD from feature directory
- [x] Generates Initializer Agent prompt
- [x] Validates generated feature_list.json
- [x] Saves session info
- [x] Test coverage >= 80%

**Note:** Claude execution and init.sh validation are handled by subsequent tasks

**Tests Required (Write First):**
- should fail if PRD does not exist
- should generate correct prompt
- should track session execution
- should validate feature_list output
- should validate init.sh output
- should save valid artifacts

---

## Sprint 4: Git Context & Work Command (13 pts)

### Task 4.1: Git Context Utility [3 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** nenhuma (can start early)

**Files:**
- Create: `src/utils/git-context.ts`
- Create: `tests/utils/git-context.test.ts`

**Acceptance Criteria:**
- [ ] `getRecentCommits(n)` returns last N commit messages
- [ ] `getModifiedFiles()` returns changed files list
- [ ] `hasUncommittedChanges()` returns boolean
- [ ] `autoCommit(message)` stages and commits
- [ ] `formatGitContext()` returns formatted string for prompt
- [ ] Uses simple-git (already installed)
- [ ] Handles non-git directories
- [x] Test coverage >= 80%

**Tests Required (Write First):**
- should return recent commits in oneline format
- should respect commit limit parameter
- should return modified files list
- should detect uncommitted changes
- should commit with valid message
- should format git context for prompt
- should handle non-git directory

---

### Task 4.2: Work Loop Controller [5 pts]
- **Status:** [x] Completed
- **Tipo:** Implementation + Test (TDD)
- **Prioridade:** P0
- **Dependencias:** Tasks 2.1, 2.4, 3.4, 4.1

**Files:**
- Create: `src/utils/work-loop.ts`
- Create: `tests/utils/work-loop.test.ts`

**Acceptance Criteria:**
- [ ] `startWorkLoop(feature)` begins work iteration
- [ ] Detects first vs subsequent session
- [ ] Routes to Initializer or Coding Agent
- [ ] Handles resume if session < 24h
- [ ] Stops when 100% tests pass
- [ ] Provides progress feedback
- [ ] Handles SIGINT gracefully
- [x] Test coverage >= 80%

**Loop Logic:**
```
while (not complete and not interrupted):
  1. Check isFirstSession()
  2. If first → run Initializer flow
  3. If subsequent → run Coding Agent flow
  4. Update session store
  5. Check isComplete()
  6. Report progress
```

**Tests Required (Write First):**
- should detect first session and use initializer
- should detect subsequent session and use coding agent
- should resume existing session if < 24h
- should stop when all tests pass
- should handle interruption gracefully
- should update session store each iteration

---

### Task 4.3: Work Command Implementation [3 pts]
- **Status:** [ ] Pending
- **Tipo:** CLI Command + Test
- **Prioridade:** P0
- **Dependencias:** Task 4.2

**Files:**
- Modify: `src/commands/feature-v3.ts`
- Modify: `src/cli-v3.ts`
- Create: `tests/commands/feature-v3-work.test.ts`

**Acceptance Criteria:**
- [ ] `adk3 feature work <name>` command registered
- [ ] Validates feature exists
- [ ] Displays initial status
- [ ] Starts work loop
- [ ] Handles errors gracefully
- [ ] Supports `--dry-run` flag
- [ ] Supports `--max-iterations` flag
- [ ] Spinner feedback
- [x] Test coverage >= 80%

**Command Interface:**
```
adk3 feature work <name> [options]
  --dry-run           Show what would happen
  --max-iterations    Limit work iterations
  -v, --verbose       Show detailed output
```

**Tests Required (Write First):**
- should register work command
- should validate feature name
- should fail for non-existent feature
- should start work loop
- should respect dry-run flag
- should respect max-iterations flag

---

### Task 4.4: End-to-End Integration Tests [2 pts]
- **Status:** [ ] Pending
- **Tipo:** E2E Test
- **Prioridade:** P1
- **Dependencias:** Task 4.3

**Files:**
- Create: `tests/e2e/v3-work-flow.test.ts`

**Acceptance Criteria:**
- [ ] Test complete first-session flow
- [ ] Test complete subsequent-session flow
- [ ] Test session resume across "restarts"
- [ ] Test 100% completion detection
- [ ] Test error recovery
- [ ] Mocked Claude execution
- [ ] Isolated temp directories

**Test Scenarios:**
1. First session: PRD → feature_list.json + init.sh
2. Second session: Resume → Work → Mark passing
3. Multi-iteration: Loop until complete
4. Error recovery: Handle Claude timeout
5. Interruption: SIGINT handling

---

## Progress Summary

| Sprint | Tasks | Completed | Points |
|--------|-------|-----------|--------|
| Sprint 2 | 4 | 4 | 13 |
| Sprint 3 | 4 | 4 | 11 |
| Sprint 4 | 4 | 0 | 13 |
| **Total** | **12** | **8** | **37** |

---

## Critical Path

```
2.2 → 2.3 → 3.1 → 3.4 → 4.2 → 4.3 → 4.4
```

Tasks 2.1, 3.2, 3.3, and 4.1 can run in parallel with their respective dependencies.

---

## Checkpoint Instructions

After completing each task:

```bash
# 1. Mark task completed in this file (change [ ] to [x])

# 2. Create checkpoint
./.claude/hooks/create-checkpoint.sh adk-v3-session-continuity-4 "Task X.X" "description"

# 3. IMPORTANT: Clear context before next task
# Ctrl+C, then:
claude clear

# 4. Resume implementation
adk feature implement adk-v3-session-continuity-4
```

---

## Verification Points

### After Sprint 2
```bash
npm run type-check
npm test -- --testPathPattern="session-detection|feature-list-v3|initializer-agent|coding-agent"
npm run check
```

### After Sprint 3
```bash
npm run type-check
npm test -- --testPathPattern="feature-list|init-script|prd-parser|initializer-flow"
npm run check
```

### After Sprint 4 (Final)
```bash
npm run type-check
npm test
npm run test:coverage
npm run check
```

---

*Tasks updated: 2026-01-26*
*Next: Task 2.1 - Session Detection Module*
