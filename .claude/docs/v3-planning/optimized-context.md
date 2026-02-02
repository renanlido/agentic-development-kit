# ADK v3 - Implementation Context (Optimized for AI)

> **CONTEXT**: This file consolidates all planning, decisions, and architectural requirements for the ADK v3 migration. Use this as the primary source of truth for implementation.

---

## 1. CORE MISSION

Migrate from fragmented CLI commands to **One Command Per Domain** with persistent sessions.

- **Current (v2)**: 7 commands for features. User decides what to run. Paralysis by analysis.
- **Target (v3)**: `adk feature <name>` does EVERYTHING. Zero fragmentation. Zero decisions.

### ADK Philosophy

> **"One command per domain, not one command per step."**

| Command | Mode | What it does |
|---------|------|--------------|
| `adk feature <name>` | Interactive | Manual validation between phases |
| `adk feature autopilot <name>` | Automatic | QA per task + smart escalation |
| `adk docs [target]` | Automatic | Analyze → Generate → Organize → Done |
| `adk workflow daily` | Automatic | Update → Identify → Prioritize → Done |

### Autopilot Flow (QA em 2 Camadas)

```text
Research → [Manual: Refine/Continue?] → Plan → [Manual: Refine/Continue?] → Implement
                                                                              │
                                                             AUTOMATIC LOOP ──┘
LAYER 1 - QA per Task:
Task 1 → Implement → QA Task → Pass? → Task 2 → ... → Task N
                         └── Fail? → Auto-correct (3x) → ASK HUMAN

LAYER 2 - Final QA:
All tasks done → QA Feature Complete → Pass? → DONE
                                   └── Fail? → Auto-correct (3x) → ASK HUMAN
```

---

## 2. CRITICAL CONSTRAINTS

**DO NOT TOUCH** (v2 frozen):

- `src/cli.ts`, `src/commands/feature.ts`, `src/utils/claude.ts`

**CREATE NEW** (v3):

- `src/cli-v3.ts`, `src/commands/feature-v3.ts`, `src/utils/claude-v3.ts`
- `src/utils/session-store.ts`, `src/utils/memory/*.ts`

---

## 3. ARCHITECTURE: DUAL AGENT SYSTEM

### 3.1 Initializer Agent (First Run)

- **Trigger**: No `feature_list.json` found
- **Actions**: Analyze PRD → Generate `feature_list.json` + `init.sh` → Initial commit
- **Outcome**: Ready-to-code environment

### 3.2 Coding Agent (Subsequent Runs)

- **Trigger**: `feature_list.json` exists
- **Loop**: Read State → Select Task → Implement (TDD) → Update JSON → Commit → Repeat

---

## 4. MEMORY ARCHITECTURE (4 TIERS)

### 4.1 Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: CORE STATE (~2-4K tokens) - ALWAYS IN CONTEXT         │
│  File: memory/core-state.json                                   │
│  Content: currentTask, decisions, constraints, modifiedFiles    │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: SESSION CONTEXT (~8-16K) - LOADED PER SESSION         │
│  Files: session-notes.md, decisions.md, breadcrumbs.md          │
│  Content: Timeline, learnings, references for re-fetch          │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3: FEATURE CONTEXT (~20-50K) - LOADED ON DEMAND          │
│  Files: prd.md, research.md, implementation-plan.md, tasks.md   │
│  Content: Full feature documentation                            │
├─────────────────────────────────────────────────────────────────┤
│  TIER 4: PROJECT CONTEXT (unlimited) - RARELY NEEDED           │
│  Files: CLAUDE.md, guidelines.md, architecture.md               │
│  Content: Global conventions                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Core State Schema (Tier 1)

