# Context Compaction & Token Management

## Overview

The Context Compaction system manages token usage in Claude Code sessions to prevent context overflow and maintain session continuity. It implements a hierarchical compaction strategy that automatically compresses, summarizes, or creates handoff documents based on context usage thresholds.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     StateManager                             │
│  (Orchestrates token management & compaction triggers)      │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────┐            ┌──────────────────────┐
│   TokenCounter       │            │  ContextCompactor    │
│  (Measures usage)    │            │  (Compression logic) │
└──────────────────────┘            └──────────────────────┘
           │                                   │
           │                                   ▼
           │                        ┌──────────────────────┐
           │                        │   MemoryPruner       │
           │                        │  (Archive old data)  │
           │                        └──────────────────────┘
           │
           ▼
┌──────────────────────┐
│   Claude API         │
│  (Token counting)    │
└──────────────────────┘
```

### 1. TokenCounter (`src/utils/token-counter.ts`)

Measures token usage for feature contexts with fallback strategies:

**Primary**: Claude Count Tokens API
- Most accurate for production
- Requires ANTHROPIC_API_KEY
- Caches results for 5 minutes

**Fallback**: tiktoken library
- Used in tests or when API unavailable
- Approximates token count
- No API calls required

```typescript
interface TokenCount {
  count: number
  model: string
  source: 'api' | 'fallback'
}

// Usage
const counter = new TokenCounter()
const result = await counter.count('feature-name', 'text content')
```

### 2. ContextCompactor (`src/utils/context-compactor.ts`)

Core compaction engine implementing the hierarchical compression strategy:

```typescript
interface ContextStatus {
  currentTokens: number
  maxTokens: number
  usagePercentage: number
  level: 'raw' | 'compact' | 'summarize' | 'handoff'
  recommendation: string
  canContinue: boolean
}
```

**Compaction Levels:**

| Level | Threshold | Action | Reversible |
|-------|-----------|--------|------------|
| raw | 0-70% | None | N/A |
| compact | 70-85% | Compress verbose sections | ✅ 24h |
| summarize | 85-95% | Create summary, archive details | ✅ 24h |
| handoff | 95%+ | Generate handoff document | ✅ 24h |

**Methods:**

```typescript
// Check current status
async getContextStatus(feature: string): Promise<ContextStatus>

// Perform compaction
async compact(
  feature: string,
  options?: CompactOptions
): Promise<CompactionResult>

// Create summary
async summarize(feature: string): Promise<SummarizeResult>

// Generate handoff document
async createHandoffDocument(feature: string): Promise<string>
```

### 3. MemoryPruner (`src/utils/memory-pruner.ts`)

Archives old content to reduce context size:

```typescript
// Archive feature files older than 30 days
async pruneFeature(
  feature: string,
  dryRun?: boolean
): Promise<PruneResult>

// Limit project-context.md to 500 lines
async pruneProjectContext(
  dryRun?: boolean
): Promise<LimitResult>
```

**Archive Structure:**
```
.claude/plans/features/<feature>/.compaction/
├── archived/
│   ├── 2024-01-15_progress.md
│   ├── 2024-01-15_memory.md
│   └── 2024-01-15_research.md
└── history/
    ├── compact_2024-01-20.json
    └── summarize_2024-01-22.json
```

### 4. StateManager Integration

StateManager orchestrates compaction through these methods:

```typescript
// Get current context status
async getContextStatus(feature: string): Promise<ContextStatus>

// Check before tool use (hook integration)
async beforeToolUse(feature: string): Promise<ContextWarning | null>

// Handle warnings automatically
async handleContextWarning(
  feature: string,
  status: ContextStatus
): Promise<void>

// Trigger manual compaction
async triggerCompaction(
  feature: string,
  level?: CompactionLevelType
): Promise<CompactionResult>
```

**Unified State Extension:**

```typescript
interface UnifiedFeatureState {
  // ... existing fields

  tokenUsage?: {
    currentTokens: number
    maxTokens: number
    usagePercentage: number
    level: string
    lastChecked: string
  }

  lastCompaction?: {
    timestamp: string
    level: string
    tokensBefore: number
    tokensAfter: number
    savedTokens: number
  }
}
```

## CLI Commands

### Feature Commands

**View Token Usage:**
```bash
adk feature status <name> --tokens
```

Output:
```
📊 Feature Status: my-feature
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔢 Token Usage:
  Current: 45,230 tokens (78.5%)
  Max: 57,600 tokens
  Level: COMPACT (Consider compaction)
  Last Checked: 2024-01-25 14:30:00

📦 Last Compaction:
  Timestamp: 2024-01-24 10:15:00
  Level: compact
  Saved: 8,450 tokens (18,670 → 10,220)
```

**Perform Compaction:**
```bash
# Auto-detect level and compact
adk feature compact <name>

