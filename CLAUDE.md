# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

ADK (Agentic Development Kit) is a CLI toolkit implementing the CADD framework (Context-Agentic Development & Delivery) for AI-assisted software development. It orchestrates Claude Code to automate the development lifecycle from planning to deployment.

## 🚨 CRITICAL: Task Tracking + Context Cleanup

**VOCÊ DEVE LER ISTO ANTES DE IMPLEMENTAR QUALQUER CÓDIGO:**

### Workflow Obrigatório (COM CHECKPOINT)

1. **ANTES**: Leia `tasks.md` e marque como in_progress
2. **DURANTE**: Implemente seguindo TDD
3. **APÓS**: Marque completed
4. **🆕 CHECKPOINT**: Crie checkpoint e PAUSE para limpeza de contexto

```bash
# 1. Verificar tasks pendentes
Read: .claude/plans/features/<name>/tasks.md

# 2. Marcar como in_progress
.claude/hooks/mark-task.sh <feature-name> "Task X.X" in_progress

# 3. Implementar (TDD)
# ... código e testes ...

# 4. Marcar como completed
.claude/hooks/mark-task.sh <feature-name> "Task X.X" completed

# 5. CRIAR CHECKPOINT E PAUSAR
.claude/hooks/create-checkpoint.sh <feature-name> "Task X.X" "descricao"

# O script mostrará:
# ⚠️  PRÓXIMO PASSO: LIMPE O CONTEXTO
# 1. Ctrl+C para sair
# 2. claude clear
# 3. adk feature implement <feature-name>

# IMPORTANTE: PARE AQUI! Não continue para próxima task.
```

### 🧹 Por Que Limpar Contexto?

**Problema**: Contexto acumula código antigo, discussões, erros já corrigidos.
**Resultado**: Claude erra mais, fica confuso, perde foco.
**Solução**: Checkpoint + Context Clear entre tasks.

### ❌ NÃO FAÇA
- ❌ Implementar múltiplas tasks sem limpar contexto
- ❌ Esquecer de criar checkpoint
- ❌ Continuar após checkpoint sem limpar contexto
- ❌ Implementar tasks que já estão [x]

### ✅ Documentação Completa
- `.claude/docs/implementation-workflow.md` - Workflow detalhado
- `.claude/docs/context-cleanup-strategy.md` - Estratégia de checkpoint

## Commands

```bash
# Build & Dev
npm run build          # Compile TypeScript
npm run dev            # Watch mode
npm run link           # Build and link globally as 'adk'

# Quality
npm run check          # Lint + format (Biome)
npm run check:fix      # Auto-fix issues
npm run type-check     # TypeScript checking

# Testing
npm test               # Run all tests
npm run test:coverage  # Coverage report (target: 80%)
```

## Architecture

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CLI Entry | `src/cli.ts` | Commander.js parsing, 5 command groups |
| Feature | `src/commands/feature.ts` | Feature lifecycle (research → plan → implement) |
| Workflow | `src/commands/workflow.ts` | daily, pre-commit, QA workflows |
| Agent | `src/commands/agent.ts` | Agent creation and execution |
| Templates | `src/utils/templates.ts` | Template loading and CADD structure |
| Claude | `src/utils/claude.ts` | `executeClaudeCommand()` integration |

### Feature Workflow (Strict 3-Phase)

1. **Research** (`feature research <name>`) → outputs `research.md`
2. **Planning** (`feature plan <name>`) → requires research.md → outputs `implementation-plan.md`
3. **Implementation** (`feature implement <name>`) → requires plan → TDD enforced

Each phase validates previous phase completion. See `workflow qa` and `workflow pre-deploy` for quality gates.

### CADD Structure

```
projeto/
├── CLAUDE.md
└── .claude/
    ├── memory/project-context.md  # Persistent context
    ├── plans/features/<name>/     # Feature artifacts
    ├── agents/                    # Agent definitions
    ├── skills/                    # Skill definitions
    ├── commands/                  # Slash commands
    ├── hooks/                     # Automation hooks
    └── rules/                     # Quality rules
```

