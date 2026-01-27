# Implementation Plan: adk-v3-session-continuity-4

**Created:** 2026-01-26
**Status:** Planning Complete
**Based on:** research.md, prd.md

---

## Overview

This plan breaks down the implementation of ADK v3 Session Continuity into **3 sprints** (Sprints 2-4), with **12 discrete tasks**. Each task is designed to be completed in a single focused session with context cleanup between tasks.

### Summary

| Sprint | Focus | Tasks | Story Points |
|--------|-------|-------|--------------|
| Sprint 2 | Dual-Agent Prompts | 4 tasks | 13 pts |
| Sprint 3 | Feature List & Init Script | 4 tasks | 11 pts |
| Sprint 4 | Git Context & Work Command | 4 tasks | 13 pts |
| **Total** | - | **12 tasks** | **37 pts** |

---

## Sprint 2: Dual-Agent Prompts

**Sprint Goal:** Enable differentiated prompts for first session (Initializer) vs subsequent sessions (Coding Agent), with automatic detection.

### Task 2.1: Session Detection Module

**Objective:** Create utility to detect if this is the first session for a feature or a subsequent session requiring different prompt handling.

**Files to Create:**
- `src/utils/session-detection.ts` - Detection logic
- `tests/utils/session-detection.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `isFirstSession(feature)` returns `true` if no `feature_list.json` exists
- [ ] `isFirstSession(feature)` returns `true` if no `claude-progress.txt` exists
- [ ] `isFirstSession(feature)` returns `false` if both files exist
- [ ] `getSessionContext(feature)` returns typed context object
- [ ] Handles missing feature directory gracefully
- [ ] Path traversal validation on feature name
- [ ] Test coverage >= 80%

**Tests Required:**
```
- should return true when feature_list.json does not exist
- should return true when claude-progress.txt does not exist
- should return false when both indicator files exist
- should return true for new feature directory
- should handle path traversal attempts
- should return session context with all required fields
```

**Dependencies:**
- `src/utils/session-store.ts` (existing)
- `fs-extra` (installed)

**Story Points:** 3

---

### Task 2.2: Feature List Types & Schema

**Objective:** Define TypeScript interfaces and Zod schemas for `feature_list.json` structure to ensure type safety and validation.

**Files to Create:**
- `src/types/feature-list-v3.ts` - Type definitions
- `tests/types/feature-list-v3.test.ts` - Schema validation tests

**Files to Modify:**
- None (new types)

**Acceptance Criteria:**
- [ ] `FeatureTest` interface with: id, description, category, priority, steps, passes, lastTested, notes
- [ ] `FeatureList` interface with: feature, version, createdAt, tests[], summary
- [ ] `FeatureListSummary` with: total, passing, failing, pending
- [ ] Zod schema for runtime validation
- [ ] Schema version field for future migrations
- [ ] Export type guards: `isFeatureList()`, `isFeatureTest()`
- [ ] Test coverage >= 80%

**Tests Required:**
```
- should validate correct feature list structure
- should reject missing required fields
- should validate test categories (functional, ui, integration)
- should validate priority values (high, medium, low)
- should calculate summary correctly
- should handle empty tests array
- should validate ISO date format for createdAt
```

**Dependencies:**
- Zod (to be added as dependency)

**Story Points:** 3

---

### Task 2.3: Initializer Agent Prompt Generator

**Objective:** Create module that generates the Initializer Agent prompt for first sessions, focusing on PRD analysis and artifact generation.

**Files to Create:**
- `src/utils/prompts/initializer-agent.ts` - Prompt generator
- `tests/utils/prompts/initializer-agent.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `generateInitializerPrompt(feature, prdContent)` returns formatted prompt string
- [ ] Prompt includes instructions to analyze PRD
- [ ] Prompt includes `feature_list.json` schema and example
- [ ] Prompt includes `init.sh` template with allowed commands
- [ ] Prompt mandates initial git commit
- [ ] Prompt includes explicit verification checklist
- [ ] Prompt prevents arbitrary command execution (security)
- [ ] Test coverage >= 80%

