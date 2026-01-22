# Research: ADK v2 - Técnicas Avançadas para Agentes de Longa Duração

**Data:** 2026-01-20
**Feature:** adk-v2
**Status:** Research Completed

---

## 1. Current State Analysis

### 1.1 ADK Architecture Overview

O ADK é um CLI toolkit que implementa o framework CADD (Context-Agentic Development & Delivery) para desenvolvimento assistido por IA. A arquitetura atual consiste em:

**Camadas:**
1. **CLI Layer** (`src/cli.ts`) - Commander.js com 13 comandos principais
2. **Commands Layer** (`src/commands/`) - 13 módulos de comando class-based
3. **Utils Layer** (`src/utils/`) - 38 módulos utilitários
4. **Types Layer** (`src/types/`) - 12 módulos de definição de tipos
5. **Providers Layer** (`src/providers/`) - Integração com ferramentas externas (ClickUp, local)

**Estado de Implementação (referenciado no PRD):**
- 94% implementado (66/70 features)
- 4 componentes críticos faltando: MCP Memory RAG, SessionManager, ContextCompactor, Constitution/Steering

### 1.2 Sistema de Busca Atual (Problema Core)

O sistema atual em `src/utils/memory-search.ts:17-29` usa busca literal por keywords:

```typescript
function simpleSearch(text: string, query: string): number {
  const words = lowerQuery.split(/\s+/)
  for (const word of words) {
    if (lowerText.includes(word)) matches++  // LITERAL MATCH ONLY
  }
}
```

**Limitações:**
- "auth" NÃO encontra "autenticacao"
- "user" NÃO encontra "usuario"
- Sem suporte multilingual
- Recall estimado em 20% para queries cross-language

### 1.3 Sistema de Estado Existente

O ADK já possui um sistema robusto de Progress Sync com 7 componentes:

| Componente | Arquivo | Status |
|------------|---------|--------|
| StateManager | `src/utils/state-manager.ts` | ✅ Pronto |
| SyncEngine | `src/utils/sync-engine.ts` | ✅ Pronto |
| TaskParser | `src/utils/task-parser.ts` | ✅ Pronto |
| ProgressConflict | `src/utils/progress-conflict.ts` | ✅ Pronto |
| HistoryTracker | `src/utils/history-tracker.ts` | ✅ Pronto |
| SnapshotManager | `src/utils/snapshot-manager.ts` | ✅ Pronto |
| MetricsCollector | `src/utils/metrics-collector.ts` | ✅ Pronto |

**Funcionalidades já implementadas:**
- Snapshots com auto-cleanup (10 mais recentes)
- History tracking com auto-prune (50 entradas)
- Thread-safe operations com mutex locks
- Atomic writes via temp + rename
- Conflict resolution strategies (merge, tasks-wins, progress-wins)

### 1.4 Sistema de Hooks Existente

Configurado em `.claude/settings.json` com 6 hooks ativos:

| Hook | Evento | Arquivo |
|------|--------|---------|
| inject-focus.sh | UserPromptSubmit | Injeta contexto de feature ativa |
| scope-check.sh | PreToolUse (Write/Edit) | Alerta escrita fora do escopo |
| validate-bash.sh | PreToolUse (Bash) | Bloqueia comandos perigosos |
| post-write.sh | PostToolUse (Write) | Validações pós-escrita |
| update-state.sh | Stop | Atualiza estado no fim de sessão |
| context-recall.sh | UserPromptSubmit | Recall de contexto |

### 1.5 Sistema de Memória Existente

O ADK possui sistema de memória tiered em `src/utils/dynamic-context.ts`:

```typescript
const TIER_WEIGHTS: Record<MemoryTier | 'decision', number> = {
  project: 10,
  feature: 25,
  phase: 35,
  session: 30,
  decision: 30,
}
```

