# Implementation Plan: ADK v2 - Técnicas Avançadas para Agentes de Longa Duração

**Data:** 2026-01-21
**Feature:** adk-v2
**Status:** Planning Complete
**Baseado em:** research.md, prd.md

---

## Sumário Executivo

Este plano detalha a implementação das 4 capacidades faltantes do ADK para habilitar agentes de longa duração:

1. **MCP Memory RAG** - Busca semântica via embeddings (P0 - Bloqueador)
2. **SessionManager** - Checkpoints e resume de sessões (P1)
3. **ContextCompactor** - Prevenção de overflow inteligente (P1)
4. **Constitution/Steering** - Contexto estruturado persistente (P2)

**Total estimado:** 42-50 story points (~6-7 semanas)

---

## Fase 0: Hooks de Enforcement

**Objetivo:** Garantir que técnicas ADK sejam aplicadas automaticamente em ambos os modos (CLI e Claude Code direto)

**Duração estimada:** 3 story points (~1-2 dias)
**Prioridade:** P0 - Imediato

### 0.1 Arquivos a Criar

| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `.claude/hooks/session-bootstrap.sh` | Injeção de contexto no início de sessão (SessionStart) | 0.5 |
| `.claude/hooks/session-checkpoint.sh` | Checkpoint automático no fim de sessão (Stop) | 0.5 |
| `.claude/hooks/validate-tdd.sh` | Validação TDD antes de escrita em src/ (PreToolUse) | 0.5 |
| `.claude/hooks/sync-state.sh` | Sincronização de estado após escrita (PostToolUse) | 0.5 |
| `.claude/hooks/task-complete.sh` | Commit automático após task completion | 0.5 |
| `.claude/hooks/check-task-complete.sh` | Detecção de task completion | 0.5 |

### 0.2 Arquivos a Modificar

| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `.claude/settings.json` | Adicionar novos hooks ao array de hooks | 0.5 |
| `CLAUDE.md` | Expandir seção de técnicas obrigatórias ADK | 0.5 |

### 0.3 Testes Necessários

- [ ] Teste manual: sessão inicia com contexto correto
- [ ] Teste manual: checkpoint criado ao fechar sessão
- [ ] Teste manual: warning exibido ao criar arquivo src/ sem teste
- [ ] Teste manual: estado sincronizado após escrita

### 0.4 Critérios de Aceitação

- [ ] Hook `session-bootstrap.sh` injeta contexto de feature ativa e constraints
- [ ] Hook `session-checkpoint.sh` cria snapshot com reason `session_end`
- [ ] Hook `validate-tdd.sh` exibe warning (não bloqueia) para arquivos sem teste
- [ ] Hook `sync-state.sh` atualiza progress.md e state.json após escrita
- [ ] Hooks funcionam silenciosamente se arquivos/features não existem
- [ ] Todos os hooks têm timeout máximo de 2s

### 0.5 Dependências

- **Internas:** Nenhuma (pode iniciar imediatamente)
- **Externas:** Nenhuma

### 0.6 Padrão de Implementação

```bash
#!/bin/bash
# Hook template pattern

# Early exit if precondition not met
if [ ! -f "$REQUIRED_FILE" ]; then
  exit 0
fi

# Non-blocking execution with timeout
timeout 2s <command> &

# Exit codes: 0 = allow, 2 = block
exit 0
```

---

## Fase 1: MCP Memory RAG

**Objetivo:** Implementar busca semântica via embeddings que indexa sem compactar

**Duração estimada:** 13 story points (~10-14 dias)
**Prioridade:** P0 - Bloqueador

### 1.1 Subfase 1.1: Benchmark de Providers (3 SP)

**Objetivo:** Avaliar e selecionar provider MCP

**Arquivos a criar:**
| Arquivo | Propósito |
|---------|-----------|
| `.claude/plans/features/adk-v2/mcp-benchmark.md` | Resultados do benchmark |

**Critérios de avaliação:**
1. Response time p95 < 100ms
2. Recall para queries cross-language > 80%
3. Precision top-5 > 85%
4. Local-first (sem dependência de cloud)
5. Manutenção ativa do projeto

**Providers a avaliar:**
- `@yikizi/mcp-local-rag`
- `mcp-memory-service`

