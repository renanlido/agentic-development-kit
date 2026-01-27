# Research: adk-v3-session-continuity-4

## Current State Analysis

### Implemented (Sprint 0-1)

The ADK v3 session continuity system has **Sprint 0 and Sprint 1 completed**, establishing the foundation:

| Component | Status | Description |
|-----------|--------|-------------|
| `src/cli-v3.ts` | ✅ Implemented | Entry point with `adk3` command, Commander.js setup |
| `src/commands/feature-v3.ts` | ✅ Partial | `status` command showing session info, history |
| `src/utils/session-store.ts` | ✅ Implemented | CRUD for sessions, atomic writes, 24h resumability |
| `src/utils/claude-v3.ts` | ✅ Implemented | Async spawn, session ID extraction, auto-resume |
| `src/types/session-v3.ts` | ✅ Implemented | Type definitions for SessionInfoV3, ClaudeV3Options |

### Not Implemented (Sprints 2-4)

| Component | Status | Blocks |
|-----------|--------|--------|
| Session Detection | 🔴 Missing | Determine first vs subsequent session |
| Initializer Agent Prompt | 🔴 Missing | First session setup |
| Coding Agent Prompt | 🔴 Missing | Subsequent session work |
| Feature List Generator | 🔴 Missing | `feature_list.json` creation |
| Init Script Generator | 🔴 Missing | `init.sh` creation |
| Git Context Utility | 🔴 Missing | Log, status, auto-commit |
| `work` Command | 🔴 Missing | Main entry point for sessions |

### V2 vs V3 Comparison

| Aspect | V2 | V3 Target |
|--------|-----|-----------|
| Claude Execution | `spawnSync` (blocking) | `spawn` (async) ✅ |
| Session ID Capture | Not captured | Extracted via pattern ✅ |
| Resume Support | Code exists, unused | Auto-resume < 24h ✅ |
| Context Continuity | ~0% (new session each phase) | >95% (resume-based) |
| Prompt Differentiation | Same prompt always | Initializer vs Coding 🔴 |
| Progress Tracking | `progress.md` (phases) | `feature_list.json` (tests) 🔴 |

## Similar Components

### 1. Claude Execution Pattern

**V2 Implementation** (`src/utils/claude.ts:25-73`):
```typescript
export async function executeClaudeCommand(prompt, options): Promise<string> {
  const tempFile = path.join(os.tmpdir(), `adk-prompt-${Date.now()}.txt`)
  fs.writeFileSync(tempFile, prompt)
  const result = spawnSync('claude', args, { input, encoding: 'utf-8' })
  return ''  // Always returns empty
}
```

**V3 Implementation** (`src/utils/claude-v3.ts:35-122`):
```typescript
export async function executeClaudeCommandV3(prompt, options): Promise<ClaudeV3Result> {
  return new Promise((resolve) => {
    const claude = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    claude.stdout.on('data', (data) => { stdout += chunk })
    claude.on('close', (code) => {
      const sessionId = parseSessionId(stdout) || parseSessionId(stderr)
      resolve({ output: stdout, sessionId, exitCode: code, duration })
    })
  })
}
```

### 2. Feature Command Structure

**V2 Feature Command** (`src/commands/feature.ts`):
- Large file (41k+ tokens)
- Handles: new, research, plan, implement, status, sync, compact
- Uses `StateManager` for feature state
- Creates prompts inline with template literals

**V3 Feature Command** (`src/commands/feature-v3.ts`):
- Small, focused (94 lines)
- Only `status` command implemented
- Uses `sessionStore` for session info
- Clean separation of concerns

### 3. Template/Prompt Pattern

**Existing Agent Prompts** (`templates/claude-structure/agents/`):
- Use YAML frontmatter for metadata
- Markdown body with structured sections
- Pre-requisites checklist
- Workflow steps
- Verification loops
- Self-review questions

**Example Pattern** (`implementer.md`):
```markdown
---
name: implementer
description: ...
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: opus
---
# Agent Name
[Role description]
## Pre-requisites
## Workflow
## Verification Loop
## Self-Review
## Output Final
```

### 4. Session/State Management

**StateManager** (`src/utils/state-manager.ts`):
- `createSession()`: Generates session ID
- `updateSession()`: Updates progress, steps
- `endSession()`: Creates handoff document
- Uses atomic writes pattern

**SessionStore** (`src/utils/session-store.ts`):
- `save()`: Atomic write (temp + move)
- `isResumable()`: 24h window check
- `list()`: History ordered by date
- Path traversal protection

### 5. Checkpoint System

**Create Checkpoint Hook** (`.claude/hooks/create-checkpoint.sh`):
- Counts task progress from `tasks.md`
- Lists modified files via `git diff`
- Creates `.task-checkpoint.md`
- Provides context cleanup instructions

## Technical Stack

