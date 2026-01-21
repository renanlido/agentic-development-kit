# ADK Project Context

**Last Updated**: 2026-01-21
**Project**: Agentic Development Kit (ADK)
**Version**: 1.0.0

## Project Overview

ADK is a CLI toolkit that implements the CADD framework (Context-Agentic Development & Delivery) for AI-assisted software development. It orchestrates Claude Code to automate the entire development lifecycle from planning to deployment.

**Core Purpose**: Enable autonomous AI-driven development by providing structured workflows, context management, and quality gates.

## Tech Stack

### Runtime & Language
- **Node.js**: >= 18.0.0
- **TypeScript**: 5.3.3
  - Target: ES2020
  - Module: CommonJS
  - Strict mode enabled

### Core Dependencies
- **Commander.js** (v14): CLI argument parsing and command structure
- **Inquirer** (v13): Interactive prompts for user input
- **Ora** (v9): Terminal spinners for progress indication
- **Chalk** (v5): Terminal colors and formatting
- **fs-extra** (v11): Enhanced file system operations
- **dotenv** (v17): Environment variable management
- **simple-git** (v3): Git operations for worktrees and branches
- **Fuse.js** (v7): Fuzzy search for memory and tool discovery
- **Zod** (v3): Schema validation for specs and configurations

### Development Tools
- **Biome** (v2.3): Unified linter and formatter (replaced ESLint + Prettier)
- **Jest** (v30): Testing framework with ts-jest
- **tsx**: TypeScript execution for development

### Build System
- **TypeScript Compiler**: Compiles to `dist/` directory
- **npm scripts**: Build, dev, test, lint workflows
- **npm link**: Global CLI installation

## Architecture Patterns

### Command Pattern
All commands follow singleton class pattern:
```typescript
class FeatureCommand {
  async create(name: string, options: Options) { }
  async research(name: string) { }
}
export const featureCommand = new FeatureCommand()
```

### Error Handling Pattern
Consistent across all commands:
```typescript
const spinner = ora('Doing something...').start()
try {
  // work
  spinner.succeed('Success')
} catch (error) {
  spinner.fail('Failed')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### Prompt Engineering Pattern
Structured multi-paragraph prompts for Claude:
```
PHASE N: PHASE_NAME

Input: <file paths>
Output: <target file path>

Tasks:
1. Specific task
2. Another task

IMPORTANT: <critical constraints>
```

### Claude Code Integration
- ADK never executes code directly
- Generates structured prompts via `executeClaudeCommand()`
- Creates temporary files and pipes to `claude` CLI
- Acts as orchestrator, not executor

## Code Conventions

### Import Style
- Use `node:` protocol for Node.js built-ins: `import path from 'node:path'`
- Group imports: external → internal → types

### Code Style (Biome)
- Single quotes for strings, double for JSX
- 2 spaces indentation
- 100 character line width
- Semicolons as needed (not enforced)
- Template literals over concatenation

### File Organization
```
src/
├── cli.ts           # Entry point
├── commands/        # Command implementations
│   ├── feature.ts
│   ├── workflow.ts
│   ├── agent.ts
│   ├── deploy.ts
│   └── init.ts
└── utils/           # Shared utilities
    ├── claude.ts    # Claude Code integration
    ├── logger.ts    # Logging utilities
    └── templates.ts # Template management
```

### Naming Conventions
- Commands: kebab-case (`feature-command.ts`)
- Classes: PascalCase (`FeatureCommand`)
- Functions/variables: camelCase (`executeClaudeCommand`)
- Constants: UPPER_SNAKE_CASE (`TEMPLATES_DIR`)

## Git Workflow

### Branch Strategy
- `main`: Stable production code
- `feature/<name>`: Feature development (auto-created by ADK)
- No develop branch (continuous delivery)

### Commit Conventions
Follow conventional commits:
- `feat(scope): description` - New feature
- `fix(scope): description` - Bug fix
- `refactor(scope): description` - Code refactoring
- `test(scope): description` - Add/modify tests
- `chore(scope): description` - Maintenance tasks
- `docs(scope): description` - Documentation

Examples:
- `test: add tests for feature research phase`
- `feat(workflow): add QA workflow command`
- `refactor(templates): simplify placeholder replacement`

## Development Workflow

### TDD Approach (Enforced)
1. Write tests first (all failing)
2. Implement minimum code to pass
3. Refactor while keeping tests green
4. Commit incrementally

### Quality Gates
- **Lint**: Must pass `biome check`
- **Format**: Must pass `biome format`
- **Tests**: Must pass with >= 80% coverage
- **Types**: Must pass `tsc --noEmit`

### Common Commands
```bash
# Development
npm run dev              # Watch mode
npm run build           # Compile TypeScript
npm run link            # Install globally

# Quality
npm run check           # Lint + format check
npm run check:fix       # Auto-fix issues
npm test                # Run tests
npm run test:coverage   # Coverage report

