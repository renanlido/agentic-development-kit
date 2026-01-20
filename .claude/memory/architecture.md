# ADK Architecture

**Last Updated**: 2026-01-19

## System Architecture

### High-Level Overview

```
                              ┌─────────────────────────────────────────────┐
                              │              CLI Entry Point                 │
                              │                 cli.ts                       │
                              └──────────────────┬──────────────────────────┘
                                                 │
                 ┌───────────────────────────────┼───────────────────────────┐
                 │                               │                           │
    ┌────────────▼────────────┐   ┌──────────────▼──────────────┐  ┌────────▼────────┐
    │      Commands Layer      │   │       Utilities Layer       │  │   Types Layer   │
    │    src/commands/*.ts     │   │      src/utils/*.ts         │  │ src/types/*.ts  │
    └────────────┬────────────┘   └──────────────┬──────────────┘  └─────────────────┘
                 │                               │
                 │       ┌───────────────────────┤
                 │       │                       │
    ┌────────────▼───────▼────┐   ┌──────────────▼──────────────┐
    │   Claude Code CLI        │   │     Template System         │
    │   (External Process)     │   │    templates/*.md           │
    └──────────────────────────┘   └─────────────────────────────┘
                 │
    ┌────────────▼────────────┐
    │   .claude/ Structure     │
    │   (CADD Framework)       │
    │   ├── memory/            │
    │   ├── agents/            │
    │   ├── plans/features/    │
    │   ├── skills/            │
    │   ├── hooks/             │
    │   └── rules/             │
    └──────────────────────────┘
```

## Core Components

### 1. CLI Entry Point (`src/cli.ts`)

**Purpose**: Application entry point and command router

**Responsibilities**:
- Parse command-line arguments using Commander.js
- Route to appropriate command handlers
- Display help and version information
- Handle unknown commands with helpful messages

**Command Groups**:
- `init`: Project initialization
- `feature`: Feature lifecycle management (new, research, plan, implement, autopilot, quick)
- `workflow`: Automated workflows (daily, pre-commit, pre-deploy, qa)
- `agent`: Agent management (create, run, pipeline, parallel, status)
- `deploy`: Deployment operations (staging, production, rollback)
- `memory`: Memory management (save, load, view, compact, search, update, recall, link, export)
- `spec`: Specification management (create, validate, generate, view)
- `tool`: Tool registry (search, register, list, index, info)
- `report`: Report generation (partial)

**Pattern**:
```typescript
program
  .command('feature')
  .description('...')
  .action((name, options) => featureCommand.method(name, options))
```

### 2. Command Layer

#### Feature Command (`src/commands/feature.ts`)

**Phase 1: Create**
- Creates feature directory structure
- Generates PRD, tasks, plan templates
- Creates feature-specific context file
- Auto-creates git branch `feature/<name>`

**Phase 2: Research**
- Generates prompt for codebase analysis
- Identifies similar components and patterns
- Documents files to create/modify
- Assesses risks and dependencies
- Output: `research.md`

**Phase 3: Plan**
- Requires `research.md` to exist
- Creates detailed implementation breakdown
- Defines test strategy
- Sets acceptance criteria
- Output: `implementation-plan.md`

**Phase 4: Implement**
- Requires `implementation-plan.md` to exist
- Interactive phase selection
- Enforces TDD workflow
- Generates phase-specific prompts
- Validates completion before next phase

**List Features**
- Scans `.claude/plans/features/`
- Shows status based on artifacts
- Color-coded progress indicators

**Autopilot** (NOVO - 2026-01-13)
- Fluxo completo automatizado em 6 etapas
- Etapa 1: PRD Creator (faz perguntas obrigatorias)
- Etapa 2: Task Breakdown (ordena TDD)
- Etapa 3: Architect (mostra diagrama ASCII)
- Etapa 4: Implementer (TDD: RED → GREEN → REFACTOR)
- Etapa 5: Reviewer (checklist qualidade/seguranca)
- Etapa 6: Documenter
- Gates de pausa para revisao entre etapas
- Cria branch git automaticamente