**Entregável:** Documento de benchmark com recomendação

### 1.2 Subfase 1.2: Tipos e Configuração (2 SP)

**Arquivos a criar:**
| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `src/types/mcp-memory.ts` | Types para MCP Memory | 1 |
| `.adk/memory.json` | Schema de configuração | 0.5 |
| `.claude/mcp.json` | Configuração do MCP server | 0.5 |

**Estrutura de `src/types/mcp-memory.ts`:**
```typescript
export interface MCPMemoryConfig {
  provider: 'local-rag' | 'memory-service'
  embeddingModel: string
  chunkSize: number
  storagePath: string
  indexPatterns: string[]
  excludePatterns: string[]
}

export interface IndexOptions {
  metadata?: Record<string, string>
  force?: boolean
}

export interface RecallOptions {
  limit?: number
  threshold?: number
  hybrid?: boolean
}

export interface SearchResult {
  content: string
  score: number
  metadata: Record<string, string>
  source: string
}
```

### 1.3 Subfase 1.3: Wrapper MCP (4 SP)

**Arquivos a criar:**
| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `src/utils/memory-mcp.ts` | Wrapper para MCP server | 3 |
| `tests/utils/memory-mcp.test.ts` | Testes unitários | 1 |

**Estrutura de `src/utils/memory-mcp.ts`:**
```typescript
export class MemoryMCP {
  constructor(config?: Partial<MCPMemoryConfig>)

  async index(content: string, options?: IndexOptions): Promise<void>
  async indexFile(filePath: string, options?: IndexOptions): Promise<void>
  async indexDirectory(dirPath: string, options?: IndexOptions): Promise<void>

  async recall(query: string, options?: RecallOptions): Promise<SearchResult[]>
  async recallHybrid(query: string, options?: RecallOptions): Promise<SearchResult[]>

  async isAvailable(): Promise<boolean>
  async getStats(): Promise<{ indexed: number; lastUpdated: string }>
}

export const memoryMCP = new MemoryMCP()
```

**Testes necessários:**
- [ ] `index()` indexa conteúdo com metadata
- [ ] `indexFile()` indexa arquivo existente
- [ ] `indexFile()` ignora arquivo inexistente
- [ ] `recall()` retorna resultados ordenados por score
- [ ] `recallHybrid()` combina semantic e keyword
- [ ] `isAvailable()` retorna false se MCP não configurado
- [ ] Fallback para keyword search se MCP indisponível

### 1.4 Subfase 1.4: Comandos CLI (2 SP)

**Arquivos a modificar:**
| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `src/commands/memory.ts` | Adicionar métodos `index` e `recall` | 1.5 |
| `src/cli.ts` | Registrar subcomandos | 0.5 |

**Novos comandos:**
```bash
adk memory index --file <path>     # Indexa arquivo específico
adk memory index --dir <path>      # Indexa diretório
adk memory index --all             # Indexa todos os .claude/*

adk memory recall <query>          # Busca semântica
adk memory recall <query> --hybrid # Busca híbrida
adk memory recall <query> --limit 10
```