# Dry-run preview
adk feature compact <name> --dry-run

# Force specific level
adk feature compact <name> --level summarize

# Revert recent compaction (within 24h)
adk feature compact <name> --revert <historyId>
```

### Context Commands

**Cross-Feature Status:**
```bash
adk context status

# Output:
📊 Context Status - Todas as Features

✅ feature-a: 12,450 tokens (21.6%) - RAW
⚠️  feature-b: 42,300 tokens (73.4%) - COMPACT
🔶 feature-c: 51,200 tokens (88.9%) - SUMMARIZE
🔴 feature-d: 55,100 tokens (95.7%) - HANDOFF
```

**Memory Pruning:**
```bash
# Archive old content
adk context prune <feature>

# Preview what would be archived
adk context prune <feature> --dry-run
```

## Compaction Process

### 1. Level Detection

```typescript
function detectLevel(percentage: number): CompactionLevelType {
  if (percentage >= 95) return 'handoff'
  if (percentage >= 85) return 'summarize'
  if (percentage >= 70) return 'compact'
  return 'raw'
}
```

### 2. Compact Level (70-85%)

**Goal**: Reduce verbosity while preserving all information

**Actions**:
- Compress repetitive sections
- Remove markdown decorations
- Condense whitespace
- Preserve all decisions and files

**Example**:
```markdown
Before (verbose):
## Progress Update - 2024-01-15

Today we made significant progress on the authentication system.
We implemented the following features:
- User login endpoint
- Password hashing with bcrypt
- JWT token generation

Tomorrow we plan to:
- Add refresh token logic
- Implement logout endpoint

After (compact):
## Progress 2024-01-15
Auth: login, password hashing, JWT generation
Next: refresh tokens, logout
```

### 3. Summarize Level (85-95%)

**Goal**: Create executive summary, archive full details

**Actions**:
- Generate high-level summary
- Extract key decisions
- List modified files
- Archive full content to `.compaction/archived/`
- Preserve critical context only

**Example Summary**:
```markdown
# Summary: my-feature (2024-01-25)

## Completed
- Authentication system (login, JWT, refresh tokens)
- User management API (CRUD operations)
- Database migrations (users table, sessions table)

## In Progress
- OAuth2 integration (60% complete)
- Email verification flow

## Key Decisions
1. Using JWT with 15min expiry + refresh tokens
2. Bcrypt for password hashing (cost factor 12)
3. PostgreSQL for session storage (not Redis)

