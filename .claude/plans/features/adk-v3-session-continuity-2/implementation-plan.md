# Implementation Plan: adk-v3-session-continuity-2

**Feature**: Dual-Agent Prompts for Session Continuity
**Sprint**: 2
**Created**: 2026-01-26
**Based on**: research.md, prd.md
**Dependency**: Sprint 1 (adk-v3-session-continuity) ✅ Complete

---

## Executive Summary

This sprint implements the **dual-agent pattern** from Anthropic's guidance on long-running agents. The key innovation is differentiating between:

1. **Initializer Agent** (first session): Sets up artifacts, generates `feature_list.json` and `init.sh`
2. **Coding Agent** (subsequent sessions): Works incrementally on features, tracks progress

---

## Phase Overview

| Phase | Focus | Story Points | Tasks |
|-------|-------|--------------|-------|
| **1** | Types & Interfaces | 3 | 1.1-1.3 |
| **2** | FeatureList Utility | 5 | 2.1-2.4 |
| **3** | InitScript Utility | 5 | 3.1-3.4 |
| **4** | Session Detection | 3 | 4.1-4.2 |
| **5** | Prompt Builders | 8 | 5.1-5.6 |
| **6** | Integration & CLI | 5 | 6.1-6.4 |

**Total**: 29 story points (~3 days)

---

## Phase 1: Types & Interfaces

### Objective
Define all TypeScript types and interfaces needed for Sprint 2. Types first ensures compile-time safety throughout implementation.

### Tasks

#### Task 1.1: Create feature-list-v3.ts types
**File**: `src/types/feature-list-v3.ts`

**Interfaces to define**:
```typescript
interface TestDefinition {
  id: string
  description: string
  category: 'functional' | 'ui' | 'integration' | 'e2e'
  steps: string[]
  passes: boolean
  lastTested: string | null
  evidence: string | null
}

interface FeatureListData {
  feature: string
  version: string
  created: string
  tests: TestDefinition[]
  summary: FeatureListSummary
}

interface FeatureListSummary {
  total: number
  passing: number
  failing: number
  pending: number
}

type TestCategory = TestDefinition['category']
```

**Test**: `tests/types/feature-list-v3.test.ts`
- [ ] TestDefinition interface compiles correctly
- [ ] FeatureListData interface compiles correctly
- [ ] FeatureListSummary interface compiles correctly
- [ ] TestCategory type-checks correctly

**Acceptance Criteria**:
- [ ] All types exported from module
- [ ] No compilation errors
- [ ] Types documented with JSDoc

**Story Points**: 1

---

#### Task 1.2: Create init-script-v3.ts types
**File**: `src/types/init-script-v3.ts`

**Interfaces to define**:
```typescript
type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'docker' | 'unknown'

interface InitScriptOptions {
  projectType?: ProjectType
  customCommands?: string[]
  skipDetection?: boolean
}

interface InitScriptResult {
  script: string
  projectType: ProjectType
  detectedFiles: string[]
}
```

**Test**: `tests/types/init-script-v3.test.ts`
- [ ] ProjectType type-checks all valid values
- [ ] InitScriptOptions interface compiles correctly
- [ ] InitScriptResult interface compiles correctly

**Acceptance Criteria**:
- [ ] All types exported from module
- [ ] No compilation errors
- [ ] Default values documented

**Story Points**: 1

---

#### Task 1.3: Create prompts-v3.ts types
**File**: `src/types/prompts-v3.ts`

**Interfaces to define**:
```typescript
import type { FeatureListData } from './feature-list-v3.js'
import type { SessionInfoV3 } from './session-v3.js'

interface PromptContext {
  feature: string
  prdPath?: string
  prdContent?: string
  progressContent?: string
  featureListContent?: FeatureListData
  gitLogOutput?: string
  sessionInfo?: SessionInfoV3
}

type AgentType = 'initializer' | 'coding'

interface PromptBuilderResult {
  prompt: string
  agentType: AgentType
  tokenEstimate?: number
}
```

**Test**: `tests/types/prompts-v3.test.ts`
- [ ] PromptContext interface compiles correctly
- [ ] AgentType type-checks 'initializer' and 'coding'
- [ ] PromptBuilderResult interface compiles correctly