**Prompt Structure:**
```
1. Role definition
2. PRD content injection
3. feature_list.json schema + example
4. init.sh template (whitelisted commands only)
5. Verification checklist
6. Output format requirements
```

**Tests Required:**
```
- should include feature name in prompt
- should inject PRD content correctly
- should include feature_list schema
- should include init.sh template
- should not allow arbitrary shell commands
- should include verification checklist
- should return valid string prompt
```

**Dependencies:**
- `src/types/feature-list-v3.ts` (Task 2.2)

**Story Points:** 5

---

### Task 2.4: Coding Agent Prompt Generator

**Objective:** Create module that generates the Coding Agent prompt for subsequent sessions, focusing on work continuation and single-feature completion.

**Files to Create:**
- `src/utils/prompts/coding-agent.ts` - Prompt generator
- `tests/utils/prompts/coding-agent.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `generateCodingPrompt(context)` returns formatted prompt string
- [ ] Prompt includes startup checklist (pwd, read progress, git log, init.sh)
- [ ] Prompt emphasizes ONE feature at a time
- [ ] Prompt requires real testing before `passes: true`
- [ ] Prompt includes git commit instructions
- [ ] Prompt includes progress update instructions
- [ ] Context includes: feature name, feature_list.json content, recent commits
- [ ] Test coverage >= 80%

**Prompt Structure:**
```
1. Role definition (Coding Agent)
2. Startup checklist (5 steps)
3. Current feature_list.json state
4. Work rules (one feature, real testing)
5. Completion criteria
6. Git commit format
7. Progress update format
```

**Tests Required:**
```
- should include startup checklist
- should inject feature_list content
- should inject recent git commits
- should emphasize single-feature work
- should require test verification
- should include commit instructions
- should include progress update format
```

**Dependencies:**
- `src/types/feature-list-v3.ts` (Task 2.2)

**Story Points:** 2

---

## Sprint 3: Feature List & Init Script

**Sprint Goal:** Enable generation and management of `feature_list.json` and `init.sh` artifacts.

### Task 3.1: Feature List Manager

**Objective:** Create utility to read, write, update, and validate `feature_list.json` files.

**Files to Create:**
- `src/utils/feature-list.ts` - CRUD operations
- `tests/utils/feature-list.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `read(feature)` returns parsed FeatureList or null
- [ ] `write(feature, list)` uses atomic write pattern
- [ ] `updateTest(feature, testId, updates)` modifies single test
- [ ] `markTestPassing(feature, testId)` sets passes=true, lastTested=now
- [ ] `getSummary(feature)` returns current pass/fail stats
- [ ] `isComplete(feature)` returns true when all tests pass
- [ ] Schema validation on read/write
- [ ] Test coverage >= 80%

**Tests Required:**
```
- should read existing feature list
- should return null for non-existent list
- should write with atomic pattern
- should validate schema on write
- should update single test by id
- should mark test as passing with timestamp
- should calculate summary correctly
- should return true when 100% passing
- should handle empty tests array
```

**Dependencies:**
- `src/types/feature-list-v3.ts` (Task 2.2)
- Atomic write pattern from `session-store.ts`

**Story Points:** 3

---

### Task 3.2: Init Script Types & Generator

**Objective:** Create types and utility to generate `init.sh` scripts with whitelisted commands only.

**Files to Create:**
- `src/types/init-script-v3.ts` - Type definitions
- `src/utils/init-script.ts` - Generator
- `tests/utils/init-script.test.ts` - Unit tests

**Files to Modify:**
- None (new modules)

**Acceptance Criteria:**
- [ ] `InitScriptConfig` interface with allowed operations
- [ ] `generateInitScript(config)` returns shell script string
- [ ] Only whitelisted commands allowed: npm install, cp, mkdir, echo
- [ ] Script includes error handling (`set -e`)
- [ ] Script is idempotent (can run multiple times)
- [ ] Script includes environment setup section
- [ ] Script includes build section (optional)
- [ ] Generated scripts pass shellcheck validation
- [ ] Test coverage >= 80%

