# Implementation Plan: v3-version

**Data:** 2026-02-02
**Status:** Ready for Implementation
**Autor:** ADK Planning Agent
**Baseado em:** research.md, prd.md, v3-decisions.md, context-memory-implementation.md

---

## Executive Summary

This implementation plan breaks down the ADK v3 into **10 phases** with **58 tasks**. Each phase builds upon the previous one, creating a solid foundation for the v3 architecture.

**Total Estimated Story Points:** 89 SP
**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

---

## Phase Overview

| Phase | Name | Story Points | Description |
|-------|------|--------------|-------------|
| 1 | Infrastructure Expansion | 8 SP | Expand cli-v3.ts, verify Claude flags, add base commands |
| 2 | Memory System Core | 13 SP | Implement 4-tier memory hierarchy with compaction |
| 3 | Agent Logic | 10 SP | Create Initializer and Coding agent prompts |
| 4 | Core Commands | 13 SP | Implement `feature <name>` and `autopilot` commands |
| 5 | Quality Hooks | 8 SP | Anti-stub hooks, context injection, checkpoints |
| 6 | Parallel Execution | 13 SP | Shared state, worktree management, aggregator |
| 7 | Semantic Indexing | 10 SP | AST parsing, embeddings, search engine |
| 8 | Auto Memories | 8 SP | Pattern detection and automatic capture |
| 9 | Visual UI | 8 SP | TUI dashboard with Ink |
| 10 | Integration & Testing | 8 SP | Full integration testing, documentation |

---

## Phase 1: Infrastructure Expansion

**Objective:** Expand the minimal v3 infrastructure to support all planned commands.

**Dependencies:** None (foundation phase)
**Story Points:** 8 SP

### Existing Files (Status)
- `src/cli-v3.ts` - ✅ Exists (27 lines, minimal)
- `src/utils/session-store.ts` - ✅ Complete (149 lines)
- `src/utils/claude-v3.ts` - ✅ Complete (190 lines)
- `src/types/session-v3.ts` - ✅ Complete (59 lines)
- `src/commands/feature-v3.ts` - 🟡 Partial (95 lines, only `status` method)

### Tasks

#### Task 1.1: Verify Claude CLI Session Flags
**Files:** N/A (verification task)
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] Verify `--resume <uuid>` flag works
- [ ] Verify `--session-id <uuid>` flag works
- [ ] Verify `-c` (continue) flag works
- [ ] Document any limitations or workarounds needed
- [ ] Update claude-v3.ts if flag behavior differs from expected
**Story Points:** 1 SP

#### Task 1.2: Expand cli-v3.ts Commands
**Files:** `src/cli-v3.ts`
**Tests:** `tests/cli-v3.test.ts`
**Acceptance Criteria:**
- [ ] Add `feature <name>` command (calls `featureV3Command.feature()`)
- [ ] Add `feature autopilot <name>` command (calls `featureV3Command.autopilot()`)
- [ ] Add `--parallel` flag for autopilot
- [ ] Add `--agents <number>` flag for parallel count
- [ ] Add `--dry-run` flag for preview
- [ ] Add `--resume` flag for session resume
- [ ] Add `--continue` flag for continuation
- [ ] All commands validated with proper error messages
**Story Points:** 3 SP

#### Task 1.3: Add package.json Entry Point
**Files:** `package.json`
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] Add `"adk3": "node dist/cli-v3.js"` to bin section
- [ ] Verify `npm run adk3 -- --help` works
- [ ] Verify `npm run adk3 -- feature status test` works
**Story Points:** 1 SP

#### Task 1.4: Create Types for v3 Features
**Files:** `src/types/feature-v3.ts`
**Tests:** `tests/types/feature-v3.test.ts`
**Acceptance Criteria:**
- [ ] Create `FeatureList` interface (canonical schema from implementation guide)
- [ ] Create `FeatureTest` interface
- [ ] Create `FeaturePhase` enum (research, plan, implement, qa)
- [ ] Create `FeatureStatus` type
- [ ] Create `AutopilotOptions` interface
- [ ] Validate types with Zod schemas
**Story Points:** 2 SP

#### Task 1.5: Create Feature List Manager
**Files:** `src/utils/feature-list.ts`
**Tests:** `tests/utils/feature-list.test.ts`
**Acceptance Criteria:**
- [ ] `load(feature)` - Load feature_list.json
- [ ] `save(feature, list)` - Save with atomic writes
- [ ] `create(feature, tests)` - Create new feature list
- [ ] `updateTest(feature, testId, updates)` - Update single test
- [ ] `getSummary(feature)` - Get test counts
- [ ] `getNextPendingTest(feature)` - Get next test to implement
- [ ] Handle migration from tasks.md format
**Story Points:** 1 SP

### Phase 1 Checkpoint
- [ ] `npm run adk3 -- feature test-feature` executes (stubs OK)
- [ ] `npm run adk3 -- feature autopilot test-feature` executes (stubs OK)
- [ ] All new types compile without errors
- [ ] All Phase 1 tests pass