**Funcionalidades:**
- Keyword extraction com stop words
- Stem matching parcial (50% match para radicais)
- Context cache com TTL (5 min default)
- Limite de linhas (7000 warning threshold)
- Memory compression via Claude

### 1.6 Sistema de Resiliência Parcial

`src/utils/retry.ts` já implementa retry com backoff:

```typescript
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 8000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'rate_limit', 'overloaded'],
}
```

**Falta:** Circuit breaker, fallback chain, jitter.

---

## 2. Similar Components

### 2.1 StateManager (Base para SessionManager)

`src/utils/state-manager.ts` (237 linhas) - Será estendido:

**Métodos existentes:**
- `loadUnifiedState(feature)` - Carrega e merge progress.md + tasks.md
- `saveUnifiedState(feature, state)` - Atomic write com temp + rename
- `calculateProgress(tasks)` - Progress % baseado em task status
- `mergeProgressAndTasks()` - Merge de fontes

**Padrões usados:**
- Environment variable override para testes (`TEST_FEATURE_PATH`)
- Graceful degradation (retorna default state se arquivo inválido)
- Type guards para validação (`isValidState()`)

### 2.2 SnapshotManager (Padrão para Checkpoints)

`src/utils/snapshot-manager.ts` (138 linhas) - Padrão a seguir:

**Características:**
- Semantic naming: `{trigger}-{date}-{timestamp}`
- Auto-cleanup: mantém 10 snapshots
- Restore com pre-restore snapshot automático
- Meta.json com audit trail

### 2.3 HistoryTracker (Padrão para Audit Trail)

`src/utils/history-tracker.ts` (117 linhas) - Thread-safe:

**Características:**
- Mutex pattern para concurrent access
- Auto-prune para 50 entradas
- Atomic writes via temp file

### 2.4 Memory Command (Padrão para Commands)

`src/commands/memory.ts` (685 linhas) - Padrão de comando:

**Métodos:**
- `save`, `load`, `view`, `compact`, `search`, `sync`, `recall`, `link`, `unlink`, `export`, `status`

**Padrões:**
- Class-based singleton: `export const memoryCommand = new MemoryCommand()`
- Ora spinners para feedback
- Logger para mensagens
- Error handling com process.exit(1)

### 2.5 Retry (Base para Resiliência)

`src/utils/retry.ts` (70 linhas) - Padrão funcional:

```typescript
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<RetryResult<T>>
```

### 2.6 Agent Command (Padrão para --resume)

`src/commands/agent.ts` (324 linhas) - Será estendido:

**Métodos a adicionar:**
- `--resume` flag para `run`
- `sessions` subcommand

---

## 3. Technical Stack

### 3.1 Dependências Atuais

**Runtime:**
- `commander` v14 - CLI parsing
- `chalk` v5.6 - Terminal colors
- `ora` v9 - Spinners
- `inquirer` v13 - Interactive prompts
- `fs-extra` v11.3 - File operations
- `fuse.js` v7.1 - Fuzzy search (já presente!)
- `simple-git` v3.30 - Git operations
- `zod` v3.25 - Schema validation
- `dotenv` v17 - Environment variables

**Dev:**
- `typescript` v5.3
- `jest` v30 - Testing
- `biome` v2.3 - Lint/format

### 3.2 Dependências a Adicionar

| Dependência | Propósito | Criticidade |
|-------------|-----------|-------------|
| MCP Server (@yikizi/mcp-local-rag ou mcp-memory-service) | Semantic search | P0 - Bloqueador |
| @anthropic-ai/sdk (opcional) | Token counting via API | P1 |
| tiktoken (opcional) | Token counting offline | P1 - Fallback |
| @opentelemetry/sdk-node (opcional) | Tracing | P2 |

### 3.3 Node.js & TypeScript Config

- Node.js >= 18.0.0
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Node imports com `node:` protocol

---

## 4. Files to Create

### 4.1 Fase 0 - Hooks de Enforcement (Imediato)