**Whitelisted Operations:**
```
- npm install (no arbitrary packages)
- cp (only for .env.example → .env)
- mkdir (only project-local)
- echo (only for status messages)
- npm run build (explicit, optional)
```

**Tests Required:**
```
- should generate valid shell script
- should include shebang and set -e
- should include npm install if needed
- should copy .env.example if exists
- should be idempotent
- should not include dangerous commands
- should escape special characters
```

**Dependencies:**
- None

**Story Points:** 3

---

### Task 3.3: PRD Parser for Feature Extraction

**Objective:** Create utility to parse PRD markdown and extract testable requirements for `feature_list.json` generation.

**Files to Create:**
- `src/utils/prd-parser.ts` - Parsing logic
- `tests/utils/prd-parser.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `extractRequirements(prdContent)` returns array of testable items
- [ ] Identifies functional requirements (RF01, RF02, etc.)
- [ ] Identifies user story acceptance criteria
- [ ] Categorizes as functional/ui/integration
- [ ] Assigns priority based on markers (high/medium/low)
- [ ] Generates unique test IDs
- [ ] Handles markdown tables, lists, and checkboxes
- [ ] Test coverage >= 80%

**Tests Required:**
```
- should extract RFxx requirements
- should extract user story acceptance criteria
- should categorize requirements correctly
- should assign priorities
- should generate unique test IDs
- should handle empty PRD
- should handle malformed markdown
- should preserve requirement descriptions
```

**Dependencies:**
- None (pure string parsing)

**Story Points:** 3

---

### Task 3.4: Initializer Agent Integration

**Objective:** Wire together session detection, prompt generation, and artifact creation for the Initializer Agent flow.

**Files to Create:**
- `src/utils/initializer-flow.ts` - Integration orchestration
- `tests/utils/initializer-flow.test.ts` - Integration tests

**Files to Modify:**
- `src/commands/feature-v3.ts` - Add init command hook

**Acceptance Criteria:**
- [ ] `runInitializerFlow(feature)` orchestrates full first-session setup
- [ ] Reads PRD from feature directory
- [ ] Generates Initializer Agent prompt
- [ ] Executes Claude with tracking
- [ ] Validates generated `feature_list.json`
- [ ] Validates generated `init.sh`
- [ ] Saves session info
- [ ] Returns success/failure with details
- [ ] Test coverage >= 80%

**Flow:**
```
1. Verify PRD exists
2. Generate Initializer prompt
3. Execute Claude (async, tracked)
4. Parse/validate outputs
5. Save feature_list.json (if valid)
6. Save init.sh (if valid)
7. Update session store
8. Return result
```

**Tests Required:**
```
- should fail if PRD does not exist
- should generate correct prompt
- should track session execution
- should validate feature_list output
- should validate init.sh output
- should save valid artifacts
- should reject invalid artifacts
- should update session store
```

**Dependencies:**
- `src/utils/session-detection.ts` (Task 2.1)
- `src/utils/prompts/initializer-agent.ts` (Task 2.3)
- `src/utils/feature-list.ts` (Task 3.1)
- `src/utils/init-script.ts` (Task 3.2)
- `src/utils/claude-v3.ts` (existing)

**Story Points:** 2

---

## Sprint 4: Git Context & Work Command

**Sprint Goal:** Complete the `adk3 feature work` command with git integration and work loop.

### Task 4.1: Git Context Utility

**Objective:** Create utility for git operations: recent commits, status, and auto-commit.

**Files to Create:**
- `src/utils/git-context.ts` - Git operations
- `tests/utils/git-context.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `getRecentCommits(n)` returns last N commit messages (oneline)
- [ ] `getModifiedFiles()` returns list of changed files
- [ ] `hasUncommittedChanges()` returns boolean
- [ ] `autoCommit(message)` stages and commits all changes
- [ ] `formatGitContext()` returns formatted string for prompt injection
- [ ] Uses simple-git library (already installed)
- [ ] Handles non-git directories gracefully
- [ ] Validates commit message format
- [ ] Test coverage >= 80%