---

## Phase 2: Memory System Core

**Objective:** Implement the 4-tier hierarchical memory system.

**Dependencies:** Phase 1
**Story Points:** 13 SP

### Files to Create
- `src/utils/memory/core-state.ts` - Tier 1 manager
- `src/utils/memory/session-notes.ts` - Tier 2 manager
- `src/utils/memory/loader.ts` - Progressive loading
- `src/utils/memory/compactor.ts` - Enhanced compaction

### Tasks

#### Task 2.1: Create Memory Directory Structure
**Files:** `src/utils/memory/index.ts`
**Tests:** N/A (structure task)
**Acceptance Criteria:**
- [ ] Create `src/utils/memory/` directory
- [ ] Create index.ts with all exports
- [ ] Define memory tier constants (token limits, file paths)
**Story Points:** 1 SP

#### Task 2.2: Implement Core State Manager (Tier 1)
**Files:** `src/utils/memory/core-state.ts`
**Tests:** `tests/utils/memory/core-state.test.ts`
**Acceptance Criteria:**
- [ ] Create `CoreState` interface matching spec
- [ ] `load(feature)` - Load core-state.json
- [ ] `save(feature, state)` - Save with atomic writes
- [ ] `update(feature, updates)` - Partial update
- [ ] `updateCurrentTask(feature, task)` - Update current task
- [ ] `addDecision(feature, decision)` - Add decision (max 5)
- [ ] `addModifiedFile(feature, file)` - Track modified files
- [ ] `getTokenCount(feature)` - Count tokens (<2000 target)
- [ ] Auto-compress when exceeding 2000 tokens
**Story Points:** 3 SP

#### Task 2.3: Implement Session Notes Manager (Tier 2)
**Files:** `src/utils/memory/session-notes.ts`
**Tests:** `tests/utils/memory/session-notes.test.ts`
**Acceptance Criteria:**
- [ ] `load(feature)` - Load session-notes.md
- [ ] `save(feature, notes)` - Save as markdown
- [ ] `addEntry(feature, entry)` - Add timeline entry
- [ ] `addLearning(feature, learning)` - Add key learning
- [ ] `addFileRead(feature, file)` - Track files read
- [ ] `addCommand(feature, command, result)` - Track commands
- [ ] `archive(feature)` - Archive to history
**Story Points:** 2 SP

#### Task 2.4: Implement Decisions Tracker (Tier 2)
**Files:** `src/utils/memory/decisions.ts`
**Tests:** `tests/utils/memory/decisions.test.ts`
**Acceptance Criteria:**
- [ ] `load(feature)` - Load decisions.md
- [ ] `add(feature, decision)` - Add new decision with ADR format
- [ ] `list(feature)` - List all decisions
- [ ] `getRecent(feature, count)` - Get N most recent
- [ ] Markdown format with Context, Options, Decision, Rationale
**Story Points:** 2 SP

#### Task 2.5: Implement Breadcrumbs Manager (Tier 2)
**Files:** `src/utils/memory/breadcrumbs.ts`
**Tests:** `tests/utils/memory/breadcrumbs.test.ts`
**Acceptance Criteria:**
- [ ] `load(feature)` - Load breadcrumbs.md
- [ ] `add(feature, breadcrumb)` - Add reference for re-fetch
- [ ] `getByType(feature, type)` - Get breadcrumbs by category
- [ ] Support patterns, files, commands categories
**Story Points:** 1 SP

#### Task 2.6: Implement Progressive Loader
**Files:** `src/utils/memory/loader.ts`
**Tests:** `tests/utils/memory/loader.test.ts`
**Acceptance Criteria:**
- [ ] `loadTier1(feature)` - Always load core state
- [ ] `loadTier2(feature)` - Load session context
- [ ] `loadTier3(feature, phase)` - Load based on phase (research/plan/implement/qa)
- [ ] `loadForTask(feature, task)` - Load context specific to task
- [ ] `getTokenCount(context)` - Calculate total tokens
- [ ] Enforce max 20K tokens per load
- [ ] Return formatted context string
**Story Points:** 2 SP

#### Task 2.7: Enhance Context Compactor for Two-Threshold
**Files:** `src/utils/memory/compactor.ts` (extends existing context-compactor.ts)
**Tests:** `tests/utils/memory/compactor.test.ts`
**Acceptance Criteria:**
- [ ] Implement T_max = 80% trigger threshold
- [ ] Implement T_target = 50% post-compaction target
- [ ] Define never-compress list (paths, line numbers, commands, errors)
- [ ] Define always-compress list (explanations, failed attempts)
- [ ] Create structured compaction template
- [ ] Preserve artifact trail (file paths, operations, lines)
- [ ] 24-hour revert window support
**Story Points:** 2 SP

### Phase 2 Checkpoint
- [ ] Core state saves and loads correctly
- [ ] Session notes update and archive properly
- [ ] Decisions track with ADR format
- [ ] Loader returns combined context under 20K tokens
- [ ] Compactor triggers at 80% and reduces to 50%
- [ ] All Phase 2 tests pass

