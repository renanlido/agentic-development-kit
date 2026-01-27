# Research: adk-v3-session-continuity-2

**Date**: 2026-01-26
**Sprint**: 2 (Dual-Agent Prompts)
**Dependency**: Sprint 1 (adk-v3-session-continuity) ✅ Complete

---

## Current State Analysis

### Sprint 1 Deliverables (Already Implemented)

The Sprint 1 implementation provides the foundation for session continuity:

| Component | File | Status |
|-----------|------|--------|
| Session Types | `src/types/session-v3.ts` | ✅ Complete |
| Session Store | `src/utils/session-store.ts` | ✅ Complete |
| Claude V3 Executor | `src/utils/claude-v3.ts` | ✅ Complete |
| Feature V3 Command | `src/commands/feature-v3.ts` | ✅ Complete |
| CLI V3 Entry | `src/cli-v3.ts` | ✅ Complete |

**Key Capabilities from Sprint 1:**
- Session persistence to disk (`.claude/plans/features/<name>/sessions/`)
- Claude session ID capture via `--print-session-id`
- Session resume via `--resume` flag
- 24-hour resumability window
- Atomic writes using temp file + move pattern
- Session history tracking

### What Sprint 2 Adds

Sprint 2 implements the **dual-agent pattern** from Anthropic's [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents):

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUAL-AGENT ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   isFirstSession() ───────┬────────────────────────────         │
│                           │                                      │
│         YES               │              NO                      │
│         ▼                 │              ▼                       │
│   ┌─────────────────┐     │      ┌─────────────────┐            │
│   │ INITIALIZER     │     │      │ CODING AGENT    │            │
│   │ AGENT           │     │      │                 │            │
│   │                 │     │      │ - Read progress │            │
│   │ - Read PRD      │     │      │ - Read feature  │            │
│   │ - Generate      │     │      │   list          │            │
│   │   feature_list  │     │      │ - git log       │            │
│   │ - Generate      │     │      │ - Run init.sh   │            │
│   │   init.sh       │     │      │ - Work ONE      │            │
│   │ - Create        │     │      │   feature       │            │
│   │   progress.txt  │     │      │ - Test e2e      │            │
│   │ - Git commit    │     │      │ - Commit        │            │
│   └─────────────────┘     │      └─────────────────┘            │
│                           │                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Similar Components

### 1. Session Store Pattern (`src/utils/session-store.ts`)

**Relevance**: Same persistence pattern for `feature_list.json`

```typescript
export class SessionStore {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  async save(feature: string, session: SessionInfoV3): Promise<void> {
    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)
    await fs.writeJSON(tempPath, session, { spaces: 2 })
    await fs.move(tempPath, currentPath, { overwrite: true })
  }
}
```

**Pattern to Follow**: Atomic writes with TEST_FEATURE_PATH support

### 2. State Manager Pattern (`src/utils/state-manager.ts`)

**Relevance**: Same file path conventions, JSON parsing, unified state loading

```typescript
export class StateManager {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  async loadUnifiedState(feature: string): Promise<UnifiedFeatureState>
  async saveUnifiedState(feature: string, state: UnifiedFeatureState): Promise<void>
}
```

**Pattern to Follow**: Validation, default state creation, merge strategies

### 3. Handoff Document Pattern (`src/utils/state-manager.ts:501-542`)

**Relevance**: Similar to `claude-progress.txt` format

```typescript
async createHandoffDocument(feature: string): Promise<string> {
  const state = await this.loadUnifiedState(feature)
  const document = `CURRENT: ${current}

DONE:
${done || '(none)'}

IN PROGRESS:
${inProgress || '(none)'}

NEXT:
${next || '(none)'}`
  return document
}
```

**Pattern to Follow**: Structured text generation with sections

### 4. Task Parser Pattern (`src/utils/task-parser.ts`)

**Relevance**: Parsing structured text files

**Pattern to Follow**: Regex-based extraction, status mapping

---

## Technical Stack

### Existing Dependencies (No New External Dependencies Needed)

| Package | Version | Usage in Sprint 2 |
|---------|---------|------------------|
| `fs-extra` | ^11.3.3 | File operations, JSON read/write |
| `chalk` | ^5.6.2 | Colored output for tests command |
| `ora` | ^9.0.0 | Spinners for async operations |
| `commander` | ^14.0.2 | CLI commands |

### Internal Dependencies

| Module | Usage |
|--------|-------|
| `src/utils/session-store.ts` | Integration for agentType tracking |
| `src/utils/claude-v3.ts` | Prompt execution |
| `src/types/session-v3.ts` | Base session types |
| `src/utils/logger.ts` | Consistent logging |