## Files Modified (42 total)
Primary: src/auth/*.ts, src/api/users.ts, db/migrations/*
Tests: tests/auth/*.test.ts, tests/api/users.test.ts
```

### 4. Handoff Level (95%+)

**Goal**: Enable session transfer to new context

**Actions**:
- Generate comprehensive handoff document
- Include current task context
- List all pending work
- Highlight blockers/issues
- Archive full session state

**Handoff Document Structure**:
```markdown
# HANDOFF DOCUMENT: my-feature
Generated: 2024-01-25T15:30:00Z

## CURRENT TASK
Implementing OAuth2 Google provider integration (78% complete)
Working file: src/auth/oauth/google-provider.ts

## COMPLETED
✅ Project setup & architecture
✅ Core authentication (login, logout, refresh)
✅ User management API
✅ Database design & migrations
✅ Unit tests (85% coverage)

## IN PROGRESS
🔄 OAuth2 Google integration
   - Provider class implemented
   - Callback endpoint needs error handling
   - State parameter validation pending

## NEXT STEPS
1. Complete OAuth2 Google provider
2. Add OAuth2 GitHub provider
3. Email verification flow
4. Password reset workflow
5. Admin user management UI

## FILES MODIFIED (58)
Core: src/auth/**, src/api/users.ts, src/middleware/auth.ts
DB: db/migrations/**, db/seeds/**
Tests: tests/auth/**, tests/api/**
Config: .env.example, config/auth.ts

## BLOCKING ISSUES
None

## KEY DECISIONS & CONSTRAINTS
1. JWT expiry: 15min (security requirement)
2. Sessions in PostgreSQL (team decision, not Redis)
3. OAuth2 state stored in secure httpOnly cookies
4. Email provider: SendGrid (already configured)

## CONTEXT FOR NEXT SESSION
Last 3 days focused on OAuth2. Code is well-tested.
Main challenge: handling OAuth2 edge cases (expired state,
invalid tokens, network errors). Refer to
tests/auth/oauth/error-cases.test.ts for examples.
```

## Reversibility

All compactions are reversible within 24 hours:

```typescript
interface CompactionHistory {
  id: string // e.g., "compact_1706198400"
  timestamp: string
  level: CompactionLevelType
  tokensBefore: number
  tokensAfter: number
  savedTokens: number
  files: Array<{
    path: string
    sizeBefore: number
    sizeAfter: number
    backup: string // path to backup
  }>
  canRevert: boolean
  expiresAt: string // timestamp + 24h
}
```

**Revert Process**:
```bash
# List available history
adk feature status <name> --tokens

# Revert to specific point
adk feature compact <name> --revert compact_1706198400

# Automatic restoration:
# 1. Restore files from backups
# 2. Update state.json with original token counts
# 3. Remove compaction from history
# 4. Create checkpoint for safety
```

## Hooks Integration

### pre-overflow.sh

Monitors context usage and warns proactively:

```bash
#!/bin/bash
# Triggers when context > 90%

FEATURE=$(cat .claude/active-focus.md | grep "^feature:" | cut -d: -f2)
STATUS=$(adk feature status "$FEATURE" --tokens)
PERCENTAGE=$(echo "$STATUS" | grep -o '[0-9]\+\.[0-9]\+%' | sed 's/%//')

if (( $(echo "$PERCENTAGE > 90" | bc -l) )); then
  echo "⚠️  Context at ${PERCENTAGE}%. Creating safety checkpoint..."
  echo "ℹ️  Consider running: adk feature compact $FEATURE"
fi
```

**When it runs**: Before every tool use in Claude Code
**Purpose**: Early warning system to prevent context overflow

## Best Practices

### 1. Monitoring

**Check token usage regularly:**
```bash
# Daily standup
adk context status

# Before major work
adk feature status <name> --tokens
```

### 2. Proactive Compaction

**Don't wait for 95%:**
- Compact at 75%: Maintains headroom
- Summarize at 88%: Before critical threshold
- Create handoff at 93%: Before forced cutoff

### 3. Dry-Run First

**Always preview before applying:**
```bash
adk feature compact <name> --dry-run
adk context prune <name> --dry-run
```

### 4. Strategic Checkpoints

**Create checkpoints before major operations:**
```typescript
// StateManager automatically creates checkpoints before compaction
await stateManager.createCheckpoint(feature, 'pre-compaction')
```

### 5. Regular Pruning

**Archive old content monthly:**
```bash
# Check what would be archived
adk context prune <feature> --dry-run

# Apply if appropriate
adk context prune <feature>
```

## Troubleshooting

### High Token Usage Despite Compaction

**Symptom**: Context remains at 80%+ after compaction

**Solutions**:
1. Check for large binary files in feature directory
2. Review research.md for excessive external content
3. Consider summarize level instead of compact
4. Prune old archived files

### Compaction Reverted Unexpectedly

**Symptom**: Files restored to pre-compaction state

**Possible Causes**:
1. Another user/process ran revert command
2. Git checkout reverted files
3. Snapshot restoration from different process

**Prevention**:
- Use feature worktrees (isolation)
- Communicate with team before reverting
- Check `adk feature history` for state changes

### API Rate Limiting

**Symptom**: Token counting fails with 429 errors

**Solutions**:
1. TokenCounter automatically falls back to tiktoken
2. Increase cache TTL (currently 5 minutes)
3. Batch token counting operations
4. Use `--dry-run` to avoid API calls during exploration

### Compaction Too Aggressive

**Symptom**: Lost important context after compaction

**Solutions**:
1. Immediately revert: `adk feature compact <name> --revert <id>`
2. Adjust compaction level to lower threshold
3. Use `preservePatterns` in CompactOptions:
   ```typescript
   await compactor.compact(feature, {
     preservePatterns: ['IMPORTANT:', 'TODO:', 'DECISION:']
   })
   ```

## Performance Considerations

### Token Counting

- **API calls**: ~500ms per request
- **Cache hit**: <1ms
- **Fallback (tiktoken)**: ~50ms

**Optimization**: Token counts cached for 5 minutes

### Compaction

- **Compact level**: ~100-500ms
- **Summarize level**: ~1-3s (includes archiving)
- **Handoff level**: ~2-5s (includes full state capture)

**Optimization**: Run during idle periods or breaks

### Memory Usage

- TokenCounter: ~10MB (tiktoken model)
- ContextCompactor: ~5MB (compression buffers)
- Total overhead: <20MB

## API Reference

See source files for complete API documentation:
- `src/types/compaction.ts` - Type definitions
- `src/utils/token-counter.ts` - Token counting
- `src/utils/context-compactor.ts` - Compaction logic
- `src/utils/memory-pruner.ts` - Pruning operations
- `src/utils/state-manager.ts` - Integration layer
- `src/commands/feature.ts` - CLI implementation
- `src/commands/context.ts` - Context commands

## Future Enhancements

### Planned (v2.1)
- Automatic compaction based on thresholds
- Compression algorithms (gzip, brotli)
- Smart summarization using Claude API
- Multi-feature compaction strategies

### Under Consideration
- Real-time token tracking UI
- Compaction analytics dashboard
- Team-wide context budget management
- Integration with CI/CD pipelines