---

## Phase 3: Agent Logic

**Objective:** Create the dual-agent prompt system (Initializer + Coding).

**Dependencies:** Phase 2
**Story Points:** 10 SP

### Files to Create
- `src/utils/prompts/initializer.ts` - Initializer Agent prompt builder
- `src/utils/prompts/coding.ts` - Coding Agent prompt builder
- `src/utils/prompts/anti-stub.ts` - Anti-stub rules generator
- `src/utils/prompts/comprehension-check.ts` - Checkpoint generator

### Tasks

#### Task 3.1: Create Prompts Directory Structure
**Files:** `src/utils/prompts/index.ts`
**Tests:** N/A (structure task)
**Acceptance Criteria:**
- [ ] Create `src/utils/prompts/` directory
- [ ] Create index.ts with all exports
- [ ] Define prompt constants (max tokens, templates)
**Story Points:** 1 SP

#### Task 3.2: Implement Anti-Stub Rules Generator
**Files:** `src/utils/prompts/anti-stub.ts`
**Tests:** `tests/utils/prompts/anti-stub.test.ts`
**Acceptance Criteria:**
- [ ] Define stub patterns list (TODO, FIXME, NotImplementedError, etc.)
- [ ] `generateRules()` - Generate anti-stub section for prompts
- [ ] `generateChecklist()` - Generate completion checklist
- [ ] Include TDD verification loop instructions
- [ ] Include "One File, One Step" protocol
**Story Points:** 1 SP

#### Task 3.3: Implement Comprehension Checkpoint Generator
**Files:** `src/utils/prompts/comprehension-check.ts`
**Tests:** `tests/utils/prompts/comprehension-check.test.ts`
**Acceptance Criteria:**
- [ ] `generateCheckpoint(coreState)` - Generate checkpoint questions
- [ ] Questions: current task, modified files, decisions, constraints
- [ ] Verification checklist format
- [ ] "If cannot answer, read first" instructions
**Story Points:** 1 SP

#### Task 3.4: Implement Initializer Agent Prompt Builder
**Files:** `src/utils/prompts/initializer.ts`
**Tests:** `tests/utils/prompts/initializer.test.ts`
**Acceptance Criteria:**
- [ ] `buildPrompt(feature, prd, context)` - Build complete prompt
- [ ] Include system role: "You are a software architect..."
- [ ] Mission: Create feature_list.json and init.sh
- [ ] Include PRD analysis instructions
- [ ] Include output format specifications
- [ ] Include anti-stub rules
- [ ] Output files must be real (no stubs)
**Story Points:** 3 SP

#### Task 3.5: Implement Coding Agent Prompt Builder
**Files:** `src/utils/prompts/coding.ts`
**Tests:** `tests/utils/prompts/coding.test.ts`
**Acceptance Criteria:**
- [ ] `buildPrompt(feature, coreState, context)` - Build complete prompt
- [ ] Include system role: "You are a senior developer..."
- [ ] Include Read-Before-Write protocol
- [ ] Include TDD enforcement loop
- [ ] Include anti-stub rules
- [ ] Include comprehension checkpoint
- [ ] Include context from memory tiers
- [ ] Include constraints section at TOP (Critical Info First)
- [ ] Loop instructions: Read → Analyze → Implement → Test → Commit → Repeat
**Story Points:** 3 SP

#### Task 3.6: Create Prompt Template System
**Files:** `src/utils/prompts/templates.ts`
**Tests:** `tests/utils/prompts/templates.test.ts`
**Acceptance Criteria:**
- [ ] `loadTemplate(name)` - Load prompt template
- [ ] `renderTemplate(template, vars)` - Render with variables
- [ ] Support markdown templates with {{variable}} placeholders
- [ ] Template validation (required variables)
**Story Points:** 1 SP

### Phase 3 Checkpoint
- [ ] Initializer prompt generates valid instructions
- [ ] Coding prompt includes all 5 guarantee layers
- [ ] Anti-stub rules properly formatted
- [ ] Comprehension checkpoint questions generated
- [ ] All Phase 3 tests pass

---

## Phase 4: Core Commands

**Objective:** Implement the main `feature` and `autopilot` commands.

**Dependencies:** Phase 2, Phase 3
**Story Points:** 13 SP

### Files to Modify/Create
- `src/commands/feature-v3.ts` - Expand with new methods
- `src/utils/qa-executor.ts` - QA execution logic
- `src/utils/autopilot-loop.ts` - Autopilot orchestration

### Tasks

#### Task 4.1: Implement Feature State Detection
**Files:** `src/commands/feature-v3.ts`
**Tests:** `tests/commands/feature-v3.test.ts`
**Acceptance Criteria:**
- [ ] `detectState(feature)` - Detect current feature state
- [ ] Returns: 'new' | 'research' | 'plan' | 'implement' | 'qa' | 'completed'
- [ ] Check for feature_list.json existence
- [ ] Check for research.md, implementation-plan.md
- [ ] Check for pending tests in feature_list.json
**Story Points:** 2 SP

