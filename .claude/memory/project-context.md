# ADK Project Context

> Last updated: 2026-01-21T23:00:00.000Z

## Project Overview

**ADK (Agentic Development Kit)** is a CLI toolkit implementing the CADD framework (Context-Agentic Development & Delivery) for AI-assisted software development. It orchestrates Claude Code to automate the entire development lifecycle from planning to deployment.

## Current Status

### Active Development
- **Feature**: adk-v2-fase1 (MCP Memory RAG)
- **Branch**: feature/adk-v2-fase1
- **Status**: ✅ Implementation Complete (All 7 Phases)
- **Coverage**: 93.93% (exceeds 80% target)
- **Next Phase**: QA

### Tech Stack
- **Runtime**: Node.js >= 18.0.0
- **Language**: TypeScript (ES2020, CommonJS)
- **CLI**: Commander.js v14
- **Testing**: Jest with ts-jest
- **Linting**: Biome (replaced ESLint + Prettier)
- **Dependencies**: Inquirer, Ora, Chalk, fs-extra, Zod

## Recent Completions

### adk-v2-fase1: MCP Memory System (COMPLETED)

**Description**: Semantic memory system using MCP (Model Context Protocol) for intelligent context retrieval via RAG.

**Completion Date**: 2026-01-21

**Deliverables**:
1. ✅ Types & Zod schemas (src/types/mcp-memory.ts)
2. ✅ Configuration system (src/utils/memory-config.ts)
3. ✅ MCP wrapper with fallback (src/utils/memory-mcp.ts)
4. ✅ Index command (`adk memory index`)
5. ✅ Recall command (`adk memory recall`)
6. ✅ Index queue with debounce (src/utils/memory-index-queue.ts)
7. ✅ Auto-indexation hook (.claude/hooks/post-write-index.sh)
8. ✅ E2E tests (15 tests) + comprehensive unit tests (100+ tests)
9. ✅ Documentation in CLAUDE.md

**Coverage**: 93.93% overall
- Commands: 91.99%
- Utils: 95% average
- Types: 100%

**Commits**: 8 atomic commits tracking each phase

## Architecture Patterns

### Feature Development Workflow
ADK enforces a strict 3-phase process:
1. **Research** → Analyze codebase, identify files, document risks
2. **Planning** → Detailed breakdown, test strategy, acceptance criteria
3. **Implementation** → TDD-first, phased execution

### Hook System
Enforcement hooks maintain focus and quality:
- `session-bootstrap.sh` - Inject context at session start
- `session-checkpoint.sh` - Create checkpoint on session end
- `validate-tdd.sh` - Remind to follow TDD (non-blocking)
- `sync-state.sh` - Auto-sync progress.md and state.json
- `post-write-index.sh` - Auto-index .claude/**/*.md files (NEW)

### Memory System
MCP Memory RAG enables semantic search:
- Provider: MCP with local fallback
- Queue: 2s debounce for batching
- Hook: Automatic indexation on file writes
- Commands: `index`, `recall`, `queue`, `process-queue`

## Project Structure

```
adk/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── commands/              # Command implementations
│   │   ├── feature.ts         # Feature lifecycle
│   │   ├── workflow.ts        # Workflows (daily, QA, etc)
│   │   ├── agent.ts           # Agent execution
│   │   ├── memory.ts          # Memory commands (NEW)
│   │   └── ...
│   ├── utils/                 # Utilities
│   │   ├── memory-*.ts        # Memory system (NEW)
│   │   ├── progress-sync/     # State management
│   │   └── ...
│   └── types/                 # TypeScript types
│       └── mcp-memory.ts      # Memory types (NEW)
├── templates/                 # Template files
│   └── claude-structure/      # ADK components
│       ├── hooks/             # Hook scripts
│       │   └── post-write-index.sh (NEW)
│       └── settings.json      # Hook configuration
├── tests/
│   ├── commands/              # Command tests
│   ├── utils/                 # Utility tests
│   └── e2e/                   # E2E tests (NEW)
└── .claude/                   # CADD structure
    ├── plans/features/        # Feature planning
    │   └── adk-v2-fase1/      # Current feature
    ├── hooks/                 # Active hooks
    └── memory/                # Project memory
```

## Development Guidelines

### Code Quality
- **Coverage Target**: >= 80% (currently: 93.93% for memory system)
- **TDD**: Tests before implementation (enforced by validate-tdd.sh)
- **Linting**: Biome with strict rules
- **Commits**: Conventional commits (feat, fix, test, chore, docs)

### Testing Strategy
- Unit tests: Component isolation
- Integration tests: Command + MCP interaction
- E2E tests: CLI behavior validation
- Coverage: Jest with ts-jest

### Documentation
- CLAUDE.md: Project instructions for AI
- README.md: User-facing documentation
- Inline: Only when logic isn't self-evident

## Known Issues & Limitations

### Current
- None (adk-v2-fase1 complete and stable)

### Technical Debt
- worktree-utils.ts: 15.5% coverage (not critical, utility functions)
- task-parser.ts: 67% coverage (planned improvements in future phases)
- feature.ts: 9% coverage (large file, complex workflows, needs refactoring)

## Active Decisions

### ADK v2 Architecture
- **Phase 1**: ✅ MCP Memory RAG (adk-v2-fase1)
- **Phase 2**: Session Management (planned)
- **Phase 3**: Context Compactor (planned)
- **Phase 4**: Constitution/Steering (planned)
- **Phase 5**: Git Commits as Checkpoints (planned)
- **Phase 6**: Resilience & Observability (planned)

### Provider Strategy
- **Memory Provider**: MCP with local fallback
- **Rationale**: Offline-first with semantic search when available
- **Implementation**: Auto-detection in MemoryMCP

### Queue Strategy
- **Debounce**: 2 seconds (not throttle)
- **Rationale**: Batch related changes, prevent redundant indexing
- **Implementation**: Timer reset on each enqueue

## Next Steps

### Immediate (adk-v2-fase1)
1. QA Phase: Comprehensive quality checks
2. Documentation review
3. Merge to main branch

### Short-term (ADK v2)
1. Phase 2: Session Management
2. Phase 3: Context Compactor
3. Performance optimization

### Long-term
1. Plugin system for extensibility
2. Multi-language support
3. Cloud-based memory sync

## Team Conventions

- **Branch naming**: `feature/<name>`, `fix/<name>`
- **Commit format**: `type(scope): description`
- **PR process**: Review + tests passing + coverage >= 80%
- **Versioning**: Semantic versioning (major.minor.patch)

## External Resources

- MCP Documentation: https://modelcontextprotocol.io/
- CADD Framework: .claude/plans/features/adk-v2/README.md
- Claude Code: https://claude.ai/code