**Tests Required:**
```
- should return recent commits in oneline format
- should respect commit limit parameter
- should return modified files list
- should detect uncommitted changes
- should commit with valid message
- should reject empty commit message
- should format git context for prompt
- should handle non-git directory
```

**Dependencies:**
- `simple-git` (already installed)

**Story Points:** 3

---

### Task 4.2: Work Loop Controller

**Objective:** Create the core work loop that continues until all tests pass or user interrupts.

**Files to Create:**
- `src/utils/work-loop.ts` - Loop controller
- `tests/utils/work-loop.test.ts` - Unit tests

**Files to Modify:**
- None (new module)

**Acceptance Criteria:**
- [ ] `startWorkLoop(feature)` begins the work iteration
- [ ] Loop checks `feature_list.json` for pending tests
- [ ] Loop detects first vs subsequent session
- [ ] Loop routes to Initializer or Coding Agent
- [ ] Loop handles resume if session < 24h
- [ ] Loop stops when 100% tests pass
- [ ] Loop provides progress feedback
- [ ] Loop handles graceful interruption (SIGINT)
- [ ] Test coverage >= 80%

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

**Tests Required:**
```
- should detect first session and use initializer
- should detect subsequent session and use coding agent
- should resume existing session if < 24h
- should stop when all tests pass
- should handle interruption gracefully
- should update session store each iteration
- should report progress after each iteration
```

**Dependencies:**
- `src/utils/session-detection.ts` (Task 2.1)
- `src/utils/initializer-flow.ts` (Task 3.4)
- `src/utils/feature-list.ts` (Task 3.1)
- `src/utils/git-context.ts` (Task 4.1)
- `src/utils/prompts/coding-agent.ts` (Task 2.4)

**Story Points:** 5

---

### Task 4.3: Work Command Implementation

**Objective:** Implement the `adk3 feature work <name>` command as the main entry point.

**Files to Create:**
- None (modifying existing)

**Files to Modify:**
- `src/commands/feature-v3.ts` - Add work() method
- `src/cli-v3.ts` - Register work command

**Acceptance Criteria:**
- [ ] `adk3 feature work <name>` command registered
- [ ] Command validates feature exists
- [ ] Command displays initial status
- [ ] Command starts work loop
- [ ] Command handles errors gracefully
- [ ] Command supports `--dry-run` flag
- [ ] Command supports `--max-iterations` flag
- [ ] Spinner feedback during execution
- [ ] Test coverage >= 80%

**Command Interface:**
```
adk3 feature work <name> [options]

Options:
  --dry-run           Show what would happen without executing
  --max-iterations    Limit work iterations (default: unlimited)
  -v, --verbose       Show detailed output
```

**Tests Required:**
```
- should register work command
- should validate feature name
- should fail for non-existent feature
- should start work loop
- should respect dry-run flag
- should respect max-iterations flag
- should show progress spinner
- should handle errors gracefully
```

**Dependencies:**
- `src/utils/work-loop.ts` (Task 4.2)
- `src/utils/session-store.ts` (existing)
- Commander.js (existing)
- Ora (existing)

**Story Points:** 3

---

### Task 4.4: End-to-End Integration Tests

**Objective:** Create comprehensive integration tests validating the complete work flow.

**Files to Create:**
- `tests/e2e/v3-work-flow.test.ts` - Integration tests

**Files to Modify:**
- None (new test file)

**Acceptance Criteria:**
- [ ] Test complete first-session flow (Initializer → artifacts)
- [ ] Test complete subsequent-session flow (Coding Agent → progress)
- [ ] Test session resume across "restarts"
- [ ] Test 100% completion detection
- [ ] Test error recovery
- [ ] Test with mocked Claude execution
- [ ] All tests isolated with temp directories
- [ ] Test coverage report includes e2e