#### Task 4.2: Implement Research Phase
**Files:** `src/commands/feature-v3.ts`
**Tests:** `tests/commands/feature-v3.test.ts`
**Acceptance Criteria:**
- [ ] `executeResearch(feature)` - Execute research phase
- [ ] Load PRD as context
- [ ] Generate research prompt
- [ ] Execute via claude-v3
- [ ] Save research.md output
- [ ] Update core state with phase
**Story Points:** 2 SP

#### Task 4.3: Implement Plan Phase
**Files:** `src/commands/feature-v3.ts`
**Tests:** `tests/commands/feature-v3.test.ts`
**Acceptance Criteria:**
- [ ] `executePlan(feature)` - Execute planning phase
- [ ] Require research.md to exist
- [ ] Load research + PRD as context
- [ ] Generate planning prompt
- [ ] Execute via claude-v3
- [ ] Save implementation-plan.md output
- [ ] Generate feature_list.json from plan
**Story Points:** 2 SP

#### Task 4.4: Implement Single Task Execution
**Files:** `src/commands/feature-v3.ts`
**Tests:** `tests/commands/feature-v3.test.ts`
**Acceptance Criteria:**
- [ ] `executeTask(feature, testId)` - Execute single test/task
- [ ] Load memory context (tiers 1-3)
- [ ] Generate coding prompt for specific test
- [ ] Execute via claude-v3 with session tracking
- [ ] Update core state during execution
- [ ] Update feature_list.json test status
**Story Points:** 2 SP

#### Task 4.5: Implement QA Executor
**Files:** `src/utils/qa-executor.ts`
**Tests:** `tests/utils/qa-executor.test.ts`
**Acceptance Criteria:**
- [ ] `executeQA(feature, testId)` - QA single test
- [ ] `executeFullQA(feature)` - QA all tests
- [ ] Parse QA results (pass/fail with details)
- [ ] Return structured QAResult
- [ ] Support retry count tracking
**Story Points:** 2 SP

#### Task 4.6: Implement Interactive Feature Command
**Files:** `src/commands/feature-v3.ts`
**Tests:** `tests/commands/feature-v3.test.ts`
**Acceptance Criteria:**
- [ ] `feature(name, options)` - Main interactive command
- [ ] Auto-detect state and continue from there
- [ ] Manual validation between phases (inquirer prompt)
- [ ] Options: refine, continue, skip
- [ ] Progress display with ora spinners
- [ ] Proper error handling and exit
**Story Points:** 1 SP

#### Task 4.7: Implement Autopilot Loop
**Files:** `src/utils/autopilot-loop.ts`
**Tests:** `tests/utils/autopilot-loop.test.ts`
**Acceptance Criteria:**
- [ ] `executeAutopilot(feature, options)` - Main autopilot entry
- [ ] Layer 1: QA per task with 3x retry
- [ ] Layer 2: Final QA with 3x retry
- [ ] Auto-correction prompt generation
- [ ] Escalation to human on 3x failure
- [ ] Progress tracking and display
- [ ] Support for `--dry-run` preview
**Story Points:** 2 SP

### Phase 4 Checkpoint
- [ ] `adk3 feature test-feature` executes full interactive flow
- [ ] `adk3 feature autopilot test-feature` executes automatic flow
- [ ] QA detects and reports issues
- [ ] Auto-correction attempts up to 3 times
- [ ] Human escalation works properly
- [ ] All Phase 4 tests pass

---

## Phase 5: Quality Hooks

**Objective:** Implement hooks for context injection, validation, and checkpoints.

**Dependencies:** Phase 2, Phase 4
**Story Points:** 8 SP

### Files to Create
- `.claude/hooks/inject-memory.sh` - PreToolUse context injection
- `.claude/hooks/auto-checkpoint.sh` - Stop event checkpoint
- `.claude/hooks/validate-no-stub.sh` - Write validation
- `.claude/hooks/comprehension-check.sh` - PreToolUse verification

### Tasks

#### Task 5.1: Implement inject-memory.sh Hook
**Files:** `.claude/hooks/inject-memory.sh`
**Tests:** Manual verification + integration test
**Acceptance Criteria:**
- [ ] Trigger: PreToolUse (any tool)
- [ ] Read active-focus.md to get feature name
- [ ] Load and inject core-state.json
- [ ] Inject active constraints
- [ ] Inject anti-stub reminder
- [ ] Output as structured context block
**Story Points:** 2 SP

#### Task 5.2: Implement auto-checkpoint.sh Hook
**Files:** `.claude/hooks/auto-checkpoint.sh`
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] Trigger: Stop event
- [ ] Create checkpoint JSON with timestamp
- [ ] Save core state snapshot
- [ ] Save git status snapshot
- [ ] Create symlink to latest.json
- [ ] Directory: `.claude/plans/features/{name}/checkpoints/`
**Story Points:** 2 SP