#### Workflow Command (`src/commands/workflow.ts`)

**Daily Workflow**
- Reviews git log since yesterday
- Identifies work in progress
- Updates project memory
- Creates daily notes

**Pre-Commit Workflow**
- Analyzes staged files
- Checks for anti-patterns (console.log, secrets, TODOs)
- Runs test suite
- Blocks commit if issues found

**QA Workflow**
- Five-step validation process
- Lint/format → Coverage → Performance → Security → Review
- Generates comprehensive report
- Pass/fail criteria for each step

**Pre-Deploy Workflow**
- Six-category checklist
- Go/no-go recommendation
- Feature flag validation
- Deployment readiness assessment

#### Agent Command (`src/commands/agent.ts`)

**Create Agent**
- Generates agent template
- Supports types: analyzer, implementer, tester, generic
- Creates markdown file with YAML frontmatter
- Stores in `.claude/agents/`

**Run Agent**
- Reads agent definition
- Embeds instructions in prompt
- Supports additional context
- Executes via Claude Code

**Pipeline Execution**
- Sequential agent execution
- Predefined pipeline: analyzer → optimizer → documenter
- Skips missing agents gracefully
- Enables complex multi-agent workflows

#### Init Command (`src/commands/init.ts`)

**Project Initialization**
- Prompts for project name (if not provided)
- Validates directory doesn't exist
- Creates 12 core CADD directories
- Copies project template (node/go/python)
- Initializes git repository
- Creates initial memory files

**CADD Structure Created**:
```
.claude/
├── memory/              # Persistent context
├── plans/               # Planning artifacts
├── agents/              # Agent definitions
├── skills/              # Reusable skills
├── commands/            # Custom commands
├── decisions/           # ADRs
├── incidents/           # Post-mortems
├── templates/           # Project templates
├── scripts/             # Automation
├── reports/             # Generated reports (transient)
├── daily/               # Daily notes (transient)
└── analysis/            # Analysis outputs (transient)
```

#### Deploy Command (`src/commands/deploy.ts`)

**Staging Deployment**
- Deploys to staging environment
- Runs smoke tests
- Validates deployment

**Production Deployment**
- Gradual rollout (10% → 50% → 100%)
- Feature flag management
- Monitoring and metrics
- Auto-rollback on errors

**Rollback**
- Reverts feature deployment
- Updates feature flags
- Notifies team

### 3. Utilities Layer

| Utilitario | Arquivo | Responsabilidade |
|------------|---------|------------------|
| claude | claude.ts | Integracao com Claude Code CLI |
| templates | templates.ts | Sistema de templates e scaffolding |
| memory-utils | memory-utils.ts | Parsing e gerenciamento de memoria |
| parallel-executor | parallel-executor.ts | Execucao paralela de agents em worktrees |
| conflict-resolver | conflict-resolver.ts | Resolucao de conflitos entre agents |
| merge-strategy | merge-strategy.ts | Estrategias de merge de branches |
| worktree-utils | worktree-utils.ts | Git worktrees para isolamento |
| progress | progress.ts | Tracking de progresso de tasks |
| spec-utils | spec-utils.ts | Parsing e validacao de specs |
| tool-registry | tool-registry.ts | Descoberta e registro de tools |
| decision-utils | decision-utils.ts | Gerenciamento de decisoes |
| memory-search | memory-search.ts | Busca fuzzy em memoria (Fuse.js) |
| agent-status | agent-status.ts | Status de execucao de agents |
| logger | logger.ts | Logging centralizado com Chalk |

#### Claude Integration (`src/utils/claude.ts`)

**executeClaudeCommand(prompt)**
- Checks Claude Code installation
- Creates temporary prompt file
- Executes `claude --dangerously-skip-permissions < tempfile`
- Pipes output to user terminal
- Cleans up temporary file

**isClaudeInstalled()**
- Validates Claude Code CLI availability
- Returns boolean
- Used for prerequisite checks

