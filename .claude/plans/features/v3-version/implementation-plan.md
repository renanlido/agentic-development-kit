# Implementation Plan: v3-version

**Data:** 2026-02-02
**Status:** Ready for Implementation
**Complexidade:** Complexa
**Total de Tasks:** 18

---

## Executive Summary

This plan details the implementation of ADK v3, transforming the CLI from 7 fragmented commands to a unified "one command per domain" architecture with hierarchical memory, session persistence, and anti-stub enforcement.

**Key Objectives:**
- Unified `adk feature work <name>` command (replaces 7 separate commands)
- 4-tier memory hierarchy (Core State → Session → Feature → Project)
- Dual-agent system (Initializer + Coding agents)
- QA in two layers (per-task + final)
- Anti-stub protocols with enforcement hooks

---

## Phase 1: Core Infrastructure

### Goal
Establish the memory management foundation that enables context persistence across sessions.

### Overview
| Task | Effort | Dependencies | Files |
|------|--------|--------------|-------|
| 1.1 Core State Manager | G (4-8h) | none | `src/utils/memory/core-state.ts`, `src/types/memory-v3.ts` |
| 1.2 Session Notes Manager | M (2-4h) | none | `src/utils/memory/session-notes.ts` |
| 1.3 Decisions Manager | M (2-4h) | none | `src/utils/memory/decisions-manager.ts` |
| 1.4 Memory Directory Initializer | P (1-2h) | 1.1, 1.2, 1.3 | `src/utils/memory/initializer.ts` |

---

### Task 1.1: Implementar Core State Manager

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependencias:** nenhuma
**Prioridade:** CRITICAL - Foundation for all memory operations

#### Objetivo
Create the Tier 1 memory layer that maintains focus on "Where am I and what did I just do." This JSON file is ALWAYS present in every agent context.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/types/memory-v3.ts` with interfaces:
   - `CoreState` (main schema)
   - `TaskState` (current task info)
   - `Decision` (critical decision record)
   - `ModifiedFile` (file change record)
   - `Breadcrumb` (reference for re-fetch)

2. Create `src/utils/memory/core-state.ts` with class `CoreStateManager`:
   - `constructor(featureName: string)`
   - `async load(): Promise<CoreState>` - reads core-state.json or returns default
   - `async save(state: CoreState): Promise<void>` - atomic write (temp + move)
   - `async updateTask(task: Partial<TaskState>): Promise<void>`
   - `async addDecision(decision: Omit<Decision, 'timestamp'>): Promise<void>` - FIFO limit 5
   - `async addModifiedFile(file: ModifiedFile): Promise<void>` - FIFO limit 5
   - `async addBreadcrumb(breadcrumb: Breadcrumb): Promise<void>`
   - `async markTaskComplete(taskId: string): Promise<void>`
   - `async addBlocker(blocker: string): Promise<void>`
   - `getPath(): string` - returns path to core-state.json

3. Implement validation:
   - Feature name validation (no path traversal)
   - Schema validation on load
   - Graceful handling of corrupted files (return default)

**O que NAO FAZER:**
- Hooks de injecao (Task 4.2)
- Integracao com CLI (Fase 3)
- Compaction logic (Task 5.2)

#### Schema (core-state.json)

```json
{
  "$schema": "core-state-v1",
  "version": "1.0",
  "feature": "nome-da-feature",
  "updatedAt": "2026-02-02T11:30:00Z",
  "currentTask": {
    "id": "1.3",
    "name": "Implementar generateFixPrompt",
    "status": "in_progress",
    "startedAt": "2026-02-02T10:30:00Z",
    "files": ["src/commands/feature.ts"],
    "lines": "3273-3325"
  },
  "taskProgress": {
    "total": 5,
    "completed": 2,
    "inProgress": 1,
    "pending": 2,
    "completedIds": ["1.1", "1.2"]
  },
  "criticalDecisions": [],
  "modifiedFiles": [],
  "constraints": [
    "NAO criar stubs - implementar logica real",
    "NAO modificar codigo fora do escopo da task",
    "SEMPRE rodar type-check apos modificacoes"
  ],
  "breadcrumbs": [],
  "blockers": [],
  "nextSteps": []
}
```

#### Criterios de Aceite
- [ ] Arquivo `src/utils/memory/core-state.ts` existe e compila
- [ ] CoreStateManager.load() le core-state.json ou retorna default
- [ ] CoreStateManager.save() persiste atomicamente (temp file + move)
- [ ] CoreStateManager.updateTask() atualiza currentTask e status
- [ ] Limite de 5 decisoes criticas e respeitado (FIFO)
- [ ] Limite de 5 arquivos modificados recentes e respeitado
- [ ] Path traversal prevention works
- [ ] Testes passam com 100% de cobertura dos metodos publicos

#### Arquivos Envolvidos
- `src/types/memory-v3.ts` - criar
- `src/utils/memory/core-state.ts` - criar
- `tests/utils/memory/core-state.test.ts` - criar

#### Padroes a Seguir
- Atomic writes: Use temp file + fs.move (see `session-store.ts:33-48`)
- Path construction: Use `getBasePath()` pattern (see `state-manager.ts:403-412`)
- Validation: Use pattern from `session-store.ts:18-21`

---

### Task 1.2: Implementar Session Notes Manager

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** nenhuma
**Prioridade:** HIGH - Required for session context (Tier 2)

#### Objetivo
Create Tier 2 session context with structured markdown for session history recovery.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/memory/session-notes.ts` with class `SessionNotesManager`:
   - `constructor(featureName: string)`
   - `async initialize(objective: string): Promise<void>` - creates session-notes.md with template
   - `async addTimelineEntry(action: string, result: string, notes?: string): Promise<void>` - append only
   - `async addLearning(learning: string): Promise<void>`
   - `async markFileRead(filePath: string): Promise<void>`
   - `async addCommand(command: string, status: 'pass' | 'fail'): Promise<void>`
   - `async updateNextSession(items: string[]): Promise<void>`
   - `async getContent(): Promise<string>`
   - `getPath(): string`

