# Research: adk-v2-fase1 (MCP Memory RAG)

**Data:** 2026-01-21
**Status:** Research Complete
**Relacionado:** PRD em `.claude/plans/features/adk-v2-fase1/prd.md`

---

## 1. Current State Analysis

### 1.1 Memory Search - Estado Atual

O sistema de busca atual (`src/utils/memory-search.ts`) utiliza **correspondência literal de keywords** com scoring ponderado:

```typescript
function simpleSearch(text: string, query: string): number {
  const words = lowerQuery.split(/\s+/)
  for (const word of words) {
    if (lowerText.includes(word)) matches++  // MATCH LITERAL
  }
  return words.length > 0 ? matches / words.length : 0
}
```

**Pesos de campo** (linha 36-42):
| Campo | Peso |
|-------|------|
| title | 0.35 |
| context | 0.20 |
| rationale | 0.20 |
| tags | 0.15 |
| chosen | 0.10 |

**Limitações confirmadas:**
- Query "auth" NÃO encontra documentos com "autenticação" ou "authentication"
- Recall cross-language estimado: ~20%
- Sem suporte a sinônimos ou embeddings

### 1.2 Memory Command - Subcomandos Existentes

O comando `adk memory` (`src/commands/memory.ts`) já possui 11 subcomandos:

| Subcomando | Método | Linhas | Propósito |
|------------|--------|--------|-----------|
| save | save() | 25-98 | Salvar contexto de feature |
| load | load() | 100-164 | Carregar memória de feature |
| view | view() | 166-234 | Visualizar memória |
| compact | compact() | 236-301 | Comprimir via Claude |
| search | search() | 303-367 | Busca full-text em memórias |
| sync | sync() | 369-412 | Sincronizar projeto |
| recall | recall() | 421-438 | **Busca de decisões (será modificado)** |
| link | link() | 440-479 | Vincular decisão a feature |
| unlink | unlink() | 481-500 | Desvincular decisão |
| status | status() | 502-611 | Estatísticas de memória |
| export | export() | 613-686 | Exportar KB |

**Novo subcomando necessário:** `index` (não existe atualmente)

### 1.3 Configuration System

O sistema de configuração (`src/utils/config.ts`) usa:
- Diretório: `.adk/`
- Arquivo: `.adk/config.json`
- Padrão: merge com defaults via `mergeWithDefaults()`
- Sanitização: tokens/secrets filtrados antes de salvar

**Padrão de carregamento:**
```typescript
export async function loadConfig(): Promise<AdkConfig> {
  const configPath = getConfigPath()
  if (await fs.pathExists(configPath)) {
    const content = await fs.readJson(configPath)
    return mergeWithDefaults(content)
  }
  return { ...DEFAULT_ADK_CONFIG }
}
```

### 1.4 Hooks System

Hooks configurados em `.claude/settings.json`:

| Evento | Hook | Propósito |
|--------|------|-----------|
| SessionStart | session-bootstrap.sh | Injetar contexto |
| Stop | session-checkpoint.sh | Criar snapshot |
| UserPromptSubmit | inject-focus.sh | Injetar focus |
| PreToolUse:Write | scope-check.sh, validate-tdd.sh | Validações |
| PostToolUse:Write | post-write.sh, sync-state.sh | Sincronização |

**Novo hook necessário:** `post-write-index.sh` em `PostToolUse:Write`

**Padrão de hooks (sync-state.sh, linhas 1-54):**
- Fail-silent: `exit 0` se precondição não atendida
- Recebe `$1` (FILE_PATH) como parâmetro
- Usa jq para manipular JSON
- Execução < 100ms

---

## 2. Similar Components

### 2.1 Config Pattern (src/utils/config.ts)

O MCP Memory seguirá o mesmo padrão de configuração:
- `loadMemoryConfig()` → análogo a `loadConfig()`
- `saveMemoryConfig()` → análogo a `saveConfig()`
- Validação via Zod schema (já disponível no projeto)
- Defaults mergeados automaticamente

### 2.2 Search Pattern (src/utils/memory-search.ts)

