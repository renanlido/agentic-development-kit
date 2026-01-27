# Tasks: adk-v3-session-continuity-2

**Sprint**: 2 (Dual-Agent Prompts)
**Total Story Points**: 29
**Estimated Duration**: 3 days

---

## Sprint 1: Types & Core Utilities (Day 1)

### Task 1.1: Create FeatureList types
**Status**: [x] Completed
**Story Points**: 1
**File**: `src/types/feature-list-v3.ts`

**Subtasks**:
- [~] Create `TestDefinition` interface with all required fields
- [~] Create `FeatureListData` interface
- [~] Create `FeatureListSummary` interface
- [~] Create `TestCategory` type alias
- [x] Add JSDoc documentation to all types
- [x] Export all types from module

**Test File**: `tests/types/feature-list-v3.test.ts`
- [x] TestDefinition type-checks correctly
- [x] FeatureListData type-checks correctly
- [x] All categories ('functional', 'ui', 'integration', 'e2e') compile

**Acceptance Criteria**:
- `npm run type-check` passes
- Test file compiles without errors
- All interfaces match PRD specification

---

### Task 1.2: Create InitScript types
**Status**: [x] Completed
**Story Points**: 1
**File**: `src/types/init-script-v3.ts`
**Depends on**: None

**Subtasks**:
- [~] Create `ProjectType` type ('node' | 'python' | 'rust' | 'go' | 'docker' | 'unknown')
- [~] Create `InitScriptOptions` interface
- [~] Create `InitScriptResult` interface
- [x] Add JSDoc documentation
- [x] Export all types

**Test File**: `tests/types/init-script-v3.test.ts`
- [x] ProjectType accepts all valid values
- [x] ProjectType rejects invalid values (via type narrowing test)
- [x] InitScriptOptions optional fields work

**Acceptance Criteria**:
- `npm run type-check` passes
- All types documented

---

### Task 1.3: Create Prompts types
**Status**: [x] Completed
**Story Points**: 1
**File**: `src/types/prompts-v3.ts`
**Depends on**: Task 1.1 (imports FeatureListData)

**Subtasks**:
- [~] Create `PromptContext` interface
- [~] Create `AgentType` type ('initializer' | 'coding')
- [~] Create `PromptBuilderResult` interface
- [x] Import types from feature-list-v3.ts and session-v3.ts
- [x] Add JSDoc documentation
- [x] Export all types

**Test File**: `tests/types/prompts-v3.test.ts`
- [x] PromptContext compiles with all optional fields
- [x] AgentType only accepts valid values
- [x] PromptBuilderResult has required fields

**Acceptance Criteria**:
- ✅ `npm run type-check` passes
- ✅ Imports resolve correctly
- ✅ Types match PRD specification

---

### Task 2.1: Write FeatureList tests (TDD)
**Status**: [x] Completed
**Story Points**: 1
**File**: `tests/utils/feature-list.test.ts`
**Depends on**: Task 1.1

**Test Cases to Write**:
```typescript
describe('FeatureList', () => {
  describe('create', () => {
    it('should create feature_list.json with valid structure')
    it('should generate summary with correct counts')
    it('should use atomic write pattern')
    it('should include version and created timestamp')
    it('should reject invalid feature names')
  })

  describe('get', () => {
    it('should return existing feature list')
    it('should return null when file does not exist')
    it('should handle corrupted JSON gracefully')
  })

  describe('addTest', () => {
    it('should add test to existing feature list')
    it('should update summary after adding')
    it('should generate unique ID if not provided')
  })

  describe('updateTestStatus', () => {
    it('should mark test as passing')
    it('should update lastTested timestamp')
    it('should store evidence when provided')
    it('should recalculate summary')
    it('should throw if test ID not found')
  })

  describe('getSummary', () => {
    it('should return correct counts')
    it('should return null for non-existent feature')
  })
})
```

**Acceptance Criteria**:
- All test cases defined
- Tests use temp directory pattern
- Tests initially fail (red phase)

---

### Task 2.2: Implement FeatureList class
**Status**: [x] Completed
**Story Points**: 2
**File**: `src/utils/feature-list.ts`
**Depends on**: Task 1.1, Task 2.1

