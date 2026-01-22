# Tasks: adk-v2-fase1 (MCP Memory RAG)

**Data:** 2026-01-21
**Status:** Planning
**Input:** research.md, prd.md

---

## Fase 1: Foundation (Benchmark & Types)

### Task 1: Benchmark MCP Providers
- Tipo: Research
- Prioridade: P0
- Dependencias: nenhuma
- Estimativa: 4-6h
- Output: `.claude/plans/features/adk-v2-fase1/mcp-benchmark.md`
- Acceptance Criteria:
  - [ ] Testar `@yikizi/mcp-local-rag` com corpus real (`.claude/plans/`, `.claude/memory/`)
  - [ ] Testar `mcp-memory-service` com mesmo corpus
  - [ ] Medir: recall cross-language (target: 80%), precision top-5 (target: 85%), response time p95 (target: <100ms)
  - [ ] Documentar memory usage de cada provider
  - [ ] Escolher provider com justificativa documentada
  - [ ] Documentar setup instructions do provider escolhido

---

### Task 2: Testes de Types MCP Memory
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1 (benchmark concluído)
- Output: `tests/types/mcp-memory.test.ts`
- Acceptance Criteria:
  - [ ] Testes para `MemoryDocument` type validation
  - [ ] Testes para `MemoryQuery` type validation
  - [ ] Testes para `MemoryResult` type validation
  - [ ] Testes para `MemoryConfig` Zod schema (válido e inválido)
  - [ ] Testes para type guards (`isMemoryDocument`, `isMemoryResult`)
  - [ ] Coverage >= 100% para types (são simples)

---

### Task 3: Implementar Types MCP Memory
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 2 (testes escritos)
- Output: `src/types/mcp-memory.ts`
- Acceptance Criteria:
  - [ ] Interface `MemoryDocument` com campos: id, content, metadata, embedding?
  - [ ] Interface `MemoryQuery` com campos: query, options (limit, threshold, hybrid)
  - [ ] Interface `MemoryResult` com campos: documents, scores, timings
  - [ ] Zod schema `MemoryConfigSchema` com validação
  - [ ] Type guards: `isMemoryDocument()`, `isMemoryResult()`
  - [ ] Export em `src/types/index.ts`
  - [ ] Todos os testes de Task 2 passando

---

### Task 4: Testes de Config Memory
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 3 (types implementados)
- Output: `tests/utils/memory-config.test.ts`
- Acceptance Criteria:
  - [ ] Testes para `loadMemoryConfig()` - arquivo existente
  - [ ] Testes para `loadMemoryConfig()` - arquivo não existente (retorna defaults)
  - [ ] Testes para `saveMemoryConfig()` - salva corretamente
  - [ ] Testes para merge com defaults
  - [ ] Testes para validação de config inválida
  - [ ] Testes para ignorePatterns (arquivos sensíveis)

---

### Task 5: Implementar Config Memory
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 4 (testes escritos)
- Output: `src/utils/memory-config.ts`, `.adk/memory.json` (template)
- Acceptance Criteria:
  - [ ] Função `loadMemoryConfig()` seguindo padrão de `config.ts`
  - [ ] Função `saveMemoryConfig()` com sanitização
  - [ ] Defaults otimizados conforme PRD Seção 12.D refinada
  - [ ] Schema validado com Zod
  - [ ] Template `.adk/memory.json` com valores default
  - [ ] Todos os testes de Task 4 passando

---

## Fase 2: Core Implementation (Wrapper & Commands)

### Task 6: Testes de MemoryMCP Wrapper
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 5 (config implementada)
- Output: `tests/utils/memory-mcp.test.ts`
- Acceptance Criteria:
  - [ ] Testes para `index()` - indexação bem sucedida
  - [ ] Testes para `index()` - falha de conexão MCP
  - [ ] Testes para `recall()` - busca semântica
  - [ ] Testes para `recall()` - fallback para keyword search
  - [ ] Testes para `recall()` - híbrido (semantic + keyword)
  - [ ] Testes para `recall()` - threshold filtering
  - [ ] Testes para retry logic (max 3 attempts)
  - [ ] Testes para timeout handling (5s default)
  - [ ] Testes para `archiveForCompaction()` (preparação Fase 3)
  - [ ] Testes para `recoverArchived()`
  - [ ] Coverage >= 80%

---