A busca semântica será uma **extensão** da busca existente:
- `recallMemory()` atual → será wrapper que chama MCP ou fallback
- Score/threshold pattern será mantido
- Formato de resultado (`MemorySearchResult`) será preservado

### 2.3 Queue Pattern (src/utils/sync-queue.ts)

O projeto já possui sistema de fila para sync assíncrono:
```typescript
interface SyncQueueEntry {
  feature: string
  operation: 'create' | 'update'
  attempts: number
  lastAttempt?: string
}
```

O `MemoryIndexQueue` seguirá padrão similar com debouncing.

### 2.4 Types Pattern (src/types/)

Tipos organizados por domínio:
- `src/types/memory.ts` → Decision, MemorySearchResult
- `src/types/progress-sync.ts` → UnifiedFeatureState
- `src/types/provider.ts` → ProjectProvider

Novo arquivo: `src/types/mcp-memory.ts`

---

## 3. Technical Stack

### 3.1 Dependencies Existentes (Relevantes)

| Package | Versão | Uso |
|---------|--------|-----|
| zod | ^3.25.76 | Validação de schemas (usar para memory config) |
| fs-extra | ^11.3.3 | Operações de arquivo |
| ora | ^9.0.0 | Spinners CLI |
| chalk | ^5.6.2 | Cores terminal |
| commander | ^14.0.2 | CLI parsing |
| fuse.js | ^7.1.0 | Fuzzy search (fallback alternativo) |

### 3.2 Dependencies Novas Necessárias

| Package | Propósito | Criticidade |
|---------|-----------|-------------|
| MCP Server (@yikizi/mcp-local-rag ou mcp-memory-service) | Busca semântica | P0 - Core |
| (nenhuma outra) | - | - |

**Nota:** MCP Servers são processos externos, não npm packages para o ADK. O ADK precisa apenas do client para comunicação.

### 3.3 Runtime Requirements

- Node.js >= 18.0.0 (já especificado em package.json)
- SQLite (para storage local do MCP server)
- MCP Server rodando localmente ou configurado

---

## 4. Files to Create

### 4.1 Types

- [ ] `src/types/mcp-memory.ts`
  - `MemoryDocument` (id, content, metadata, embedding?)
  - `MemoryQuery` (query, options)
  - `MemoryResult` (documents, scores, timings)
  - `MemoryConfig` schema Zod
  - Type guards para validação

### 4.2 Core Implementation

- [ ] `src/utils/memory-mcp.ts`
  - Classe `MemoryMCP` com:
    - `index(content, metadata): Promise<IndexResult>`
    - `recall(query, options): Promise<MemoryResult>`
    - `archiveForCompaction(content, metadata): Promise<string>`
    - `recoverArchived(archiveId): Promise<string>`
  - Fallback para `simpleSearch()` em erro
  - Logging de metrics

- [ ] `src/utils/memory-index-queue.ts`
  - Classe `MemoryIndexQueue` com:
    - `enqueue(filePath): void` (debounce de 2s)
    - `processQueue(): Promise<void>`
    - `getPendingCount(): number`
  - Persistência em `.adk/memory-queue.json`

### 4.3 Configuration

- [ ] `.adk/memory.json` (template/default)
  - Schema com defaults otimizados
  - Suporte a múltiplos providers

### 4.4 Hooks

- [ ] `.claude/hooks/post-write-index.sh`
  - Trigger em arquivos `.claude/*`
  - Execução assíncrona (`adk memory queue <path> &`)
  - Fail-silent pattern

### 4.5 Tests

- [ ] `tests/types/mcp-memory.test.ts`
- [ ] `tests/utils/memory-mcp.test.ts` (>= 80% coverage)
- [ ] `tests/utils/memory-index-queue.test.ts`
- [ ] `tests/hooks/post-write-index.test.ts`
- [ ] `tests/integration/memory-e2e.test.ts`

---

## 5. Files to Modify

### 5.1 Commands