**Subtasks**:
- [~] Create `FeatureList` class
- [x] Implement `getBasePath()` with TEST_FEATURE_PATH support
- [x] Implement `validateFeatureName()` for path traversal protection
- [x] Implement `getFilePath()` for feature_list.json path
- [x] Implement `calculateSummary()` helper
- [x] Implement `create(feature, tests?)` method
- [x] Implement `get(feature)` method
- [x] Implement `addTest(feature, test)` method
- [x] Implement `updateTestStatus(feature, testId, passes, evidence?)` method
- [x] Implement `getSummary(feature)` method
- [x] Export singleton instance

**Patterns to Follow**:
- Atomic write (temp file + move) from session-store.ts
- TEST_FEATURE_PATH for testing
- Graceful handling of corrupted files

**Acceptance Criteria**:
- All tests from Task 2.1 pass
- Atomic write implemented
- Path traversal protection works
- `npm test -- tests/utils/feature-list.test.ts` passes

---

### Task 2.3: FeatureList edge cases and format verification
**Status**: [x] Completed
**Story Points**: 1
**File**: `tests/utils/feature-list.test.ts` (extend)
**Depends on**: Task 2.2

**Additional Tests**:
- [x] Test concurrent writes without race conditions
- [x] Test preserving test order when adding
- [x] Test very long descriptions
- [x] Test special characters in test IDs
- [x] Test automatic directory creation
- [x] Verify JSON output matches PRD format exactly

**Acceptance Criteria**:
- All edge case tests pass
- JSON format verified against PRD
- Coverage >= 80%

---

## Sprint 2: InitScript & Detection (Day 2)

### Task 3.1: Write InitScript tests (TDD)
**Status**: [x] Completed
**Story Points**: 1
**File**: `tests/utils/init-script.test.ts`
**Depends on**: Task 1.2

**Test Cases to Write**:
```typescript
describe('InitScript', () => {
  describe('detect', () => {
    it('should detect Node.js by package.json')
    it('should detect Python by requirements.txt')
    it('should detect Python by pyproject.toml')
    it('should detect Rust by Cargo.toml')
    it('should detect Go by go.mod')
    it('should detect Docker by docker-compose.yml')
    it('should return unknown for unrecognized')
    it('should prioritize specific types')
  })

  describe('create', () => {
    it('should generate executable bash script')
    it('should include shebang and set -e')
    it('should include Node.js commands')
    it('should include Python commands')
    it('should include custom commands')
    it('should skip detection when skipDetection is true')
    it('should validate feature name')
  })

  describe('get', () => {
    it('should return existing init.sh content')
    it('should return null when not exists')
  })
})
```

**Acceptance Criteria**:
- All test cases defined
- Tests use temp directory pattern
- Tests initially fail (red phase)

---

### Task 3.2: Implement InitScript class
**Status**: [x] Completed
**Story Points**: 2
**File**: `src/utils/init-script.ts`
**Depends on**: Task 1.2, Task 3.1

**Subtasks**:
- [~] Create `InitScript` class
- [x] Implement `getBasePath()` with TEST_FEATURE_PATH
- [x] Implement `validateFeatureName()`
- [x] Implement `getFilePath()` for init.sh path
- [x] Define project templates map
- [x] Implement `detect(projectRoot?)` method
- [x] Implement `create(feature, options?)` method
- [x] Implement `get(feature)` method
- [x] Export singleton instance

**Project Templates**:
```typescript
const templates = {
  node: ['npm install 2>/dev/null || true', 'npm run dev &'],
  python: ['pip install -r requirements.txt 2>/dev/null || true'],
  rust: ['cargo build --release 2>/dev/null || true'],
  go: ['go build ./... 2>/dev/null || true'],
  docker: ['docker-compose up -d 2>/dev/null || true'],
  unknown: ['echo "No specific setup detected"']
}
```

**Acceptance Criteria**:
- All tests from Task 3.1 pass
- Detection works correctly
- Scripts are executable
- Scripts are idempotent

---

### Task 3.3: InitScript format verification
**Status**: [x] Completed
**Story Points**: 1
**File**: `tests/utils/init-script.test.ts` (extend)
**Depends on**: Task 3.2

**Additional Tests**:
- [x] Test detection priority order
- [x] Test multiple markers in same project
- [x] Verify shebang is `#!/bin/bash`
- [x] Verify `set -e` is included
- [x] Verify feature name comment
- [x] Verify creation date comment
- [x] Verify commands use `|| true`

**Acceptance Criteria**:
- Format matches PRD exactly
- Coverage >= 80%

---