2. Template format (session-notes.md):
   ```markdown
   # Session Notes: {feature-name}
   **Session ID:** sess-YYYY-MM-DD-NNN
   **Started:** YYYY-MM-DD HH:mm
   **Last Update:** YYYY-MM-DD HH:mm

   ## Objective
   [Objetivo claro e especifico da sessao]

   ## Progress Timeline
   | Time | Action | Result | Notes |
   |------|--------|--------|-------|

   ## Key Learnings This Session
   1.

   ## Files Read This Session
   - [ ]

   ## Commands Executed
   ```bash
   ```

   ## Questions/Blockers
   Nenhum no momento.

   ## Next Session Should
   1.
   ```

**O que NAO FAZER:**
- Archive automatico (sera feito no compactor)
- Integracao com checkpoint

#### Criterios de Aceite
- [ ] Arquivo `src/utils/memory/session-notes.ts` existe e compila
- [ ] SessionNotesManager.initialize() cria session-notes.md com template correto
- [ ] addTimelineEntry() adiciona entrada com timestamp na tabela markdown
- [ ] addLearning() adiciona item na secao Key Learnings
- [ ] markFileRead() atualiza checklist de Files Read
- [ ] Append-only pattern is followed (never overwrite timeline entries)
- [ ] Testes passam com cobertura dos metodos publicos

#### Arquivos Envolvidos
- `src/utils/memory/session-notes.ts` - criar
- `tests/utils/memory/session-notes.test.ts` - criar

---

### Task 1.3: Implementar Decisions Manager

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** nenhuma
**Prioridade:** HIGH - Required for decision tracking (Tier 2)

#### Objetivo
Create ADR-style decision log for architectural choices with auto-incrementing IDs.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/memory/decisions-manager.ts` with class `DecisionsManager`:
   - `constructor(featureName: string)`
   - `async addDecision(decision: DecisionInput): Promise<string>` - returns new ID
   - `async listDecisions(): Promise<Decision[]>` - returns all decisions
   - `async getDecision(id: string): Promise<Decision | null>`
   - `async getNextId(): Promise<string>` - returns "DEC-001", "DEC-002", etc.
   - `getPath(): string`

2. Decision format in decisions.md:
   ```markdown
   # Decision Log: {feature-name}

   ## DEC-001: [Title]
   **Date:** YYYY-MM-DD
   **Status:** Approved

   ### Context
   [Why this decision was needed]

   ### Options Considered
   1. **Option A** - Description
   2. **Option B** - Description

   ### Decision
   [What was decided]

   ### Rationale
   [Why this option was chosen]

   ### Consequences
   - Positivo:
   - Negativo:
   ```

3. Parsing existing decisions.md:
   - Parse headers to extract decision IDs
   - Handle malformed files gracefully

**O que NAO FAZER:**
- Sincronizacao com core-state (Task 1.1 ja guarda ultimas 5)
- Multi-agent shared decisions (Fase 2)

#### Criterios de Aceite
- [ ] Arquivo `src/utils/memory/decisions-manager.ts` existe e compila
- [ ] addDecision() cria entrada com ID auto-incrementado
- [ ] listDecisions() retorna todas as decisoes do arquivo
- [ ] getDecision(id) retorna decisao especifica
- [ ] Parse de decisions.md existente funciona corretamente
- [ ] Handles missing/malformed files gracefully
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/memory/decisions-manager.ts` - criar
- `tests/utils/memory/decisions-manager.test.ts` - criar

---

### Task 1.4: Implementar Memory Directory Initializer

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependencias:** Task 1.1, 1.2, 1.3
**Prioridade:** MEDIUM - Orchestrates memory structure creation

#### Objetivo
Create unified initializer that sets up complete memory directory structure for a feature.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/memory/initializer.ts` with function:
   ```typescript
   async function initializeMemoryStructure(
     featureName: string,
     options?: { force?: boolean }
   ): Promise<InitResult>
   ```

2. Create directories:
   - `.claude/plans/features/{name}/memory/`
   - `.claude/plans/features/{name}/memory/archive/`
   - `.claude/plans/features/{name}/checkpoints/`
   - `.claude/plans/features/{name}/sessions/`

3. Create initial files:
   - `memory/core-state.json` (using CoreStateManager default)
   - `memory/session-notes.md` (using SessionNotesManager template)
   - `memory/decisions.md` (empty template)
   - `memory/breadcrumbs.md` (reference template)

4. Return object with created paths:
   ```typescript
   interface InitResult {
     created: string[]
     skipped: string[]
     memoryPath: string
     checkpointsPath: string
   }
   ```

**O que NAO FAZER:**
- Migracao de features v2 (Task 4.3)
- Overwrite existing files unless force=true

#### Criterios de Aceite
- [ ] initializeMemoryStructure() cria diretorios memory/, checkpoints/, sessions/
- [ ] Arquivos iniciais sao criados com templates corretos
- [ ] Se diretorios/arquivos existem, nao sobrescreve (unless force=true)
- [ ] Retorna objeto com paths criados
- [ ] Integration with CoreStateManager, SessionNotesManager, DecisionsManager
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/memory/initializer.ts` - criar
- `tests/utils/memory/initializer.test.ts` - criar

---

## Phase 2: Prompt System

### Goal
Create the agent prompts that drive the dual-agent architecture.

### Overview
| Task | Effort | Dependencies | Files |
|------|--------|--------------|-------|
| 2.1 Feature List Generator | M (2-4h) | none | `src/utils/feature-list.ts`, `src/types/feature-list.ts` |
| 2.2 Initializer Agent Prompt | M (2-4h) | 2.1 | `src/utils/prompts/initializer-agent.ts` |
| 2.3 Coding Agent Prompt | M (2-4h) | 2.1 | `src/utils/prompts/coding-agent.ts` |
| 2.4 QA Agent Prompt | M (2-4h) | 2.1 | `src/utils/prompts/qa-agent.ts` |

---

### Task 2.1: Implementar Feature List Generator

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** nenhuma
**Prioridade:** CRITICAL - Core artifact for agent workflow