#### Task 5.3: Implement validate-no-stub.sh Hook
**Files:** `.claude/hooks/validate-no-stub.sh`
**Tests:** `tests/hooks/validate-no-stub.test.ts`
**Acceptance Criteria:**
- [ ] Trigger: PreToolUse (Write)
- [ ] Check content for stub patterns
- [ ] Patterns: TODO, FIXME, NotImplementedError, throw.*Not implemented
- [ ] Block write and output helpful message
- [ ] Exit 1 on stub detection
**Story Points:** 2 SP

#### Task 5.4: Implement comprehension-check.sh Hook
**Files:** `.claude/hooks/comprehension-check.sh`
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] Trigger: PreToolUse (Write/Edit)
- [ ] Load core-state.json
- [ ] Output current task and modified files count
- [ ] Remind to read if context doesn't match
**Story Points:** 1 SP

#### Task 5.5: Update settings.json with v3 Hooks
**Files:** `.claude/settings.json`
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] Add inject-memory.sh to PreToolUse hooks
- [ ] Add auto-checkpoint.sh to Stop hooks
- [ ] Add validate-no-stub.sh to PreToolUse:Write hooks
- [ ] Add comprehension-check.sh to PreToolUse:Write hooks
- [ ] Document hook order dependencies
**Story Points:** 1 SP

### Phase 5 Checkpoint
- [ ] Memory injection works on every tool call
- [ ] Checkpoints created on session stop
- [ ] Stub detection blocks invalid writes
- [ ] Comprehension check reminds about context
- [ ] All Phase 5 tests pass

---

## Phase 6: Parallel Execution

**Objective:** Enhance parallel execution with shared state and proper isolation.

**Dependencies:** Phase 4
**Story Points:** 13 SP

### Files to Create/Modify
- `src/utils/parallel/shared-state.ts` - Tier 0 shared memory
- `src/utils/parallel/worktree-manager.ts` - Enhanced worktree handling
- `src/utils/parallel/aggregator.ts` - Result merge
- `src/utils/parallel/file-ownership.ts` - File locking

### Tasks

#### Task 6.1: Create Parallel Directory Structure
**Files:** `src/utils/parallel/index.ts`
**Tests:** N/A (structure task)
**Acceptance Criteria:**
- [ ] Create `src/utils/parallel/` directory
- [ ] Create index.ts with all exports
- [ ] Define parallel execution constants
**Story Points:** 1 SP

#### Task 6.2: Implement Shared State Manager (Tier 0)
**Files:** `src/utils/parallel/shared-state.ts`
**Tests:** `tests/utils/parallel/shared-state.test.ts`
**Acceptance Criteria:**
- [ ] Create `SharedState` interface matching spec
- [ ] `load(feature)` - Load shared-state.json
- [ ] `save(feature, state)` - Atomic save
- [ ] `registerAgent(feature, agentId)` - Register active agent
- [ ] `unregisterAgent(feature, agentId)` - Mark agent completed
- [ ] `addSharedDecision(feature, decision)` - Add cross-agent decision
- [ ] `addCompletedTask(feature, taskId)` - Mark task done
- [ ] `getFileOwnership(feature)` - Get current ownership map
**Story Points:** 3 SP

#### Task 6.3: Implement File Ownership Manager
**Files:** `src/utils/parallel/file-ownership.ts`
**Tests:** `tests/utils/parallel/file-ownership.test.ts`
**Acceptance Criteria:**
- [ ] `acquireLock(feature, agentId, file)` - Try to lock file
- [ ] `releaseLock(feature, agentId, file)` - Release lock
- [ ] `isLocked(feature, file)` - Check if file is locked
- [ ] `getOwner(feature, file)` - Get current owner
- [ ] Timeout-based lock expiration (30 min)
**Story Points:** 2 SP

#### Task 6.4: Enhance Worktree Manager
**Files:** `src/utils/parallel/worktree-manager.ts`
**Tests:** `tests/utils/parallel/worktree-manager.test.ts`
**Acceptance Criteria:**
- [ ] `createWorktree(feature, agentId)` - Create isolated worktree
- [ ] `setupMemorySymlinks(worktree)` - Symlink .claude to main
- [ ] `syncSharedState(worktree)` - Copy shared-state to worktree
- [ ] `cleanupWorktree(worktree)` - Remove after completion
- [ ] Support for N concurrent worktrees
**Story Points:** 3 SP

#### Task 6.5: Implement Result Aggregator
**Files:** `src/utils/parallel/aggregator.ts`
**Tests:** `tests/utils/parallel/aggregator.test.ts`
**Acceptance Criteria:**
- [ ] `aggregateResults(feature, results)` - Merge agent results
- [ ] Merge session notes into unified timeline
- [ ] Merge decisions from all agents
- [ ] Detect and flag conflicts
- [ ] Calculate aggregate metrics
- [ ] Two-step merge: structure-first + auto-dedupe
**Story Points:** 2 SP