```json
{
  "version": "1.0",
  "feature": "feature-name",
  "updatedAt": "ISO8601",
  "currentTask": {
    "id": "1.3",
    "name": "Task description",
    "status": "in_progress",
    "files": ["src/file.ts"],
    "lines": "100-150"
  },
  "taskProgress": {
    "total": 5,
    "completed": 2,
    "inProgress": 1,
    "pending": 2,
    "completedIds": ["1.1", "1.2"]
  },
  "criticalDecisions": [
    {
      "id": "dec-001",
      "decision": "Use X instead of Y",
      "rationale": "Performance reasons",
      "timestamp": "ISO8601"
    }
  ],
  "modifiedFiles": [
    {
      "path": "src/file.ts",
      "sections": [{"name": "methodName", "lines": "100-150"}],
      "lastModified": "ISO8601"
    }
  ],
  "constraints": [
    "NO stubs - implement real logic",
    "NO code outside task scope",
    "ALWAYS run type-check after changes"
  ],
  "breadcrumbs": [
    {"description": "Pattern location", "location": "file:line", "pattern": "regex"}
  ],
  "blockers": [],
  "nextSteps": ["Step 1", "Step 2"]
}
```

### 4.3 Session Notes Template (Tier 2)

```markdown
# Session Notes: {feature-name}
**Session ID:** sess-YYYY-MM-DD-NNN
**Started:** YYYY-MM-DD HH:MM

## Objective
[Clear session objective]

## Progress Timeline
| Time | Action | Result | Notes |
|------|--------|--------|-------|

## Key Learnings
1. [Learning 1]
2. [Learning 2]

## Files Read
- [x] file1.ts
- [x] file2.ts

## Commands Executed
```bash
npm run type-check  # PASS/FAIL
```

## Next Session Should

1. [Next step 1]

```

### 4.4 Loading Rules

| Tier | When to Load | When to Discard |
|------|--------------|-----------------|
| **1** | Always present | Never |
| **2** | Session start | Session end (archive) |
| **3** | Task change | Task complete |
| **4** | Explicit request | After immediate use |

---

## 5. ANTI-STUB PROTOCOLS

### 5.1 Read Before Write Protocol

```text
BEFORE writing ANY code:
1. READ the implementation plan
2. READ files to be modified
3. EXPLAIN what you found
4. PROPOSE changes
5. IMPLEMENT (only after approval)
```

### 5.2 Anti-Stub Rules (MANDATORY)

```text
YOU CANNOT:
- Create placeholder functions (throw new Error('Not implemented'))
- Leave TODO comments instead of real code
- Create empty catch blocks
- Return hardcoded values "to test later"
- Skip input validation
- Implement only the "happy path"

IF YOU CANNOT IMPLEMENT COMPLETELY:
1. STOP immediately
2. Explain what is blocking
3. List what you need to continue
4. WAIT for instructions
```

### 5.3 One File, One Step Protocol

```text
EACH iteration:
1. READ: One specific file
2. ANALYZE: Explain what you found
3. EXPLAIN: Propose ONE change
4. EDIT: Modify ONLY that file
5. VERIFY: Run lint/test
6. STOP: Wait for approval
```

### 5.4 TDD Verification Loop

```text
1. WRITE RED TEST (fails, for intended success state, NEVER edited again)
2. IMPLEMENT (real code, minimum to pass)
3. RUN TEST (GREEN → next, RED → back to 2)
4. REFACTOR (optional)
```

### 5.5 Completion Checklist

```text
### Code
- [ ] All functions have real implementation
- [ ] All branches handled
- [ ] Inputs validated
- [ ] Errors with useful messages

### Tests
- [ ] Tests for each public function
- [ ] Happy path tested
- [ ] Edge cases tested
- [ ] Errors tested

### Verification
- [ ] type-check passes
- [ ] lint passes
- [ ] tests pass
- [ ] build works
```

---

## 6. COMPACTION RULES

### 6.1 Two-Threshold Architecture

```text
Token Count
    │
    │  ┌─────────────────── T_max (80% = trigger compaction)
    │  │   ← Compression zone
    │  └─────────────────── T_target (50% = post-compaction)
    │     ← Normal operation zone
```

### 6.2 What to NEVER Compress

- Complete file paths
- Line numbers
- Function/variable names
- Exact commands that worked
- Specific error messages

### 6.3 What to ALWAYS Compress

- Redundant explanations
- Processed tool outputs
- Failed attempts (keep only lesson)
- Clarification conversations (keep only decision)

---

## 7. CONTEXT INJECTION HOOKS

### 7.1 inject-memory.sh (PreToolUse)

Injects into every tool call:

- `core-state.json` content
- Active constraints
- Anti-stub protocol reminder

### 7.2 auto-checkpoint.sh (Stop)