### Task 7: Implementar MemoryMCP Wrapper
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 6 (testes escritos)
- Output: `src/utils/memory-mcp.ts`
- Acceptance Criteria:
  - [ ] Classe `MemoryMCP` com conexão configurável ao MCP server
  - [ ] Método `index(content, metadata): Promise<IndexResult>`
  - [ ] Método `recall(query, options): Promise<MemoryResult>`
  - [ ] Método `archiveForCompaction(content, metadata): Promise<string>`
  - [ ] Método `recoverArchived(archiveId): Promise<string>`
  - [ ] Fallback para `simpleSearch()` quando MCP indisponível
  - [ ] Retry logic: max 3 attempts com exponential backoff
  - [ ] Timeout: 5s default (configurável)
  - [ ] Logging de performance metrics
  - [ ] Todos os testes de Task 6 passando

---

### Task 8: Testes de Hybrid Search
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 7 (wrapper implementado)
- Output: `tests/utils/hybrid-search.test.ts`
- Acceptance Criteria:
  - [ ] Testes para combinação de scores (semantic 0.7, keyword 0.3)
  - [ ] Testes para reranking de resultados
  - [ ] Testes para weights configuráveis
  - [ ] Testes para edge cases (empty results, single result)

---

### Task 9: Implementar Hybrid Search
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 8 (testes escritos)
- Output: Integração em `src/utils/memory-mcp.ts`
- Acceptance Criteria:
  - [ ] Algoritmo de busca híbrida com pesos configuráveis
  - [ ] Default: semantic 0.7, keyword 0.3
  - [ ] Reranking dos resultados combinados
  - [ ] Todos os testes de Task 8 passando

---

### Task 10: Testes de Comando `adk memory index`
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 7 (wrapper implementado)
- Output: `tests/commands/memory-index.test.ts`
- Acceptance Criteria:
  - [ ] Testes para `--file <path>` - arquivo único
  - [ ] Testes para `--dir <path>` - diretório
  - [ ] Testes para `--filter <pattern>` - extensão
  - [ ] Testes para `--force` - re-indexar
  - [ ] Testes para skip de arquivos binários
  - [ ] Testes para skip de arquivos sensíveis (.env, credentials)
  - [ ] Testes para spinner e progresso
  - [ ] Testes para resumo final

---

### Task 11: Implementar Comando `adk memory index`
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 10 (testes escritos)
- Output: `src/commands/memory.ts` (método `index()`)
- Acceptance Criteria:
  - [ ] Método `index()` na classe `MemoryCommand`
  - [ ] Opção `--file <path>` para arquivo individual
  - [ ] Opção `--dir <path>` para diretório
  - [ ] Opção `--filter <pattern>` para filtrar por extensão
  - [ ] Opção `--force` para re-indexar
  - [ ] Skip automático de binários e sensíveis
  - [ ] Spinner com progresso
  - [ ] Resumo final de arquivos indexados
  - [ ] Todos os testes de Task 10 passando

---

### Task 12: Testes de Comando `adk memory recall` Modificado
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 7 (wrapper implementado)
- Output: `tests/commands/memory-recall.test.ts`
- Acceptance Criteria:
  - [ ] Testes para busca semântica (default)
  - [ ] Testes para fallback quando MCP indisponível
  - [ ] Testes para `--hybrid` flag
  - [ ] Testes para `--limit <n>` (default: 5)
  - [ ] Testes para `--threshold <0-1>` (default: 0.7)
  - [ ] Testes para output formatado com scores

---

### Task 13: Modificar Comando `adk memory recall`
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 12 (testes escritos)
- Output: `src/commands/memory.ts` (método `recall()` modificado)
- Acceptance Criteria:
  - [ ] Usar MCP Memory como primary search
  - [ ] Fallback para keyword search se MCP falhar
  - [ ] Opção `--hybrid` para busca combinada
  - [ ] Opção `--limit <n>` (default: 5)
  - [ ] Opção `--threshold <0-1>` (default: 0.7)
  - [ ] Output formatado com scores de relevância
  - [ ] Mensagem informativa quando usando fallback
  - [ ] Todos os testes de Task 12 passando

---

### Task 14: Registrar Novos Subcomandos no CLI
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 11, Task 13 (comandos implementados)
- Output: `src/cli.ts`
- Acceptance Criteria:
  - [ ] Registrar subcomando `memory index` com opções
  - [ ] Atualizar subcomando `memory recall` com novas opções
  - [ ] Help text atualizado
  - [ ] Validação de argumentos