**Test Scenarios:**
```
1. First session: PRD → feature_list.json + init.sh
2. Second session: Resume → Work on feature → Mark passing
3. Multi-iteration: Loop until complete
4. Error recovery: Handle Claude timeout
5. Interruption: SIGINT handling
```

**Tests Required:**
```
- should complete first session setup flow
- should resume and continue in second session
- should complete multi-iteration work
- should handle Claude execution timeout
- should recover from temporary errors
- should detect 100% completion
- should handle graceful interruption
```

**Dependencies:**
- All previous tasks
- Jest test framework

**Story Points:** 2

---

## Implementation Order

```
Sprint 2 (Prompts & Detection)
├── 2.1 Session Detection ─────────────┐
├── 2.2 Feature List Types ────────────┤ (parallel)
├── 2.3 Initializer Agent Prompt ──────┤ depends on 2.2
└── 2.4 Coding Agent Prompt ───────────┘ depends on 2.2

Sprint 3 (Feature List & Init)
├── 3.1 Feature List Manager ──────────┐ depends on 2.2
├── 3.2 Init Script Generator ─────────┤ (parallel with 3.1)
├── 3.3 PRD Parser ────────────────────┤ (parallel with 3.1, 3.2)
└── 3.4 Initializer Integration ───────┘ depends on 2.1, 2.3, 3.1, 3.2, 3.3

Sprint 4 (Git & Work Command)
├── 4.1 Git Context ───────────────────┐ (can start parallel)
├── 4.2 Work Loop Controller ──────────┤ depends on 2.1, 2.4, 3.4, 4.1
├── 4.3 Work Command ──────────────────┤ depends on 4.2
└── 4.4 E2E Integration Tests ─────────┘ depends on 4.3
```

### Critical Path

```
2.2 → 2.3 → 3.1 → 3.4 → 4.2 → 4.3 → 4.4
```

---

## Verification Points

### After Sprint 2 (Checkpoint 1)

Run verification:
```bash
npm run type-check
npm test -- --testPathPattern="session-detection|feature-list-v3|initializer-agent|coding-agent"
npm run check
```

**Expected State:**
- [ ] Session detection works for new/existing features
- [ ] Feature list types validate correctly
- [ ] Both prompts generate valid strings
- [ ] All Sprint 2 tests pass
- [ ] No TypeScript errors

---

### After Sprint 3 (Checkpoint 2)

Run verification:
```bash
npm run type-check
npm test -- --testPathPattern="feature-list|init-script|prd-parser|initializer-flow"
npm run check
```

**Expected State:**
- [ ] Feature list CRUD works
- [ ] Init scripts generate safely
- [ ] PRD parsing extracts requirements
- [ ] Initializer flow orchestrates correctly
- [ ] All Sprint 3 tests pass

---

### After Sprint 4 (Final Verification)

Run verification:
```bash
npm run type-check
npm test
npm run test:coverage
npm run check
```

**Expected State:**
- [ ] `adk3 feature work <name>` executes successfully
- [ ] First session generates artifacts
- [ ] Subsequent sessions resume and continue
- [ ] Work loop completes at 100% pass
- [ ] Coverage >= 80% for new modules
- [ ] All tests pass
- [ ] Lint/format passes

---

## Testing Strategy

### Unit Testing

| Module | Test File | Focus |
|--------|-----------|-------|
| session-detection | `session-detection.test.ts` | File existence, path validation |
| feature-list-v3 | `feature-list-v3.test.ts` | Schema validation, type guards |
| initializer-agent | `initializer-agent.test.ts` | Prompt structure, injection |
| coding-agent | `coding-agent.test.ts` | Prompt structure, context |
| feature-list | `feature-list.test.ts` | CRUD, atomic writes |
| init-script | `init-script.test.ts` | Script generation, safety |
| prd-parser | `prd-parser.test.ts` | Markdown parsing |
| git-context | `git-context.test.ts` | Git operations |
| work-loop | `work-loop.test.ts` | Loop logic, state |