### Task 4.1: Write SessionDetector tests (TDD)
**Status**: [x] Completed
**Story Points**: 1
**File**: `tests/utils/session-detector.test.ts`
**Depends on**: Task 2.2, Task 3.2

**Test Cases to Write**:
```typescript
describe('SessionDetector', () => {
  describe('isFirstSession', () => {
    it('should return true when feature_list.json not exists')
    it('should return true when init.sh not exists')
    it('should return true when progress.txt is empty')
    it('should return false when all artifacts exist')
    it('should return false for corrupted feature_list.json')
    it('should validate feature name')
  })

  describe('getAgentType', () => {
    it('should return initializer for first session')
    it('should return coding for subsequent sessions')
  })
})
```

**Acceptance Criteria**:
- All test cases defined
- Tests use temp directory pattern
- Tests initially fail (red phase)

---

### Task 4.2: Implement SessionDetector
**Status**: [x] Completed
**Story Points**: 2
**File**: `src/utils/session-detector.ts`
**Depends on**: Task 1.3, Task 4.1

**Subtasks**:
- [x] Create `SessionDetector` class
- [x] Implement `getBasePath()`
- [x] Implement `validateFeatureName()`
- [x] Implement `getFeaturePath()`
- [x] Implement `isFirstSession(feature)` method
- [x] Implement `getAgentType(feature)` method
- [x] Export singleton instance

**Detection Logic**:
```typescript
isFirstSession returns true if:
- feature_list.json does not exist OR
- init.sh does not exist OR
- claude-progress.txt is empty/missing
```

**Acceptance Criteria**:
- All tests from Task 4.1 pass
- Detection is robust
- Edge cases handled

---

## Sprint 3: Prompts & Integration (Day 3)

### Task 5.1: Create prompts directory structure
**Status**: [x] Completed
**Story Points**: 0.5
**Files**: `src/utils/prompts/` directory, `src/utils/prompts/index.ts`
**Depends on**: None

**Subtasks**:
- [x] Create `src/utils/prompts/` directory
- [x] Create `src/utils/prompts/index.ts` barrel export file

**Acceptance Criteria**:
- Directory exists
- Index file ready for exports

---

### Task 5.2: Write Initializer Agent tests (TDD)
**Status**: [x] Completed
**Story Points**: 1
**File**: `tests/utils/prompts/initializer-agent.test.ts`
**Depends on**: Task 1.3, Task 5.1

**Test Cases**:
```typescript
describe('buildInitializerPrompt', () => {
  it('should include instruction to read PRD')
  it('should include instruction to generate feature_list.json')
  it('should include instruction to generate init.sh')
  it('should include instruction to create progress.txt')
  it('should include instruction to git commit')
  it('should include feature name')
  it('should include PRD path when provided')
  it('should be under 2000 tokens')
  it('should include JSON schema')
  it('should include example output')
  it('should return agentType as initializer')
})
```

**Acceptance Criteria**:
- All test cases defined
- Tests initially fail (red phase)

---

### Task 5.3: Implement Initializer Agent prompt
**Status**: [x] Completed
**Story Points**: 2
**File**: `src/utils/prompts/initializer-agent.ts`
**Depends on**: Task 1.3, Task 5.2

**Subtasks**:
- [x] Create `buildInitializerPrompt(feature, context?)` function
- [x] Include PRD reading instruction
- [x] Include feature_list.json generation with schema
- [x] Include init.sh generation instruction
- [x] Include progress.txt creation instruction
- [x] Include git commit instruction
- [x] Implement token estimation
- [x] Return PromptBuilderResult

**Acceptance Criteria**:
- All tests from Task 5.2 pass
- Prompt < 2000 tokens
- All instructions clear and actionable

---

### Task 5.4: Write Coding Agent tests (TDD)
**Status**: [ ] Pending
**Story Points**: 1
**File**: `tests/utils/prompts/coding-agent.test.ts`
**Depends on**: Task 1.3, Task 5.1

**Test Cases**:
```typescript
describe('buildCodingAgentPrompt', () => {
  it('should include instruction to run pwd')
  it('should include instruction to read progress.txt')
  it('should include instruction to read feature_list.json')
  it('should include instruction to run git log')
  it('should include instruction to run init.sh')
  it('should include instruction to work on ONE feature')
  it('should include instruction to test e2e')
  it('should include instruction to commit')
  it('should include instruction to update progress')
  it('should be under 2000 tokens')
  it('should include feature name')
  it('should return agentType as coding')
})
```