---

## Fase 3: Automation (Queue & Hook)

### Task 15: Testes de MemoryIndexQueue
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 7 (wrapper implementado)
- Output: `tests/utils/memory-index-queue.test.ts`
- Acceptance Criteria:
  - [ ] Testes para `enqueue()` - adiciona arquivo à fila
  - [ ] Testes para debounce (mesmo arquivo em <2s não duplica)
  - [ ] Testes para `processQueue()` - processa fila
  - [ ] Testes para `getPendingCount()`
  - [ ] Testes para persistência em `.adk/memory-queue.json`
  - [ ] Testes para batch processing

---

### Task 16: Implementar MemoryIndexQueue
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 15 (testes escritos)
- Output: `src/utils/memory-index-queue.ts`
- Acceptance Criteria:
  - [ ] Classe `MemoryIndexQueue`
  - [ ] Método `enqueue(filePath): void` com debounce de 2s
  - [ ] Método `processQueue(): Promise<void>`
  - [ ] Método `getPendingCount(): number`
  - [ ] Persistência em `.adk/memory-queue.json`
  - [ ] Todos os testes de Task 15 passando

---

### Task 17: Testes de Comandos de Queue
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 16 (queue implementada)
- Output: `tests/commands/memory-queue.test.ts`
- Acceptance Criteria:
  - [ ] Testes para `adk memory queue <path>`
  - [ ] Testes para `adk memory process-queue`
  - [ ] Testes para `--batch-size <n>`

---

### Task 18: Implementar Comandos de Queue
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 17 (testes escritos)
- Output: `src/commands/memory.ts` (métodos `queue()`, `processQueue()`)
- Acceptance Criteria:
  - [ ] Método `queue(filePath)` que enfileira arquivo
  - [ ] Método `processQueue(options)` que processa fila
  - [ ] Opção `--batch-size <n>` (default: 10)
  - [ ] Registrar em `src/cli.ts`
  - [ ] Todos os testes de Task 17 passando

---

### Task 19: Testes de Hook post-write-index
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 18 (comandos de queue implementados)
- Output: `tests/hooks/post-write-index.test.ts`
- Acceptance Criteria:
  - [ ] Testes para trigger em arquivos `.claude/*`
  - [ ] Testes para skip de arquivos fora do escopo
  - [ ] Testes para execução assíncrona (não bloqueia)
  - [ ] Testes para fail-silent pattern (exit 0 sempre)

---

### Task 20: Implementar Hook post-write-index
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 19 (testes escritos)
- Output: `.claude/hooks/post-write-index.sh`
- Acceptance Criteria:
  - [ ] Trigger apenas para arquivos em `.claude/*`
  - [ ] Execução assíncrona com `&`
  - [ ] Usa `adk memory queue <path>` para enfileirar
  - [ ] Fail-silent: `exit 0` sempre
  - [ ] Execução < 50ms
  - [ ] Todos os testes de Task 19 passando

---

### Task 21: Registrar Hook em settings.json
- Tipo: Config
- Prioridade: P1
- Dependencias: Task 20 (hook implementado)
- Output: `.claude/settings.json`
- Acceptance Criteria:
  - [ ] Hook adicionado em `PostToolUse:Write`
  - [ ] Ordem correta: após `sync-state.sh`
  - [ ] Permissões de execução verificadas

---

## Fase 4: Integration & Documentation

### Task 22: Configurar MCP Server
- Tipo: Config
- Prioridade: P0
- Dependencias: Task 1 (benchmark concluído)
- Output: `.claude/mcp.json`
- Acceptance Criteria:
  - [ ] Configuração do provider escolhido
  - [ ] Connection string configurada
  - [ ] Tools expostos: `memory_index`, `memory_recall`
  - [ ] Timeout settings definidos
  - [ ] Documentação de setup

---

### Task 23: Testes de Integração E2E
- Tipo: Test
- Prioridade: P0
- Dependencias: Todas as tasks de implementação (6-21)
- Output: `tests/integration/memory-e2e.test.ts`
- Acceptance Criteria:
  - [ ] Teste E2E: index → recall → resultados corretos
  - [ ] Teste E2E: busca cross-language (auth → autenticação)
  - [ ] Teste E2E: fallback quando MCP offline
  - [ ] Teste E2E: hook auto-indexa ao escrever
  - [ ] Teste E2E: queue processa corretamente
  - [ ] Performance: recall < 100ms (p95)