---

## Files to Create

### Types

- [ ] `src/types/feature-list-v3.ts`
  - `TestDefinition` interface
  - `TestCategory` type
  - `FeatureListData` interface
  - `FeatureListSummary` interface

- [ ] `src/types/init-script-v3.ts`
  - `ProjectType` type
  - `InitScriptOptions` interface
  - `InitScriptResult` interface

- [ ] `src/types/prompts-v3.ts`
  - `PromptContext` interface
  - `AgentType` type
  - `PromptBuilderResult` interface

### Utilities

- [ ] `src/utils/prompts/initializer-agent.ts`
  - `buildInitializerPrompt(feature: string, context?: PromptContext): string`
  - Generates prompt for first session setup

- [ ] `src/utils/prompts/coding-agent.ts`
  - `buildCodingAgentPrompt(feature: string, context?: PromptContext): string`
  - Generates prompt for subsequent work sessions

- [ ] `src/utils/feature-list.ts`
  - `class FeatureList`
  - `create(feature, tests?): Promise<void>`
  - `addTest(feature, test): Promise<void>`
  - `updateTestStatus(feature, testId, passes, evidence?): Promise<void>`
  - `get(feature): Promise<FeatureListData | null>`
  - `getSummary(feature): Promise<FeatureListSummary>`

- [ ] `src/utils/init-script.ts`
  - `class InitScript`
  - `create(feature, options?): Promise<void>`
  - `detect(projectRoot): Promise<ProjectType>`
  - `get(feature): Promise<string | null>`

- [ ] `src/utils/session-detector.ts`
  - `isFirstSession(feature: string): Promise<boolean>`
  - `getAgentType(feature: string): Promise<AgentType>`

### Tests

- [ ] `tests/types/feature-list-v3.test.ts`
- [ ] `tests/types/init-script-v3.test.ts`
- [ ] `tests/types/prompts-v3.test.ts`
- [ ] `tests/utils/prompts/initializer-agent.test.ts`
- [ ] `tests/utils/prompts/coding-agent.test.ts`
- [ ] `tests/utils/feature-list.test.ts`
- [ ] `tests/utils/init-script.test.ts`
- [ ] `tests/utils/session-detector.test.ts`

---

## Files to Modify

### Must Modify

- [ ] `src/types/session-v3.ts`
  - Add `agentType?: 'initializer' | 'coding'` to `SessionInfoV3.metadata`
  - Preserve backward compatibility

- [ ] `src/commands/feature-v3.ts`
  - Add `tests(name: string)` method for displaying feature_list.json
  - Add `work(name: string)` method for dual-agent execution

- [ ] `src/cli-v3.ts`
  - Register `feature tests <name>` command
  - Register `feature work <name>` command

### Must NOT Modify (v2 Files)

- ❌ `src/cli.ts` (v2 entry point)
- ❌ `src/commands/feature.ts` (v2 feature commands)
- ❌ Any existing v2 utilities

---

## Dependencies

### External (Already Installed)

| Package | Purpose |
|---------|---------|
| `fs-extra` | JSON operations, directory creation |
| `chalk` | Colored test status output |
| `ora` | Progress spinners |
| `path` (Node.js) | Path manipulation |
| `os` (Node.js) | Temp directory for atomic writes |

### Internal (Sprint 1)

| Module | Purpose |
|--------|---------|
| `SessionStore` | Session persistence |
| `SessionInfoV3` | Session types |
| `executeClaudeCommandV3` | Claude execution |
| `logger` | Consistent logging |

### Context Dependencies

| Artifact | Required For |
|----------|--------------|
| PRD (`prd.md`) | Initializer prompt context |
| Feature directory | All operations |
| Sessions directory | Session tracking |

---

## Risks

### Risk 1: Prompts Too Long (Token Exhaustion)
**Impact**: High
**Probability**: Medium
**Description**: Initializer or coding prompts may include too much context, exhausting Claude's context window before work begins.
**Mitigation**:
- Target prompts < 2000 tokens each
- Only include essential instructions
- Use file reading instructions instead of embedding content
- Test with `tiktoken` for token counting

### Risk 2: Claude Ignores Structured Output Format
**Impact**: High
**Probability**: Low
**Description**: Claude may generate `feature_list.json` in invalid format.
**Mitigation**:
- Provide exact JSON schema in prompt
- Include complete examples
- Validate JSON before writing
- Provide recovery instructions in prompt