#### Objetivo
Create the FeatureList manager that handles the `feature_list.json` schema - the central artifact that guides Coding Agent through tasks.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/types/feature-list.ts` with interfaces:
   ```typescript
   interface FeatureList {
     feature: string
     version: "1.0.0"
     created: string
     updated: string
     tests: FeatureTest[]
     summary: Summary
   }

   interface FeatureTest {
     id: string
     description: string
     category: "functional" | "ui" | "integration" | "api" | "performance"
     steps: string[]
     status: "pending" | "passing" | "failing"
     files?: string[]
     lastTested?: string
     evidence?: string
   }

   interface Summary {
     total: number
     passing: number
     failing: number
     pending: number
   }
   ```

2. Create `src/utils/feature-list.ts` with class `FeatureListManager`:
   - `constructor(featureName: string)`
   - `async create(tests: FeatureTest[]): Promise<FeatureList>`
   - `async load(): Promise<FeatureList | null>`
   - `async save(list: FeatureList): Promise<void>`
   - `async updateTestStatus(testId: string, status: FeatureTest['status'], evidence?: string): Promise<void>`
   - `async getSummary(): Promise<Summary>`
   - `async getNextPendingTest(): Promise<FeatureTest | null>`
   - `async isComplete(): Promise<boolean>`
   - `getPath(): string`

3. Validation:
   - Validate schema on load
   - Auto-update `updated` timestamp on save
   - Auto-recalculate summary on status update

**O que NAO FAZER:**
- Geracao automatica de testes a partir do PRD (sera feito pelo agente)
- Conversao de tasks.md (Task 4.3)

#### Criterios de Aceite
- [ ] Arquivo `src/utils/feature-list.ts` existe e compila
- [ ] create() gera feature_list.json com estrutura correta
- [ ] load() le e valida feature_list.json existente
- [ ] updateTestStatus() atualiza status e recalcula summary
- [ ] getSummary() retorna { total, passing, failing, pending }
- [ ] getNextPendingTest() returns first pending test
- [ ] isComplete() returns true when all tests passing
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/types/feature-list.ts` - criar
- `src/utils/feature-list.ts` - criar
- `tests/utils/feature-list.test.ts` - criar

---

### Task 2.2: Implementar Initializer Agent Prompt

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 2.1
**Prioridade:** HIGH - First-run agent

#### Objetivo
Create the prompt template for the Initializer Agent that runs on first feature execution.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/prompts/initializer-agent.ts` with:
   ```typescript
   interface InitializerContext {
     featureName: string
     prdContent: string
     researchContent?: string
     projectStack: string
     existingPatterns: string[]
   }

   function generateInitializerPrompt(context: InitializerContext): string
   ```

2. Prompt must include:
   - **Mission**: Create structure, feature_list.json, init.sh, initial commit
   - **Anti-stub constraints**: Complete implementations only
   - **Instructions to read**: PRD and research.md
   - **Output format**: JSON artifacts with specific schema
   - **Success criteria**: All files created, committed

3. Prompt sections:
   ```
   ## MISSION
   You are an architect setting up a new feature...

   ## CONTEXT
   [PRD content, research if available]

   ## CONSTRAINTS (MANDATORY)
   - NO stubs or placeholder code
   - Read ALL context before acting
   - Create COMPLETE feature_list.json

   ## TASKS
   1. Read PRD thoroughly
   2. Create feature_list.json with all acceptance criteria as tests
   3. Create init.sh for environment setup
   4. Create initial commit

   ## OUTPUT FORMAT
   [Structured output expectations]
   ```

**O que NAO FAZER:**
- Execucao do prompt (Task 3.1)
- Integration with claude-v3.ts

#### Criterios de Aceite
- [ ] Arquivo `src/utils/prompts/initializer-agent.ts` existe e compila
- [ ] generateInitializerPrompt() retorna string com prompt completo
- [ ] Prompt inclui missao clara: criar estrutura, feature_list.json, init.sh, commit
- [ ] Prompt inclui constraints anti-stub
- [ ] Prompt referencia PRD e research.md
- [ ] Prompt has clear output format expectations
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/prompts/initializer-agent.ts` - criar
- `tests/utils/prompts/initializer-agent.test.ts` - criar

---

### Task 2.3: Implementar Coding Agent Prompt

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 2.1
**Prioridade:** HIGH - Main implementation agent

#### Objetivo
Create the prompt template for the Coding Agent that handles ongoing implementation.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/prompts/coding-agent.ts` with:
   ```typescript
   interface CodingContext {
     featureName: string
     coreState: CoreState
     featureList: FeatureList
     sessionNotes?: string
     recentDecisions?: Decision[]
   }

   function generateCodingAgentPrompt(context: CodingContext): string
   ```

2. Prompt must include:
   - **Mission**: Continue implementation from where left off
   - **Current state injection**: Core state, current task
   - **Implementation loop**: Select task → Implement → Test → Update → Commit
   - **Anti-stub constraints**: Complete implementations only
   - **TDD enforcement**: Write test first, then implementation

3. Prompt sections:
   ```
   ## CURRENT STATE (INJECTED)
   [Core state JSON]

   ## MISSION
   You are a senior developer continuing implementation...

   ## CONSTRAINTS (MANDATORY)
   - NO stubs
   - Read before write
   - One file, one step
   - TDD required

   ## IMPLEMENTATION LOOP
   1. Read feature_list.json
   2. Select next pending test
   3. Implement with TDD
   4. Run verification (type-check, tests, lint)
   5. Update feature_list.json status
   6. Commit changes
   7. REPEAT until 100% passing

   ## WHEN BLOCKED
   - STOP and explain blocker
   - DO NOT create stubs
   ```

**O que NAO FAZER:**
- QA integrado (Task 3.4)
- Claude execution

#### Criterios de Aceite
- [ ] Arquivo `src/utils/prompts/coding-agent.ts` existe e compila
- [ ] generateCodingAgentPrompt() retorna string com prompt completo
- [ ] Prompt inclui loop de implementacao
- [ ] Prompt inclui constraints anti-stub
- [ ] Prompt injeta core-state atual
- [ ] Has clear TDD instructions
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/prompts/coding-agent.ts` - criar
- `tests/utils/prompts/coding-agent.test.ts` - criar

---

### Task 2.4: Implementar QA Agent Prompt

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 2.1
**Prioridade:** HIGH - Quality assurance layer