#### Task 6.6: Integrate Parallel with Autopilot
**Files:** `src/utils/autopilot-loop.ts`
**Tests:** `tests/utils/autopilot-loop.test.ts`
**Acceptance Criteria:**
- [ ] Add `--parallel` flag support
- [ ] Add `--agents <n>` flag support (default 2, max 4)
- [ ] Create wave schedule before execution
- [ ] Execute wave with multiple agents
- [ ] Aggregate results after each wave
- [ ] Handle agent failures gracefully
**Story Points:** 2 SP

### Phase 6 Checkpoint
- [ ] Shared state synchronizes between agents
- [ ] File ownership prevents conflicts
- [ ] Worktrees create and cleanup properly
- [ ] Results aggregate without data loss
- [ ] `adk3 feature autopilot test --parallel --agents 2` works
- [ ] All Phase 6 tests pass

---

## Phase 7: Semantic Indexing

**Objective:** Implement codebase indexing for fast context retrieval.

**Dependencies:** Phase 4
**Story Points:** 10 SP

### Files to Create
- `src/utils/indexer/parser.ts` - AST parsing
- `src/utils/indexer/embedder.ts` - Embedding generation
- `src/utils/indexer/searcher.ts` - Query engine
- `src/utils/indexer/storage.ts` - SQLite storage

### Tasks

#### Task 7.1: Create Indexer Directory Structure
**Files:** `src/utils/indexer/index.ts`
**Tests:** N/A (structure task)
**Acceptance Criteria:**
- [ ] Create `src/utils/indexer/` directory
- [ ] Create index.ts with all exports
- [ ] Define index schema constants
- [ ] Add better-sqlite3 dependency
**Story Points:** 1 SP

#### Task 7.2: Implement Symbol Parser
**Files:** `src/utils/indexer/parser.ts`
**Tests:** `tests/utils/indexer/parser.test.ts`
**Acceptance Criteria:**
- [ ] `parseFile(file)` - Parse TypeScript/JavaScript file
- [ ] Extract functions, classes, interfaces
- [ ] Extract imports and exports
- [ ] Extract docstrings and comments
- [ ] Calculate complexity score
- [ ] Return `Symbol[]` array
**Story Points:** 3 SP

#### Task 7.3: Implement Index Storage
**Files:** `src/utils/indexer/storage.ts`
**Tests:** `tests/utils/indexer/storage.test.ts`
**Acceptance Criteria:**
- [ ] SQLite database at `.claude/index/embeddings.db`
- [ ] Table: symbols (name, type, file, line, signature, embedding)
- [ ] Table: dependencies (source, target, type)
- [ ] Table: metadata (last_indexed, file_count)
- [ ] CRUD operations for all tables
**Story Points:** 2 SP

#### Task 7.4: Implement Embedding Generator
**Files:** `src/utils/indexer/embedder.ts`
**Tests:** `tests/utils/indexer/embedder.test.ts`
**Acceptance Criteria:**
- [ ] Use local transformers.js for embeddings
- [ ] `generateEmbedding(text)` - Generate vector
- [ ] `batchGenerate(texts)` - Batch processing
- [ ] Cache embeddings in SQLite
- [ ] Incremental update on file change
**Story Points:** 2 SP

#### Task 7.5: Implement Search Engine
**Files:** `src/utils/indexer/searcher.ts`
**Tests:** `tests/utils/indexer/searcher.test.ts`
**Acceptance Criteria:**
- [ ] `search(query, limit)` - Semantic search
- [ ] `findRelated(file)` - Find related files
- [ ] `getContext(taskDescription)` - Get context for task
- [ ] Rank by importance score
- [ ] Filter by file type
**Story Points:** 2 SP

### Phase 7 Checkpoint
- [ ] `adk index` creates index database
- [ ] `adk search "query"` returns relevant files
- [ ] `adk context "task"` suggests files for task
- [ ] Incremental indexing works on file change
- [ ] All Phase 7 tests pass

---

## Phase 8: Auto Memories

**Objective:** Implement automatic capture and injection of project knowledge.

**Dependencies:** Phase 4
**Story Points:** 8 SP

### Files to Create
- `src/utils/memories/detector.ts` - Pattern detection
- `src/utils/memories/storage.ts` - Memory persistence
- `src/utils/memories/injector.ts` - Context injection

### Tasks

#### Task 8.1: Create Memories Directory Structure
**Files:** `src/utils/memories/index.ts`
**Tests:** N/A (structure task)
**Acceptance Criteria:**
- [ ] Create `src/utils/memories/` directory
- [ ] Create index.ts with all exports
- [ ] Define memory types and schemas
**Story Points:** 1 SP

#### Task 8.2: Implement Memory Storage
**Files:** `src/utils/memories/storage.ts`
**Tests:** `tests/utils/memories/storage.test.ts`
**Acceptance Criteria:**
- [ ] Store in `.claude/memories/`
- [ ] `save(memory)` - Save new memory
- [ ] `load()` - Load all memories
- [ ] `search(query)` - Search by relevance
- [ ] `prune(days)` - Remove unused memories
- [ ] Track usage count per memory
**Story Points:** 2 SP