Creates checkpoint on session end:

- Timestamp, feature, core state
- Git status, last commit

### 7.3 validate-no-stub.sh (Write)

Blocks writes containing:

- `throw new Error.*Not implemented`
- `TODO:`, `FIXME:`
- `// stub`, `pass  # stub`
- `NotImplementedError`

---

## 8. CONTEXT READING GUARANTEE (5 LAYERS)

### Problem

AI agents read only 10-20% of available context, leading to incomplete implementations.

### Solution: 5 Layers

```text
LAYER 5: STRATEGIC REDUNDANCY
  Critical info appears in 5+ places (core-state, hooks, prompts, checklists)

LAYER 4: COMPREHENSION CHECKPOINT
  Agent MUST answer questions before implementing

LAYER 3: CRITICAL INFO FIRST (CIF)
  Constraints and state at BEGINNING of prompt (high attention zone)

LAYER 2: PROGRESSIVE LOADING
  Load only what's needed for current task (~20K max)

LAYER 1: FORCED INJECTION
  Hook injects core-state in EVERY tool call
```

### Comprehension Checkpoint

Before writing code, agent must answer:

```text
1. What is the current task ID and target files?
2. What files were already modified this session?
3. What were the last 2 decisions and why?
4. What are the 3 main constraints?

IF CANNOT ANSWER → STOP and read required files
```

### Strategic Redundancy

| Constraint | Where it appears |
|------------|------------------|
| NO STUBS | core-state.json, inject-memory.sh, validate-no-stub.sh, prompt, checklist |
| Task scope | core-state.json, session-notes.md, prompt |
| Modified files | core-state.json, git status, session-notes.md |

**Rule:** Critical constraint must appear in minimum 3 places.

---

## 9. METRICS & KPIs

### 9.1 Quality Metrics

| Metric | Target |
|--------|--------|
| Stub Rate | <5% |
| First-Pass QA Success | >70% |
| Context Drift | Minimal |
| Rework Rate | <15% |

### 9.2 Efficiency Metrics

| Metric | Target |
|--------|--------|
| Tokens per Task | Decreasing |
| Sessions per Feature | Decreasing |
| Compaction Efficiency | >50% |
| Recovery Success | >95% |

### 9.3 Memory Metrics

| Metric | Target |
|--------|--------|
| Core State Freshness | <5min |
| Decision Coverage | >90% |
| Breadcrumb Accuracy | >95% |

---

## 10. MULTI-AGENT PARALLEL EXECUTION

### 10.1 Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED MEMORY (Tier 0)                       │
│  shared-state.json: decisions, file ownership, completed tasks  │
└─────────────────────────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┬───────────────┐
    ▼               ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ Agent 1 │   │ Agent 2 │   │ Agent 3 │   │ Agent 4 │
│Worktree │   │Worktree │   │Worktree │   │Worktree │
│core-1   │   │core-2   │   │core-3   │   │core-4   │
└────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
     └─────────────┴──────┬──────┴─────────────┘
                          ▼
              ┌───────────────────────┐
              │ AGGREGATOR            │
              │ - Merge decisions     │
              │ - Resolve conflicts   │
              │ - Consolidate metrics │
              └───────────────────────┘
```

### 10.2 Shared State Schema

```json
{
  "agents": {"active": ["agent-1", "agent-2"], "completed": [], "failed": []},
  "fileOwnership": {"src/file.ts": {"agent": "agent-1", "since": "ISO8601"}},
  "sharedDecisions": [{"decision": "...", "madeBy": "agent-1", "affectsAgents": ["agent-2"]}],
  "completedTasks": ["1.1", "1.2"],
  "inProgressTasks": {"2.1": "agent-1", "2.2": "agent-2"},
  "globalConstraints": ["NO stubs", "Use existing patterns"]
}
```

### 10.3 Isolation Strategy

| Strategy | When to Use |
|----------|-------------|
| **Git Worktrees** (default) | Most cases - medium isolation, easy merge |
| **DevContainers** | Different dependencies per agent |
| **Branches** | Very simple tasks |

### 10.4 Communication: Blackboard + Summarizer

```text
Wave executes → Each agent updates shared-state.json
                            │
                            ▼
              Aggregator merges decisions
                            │
                            ▼
            Next wave reads updated shared-state