#### Objetivo
Create the QA Agent prompt for task-level and feature-level quality validation.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/prompts/qa-agent.ts` with:
   ```typescript
   type QAMode = 'task' | 'feature'

   interface QAContext {
     featureName: string
     mode: QAMode
     taskId?: string
     featureList: FeatureList
     modifiedFiles: string[]
   }

   interface QAIssue {
     type: 'stub' | 'test' | 'type' | 'lint' | 'logic'
     severity: 'high' | 'medium' | 'low'
     file: string
     line?: number
     description: string
     suggestion?: string
   }

   function generateQAPrompt(context: QAContext): string
   ```

2. Prompt must include:
   - **Verification checklist**:
     - [ ] No stub patterns (throw new Error, TODO, FIXME)
     - [ ] Type-check passes
     - [ ] Tests pass
     - [ ] Lint passes
     - [ ] Logic is complete (not partial)
   - **Output format**: Structured QA result
   - **Mode handling**: Task (single task) vs Feature (all tasks)

3. QA Result format:
   ```json
   {
     "status": "pass" | "fail",
     "issues": [QAIssue],
     "summary": {
       "total": 0,
       "high": 0,
       "medium": 0,
       "low": 0
     }
   }
   ```

**O que NAO FAZER:**
- Auto-correcao (Task 3.4)
- Execution of QA checks

#### Criterios de Aceite
- [ ] Arquivo `src/utils/prompts/qa-agent.ts` existe e compila
- [ ] generateQAPrompt() retorna prompt para QA task ou feature
- [ ] Prompt inclui checklist de verificacao
- [ ] Prompt define formato de output estruturado
- [ ] Handles both 'task' and 'feature' modes
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/prompts/qa-agent.ts` - criar
- `tests/utils/prompts/qa-agent.test.ts` - criar

---

## Phase 3: Feature Commands v3

### Goal
Implement the unified command interface that replaces 7 separate commands.

### Overview
| Task | Effort | Dependencies | Files |
|------|--------|--------------|-------|
| 3.1 `adk3 feature work` | G (4-8h) | 1.4, 2.1, 2.2, 2.3 | `src/commands/feature-v3.ts`, `src/cli-v3.ts` |
| 3.2 Memory Commands | M (2-4h) | 1.1-1.4 | `src/commands/memory.ts` |
| 3.3 `adk3 feature autopilot` | G (4-8h) | 3.1 | `src/commands/feature-v3.ts` |
| 3.4 QA Two-Layer System | G (4-8h) | 2.4, 3.3 | `src/utils/qa-runner.ts` |

---

### Task 3.1: Implementar Comando `adk3 feature work`

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependencias:** Task 1.4, 2.1, 2.2, 2.3
**Prioridade:** CRITICAL - Core unified command

#### Objetivo
Implement the unified `feature work` command that automatically detects state and continues appropriately.

#### Escopo Detalhado

**O que FAZER:**
1. Expand `src/commands/feature-v3.ts` with method:
   ```typescript
   async work(name: string, options?: WorkOptions): Promise<void>
   ```

2. State detection flow:
   ```
   1. Check if feature exists
   2. Check if feature_list.json exists
      - NO → Run Initializer Agent
      - YES → Check for resumable session
        - YES → Resume with Coding Agent (--resume)
        - NO → Start new Coding Agent session
   ```

3. Integration points:
   - Use `SessionStore` for session tracking
   - Use `CoreStateManager` for context loading
   - Use `claude-v3.ts` for Claude execution
   - Use prompts from Phase 2

4. User interaction between phases:
   - Research → Plan: Confirm before proceeding
   - Plan → Implement: Confirm before proceeding
   - Within Implement: Automatic loop

5. Progress display:
   - Use ora spinners for status
   - Show current task being worked on
   - Display summary on completion

**O que NAO FAZER:**
- Modo autopilot (Task 3.3)
- QA automatico (Task 3.4)

#### Criterios de Aceite
- [ ] `adk3 feature work <name>` funciona para nova feature
- [ ] `adk3 feature work <name>` retoma feature existente
- [ ] Session ID e persistido e reutilizado com --resume
- [ ] Core-state e carregado e injetado
- [ ] Usuario e perguntado entre fases (Research→Plan, Plan→Implement)
- [ ] Proper error handling with helpful messages
- [ ] Testes de integracao passam

#### Arquivos Envolvidos
- `src/commands/feature-v3.ts` - modificar
- `src/cli-v3.ts` - modificar (adicionar comando work)
- `tests/commands/feature-v3.test.ts` - criar/modificar

---

### Task 3.2: Implementar Comandos de Memoria

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 1.1, 1.2, 1.3, 1.4
**Prioridade:** MEDIUM - Memory debugging and management

#### Objetivo
Create memory management commands for debugging and manual operations.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/commands/memory.ts` with class `MemoryCommand`:
   ```typescript
   class MemoryCommand {
     async status(feature: string): Promise<void>
     async checkpoint(feature: string): Promise<void>
     async compact(feature: string, options?: CompactOptions): Promise<void>
     async restore(feature: string, id?: string): Promise<void>
   }
   ```

2. Subcommands:

   **status** - Display memory health dashboard:
   ```
   Memory Status: my-feature
   ─────────────────────────
   Core State: Fresh (2min ago)
   Current Task: 1.3 - Implementing X
   Progress: 3/5 tasks (60%)

   Session: Active (45min)
   Decisions: 4 documented
   Checkpoints: 3 available

   Token Usage: ~45K (~35%)
   ```

   **checkpoint** - Create manual checkpoint:
   - Save current core-state, session-notes, git status
   - Store in checkpoints/ with timestamp

   **compact** - Trigger context compaction:
   - Use existing context-compactor.ts
   - Create COMPACTED_STATE.md

   **restore** - Restore from checkpoint:
   - List available checkpoints if no ID
   - Restore core-state and session context

3. Register in cli-v3.ts:
   ```typescript
   program
     .command('memory')
     .description('Manage feature memory')
     .addCommand(...)
   ```

**O que NAO FAZER:**
- Compaction avancada (usar context-compactor.ts existente)
- Automatic compaction triggers

#### Criterios de Aceite
- [ ] `adk3 memory status <feature>` exibe dashboard de memoria
- [ ] `adk3 memory checkpoint <feature>` cria checkpoint
- [ ] `adk3 memory compact <feature>` compacta sessao
- [ ] `adk3 memory restore <feature> [id]` restaura checkpoint
- [ ] Lists checkpoints when no ID provided
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/commands/memory.ts` - criar
- `src/cli-v3.ts` - modificar
- `tests/commands/memory.test.ts` - criar

