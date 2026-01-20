# Implementation Plan: Advanced Agentic Techniques

**Feature:** advanced-agentic-techniques
**Date:** 2026-01-14
**Status:** Approved
**PRD:** [prd.md](./prd.md)
**Tasks:** [tasks.md](./tasks.md)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ADK ADVANCED AGENTIC TECHNIQUES                                    │
│                                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                    CLI LAYER (src/cli.ts)                                │  │
│  │                                                                                          │  │
│  │   adk memory recall    adk spec create    adk tool search    adk agent parallel          │  │
│  │   adk memory link      adk spec validate  adk tool register  adk agent status            │  │
│  │   adk memory export    adk spec generate  adk tool index                                 │  │
│  └────────────┬───────────────────┬──────────────────┬───────────────────┬──────────────────┘  │
│               │                   │                  │                   │                     │
│  ┌────────────▼──────────┐ ┌──────▼──────────┐ ┌─────▼──────────┐ ┌──────▼──────────────────┐  │
│  │   COMMAND LAYER       │ │  COMMAND LAYER  │ │ COMMAND LAYER  │ │    COMMAND LAYER        │  │
│  │                       │ │                 │ │                │ │                         │  │
│  │  memory.ts (extended) │ │    spec.ts      │ │   tool.ts      │ │   agent.ts (extended)   │  │
│  │  - recall()           │ │  - create()     │ │  - search()    │ │   - parallel()          │  │
│  │  - link()             │ │  - validate()   │ │  - register()  │ │   - status()            │  │
│  │  - unlink()           │ │  - generate()   │ │  - list()      │ │                         │  │
│  │  - export()           │ │  - view()       │ │  - index()     │ │                         │  │
│  └────────────┬──────────┘ └───────┬─────────┘ └────────┬───────┘ └───────────┬─────────────┘  │
│               │                    │                    │                     │                │
│  ┌────────────▼────────────────────▼────────────────────▼─────────────────────▼─────────────┐  │
│  │                                    UTILITY LAYER                                          │  │
│  │                                                                                           │  │
│  │  ┌─────────────────────┐  ┌────────────────────┐  ┌──────────────────────────────────┐   │  │
│  │  │  MEMORY SYSTEM      │  │    SDD SYSTEM      │  │       PARALLEL EXECUTION         │   │  │
│  │  │                     │  │                    │  │                                  │   │  │
│  │  │  decision-utils.ts  │  │  spec-utils.ts     │  │  parallel-executor.ts (enhanced) │   │  │
│  │  │  memory-search.ts   │  │  spec-validator.ts │  │  worktree-utils.ts               │   │  │
│  │  │  memory-compaction  │  │                    │  │  conflict-resolver.ts            │   │  │
│  │  │  memory-utils.ts    │  │                    │  │  merge-strategy.ts               │   │  │
│  │  └──────────┬──────────┘  └─────────┬──────────┘  │  agent-status.ts                 │   │  │
│  │             │                       │             └────────────────┬─────────────────┘   │  │
│  │             │                       │                              │                     │  │
│  │  ┌──────────▼───────────────────────▼──────────────────────────────▼─────────────────┐   │  │
│  │  │                         TOOL SEARCH SYSTEM                                         │   │  │
│  │  │                                                                                    │   │  │
│  │  │   tool-registry.ts (enhanced)                                                      │   │  │
│  │  │   - Fuzzy search with Fuse.js                                                      │   │  │
│  │  │   - Dynamic tool loading                                                           │   │  │
│  │  │   - Trigger extraction                                                             │   │  │
│  │  └───────────────────────────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                     TYPE LAYER                                            │  │
│  │                                                                                           │  │
│  │   types/memory.ts (extended)    types/spec.ts         types/tool.ts                       │  │
│  │   - Decision                    - Spec                - ToolDefinition                    │  │
│  │   - DecisionCategory            - GherkinScenario     - ToolSearchResult                  │  │
│  │   - MemorySearchResult          - SpecValidation      - ToolRegistry                      │  │
│  │   - CompactionConfig            - EdgeCase            - ToolExecutionContext              │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                 STORAGE LAYER                                             │  │
│  │                                                                                           │  │
│  │  .claude/memory/decisions/*.md    .claude/specs/*.md    .claude/tools/registry.json       │  │
│  │  .claude/memory/archive/          .claude/plans/*/      .claude/agents/*.md               │  │
│  │  .claude/agent-status.json        .claude/exports/      .claude/skills/*.md               │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              EXTERNAL DEPENDENCIES                                        │  │
│  │                                                                                           │  │
│  │   Claude Code CLI          simple-git           fuse.js              zod (optional)       │  │
│  │   (executeClaudeCommand)   (git worktrees)      (fuzzy search)       (spec validation)    │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Architecture

### 2.1 Memory Persistence Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  MEMORY PERSISTENCE FLOW                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌──────────┐     ┌───────────────────┐     ┌─────────────────┐     ┌────────────────────┐   │
│   │  User    │     │  memory.ts        │     │ decision-utils  │     │ .claude/memory/    │   │
│   │  Command │────▶│  Command Handler  │────▶│ Persistence     │────▶│ decisions/*.md     │   │
│   └──────────┘     └───────────────────┘     └─────────────────┘     └────────────────────┘   │
│                                                      │                                         │
│                                                      ▼                                         │
│                                            ┌─────────────────┐                                 │
│                                            │ memory-search   │                                 │
│                                            │ Fuse.js Index   │◄─── Query: "adk memory recall"  │
│                                            └────────┬────────┘                                 │
│                                                     │                                          │
│                                                     ▼                                          │
│                                            ┌─────────────────┐                                 │
│                                            │ MemorySearch    │                                 │
│                                            │ Result[]        │                                 │
│                                            │ (score, match)  │                                 │
│                                            └─────────────────┘                                 │
│                                                                                                │
│   Auto-Compaction Trigger:                                                                     │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                                                                                      │    │
│   │    Memory File > 1000 lines OR > 50KB                                                │    │
│   │         │                                                                            │    │
│   │         ▼                                                                            │    │
│   │    ┌──────────────────┐     ┌─────────────────┐     ┌────────────────────────────┐  │    │
│   │    │ memory-compaction│────▶│ Archive Original│────▶│ .claude/memory/archive/    │  │    │
│   │    │ Extract Essentials│    │ Generate Summary │    │ YYYY-MM-DD-feature.md      │  │    │
│   │    └──────────────────┘     └─────────────────┘     └────────────────────────────┘  │    │
│   │                                                                                      │    │
│   └──────────────────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Spec-Driven Development Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SPEC-DRIVEN DEVELOPMENT (SDD) FLOW                                │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌───────────────┐                                                                            │
│   │ adk feature   │                                                                            │
│   │ new <name>    │                                                                            │
│   └───────┬───────┘                                                                            │
│           │                                                                                    │
│           ▼                                                                                    │
│   ┌───────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              SPEC GATE (Blocking)                                     │   │
│   │                                                                                       │   │
│   │    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐                      │   │
│   │    │ spec create  │─────▶│ spec validate│─────▶│ feature plan │                      │   │
│   │    │ Interactive  │      │ Schema Check │      │ (unblocked)  │                      │   │
│   │    └──────────────┘      └──────┬───────┘      └──────────────┘                      │   │
│   │                                 │                                                     │   │
│   │                          Valid? │                                                     │   │
│   │                         ┌───────┴───────┐                                            │   │
│   │                         │               │                                            │   │
│   │                      No ▼            Yes▼                                            │   │
│   │               ┌─────────────┐   ┌─────────────┐                                      │   │
│   │               │ Show Errors │   │ Continue    │                                      │   │
│   │               │ Block Flow  │   │ to Planning │                                      │   │
│   │               └─────────────┘   └─────────────┘                                      │   │
│   └───────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                │
│   Spec Schema Validation:                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                       │   │
│   │    Required Fields:                    Gherkin Format:                                │   │
│   │    ├── feature (string, min 1)         ├── name                                       │   │
│   │    ├── description (string, min 10)    ├── given                                      │   │
│   │    ├── inputs[] (min 1)                ├── when                                       │   │
│   │    │   ├── name                        └── then                                       │   │
│   │    │   ├── type                                                                       │   │
│   │    │   └── description                                                                │   │
│   │    ├── outputs[] (min 1)                                                              │   │
│   │    ├── behaviors[] (min 1)                                                            │   │
│   │    ├── edgeCases[] (min 1)                                                            │   │
│   │    └── acceptanceCriteria[] (min 1)                                                   │   │
│   │                                                                                       │   │
│   └───────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Tool Search System Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  TOOL SEARCH SYSTEM FLOW                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   Indexing Phase:                                                                              │
│   ┌───────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                       │   │
│   │    .claude/agents/*.md ───┐                                                           │   │
│   │                           │     ┌─────────────────┐     ┌─────────────────────────┐  │   │
│   │    .claude/skills/*.md ───┼────▶│ indexAllTools() │────▶│ .claude/tools/          │  │   │
│   │                           │     │ parseFrontmatter│     │ registry.json           │  │   │
│   │    Custom tools ──────────┘     │ extractTriggers │     └─────────────────────────┘  │   │
│   │                                 └─────────────────┘                                   │   │
│   │                                                                                       │   │
│   └───────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                │
│   Search Phase:                                                                                │
│   ┌───────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                       │   │
│   │    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐  │   │
│   │    │  User Query  │────▶│  Fuse.js     │────▶│ Score + Rank │────▶│ ToolSearch    │  │   │
│   │    │  "run tests" │     │  Fuzzy Match │     │ threshold .4 │     │ Result[]      │  │   │
│   │    └──────────────┘     └──────────────┘     └──────────────┘     └───────────────┘  │   │
│   │                                                                                       │   │
│   │    Search Keys (weighted):                                                            │   │
│   │    ├── name (0.3)                                                                     │   │
│   │    ├── description (0.3)                                                              │   │
│   │    └── triggers (0.4)                                                                 │   │
│   │                                                                                       │   │
│   └───────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                │
│   Deferred Loading:                                                                            │
│   ┌───────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                       │   │
│   │    Agent Prompt Generation:                                                           │   │
│   │                                                                                       │   │
│   │    ┌─────────────────────────────────────────────────────────────────────────────┐   │   │
│   │    │  ## Available Tools (Loaded)                                                │   │   │
│   │    │  - analyzer: Code analysis...     ◄── priority: high || deferLoading: false │   │   │
│   │    │  - implementer: TDD...                                                      │   │   │
│   │    │                                                                             │   │   │
│   │    │  ## Tool Search (Meta-Tool)                                                 │   │   │
│   │    │  TOOL_SEARCH: <describe need>     ◄── Triggers dynamic loading              │   │   │
│   │    │                                                                             │   │   │
│   │    │  Available on-demand: tester, documenter, security-scanner...               │   │   │
│   │    └─────────────────────────────────────────────────────────────────────────────┘   │   │
│   │                                                                                       │   │
│   └───────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Multi-Agent Parallel Execution Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            MULTI-AGENT PARALLEL EXECUTION FLOW                                 │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                                ORCHESTRATION                                          │    │
│   │                                                                                       │    │
│   │    adk agent parallel <feature> --max-agents 3                                        │    │
│   │         │                                                                             │    │
│   │         ▼                                                                             │    │
│   │    ┌─────────────────┐                                                                │    │
│   │    │ Load Agents     │                                                                │    │
│   │    │ [analyzer,      │                                                                │    │
│   │    │  implementer,   │                                                                │    │
│   │    │  tester,        │                                                                │    │
│   │    │  documenter]    │                                                                │    │
│   │    └────────┬────────┘                                                                │    │
│   │             │                                                                         │    │
│   │             ▼                                                                         │    │
│   │    ┌─────────────────────────────────────────────────────────────────────────────┐   │    │
│   │    │                    CHUNK BY MAX_AGENTS (3)                                  │   │    │
│   │    │                                                                             │   │    │
│   │    │    Chunk 1: [analyzer, implementer, tester]     ── Execute in parallel      │   │    │
│   │    │    Chunk 2: [documenter]                        ── Wait, then execute       │   │    │
│   │    │                                                                             │   │    │
│   │    └─────────────────────────────────────────────────────────────────────────────┘   │    │
│   │                                                                                       │    │
│   └──────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                                WORKTREE ISOLATION                                     │    │
│   │                                                                                       │    │
│   │    Main Repo                                                                          │    │
│   │    ├── .worktrees/                                                                    │    │
│   │    │   ├── feature-analyzer-0/     ◄── git worktree add (branch: feature/analyzer)    │    │
│   │    │   ├── feature-implementer-1/  ◄── git worktree add (branch: feature/implementer) │    │
│   │    │   └── feature-tester-2/       ◄── git worktree add (branch: feature/tester)      │    │
│   │    │                                                                                  │    │
│   │    Each worktree:                                                                     │    │
│   │    ├── Full repo copy                                                                 │    │
│   │    ├── Isolated git branch                                                            │    │
│   │    └── Independent Claude Code execution                                              │    │
│   │                                                                                       │    │
│   └──────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                              CONFLICT DETECTION & MERGE                               │    │
│   │                                                                                       │    │
│   │    ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────────────┐  │    │
│   │    │ Collect     │     │ Detect Conflicts │     │ Classify                        │  │    │
│   │    │ Changed     │────▶│ (same file,      │────▶│ ├── auto-resolvable (2 agents)  │  │    │
│   │    │ Files       │     │  multiple agents)│     │ └── manual-required (3+ agents) │  │    │
│   │    └─────────────┘     └──────────────────┘     └─────────────────────────────────┘  │    │
│   │                                                          │                            │    │
│   │                                                          ▼                            │    │
│   │                                               ┌──────────────────────┐                │    │
│   │                                               │ Merge Strategy       │                │    │
│   │                                               │ ├── Auto-merge       │                │    │
│   │                                               │ ├── Preserve commits │                │    │
│   │                                               │ └── Rollback on fail │                │    │
│   │                                               └──────────────────────┘                │    │
│   │                                                                                       │    │
│   └──────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                              FALLBACK TO SEQUENTIAL                                   │    │
│   │                                                                                       │    │
│   │    Triggers:                                                                          │    │
│   │    ├── Agent execution timeout                                                        │    │
│   │    ├── Manual-required conflicts detected                                             │    │
│   │    ├── Worktree creation failure                                                      │    │
│   │    └── --fallback-sequential flag                                                     │    │
│   │                                                                                       │    │
│   │    Sequential Mode:                                                                   │    │
│   │    analyzer ──▶ implementer ──▶ tester ──▶ documenter                                 │    │
│   │              │               │           │                                            │    │
│   │              └── No worktree, runs in main repo                                       │    │
│   │                                                                                       │    │
│   └──────────────────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layers Affected

| Layer | Files | Changes |
|-------|-------|---------|
| **CLI** | `src/cli.ts` | New commands: `memory recall/link/export`, `spec create/validate/generate`, `tool search/register/index`, `agent parallel/status` |
| **Commands** | `src/commands/memory.ts` | New methods: `recall()`, `link()`, `unlink()`, `export()` |
| **Commands** | `src/commands/spec.ts` | Existing, verify: `create()`, `validate()`, `generate()`, `view()` |
| **Commands** | `src/commands/tool.ts` | Existing, verify: `search()`, `register()`, `list()`, `index()` |
| **Commands** | `src/commands/agent.ts` | New methods: `parallel()`, `status()` |
| **Commands** | `src/commands/feature.ts` | Modify: integrate spec gate in `plan()` and `implement()` |
| **Utils** | `src/utils/decision-utils.ts` | Existing, verify CRUD operations |
| **Utils** | `src/utils/memory-search.ts` | Existing, verify fuzzy search |
| **Utils** | `src/utils/memory-compaction.ts` | **NEW**: auto-compaction logic |
| **Utils** | `src/utils/spec-utils.ts` | Existing, verify validation and parsing |
| **Utils** | `src/utils/tool-registry.ts` | Existing, enhance with Fuse.js |
| **Utils** | `src/utils/worktree-utils.ts` | Existing, verify git operations |
| **Utils** | `src/utils/parallel-executor.ts` | Existing, enhance orchestration |
| **Utils** | `src/utils/conflict-resolver.ts` | Existing, enhance classification |
| **Utils** | `src/utils/merge-strategy.ts` | **NEW**: merge logic for parallel results |
| **Utils** | `src/utils/agent-status.ts` | **NEW**: status tracking |
| **Types** | `src/types/memory.ts` | Existing, verify types |
| **Types** | `src/types/spec.ts` | Existing, verify types |
| **Types** | `src/types/tool.ts` | Existing, verify types |

---

## 4. Files to Create

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/utils/memory-compaction.ts` | Auto-compaction logic with Claude | ~150 LOC |
| `src/utils/merge-strategy.ts` | Git merge strategy for parallel branches | ~200 LOC |
| `src/utils/agent-status.ts` | Agent status tracking and persistence | ~100 LOC |
| `tests/utils/memory-compaction.test.ts` | Unit tests | ~100 LOC |
| `tests/utils/merge-strategy.test.ts` | Unit tests | ~150 LOC |
| `tests/utils/agent-status.test.ts` | Unit tests | ~80 LOC |
| `templates/spec-template.md` | Enhanced spec template | ~80 LOC |

---

## 5. Files to Modify

| File | Modifications |
|------|---------------|
| `src/cli.ts` | Verify all new commands are registered (most appear to be) |
| `src/commands/memory.ts` | Verify `recall()`, `link()`, `unlink()`, `export()` implementations |
| `src/commands/feature.ts` | Verify spec gate integration in `implement()` |
| `src/commands/agent.ts` | Add/enhance `parallel()` and `status()` methods |
| `src/utils/tool-registry.ts` | Add Fuse.js for proper fuzzy search |
| `src/utils/parallel-executor.ts` | Enhance with better conflict handling |
| `package.json` | Add `fuse.js` dependency if not present |

---

## 6. Patterns to Follow

### 6.1 Command Pattern (from `src/commands/feature.ts`)

```typescript
class FeatureCommand {
  async create(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora()

    try {
      spinner.start('Creating...')
      // ... logic
      spinner.succeed('Created')
      logger.success(`Feature ${name} created!`)
    } catch (error) {
      spinner.fail('Error')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const featureCommand = new FeatureCommand()
```

### 6.2 Type Definition Pattern (from `src/types/memory.ts`)

```typescript
export interface Decision {
  id: string
  title: string
  context: string
  alternatives: string[]
  chosen: string
  rationale: string
  category: DecisionCategory
  tags: string[]
  relatedFeatures: string[]
  createdAt: string
  updatedAt: string
}

export enum DecisionCategory {
  ARCHITECTURE = 'architecture',
  PATTERN = 'pattern',
  // ...
}
```

### 6.3 Utility Function Pattern (from `src/utils/tool-registry.ts`)

```typescript
const REGISTRY_PATH = '.claude/tools/registry.json'
let registryCache: ToolRegistry | null = null

async function loadRegistry(): Promise<ToolRegistry> {
  if (registryCache) return registryCache

  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8')
    registryCache = JSON.parse(content)
    return registryCache as ToolRegistry
  } catch {
    registryCache = { tools: [], lastIndexed: new Date().toISOString(), version: '1.0.0' }
    return registryCache
  }
}

export async function registerTool(tool: ToolDefinition): Promise<void> {
  const registry = await loadRegistry()
  // ... modify
  await saveRegistry(registry)
}
```

### 6.4 Validation Pattern (from `src/types/spec.ts`)

```typescript
export function validateSpec(data: unknown): SpecValidationResult {
  const errors: SpecValidationError[] = []
  const warnings: string[] = []

  // Validate required fields
  const featureError = validateRequired(spec.feature, 'feature')
  if (featureError) errors.push(featureError)

  // Validate arrays
  if (!spec.inputs || !Array.isArray(spec.inputs)) {
    errors.push({ field: 'inputs', message: 'inputs is required', path: ['inputs'] })
  }

  return { valid: errors.length === 0, errors, warnings }
}
```

---

## 7. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Git worktree conflicts on large repos | Medium | High | Implement cleanup before parallel execution, timeout handling |
| Memory corruption during compaction | Low | High | Archive original before compaction, validate after |
| Fuse.js search returns wrong tool | Low | Medium | Confidence threshold + manual confirmation for ambiguous |
| Spec validation too strict | Medium | Low | Allow `--skip-spec` flag with warning |
| Parallel agents modify same file | High | Medium | Automatic conflict detection + fallback to sequential |
| Backward compatibility breaks | Low | High | All new commands are additions, existing commands unchanged |

---

## 8. Implementation Order

### Phase 1: Foundation Verification (Tasks 1.1-1.3)
1. **Verify** `src/types/memory.ts` - Decision types already exist
2. **Verify** `src/utils/decision-utils.ts` - CRUD operations exist
3. **Verify** `src/utils/memory-search.ts` - Fuzzy search exists
4. **Verify** `src/commands/memory.ts` - recall/link/export commands

### Phase 2: SDD Verification (Tasks 2.1-2.4)
1. **Verify** `src/types/spec.ts` - Spec types already exist
2. **Verify** `src/utils/spec-utils.ts` - Validation exists
3. **Verify** `src/commands/spec.ts` - Commands exist
4. **Verify** `src/commands/feature.ts` - Spec gate integration

### Phase 3: Tool Search Enhancement (Tasks 3.1-3.3)
1. **Verify** `src/types/tool.ts` - Tool types already exist
2. **Verify** `src/utils/tool-registry.ts` - Registry exists
3. **Enhance** fuzzy search with proper Fuse.js if needed
4. **Verify** `src/commands/tool.ts` - Commands exist

### Phase 4: Parallel Execution Enhancement (Tasks 4.1-4.6)
1. **Verify** `src/utils/worktree-utils.ts` - Worktree operations exist
2. **Verify** `src/utils/parallel-executor.ts` - Parallel execution exists
3. **Create** `src/utils/merge-strategy.ts` - Merge logic
4. **Create** `src/utils/agent-status.ts` - Status tracking
5. **Enhance** `src/commands/agent.ts` - parallel/status commands

### Phase 5: Integration Testing
1. Run full test suite
2. Test all new commands end-to-end
3. Test backward compatibility
4. Performance benchmarking

---

## 9. Test Strategy

### Unit Tests (Coverage >= 80%)
- `decision-utils.test.ts` - CRUD operations
- `memory-search.test.ts` - Fuzzy search scoring
- `memory-compaction.test.ts` - Compaction logic
- `spec-validator.test.ts` - Validation rules
- `tool-registry.test.ts` - Registry operations
- `worktree-utils.test.ts` - Git operations (mocked)
- `parallel-executor.test.ts` - Parallel orchestration
- `merge-strategy.test.ts` - Merge logic

### Integration Tests
- Full workflow: feature create → spec → plan → implement
- Parallel execution with real worktrees (small test repo)
- Memory recall with multiple decisions
- Tool search with real agents

### E2E Tests
- `adk feature autopilot` with spec gate
- `adk agent parallel` with fallback
- `adk memory recall` with linked decisions

---

## 10. Dependencies Status

| Dependency | Status | Action |
|------------|--------|--------|
| `fuse.js` | **Check** | May need to add for proper fuzzy search |
| `simple-git` | **Check** | Used in worktree-utils, verify version |
| `zod` | **Optional** | Not strictly needed, types/spec.ts uses manual validation |
| `inquirer` | **Exists** | Used for interactive prompts |
| `ora` | **Exists** | Used for spinners |
| `chalk` | **Exists** | Used for colors |
| `fs-extra` | **Exists** | Used for file operations |

---

## 11. Current Implementation Status

Based on codebase analysis, the following is **already implemented**:

| Feature | Status | Files |
|---------|--------|-------|
| Memory types (Decision, etc.) | ✅ Complete | `src/types/memory.ts` |
| Decision persistence | ✅ Complete | `src/utils/decision-utils.ts` |
| Memory search | ✅ Complete | `src/utils/memory-search.ts` |
| Memory commands | ✅ Complete | `src/commands/memory.ts`, `src/cli.ts` |
| Spec types | ✅ Complete | `src/types/spec.ts` |
| Spec validation | ✅ Complete | `src/utils/spec-utils.ts` |
| Spec commands | ✅ Complete | `src/commands/spec.ts` |
| Spec gate in feature | ✅ Complete | `src/commands/feature.ts:384-426` |
| Tool types | ✅ Complete | `src/types/tool.ts` |
| Tool registry | ✅ Complete | `src/utils/tool-registry.ts` |
| Tool commands | ✅ Complete | `src/commands/tool.ts` |
| Worktree utils | ✅ Complete | `src/utils/worktree-utils.ts` |
| Parallel executor | ✅ Complete | `src/utils/parallel-executor.ts` |
| Conflict resolver | ✅ Complete | `src/utils/conflict-resolver.ts` |
| Agent parallel command | ✅ Complete | `src/cli.ts:133-138` |
| Agent status command | ✅ Complete | `src/cli.ts:140-144` |

### Remaining Work

| Feature | Status | Action |
|---------|--------|-------|
| Memory auto-compaction | ⚠️ Partial | Verify `memory-compaction.ts` exists, add if needed |
| Merge strategy | ⚠️ Missing | Create `src/utils/merge-strategy.ts` |
| Agent status tracking | ⚠️ Partial | Create `src/utils/agent-status.ts` if needed |
| Fuse.js integration | ⚠️ Verify | Check if `fuse.js` is in package.json |
| Comprehensive tests | ⚠️ Verify | Add missing unit tests |

---

## 12. Next Steps

1. **Verify dependencies** - Run `npm list fuse.js simple-git zod` to check installed packages
2. **Verify test coverage** - Run `npm run test:coverage` to identify gaps
3. **Create missing files** - `merge-strategy.ts`, `agent-status.ts` if needed
4. **Add Fuse.js** - If fuzzy search is currently using simple matching
5. **Integration tests** - Test full workflows end-to-end
6. **Documentation** - Update README with new commands

---

*Generated by ADK Autopilot - Architecture Phase*
