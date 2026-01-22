# adk-v2-fase1 Context

Inherits: .claude/memory/project-context.md

## Feature-specific Context

MCP Memory RAG - Sistema de busca semântica com embeddings para recuperação inteligente de contexto. Implementação completa em 7 fases com 93.93% de cobertura de testes.

## Status: ✅ IMPLEMENTAÇÃO COMPLETA

Todas as 7 fases foram implementadas, testadas e documentadas:
- Fase 0-2: Foundation (Types, Config, MCP Wrapper)
- Fase 3-4: Core Commands (Index, Recall)
- Fase 5-6: Automation (Queue, Hook)
- Fase 7: Testing & Documentation

## Architecture Overview

### Core Components

**MemoryMCP** (`src/utils/memory-mcp.ts`)
- Abstração para MCP Memory server
- Métodos: `connect()`, `disconnect()`, `index()`, `recall()`
- Fallback automático para provider local
- Coverage: 90.81%

**MemoryConfig** (`src/utils/memory-config.ts`)
- Carrega configuração de env vars e `.adk/memory-config.json`
- Suporta providers: `mcp` (default) e `local`
- Validação com Zod schemas
- Coverage: 95.83%

**MemoryIndexQueue** (`src/utils/memory-index-queue.ts`)
- Fila com debounce de 2s para batching
- Deduplicação automática de paths
- Processamento em background
- Coverage: 91.66%

**Auto-indexation Hook** (`.claude/hooks/post-write-index.sh`)
- Detecta writes em `.claude/**/*.md`
- Enfileira automaticamente para indexação
- Operação não-bloqueante (background)

### CLI Commands

```bash
adk memory index <file>              # Indexar arquivo
adk memory recall "query"            # Busca semântica
adk memory queue <file>              # Enfileirar para indexação
adk memory process-queue             # Processar fila manualmente
```

## Dependencies

### External
- MCP Memory Server (opcional, fallback para local)
- Zod (validação de schemas)
- fs-extra (file operations)

### Internal
- src/types/mcp-memory.ts (tipos e schemas)
- src/utils/logger.ts (logging)
- src/commands/memory.ts (CLI commands)

## Related Files

### Implementation
- `src/types/mcp-memory.ts` - Types e Zod schemas
- `src/utils/memory-config.ts` - Configuration loader
- `src/utils/memory-mcp.ts` - MCP wrapper
- `src/utils/memory-index-queue.ts` - Queue com debounce
- `src/commands/memory.ts` - CLI commands
- `src/cli.ts` - Command registration

### Tests
- `tests/types/mcp-memory.test.ts` - Type validation tests
- `tests/utils/memory-config.test.ts` - Config tests (19 tests)
- `tests/utils/memory-mcp.test.ts` - MCP wrapper tests (32 tests)
- `tests/utils/memory-index-queue.test.ts` - Queue tests (21 tests)
- `tests/commands/memory-index.test.ts` - Index command tests
- `tests/commands/memory-recall.test.ts` - Recall command tests
- `tests/e2e/memory-e2e.test.ts` - E2E tests (15 tests)

### Templates
- `templates/claude-structure/hooks/post-write-index.sh` - Hook para auto-indexação
- `templates/claude-structure/settings.json` - Hook registration

### Documentation
- `CLAUDE.md` - Comprehensive system documentation
- `.claude/plans/features/adk-v2-fase1/prd.md` - Product requirements
- `.claude/plans/features/adk-v2-fase1/research.md` - Research findings
- `.claude/plans/features/adk-v2-fase1/tasks.md` - Task breakdown
- `.claude/plans/features/adk-v2-fase1/implementation-plan.md` - Implementation plan

## Technical Decisions

### Provider Strategy
- **Decision**: MCP Memory com fallback para local
- **Rationale**: Permite uso offline enquanto mantém capacidade de semantic search quando disponível
- **Implementation**: MemoryMCP detecta falhas de conexão e usa LocalMemoryProvider

### Queue Strategy
- **Decision**: Debounce (não throttle) de 2 segundos
- **Rationale**: Previne indexação redundante durante mudanças rápidas, batching natural
- **Implementation**: Timer reset a cada novo enqueue, "last write wins"

### Hook Integration
- **Decision**: PostToolUse hook para auto-indexação
- **Rationale**: Indexação automática sem intervenção manual, UX seamless
- **Implementation**: Hook detecta `.claude/**/*.md` e enfileira em background

### Test Strategy
- **Decision**: Unit tests + E2E tests separados
- **Rationale**: Unit tests para componentes isolados, E2E para CLI behavior
- **Coverage**: 93.93% overall, exceeding 80% target

## Performance Metrics

- Index single file: ~100-300ms
- Index 10 files: ~1-3s (batched)
- Recall query: ~50-200ms
- Queue processing: 2s debounce (configurable)

## Known Limitations

1. MCP server deve estar instalado para semantic search (fallback para keyword)
2. Indexação é assíncrona via queue (não imediata)
3. Patterns de indexação limitados a `.claude/**/*.md` por padrão (configurável)

## Next Steps

1. **QA Phase**: Comprehensive quality checks
2. **Documentation Review**: User-facing documentation
3. **Merge to Main**: After QA approval
4. **Future Enhancements**: Session management, context compactor (ADK v2 Phases 2-6)