---

### Task 3.3: Implementar Comando `adk3 feature autopilot`

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependencias:** Task 3.1
**Prioridade:** HIGH - Autonomous execution mode

#### Objetivo
Implement fully automatic feature implementation with QA per task and escalation.

#### Escopo Detalhado

**O que FAZER:**
1. Add method to `src/commands/feature-v3.ts`:
   ```typescript
   async autopilot(name: string, options?: AutopilotOptions): Promise<void>
   ```

2. Autopilot flow:
   ```
   1. Run Research phase
   2. PAUSE - Ask user: "Research complete. Continue to Plan?"
   3. Run Plan phase
   4. PAUSE - Ask user: "Plan complete. Continue to Implement?"
   5. Run Implementation loop (AUTOMATIC):
      For each task:
        a. Implement task
        b. Run QA on task
        c. If failed: Auto-correct (max 3x)
        d. If still failed: ESCALATE to human
   6. Run Final QA
   7. If failed: Auto-correct (max 3x)
   8. If still failed: ESCALATE to human
   ```

3. Escalation handling:
   - Preserve context in core-state
   - Clear error message with what failed
   - Suggestion for manual intervention
   - Option to resume after fix

4. Loop detection:
   - Same error appearing 2x
   - Same correction applied 3x
   - 5 iterations without progress
   - Token usage increasing without progress

5. Progress tracking:
   - Update core-state after each task
   - Log to session-notes
   - Display real-time progress

**O que NAO FAZER:**
- Multi-agent paralelo (Fase 2 do projeto completo)
- Visual TUI (future enhancement)

#### Criterios de Aceite
- [ ] `adk3 feature autopilot <name>` executa loop automatico
- [ ] Validacao manual ocorre entre fases (Research→Plan, Plan→Implement)
- [ ] QA runs after each task
- [ ] Auto-correction attempts up to 3 times
- [ ] Loop para apos 3 falhas consecutivas
- [ ] Deteccao de loops infinitos funciona
- [ ] Usuario e notificado para intervencao
- [ ] Can resume after manual intervention
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/commands/feature-v3.ts` - modificar
- `src/cli-v3.ts` - modificar
- `tests/commands/feature-v3.test.ts` - modificar

---

### Task 3.4: Implementar QA em Duas Camadas

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependencias:** Task 2.4, 3.3
**Prioridade:** HIGH - Quality enforcement

#### Objetivo
Create the QA runner that executes QA prompts and handles auto-correction.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/qa-runner.ts` with class `QARunner`:
   ```typescript
   interface QAResult {
     passed: boolean
     issues: QAIssue[]
     attempts: number
     correctionsMade: string[]
   }

   class QARunner {
     constructor(featureName: string)

     async runTaskQA(taskId: string): Promise<QAResult>
     async runFeatureQA(): Promise<QAResult>
     async attemptAutoCorrection(issues: QAIssue[]): Promise<boolean>
   }
   ```

2. Task QA flow:
   ```
   1. Generate QA prompt for task
   2. Execute QA agent
   3. Parse structured result
   4. If issues found:
      a. Generate fix prompt based on issues
      b. Execute fix
      c. Re-run QA
      d. Repeat up to 3 times
   5. Return result
   ```

3. Feature QA flow:
   ```
   1. Generate QA prompt for entire feature
   2. Execute comprehensive checks:
      - All tests passing
      - Type-check clean
      - Lint clean
      - No stub patterns
   3. Handle failures same as task QA
   ```

4. Auto-correction:
   - Generate specific fix prompt based on issue
   - Target specific files/lines
   - Re-verify after each fix

**O que NAO FAZER:**
- Classificacao de severidade complexa (simplificar para pass/fail)
- Visual reporting (just return structured data)