- [ ] `.claude/hooks/session-bootstrap.sh` - SessionStart hook para contexto inicial
- [ ] `.claude/hooks/session-checkpoint.sh` - Stop hook para checkpoint automático
- [ ] `.claude/hooks/validate-tdd.sh` - PreToolUse para validação TDD
- [ ] `.claude/hooks/sync-state.sh` - PostToolUse para sync de estado
- [ ] `.claude/hooks/task-complete.sh` - Hook para commit automático após task
- [ ] `.claude/hooks/check-task-complete.sh` - Detecção de task completion

### 4.2 Fase 1 - MCP Memory RAG

- [ ] `src/utils/memory-mcp.ts` - Wrapper para MCP server de semantic search
- [ ] `src/types/mcp-memory.ts` - Types para MCP Memory
- [ ] `.adk/memory.json` - Configuração do MCP Memory
- [ ] `.claude/mcp.json` - Configuração do MCP server (Claude Code)
- [ ] `tests/utils/memory-mcp.test.ts` - Testes

### 4.3 Fase 2 - Session Management

- [ ] `src/types/session.ts` - Types de sessão
- [ ] `templates/claude-progress.txt` - Template de progresso plain text
- [ ] `tests/utils/session-manager.test.ts` - Testes

### 4.4 Fase 3 - Context Compactor

- [ ] `src/utils/token-counter.ts` - Contagem de tokens (API + fallback)
- [ ] `src/utils/context-compactor.ts` - Compactação hierárquica
- [ ] `src/types/context-compactor.ts` - Types
- [ ] `tests/utils/token-counter.test.ts` - Testes
- [ ] `tests/utils/context-compactor.test.ts` - Testes

### 4.5 Fase 4 - Constitution/Steering

- [ ] `.claude/constitution.md` - Princípios imutáveis
- [ ] `.claude/context/product.md` - Contexto de produto
- [ ] `.claude/context/architecture.md` - Contexto arquitetural
- [ ] `.claude/context/tech-stack.md` - Tech stack
- [ ] `.claude/powers/security.json` - Power de segurança
- [ ] `.claude/powers/testing.json` - Power de testing
- [ ] `.claude/powers/database.json` - Power de database
- [ ] `src/utils/context-loader.ts` - Powers pattern loader
- [ ] `src/commands/validate.ts` - Comando de validação
- [ ] `tests/utils/context-loader.test.ts` - Testes

### 4.6 Fase 5 - Resiliência

- [ ] `src/utils/circuit-breaker.ts` - Circuit breaker pattern
- [ ] `src/utils/memory-pruner.ts` - Prevenção de memory fading
- [ ] `src/types/resilience.ts` - Types de resiliência
- [ ] `tests/utils/circuit-breaker.test.ts` - Testes
- [ ] `tests/utils/memory-pruner.test.ts` - Testes

### 4.7 Fase 6 - Observabilidade

- [ ] `src/utils/observability.ts` - Integração OpenTelemetry
- [ ] `src/commands/diagnostics.ts` - Health check command
- [ ] `tests/utils/observability.test.ts` - Testes
- [ ] `tests/commands/diagnostics.test.ts` - Testes

---

## 5. Files to Modify

### 5.1 Core Modifications

- [ ] `src/utils/state-manager.ts`
  - Adicionar `resumeFromSnapshot(feature, snapshotId?)`
  - Adicionar `createContextSummary(feature)`
  - Adicionar `completeTask(feature, taskName)`

- [ ] `src/utils/memory-search.ts`
  - Adicionar integração com MCP Memory para busca semântica
  - Manter keyword search como fallback

- [ ] `src/commands/agent.ts`
  - Adicionar flag `--resume` no `run`
  - Adicionar subcommand `sessions`

- [ ] `src/commands/memory.ts`
  - Adicionar `index` (indexação manual)
  - Modificar `recall` para usar MCP Memory