**Padrão de implementação (em memory.ts):**
```typescript
async index(options: { file?: string; dir?: string; all?: boolean }): Promise<void> {
  const spinner = ora('Indexing...').start()
  try {
    if (options.file) {
      await memoryMCP.indexFile(options.file)
    } else if (options.dir) {
      await memoryMCP.indexDirectory(options.dir)
    } else if (options.all) {
      await memoryMCP.indexDirectory('.claude')
    }
    spinner.succeed('Indexed successfully')
  } catch (error) {
    spinner.fail('Indexing failed')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

### 1.5 Subfase 1.5: Hook de Indexação (1 SP)

**Arquivos a criar:**
| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `.claude/hooks/post-write-index.sh` | Indexação automática após escrita | 1 |

**Lógica do hook:**
1. Verificar se arquivo está em `.claude/*` ou patterns configurados
2. Chamar `adk memory index --file $FILE` em background
3. Não bloquear operação de escrita

### 1.6 Subfase 1.6: Integração com memory-search.ts (1 SP)

**Arquivos a modificar:**
| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `src/utils/memory-search.ts` | Adicionar fallback para MCP Memory | 1 |

**Lógica:**
```typescript
async function searchMemory(query: string): Promise<SearchResult[]> {
  // Try MCP Memory first
  if (await memoryMCP.isAvailable()) {
    return memoryMCP.recallHybrid(query, { limit: 10 })
  }
  // Fallback to keyword search
  return keywordSearch(query)
}
```

### 1.7 Critérios de Aceitação da Fase 1

- [ ] Query "auth" retorna documentos contendo "autenticacao", "authentication", "login"
- [ ] Query "user" retorna documentos contendo "usuario", "account", "profile"
- [ ] Response time p95 < 100ms
- [ ] Recall cross-language > 80%
- [ ] Precision top-5 > 85%
- [ ] Fallback para keyword search funciona se MCP indisponível
- [ ] Indexação automática via hook não bloqueia escrita
- [ ] Cobertura de testes >= 80% para memory-mcp.ts

### 1.8 Dependências

- **Internas:** Nenhuma (pode iniciar após Fase 0)
- **Externas:** MCP Server escolhido no benchmark

---

## Fase 2: Session Management

**Objetivo:** Estender StateManager para checkpoints e resume de sessões

**Duração estimada:** 8 story points (~5-7 dias)
**Prioridade:** P1

### 2.1 Arquivos a Criar

| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `src/types/session.ts` | Types de sessão e checkpoint | 1 |
| `templates/claude-progress.txt` | Template de progresso plain text | 0.5 |
| `tests/utils/session-manager.test.ts` | Testes de extensão do StateManager | 1.5 |

**Estrutura de `src/types/session.ts`:**
```typescript
export interface SessionCheckpoint {
  id: string
  feature: string
  timestamp: string
  reason: CheckpointReason
  progress: number
  currentPhase: string
  completedTasks: string[]
  pendingTasks: string[]
  contextSummary?: string
  commitHash?: string
}

export type CheckpointReason =
  | 'manual'
  | 'step_complete'
  | 'context_warning'
  | 'error_recovery'
  | 'task_complete'
  | 'session_end'

export interface SessionHistory {
  feature: string
  checkpoints: SessionCheckpoint[]
  lastUpdated: string
}
```

**Estrutura de `templates/claude-progress.txt`:**
```
=== FEATURE PROGRESS ===
Feature: [feature-name]
Updated: [timestamp]

--- CURRENT STATE ---
Phase: [current-phase]
Progress: [progress]%
Active Task: [task-name]

--- COMPLETED ---
[x] Task 1 - completed at [timestamp]
[x] Task 2 - completed at [timestamp]

--- PENDING ---
[ ] Task 3
[ ] Task 4

--- KEY DECISIONS ---
- [decision 1]
- [decision 2]

--- FILES MODIFIED ---
- path/to/file1.ts
- path/to/file2.ts

--- NEXT ACTIONS ---
1. [action 1]
2. [action 2]
```

### 2.2 Arquivos a Modificar

| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `src/utils/state-manager.ts` | Adicionar métodos resume e handoff | 2 |
| `src/commands/agent.ts` | Adicionar flag `--resume` e subcomando `sessions` | 2 |
| `src/cli.ts` | Registrar subcomando `sessions` | 0.5 |

**Novos métodos em StateManager:**
```typescript
export class StateManager {
  // Existing methods...

  async resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState>
  async createContextSummary(feature: string): Promise<string>
  async createCheckpoint(feature: string, reason: CheckpointReason): Promise<SessionCheckpoint>
  async listCheckpoints(feature: string, limit?: number): Promise<SessionCheckpoint[]>
  async completeTask(feature: string, taskName: string): Promise<void>
}
```

**Implementação de `resumeFromSnapshot`:**
```typescript
async resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState> {
  const snapshotManager = new SnapshotManager()

  if (snapshotId) {
    return snapshotManager.restore(feature, snapshotId)
  }

  // Get most recent snapshot
  const snapshots = await snapshotManager.list(feature)
  if (snapshots.length === 0) {
    return this.loadUnifiedState(feature)
  }

  return snapshotManager.restore(feature, snapshots[0].id)
}
```

**Novos comandos:**
```bash
adk agent run <name> --resume          # Retoma última sessão
adk agent sessions <feature>           # Lista sessões
adk agent sessions <feature> --limit 5
```

### 2.3 Testes Necessários

- [ ] `resumeFromSnapshot()` restaura estado de snapshot específico
- [ ] `resumeFromSnapshot()` restaura snapshot mais recente se id não fornecido
- [ ] `resumeFromSnapshot()` retorna estado atual se não há snapshots
- [ ] `createContextSummary()` gera documento em formato plain text
- [ ] `createCheckpoint()` cria snapshot com reason correto
- [ ] `completeTask()` marca task como completa e cria checkpoint
- [ ] `--resume` flag funciona no comando agent run
- [ ] `sessions` subcomando lista checkpoints formatados

### 2.4 Critérios de Aceitação

- [ ] Comando `adk agent run <name> --resume` retoma última sessão
- [ ] Sessão retomada inclui contexto de tasks completadas
- [ ] Arquivo `claude-progress.txt` mostra histórico de progresso
- [ ] Checkpoints criados automaticamente após cada task
- [ ] Checkpoint inclui commit hash quando disponível
- [ ] Recovery time após context overflow < 30s

### 2.5 Dependências

- **Internas:** StateManager, SnapshotManager, HistoryTracker (todos prontos)
- **Externas:** Nenhuma

---

## Fase 3: Context Compactor

**Objetivo:** Prevenir context overflow com summarization inteligente e handoff documents

**Duração estimada:** 8 story points (~5-7 dias)
**Prioridade:** P1

### 3.1 Arquivos a Criar

| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `src/types/context-compactor.ts` | Types para compactação | 0.5 |
| `src/utils/token-counter.ts` | Contagem de tokens via API + fallback | 2 |
| `src/utils/context-compactor.ts` | Compactação hierárquica | 3 |
| `tests/utils/token-counter.test.ts` | Testes de contagem | 0.5 |
| `tests/utils/context-compactor.test.ts` | Testes de compactação | 1 |

**Estrutura de `src/types/context-compactor.ts`:**
```typescript
export interface TokenCountResult {
  count: number
  method: 'api' | 'tiktoken' | 'estimate'
  accuracy: number
}

export interface CompactionResult {
  original: string
  compacted: string
  originalTokens: number
  compactedTokens: number
  reduction: number
  level: CompactionLevel
}

export type CompactionLevel =
  | 'raw'          // No compaction
  | 'compaction'   // Reversible (remove whitespace, comments)
  | 'summarization' // Lossy (AI summarization)

export interface HandoffDocument {
  summary: string
  currentState: string
  pendingSteps: string[]
  keyDecisions: string[]
  filesModified: string[]
  nextActions: string[]
  generatedAt: string
}
```

**Estrutura de `src/utils/token-counter.ts`:**
```typescript
export class TokenCounter {
  private cache: Map<string, number> = new Map()

  async countTokens(text: string): Promise<TokenCountResult>
  async countTokensWithAPI(text: string): Promise<number>
  countTokensWithTiktoken(text: string): number
  estimateTokens(text: string): number

  clearCache(): void
}

export const tokenCounter = new TokenCounter()
```

**Estrutura de `src/utils/context-compactor.ts`:**
```typescript
export class ContextCompactor {
  constructor(private tokenCounter: TokenCounter)

  async shouldCompact(currentTokens: number, maxTokens: number): Promise<boolean>
  async compact(content: string, targetReduction: number): Promise<CompactionResult>
  async generateHandoff(feature: string): Promise<HandoffDocument>
  async archiveToMCP(content: string, metadata: Record<string, string>): Promise<void>

  private applyReversibleCompaction(content: string): string
  private async applySummarization(content: string): Promise<string>
}

export const contextCompactor = new ContextCompactor(tokenCounter)
```

### 3.2 Arquivos a Modificar

| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `.claude/hooks/session-checkpoint.sh` | Integrar com ContextCompactor | 0.5 |
| `src/utils/state-manager.ts` | Usar ContextCompactor em handoff | 0.5 |

### 3.3 Hierarquia de Compactação

```
┌─────────────────────────────────────────────────────────────┐
│ Level 0: RAW (< 80% capacity)                               │
│ - No compaction applied                                     │
│ - Full context preserved                                    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (80-90% capacity)
┌─────────────────────────────────────────────────────────────┐
│ Level 1: COMPACTION (reversible)                            │
│ - Remove extra whitespace                                   │
│ - Remove comments                                           │
│ - Shorten verbose output                                    │
│ - Archive old messages to MCP Memory                        │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (> 90% capacity)
┌─────────────────────────────────────────────────────────────┐
│ Level 2: SUMMARIZATION (lossy)                              │
│ - AI summarization of context                               │
│ - Generate handoff document                                 │
│ - Create checkpoint before summarization                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Testes Necessários

- [ ] `countTokens()` usa API quando disponível
- [ ] `countTokens()` usa tiktoken como fallback
- [ ] `countTokens()` usa estimativa como último recurso
- [ ] `countTokens()` usa cache para texto repetido
- [ ] `shouldCompact()` retorna true quando > 80% capacity
- [ ] `compact()` aplica level correto baseado em redução necessária
- [ ] `generateHandoff()` cria documento em formato correto
- [ ] `archiveToMCP()` indexa conteúdo com metadata

### 3.5 Critérios de Aceitação

- [ ] Token counting tem 95%+ de precisão
- [ ] Alerta exibido quando contexto atinge 80% do limite
- [ ] Compactação reversível aplicada antes de summarization
- [ ] Handoff document gerado automaticamente em plain text
- [ ] Informações arquivadas recuperáveis via MCP Memory
- [ ] Cache de token counting funciona corretamente

### 3.6 Dependências

- **Internas:** MCP Memory (Fase 1), StateManager
- **Externas:** Anthropic API (opcional), tiktoken (opcional)

---

## Fase 4: Constitution/Steering e Powers

**Objetivo:** Implementar contexto estruturado persistente com loading dinâmico

**Duração estimada:** 5 story points (~3-5 dias)
**Prioridade:** P2

### 4.1 Arquivos a Criar

| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `templates/constitution.md` | Template de princípios imutáveis | 0.5 |
| `templates/context/product.md` | Template de contexto de produto | 0.25 |
| `templates/context/architecture.md` | Template de contexto arquitetural | 0.25 |
| `templates/context/tech-stack.md` | Template de tech stack | 0.25 |
| `.claude/powers/security.json` | Power de segurança | 0.25 |
| `.claude/powers/testing.json` | Power de testing | 0.25 |
| `.claude/powers/database.json` | Power de database | 0.25 |
| `src/utils/context-loader.ts` | Powers pattern loader | 1.5 |
| `src/commands/validate.ts` | Comando de validação | 1 |
| `tests/utils/context-loader.test.ts` | Testes | 0.5 |

**Estrutura de `templates/constitution.md`:**
```markdown
# Constitution

## Princípios Imutáveis

### 1. Qualidade
- Todo código de produção DEVE ter testes
- Cobertura mínima de 80%
- TDD é obrigatório

### 2. Segurança
- Nunca commitar secrets
- Validar todo input de usuário
- Usar queries parametrizadas

### 3. Manutenibilidade
- Código legível > código clever
- Documentação para decisões complexas
- Commits atômicos e descritivos

### 4. Performance
- Medir antes de otimizar
- Lazy loading por padrão
- Cache quando apropriado
```

**Estrutura de `.claude/powers/security.json`:**
```json
{
  "name": "security",
  "description": "Security-related context and tools",
  "triggers": ["auth", "authentication", "security", "password", "token", "credential"],
  "contextFiles": [
    ".claude/rules/security-rules.md",
    ".claude/context/security.md"
  ],
  "steeringPrompt": "Focus on security best practices. Validate all inputs. Use parameterized queries. Never expose secrets."
}
```

**Estrutura de `src/utils/context-loader.ts`:**
```typescript
export interface Power {
  name: string
  description: string
  triggers: string[]
  contextFiles: string[]
  steeringPrompt: string
}

export class ContextLoader {
  private powers: Power[] = []
  private cache: Map<string, string> = new Map()

  async loadPowers(): Promise<void>
  async getActivePowers(prompt: string): Promise<Power[]>
  async loadContext(powers: Power[]): Promise<string>

  detectTriggers(prompt: string): string[]
  private shouldActivatePower(power: Power, triggers: string[]): boolean
}

export const contextLoader = new ContextLoader()
```

### 4.2 Arquivos a Modificar

| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `src/cli.ts` | Registrar comando `validate` | 0.25 |
| `.claude/hooks/inject-focus.sh` | Integrar com ContextLoader | 0.25 |

**Comando validate:**
```bash
adk validate                    # Valida contra constitution.md
adk validate --fix              # Sugere correções
adk validate --file <path>      # Valida arquivo específico
```

### 4.3 Testes Necessários

- [ ] `loadPowers()` carrega powers de `.claude/powers/`
- [ ] `getActivePowers()` retorna powers baseado em triggers
- [ ] `loadContext()` carrega e combina context files
- [ ] `detectTriggers()` extrai triggers do prompt
- [ ] Comando `validate` detecta violações
- [ ] Flag `--fix` sugere correções

### 4.4 Critérios de Aceitação

- [ ] Powers definidos em `.claude/powers/*.json`
- [ ] Cada power tem lista de triggers (keywords)
- [ ] Contexto carregado apenas quando trigger detectado
- [ ] Economia de 60-80% de tokens em workflows típicos
- [ ] Comando `adk validate` verifica código contra constitution.md
- [ ] Violações listadas com referência ao princípio violado

### 4.5 Dependências

- **Internas:** Nenhuma
- **Externas:** Nenhuma

---

## Fase 5: Git Commits como Checkpoints

**Objetivo:** Usar commits como checkpoints naturais para recovery

**Duração estimada:** 3 story points (~2-3 dias)
**Prioridade:** P1
**Pode ser executada em paralelo com Fase 4**

### 5.1 Arquivos a Criar

| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `.claude/hooks/task-complete.sh` | Commit automático após task | 0.5 |
| `.claude/hooks/check-task-complete.sh` | Detecção de task completion | 0.5 |

**Lógica de `task-complete.sh`:**
```bash
#!/bin/bash

FEATURE_DIR=".claude/plans/features/$FEATURE_NAME"
PROGRESS_FILE="$FEATURE_DIR/claude-progress.txt"

# Update progress file
adk feature status $FEATURE_NAME --output plain > "$PROGRESS_FILE"

# Create commit
TASK_NAME=$(cat "$FEATURE_DIR/current-task.txt" 2>/dev/null || echo "task")
git add -A
git commit -m "feat($FEATURE_NAME): complete $TASK_NAME"

# Record commit hash in history
COMMIT_HASH=$(git rev-parse HEAD)
echo "{\"taskComplete\": \"$TASK_NAME\", \"commitHash\": \"$COMMIT_HASH\"}" >> "$FEATURE_DIR/commit-history.json"
```

### 5.2 Arquivos a Modificar

| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `src/utils/state-manager.ts` | Adicionar método `completeTask` | 1 |
| `src/commands/feature.ts` | Adicionar flag `--commit` | 0.5 |
| `src/utils/history-tracker.ts` | Registrar commit hash | 0.5 |

**Implementação de `completeTask`:**
```typescript
async completeTask(feature: string, taskName: string): Promise<void> {
  const state = await this.loadUnifiedState(feature)

  // Mark task as completed
  const task = state.tasks.find(t => t.name === taskName)
  if (task) {
    task.status = 'completed'
    task.completedAt = new Date().toISOString()
  }

  // Update progress
  state.progress = this.calculateProgress(state.tasks)

  // Save state
  await this.saveUnifiedState(feature, state)

  // Create checkpoint
  await this.createCheckpoint(feature, 'task_complete')

  // Record in history
  const historyTracker = new HistoryTracker()
  await historyTracker.recordTransition(feature, {
    from: 'in_progress',
    to: 'task_complete',
    task: taskName,
    timestamp: new Date().toISOString()
  })
}
```

### 5.3 Testes Necessários

- [ ] `completeTask()` marca task como completa
- [ ] `completeTask()` atualiza progress percentage
- [ ] `completeTask()` cria checkpoint com reason `task_complete`
- [ ] Hook `task-complete.sh` cria commit com mensagem correta
- [ ] Commit hash registrado em history.json
- [ ] Flag `--commit` funciona no `feature implement`

### 5.4 Critérios de Aceitação

- [ ] Commit criado após cada task com mensagem descritiva
- [ ] Formato: `feat(feature): complete task-name`
- [ ] Arquivo `claude-progress.txt` atualizado antes do commit
- [ ] Rollback de task individual possível via `git revert`
- [ ] Taxa de commits por feature = 1:1 (cada task = 1 commit)

### 5.5 Dependências

- **Internas:** StateManager, HistoryTracker
- **Externas:** Git

---

## Fase 6: Resiliência e Observabilidade

**Objetivo:** Implementar retry, circuit breaker e observabilidade

**Duração estimada:** 8 story points (~5-7 dias)
**Prioridade:** P2

### 6.1 Arquivos a Criar

| Arquivo | Propósito | Story Points |
|---------|-----------|--------------|
| `src/types/resilience.ts` | Types de resiliência | 0.5 |
| `src/utils/circuit-breaker.ts` | Circuit breaker pattern | 2 |
| `src/utils/memory-pruner.ts` | Prevenção de memory fading | 1 |
| `src/utils/observability.ts` | Integração OpenTelemetry | 1.5 |
| `src/commands/diagnostics.ts` | Health check command | 1 |
| `tests/utils/circuit-breaker.test.ts` | Testes | 0.5 |
| `tests/utils/memory-pruner.test.ts` | Testes | 0.5 |
| `tests/commands/diagnostics.test.ts` | Testes | 0.5 |

**Estrutura de `src/types/resilience.ts`:**
```typescript
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number    // Default: 5
  successThreshold: number    // Default: 2
  timeout: number             // Default: 60000 (1 min)
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState
  failures: number
  successes: number
  lastFailure?: string
  lastSuccess?: string
}
```

**Estrutura de `src/utils/circuit-breaker.ts`:**
```typescript
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed'
  private failures: number = 0
  private successes: number = 0
  private lastStateChange: Date = new Date()

  constructor(private config: CircuitBreakerConfig)

  async execute<T>(fn: () => Promise<T>): Promise<T>
  getState(): CircuitBreakerState
  getStats(): CircuitBreakerStats
  reset(): void

  private trip(): void
  private attemptReset(): void
  private recordSuccess(): void
  private recordFailure(): void
}
```

**Estrutura de `src/utils/memory-pruner.ts`:**
```typescript
export interface PrunerConfig {
  maxLines: number           // Default: 500
  targetLines: number        // Default: 400
  archiveToMCP: boolean      // Default: true
}

export class MemoryPruner {
  constructor(private config: PrunerConfig)

  async shouldPrune(filePath: string): Promise<boolean>
  async prune(filePath: string): Promise<void>
  async pruneProjectContext(): Promise<void>

  private extractOldestSections(content: string, lines: number): string
  private archiveContent(content: string, source: string): Promise<void>
}

export const memoryPruner = new MemoryPruner({ maxLines: 500, targetLines: 400, archiveToMCP: true })
```

**Estrutura de `src/commands/diagnostics.ts`:**
```typescript
export class DiagnosticsCommand {
  async run(): Promise<void>
  async checkMCPMemory(): Promise<HealthStatus>
  async checkCircuitBreakers(): Promise<HealthStatus>
  async checkHooks(): Promise<HealthStatus>
  async checkConfig(): Promise<HealthStatus>
}
```

**Comando diagnostics:**
```bash
adk diagnostics                 # Full health check
adk diagnostics --component mcp # Specific component
adk diagnostics --json          # JSON output
```

### 6.2 Arquivos a Modificar

| Arquivo | Modificação | Story Points |
|---------|-------------|--------------|
| `src/utils/retry.ts` | Adicionar jitter | 0.25 |
| `src/cli.ts` | Registrar comando `diagnostics` | 0.25 |

**Adicionar jitter ao retry:**
```typescript
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 8000,
  jitter: true,  // NEW
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'rate_limit', 'overloaded'],
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.baseBackoffMs * Math.pow(2, attempt),
    config.maxBackoffMs
  )

  if (config.jitter) {
    // Add +/- 25% jitter
    const jitterRange = baseDelay * 0.25
    return baseDelay + (Math.random() * jitterRange * 2) - jitterRange
  }

  return baseDelay
}
```

### 6.3 Testes Necessários

- [ ] CircuitBreaker inicia em estado `closed`
- [ ] CircuitBreaker muda para `open` após N falhas
- [ ] CircuitBreaker muda para `half-open` após timeout
- [ ] CircuitBreaker muda para `closed` após M sucessos em `half-open`
- [ ] MemoryPruner detecta arquivos acima do limite
- [ ] MemoryPruner arquiva conteúdo removido no MCP
- [ ] Diagnostics retorna status de todos os componentes
- [ ] Jitter varia delay em +/- 25%

### 6.4 Critérios de Aceitação

- [ ] Retry com max 3-5 tentativas para operações LLM
- [ ] Circuit breaker com threshold de 5 falhas e timeout de 1 minuto
- [ ] Memory pruner mantém max 500 linhas em project-context.md
- [ ] Conteúdo removido arquivado no MCP Memory
- [ ] Comando `adk diagnostics` mostra status de todos os componentes
- [ ] Retry success rate > 90%
- [ ] Circuit breaker uptime > 95%

### 6.5 Dependências

- **Internas:** MCP Memory (para arquivamento), Retry (existente)
- **Externas:** OpenTelemetry (opcional)

---

## Ordem de Implementação

```
Semana 0: Fase 0 (Hooks) ─────────────────────────────────────┐
                                                              │
Semana 1-2: Fase 1 (MCP Memory RAG) ──────────────────────────┤
                                                              │
Semana 3: Fase 2 (Session Management) ◀───────────────────────┤
                                                              │
Semana 4: Fase 3 (Context Compactor) ◀────────────────────────┤
                                                              │
Semana 5: ┌─ Fase 4 (Constitution/Powers) ◀───────────────────┤
          └─ Fase 5 (Git Commits) [PARALELO]                  │
                                                              │
Semana 6: Fase 6 (Resiliência + Observabilidade) ◀────────────┘
```

### Pontos de Verificação (Checkpoints)

| Checkpoint | Após | Validação |
|------------|------|-----------|
| CP1 | Fase 0 | Todos os hooks funcionando, técnicas ADK enforced |
| CP2 | Fase 1 | Busca semântica com recall > 80%, indexação automática |
| CP3 | Fase 2 | Resume de sessões funcional, progress tracking |
| CP4 | Fase 3 | Token counting preciso, handoff documents gerados |
| CP5 | Fase 4+5 | Powers pattern ativo, commits automáticos |
| CP6 | Fase 6 | Circuit breaker testado, diagnostics funcional |

---

## Estratégia de Testes

### Cobertura por Módulo

| Módulo | Target | Prioridade |
|--------|--------|------------|
| memory-mcp.ts | >= 85% | P0 |
| token-counter.ts | >= 85% | P1 |
| context-compactor.ts | >= 80% | P1 |
| context-loader.ts | >= 80% | P2 |
| circuit-breaker.ts | >= 85% | P2 |
| memory-pruner.ts | >= 80% | P2 |

### Tipos de Teste

1. **Unitários**: Todos os novos módulos
2. **Integração**: Fluxos completos (index → recall, checkpoint → resume)
3. **E2E**: Workflows completos via CLI
4. **Manual**: Hooks e comportamento interativo

### Padrão de Teste

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

  describe('methodName', () => {
    describe('when condition', () => {
      it('should expected behavior', async () => {
        // Arrange
        const input = createTestInput()

        // Act
        const result = await module.method(input)

        // Assert
        expect(result).toMatchObject(expected)
      })
    })
  })
})
```

---

## Resumo de Story Points

| Fase | Story Points | Semanas |
|------|--------------|---------|
| Fase 0: Hooks | 3 | 0 (1-2 dias) |
| Fase 1: MCP Memory RAG | 13 | 1-2 |
| Fase 2: Session Management | 8 | 3 |
| Fase 3: Context Compactor | 8 | 4 |
| Fase 4: Constitution/Powers | 5 | 5 |
| Fase 5: Git Commits | 3 | 5 (paralelo) |
| Fase 6: Resiliência | 8 | 6 |
| **Total** | **48** | **~6 semanas** |

---

## Próximos Passos

1. [ ] Aprovar plano de implementação
2. [ ] Iniciar Fase 0 (Hooks de Enforcement)
3. [ ] Realizar benchmark de providers MCP
4. [ ] Criar branch `feature/adk-v2`
5. [ ] Iniciar implementação seguindo ordem definida

---

**Plano criado em:** 2026-01-21
**Próxima revisão:** Após aprovação