### Runtime
- **Node.js**: >= 18.0.0
- **TypeScript**: ^5.3.3
- **Build**: `tsc` to `dist/`

### CLI Framework
- **Commander.js**: ^14.0.2 (CLI parsing)
- **Inquirer**: ^13.2.0 (interactive prompts)
- **Ora**: ^9.0.0 (spinners)
- **Chalk**: ^5.6.2 (terminal colors)

### File System
- **fs-extra**: ^11.3.3 (enhanced fs)
- Atomic write pattern: temp file → move

### Git Integration
- **simple-git**: ^3.30.0 (already installed)
- Type declarations in `src/types/externals.d.ts`
- Not currently used in v3 code

### Testing
- **Jest**: ^30.2.0
- **ts-jest**: ^29.1.1
- Target coverage: >= 80%

### Code Quality
- **Biome**: ^2.3.11 (lint + format)
- Single quotes, 2 spaces, 100 char width

## Files to Create

### Sprint 2: Dual-Agent Prompts
- [ ] `src/utils/prompts/initializer-agent.ts`
  - Generate prompt for first session
  - Include PRD analysis instructions
  - Output: feature_list.json, init.sh
- [ ] `src/utils/prompts/coding-agent.ts`
  - Generate prompt for subsequent sessions
  - Include startup checklist
  - Focus on single feature completion
- [ ] `src/utils/session-detection.ts`
  - Detect first vs subsequent session
  - Check for feature_list.json existence
  - Check for claude-progress.txt

### Sprint 3: Feature List & Init Script
- [ ] `src/utils/feature-list.ts`
  - Parse PRD to extract testable requirements
  - Generate feature_list.json structure
  - Validate and update feature status
- [ ] `src/utils/init-script.ts`
  - Generate init.sh for environment setup
  - Include npm install, env setup, etc.

### Sprint 4: Git & Work Command
- [ ] `src/utils/git-context.ts`
  - `getRecentCommits(n)`: git log --oneline
  - `getModifiedFiles()`: git status --porcelain
  - `autoCommit(message)`: git add + commit

### Tests
- [ ] `tests/utils/prompts/initializer-agent.test.ts`
- [ ] `tests/utils/prompts/coding-agent.test.ts`
- [ ] `tests/utils/session-detection.test.ts`
- [ ] `tests/utils/feature-list.test.ts`
- [ ] `tests/utils/init-script.test.ts`
- [ ] `tests/utils/git-context.test.ts`
- [ ] `tests/commands/feature-v3-work.test.ts`

## Files to Modify

### `src/cli-v3.ts`
- Add `feature work <name>` command
- Add `feature init <name>` command (optional)
- Keep minimal, delegate to feature-v3

### `src/commands/feature-v3.ts`
- Add `work(name)` method
  - Session detection logic
  - Route to initializer or coding agent
  - Loop until 100% passes
- Add `init(name)` method (optional)
  - Manual trigger for initializer agent

### `src/types/session-v3.ts`
- Add `FeatureListTest` interface
- Add `FeatureList` interface
- Add `InitScript` type

## Dependencies

### External (NPM)
| Package | Version | Status | Use |
|---------|---------|--------|-----|
| simple-git | ^3.30.0 | ✅ Installed | Git operations |
| fs-extra | ^11.3.3 | ✅ Installed | File operations |
| commander | ^14.0.2 | ✅ Installed | CLI parsing |
| ora | ^9.0.0 | ✅ Installed | Spinners |
| chalk | ^5.6.2 | ✅ Installed | Colors |

### Internal (Modules)
| Module | Status | Used By |
|--------|--------|---------|
| `session-store.ts` | ✅ Exists | work command |
| `claude-v3.ts` | ✅ Exists | work command |
| `logger.ts` | ✅ Exists | All modules |
| `templates.ts` | ✅ Exists | Prompt loading (optional) |

## Risks

### Risk 1: `--print-session-id` Compatibility
- **Description**: Claude CLI may not support flag in all versions
- **Impact**: High - breaks session tracking
- **Mitigation**:
  - Implement fallback pattern extraction from stderr
  - Document minimum Claude CLI version requirement
  - Add version check on startup

### Risk 2: Session Expiration During Long Work
- **Description**: 24h window may expire during complex features
- **Impact**: Medium - loses context, needs restart
- **Mitigation**:
  - Show warning when approaching 24h
  - Implement checkpoint before expiration
  - Consider extending window to 48h

### Risk 3: Premature Completion Declaration
- **Description**: Claude marks passes:true without real testing
- **Impact**: High - defeats purpose of system
- **Mitigation**:
  - Explicit prompt instructions: "only after real test"
  - Require test command output in verification
  - Add mandatory checklist before marking complete

### Risk 4: feature_list.json Schema Drift
- **Description**: Generated JSON may not match expected schema
- **Impact**: Medium - parsing errors, broken workflow
- **Mitigation**:
  - Use Zod for schema validation
  - Provide example in prompt
  - Implement schema migration for versions