**Design Decision**: ADK never executes code directly - it orchestrates Claude Code via structured prompts.

#### Template System (`src/utils/templates.ts`)

**loadTemplate(name)**
- Reads template from `templates/` directory
- Returns raw content for placeholder replacement
- Throws if template not found

**copyTemplate(type, targetDir)**
- Scaffolds entire project structure
- Copies from `templates/projects/<type>/`
- Filters out .git and node_modules
- Preserves directory structure

**copyClaudeStructure(targetDir)**
- Copies ADK components to target project
- Merges: agents, skills, commands, rules, hooks
- Copies: settings.json, README.md, active-focus.md
- Preserves existing files (no overwrite)

**Placeholder Convention**:
- `[Feature Name]`: Title case name
- `[feature-x]`: Kebab case name
- `YYYY-MM-DD`: ISO date format

#### Parallel Executor (`src/utils/parallel-executor.ts`)

**executeParallel(agents, feature, config)**
- Creates git worktrees for agent isolation
- Runs multiple agents concurrently
- Respects maxAgents limit (default: 3)
- Detects conflicts between agent changes
- Supports timeout per agent

**AgentResult Structure**:
- agent name, success status, branch
- worktree path, changed files
- output, error, duration

**ConflictInfo Structure**:
- file, conflicting agents
- type: none | auto-resolvable | manual-required

#### Memory System (`src/utils/memory-utils.ts`)

**Memory Hierarchy**:
```
Global Memory: .claude/memory/project-context.md
Feature Memory: .claude/plans/features/<name>/memory.md
Archive: .claude/plans/features/<name>/memory-archive/
```

**Key Functions**:
- `getMemoryPath(feature?)` - Get memory file path
- `parseMemoryContent(content)` - Parse markdown to MemoryContent
- `isMemoryOverLimit(content)` - Check 500 line limit
- `createDefaultMemory(feature)` - Initialize new memory

**Memory Phases**: research → plan → implement → qa → deploy

#### Logger (`src/utils/logger.ts`)

**Methods**:
- `success(message)`: Green checkmark + message
- `error(message)`: Red X + message
- `warn(message)`: Yellow warning + message
- `info(message)`: Blue info + message
- `debug(message)`: Gray debug (if DEBUG env var)

**Uses Chalk** for terminal colors and formatting.

### 4. Types Layer (`src/types/`)

| Tipo | Arquivo | Proposito |
|------|---------|-----------|
| Spec | spec.ts | Especificacoes de features (inputs, outputs, behaviors, edge cases) |
| Memory | memory.ts | Estrutura de memoria persistente (phases, state, decisions) |
| Tool | tool.ts | Definicao de ferramentas do registry |
| Externals | externals.d.ts | Declaracoes de modulos externos |

**Spec Schema** (com validacao Zod-like):
```typescript
interface Spec {
  feature: string
  version: string
  description: string
  inputs: SpecInput[]
  outputs: SpecOutput[]
  behaviors: string[]
  edgeCases: EdgeCase[]
  acceptanceCriteria: GherkinScenario[]
  nonFunctional?: NonFunctional
}
```

## Data Flow

### Feature Creation Flow

```
User: adk feature new auth
    ↓
CLI parses command
    ↓
FeatureCommand.create('auth')
    ↓
Create directory: .claude/plans/features/auth/
    ↓
Load templates (PRD, tasks, plan)
    ↓
Replace placeholders with 'auth' and date
    ↓
Write files to feature directory
    ↓
Create context.md
    ↓
Create git branch: feature/auth
    ↓
Show next steps to user
```

### Research Flow

```
User: adk feature research auth
    ↓
Validate: .claude/plans/features/auth/ exists?
    ↓
Generate structured prompt:
  - Read PRD
  - Analyze codebase
  - Find similar components
  - Document risks
    ↓
executeClaudeCommand(prompt)
    ↓
Creates temp file with prompt
    ↓
Executes: claude < tempfile
    ↓
Claude writes: research.md
    ↓
Cleanup temp file
    ↓
Show next step: adk feature plan auth
```