- [ ] `src/commands/memory.ts`
  - **Adicionar:** método `index()` (linhas ~500+)
    - `--file <path>` para arquivo único
    - `--dir <path>` para diretório
    - `--filter <pattern>` para extensões
    - `--force` para re-indexar
  - **Adicionar:** método `queue()` (linhas ~520+)
    - Enfileira arquivo para indexação
  - **Adicionar:** método `processQueue()` (linhas ~540+)
    - Processa fila pendente
  - **Modificar:** método `recall()` (linhas 421-438)
    - Usar MCP Memory como primary
    - Fallback para keyword search
    - Opção `--hybrid`
    - Opção `--threshold`

### 5.2 CLI Registration

- [ ] `src/cli.ts` (linhas ~320+)
  - Registrar subcomandos `index`, `queue`, `process-queue`
  - Adicionar opções a `recall`

### 5.3 Types Export

- [ ] `src/types/index.ts`
  - Adicionar: `export * from './mcp-memory'`

### 5.4 Settings

- [ ] `.claude/settings.json`
  - Adicionar hook `post-write-index.sh` em PostToolUse:Write

### 5.5 Documentation

- [ ] `CLAUDE.md`
  - Nova seção "MCP Memory" documentando uso
  - Troubleshooting guide

---

## 6. Dependencies

### 6.1 External Dependencies

| Dependência | Tipo | Status | Alternativa |
|-------------|------|--------|-------------|
| `@yikizi/mcp-local-rag` | MCP Server | A benchmark | mcp-memory-service |
| `mcp-memory-service` | MCP Server | A benchmark | @yikizi/mcp-local-rag |
| SQLite | Storage | Disponível | N/A (required) |

### 6.2 Internal Dependencies (ADK)

| Módulo | Dependência | Impacto |
|--------|-------------|---------|
| memory-search.ts | Será estendido | Fallback |
| memory.ts (command) | Será estendido | CLI |
| config.ts | Usar padrão | Configuração |
| sync-queue.ts | Usar padrão | Queue pattern |
| Hook system | Adicionar hook | Auto-indexação |

### 6.3 Downstream (Outras Fases)

| Fase | Dependência | Tipo |
|------|-------------|------|
| Fase 2 (SessionManager) | MCP Memory para arquivar contexto | Hard |
| Fase 3 (ContextCompactor) | MCP Memory para recall | Hard |
| Fase 4 (Constitution) | MCP Memory para loading dinâmico | Soft |

---

## 7. Risks

### 7.1 Technical Risks

| # | Risco | Impacto | Prob. | Mitigação |
|---|-------|---------|-------|-----------|
| R1 | Provider MCP single maintainer | Alto | Média | Benchmark 2+ providers; wrapper abstrai implementação; fallback keyword sempre disponível |
| R2 | Latência busca semântica > 100ms | Alto | Média | Benchmark com docs reais; cache de queries; SQLite-vec otimizado |
| R3 | Embeddings não capturam termos técnicos | Médio | Média | Busca híbrida semantic+keyword; reranking; threshold configurável |
| R4 | Hook de indexação causa lentidão | Médio | Baixa | Execução async com `&`; debounce 2s; queue com batch |
| R5 | MCP server consome muita memória | Médio | Baixa | Lazy loading; SQLite-vec lightweight; monitorar |
| R6 | Breaking changes em providers MCP | Alto | Baixa | Wrapper abstrai API; version lock; testes E2E |
| R7 | Arquivos sensíveis indexados | Alto | Baixa | Blocklist patterns; validação em index(); auditoria |
| R8 | Debug difícil (MCP caixa preta) | Médio | Alta | Verbose mode; metrics; health check |
| R9 | Integração com State Layer | Médio | Baixa | Testes integração early; usar SnapshotManager existente |

### 7.2 Mitigation Strategies

**R1 (Provider stability):**
- Testar ambos providers antes de escolher
- MemoryMCP wrapper permite trocar provider sem breaking changes
- Fallback para keyword search sempre funciona

**R2 (Performance):**
- Benchmark com corpus real: `.claude/plans/`, `.claude/memory/`
- Target: p95 < 100ms para busca
- Cache de queries frequentes se necessário