**Acceptance Criteria**:
- [ ] All types exported from module
- [ ] No compilation errors
- [ ] References to session-v3.ts types work

**Dependencies**: None
**Story Points**: 1

---

### Phase 1 Verification Checkpoint

```bash
npm run type-check
npm test -- tests/types/feature-list-v3.test.ts
npm test -- tests/types/init-script-v3.test.ts
npm test -- tests/types/prompts-v3.test.ts
```

**Expected**: All tests pass, no TypeScript errors

---

## Phase 2: FeatureList Utility

### Objective
Implement the `FeatureList` class to manage `feature_list.json` files with atomic writes and test tracking.

### Tasks

#### Task 2.1: Create FeatureList test file (TDD)
**File**: `tests/utils/feature-list.test.ts`

**Test cases to write**:
```typescript
describe('FeatureList', () => {
  describe('create', () => {
    it('should create feature_list.json with valid structure')
    it('should generate summary with correct counts')
    it('should use atomic write pattern')
    it('should include version and created timestamp')
    it('should validate feature name against path traversal')
  })

  describe('get', () => {
    it('should return existing feature list')
    it('should return null when file does not exist')
    it('should handle corrupted JSON gracefully')
  })

  describe('addTest', () => {
    it('should add test to existing feature list')
    it('should update summary after adding test')
    it('should preserve existing tests')
    it('should generate unique ID if not provided')
  })

  describe('updateTestStatus', () => {
    it('should mark test as passing')
    it('should mark test as failing')
    it('should update lastTested timestamp')
    it('should store evidence when provided')
    it('should recalculate summary')
    it('should throw if test ID not found')
  })

  describe('getSummary', () => {
    it('should return correct counts')
    it('should handle empty test list')
  })
})
```

**Acceptance Criteria**:
- [ ] All test cases defined
- [ ] Tests use temp directory pattern from session-store.test.ts
- [ ] Tests initially fail (TDD red phase)

**Story Points**: 1

---

#### Task 2.2: Implement FeatureList class
**File**: `src/utils/feature-list.ts`

**Implementation**:
```typescript
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import type {
  FeatureListData,
  FeatureListSummary,
  TestDefinition
} from '../types/feature-list-v3.js'

export class FeatureList {
  private getBasePath(): string
  private validateFeatureName(name: string): void
  private getFilePath(feature: string): string
  private calculateSummary(tests: TestDefinition[]): FeatureListSummary

  async create(feature: string, tests?: TestDefinition[]): Promise<void>
  async get(feature: string): Promise<FeatureListData | null>
  async addTest(feature: string, test: Omit<TestDefinition, 'id'> & { id?: string }): Promise<void>
  async updateTestStatus(feature: string, testId: string, passes: boolean, evidence?: string): Promise<void>
  async getSummary(feature: string): Promise<FeatureListSummary | null>
}

export const featureList = new FeatureList()
```

**Key Patterns**:
- Use TEST_FEATURE_PATH env var for testing
- Atomic writes via temp file + move
- Path traversal protection
- Graceful handling of corrupted files

**Acceptance Criteria**:
- [ ] All tests from 2.1 pass
- [ ] Atomic write pattern implemented
- [ ] Path traversal protection works
- [ ] Singleton exported

**Dependencies**: Task 1.1 (types)
**Story Points**: 2

---

#### Task 2.3: Add edge case tests
**File**: `tests/utils/feature-list.test.ts` (extend)

**Additional test cases**:
```typescript
describe('edge cases', () => {
  it('should handle concurrent writes without race conditions')
  it('should preserve test order when adding')
  it('should handle very long test descriptions')
  it('should handle special characters in test IDs')
  it('should create directories if not exist')
})
```

**Story Points**: 1

---

#### Task 2.4: Verify feature_list.json output format
**Manual verification** + **Integration test**:
- Create feature list with known data
- Verify JSON output matches PRD format exactly
- Verify `summary` calculations are correct

**File**: `tests/utils/feature-list.test.ts` (extend)

```typescript
describe('output format', () => {
  it('should match PRD JSON schema exactly')
})
```

**Acceptance Criteria**:
- [ ] JSON output matches PRD format
- [ ] Pretty-printed with 2 spaces
- [ ] ISO 8601 timestamps used