---

### Task 24: Validar Cobertura de Testes
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 23 (E2E implementados)
- Output: Coverage report
- Acceptance Criteria:
  - [ ] Coverage >= 80% em `memory-mcp.ts`
  - [ ] Coverage >= 80% em `memory-config.ts`
  - [ ] Coverage >= 80% em `memory-index-queue.ts`
  - [ ] Coverage >= 80% nos comandos modificados
  - [ ] Nenhum path crítico sem teste

---

### Task 25: Documentar em CLAUDE.md
- Tipo: Documentation
- Prioridade: P1
- Dependencias: Task 23 (E2E passando)
- Output: `CLAUDE.md` (seção MCP Memory)
- Acceptance Criteria:
  - [ ] Nova seção "MCP Memory" com overview
  - [ ] Documentar `adk memory index` com exemplos
  - [ ] Documentar `adk memory recall` com exemplos
  - [ ] Documentar busca híbrida
  - [ ] Troubleshooting guide
  - [ ] Configuração do MCP server

---

### Task 26: Atualizar README com Setup
- Tipo: Documentation
- Prioridade: P2
- Dependencias: Task 25 (CLAUDE.md documentado)
- Output: `README.md` (se existir, ou em CLAUDE.md)
- Acceptance Criteria:
  - [ ] Quick start para MCP Memory
  - [ ] Requisitos (MCP server, SQLite)
  - [ ] Exemplo de uso básico

---

## Resumo de Dependências

```
Task 1 (Benchmark) ─────────────────────────────────────────┐
       │                                                     │
       ├─── Task 2 (Test Types) ─── Task 3 (Impl Types)      │
       │                                   │                  │
       │    Task 4 (Test Config) ─── Task 5 (Impl Config)    │
       │                                   │                  │
       │                                   ▼                  │
       │               ┌─── Task 6 (Test Wrapper)            │
       │               │           │                          │
       │               │    Task 7 (Impl Wrapper) ◀──────────┘
       │               │           │
       │               │    Task 8 (Test Hybrid) ─── Task 9 (Impl Hybrid)
       │               │           │
       │               ├─── Task 10 (Test Index) ─── Task 11 (Impl Index)
       │               │           │                        │
       │               ├─── Task 12 (Test Recall) ─ Task 13 (Impl Recall)
       │               │                                    │
       │               │                         Task 14 (CLI Register) ◀─┘
       │               │
       │               ├─── Task 15 (Test Queue) ─── Task 16 (Impl Queue)
       │               │                                    │
       │               │    Task 17 (Test QueueCmd) ─ Task 18 (Impl QueueCmd)
       │               │                                    │
       │               │    Task 19 (Test Hook) ─── Task 20 (Impl Hook)
       │               │                                    │
       │               │                         Task 21 (Register Hook)
       │               │
       │               └─────────────────────────────────────┐
       │                                                     │
       ├─── Task 22 (Config MCP)                             │
       │                                                     │
       └──────────────────── Task 23 (E2E Tests) ◀───────────┘
                                    │
                             Task 24 (Coverage)
                                    │
                             Task 25 (CLAUDE.md)
                                    │
                             Task 26 (README)
```

---

## Prioridades

### P0 - Bloqueadores (Must Have)
- Task 1: Benchmark MCP Providers
- Task 2-3: Types
- Task 4-5: Config
- Task 6-7: MemoryMCP Wrapper
- Task 10-11: Comando index
- Task 12-13: Comando recall
- Task 14: CLI Register
- Task 22: Config MCP Server
- Task 23: E2E Tests
- Task 24: Coverage

### P1 - Importantes (Should Have)
- Task 8-9: Hybrid Search
- Task 15-16: Queue System
- Task 17-18: Queue Commands
- Task 19-20: Hook
- Task 21: Register Hook
- Task 25: CLAUDE.md

### P2 - Nice to Have
- Task 26: README

---

## Métricas de Sucesso

| Métrica | Target | Task de Validação |
|---------|--------|-------------------|
| Recall cross-language | 80% | Task 23 |
| Precision top-5 | 85% | Task 23 |
| Response time p95 | < 100ms | Task 23 |
| Test coverage | >= 80% | Task 24 |
| Fallback success | 100% | Task 23 |

---

**Criado em:** 2026-01-21
**Total de Tasks:** 26
**Estimativa Total:** ~3 semanas
**Próxima ação:** Executar Task 1 (Benchmark)