**R8 (Debugging):**
- Implementar verbose mode com timing metrics
- Logs estruturados em formato JSON
- Health check endpoint/command

---

## 8. Patterns to Follow

### 8.1 Error Handling Pattern

```typescript
const spinner = ora('Action...').start()
try {
  // work
  spinner.succeed('Done')
} catch (error) {
  spinner.fail('Failed')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

**Fonte:** `src/commands/memory.ts:25-97`

### 8.2 Hook Pattern (Fail-Silent)

```bash
#!/bin/bash
FILE_PATH="$1"
if [ -z "$FILE_PATH" ]; then
  exit 0
fi
# ... work ...
exit 0
```

**Fonte:** `.claude/hooks/sync-state.sh:1-54`

### 8.3 Config Pattern

```typescript
export async function loadMemoryConfig(): Promise<MemoryConfig> {
  const configPath = getMemoryConfigPath()
  if (await fs.pathExists(configPath)) {
    const content = await fs.readJson(configPath)
    return mergeWithDefaults(content)
  }
  return { ...DEFAULT_MEMORY_CONFIG }
}
```

**Fonte:** `src/utils/config.ts:40-53`

### 8.4 Test Pattern

```typescript
jest.mock('../../src/utils/dependency')
const mockDep = dep as jest.MockedFunction<typeof dep>

describe('Module', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('should do something', async () => {
    mockDep.mockResolvedValue(value)
    const result = await functionUnderTest()
    expect(result).toBe(expected)
  })
})
```

**Fonte:** `tests/utils/memory-search.test.ts:1-60`

### 8.5 Type Export Pattern

```typescript
// src/types/index.ts
export * from './memory'
export * from './mcp-memory'  // Adicionar
```

**Fonte:** `src/types/index.ts:1-10`

---

## 9. Performance Considerations

### 9.1 Targets (do PRD)

| Operação | Target |
|----------|--------|
| Busca semântica (recall) | < 100ms (p95) |
| Indexação arquivo único | < 500ms |
| Indexação batch (100 files) | < 30s |
| Hook latency overhead | < 100ms |

### 9.2 Optimization Strategies

1. **Async Hook Execution**
   - Hook usa `&` para execução em background
   - Não bloqueia operação de escrita

2. **Debounce na Queue**
   - Múltiplas escritas no mesmo arquivo → 1 indexação
   - Debounce de 2 segundos

3. **Batch Processing**
   - `adk memory index --dir` processa em batches
   - Evita sobrecarga do MCP server

4. **Fallback Fast**
   - Se MCP timeout (5s) → fallback para keyword
   - Zero latência adicional para usuário

### 9.3 Caching Considerations

- Cache de queries frequentes em memória (session)
- TTL de 5 minutos para resultados
- Invalidação ao indexar novo documento

---

## 10. Security Considerations

### 10.1 Sensitive File Protection

**Blocklist patterns (nunca indexar):**
```json
{
  "ignorePatterns": [
    "**/.env*",
    "**/credentials*",
    "**/*.key",
    "**/*.pem",
    "**/secrets*",
    "**/.git/**"
  ]
}
```

### 10.2 API Token Storage

- Tokens MCP armazenados APENAS em `.env`
- NUNCA em `.adk/memory.json` ou settings
- Validação antes de salvar config

### 10.3 Input Validation

- Validar query antes de enviar ao MCP
- Sanitizar metadata antes de indexar
- Limit de tamanho para content (evitar DoS)

---

## 11. Integration Points

### 11.1 State Layer (Existente)

Componentes do State Layer que devem integrar:

| Componente | Arquivo | Integração |
|------------|---------|------------|
| StateManager | state-manager.ts | Usar para cache de estado |
| SnapshotManager | snapshot-manager.ts | Criar snapshot antes de operações destrutivas |
| SyncEngine | sync-engine.ts | Padrão de sync |
| HistoryTracker | history-tracker.ts | Log de operações |

### 11.2 Hooks (Existentes)

Hooks que devem coexistir com `post-write-index.sh`:

```json
"PostToolUse": [
  {
    "matcher": "Write",
    "hooks": [
      { "type": "command", "command": ".claude/hooks/post-write.sh" },
      { "type": "command", "command": ".claude/hooks/sync-state.sh" },
      { "type": "command", "command": ".claude/hooks/post-write-index.sh" }  // NOVO
    ]
  }
]
```

### 11.3 Memory Command (Extensão)

Métodos a adicionar em `MemoryCommand`:

```typescript
class MemoryCommand {
  // Existentes
  async save() {}
  async recall() {}  // Modificar para usar MCP