```

### 10.5 Conflict Prevention

- **Pre-execution**: Detect same-file conflicts, force sequential
- **During**: File locking via fileOwnership
- **Post**: Two-step merge (structure-first + auto-dedupe)

### 10.6 Limits (Research-Based)

| Limit | Value | Source |
|-------|-------|--------|
| Max concurrent agents | 3-4 | Addy Osmani, Tessl.io |
| Max tasks per wave | 4 | Pragmatic Engineer |
| Recommended start | 2 agents | Scale gradually |

---

## 11. CODEBASE INDEXING (Fast Context)

### 11.1 Problem

Without indexing, agent must read many files to understand context, using slow glob/grep instead of semantic search.

**Competitors with this feature:** Windsurf (SWE-grep, Fast Context 10x faster), Cursor (embeddings)

### 11.2 Solution: Semantic Index

```text
SOURCE FILES → INDEXER → INDEX STORAGE → QUERY ENGINE
                 │
   ├── Parse AST (functions, classes, imports)
   ├── Extract symbols and docstrings
   ├── Generate embeddings
   ├── Build dependency graph
   └── Calculate importance scores
```

### 11.3 Index Files

```text
.claude/index/
├── embeddings.db      # SQLite with vectors
├── symbols.json       # Functions, classes, types
├── dependencies.json  # Import graph
├── importance.json    # Score per file
└── metadata.json      # Timestamp, stats
```

### 11.4 Commands

```bash
adk index              # Index full project
adk index --update     # Incremental update
adk search "query"     # Semantic search
adk context "task"     # Find relevant files for task
```

### 11.5 Integration

When task starts, system automatically:

1. Semantic search by task description
2. Expand with dependencies
3. Filter by importance score (>0.5)
4. Truncate to token limit (20K)

---

## 12. AUTO MEMORIES (Automatic Capture)

### 12.1 Problem

Current `decisions.md` is manual. User must document important decisions.

**Competitors with this feature:** Windsurf (automatic memories), Cursor (Project Rules)

### 12.2 Solution: Auto-Capture Patterns

```text
TRIGGERS:
1. Architectural decision detected ("I'll use X instead of Y because...")
2. Pattern discovered ("This project uses pattern X for...")
3. Constraint identified ("We can't use X because...")
4. Recurring error fixed ("This error happens when... solution is...")

STORAGE:
.claude/memories/
├── project.json      # Global project memories
├── patterns.json     # Discovered patterns
├── decisions.json    # Architectural decisions
└── errors.json       # Known errors and solutions
```

### 12.3 Memory Schema

```json
{
  "id": "mem-001",
  "type": "pattern|decision|error_solution",
  "content": { "pattern": "...", "description": "...", "example_file": "..." },
  "confidence": 0.9,
  "used_count": 5
}
```

### 12.4 Commands

```bash
adk memory list                           # View all memories
adk memory add "Use bcrypt" --type decision  # Manual add
adk memory search "authentication"        # Search relevant
adk memory export > memories.json         # Export for team
adk memory prune --unused-days 30         # Clean old
```

### 12.5 Auto-Injection

Relevant memories injected automatically in context:

```markdown
## Relevant Memories
### Patterns
- Error handling: All services use try/catch with AppError (confidence: 90%)
### Decisions
- Validation: Use Zod instead of Joi (used 12 times)
```

---

## 13. VISUAL PROGRESS UI

### 13.1 Problem

ADK is CLI-only. Hard to track multiple parallel agents, long task progress.

**Competitors with this feature:** VS 2026 (Cloud Agent UI), Cursor (Composer), Windsurf (Cascade)

### 13.2 Solution: Rich Terminal UI (TUI)

```text
┌─────────────────────────────────────────────────────────────────┐
│  ADK v3 - Feature: user-authentication                    12:45 │
├─────────────────────────────────────────────────────────────────┤
│  PROGRESS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 60% (3/5)  │
│                                                                 │
│  AGENTS                          CURRENT TASK                   │
│  │ ● Agent 1  [Task 2.1]   │    │ Task 2.1: Auth Service      │
│  │   ████████░░ 80%        │    │ Status: implementing        │
│  │ ● Agent 2  [Task 2.2]   │    │ Time: 5m 32s                │
│  │   ██████░░░░ 60%        │                                   │
│                                                                 │
│  [p] pause  [r] resume  [l] logs  [d] details  [q] quit        │
└─────────────────────────────────────────────────────────────────┘
```

### 13.3 Visualization Modes

```bash
adk feature autopilot my-feature --ui      # Dashboard TUI
adk feature autopilot my-feature           # Minimal spinners
adk feature autopilot my-feature --verbose # Full logs
adk feature autopilot my-feature --json    # For integration
```

### 13.4 Web Dashboard (Future)

```bash
adk dashboard              # Start web UI at localhost:3333
adk dashboard --port 8080  # Custom port
adk status --all           # All features status
adk status --metrics       # With metrics
```

---

## 14. TECHNICAL SPECIFICATIONS

### 14.1 Session Management

```typescript
interface SessionData {
  feature: string;
  sessionId: string;
  lastActive: string;
  status: 'active' | 'completed';
}
```

### 14.2 Claude CLI Flags

```bash
--session-id <uuid>   # Use specific session ID
-r, --resume [value]  # Resume by session ID
-c, --continue        # Continue most recent in current directory
```

### 14.3 Feature List Schema

```typescript
interface FeatureList {
  feature: string;
  version: "1.0.0";
  tests: FeatureTest[];
  summary: { total: number; passing: number; failing: number; pending: number };
}