- [ ] `src/commands/feature.ts`
  - Adicionar flag `--commit` no `implement`
  - Integrar com task completion hooks

### 5.2 Configuration Files

- [ ] `.claude/settings.json`
  - Adicionar novos hooks (SessionStart, Stop, PreToolUse para TDD, etc.)

- [ ] `CLAUDE.md`
  - Expandir com técnicas obrigatórias ADK
  - Documentar novos hooks e suas funções

### 5.3 CLI Registration

- [ ] `src/cli.ts`
  - Registrar `adk validate` command
  - Registrar `adk diagnostics` command
  - Adicionar flags `--commit` e `--resume` onde aplicável

---

## 6. Dependencies

### 6.1 External Dependencies

| Dependência | Tipo | Status | Risco |
|-------------|------|--------|-------|
| MCP Server | NPM/External | A instalar | P0 - Bloqueador se falhar |
| Anthropic SDK | NPM | Opcional | Baixo - fallback existe |
| tiktoken | NPM | Opcional | Baixo - fallback existe |
| OpenTelemetry | NPM | Opcional | Baixo - opcional |

### 6.2 Internal Dependencies

| Módulo | Dependido Por | Status |
|--------|---------------|--------|
| StateManager | SessionManager extensions | ✅ Pronto |
| SnapshotManager | Context checkpoints | ✅ Pronto |
| HistoryTracker | Transition tracking | ✅ Pronto |
| RetryConfig | Resilience layer | ✅ Pronto |
| MemorySearch | MCP Memory integration | ✅ A modificar |

### 6.3 Dependency Graph

```
MCP Memory RAG ◀── P0 BLOQUEADOR
       │
       ├──────────────────────┐
       ▼                      ▼
SessionManager           Constitution/
(estende StateManager)   Steering
       │                      │
       ▼                      ▼
ContextCompactor         ContextLoader
(usa MCP para arquivar)  (Powers pattern)
       │
       ▼
  Resilience + Observability
```

---

## 7. Risks

### 7.1 Riscos Técnicos

| # | Risco | Impacto | Probabilidade | Mitigação |
|---|-------|---------|---------------|-----------|
| R1 | Provider MCP tem single maintainer | Alto | Média | Benchmark 2+ providers; wrapper abstrato; fallback keyword |
| R2 | Token counting via API adiciona latência | Médio | Alta | Cache com hash; fallback tiktoken offline |
| R3 | Hooks bloqueiam operações do usuário | Alto | Baixa | Async com timeout 2s; fallback silencioso |
| R4 | Memory fading com CLAUDE.md grande | Alto | Alta | MemoryPruner (max 500 linhas); Powers pattern |
| R5 | Commits automáticos poluem histórico | Médio | Média | Apenas em task completion; squash opcional |
| R6 | Debugging complexo com múltiplos hooks | Médio | Alta | Verbose mode; `adk diagnostics`; testes unitários |
| R7 | Incompatibilidade futura Claude Code | Alto | Baixa | Monitorar changelog; camada de abstração |
| R8 | Overhead de observabilidade | Baixo | Média | Opt-in; sampling configurável; batch |

### 7.2 Riscos de Breaking Changes

| Área | Tipo | Impacto | Mitigação |
|------|------|---------|-----------|
| settings.json | Estrutura de hooks | Baixo | Migração automática |
| memory-search | API changes | Médio | Manter interface; wrapper |
| StateManager | Novos métodos | Baixo | Apenas adições |

### 7.3 Performance Risks

| Operação | Target | Risco | Mitigação |
|----------|--------|-------|-----------|
| Semantic search | < 100ms p95 | MCP lento | Benchmark antes; cache |
| Token counting | 95% accuracy | API latency | Cache + offline fallback |
| Context loading | 60-80% redução | Overhead | Lazy loading; Powers |
| Sync de estado | < 500ms | File I/O | Já otimizado com atomic writes |

---