#### Task 8.3: Implement Pattern Detector
**Files:** `src/utils/memories/detector.ts`
**Tests:** `tests/utils/memories/detector.test.ts`
**Acceptance Criteria:**
- [ ] `detectDecision(text)` - Detect "I chose X because Y"
- [ ] `detectPattern(text)` - Detect "This project uses X"
- [ ] `detectConstraint(text)` - Detect "Cannot use X"
- [ ] `detectErrorSolution(text)` - Detect error fix patterns
- [ ] Return structured Memory objects
**Story Points:** 2 SP

#### Task 8.4: Implement Memory Injector
**Files:** `src/utils/memories/injector.ts`
**Tests:** `tests/utils/memories/injector.test.ts`
**Acceptance Criteria:**
- [ ] `getRelevant(taskDescription)` - Get relevant memories
- [ ] `formatForInjection(memories)` - Format as context
- [ ] Filter by confidence (>0.7)
- [ ] Sort by usage count
- [ ] Limit to 5 memories per injection
**Story Points:** 2 SP

#### Task 8.5: Implement Memory Commands
**Files:** `src/cli-v3.ts`, `src/commands/memory-v3.ts`
**Tests:** `tests/commands/memory-v3.test.ts`
**Acceptance Criteria:**
- [ ] `adk memory list` - List all memories
- [ ] `adk memory add "..." --type decision` - Add manually
- [ ] `adk memory search "..."` - Search memories
- [ ] `adk memory export` - Export as JSON
- [ ] `adk memory prune --unused-days 30` - Clean old
**Story Points:** 1 SP

### Phase 8 Checkpoint
- [ ] Decisions auto-captured during sessions
- [ ] Patterns detected and stored
- [ ] Relevant memories injected into context
- [ ] Memory commands work
- [ ] All Phase 8 tests pass

---

## Phase 9: Visual UI

**Objective:** Implement rich terminal UI for progress visualization.

**Dependencies:** Phase 4, Phase 6
**Story Points:** 8 SP

### Files to Create
- `src/ui/dashboard.tsx` - Main Ink dashboard
- `src/ui/progress.tsx` - Progress bar component
- `src/ui/agent-panel.tsx` - Agent status display
- `src/ui/activity-log.tsx` - Recent activity

### Tasks

#### Task 9.1: Setup Ink and React for Terminal
**Files:** `package.json`, `tsconfig.json`
**Tests:** N/A (setup task)
**Acceptance Criteria:**
- [ ] Add `ink` and `react` dependencies
- [ ] Configure tsconfig for JSX
- [ ] Create `src/ui/` directory
- [ ] Verify basic Ink render works
**Story Points:** 1 SP

#### Task 9.2: Implement Progress Bar Component
**Files:** `src/ui/progress.tsx`
**Tests:** `tests/ui/progress.test.tsx`
**Acceptance Criteria:**
- [ ] Display progress bar with percentage
- [ ] Show completed/total counts
- [ ] Support different colors for states
- [ ] Animate on updates
**Story Points:** 1 SP

#### Task 9.3: Implement Agent Panel Component
**Files:** `src/ui/agent-panel.tsx`
**Tests:** `tests/ui/agent-panel.test.tsx`
**Acceptance Criteria:**
- [ ] List active agents with status
- [ ] Show current task per agent
- [ ] Show individual progress per agent
- [ ] Support up to 4 agents
**Story Points:** 2 SP

#### Task 9.4: Implement Activity Log Component
**Files:** `src/ui/activity-log.tsx`
**Tests:** `tests/ui/activity-log.test.tsx`
**Acceptance Criteria:**
- [ ] Display recent activity entries
- [ ] Show timestamp, action, result
- [ ] Scrollable with max 10 entries
- [ ] Color-coded by type (modify, create, decision)
**Story Points:** 1 SP

#### Task 9.5: Implement Main Dashboard
**Files:** `src/ui/dashboard.tsx`
**Tests:** `tests/ui/dashboard.test.tsx`
**Acceptance Criteria:**
- [ ] Compose all components into dashboard
- [ ] Show feature name and time
- [ ] Overall progress bar
- [ ] Agent panel (when parallel)
- [ ] Current task details
- [ ] Activity log
- [ ] Footer with keyboard shortcuts
**Story Points:** 2 SP

#### Task 9.6: Implement Keyboard Shortcuts
**Files:** `src/ui/dashboard.tsx`
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] [p] pause execution
- [ ] [r] resume execution
- [ ] [l] toggle logs view
- [ ] [d] show details
- [ ] [q] quit with confirmation
**Story Points:** 1 SP

### Phase 9 Checkpoint
- [ ] `adk3 feature autopilot test --ui` shows dashboard
- [ ] Progress updates in real-time
- [ ] Keyboard shortcuts work
- [ ] Multi-agent view works with parallel
- [ ] All Phase 9 tests pass

---

## Phase 10: Integration & Testing

**Objective:** Full integration testing and documentation.

**Dependencies:** All previous phases
**Story Points:** 8 SP