**Story Points**: 1

---

### Phase 2 Verification Checkpoint

```bash
npm test -- tests/utils/feature-list.test.ts
npm run test:coverage -- --collectCoverageFrom='src/utils/feature-list.ts'
```

**Expected**:
- All tests pass
- Coverage >= 80% for feature-list.ts

---

## Phase 3: InitScript Utility

### Objective
Implement the `InitScript` class to generate and manage `init.sh` scripts with project type detection.

### Tasks

#### Task 3.1: Create InitScript test file (TDD)
**File**: `tests/utils/init-script.test.ts`

**Test cases to write**:
```typescript
describe('InitScript', () => {
  describe('detect', () => {
    it('should detect Node.js project by package.json')
    it('should detect Python project by requirements.txt')
    it('should detect Python project by pyproject.toml')
    it('should detect Rust project by Cargo.toml')
    it('should detect Go project by go.mod')
    it('should detect Docker project by docker-compose.yml')
    it('should return unknown for unrecognized projects')
    it('should prioritize specific types over generic')
  })

  describe('create', () => {
    it('should generate executable bash script')
    it('should include shebang and set -e')
    it('should include project-specific commands for Node.js')
    it('should include project-specific commands for Python')
    it('should include custom commands when provided')
    it('should skip detection when skipDetection is true')
    it('should validate feature name')
  })

  describe('get', () => {
    it('should return existing init.sh content')
    it('should return null when file does not exist')
  })
})
```

**Acceptance Criteria**:
- [ ] All test cases defined
- [ ] Tests use temp directory pattern
- [ ] Tests initially fail (TDD red phase)

**Story Points**: 1

---

#### Task 3.2: Implement InitScript class
**File**: `src/utils/init-script.ts`

**Implementation**:
```typescript
import fs from 'fs-extra'
import path from 'node:path'
import type {
  InitScriptOptions,
  InitScriptResult,
  ProjectType
} from '../types/init-script-v3.js'

export class InitScript {
  private getBasePath(): string
  private validateFeatureName(name: string): void
  private getFilePath(feature: string): string
  private getProjectTemplates(): Record<ProjectType, string[]>

  async detect(projectRoot?: string): Promise<ProjectType>
  async create(feature: string, options?: InitScriptOptions): Promise<InitScriptResult>
  async get(feature: string): Promise<string | null>
}

export const initScript = new InitScript()
```

**Project Templates**:
```typescript
const templates: Record<ProjectType, string[]> = {
  node: ['npm install 2>/dev/null || true', 'npm run dev &'],
  python: ['pip install -r requirements.txt 2>/dev/null || true', 'python -m http.server 8000 &'],
  rust: ['cargo build --release 2>/dev/null || true'],
  go: ['go build ./... 2>/dev/null || true'],
  docker: ['docker-compose up -d 2>/dev/null || true'],
  unknown: ['echo "No specific setup detected"']
}
```

**Acceptance Criteria**:
- [ ] All tests from 3.1 pass
- [ ] Project detection works correctly
- [ ] Generated scripts are executable
- [ ] Scripts are idempotent (safe to run multiple times)

**Dependencies**: Task 1.2 (types)
**Story Points**: 2

---

#### Task 3.3: Add detection priority tests
**File**: `tests/utils/init-script.test.ts` (extend)

**Additional test cases**:
```typescript
describe('detection priority', () => {
  it('should prefer package.json over docker-compose.yml')
  it('should handle multiple markers in same project')
  it('should check files in correct order')
})
```

**Acceptance Criteria**:
- [ ] Detection priority is deterministic
- [ ] Tests verify priority order

**Story Points**: 1

---

#### Task 3.4: Verify init.sh output format
**Manual verification**:
- Generate init.sh for Node.js project
- Verify script is executable (`chmod +x`)
- Verify script runs without errors
- Verify idempotency

**File**: `tests/utils/init-script.test.ts` (extend)

```typescript
describe('output format', () => {
  it('should have correct shebang')
  it('should have set -e for fail-fast')
  it('should have feature name comment')
  it('should have creation date comment')
})
```