## 8. Patterns to Follow

### 8.1 Command Pattern (Singleton)

```typescript
class NewCommand {
  async subcommand(args: Args, options: Options): Promise<void> {
    const spinner = ora('Doing something...').start()
    try {
      // work
      spinner.succeed('Success')
    } catch (error) {
      spinner.fail('Failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}
export const newCommand = new NewCommand()
```

### 8.2 Test Pattern (Jest + Temp Dirs)

```typescript
describe('Module', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })
})
```

### 8.3 Hook Pattern (Shell Script)

```bash
#!/bin/bash

# Early exit if precondition not met
if [ ! -f "$REQUIRED_FILE" ]; then
  exit 0
fi

# Do work
echo "Output for user"

# Exit codes: 0 = allow, 2 = block
exit 0
```

### 8.4 Type Pattern (Zod-like validation)

```typescript
interface Config {
  field: string
  optional?: number
}

function isValidConfig(data: unknown): data is Config {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.field === 'string'
}
```

### 8.5 Atomic Write Pattern

```typescript
const tempPath = path.join(os.tmpdir(), `file-${Date.now()}.json`)
await fs.writeJSON(tempPath, data, { spaces: 2 })
await fs.move(tempPath, targetPath, { overwrite: true })
```

### 8.6 Thread-Safe Pattern (Mutex)

```typescript
private locks: Map<string, Promise<void>> = new Map()

private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existingLock = this.locks.get(key)
  let resolve: () => void
  const newLock = new Promise<void>(r => { resolve = r })
  this.locks.set(key, newLock)

  if (existingLock) await existingLock

  try {
    return await fn()
  } finally {
    resolve!()
    if (this.locks.get(key) === newLock) this.locks.delete(key)
  }
}
```

---

## 9. Performance Considerations

### 9.1 Targets (do PRD)

| Operação | Target |
|----------|--------|
| Busca semântica | < 100ms (p95) |
| Token counting | 95%+ precisão |
| Context loading | 60-80% redução tokens |
| Sync de estado | < 500ms (50 tasks) |
| Indexação | Assíncrona (não bloqueante) |

### 9.2 Otimizações Recomendadas

1. **MCP Memory**
   - Indexação assíncrona via queue
   - Cache de queries frequentes
   - Batch de indexações

2. **Token Counting**
   - Cache com hash de conteúdo
   - Offline fallback (tiktoken)
   - Estimativa por caracteres como último recurso

3. **Context Loading (Powers)**
   - Lazy loading baseado em keywords
   - Pre-warming de contextos frequentes
   - LRU cache para contextos

4. **Hooks**
   - Async execution (`&` em bash)
   - Timeout máximo de 2s
   - Fallback silencioso em caso de erro

---

## 10. Security Considerations

### 10.1 Secrets Management

- API tokens APENAS em `.env` (nunca em config.json)
- `.env` no `.gitignore`
- Validação de input em todos comandos CLI
- Secrets NUNCA indexados no MCP Memory

### 10.2 Command Injection

- Hooks usando `execFileNoThrow` (não shell expansion)
- Validação de paths antes de file operations
- Sanitização de user input

### 10.3 Sensitive Data

- Constitution.md pode conter regras de segurança
- MCP Memory deve filtrar arquivos sensíveis (.env, credentials)
- Logs não devem conter secrets

---

## 11. Implementation Order

### Fase 0: Hooks de Enforcement (1-2 dias) - IMEDIATO
1. Criar hooks SessionStart, Stop, TDD validation
2. Atualizar settings.json
3. Expandir CLAUDE.md

### Fase 1: MCP Memory RAG (10-14 dias) - P0 BLOQUEADOR
1. Benchmark de providers (2-3 dias)
2. Implementar wrapper MemoryMCP
3. Comandos index/recall
4. Hook post-write para indexação
5. Testes