interface FeatureTest {
  id: string;           // "test-001"
  description: string;
  category: "functional" | "ui" | "integration" | "api" | "performance";
  steps: string[];
  status: "pending" | "passing" | "failing";
  files?: string[];
}
```

---

## 15. IMPLEMENTATION ROADMAP

### Phase 1: Infrastructure

- [ ] `src/cli-v3.ts` (entry point)
- [ ] `src/utils/session-store.ts`
- [ ] `src/utils/claude-v3.ts`

### Phase 2: Memory System

- [ ] `src/utils/memory/core-state.ts`
- [ ] `src/utils/memory/session-notes.ts`
- [ ] `src/utils/memory/compactor.ts`

### Phase 3: Agent Logic

- [ ] `src/utils/prompts/initializer.ts`
- [ ] `src/utils/prompts/coding.ts`
- [ ] `src/utils/feature-list.ts`

### Phase 4: Commands

- [ ] `src/commands/feature-v3.ts`
- [ ] `adk memory status|checkpoint|compact|restore`

### Phase 5: Hooks

- [ ] `inject-memory.sh`
- [ ] `auto-checkpoint.sh`
- [ ] `validate-no-stub.sh`

### Phase 6: Integration

- [ ] Add `"adk3": "node dist/cli-v3.js"` to package.json
- [ ] Full test with real feature

---

## 16. DIRECTORY STRUCTURE

```text
.claude/plans/features/{feature-name}/
├── tasks.md
├── implementation-plan.md
├── qa-report.md
├── feature_list.json          # v3
├── init.sh                    # v3
├── memory/                    # v3
│   ├── core-state.json       # Tier 1
│   ├── session-notes.md      # Tier 2
│   ├── decisions.md          # Tier 2
│   ├── breadcrumbs.md        # Tier 2
│   └── archive/              # Compacted sessions
├── checkpoints/               # v3
│   ├── checkpoint-*.json
│   └── latest.json
└── sessions/
    └── session-*.json
```

---

## 17. TOKEN OPTIMIZATION STRATEGIES

### 17.1 Quick Wins

| Strategy | Impact | Implementation |
|----------|--------|----------------|
| **Prompt Caching** | 80% latency, 90% token savings | Cache system prompts between sessions |
| **Model Tiering** | 90-97% cost reduction | Haiku for trivial, Sonnet for coding, Opus for architecture |
| **CLAUDE.md Diet** | Context reduction | Keep < 500 lines, move specialized to skills |
| **Compaction at 70%** | Prevent degradation | `/compact` before hitting 80% |

### 17.2 Context Engineering

```text
PRINCIPLE: "Find smallest set of high-signal tokens"

1. MINIMAL VIABLE CONTEXT
   - Load only tokens needed for current task
   - Use file paths instead of full content
   - Progressive disclosure