**Acceptance Criteria**:
- All test cases defined
- Tests initially fail (red phase)

---

### Task 5.5: Implement Coding Agent prompt
**Status**: [ ] Pending
**Story Points**: 2
**File**: `src/utils/prompts/coding-agent.ts`
**Depends on**: Task 1.3, Task 5.4

**Subtasks**:
- [~] Create `buildCodingAgentPrompt(feature, context?)` function
- [ ] Include pwd confirmation step
- [ ] Include progress reading step
- [ ] Include feature_list.json reading step
- [ ] Include git log step
- [ ] Include init.sh execution step
- [ ] Include ONE feature work instruction
- [ ] Include e2e testing instruction
- [ ] Include commit instruction
- [ ] Include progress update instruction
- [ ] Implement token estimation
- [x] Return PromptBuilderResult

**Acceptance Criteria**:
- All tests from Task 5.4 pass
- Prompt < 2000 tokens
- All instructions clear and actionable

---

### Task 5.6: Complete prompts index barrel
**Status**: [ ] Pending
**Story Points**: 0.5
**File**: `src/utils/prompts/index.ts`
**Depends on**: Task 5.3, Task 5.5

**Subtasks**:
- [ ] Export `buildInitializerPrompt` from initializer-agent.ts
- [ ] Export `buildCodingAgentPrompt` from coding-agent.ts

**Acceptance Criteria**:
- Both functions exported correctly
- Import works from parent module

---

### Task 6.1: Update session-v3.ts with agentType
**Status**: [ ] Pending
**Story Points**: 1
**File**: `src/types/session-v3.ts`
**Depends on**: None

**Changes**:
- [ ] Add `agentType?: 'initializer' | 'coding'` to metadata interface
- [ ] Update JSDoc documentation
- [ ] Ensure backward compatibility

**Test File**: `tests/types/session-v3.test.ts` (extend)
- [ ] Test agentType is optional
- [ ] Test existing sessions still work

**Acceptance Criteria**:
- Existing tests still pass
- New field documented
- Backward compatible

---

### Task 6.2: Add tests command to feature-v3.ts
**Status**: [ ] Pending
**Story Points**: 1.5
**File**: `src/commands/feature-v3.ts`
**Depends on**: Task 2.2

**Subtasks**:
- [ ] Import `featureList` from feature-list.ts
- [ ] Import `chalk` for colored output
- [ ] Implement `tests(name: string)` method
- [ ] Display test list with status icons
- [ ] Display summary at end
- [ ] Handle missing feature list

**Output Format**:
```
Tests for my-feature:

✓ test-001: Description [PASSING]
○ test-002: Description [PENDING]

Summary: 1/2 passing
```

**Test File**: `tests/commands/feature-v3.test.ts` (extend)
- [ ] Test tests command shows all tests
- [ ] Test tests command handles missing feature
- [ ] Test tests command shows correct colors

**Acceptance Criteria**:
- Command displays correctly
- Colors work (green=passing, yellow=pending)
- Summary shows correct counts

---

### Task 6.3: Add work command to feature-v3.ts
**Status**: [ ] Pending
**Story Points**: 2
**File**: `src/commands/feature-v3.ts`
**Depends on**: Task 4.2, Task 5.3, Task 5.5

**Subtasks**:
- [ ] Import `sessionDetector` from session-detector.ts
- [~] Import prompt builders from prompts/index.ts
- [ ] Implement `work(name: string)` method
- [ ] Get agent type using sessionDetector
- [ ] Build appropriate prompt based on agent type
- [ ] Execute Claude with prompt
- [ ] Save session with agentType in metadata

**Test File**: `tests/commands/feature-v3.test.ts` (extend)
- [ ] Test work command uses initializer for first session
- [ ] Test work command uses coding agent for subsequent
- [ ] Test work command saves session with agentType

**Acceptance Criteria**:
- Correct agent selected
- Session persisted with agentType
- Prompt passed correctly

---

### Task 6.4: Register new commands in cli-v3.ts
**Status**: [ ] Pending
**Story Points**: 0.5
**File**: `src/cli-v3.ts`
**Depends on**: Task 6.2, Task 6.3

**Subtasks**:
- [ ] Add `feature tests <name>` command
- [ ] Add `feature work <name>` command
- [ ] Update help text