**Acceptance Criteria**:
- [ ] Shebang is `#!/bin/bash`
- [ ] `set -e` is included
- [ ] Comments match PRD format
- [ ] Commands use `|| true` for non-critical operations

**Story Points**: 1

---

### Phase 3 Verification Checkpoint

```bash
npm test -- tests/utils/init-script.test.ts
npm run test:coverage -- --collectCoverageFrom='src/utils/init-script.ts'
```

**Expected**:
- All tests pass
- Coverage >= 80% for init-script.ts

---

## Phase 4: Session Detection

### Objective
Implement session detection to determine if this is the first session (needs Initializer Agent) or subsequent session (needs Coding Agent).

### Tasks

#### Task 4.1: Create session-detector test file (TDD)
**File**: `tests/utils/session-detector.test.ts`

**Test cases to write**:
```typescript
describe('SessionDetector', () => {
  describe('isFirstSession', () => {
    it('should return true when feature_list.json does not exist')
    it('should return true when init.sh does not exist')
    it('should return true when progress.txt is empty')
    it('should return false when all artifacts exist')
    it('should return false when feature_list.json exists but is corrupted')
    it('should validate feature name')
  })

  describe('getAgentType', () => {
    it('should return initializer for first session')
    it('should return coding for subsequent sessions')
  })
})
```

**Acceptance Criteria**:
- [ ] All test cases defined
- [ ] Tests use temp directory pattern
- [ ] Tests initially fail (TDD red phase)

**Story Points**: 1

---

#### Task 4.2: Implement SessionDetector
**File**: `src/utils/session-detector.ts`

**Implementation**:
```typescript
import fs from 'fs-extra'
import path from 'node:path'
import type { AgentType } from '../types/prompts-v3.js'

export class SessionDetector {
  private getBasePath(): string
  private validateFeatureName(name: string): void
  private getFeaturePath(feature: string): string

  async isFirstSession(feature: string): Promise<boolean>
  async getAgentType(feature: string): Promise<AgentType>
}

export const sessionDetector = new SessionDetector()
```

**Detection Logic**:
```typescript
async isFirstSession(feature: string): Promise<boolean> {
  const featurePath = this.getFeaturePath(feature)

  const featureListPath = path.join(featurePath, 'feature_list.json')
  const initScriptPath = path.join(featurePath, 'init.sh')
  const progressPath = path.join(featurePath, 'claude-progress.txt')

  const featureListExists = await fs.pathExists(featureListPath)
  const initScriptExists = await fs.pathExists(initScriptPath)
  const progressExists = await fs.pathExists(progressPath)

  if (!featureListExists || !initScriptExists) {
    return true
  }

  if (progressExists) {
    const content = await fs.readFile(progressPath, 'utf-8')
    if (content.trim().length === 0) {
      return true
    }
  }

  return false
}
```

**Acceptance Criteria**:
- [ ] All tests from 4.1 pass
- [ ] Detection is robust and handles edge cases
- [ ] Path traversal protection works

**Dependencies**: Tasks 2.2, 3.2
**Story Points**: 2

---

### Phase 4 Verification Checkpoint

```bash
npm test -- tests/utils/session-detector.test.ts
npm run test:coverage -- --collectCoverageFrom='src/utils/session-detector.ts'
```

**Expected**:
- All tests pass
- Coverage >= 80% for session-detector.ts

---

## Phase 5: Prompt Builders

### Objective
Implement the two prompt builders that generate specialized prompts for each agent type.

### Tasks

#### Task 5.1: Create prompts directory structure
**Files**:
- `src/utils/prompts/` (directory)
- `src/utils/prompts/index.ts` (barrel export)

**Acceptance Criteria**:
- [ ] Directory created
- [ ] Index file exports all prompt builders

**Story Points**: 0.5

---

#### Task 5.2: Create initializer-agent test file (TDD)
**File**: `tests/utils/prompts/initializer-agent.test.ts`

**Test cases to write**:
```typescript
describe('buildInitializerPrompt', () => {
  it('should include instruction to read PRD')
  it('should include instruction to generate feature_list.json')
  it('should include instruction to generate init.sh')
  it('should include instruction to create claude-progress.txt')
  it('should include instruction to git commit')
  it('should include feature name in prompt')
  it('should include PRD path when provided')
  it('should be under 2000 tokens')
  it('should include JSON schema for feature_list.json')
  it('should include example output format')
})
```

