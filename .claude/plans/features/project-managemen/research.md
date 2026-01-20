# Research: project-managemen

## Current State Analysis

The ADK CLI toolkit manages features through a multi-phase workflow (PRD → Research → Tasks → Plan → Implement → QA → Docs) where implementation, QA, and docs phases run in isolated git worktrees. The current implementation has path resolution scattered across multiple command files, with each command manually handling worktree detection and path construction.

### Current Path Resolution Issues

1. **Duplicated logic** - Multiple commands implement their own `getMainRepoPath()` and path construction
2. **Inconsistent worktree handling** - Some commands properly detect worktrees, others assume main repo
3. **No centralized API** - Each command re-implements similar path logic
4. **Deleted `paths.ts`** - The old utility was replaced with `git-paths.ts` but migration is incomplete

### Git Status Shows

```
M src/cli.ts
M src/commands/agent.ts
M src/commands/feature.ts
M src/commands/memory.ts
M src/commands/update.ts
M src/utils/agent-status.ts
M src/utils/memory-utils.ts
D src/utils/paths.ts
M src/utils/progress.ts
?? src/utils/git-paths.ts
```

## Similar Components

### 1. git-paths.ts (New Centralized Module)

Located at `src/utils/git-paths.ts`, this new module provides:

```typescript
getMainRepoPath()       // Returns main repo even when in worktree
isInWorktree()          // Detects if running in a worktree
getCurrentWorktreePath() // Gets current worktree path if in one
getClaudePath(...segments)  // Constructs .claude/* paths
getFeaturesBasePath()   // Returns .claude/plans/features path
getFeaturePath(name, ...segments) // Constructs feature-specific paths
getAgentsPath()         // Returns .claude/agents path
```

### 2. progress.ts (Worktree-Aware Progress Tracking)

The `progress.ts` module now imports from `git-paths` and implements:

- `getWorktreeProgressPath()` - Resolves progress file in worktree context
- `syncProgressFiles()` - Bidirectional sync between main repo and worktree
- `loadProgress()` / `saveProgress()` - Automatically sync across environments

### 3. feature.ts (Main Command Handling)

The feature command delegates to `git-paths` utilities:

```typescript
import {
  getClaudePath as getClaudePathUtil,
  getFeaturePath as getFeaturePathUtil,
  getMainRepoPath as getMainRepoPathUtil,
} from '../utils/git-paths'
```

## Technical Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | >= 18.0.0 | Runtime |
| TypeScript | 5.3.3 | Language |
| Commander.js | 14.0.2 | CLI framework |
| fs-extra | 11.3.3 | File operations |
| simple-git | 3.30.0 | Git operations |
| chalk | 5.6.2 | Terminal colors |
| ora | 9.0.0 | Spinners |
| inquirer | 13.2.0 | Interactive prompts |
| Biome | 2.3.11 | Linting/formatting |
| Jest | 30.2.0 | Testing |

## Files to Create

- [ ] None - `git-paths.ts` already exists

## Files to Modify

- [ ] `src/commands/update.ts` - Replace hardcoded `process.cwd()` with `getMainRepoPath()`
- [ ] `src/cli.ts` - Ensure consistent path handling if needed
- [ ] Any remaining commands still using old path patterns

## Dependencies

### External
- `fs-extra` - Already in use for file operations
- `node:path` - Built-in path module
- `node:child_process` - For git commands (`execFileSync`)

### Internal
- `src/utils/git-paths.ts` - New centralized path utilities (CORE DEPENDENCY)
- `src/utils/progress.ts` - Feature progress tracking (UPDATED)
- `src/utils/memory-utils.ts` - Memory file handling (UPDATED)
- `src/utils/agent-status.ts` - Agent status tracking (UPDATED)

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing workflows | Medium | High | Ensure `getMainRepoPath()` returns correct path in all scenarios |
| Git command failures | Low | Medium | All git operations wrapped in try-catch with fallbacks |
| Path inconsistency across OS | Low | Medium | Use `node:path` for all path operations |
| Worktree detection false positives | Low | High | Test extensively with different worktree configurations |

## Patterns to Follow

### 1. Error Handling Pattern (from feature.ts:613-617)

```typescript
try {
  // work
  spinner.succeed('Success')
} catch (error) {
  spinner.fail('Erro ao criar feature')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 2. Path Resolution Pattern (from git-paths.ts)

```typescript
export function getMainRepoPath(): string {
  try {
    const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      encoding: 'utf-8',
    }).trim()

    if (gitCommonDir === '.git') {
      return process.cwd()
    }

    return path.dirname(gitCommonDir)
  } catch {
    return process.cwd()
  }
}
```

### 3. Worktree Detection Pattern (from git-paths.ts)

```typescript
export function isInWorktree(): boolean {
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      encoding: 'utf-8',
    }).trim()

    return gitDir.includes('.git/worktrees')
  } catch {
    return false
  }
}
```

### 4. Command Import Pattern (from feature.ts:8-12)

```typescript
import {
  getClaudePath as getClaudePathUtil,
  getFeaturePath as getFeaturePathUtil,
  getMainRepoPath as getMainRepoPathUtil,
} from '../utils/git-paths'
```

## Performance Considerations

1. **Git Command Caching** - `execFileSync` calls are synchronous and not cached. For high-frequency operations, consider memoizing `getMainRepoPath()`.

2. **Progress Sync Overhead** - `syncProgressFiles()` reads/writes files on every progress operation. This is acceptable for current usage patterns but could be optimized if needed.

3. **File Existence Checks** - Multiple `fs.pathExists()` calls in sequence. Could be batched with `Promise.all()` for parallel operations.

## Security Considerations

1. **Path Traversal** - `getFeaturePath()` uses path.join which normalizes paths, preventing traversal attacks. Feature names are sanitized with regex: `name.replace(/[^a-zA-Z0-9-]/g, '-')`

2. **Command Injection** - Git commands use `execFileSync` (not `execSync`), which is safe from shell injection as arguments are passed as array.

3. **User Input Validation** - Feature names and paths should be validated/sanitized before use in file operations.

## Implementation Recommendations

1. **Complete Migration** - Ensure all commands import from `git-paths.ts` instead of implementing local path logic

2. **Update update.ts** - The update command still uses `process.cwd()` directly:
   ```typescript
   const projectPath = process.cwd() // Should use getMainRepoPath()
   ```

3. **Add Tests** - Create unit tests for `git-paths.ts` functions covering:
   - Main repo context
   - Worktree context
   - Non-git directory fallback

4. **Documentation** - Update CLAUDE.md with new path utility patterns

## Anti-Patterns to Avoid

1. **Direct process.cwd()** - Never use `process.cwd()` for `.claude/` paths; always use `getMainRepoPath()` or higher-level utilities

2. **Hardcoded paths** - Avoid string concatenation for paths; use `path.join()` via the utility functions

3. **Unguarded git commands** - Always wrap git operations in try-catch with sensible fallbacks