**Test File**: `tests/cli-v3.test.ts` (extend)
- [ ] Test tests command is registered
- [ ] Test work command is registered
- [ ] Test help shows new commands

**Acceptance Criteria**:
- `npm run adk3 -- feature tests my-feature` works
- `npm run adk3 -- feature work my-feature` works
- Help text correct

---

## Final Verification

### Task 7.1: Full test suite and coverage
**Status**: [ ] Pending
**Story Points**: 1
**Depends on**: All previous tasks

**Commands**:
```bash
npm test
npm run test:coverage
npm run type-check
npm run check
```

**Acceptance Criteria**:
- All tests pass
- Coverage >= 80% for all new files
- No TypeScript errors
- No lint errors

---

### Task 7.2: V2 isolation verification
**Status**: [ ] Pending
**Story Points**: 0.5
**Depends on**: All previous tasks

**Commands**:
```bash
git diff src/cli.ts
git diff src/commands/feature.ts
```

**Acceptance Criteria**:
- Both commands return empty (no changes to v2 files)
- Only v3 files modified

---

## Summary Table

| Task | Description | Points | Depends On | Status |
|------|-------------|--------|------------|--------|
| 1.1 | FeatureList types | 1 | - | [ ] |
| 1.2 | InitScript types | 1 | - | [ ] |
| 1.3 | Prompts types | 1 | 1.1 | [ ] |
| 2.1 | FeatureList tests (TDD) | 1 | 1.1 | [ ] |
| 2.2 | FeatureList implementation | 2 | 2.1 | [ ] |
| 2.3 | FeatureList edge cases | 1 | 2.2 | [ ] |
| 3.1 | InitScript tests (TDD) | 1 | 1.2 | [ ] |
| 3.2 | InitScript implementation | 2 | 3.1 | [ ] |
| 3.3 | InitScript format verify | 1 | 3.2 | [ ] |
| 4.1 | SessionDetector tests (TDD) | 1 | 2.2, 3.2 | [ ] |
| 4.2 | SessionDetector implementation | 2 | 4.1 | [ ] |
| 5.1 | Prompts directory | 0.5 | - | [ ] |
| 5.2 | Initializer Agent tests (TDD) | 1 | 5.1 | [ ] |
| 5.3 | Initializer Agent implementation | 2 | 5.2 | [ ] |
| 5.4 | Coding Agent tests (TDD) | 1 | 5.1 | [ ] |
| 5.5 | Coding Agent implementation | 2 | 5.4 | [ ] |
| 5.6 | Prompts index barrel | 0.5 | 5.3, 5.5 | [ ] |
| 6.1 | Update session-v3.ts | 1 | - | [ ] |
| 6.2 | Add tests command | 1.5 | 2.2 | [ ] |
| 6.3 | Add work command | 2 | 4.2, 5.3, 5.5 | [ ] |
| 6.4 | Register CLI commands | 0.5 | 6.2, 6.3 | [ ] |
| 7.1 | Full verification | 1 | All | [ ] |
| 7.2 | V2 isolation check | 0.5 | All | [ ] |

**Total**: 29 story points

---

## Execution Order (Optimal)

### Day 1 Morning
1. Task 1.1 (FeatureList types)
2. Task 1.2 (InitScript types)
3. Task 1.3 (Prompts types)

### Day 1 Afternoon
4. Task 2.1 (FeatureList tests)
5. Task 2.2 (FeatureList implementation)
6. Task 2.3 (FeatureList edge cases)

### Day 2 Morning
7. Task 3.1 (InitScript tests)
8. Task 3.2 (InitScript implementation)
9. Task 3.3 (InitScript format)

### Day 2 Afternoon
10. Task 4.1 (SessionDetector tests)
11. Task 4.2 (SessionDetector implementation)
12. Task 5.1 (Prompts directory)

### Day 3 Morning
13. Task 5.2 (Initializer Agent tests)
14. Task 5.3 (Initializer Agent implementation)
15. Task 5.4 (Coding Agent tests)
16. Task 5.5 (Coding Agent implementation)
17. Task 5.6 (Prompts index)

### Day 3 Afternoon
18. Task 6.1 (Update session types)
19. Task 6.2 (tests command)
20. Task 6.3 (work command)
21. Task 6.4 (CLI registration)
22. Task 7.1 (Full verification)
23. Task 7.2 (V2 isolation check)

---

*Tasks breakdown completed - ADK v3 Sprint 2*