#### Criterios de Aceite
- [ ] QARunner.runTaskQA() executa QA apos task
- [ ] QARunner.runFeatureQA() executa QA final
- [ ] Auto-correcao tenta ate 3 vezes
- [ ] Resultado retorna { passed, issues, attempts, correctionsMade }
- [ ] Integracao com autopilot funciona
- [ ] Fix prompts are specific and actionable
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/qa-runner.ts` - criar
- `src/commands/feature-v3.ts` - modificar (integrate QARunner)
- `tests/utils/qa-runner.test.ts` - criar

---

## Phase 4: Hooks e Anti-Stub

### Goal
Enforce quality through hooks that prevent stub code and ensure context reading.

### Overview
| Task | Effort | Dependencies | Files |
|------|--------|--------------|-------|
| 4.1 Hook validate-no-stub | P (1-2h) | none | `.claude/hooks/validate-no-stub.sh` |
| 4.2 Hook comprehension-check | P (1-2h) | 1.1 | `.claude/hooks/comprehension-check.sh` |
| 4.3 Migracao v2 → v3 | M (2-4h) | 1.4, 2.1 | `src/utils/migration-v3.ts` |

---

### Task 4.1: Implementar Hook validate-no-stub

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependencias:** nenhuma
**Prioridade:** HIGH - Anti-stub enforcement

#### Objetivo
Create hook that blocks Write operations containing stub patterns.

#### Escopo Detalhado

**O que FAZER:**
1. Create `.claude/hooks/validate-no-stub.sh`:
   ```bash
   #!/bin/bash
   # Hook: PreToolUse (Write)
   # Blocks stub patterns in code being written

   STUB_PATTERNS=(
     "throw new Error.*Not implemented"
     "throw new Error.*TODO"
     "TODO:"
     "FIXME:"
     "// stub"
     "/* stub */"
     "pass  # stub"
     "pass # TODO"
     "NotImplementedError"
     "raise NotImplementedError"
   )

   # Read content from stdin or file
   CONTENT=$(cat "$1" 2>/dev/null || cat)

   for pattern in "${STUB_PATTERNS[@]}"; do
     if echo "$CONTENT" | grep -qE "$pattern"; then
       echo "BLOCKED: Stub pattern detected"
       echo "Pattern: $pattern"
       echo ""
       echo "You MUST implement real logic."
       echo "If you cannot implement, STOP and explain the blocker."
       exit 1
     fi
   done

   exit 0
   ```

2. Make executable: `chmod +x`

3. Register in `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "tool": "Write",
           "command": "./.claude/hooks/validate-no-stub.sh"
         }
       ]
     }
   }
   ```

**O que NAO FAZER:**
- Validacao de outros tipos de codigo (apenas stubs)
- Complex pattern matching

#### Criterios de Aceite
- [ ] Hook `.claude/hooks/validate-no-stub.sh` existe e e executavel
- [ ] Detecta todos os patterns de stub listados
- [ ] Retorna exit code 1 para bloquear
- [ ] Mensagem de erro e clara e util
- [ ] Hook registrado em settings.json
- [ ] Works with both TypeScript and Python patterns

#### Arquivos Envolvidos
- `.claude/hooks/validate-no-stub.sh` - criar
- `.claude/settings.json` - modificar

---

### Task 4.2: Implementar Hook comprehension-check

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependencias:** Task 1.1
**Prioridade:** MEDIUM - Context reminder

#### Objetivo
Create hook that reminds about current task and constraints before writes.

#### Escopo Detalhado

**O que FAZER:**
1. Create `.claude/hooks/comprehension-check.sh`:
   ```bash
   #!/bin/bash
   # Hook: PreToolUse (Write)
   # Reminds about context without blocking

   FOCUS_FILE=".claude/active-focus.md"
   if [ ! -f "$FOCUS_FILE" ]; then
     exit 0
   fi

   FEATURE=$(grep "feature:" "$FOCUS_FILE" | cut -d' ' -f2)
   if [ -z "$FEATURE" ]; then
     exit 0
   fi

   CORE_STATE=".claude/plans/features/$FEATURE/memory/core-state.json"

   if [ ! -f "$CORE_STATE" ]; then
     exit 0
   fi

   CURRENT_TASK=$(jq -r '.currentTask.id // "none"' "$CORE_STATE" 2>/dev/null)
   TASK_NAME=$(jq -r '.currentTask.name // "none"' "$CORE_STATE" 2>/dev/null)

   echo "## CONTEXT REMINDER"
   echo ""
   echo "Current Task: $CURRENT_TASK - $TASK_NAME"
   echo ""
   echo "Constraints:"
   echo "- NO stubs - implement real logic"
   echo "- NO code outside task scope"
   echo "- ALWAYS verify with type-check"
   echo ""

   # Always exit 0 - reminder only, no blocking
   exit 0
   ```

2. Make executable

3. Register in settings.json as additional PreToolUse hook

**O que NAO FAZER:**
- Bloquear operacoes (apenas reminder)
- Complex state parsing

#### Criterios de Aceite
- [ ] Hook `.claude/hooks/comprehension-check.sh` existe e e executavel
- [ ] Emite reminder com task atual e constraints
- [ ] Retorna exit code 0 (nao bloqueia)
- [ ] Hook registrado em settings.json
- [ ] Gracefully handles missing files

#### Arquivos Envolvidos
- `.claude/hooks/comprehension-check.sh` - criar
- `.claude/settings.json` - modificar

---

### Task 4.3: Implementar Migracao v2 → v3

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 1.4, 2.1
**Prioridade:** MEDIUM - Backwards compatibility

#### Objetivo
Enable v3 commands to work with existing v2 features by migrating artifacts.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/migration-v3.ts`:
   ```typescript
   interface MigrationResult {
     success: boolean
     migratedArtifacts: string[]
     errors: string[]
     rollbackPath?: string
   }

   async function migrateFeatureToV3(featureName: string): Promise<MigrationResult>
   async function canMigrate(featureName: string): Promise<boolean>
   async function rollbackMigration(featureName: string): Promise<boolean>
   ```

2. Migration flow:
   ```
   1. Detect v2 feature:
      - Has tasks.md
      - No feature_list.json
      - Has prd.md or progress.md

   2. Create backup:
      - Save snapshot in .snapshots/pre-v3-migration/

   3. Convert artifacts:
      - Parse tasks.md
      - Generate feature_list.json from tasks
      - Preserve task status (completed → passing)

   4. Create memory structure:
      - Initialize memory/ directory
      - Create initial core-state.json

   5. Preserve v2 artifacts:
      - Keep prd.md, research.md, progress.md
      - Keep state.json (add v3 fields)
   ```

3. Task to FeatureTest conversion:
   ```typescript
   function convertTask(task: V2Task): FeatureTest {
     return {
       id: `test-${task.id}`,
       description: task.name,
       category: inferCategory(task),
       steps: task.acceptanceCriteria || [task.name],
       status: task.completed ? 'passing' : 'pending',
       files: task.files || []
     }
   }
   ```

4. Rollback:
   - Restore from .snapshots/
   - Remove v3 artifacts

**O que NAO FAZER:**
- Migracao de sessions existentes
- Automatic migration (user must trigger)

#### Criterios de Aceite
- [ ] migrateFeatureToV3() detecta feature v2 corretamente
- [ ] Converte tasks.md para feature_list.json com status preservado
- [ ] Cria estrutura memory/ com arquivos iniciais
- [ ] Preserva todos os artefatos v2
- [ ] Creates backup before migration
- [ ] Rollback funciona se migracao falhar
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/migration-v3.ts` - criar
- `tests/utils/migration-v3.test.ts` - criar

---

## Phase 5: Integracao e CLI

### Goal
Complete the CLI integration and ensure all components work together.

### Overview
| Task | Effort | Dependencies | Files |
|------|--------|--------------|-------|
| 5.1 Expand CLI v3 | M (2-4h) | 3.1-3.3 | `src/cli-v3.ts` |
| 5.2 Compaction v3 | M (2-4h) | 1.1, 1.2 | `src/utils/memory/compactor-v3.ts` |
| 5.3 Init Script Generator | P (1-2h) | none | `src/utils/init-script.ts` |
| 5.4 E2E Tests | G (4-8h) | ALL | `tests/e2e/` |

---

### Task 5.1: Expandir CLI v3 com Todos os Comandos

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 3.1, 3.2, 3.3
**Prioridade:** HIGH - Complete CLI interface

#### Objetivo
Finalize cli-v3.ts with all commands, flags, and help text.

#### Escopo Detalhado

**O que FAZER:**
1. Update `src/cli-v3.ts` with complete command structure:
   ```typescript
   program
     .name('adk3')
     .description('ADK v3 - Unified Agentic Development Kit')
     .version('3.0.0')

   // Feature commands
   program
     .command('feature')
     .description('Feature development commands')
     .addCommand(work)
     .addCommand(autopilot)
     .addCommand(status)

   // Memory commands
   program
     .command('memory')
     .description('Memory management commands')
     .addCommand(memoryStatus)
     .addCommand(checkpoint)
     .addCommand(compact)
     .addCommand(restore)
   ```

2. Global flags:
   - `--verbose`: Enable detailed logging
   - `--json`: Output in JSON format
   - `--no-color`: Disable colored output

3. Help text:
   - Clear description for each command
   - Examples for common use cases
   - Link to documentation

4. Argument validation:
   - Feature name validation
   - Required argument checks
   - Helpful error messages

**O que NAO FAZER:**
- Migrar comandos v2 (sao separados)
- Add commands not yet implemented

#### Criterios de Aceite
- [ ] Todos os comandos registrados em cli-v3.ts
- [ ] Help text completo para cada comando
- [ ] Flags --verbose e --json funcionam
- [ ] Validacao de argumentos com mensagens claras
- [ ] `adk3 --help` exibe todos os comandos
- [ ] `adk3 <command> --help` shows command details
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/cli-v3.ts` - modificar
- `tests/cli-v3.test.ts` - criar