### Hook System

| Hook | Event | Purpose |
|------|-------|---------|
| `inject-focus.sh` | UserPromptSubmit | Injects active feature context |
| `scope-check.sh` | PreToolUse (Write) | Alerts on out-of-scope edits |
| `validate-bash.sh` | PreToolUse (Bash) | Blocks dangerous commands |
| `session-bootstrap.sh` | SessionStart | Auto-injects feature context |
| `session-checkpoint.sh` | Stop | Creates recovery snapshot |
| `pre-overflow.sh` | PreToolUse | Warns when context >90%, suggests compaction |

Focus managed via `.claude/active-focus.md` and `constraints.md`.

## Code Style

- Biome: single quotes, 2 spaces, 100 char width
- Node.js imports: use `node:` protocol (`node:path`, `node:fs`)
- Template literals over concatenation
- Error pattern: `ora spinner → try/catch → logger.error → process.exit(1)`

## Commit Conventions

```
feat(scope): description    # New feature
fix(scope): description     # Bug fix
refactor(scope): description
test(scope): description
chore(scope): description
docs(scope): description
```

**IMPORTANTE: NUNCA mencione IA, Claude, ou geracao automatica nos commits.**

## Key Dependencies

Commander.js (v14), Inquirer (v13), Ora (v9), Chalk (v5), fs-extra (v11), Biome (v2.3)

Node.js >= 18.0.0

## Development Guidelines

### Adding Commands
1. Create class in `src/commands/<name>.ts`
2. Export singleton instance
3. Register in `src/cli.ts`

### Adding Templates
1. Place in `templates/`
2. Use placeholders: `[Feature Name]`, `YYYY-MM-DD`, `[feature-x]`
3. Load with `loadTemplate('name.md')`

### Claude Integration
- Never execute code directly—generate prompts
- Use `executeClaudeCommand()` to delegate
- Validate prerequisites before prompts

## Extended Documentation

Detailed docs in `.claude/docs/`:

| Topic | File |
|-------|------|
| Progress Sync System | [progress-sync.md](.claude/docs/progress-sync.md) |
| Project Management Integration | [integration.md](.claude/docs/integration.md) |
| MCP Memory System | [memory-mcp.md](.claude/docs/memory-mcp.md) |
| ADK v2 Hooks | [hooks-v2.md](.claude/docs/hooks-v2.md) |
| Worktree Symlinks | [worktree.md](.claude/docs/worktree.md) |
| Context Compaction & Token Management | [context-compaction.md](.claude/docs/context-compaction.md) |

## Quick Reference

### Daily Workflow
```bash
adk workflow daily  # or /daily
```
Updates project memory, identifies blockers, suggests priorities.

### Feature Lifecycle
```bash
adk feature new my-feature
adk feature research my-feature
adk feature plan my-feature
adk feature implement my-feature
adk workflow qa my-feature
```

### State Management
```bash
adk feature sync <name>              # Sync progress ↔ tasks
adk feature status <name> --unified  # Consolidated view
adk feature history <name>           # Transition history
adk feature restore <name> --list    # View snapshots
```

### Memory System
```bash
adk memory index <file>        # Index content
adk memory recall "query"      # Semantic search
```

### Context Management
```bash
adk feature status <name> --tokens        # View token usage and context level
adk feature compact <name>                # Compact feature context
adk feature compact <name> --dry-run      # Preview compaction without applying
adk feature compact <name> --level compact  # Specify compaction level
adk feature compact <name> --revert <id>  # Revert compaction (within 24h)
adk context status [feature]              # View all features context status
adk context prune <feature>               # Archive old content
adk context prune <feature> --dry-run     # Preview pruning
```

**Compaction Levels:**
- `compact`: Compress verbose sections (70-85% usage)
- `summarize`: Create summary, archive details (85-95% usage)
- `handoff`: Generate handoff document (95%+ usage)

**When to use:**
- Monitor token usage regularly with `--tokens` flag
- Run compaction when context reaches 70%+ usage
- Use dry-run to preview changes before applying
- Revert if compaction causes issues (within 24h window)