### Implementation Flow

```
User: adk feature implement auth
    ↓
Validate: implementation-plan.md exists?
    ↓
Interactive prompt: which phase?
    ↓
Generate TDD prompt:
  Phase 1: Write tests (must fail)
  Phase 2: Implement (make tests pass)
  Phase 3: Verify (coverage, lint, perf)
    ↓
executeClaudeCommand(prompt)
    ↓
Claude executes TDD cycle
    ↓
Show completion status
```

## Design Decisions

### Why Commander.js?
- Industry standard for Node.js CLIs
- Excellent subcommand support
- Built-in help generation
- Type-safe with TypeScript

### Why Biome over ESLint + Prettier?
- Single tool for lint + format
- Significantly faster (Rust-based)
- Zero config defaults
- Better TypeScript support

### Why Ora for Spinners?
- Simple API
- Works in all terminals
- Chainable with async operations
- Great UX for long-running tasks

### Why fs-extra over fs?
- Promise-based API
- Additional utilities (copy, ensureDir)
- Backwards compatible with fs
- Simpler error handling

### Why Separate Command Classes?
- Single Responsibility Principle
- Easier to test
- Better code organization
- Supports future plugin system

### Why Temp Files for Prompts?
- Handles multi-line prompts safely
- Avoids shell escaping issues
- Works across all platforms
- Easy to debug (can inspect temp file)

## Extension Points

### Adding New Commands
1. Create `src/commands/new-command.ts`
2. Implement command class
3. Export singleton instance
4. Register in `src/cli.ts`

### Adding New Workflows
1. Add method to `WorkflowCommand`
2. Define prompt structure
3. Add validation logic
4. Register in CLI

### Adding New Agent Types
1. Create template in `getAgentTemplate()`
2. Add to type options
3. Document in CLAUDE.md

### Adding New Templates
1. Create `.md` file in `templates/`
2. Use placeholder conventions
3. Load with `loadTemplate()`
4. Add replacement logic

## Performance Considerations

- **Template Caching**: Could cache loaded templates in memory
- **Parallel Operations**: Could run independent operations in parallel
- **Incremental Updates**: Could update only changed files
- **Lazy Loading**: Could lazy-load command modules

## Security Considerations

- **Path Traversal**: Validate all user-provided paths
- **Command Injection**: Never use user input in shell commands directly
- **Secret Detection**: Pre-commit workflow checks for hardcoded secrets
- **File Permissions**: Respect system file permissions
- **Temp File Cleanup**: Always cleanup temp files, even on error

## Testing Strategy

### Unit Tests
- Test utilities in isolation
- Mock file system operations
- Test error conditions
- Validate edge cases

### Integration Tests
- Test command workflows
- Use temp directories
- Mock Claude Code CLI
- Test file creation/modification

### E2E Tests
- Test full workflows
- Real file system operations
- Optional: real Claude Code integration
- Validate output artifacts

## Monitoring & Observability

Currently minimal - opportunities:
- Command execution metrics
- Error rates and types
- Template usage statistics
- Workflow completion times
- Claude Code API call frequency

## Future Architecture Improvements

1. **Plugin System**: Allow third-party commands and workflows
2. **Config Management**: User and project-level configuration
3. **State Management**: Track feature progress across sessions
4. **Parallel Execution**: Run independent operations concurrently (PARCIALMENTE IMPLEMENTADO)
5. **Caching Layer**: Cache expensive operations
6. **Event System**: Hooks for custom automation (IMPLEMENTADO)
7. **API Layer**: Programmatic access to ADK functionality

## Agent System

Agents sao definidos em arquivos markdown com YAML frontmatter:

```yaml
---
name: implementer
description: Implementa codigo seguindo TDD
tools:
  - Read
  - Write
  - Edit
  - Bash
model: opus
---
```

### Agents Disponiveis