  // Novos
  async index(options: IndexOptions): Promise<void> {}
  async queue(filePath: string): Promise<void> {}
  async processQueue(options: ProcessQueueOptions): Promise<void> {}
}
```

---

## 12. Benchmark Requirements

### 12.1 Providers a Avaliar

| Provider | Pontos Fortes | Pontos a Validar |
|----------|---------------|------------------|
| @yikizi/mcp-local-rag | Otimizado para código; SQLite-vec | Manutenção; Response time |
| mcp-memory-service | 13+ apps; 5ms reportado | Embedding model fixo |

### 12.2 Métricas de Benchmark

| Métrica | Baseline | Target |
|---------|----------|--------|
| Recall cross-language | 20% | 80% |
| Precision top-5 | 60% | 85% |
| Response time p95 | N/A | < 100ms |
| Memory usage | N/A | < 500MB |

### 12.3 Corpus de Teste

Usar documentos reais do ADK:
- `.claude/plans/features/*/` (6+ features)
- `.claude/memory/` (project context)
- `.claude/decisions/` (ADRs)

---

## 13. Implementation Order

### Week 1: Foundation

1. **Benchmark MCP Providers**
   - Testar ambos com corpus real
   - Documentar em `mcp-benchmark.md`
   - Escolher provider

2. **Types & Config**
   - `src/types/mcp-memory.ts`
   - `.adk/memory.json` schema
   - Testes de tipos

### Week 2: Core Implementation

3. **MemoryMCP Wrapper**
   - `src/utils/memory-mcp.ts`
   - Testes unitários (>= 80%)
   - Fallback para keyword

4. **CLI Commands**
   - `adk memory index`
   - `adk memory recall` (modificado)
   - Testes de comandos

### Week 3: Automation & Integration

5. **Queue System**
   - `src/utils/memory-index-queue.ts`
   - Testes

6. **Hook**
   - `.claude/hooks/post-write-index.sh`
   - Integração com settings.json

7. **E2E & Docs**
   - Testes de integração
   - Documentação em CLAUDE.md

---

## 14. Open Questions

### 14.1 Para Decisão Durante Implementação

1. **Qual provider MCP usar?**
   - Depende do benchmark (Week 1)

2. **Embedding model fixo ou configurável?**
   - PRD sugere configurável, mas aumenta complexidade
   - Recomendação: fixo na v1, configurável na v2

3. **Cache de queries?**
   - Implementar se p95 > 50ms após baseline
   - Não antecipar otimização prematura

### 14.2 Validadas Durante Research

- ✅ Config path: `.adk/memory.json` (segue padrão existente)
- ✅ Hook path: `.claude/hooks/post-write-index.sh` (segue padrão)
- ✅ Fallback: usar `simpleSearch()` existente
- ✅ Types: novo arquivo em `src/types/mcp-memory.ts`

---

## 15. Success Criteria (Research Phase)

- [x] PRD completamente analisado
- [x] Componentes similares identificados
- [x] Tech stack documentada
- [x] Arquivos a criar listados
- [x] Arquivos a modificar listados
- [x] Dependências mapeadas
- [x] Riscos identificados com mitigações
- [x] Patterns de código documentados
- [x] Performance considerations listadas
- [x] Security considerations listadas
- [x] Integration points mapeados

---

**Research concluída em:** 2026-01-21
**Próxima fase:** Planning (criar implementation-plan.md)
**Blocker para planning:** Nenhum - todos os requisitos de research atendidos