### Integration Testing

| Test File | Scope |
|-----------|-------|
| `initializer-flow.test.ts` | PRD → Claude → Artifacts |
| `v3-work-flow.test.ts` | Complete work command flow |

### Test Isolation Pattern

```typescript
describe('Module', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  // tests...
})
```

### Mock Strategy

- **Claude Execution:** Mock `claude-v3.ts` in tests to avoid real API calls
- **File System:** Use temp directories, cleanup after each test
- **Git Operations:** Use `simple-git` with test repositories
- **Time:** Mock `Date.now()` for timestamp tests

---

## Risk Mitigation During Implementation

### Risk: `--print-session-id` Compatibility

**Mitigation in Task 2.1:**
```typescript
export function parseSessionId(output: string): string | null {
  // Primary: --print-session-id output
  const printMatch = output.match(/Session ID: ([a-f0-9-]+)/i)
  if (printMatch) return printMatch[1]

  // Fallback: stderr pattern
  const stderrMatch = output.match(/session[:\s]+([a-f0-9-]+)/i)
  return stderrMatch?.[1] ?? null
}
```

### Risk: Premature Completion Declaration

**Mitigation in Task 2.4 (Coding Agent Prompt):**
```
CRITICAL: Only mark a test as passes: true if:
1. You have actually run the test command
2. The test output shows SUCCESS/PASS
3. You can quote the exact test output proving passage

NEVER mark passes: true based on:
- Code review alone
- "Should work" assumptions
- Partial test runs
```

### Risk: Init Script Security

**Mitigation in Task 3.2:**
- Whitelist approach only
- No shell variable interpolation
- Template-based generation
- shellcheck validation in tests

### Risk: Session Expiration

**Mitigation in Task 4.2:**
- Check session age at loop start
- Warn if > 20h old
- Checkpoint before operations if > 22h

---

## Dependencies to Add

```json
// package.json devDependencies
{
  "zod": "^3.22.0"  // Schema validation
}
```

---

## Files Summary

### New Files (15)

| File | Task |
|------|------|
| `src/utils/session-detection.ts` | 2.1 |
| `src/types/feature-list-v3.ts` | 2.2 |
| `src/utils/prompts/initializer-agent.ts` | 2.3 |
| `src/utils/prompts/coding-agent.ts` | 2.4 |
| `src/utils/feature-list.ts` | 3.1 |
| `src/types/init-script-v3.ts` | 3.2 |
| `src/utils/init-script.ts` | 3.2 |
| `src/utils/prd-parser.ts` | 3.3 |
| `src/utils/initializer-flow.ts` | 3.4 |
| `src/utils/git-context.ts` | 4.1 |
| `src/utils/work-loop.ts` | 4.2 |
| `tests/utils/session-detection.test.ts` | 2.1 |
| `tests/types/feature-list-v3.test.ts` | 2.2 |
| `tests/utils/prompts/initializer-agent.test.ts` | 2.3 |
| `tests/utils/prompts/coding-agent.test.ts` | 2.4 |

### Modified Files (2)

| File | Tasks |
|------|-------|
| `src/commands/feature-v3.ts` | 3.4, 4.3 |
| `src/cli-v3.ts` | 4.3 |

---

## Definition of Done

A task is considered **complete** when:

1. [ ] All acceptance criteria met
2. [ ] Unit tests written and passing
3. [ ] Test coverage >= 80% for new code
4. [ ] TypeScript type-check passes
5. [ ] Biome lint/format passes
6. [ ] No regressions in existing tests
7. [ ] Checkpoint created with progress
8. [ ] Context cleared before next task

---

*Plan created: 2026-01-26*
*Ready for implementation: Sprint 2, Task 2.1*