2. JUST-IN-TIME RETRIEVAL
   - Maintain breadcrumbs (references)
   - Load on demand
   - Discard after use

3. TWO-THRESHOLD COMPRESSION
   - Tmax (80%): Trigger compression
   - Tretained (50%): Post-compression target
```

### 17.3 What to Preserve vs Compress

**PRESERVE:**

- Session intent (original objective)
- File paths and line numbers
- Artifact trail (what was modified)
- Decisions (why, not just what)
- Breadcrumbs (re-fetch references)

**COMPRESS:**

- Redundant explanations
- Processed tool outputs
- Failed attempts (keep only lesson)
- Clarification conversations (keep only decision)

### 17.4 MCP Tool Search

**Impact:** 46.9% context reduction (51K → 8.5K tokens)

```bash
# Enable tool search with low threshold
ENABLE_TOOL_SEARCH=auto:<N>
```

Deferred tools only enter context when used, not when declared.

### 17.5 Multi-Agent Optimization

**Plan-and-Execute Pattern:** 90% cost reduction

```text
PLANNER (Opus) → Creates strategy, divides sub-tasks
                          │
    ┌───────────────┬─────┴─────┬───────────────┐
    ▼               ▼           ▼               ▼
EXECUTOR      EXECUTOR     EXECUTOR       EXECUTOR
(Sonnet)      (Sonnet)     (Sonnet)       (Sonnet)
```

**Sub-Agent Rule:** Return summaries (1-2K tokens), not raw data.

### 17.6 Key Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **CPT (Cost Per Task)** | Tokens × Price / Completions | Decreasing |
| **Token Efficiency** | Useful Output / Tokens Used | Increasing |
| **Context Utilization** | Active Tokens / Total Context | > 70% |

> **Reference:** Full strategies in `token-optimization-strategies.md`

---

## 18. REFERENCES

### Planning Documents

| Document | Content |
|----------|---------|
| `00-MASTER-INDEX.md` | Status, roadmap, changelog |
| `01-deep-analysis.md` | v2 codebase analysis |
| `02-long-running-agents-gap.md` | Gap vs Anthropic pattern |
| `03-v3-decisions.md` | Approved decisions, objectives |
| `04-context-memory-implementation.md` | **Memory specs, anti-stub, hooks** |
| `05-implementation-guide.md` | Step-by-step guide, schemas |
| `context-management-research.md` | Full research (25+ sources) |
| `token-optimization-strategies.md` | **Token optimization (20+ sources)** |

### Key External Sources

| Source | Topic | URL |
|--------|-------|-----|
| Anthropic | Context Engineering | anthropic.com/engineering/effective-context-engineering |
| Anthropic | Long-Running Agents | anthropic.com/engineering/effective-harnesses |
| Google ADK | Multi-Agent Framework | developers.googleblog.com/multi-agent-framework |
| Factory.ai | Context Compression | factory.ai/news/compressing-context |
| Tessl.io | Parallel AI Agents | tessl.io/blog/how-to-parallelize-ai-coding-agents |
| Addy Osmani | Agent Coordination | addyosmani.com/blog/coding-agents-manager |
| MongoDB | Memory Engineering | medium.com/mongodb/multi-agent-memory-engineering |
| MemGPT (Letta) | Hierarchical Memory | arxiv.org/abs/2310.08560 |
| Claude Code | Context Management | claudefa.st/blog/guide/mechanics/context-management |
| JetBrains | Efficient Context | blog.jetbrains.com/research/2025/12/efficient-context-management/ |

### Token Optimization Sources

| Source | Topic |
|--------|-------|
| Medium (Agentic AI Stack) | DeepSeek + Modal + Plan Caching |
| DataRobot | Cut Agentic AI Costs |
| ACON Paper (arXiv) | Context Compression for LLM Agents |
| Richard Porter | Claude Code Token Management |

### Competitor Analysis

| Tool | Feature Analyzed |
|------|------------------|
| Windsurf | SWE-grep, Fast Context, Auto Memories |
| Cursor | Codebase Indexing, Composer UI |
| Cline | MCP Integration, Deep Context |
| Aider | Git-native workflows |
| VS 2026 | Cloud Agent with Progress UI |

---

*Optimized for AI consumption. Last updated: 2026-02-02*