| Agent | Proposito | Fase |
|-------|-----------|------|
| prd-creator | Cria documentos de requisitos | Planning |
| task-breakdown | Quebra PRDs em tasks ordenadas | Planning |
| architect | Analisa e planeja arquitetura | Planning |
| analyzer | Analisa codigo e identifica issues | Analysis |
| implementer | Implementa com TDD rigoroso | Implementation |
| tester | Cria testes abrangentes | Implementation |
| reviewer | Code review com checklist | Quality |
| documenter | Gera documentacao tecnica | Documentation |

### Agent Context Hierarchy

```
GLOBAL (sempre aplicavel)
├── .claude/memory/project-context.md
├── .claude/memory/architecture.md
├── .claude/rules/*.md
└── CLAUDE.md

FEATURE (especifico da feature)
├── .claude/plans/features/<nome>/prd.md
├── .claude/plans/features/<nome>/tasks.md
└── .claude/plans/features/<nome>/implementation-plan.md

TASK (esta execucao)
└── Task especifica sendo implementada
```

**Regra de Conflito:** Feature sobrescreve Global. Task sobrescreve Feature.

## Hook System

Hooks executam em eventos do Claude Code para manter foco e qualidade:

| Hook | Evento | Proposito |
|------|--------|-----------|
| inject-focus.sh | UserPromptSubmit | Injeta contexto da feature ativa |
| scope-check.sh | PreToolUse (Write/Edit) | Alerta edicao fora do escopo |
| validate-bash.sh | PreToolUse (Bash) | Bloqueia comandos perigosos |
| post-write.sh | PostToolUse (Write) | Validacoes pos-escrita |
| update-state.sh | Stop | Atualiza estado ao fim da sessao |

### Focus System

```
.claude/active-focus.md          # Feature sendo trabalhada
.claude/plans/features/<name>/constraints.md  # Restricoes do escopo
```

## Provider System (Project Management Integration)

Sistema plugavel para integracao com ferramentas de gerenciamento de projeto.

### Arquitetura

```
src/providers/
├── types.ts         # Interfaces: ProjectProvider, SyncResult, etc
├── index.ts         # Registry e factory functions
├── local.ts         # LocalProvider (fallback offline)
└── clickup/
    ├── index.ts     # ClickUpProvider implementacao
    ├── client.ts    # HTTP client para API v2
    ├── mapper.ts    # ADK ↔ ClickUp data mapping
    └── types.ts     # Tipos especificos ClickUp
```

### Interface ProjectProvider

```typescript
interface ProjectProvider {
  readonly name: string
  readonly displayName: string

  connect(credentials: ProviderCredentials): Promise<ProviderConnectionResult>
  disconnect(): Promise<void>

  createFeature(feature: LocalFeature): Promise<RemoteFeature>
  updateFeature(remoteId: string, data: Partial<LocalFeature>): Promise<RemoteFeature>
  syncFeature(feature: LocalFeature, remoteId?: string): Promise<SyncResult>
  getRemoteChanges(since: Date): Promise<RemoteFeature[]>
}
```

### Providers Disponiveis

| Provider | Status | Descricao |
|----------|--------|-----------|
| local | ✅ Implementado | Fallback offline, sem sincronizacao |
| clickup | ✅ Implementado | Integracao completa com ClickUp |

### Configuracao

Armazenada em `.adk/config.json`:
```json
{
  "version": "1.0.0",
  "integration": {
    "provider": "clickup",
    "enabled": true,
    "autoSync": false,
    "conflictStrategy": "local-wins"
  }
}
```

Tokens em `.env` (nunca versionados):
```bash
CLICKUP_API_TOKEN=pk_12345678_XXXXXXXXXXXX
```

### Comandos CLI

- `adk config integration clickup` - Configura provider
- `adk sync [feature]` - Sincroniza com plataforma
- `adk import` - Importa tasks como features

## Dependencies