**Acceptance Criteria**:
- [ ] All test cases defined
- [ ] Tests initially fail (TDD red phase)

**Story Points**: 1

---

#### Task 5.3: Implement initializer-agent.ts
**File**: `src/utils/prompts/initializer-agent.ts`

**Implementation**:
```typescript
import type { PromptBuilderResult, PromptContext } from '../../types/prompts-v3.js'

export function buildInitializerPrompt(
  feature: string,
  context?: PromptContext
): PromptBuilderResult {
  const prompt = `You are the INITIALIZER AGENT for feature "${feature}".

Your task is to SET UP the feature for incremental development.

## STEP 1: Read the PRD
Read the PRD file at: ${context?.prdPath || `.claude/plans/features/${feature}/prd.md`}

## STEP 2: Generate feature_list.json
Create a file at .claude/plans/features/${feature}/feature_list.json with this exact structure:

{
  "feature": "${feature}",
  "version": "1.0.0",
  "created": "[ISO-8601-TIMESTAMP]",
  "tests": [
    {
      "id": "test-001",
      "description": "Description from PRD requirement",
      "category": "functional|ui|integration|e2e",
      "steps": ["Step 1", "Step 2"],
      "passes": false,
      "lastTested": null,
      "evidence": null
    }
  ],
  "summary": {
    "total": [N],
    "passing": 0,
    "failing": 0,
    "pending": [N]
  }
}

Extract ALL testable requirements from the PRD. Each requirement becomes a test.

## STEP 3: Generate init.sh
Create an executable script at .claude/plans/features/${feature}/init.sh
The script should set up the development environment for this project.

## STEP 4: Create claude-progress.txt
Create .claude/plans/features/${feature}/claude-progress.txt with:

CURRENT: Initializing feature "${feature}"

DONE:
- Created feature_list.json with [N] tests
- Created init.sh for project setup

IN PROGRESS:
(none)

NEXT:
- Begin implementing first test case

## STEP 5: Git Commit
Commit all generated files:
git add .claude/plans/features/${feature}/
git commit -m "feat(${feature}): initialize feature artifacts"

## IMPORTANT
- Generate ONLY these files
- Do NOT start implementing features
- Your job is SETUP only
`

  return {
    prompt,
    agentType: 'initializer',
    tokenEstimate: estimateTokens(prompt)
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

**Acceptance Criteria**:
- [ ] All tests from 5.2 pass
- [ ] Prompt includes all required instructions
- [ ] Token estimate is accurate
- [ ] Prompt < 2000 tokens

**Dependencies**: Task 1.3 (types)
**Story Points**: 2

---

#### Task 5.4: Create coding-agent test file (TDD)
**File**: `tests/utils/prompts/coding-agent.test.ts`

**Test cases to write**:
```typescript
describe('buildCodingAgentPrompt', () => {
  it('should include instruction to run pwd')
  it('should include instruction to read claude-progress.txt')
  it('should include instruction to read feature_list.json')
  it('should include instruction to run git log')
  it('should include instruction to run init.sh')
  it('should include instruction to work on ONE feature')
  it('should include instruction to test e2e before marking passes')
  it('should include instruction to commit after each feature')
  it('should include instruction to update progress before ending')
  it('should be under 2000 tokens')
  it('should include feature name in prompt')
  it('should include previous progress when provided')
})
```

**Acceptance Criteria**:
- [ ] All test cases defined
- [ ] Tests initially fail (TDD red phase)

**Story Points**: 1

---

#### Task 5.5: Implement coding-agent.ts
**File**: `src/utils/prompts/coding-agent.ts`

**Implementation**:
```typescript
import type { PromptBuilderResult, PromptContext } from '../../types/prompts-v3.js'