### Risk 5: Init Script Security
- **Description**: Generated init.sh could contain harmful commands
- **Impact**: High - security vulnerability
- **Mitigation**:
  - Template-based generation (not free-form)
  - Whitelist allowed commands
  - Manual review before execution

### Risk 6: Git Auto-commit Conflicts
- **Description**: Auto-commit during active development may conflict
- **Impact**: Medium - merge conflicts, lost work
- **Mitigation**:
  - Check for uncommitted changes before auto-commit
  - Use feature branch isolation
  - Prompt for confirmation on sensitive operations

## Patterns to Follow

### 1. Atomic File Operations
From `session-store.ts`:
```typescript
const tempPath = path.join(os.tmpdir(), `session-${Date.now()}-${randomId}.json`)
await fs.writeJSON(tempPath, data, { spaces: 2 })
await fs.move(tempPath, targetPath, { overwrite: true })
```

### 2. Path Validation
From `session-store.ts`:
```typescript
private validateFeatureName(feature: string): void {
  if (/[\/\\]|\.\./.test(feature)) {
    throw new Error(`Invalid feature name: ${feature}`)
  }
}
```

### 3. Error Handling with Spinner
From `feature-v3.ts`:
```typescript
const spinner = ora(`Loading...`).start()
try {
  // operation
  spinner.succeed(`Done`)
} catch (error) {
  spinner.fail('Error')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 4. Test Structure
From `session-store.test.ts`:
```typescript
describe('SessionStore', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })
})
```

### 5. Type Definitions
From `session-v3.ts`:
```typescript
export interface SessionInfoV3 {
  id: string
  claudeSessionId: string | null
  feature: string
  // ... JSDoc comments for each field
}
```

## Performance Considerations

### 1. Startup Time (Target: < 500ms)
- Lazy load heavy modules (simple-git, etc.)
- Minimize synchronous operations
- Cache feature path resolution

### 2. Session Detection (Target: < 100ms)
- Single file existence check for feature_list.json
- Avoid reading large files for detection
- Cache detection result during session

### 3. File Operations
- Use streaming for large files
- Atomic writes prevent corruption but add latency (~50ms)
- Batch history writes when possible

### 4. Git Operations
- Use simple-git for efficient operations
- Limit log depth (default: 20 commits)
- Avoid full repository scans

### 5. Memory Usage
- Stream stdout/stderr instead of buffering
- Clear large prompts after execution
- Limit history retention (10 sessions)

## Security Considerations

### 1. Path Traversal Protection
- Validate all feature names against `/../` and path separators
- Use path.join() for all path construction
- Never interpolate user input directly into paths

### 2. Credential Safety
- Never store API keys in session files
- Don't include credentials in prompts
- Clear temp files after use

### 3. Command Injection Prevention
- Don't pass user input to shell commands
- Use array args instead of string interpolation
- Validate git commit messages

### 4. Init Script Safety
- Template-based generation only
- No arbitrary command execution
- Review generated script before running

### 5. Session File Permissions
- Session files may contain sensitive context
- Consider 0600 permissions on session files
- Don't include session data in logs

## Implementation Order (Recommended)

```
Sprint 2 (Prompts & Detection)
├── 2.1 session-detection.ts + tests
├── 2.2 initializer-agent.ts + tests
└── 2.3 coding-agent.ts + tests

Sprint 3 (Feature List & Init)
├── 3.1 feature-list.ts + tests
├── 3.2 init-script.ts + tests
└── 3.3 Integration with initializer-agent

Sprint 4 (Git & Work Command)
├── 4.1 git-context.ts + tests
├── 4.2 work command in feature-v3.ts
├── 4.3 cli-v3.ts updates
└── 4.4 Integration tests
```

## Data Structures

### feature_list.json
```json
{
  "feature": "my-feature",
  "version": "1.0.0",
  "createdAt": "2026-01-26T10:00:00Z",
  "tests": [
    {
      "id": "test-001",
      "description": "User can login with valid credentials",
      "category": "functional",
      "priority": "high",
      "steps": [
        "Navigate to login page",
        "Enter valid credentials",
        "Click submit",
        "Verify redirect to dashboard"
      ],
      "passes": false,
      "lastTested": null,
      "notes": null
    }
  ],
  "summary": {
    "total": 10,
    "passing": 0,
    "failing": 0,
    "pending": 10
  }
}
```

### init.sh
```bash
#!/bin/bash
set -e

echo "Setting up development environment..."

if [ ! -d "node_modules" ]; then
  npm install
fi

if [ -f ".env.example" ] && [ ! -f ".env" ]; then
  cp .env.example .env
fi

npm run build 2>/dev/null || true

echo "Environment ready!"
```

---

*Research completed: 2026-01-26*
*Next phase: Planning (Sprint 2-4 task breakdown)*