# Testing specific file
npm test -- path/to/file.test.ts
```

## CADD Framework Principles

### 1. Context First
- Always provide context before coding
- Memory system maintains updated context
- Features inherit from project-context.md

### 2. Agent Isolation
- Use sub-agents for independent tasks
- Prevent context pollution
- Each agent has clear boundaries

### 3. Development TDD
- Tests always before implementation
- Enforced in feature workflow
- 80% minimum coverage

### 4. Document Always
- Architecture decisions in ADRs
- Changes in CHANGELOG
- Memory always updated

### 5. Verification
- Validate each phase before advancing
- Quality gates prevent progression
- Verification loops ensure quality

## Project-Specific Rules

### Template Management
- Templates in `templates/` directory
- Use placeholders: `[Feature Name]`, `YYYY-MM-DD`, `[feature-x]`
- Replace all with `.replace(/pattern/g, value)`

### Phase Validation
- Research required before planning
- Planning required before implementation
- Validate file existence before proceeding

### Git Integration
- Auto-create feature branches
- Silently fail if git unavailable (don't block)
- Use `stdio: 'ignore'` for git output

### Claude Code Prerequisite
- Always check `isClaudeInstalled()` before prompts
- Validate required files exist
- Validate required directories exist

## Known Patterns

### Feature Lifecycle
1. `feature new` → Creates structure + branch
2. `feature research` → Analyzes codebase
3. `feature plan` → Creates detailed plan
4. `feature implement` → TDD implementation
5. `workflow qa` → Quality assurance
6. `workflow pre-deploy` → Pre-deployment checks

**OU** (alternativa automatizada):
- `feature autopilot <nome>` → Executa 1-6 automaticamente com gates de pausa

### Workflow Automation
- Daily: Review + update memory
- Pre-commit: Staged file analysis + tests
- QA: 5-step validation (lint/coverage/perf/security/review)
- Pre-deploy: 6-category checklist

### Agent System
- Markdown files with YAML frontmatter
- Stored in `.claude/agents/`
- Executed via `agent run <name>`
- Pipelines for sequential execution

## Current Focus

ADK is in active development with these priorities:
1. Core CLI commands (init, feature, workflow, agent, deploy, memory, spec, tool) - DONE
2. Template system for project scaffolding - DONE
3. Claude Code integration and prompt engineering - DONE
4. Quality workflows (QA, pre-commit, pre-deploy) - DONE
5. Advanced agent system (parallel execution, worktrees, conflict resolution) - DONE
6. Spec system with validation - DONE
7. Tool registry with fuzzy search - DONE
8. Project management integration (ClickUp provider) - DONE
9. Sync/Import commands for remote tasks - DONE
10. Progress sync system (progress.md ↔ tasks.md) - DONE
11. Feature refinement system (/refine command) - DONE
12. Documentation automation (/docs skill) - DONE
13. Testing and integration validation - IN PROGRESS (1242 tests passing)

## Known Issues

- Deploy command needs full implementation
- Report command is stub only
- Need integration tests for full workflows
- Stale branches need cleanup (feature/progress-sync, feature/project-features)
- Stash contains old WIP (can be dropped)

## Project Management Integration

ADK suporta integracao opcional com ferramentas de projeto:

### Providers Implementados
- **LocalProvider**: Fallback offline, sem sincronizacao
- **ClickUpProvider**: Integracao completa com ClickUp API v2

### Comandos de Integracao
- `adk config integration clickup` - Configura provider interativamente
- `adk sync [feature]` - Sincroniza features com plataforma remota
- `adk import` - Importa tasks remotas como features locais

### Arquitetura de Providers
Padrao plugavel em `src/providers/` permitindo adicionar novos providers (Jira, Linear, etc)

## Testing Strategy

- Unit tests for utilities (`src/utils/`)
- Integration tests for commands (planned)
- E2E tests for full workflows (planned)
- Minimum 80% coverage enforced

## Performance Considerations

- Minimize Claude Code API calls
- Use batch operations when possible
- Cache template reads
- Avoid redundant file system operations

## Security Considerations

- Never commit secrets
- Validate user input
- Sanitize file paths
- Check for path traversal
- Validate template content

## Recent Changes (2026-01-21)

- Feature refinement system (`/refine` command) for selective PRD, research, and tasks refinement
- Documentation automation (`/docs` skill) integrated into feature lifecycle
- reviewer-secondary agent integrated into /implement skill for independent validation
- Plan Mode integrated into /new-feature skill for upfront planning
- Daily workflow fully documented with automation examples
- CLI command descriptions updated with all subcommands
- 1242 tests passing (100% coverage)

### Previous Updates (2026-01-20)
- techniques-implementation feature reached finish phase
- Advanced agentic techniques integrated throughout workflows

### Previous Updates (2026-01-19)
- Project management integration (ClickUp provider) fully implemented
- Sync and import commands for remote task management
- Provider registry pattern for pluggable integrations
- Offline queue system for failed sync operations
- Conflict resolution strategies (local-wins, remote-wins, newest-wins, manual)

### Previous Updates (2026-01-15)
- Added comprehensive architecture documentation
- Documented all 8 command groups with subcommands
- Documented 14 utility modules
- Added agent system documentation

## Future Enhancements

Planned features tracked in `.claude/plans/features/`:
- Enhanced reporting system
- Memory management UI
- Plugin system for custom commands
- Multiple Claude Code instance support
- Complete deploy command implementation