| Dependencia | Versao | Proposito |
|-------------|--------|-----------|
| commander | 14.0.2 | CLI framework |
| inquirer | 13.2.0 | Prompts interativos |
| ora | 9.0.0 | Spinners de terminal |
| chalk | 5.6.2 | Cores de terminal |
| fs-extra | 11.3.3 | Filesystem estendido |
| fuse.js | 7.1.0 | Fuzzy search |
| simple-git | 3.30.0 | Operacoes git |
| zod | 3.25.76 | Validacao de schemas |
| dotenv | 17.2.3 | Variaveis de ambiente |

### Dev Dependencies

| Dependencia | Versao | Proposito |
|-------------|--------|-----------|
| typescript | 5.3.3 | Compilador |
| biome | 2.3.11 | Linter + formatter |
| jest | 30.2.0 | Framework de testes |
| ts-jest | 29.1.1 | Jest + TypeScript |
| tsx | 4.7.0 | Execucao TS |

## Padroes Identificados

| Padrao | Onde | Como Usado |
|--------|------|------------|
| **Command Pattern** | `src/commands/*.ts` | Classes singleton com metodos para subcomandos |
| **Prompt Engineering** | `executeClaudeCommand()` | Prompts estruturados com PHASE/Tasks/IMPORTANT |
| **Phase Validation** | Feature lifecycle | Verificacao de existencia de artefatos anteriores |
| **Template Method** | Agent system | Markdown + YAML frontmatter define comportamento |
| **Observer** | Hook system | Hooks executam em eventos do Claude Code |
| **Strategy** | Merge strategies | Diferentes estrategias para merge de branches |
| **Repository** | Memory system | `.claude/memory/` como repositorio de contexto |
| **Facade** | `claude.ts` | Simplifica integracao com Claude Code CLI |
| **Builder** | Prompt generation | Construcao incremental de prompts complexos |

## Pontos de Extensao

### Adicionar Novo Comando
1. Criar classe em `src/commands/novo.ts`
2. Exportar singleton: `export const novoCommand = new NovoCommand()`
3. Registrar em `src/cli.ts` com Commander.js

### Adicionar Novo Agent
1. Criar markdown em `.claude/agents/nome.md`
2. Definir frontmatter (name, tools, model)
3. Escrever instrucoes do agent no corpo

### Adicionar Nova Skill
1. Criar diretorio em `.claude/skills/nome/`
2. Criar `skill.md` com definicao
3. Adicionar templates em `templates/` se necessario

### Adicionar Novo Template
1. Criar arquivo em `templates/nome.md`
2. Usar placeholders: `[Feature Name]`, `YYYY-MM-DD`
3. Carregar com `loadTemplate('nome.md')`

### Adicionar Novo Provider
1. Criar diretorio em `src/providers/nome/`
2. Implementar interface `ProjectProvider`
3. Criar client HTTP com rate limiting
4. Criar mapper para traducao de dados
5. Registrar em `src/providers/index.ts`

## Test Coverage

### Testes Existentes (27 arquivos)

| Categoria | Arquivos | Descricao |
|-----------|----------|-----------|
| Commands | 4 | config, import, memory, sync |
| Providers | 5 | clickup (3), index, local |
| Types | 1 | spec validation |
| Utils | 17 | Todos os utilitarios principais |

### Estrutura de Testes

```
tests/
├── commands/        # Testes de comandos CLI
├── providers/       # Testes de integracao com providers
│   └── clickup/    # Testes especificos ClickUp
├── types/          # Validacao de tipos e schemas
└── utils/          # Testes de utilitarios (maior cobertura)
```

## Metricas do Projeto

### Codigo Fonte

| Categoria | Arquivos | LOC Estimado |
|-----------|----------|--------------|
| CLI Entry | 1 | ~410 |
| Commands | 12 | ~6280 |
| Providers | 6 | ~400 |
| Utils | 18 | ~2500 |
| Types | 5 | ~350 |
| **Total** | **42** | **~9940** |

### Maior Arquivo: `feature.ts` (2746 linhas)
Contem toda logica de lifecycle de features incluindo autopilot