---

### Task 5.2: Implementar Compaction v3 com Two-Threshold

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependencias:** Task 1.1, 1.2
**Prioridade:** MEDIUM - Context management

#### Objetivo
Implement structured compaction that preserves critical information.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/memory/compactor-v3.ts`:
   ```typescript
   interface CompactionConfig {
     maxThreshold: number  // 80% - trigger
     targetThreshold: number  // 50% - post-compaction
   }

   class CompactorV3 {
     constructor(featureName: string, config?: CompactionConfig)

     async shouldCompact(): Promise<boolean>
     async compact(): Promise<CompactionResult>
     async estimateTokens(): Promise<number>
   }
   ```

2. Two-threshold architecture:
   - T_max (80%): Trigger compaction
   - T_target (50%): Post-compaction target

3. Preservation rules (NEVER compress):
   - File paths (complete)
   - Line numbers
   - Function/variable names
   - Commands that worked
   - Specific error messages

4. Compression rules (ALWAYS compress):
   - Redundant explanations
   - Already-processed tool outputs
   - Failed attempts (keep only lesson)
   - Clarification conversations (keep only decision)

5. Output: COMPACTED_STATE.md with structured template

**O que NAO FAZER:**
- Compaction automatica (sera acionada manualmente ou via threshold)
- Complex semantic analysis

#### Criterios de Aceite
- [ ] CompactorV3.shouldCompact() retorna true quando >80%
- [ ] CompactorV3.compact() reduz para ~50%
- [ ] Informacoes criticas sao preservadas
- [ ] Template COMPACTED_STATE.md e gerado corretamente
- [ ] Integration with token-counter.ts
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/memory/compactor-v3.ts` - criar
- `tests/utils/memory/compactor-v3.test.ts` - criar

---

### Task 5.3: Implementar Init Script Generator

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependencias:** nenhuma
**Prioridade:** LOW - Convenience utility

#### Objetivo
Generate init.sh scripts that set up the development environment.

#### Escopo Detalhado

**O que FAZER:**
1. Create `src/utils/init-script.ts`:
   ```typescript
   interface InitContext {
     featureName: string
     projectStack: 'node' | 'python' | 'go' | 'unknown'
     packageManager?: 'npm' | 'yarn' | 'pnpm'
   }

   function generateInitScript(context: InitContext): string
   function detectProjectStack(basePath: string): Promise<InitContext['projectStack']>
   ```

2. Stack detection:
   - Check for package.json → node
   - Check for requirements.txt or pyproject.toml → python
   - Check for go.mod → go

3. Generated script includes:
   ```bash
   #!/bin/bash
   # init.sh for feature: {name}

   set -e

   echo "Setting up environment..."

   # Install dependencies
   npm install  # or pip install, etc.

   # Run type check
   npm run type-check

   # Run tests
   npm test

   echo "Environment ready!"
   ```

**O que NAO FAZER:**
- Execucao do script (feito pelo agente)
- Complex environment setup