### Fase 2: Session Management (5-7 dias)
1. Estender StateManager
2. Template claude-progress.txt
3. --resume flag
4. Comando sessions
5. Testes

### Fase 3: Context Compactor (5-7 dias)
1. Token counter
2. Context compactor com hierarquia
3. Handoff document generator
4. Integração com MCP Memory
5. Testes

### Fase 4: Constitution/Steering + Powers (3-5 dias)
1. Templates de constitution e context
2. Powers pattern JSON
3. ContextLoader
4. Comando validate
5. Testes

### Fase 5: Git Commits como Checkpoints (2-3 dias - paralelo)
1. Hook task-complete.sh
2. Hook check-task-complete.sh
3. Método completeTask no StateManager
4. Flag --commit
5. Integração HistoryTracker

### Fase 6: Resiliência e Observabilidade (5-7 dias)
1. Circuit breaker
2. Memory pruner
3. Integração OpenTelemetry (opcional)
4. Comando diagnostics
5. Testes e CI/CD workflow

---

## 12. Anti-Patterns to Avoid

### 12.1 Do Codebase Atual

1. **NÃO usar concatenação de strings para SQL/queries** - Usar parâmetros
2. **NÃO bloquear operações do usuário** - Hooks devem ser non-blocking
3. **NÃO logar secrets** - Mesmo em modo debug
4. **NÃO criar arquivos sem necessidade** - Preferir edição

### 12.2 Gerais

1. **NÃO compactar memória** - Indexar e recall focado
2. **NÃO criar abstrações prematuras** - YAGNI
3. **NÃO adicionar dependências desnecessárias** - Avaliar peso
4. **NÃO quebrar backward compatibility** - Manter interfaces

---

## 13. Success Metrics

### 13.1 Qualidade de Busca

| Métrica | Baseline | Target |
|---------|----------|--------|
| Recall cross-language | 20% | 80% |
| Precision top-5 | 60% | 85% |
| Response time p95 | N/A | < 100ms |

### 13.2 Produtividade

| Métrica | Target |
|---------|--------|
| Recovery time após overflow | < 30s |
| Taxa commits/tasks | 1:1 |
| Redução tokens (Powers) | 60-80% |

### 13.3 Confiabilidade

| Métrica | Target |
|---------|--------|
| Retry success rate | > 90% |
| Circuit breaker uptime | > 95% |
| Rollback rate | < 5% |

---

## 14. Open Questions

1. **MCP Provider**: `@yikizi/mcp-local-rag` vs `mcp-memory-service`?
   - Requer benchmark com documentos reais do ADK

2. **Token Counting**: Anthropic API vs tiktoken offline?
   - Recomendação: API com cache + tiktoken fallback

3. **Powers Pattern**: Quantos powers iniciais?
   - Sugestão: 3 (security, testing, database) para validar pattern

4. **Observabilidade**: Arize Phoenix vs logs simples?
   - Depende de complexidade de debugging necessária

---

## 15. References

### 15.1 Arquivos Chave do Codebase

- `src/utils/state-manager.ts` - Base para SessionManager
- `src/utils/snapshot-manager.ts` - Padrão para checkpoints
- `src/utils/history-tracker.ts` - Thread-safe pattern
- `src/utils/memory-search.ts` - A ser modificado
- `src/utils/dynamic-context.ts` - Tiered memory atual
- `src/utils/retry.ts` - Base para resiliência
- `src/commands/memory.ts` - Padrão de command
- `.claude/hooks/*.sh` - Padrão de hooks
- `.claude/settings.json` - Configuração de hooks

### 15.2 PRD Sections

- PRD Section 3: Requisitos Funcionais (RF01-RF46)
- PRD Section 4: Requisitos Não-Funcionais (RNF01-RNF21)
- PRD Section 10: Timeline
- PRD Appendix B: Estrutura de Arquivos Proposta

---

**Research concluída em:** 2026-01-20
**Próximo passo:** Planning Phase