### Tasks

#### Task 10.1: Create E2E Test Suite
**Files:** `tests/e2e/v3-full-cycle.test.ts`
**Tests:** E2E test
**Acceptance Criteria:**
- [ ] Test: New feature creation flow
- [ ] Test: Interactive mode with phase validation
- [ ] Test: Autopilot mode with QA
- [ ] Test: Session resume after interruption
- [ ] Test: Parallel execution with 2 agents
- [ ] All tests pass in CI environment
**Story Points:** 3 SP

#### Task 10.2: Create Migration Guide
**Files:** `.claude/docs/v3-migration-guide.md`
**Tests:** N/A (documentation)
**Acceptance Criteria:**
- [ ] Document v2 to v3 migration steps
- [ ] Document coexistence strategy
- [ ] Document breaking changes (none expected)
- [ ] Include troubleshooting section
**Story Points:** 1 SP

#### Task 10.3: Update Main Documentation
**Files:** `README.md`, `CLAUDE.md`
**Tests:** N/A (documentation)
**Acceptance Criteria:**
- [ ] Add v3 quick start section
- [ ] Document new commands
- [ ] Document new flags
- [ ] Update architecture diagrams
**Story Points:** 1 SP

#### Task 10.4: Performance Testing
**Files:** `tests/performance/v3-benchmark.test.ts`
**Tests:** Performance test
**Acceptance Criteria:**
- [ ] Measure token usage per task
- [ ] Measure context loading time
- [ ] Measure compaction efficiency
- [ ] Compare with v2 baseline
- [ ] Document results
**Story Points:** 2 SP

#### Task 10.5: Final Release Checklist
**Files:** N/A (process)
**Tests:** Manual verification
**Acceptance Criteria:**
- [ ] All tests passing (unit, integration, e2e)
- [ ] Test coverage > 80%
- [ ] No console errors or warnings
- [ ] Documentation complete
- [ ] Git tag v3.0.0 created
- [ ] Merge to main branch
**Story Points:** 1 SP

### Phase 10 Checkpoint
- [ ] E2E tests pass
- [ ] Documentation complete
- [ ] Performance acceptable
- [ ] v3.0.0 released

---

## Test Strategy

### Unit Tests
- Each module has corresponding test file in `tests/`
- Use Jest with TypeScript
- Mock external dependencies (Claude CLI, file system)
- Target: 80% coverage

### Integration Tests
- Test module interactions
- Use real file system (temp directories)
- Test session persistence
- Test memory loading

### E2E Tests
- Full workflow tests
- Use mock Claude responses
- Test complete feature lifecycle
- Test error scenarios

### Manual Tests
- Hook verification
- TUI interaction
- Keyboard shortcuts
- Error messages

---

## Risk Mitigation

| Risk | Mitigation | Phase |
|------|------------|-------|
| Claude CLI flag changes | Early verification in Phase 1 | 1 |
| Memory system complexity | Incremental implementation | 2 |
| Stub generation continues | 5-layer guarantee system | 3, 5 |
| Parallel conflicts | File ownership + conflict detection | 6 |
| Performance degradation | Benchmark testing | 10 |
| v2 compatibility break | Separate entry points, no v2 changes | All |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Stub Rate | <5% |
| First-Pass QA Success | >70% |
| Context Drift | Minimal |
| Sessions per Feature | 1-3 |
| Test Coverage | >80% |
| Recovery Success | >95% |

---

## Dependencies Between Phases

```
Phase 1 (Infrastructure)
    │
    ▼
Phase 2 (Memory) ──────────────────────────────┐
    │                                          │
    ▼                                          │
Phase 3 (Agent Logic)                          │
    │                                          │
    ├───────────────────┐                      │
    ▼                   ▼                      ▼
Phase 4 (Commands) ◄─── Phase 5 (Hooks)       Phase 7 (Indexing)
    │                                          │
    │                                          │
    ├───────────────────┐                      │
    ▼                   ▼                      ▼
Phase 6 (Parallel)     Phase 8 (Memories) ◄───┘
    │                   │
    └───────┬───────────┘
            │
            ▼
      Phase 9 (UI)
            │
            ▼
     Phase 10 (Integration)
```

---

## Recommended Implementation Order

1. **Phase 1** - Foundation (required for everything)
2. **Phase 2** - Memory (critical for agent quality)
3. **Phase 3** - Agent Logic (uses memory)
4. **Phase 4** - Commands (uses agents)
5. **Phase 5** - Hooks (enhances quality)
6. **Phase 6** - Parallel (optional but valuable)
7. **Phase 7** - Indexing (optional enhancement)
8. **Phase 8** - Memories (optional enhancement)
9. **Phase 9** - UI (polish)
10. **Phase 10** - Integration (final)

**Minimum Viable v3:** Phases 1-5 (52 SP)
**Full v3:** All phases (89 SP)

---

*Implementation Plan generated: 2026-02-02*
*Ready for implementation - NÃO IMPLEMENTE AINDA*