#### Criterios de Aceite
- [ ] generateInitScript() gera init.sh valido
- [ ] detectProjectStack() identifica stack corretamente
- [ ] Script inclui verificacoes (install, type-check, test)
- [ ] Script is executable (chmod +x compatible)
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/init-script.ts` - criar
- `tests/utils/init-script.test.ts` - criar

---

### Task 5.4: Testes de Integracao End-to-End

**Tipo:** Test
**Estimativa:** G (4-8h)
**Dependencias:** Todas as tasks anteriores
**Prioridade:** CRITICAL - Validation

#### Objetivo
Create comprehensive e2e test suite validating complete workflows.

#### Escopo Detalhado

**O que FAZER:**
1. Create test suite in `tests/e2e/`:
   ```
   tests/e2e/
   ├── feature-workflow.test.ts  # Full feature lifecycle
   ├── migration.test.ts         # v2 → v3 migration
   ├── recovery.test.ts          # Checkpoint/restore
   ├── hooks.test.ts             # Anti-stub hooks
   └── helpers/
       ├── test-project.ts       # Test project setup
       └── claude-mock.ts        # Mock Claude CLI
   ```

2. Test scenarios:

   **Feature Workflow (feature-workflow.test.ts)**:
   - New feature creation
   - Feature resumption
   - Phase transitions
   - Completion flow

   **Migration (migration.test.ts)**:
   - Detect v2 feature
   - Convert tasks.md
   - Preserve artifacts
   - Rollback on failure

   **Recovery (recovery.test.ts)**:
   - Checkpoint creation
   - Checkpoint restoration
   - Recovery after crash

   **Hooks (hooks.test.ts)**:
   - validate-no-stub blocks stubs
   - comprehension-check emits reminder

3. Test helpers:
   - Create temporary project directories
   - Mock Claude CLI responses
   - Clean up after tests

**O que NAO FAZER:**
- Testes de performance (Fase 2)
- Visual testing
- Live Claude CLI tests

#### Criterios de Aceite
- [ ] Suite e2e existe em `tests/e2e/`
- [ ] Fluxo completo de nova feature funciona
- [ ] Migracao v2 → v3 funciona
- [ ] Recovery de checkpoint funciona
- [ ] Hooks anti-stub funcionam
- [ ] All tests run in CI
- [ ] Todos os testes e2e passam

#### Arquivos Envolvidos
- `tests/e2e/feature-workflow.test.ts` - criar
- `tests/e2e/migration.test.ts` - criar
- `tests/e2e/recovery.test.ts` - criar
- `tests/e2e/hooks.test.ts` - criar
- `tests/e2e/helpers/*.ts` - criar

---

## Dependency Graph

```
Phase 1 (Core Infrastructure):
  1.1 Core State ──┐
  1.2 Session Notes ┼──► 1.4 Memory Initializer
  1.3 Decisions ────┘

Phase 2 (Prompt System):
  2.1 Feature List ──┬──► 2.2 Initializer Prompt
                     ├──► 2.3 Coding Prompt
                     └──► 2.4 QA Prompt

Phase 3 (Commands):
  1.4 + 2.1 + 2.2 + 2.3 ──► 3.1 feature work ──► 3.3 autopilot ──► 3.4 QA Runner
  1.1 + 1.2 + 1.3 + 1.4 ──► 3.2 memory commands

Phase 4 (Hooks):
  (independent) ──► 4.1 validate-no-stub
  1.1 ──► 4.2 comprehension-check
  1.4 + 2.1 ──► 4.3 migration

Phase 5 (Integration):
  3.1 + 3.2 + 3.3 ──► 5.1 CLI v3
  1.1 + 1.2 ──► 5.2 Compaction
  (independent) ──► 5.3 Init Script
  ALL ──► 5.4 E2E Tests
```

---

## Recommended Execution Order

### Wave 1 (Parallel - No Dependencies)
| Task | Effort | Type |
|------|--------|------|
| 1.1 Core State Manager | G | Core |
| 1.2 Session Notes Manager | M | Core |
| 1.3 Decisions Manager | M | Core |
| 2.1 Feature List Generator | M | Core |
| 4.1 Hook validate-no-stub | P | Hook |
| 5.3 Init Script Generator | P | Utility |

**Estimated time:** 1-2 days (parallel execution)

### Wave 2 (Depends on Wave 1)
| Task | Effort | Depends On |
|------|--------|------------|
| 1.4 Memory Initializer | P | 1.1, 1.2, 1.3 |
| 2.2 Initializer Agent Prompt | M | 2.1 |
| 2.3 Coding Agent Prompt | M | 2.1 |
| 2.4 QA Agent Prompt | M | 2.1 |
| 4.2 Hook comprehension-check | P | 1.1 |

**Estimated time:** 1 day (parallel execution)

### Wave 3 (Depends on Wave 2)
| Task | Effort | Depends On |
|------|--------|------------|
| 3.1 feature work command | G | 1.4, 2.1-2.3 |
| 3.2 Memory Commands | M | 1.1-1.4 |
| 4.3 Migration v2→v3 | M | 1.4, 2.1 |

**Estimated time:** 1-2 days (partially parallel)

### Wave 4 (Sequential)
| Task | Effort | Depends On |
|------|--------|------------|
| 3.3 feature autopilot | G | 3.1 |
| 5.1 CLI v3 Complete | M | 3.1-3.3 |
| 5.2 Compaction v3 | M | 1.1, 1.2 |

**Estimated time:** 1-2 days

### Wave 5 (Sequential - Final)
| Task | Effort | Depends On |
|------|--------|------------|
| 3.4 QA Two-Layer | G | 2.4, 3.3 |

**Estimated time:** 1 day

### Wave 6 (Final Validation)
| Task | Effort | Depends On |
|------|--------|------------|
| 5.4 E2E Tests | G | ALL |

**Estimated time:** 1-2 days

---

## Verification Points

### After Phase 1
- [ ] All memory managers work independently
- [ ] Memory structure initializer creates complete directories
- [ ] Unit tests pass

### After Phase 2
- [ ] All prompts generate valid output
- [ ] Feature list CRUD operations work
- [ ] Unit tests pass

### After Phase 3
- [ ] `adk3 feature work test` creates new feature
- [ ] `adk3 feature work test` resumes existing feature
- [ ] Memory commands work
- [ ] Integration tests pass

### After Phase 4
- [ ] Stub patterns are blocked
- [ ] Context reminders appear
- [ ] v2 features can be migrated
- [ ] Hook tests pass

### After Phase 5
- [ ] Full autopilot workflow completes
- [ ] QA catches issues and auto-corrects
- [ ] E2E tests pass
- [ ] Documentation is complete

---

## Test Strategy

### Unit Tests (Per Task)
- Each manager class has dedicated test file
- Mock file system for isolation
- Cover happy path + edge cases

### Integration Tests (Per Phase)
- Test component interactions
- Use temporary directories
- Verify file creation/modification

### E2E Tests (Final)
- Full workflow simulation
- Mock Claude CLI responses
- Validate complete feature lifecycle

### Coverage Target
- **Unit tests:** >90% per file
- **Integration tests:** All major flows
- **E2E tests:** Critical paths

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude CLI API changes | Medium | High | Verify flags before each sprint |
| Context overflow in sessions | High | Medium | Two-threshold compaction |
| Session resume failures | Medium | High | Frequent checkpoints |
| Infinite QA loops | High | Medium | Max 3 attempts + pattern detection |
| v2/v3 interference | Low | Critical | Separate CLI entry point (adk3) |
| Multi-agent conflicts | Medium | High | File ownership in shared-state |

---

## Success Metrics

### Quality Metrics (Target)
| Metric | v2 Baseline | v3 Target |
|--------|-------------|-----------|
| Stub Rate | ~20% | <5% |
| First-Pass QA Success | ~30% | >70% |
| Rework Rate | ~30% | <15% |

### Efficiency Metrics (Target)
| Metric | v2 Baseline | v3 Target |
|--------|-------------|-----------|
| Sessions per feature | 7+ | 1-3 |
| Context between phases | ~0% | >95% |
| Premature completion | ~40% | <5% |
| Crash recovery time | ~10min | <30s |

---

*Implementation Plan generated: 2026-02-02*
*Methodology: Vertical Slicing with TDD*
*Each task is a complete slice with test + implementation*