export function buildCodingAgentPrompt(
  feature: string,
  context?: PromptContext
): PromptBuilderResult {
  const prompt = `You are the CODING AGENT for feature "${feature}".

Your task is to make INCREMENTAL progress on ONE test case.

## STEP 1: Confirm Environment
Run: pwd
Verify you are in the correct project directory.

## STEP 2: Read Progress
Read: .claude/plans/features/${feature}/claude-progress.txt
Understand what was done in previous sessions.

## STEP 3: Read Test List
Read: .claude/plans/features/${feature}/feature_list.json
Find the FIRST test where "passes": false

## STEP 4: Check Git History
Run: git log --oneline -20
Understand recent changes.

## STEP 5: Setup Environment
Run: ./.claude/plans/features/${feature}/init.sh
Ensure development environment is ready.

## STEP 6: Implement ONE Test
Work on ONLY the first failing test from feature_list.json.
- Write the implementation
- Write unit tests if appropriate
- Test end-to-end

## STEP 7: Verify
Run the test case end-to-end.
ONLY if it passes, update feature_list.json:
- Set "passes": true
- Set "lastTested": "[ISO-8601-TIMESTAMP]"
- Set "evidence": "Description of how it was tested"
- Update "summary" counts

## STEP 8: Commit
git add -A
git commit -m "feat(${feature}): implement [test-id] - [description]"

## STEP 9: Update Progress
Before ending, update claude-progress.txt:

CURRENT: Working on "${feature}"

DONE:
[List completed tests]

IN PROGRESS:
[Current test]

NEXT:
[Next pending test]

## IMPORTANT
- Work on ONLY ONE test per session
- Do NOT skip the verification step
- Do NOT declare victory prematurely
- Always commit after completing a test
`

  return {
    prompt,
    agentType: 'coding',
    tokenEstimate: estimateTokens(prompt)
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

**Acceptance Criteria**:
- [ ] All tests from 5.4 pass
- [ ] Prompt includes all required instructions
- [ ] Token estimate is accurate
- [ ] Prompt < 2000 tokens

**Dependencies**: Task 1.3 (types)
**Story Points**: 2

---

#### Task 5.6: Create prompts index barrel
**File**: `src/utils/prompts/index.ts`

```typescript
export { buildInitializerPrompt } from './initializer-agent.js'
export { buildCodingAgentPrompt } from './coding-agent.js'
```

**Story Points**: 0.5

---

### Phase 5 Verification Checkpoint

```bash
npm test -- tests/utils/prompts/
npm run test:coverage -- --collectCoverageFrom='src/utils/prompts/**/*.ts'
```

**Expected**:
- All tests pass
- Coverage >= 80% for prompts directory
- Each prompt < 2000 tokens

---

## Phase 6: Integration & CLI

### Objective
Integrate all components and add CLI commands for the dual-agent workflow.

### Tasks

#### Task 6.1: Update session-v3.ts types
**File**: `src/types/session-v3.ts`

**Changes**:
```typescript
export interface SessionInfoV3 {
  // ... existing fields ...
  metadata?: {
    model?: string
    exitCode?: number
    duration?: number
    agentType?: 'initializer' | 'coding'  // NEW FIELD
  }
}
```

**Test**: Update `tests/types/session-v3.test.ts`
- [ ] agentType field is optional
- [ ] Backwards compatible with existing sessions

**Acceptance Criteria**:
- [ ] Existing tests still pass
- [ ] New field documented with JSDoc
- [ ] Type exported correctly

**Story Points**: 1

---

#### Task 6.2: Add tests command to feature-v3.ts
**File**: `src/commands/feature-v3.ts`

**Implementation**:
```typescript
async tests(name: string): Promise<void> {
  const data = await featureList.get(name)

  if (!data) {
    logger.error(`No feature list found for "${name}"`)
    process.exit(1)
  }

  console.log(chalk.bold(`\nTests for ${name}:\n`))

  for (const test of data.tests) {
    const icon = test.passes
      ? chalk.green('✓')
      : chalk.yellow('○')
    const status = test.passes
      ? chalk.green('PASSING')
      : chalk.yellow('PENDING')

    console.log(`${icon} ${test.id}: ${test.description} [${status}]`)
  }

  console.log(`\nSummary: ${data.summary.passing}/${data.summary.total} passing\n`)
}
```

**Test**: `tests/commands/feature-v3.test.ts` (extend)
- [ ] tests command shows all tests
- [ ] tests command handles missing feature list
- [ ] tests command shows correct status colors

**Acceptance Criteria**:
- [ ] Command displays tests correctly
- [ ] Colors work (green=passing, yellow=pending)
- [ ] Summary shows correct counts

**Story Points**: 1.5

---

#### Task 6.3: Add work command to feature-v3.ts
**File**: `src/commands/feature-v3.ts`

**Implementation**:
```typescript
async work(name: string): Promise<void> {
  const agentType = await sessionDetector.getAgentType(name)

  let prompt: string

  if (agentType === 'initializer') {
    logger.info('First session detected - using Initializer Agent')
    const result = buildInitializerPrompt(name)
    prompt = result.prompt
  } else {
    logger.info('Subsequent session detected - using Coding Agent')
    const result = buildCodingAgentPrompt(name)
    prompt = result.prompt
  }

  const result = await executeClaudeCommandV3(prompt, {
    printSessionId: true
  })

  if (result.sessionId) {
    await sessionStore.save(name, {
      id: generateSessionId(),
      claudeSessionId: result.sessionId,
      feature: name,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'active',
      resumable: true,
      metadata: {
        agentType
      }
    })
  }
}
```

**Test**: `tests/commands/feature-v3.test.ts` (extend)
- [ ] work command uses initializer for first session
- [ ] work command uses coding agent for subsequent sessions
- [ ] work command saves session with agentType

**Acceptance Criteria**:
- [ ] Correct agent selected based on state
- [ ] Session persisted with agentType
- [ ] Prompt passed to Claude correctly

**Dependencies**: Tasks 4.2, 5.3, 5.5
**Story Points**: 2

---

#### Task 6.4: Register new commands in cli-v3.ts
**File**: `src/cli-v3.ts`

**Changes**:
```typescript
program
  .command('tests <name>')
  .description('List tests for a feature')
  .action(async (name) => {
    await featureV3.tests(name)
  })

program
  .command('work <name>')
  .description('Start or continue working on a feature')
  .action(async (name) => {
    await featureV3.work(name)
  })
```

**Test**: `tests/cli-v3.test.ts` (extend)
- [ ] tests command is registered
- [ ] work command is registered
- [ ] Help shows new commands

**Acceptance Criteria**:
- [ ] `npm run adk3 -- feature tests my-feature` works
- [ ] `npm run adk3 -- feature work my-feature` works
- [ ] Help text is correct

**Story Points**: 0.5

---

### Phase 6 Verification Checkpoint

```bash
npm test
npm run type-check
npm run check
git diff src/cli.ts src/commands/feature.ts  # Should be empty
```

**Expected**:
- All tests pass
- No TypeScript errors
- No lint errors
- No changes to v2 files

---

## Testing Strategy

### Unit Tests
- **Location**: `tests/utils/`, `tests/types/`, `tests/commands/`
- **Pattern**: Follow existing test patterns (temp directory, beforeEach/afterEach cleanup)
- **Coverage Target**: >= 80% for all new files

### Integration Tests
- **Location**: `tests/integration/dual-agent.test.ts` (optional)
- **Focus**: Full workflow from session detection to prompt generation

### Manual Verification
After all phases complete:
1. Create test feature: `mkdir -p .claude/plans/features/test-dual-agent`
2. Create minimal PRD
3. Run `npm run adk3 -- feature work test-dual-agent`
4. Verify Initializer Agent prompt is used
5. Manually create `feature_list.json` and `init.sh`
6. Run `npm run adk3 -- feature work test-dual-agent` again
7. Verify Coding Agent prompt is used

---

## Files Summary

### Files to Create

| File | Phase | Type |
|------|-------|------|
| `src/types/feature-list-v3.ts` | 1 | Types |
| `src/types/init-script-v3.ts` | 1 | Types |
| `src/types/prompts-v3.ts` | 1 | Types |
| `tests/types/feature-list-v3.test.ts` | 1 | Test |
| `tests/types/init-script-v3.test.ts` | 1 | Test |
| `tests/types/prompts-v3.test.ts` | 1 | Test |
| `src/utils/feature-list.ts` | 2 | Utility |
| `tests/utils/feature-list.test.ts` | 2 | Test |
| `src/utils/init-script.ts` | 3 | Utility |
| `tests/utils/init-script.test.ts` | 3 | Test |
| `src/utils/session-detector.ts` | 4 | Utility |
| `tests/utils/session-detector.test.ts` | 4 | Test |
| `src/utils/prompts/index.ts` | 5 | Barrel |
| `src/utils/prompts/initializer-agent.ts` | 5 | Utility |
| `src/utils/prompts/coding-agent.ts` | 5 | Utility |
| `tests/utils/prompts/initializer-agent.test.ts` | 5 | Test |
| `tests/utils/prompts/coding-agent.test.ts` | 5 | Test |

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `src/types/session-v3.ts` | 6 | Add agentType to metadata |
| `src/commands/feature-v3.ts` | 6 | Add tests and work methods |
| `src/cli-v3.ts` | 6 | Register tests and work commands |
| `tests/types/session-v3.test.ts` | 6 | Add agentType tests |
| `tests/commands/feature-v3.test.ts` | 6 | Add tests/work command tests |
| `tests/cli-v3.test.ts` | 6 | Add new command tests |

### Files NOT to Modify

| File | Reason |
|------|--------|
| `src/cli.ts` | v2 entry point |
| `src/commands/feature.ts` | v2 feature commands |
| Any other v2 file | Isolation requirement |

---

## Dependency Graph

```
Phase 1 (Types)
├── Task 1.1: feature-list-v3.ts
├── Task 1.2: init-script-v3.ts
└── Task 1.3: prompts-v3.ts
         │
         ▼
Phase 2 (FeatureList)        Phase 3 (InitScript)
├── Task 2.1: Tests (TDD)    ├── Task 3.1: Tests (TDD)
├── Task 2.2: Implementation ├── Task 3.2: Implementation
├── Task 2.3: Edge cases     ├── Task 3.3: Priority tests
└── Task 2.4: Format verify  └── Task 3.4: Format verify
         │                            │
         └─────────────┬──────────────┘
                       ▼
              Phase 4 (Session Detection)
              ├── Task 4.1: Tests (TDD)
              └── Task 4.2: Implementation
                       │
                       ▼
              Phase 5 (Prompts)
              ├── Task 5.1: Directory structure
              ├── Task 5.2: Initializer tests (TDD)
              ├── Task 5.3: Initializer implementation
              ├── Task 5.4: Coding tests (TDD)
              ├── Task 5.5: Coding implementation
              └── Task 5.6: Index barrel
                       │
                       ▼
              Phase 6 (Integration)
              ├── Task 6.1: Update session types
              ├── Task 6.2: Add tests command
              ├── Task 6.3: Add work command
              └── Task 6.4: Register CLI commands
```

---

## Acceptance Criteria Summary

### P0 (Must Have)

| Criterion | Verification |
|-----------|--------------|
| `isFirstSession()` works correctly | Unit tests pass |
| `buildInitializerPrompt()` generates valid prompt | Unit tests pass |
| `buildCodingAgentPrompt()` generates valid prompt | Unit tests pass |
| `FeatureList.create()` generates valid JSON | Unit tests pass |
| `FeatureList.updateTestStatus()` works | Unit tests pass |
| `InitScript.create()` generates executable bash | Unit tests pass |
| `InitScript.detect()` identifies project types | Unit tests pass |
| Test coverage >= 80% | `npm run test:coverage` |
| `npm test` passes | All tests green |
| No changes to v2 files | `git diff src/cli.ts src/commands/feature.ts` empty |

### P1 (Should Have)

| Criterion | Verification |
|-----------|--------------|
| Prompts < 2000 tokens each | Token counting test |
| Multiple project types supported | Integration tests |
| JSON schema validation | Schema tests |
| Debug logging | Manual verification |

---

## Risk Mitigation Checkpoints

After each phase, verify:

1. **Phase 1**: `npm run type-check` passes
2. **Phase 2**: `npm test -- tests/utils/feature-list.test.ts` passes
3. **Phase 3**: `npm test -- tests/utils/init-script.test.ts` passes
4. **Phase 4**: `npm test -- tests/utils/session-detector.test.ts` passes
5. **Phase 5**: `npm test -- tests/utils/prompts/` passes
6. **Phase 6**: Full `npm test` passes + `git diff` shows no v2 changes

---

*Implementation Plan completed - ADK v3 Sprint 2*