### Risk 3: Project Type Detection Fails
**Impact**: Medium
**Probability**: Medium
**Description**: `detect()` function may misidentify project type for hybrid projects.
**Mitigation**:
- Priority-based detection (check most specific first)
- Fallback to "unknown" type with generic template
- Allow manual override via options

### Risk 4: feature_list.json Desynchronization
**Impact**: Medium
**Probability**: High
**Description**: Claude may forget to update test status after completing features.
**Mitigation**:
- Include reminder in coding agent prompt
- Include "passes" count in prompt output
- Validate sync in session end checkpoint

### Risk 5: init.sh Not Idempotent
**Impact**: Medium
**Probability**: Medium
**Description**: Running init.sh multiple times may cause errors (port conflicts, duplicate processes).
**Mitigation**:
- Use `|| true` for non-critical commands
- Check if services already running
- Include cleanup section

---

## Patterns to Follow

### Pattern 1: Atomic Write with Test Support

```typescript
class FeatureList {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  async save(feature: string, data: FeatureListData): Promise<void> {
    const filePath = this.getFilePath(feature)
    const tempPath = path.join(os.tmpdir(), `feature-list-${Date.now()}.json`)

    await fs.writeJSON(tempPath, data, { spaces: 2 })
    await fs.move(tempPath, filePath, { overwrite: true })
  }
}
```

### Pattern 2: Feature Name Validation

```typescript
private validateFeatureName(name: string): void {
  if (/[\/\\]|\.\./.test(name)) {
    throw new Error(`Invalid feature name: ${name}`)
  }
}
```

### Pattern 3: Singleton Export

```typescript
export class FeatureList { /* ... */ }
export const featureList = new FeatureList()
```

### Pattern 4: Test Structure (Jest)

```typescript
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

describe('FeatureList', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    delete process.env.TEST_FEATURE_PATH
    await fs.remove(tempDir)
  })

  it('should create feature list with valid JSON', async () => {
    // ...
  })
})
```

---

## Performance Considerations

### Target Metrics (from PRD)

| Operation | Target |
|-----------|--------|
| Prompt generation | < 50ms |
| feature_list.json read/write | < 100ms |
| Project type detection | < 200ms |

### Optimization Strategies

1. **Prompt Generation**: Pre-compute static parts, template literals
2. **JSON Operations**: Use fs-extra's JSON methods (automatic parsing)
3. **Project Detection**: Check most likely types first, short-circuit on match
4. **Caching**: Cache project type detection result

### Memory Considerations

- Prompts should not exceed 5KB each
- feature_list.json typically < 50KB
- init.sh typically < 2KB

---

## Security Considerations

### Input Validation

| Input | Validation Required |
|-------|---------------------|
| Feature name | No path traversal (`../`, `/`, `\`) |
| Test IDs | Alphanumeric + hyphens only |
| init.sh content | No sensitive data (credentials, keys) |

### File System Safety

- Always use path.join() for path construction
- Validate feature exists before writing
- Use atomic writes to prevent corruption
- Never include user secrets in generated files

### init.sh Security

```bash
#!/bin/bash
set -e

npm install 2>/dev/null || true
npm run dev &

echo "Environment ready!"
```

**Security Checklist:**
- ✅ No hardcoded credentials
- ✅ No sensitive environment variables
- ✅ Commands fail safely (`|| true`)
- ✅ No external network calls without user action

---

## Implementation Order

### Day 1: Types and FeatureList

1. Create `src/types/feature-list-v3.ts`
2. Create `tests/types/feature-list-v3.test.ts`
3. Create `tests/utils/feature-list.test.ts` (TDD)
4. Implement `src/utils/feature-list.ts`

### Day 2: InitScript and Detection

1. Create `src/types/init-script-v3.ts`
2. Create `tests/utils/init-script.test.ts` (TDD)
3. Implement `src/utils/init-script.ts`
4. Create `tests/utils/session-detector.test.ts` (TDD)
5. Implement `src/utils/session-detector.ts`

### Day 3: Prompts and Integration

1. Create `src/types/prompts-v3.ts`
2. Create `tests/utils/prompts/initializer-agent.test.ts` (TDD)
3. Implement `src/utils/prompts/initializer-agent.ts`
4. Create `tests/utils/prompts/coding-agent.test.ts` (TDD)
5. Implement `src/utils/prompts/coding-agent.ts`
6. Update `src/types/session-v3.ts` with agentType
7. Update `src/commands/feature-v3.ts` with tests command
8. Update `src/cli-v3.ts` with new commands

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

*Research completed - ADK v3 Sprint 2*
