# Implementation Plan: adk-v2-fase3 - Context Compactor & Token Management

**Data:** 2026-01-22
**Status:** Ready for Implementation
**Baseado em:** research.md, prd.md
**Estimated Story Points:** 34 SP

---

## Visão Geral da Implementação

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY GRAPH                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                    ┌─────────────────────┐                                       │
│                    │   FASE 1: Types     │                                       │
│                    │   (compaction.ts)   │                                       │
│                    └──────────┬──────────┘                                       │
│                               │                                                  │
│              ┌────────────────┼────────────────┐                                 │
│              │                │                │                                 │
│              ▼                ▼                ▼                                 │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                        │
│   │ FASE 2: Token │  │   FASE 3:     │  │   FASE 3:     │                        │
│   │   Counter     │  │MemoryPruner   │  │   Handoff     │                        │
│   └───────┬───────┘  │  (parallel)   │  │   Template    │                        │
│           │          └───────────────┘  └───────────────┘                        │
│           ▼                                                                      │
│   ┌───────────────┐                                                              │
│   │  FASE 4:      │                                                              │
│   │  Compactor    │                                                              │
│   └───────┬───────┘                                                              │
│           │                                                                      │
│           ▼                                                                      │
│   ┌───────────────┐                                                              │
│   │  FASE 5:      │                                                              │
│   │ StateManager  │                                                              │
│   │  Integration  │                                                              │
│   └───────┬───────┘                                                              │
│           │                                                                      │
│   ┌───────┴────────┬─────────────────┐                                           │
│   ▼                ▼                 ▼                                           │
│ ┌─────────┐  ┌───────────┐  ┌───────────────┐                                    │
│ │FASE 6:  │  │ FASE 6:   │  │   FASE 7:     │                                    │
│ │Feature  │  │  Hooks    │  │    QA &       │                                    │
│ │Commands │  │           │  │Documentation  │                                    │
│ └─────────┘  └───────────┘  └───────────────┘                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Foundation - Types & Config

**Objetivo:** Estabelecer base de tipos e configurações para todo o sistema

**Story Points:** 3 SP

### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/types/compaction.ts` | Criar | Tipos principais do sistema |
| `src/types/session.ts` | Modificar | Expandir CheckpointReason e HandoffDocument |
| `src/providers/types.ts` | Modificar | Adicionar CompactionConfig ao AdkConfig |

### Tarefas Detalhadas

#### 1.1 Criar `src/types/compaction.ts`
```typescript
export type CompactionLevelType = 'raw' | 'compact' | 'summarize' | 'handoff'
export type TokenSource = 'api' | 'cache' | 'offline'
export type CompactedItemType = 'tool_output' | 'duplicate' | 'verbose' | 'old_content'

export interface CompactionLevel { level, threshold, description }
export interface CompactionResult { originalTokens, compactedTokens, savedTokens, ... }
export interface CompactedItem { type, originalSize, compactedSize, canRevert, revertPath? }
export interface TokenCountResult { count, source, precision, timestamp, cached }
export interface ContextStatus { currentTokens, maxTokens, usagePercentage, level, recommendation, canContinue }
export interface CompactionConfig { thresholds, tokenCounter, pruning, compaction }
export interface CompactionHistory { entries: CompactionHistoryEntry[] }
export interface CompactionHistoryEntry { timestamp, level, tokensBefore, tokensAfter, itemsCompacted }
```

#### 1.2 Expandir `src/types/session.ts`
- Adicionar `'context_overflow'` ao `CheckpointReason`
- Expandir `HandoffDocument`:
  - Adicionar `feature: string`
  - Adicionar `createdAt: string`
  - Adicionar `sessionId: string`
  - Adicionar `checkpointId: string`
  - Mudar `issues: string` para `issues: string[]`

#### 1.3 Adicionar CompactionConfig em `src/providers/types.ts`
```typescript
export interface AdkConfig {
  // ... existing
  compaction?: CompactionConfig
}
```

### Testes Necessários
- `tests/types/compaction.test.ts`:
  - Type guards funcionam corretamente
  - Default config values são válidos
  - Validação de ranges (thresholds 0-1)

### Critérios de Aceitação
- [ ] Todos os tipos definidos conforme PRD seção 11.1
- [ ] Types exportados e importáveis
- [ ] Backward compatibility mantida em session.ts
- [ ] Config defaults definidos como constantes
- [ ] TypeScript compila sem erros

### Dependências
- Nenhuma (fase inicial)

---

## Fase 2: Token Counter

**Objetivo:** Implementar contagem precisa de tokens com API + fallback

**Story Points:** 5 SP

### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/utils/token-counter.ts` | Criar | Classe principal de contagem |
| `tests/utils/token-counter.test.ts` | Criar | Testes unitários |
| `package.json` | Modificar | Adicionar tiktoken |

### Tarefas Detalhadas

#### 2.1 Instalar dependência tiktoken
```bash
npm install tiktoken@^1.0.16
```

#### 2.2 Criar `src/utils/token-counter.ts`

**Estrutura da Classe:**
```typescript
export class TokenCounter {
  private cache: Map<string, CacheEntry>
  private readonly CACHE_TTL = 3600000
  private readonly CACHE_MAX_SIZE = 1000
  private readonly ADJUSTMENT_FACTOR = 0.92

  async count(text: string): Promise<TokenCountResult>
  private async countViaAPI(text: string): Promise<number>
  private countOffline(text: string): TokenCountResult
  private getCached(hash: string): CacheEntry | undefined
  private setCache(hash: string, count: number): void
  invalidateCache(): void
  getCacheStats(): { size: number; hits: number; misses: number }
}

export const tokenCounter = new TokenCounter()
```

**Métodos principais:**

1. `count(text: string)`:
   - Calcular hash MD5 do texto
   - Verificar cache (TTL: 1h)
   - Se cache hit → retornar com source: 'cache'
   - Tentar API Anthropic
   - Se API falhar → fallback tiktoken
   - Armazenar em cache
   - Implementar LRU eviction (max 1000 entries)

2. `countViaAPI(text: string)`:
   - Usar `anthropic.messages.countTokens()`
   - Model: 'claude-sonnet-4-20250514'
   - Retornar `input_tokens`

3. `countOffline(text: string)`:
   - Usar tiktoken `encoding_for_model('gpt-4')`
   - Aplicar fator de ajuste 0.92
   - Reportar precision: 0.88

### Testes Necessários

```typescript
describe('TokenCounter', () => {
  describe('count', () => {
    it('should return cached result when available')
    it('should call API when cache miss')
    it('should fallback to offline when API fails')
    it('should apply adjustment factor in offline mode')
    it('should respect cache TTL')
    it('should evict LRU entries when cache is full')
  })

  describe('countViaAPI', () => {
    it('should call anthropic.messages.countTokens')
    it('should throw on API error')
  })

  describe('countOffline', () => {
    it('should return result with precision 0.88')
    it('should apply adjustment factor 0.92')
    it('should handle empty string')
    it('should handle unicode text')
  })

  describe('cache', () => {
    it('should store entries with correct TTL')
    it('should invalidate on demand')
    it('should report cache stats')
  })
})
```

### Critérios de Aceitação
- [ ] RF01: Precisão via API >= 95%
- [ ] RF02: Fallback offline funcional quando API indisponível
- [ ] RF03: Cache com TTL de 1h implementado
- [ ] RF04: Cache invalidation funcional
- [ ] RF05: Source e precision reportados em resultado
- [ ] RNF01: API counting < 500ms
- [ ] RNF02: Offline counting < 50ms
- [ ] RNF05: Cache lookup < 5ms
- [ ] Cobertura de testes >= 80%

### Dependências
- Fase 1 (tipos)
- `tiktoken` instalado
- `ANTHROPIC_API_KEY` em variável de ambiente

---

## Fase 3: Memory Pruner & Handoff Template (Paralela)

**Objetivo:** Implementar arquivamento de conteúdo antigo e template de handoff

**Story Points:** 5 SP (3 SP Pruner + 2 SP Template)

### 3A: Memory Pruner

#### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/utils/memory-pruner.ts` | Criar | Arquivamento de conteúdo antigo |
| `tests/utils/memory-pruner.test.ts` | Criar | Testes unitários |

#### Tarefas Detalhadas

**Estrutura da Classe:**
```typescript
export class MemoryPruner {
  private config: PruningConfig

  async pruneFeature(feature: string, dryRun?: boolean): Promise<PruneResult>
  async pruneProjectContext(dryRun?: boolean): Promise<PruneResult>
  private async getContentAge(file: string): Promise<number>
  private async archiveContent(file: string, archivePath: string): Promise<void>
  private async limitFileLines(file: string, maxLines: number): Promise<LimitResult>
}

export const memoryPruner = new MemoryPruner()
```

**Métodos principais:**

1. `pruneFeature(feature)`:
   - Escanear arquivos na pasta da feature
   - Identificar conteúdo > 30 dias (configurável)
   - Mover para `.compaction/archived/`
   - Manter registro para MCP Memory recall

2. `pruneProjectContext()`:
   - Verificar `.claude/memory/project-context.md`
   - Se > 500 linhas: arquivar porção antiga
   - Manter seções estruturais (headers)

3. `archiveContent()`:
   - Criar backup antes de arquivar
   - Adicionar metadata (data original, hash)
   - Indexar no arquivo de log

#### Testes Memory Pruner
```typescript
describe('MemoryPruner', () => {
  describe('pruneFeature', () => {
    it('should identify content older than threshold')
    it('should archive old content')
    it('should preserve recent content')
    it('should respect dry-run mode')
    it('should create archive log')
  })

  describe('pruneProjectContext', () => {
    it('should limit to 500 lines')
    it('should preserve headers')
    it('should archive overflow')
  })
})
```

### 3B: Handoff Template

#### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `templates/handoff-document.txt` | Criar | Template expandido |

#### Template Expandido
```text
========================================
HANDOFF DOCUMENT: [FEATURE]
Generated: [TIMESTAMP]
Session: [SESSION_ID]
Checkpoint: [CHECKPOINT_ID]
========================================

## CURRENT TASK
[current task description] ([progress]% complete)

## COMPLETED
[- completed task 1]
[- completed task 2]

## IN PROGRESS
[- task in progress 1]

## NEXT STEPS
[1. next task]
[2. next task]

## FILES MODIFIED
[- file1.ts: description]
[- file2.ts: description]

## BLOCKING ISSUES
[- issue description (if any)]
[None blocking]

## DECISIONS MADE
[- decision 1: rationale]
[- decision 2: rationale]

## CONTEXT FOR CONTINUATION
[Brief context about current state and what the next session needs to know]

========================================
Use: adk feature continue [FEATURE] to resume
========================================
```

### Critérios de Aceitação (Fase 3)
- [ ] RF25: Conteúdo > 30 dias arquivado
- [ ] RF26: project-context.md limitado a 500 linhas
- [ ] RF27: Registro de arquivamento mantido
- [ ] RF21: Handoff em formato plain-text
- [ ] RF22: Handoff inclui todas as seções obrigatórias
- [ ] Dry-run mode funcional
- [ ] Cobertura de testes >= 80%

### Dependências
- Fase 1 (tipos)
- Independente de Fase 2

---

## Fase 4: Context Compactor

**Objetivo:** Implementar compactação hierárquica de contexto

**Story Points:** 8 SP

### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/utils/context-compactor.ts` | Criar | Classe principal de compactação |
| `tests/utils/context-compactor.test.ts` | Criar | Testes unitários e integração |

### Tarefas Detalhadas

**Estrutura da Classe:**
```typescript
export class ContextCompactor {
  private tokenCounter: TokenCounter
  private snapshotManager: SnapshotManager
  private config: CompactionConfig

  async getContextStatus(feature: string): Promise<ContextStatus>
  async shouldCompact(feature: string): Promise<CompactionLevel>
  async compact(feature: string, options?: CompactOptions): Promise<CompactionResult>
  async summarize(feature: string): Promise<SummarizeResult>
  async createHandoffDocument(feature: string): Promise<HandoffDocument>
  async revertCompaction(feature: string, historyId: string): Promise<boolean>

  private async removeToolOutputs(content: string): Promise<CompactedItem[]>
  private async deduplicateContent(content: string): Promise<CompactedItem[]>
  private async compressVerboseOutput(content: string): Promise<CompactedItem[]>
  private async preserveCriticalContent(content: string): Promise<string>
  private async saveCompactionHistory(feature: string, result: CompactionResult): Promise<void>
}

export const contextCompactor = new ContextCompactor()
```

**Métodos principais:**

1. `getContextStatus(feature)`:
   - Agregar todo contexto da feature (progress.md, tasks.md, state.json, etc.)
   - Contar tokens via TokenCounter
   - Calcular porcentagem de uso
   - Determinar nível atual (raw/compact/summarize/handoff)
   - Gerar recomendação

2. `shouldCompact(feature)`:
   - Verificar thresholds configurados
   - 0-70%: raw (não compactar)
   - 70-85%: compact (reversível)
   - 85-95%: summarize (lossy)
   - >95%: handoff (nova sessão)

3. `compact(feature, options)`:
   - **BACKUP PRIMEIRO** via SnapshotManager
   - Executar compactação reversível:
     - Remover tool outputs redundantes (regex patterns)
     - Deduplicar conteúdo repetido (hash-based)
     - Comprimir verbose outputs (git diff, logs)
   - Salvar registro de compactação para rollback
   - Retornar resultado com métricas

4. `summarize(feature)`:
   - Preservar: decisões, arquivos modificados, próximos passos
   - Usar `executeClaudeCommand()` para gerar summary
   - Template conservador (< 500 tokens)
   - Indicar claramente perda de informação

5. `createHandoffDocument(feature)`:
   - Carregar estado unificado via StateManager
   - Popular template handoff-document.txt
   - Criar checkpoint automático
   - Retornar documento completo

6. `revertCompaction(feature, historyId)`:
   - Verificar se dentro do período de rollback (24h)
   - Restaurar de `.compaction/backup/`
   - Atualizar histórico

**Padrões de Compactação (Regex):**
```typescript
const TOOL_OUTPUT_PATTERNS = [
  /^Read tool output:[\s\S]*?(?=\n\n)/gm,
  /^Glob results:[\s\S]*?(?=\n\n)/gm,
  /^Bash output:[\s\S]*?(?=\n\n)/gm,
]

const PRESERVE_PATTERNS = [
  /^## Decision:/gm,
  /^ADR-\d+/gm,
  /error|fail|critical/gi,
]
```

### Testes Necessários

```typescript
describe('ContextCompactor', () => {
  describe('getContextStatus', () => {
    it('should return raw level when under 70%')
    it('should return compact level between 70-85%')
    it('should return summarize level between 85-95%')
    it('should return handoff level above 95%')
    it('should include recommendation')
  })

  describe('compact', () => {
    it('should create backup before compaction')
    it('should remove tool outputs')
    it('should deduplicate content')
    it('should preserve critical content')
    it('should save compaction history')
    it('should be reversible')
    it('should respect preserve patterns')
  })

  describe('summarize', () => {
    it('should preserve decisions')
    it('should preserve file list')
    it('should keep summary under 500 tokens')
    it('should indicate information loss')
  })

  describe('createHandoffDocument', () => {
    it('should follow template format')
    it('should include all required sections')
    it('should create checkpoint')
  })

  describe('revertCompaction', () => {
    it('should restore from backup')
    it('should fail after 24h')
    it('should update history')
  })
})
```

### Critérios de Aceitação
- [ ] RF06: Monitoramento de tokens em tempo real
- [ ] RF07: Alerta em 70% (warning)
- [ ] RF08: Alerta em 85% (critical)
- [ ] RF09: Ação forçada em 95% (emergency)
- [ ] RF11-15: Compactação reversível completa
- [ ] RF16-19: Summarization inteligente
- [ ] RF20-24: Handoff document automático
- [ ] RNF03: Compactação < 1s
- [ ] RNF04: Summarization < 3s
- [ ] RNF09: Funciona offline (sem API)
- [ ] RNF11: Backup antes de compactação
- [ ] RNF12: Rollback em até 24h
- [ ] Cobertura de testes >= 80%

### Dependências
- Fase 1 (tipos)
- Fase 2 (TokenCounter)
- SnapshotManager existente

---

## Fase 5: StateManager Integration

**Objetivo:** Integrar compactação ao fluxo de gerenciamento de estado

**Story Points:** 5 SP

### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/utils/state-manager.ts` | Modificar | Adicionar monitoramento de tokens |
| `tests/utils/state-manager.test.ts` | Modificar | Adicionar testes de integração |

### Tarefas Detalhadas

#### 5.1 Adicionar métodos ao StateManager

```typescript
export class StateManager {
  private compactor = contextCompactor

  async getContextStatus(feature: string): Promise<ContextStatus>
  async beforeToolUse(feature: string): Promise<ContextWarning | null>
  async handleContextWarning(feature: string, status: ContextStatus): Promise<void>
  async triggerCompaction(feature: string, level?: CompactionLevelType): Promise<CompactionResult>
}
```

**Integração no fluxo:**

1. `loadUnifiedState()` → adicionar token count ao retorno
2. `saveUnifiedState()` → verificar threshold após salvar
3. `createCheckpoint()` → incluir `context_overflow` como reason
4. `createHandoffDocument()` → delegar para ContextCompactor

#### 5.2 Implementar `beforeToolUse`

```typescript
async beforeToolUse(feature: string): Promise<ContextWarning | null> {
  const status = await this.getContextStatus(feature)

  if (status.level === 'handoff') {
    return {
      severity: 'emergency',
      message: 'Context limit reached. Creating handoff document.',
      action: 'handoff'
    }
  }

  if (status.level === 'summarize') {
    return {
      severity: 'critical',
      message: `Context at ${status.usagePercentage}%. Summarization recommended.`,
      action: 'summarize'
    }
  }

  if (status.level === 'compact') {
    return {
      severity: 'warning',
      message: `Context at ${status.usagePercentage}%. Consider compaction.`,
      action: 'compact'
    }
  }

  return null
}
```

### Testes Necessários

```typescript
describe('StateManager - Token Integration', () => {
  describe('getContextStatus', () => {
    it('should return current token usage')
    it('should calculate correct percentage')
  })

  describe('beforeToolUse', () => {
    it('should return null when context is safe')
    it('should return warning at 70%')
    it('should return critical at 85%')
    it('should return emergency at 95%')
  })

  describe('handleContextWarning', () => {
    it('should trigger compaction at warning level')
    it('should trigger summarization at critical level')
    it('should create handoff at emergency level')
  })

  describe('triggerCompaction', () => {
    it('should call ContextCompactor.compact')
    it('should update state after compaction')
    it('should log metrics')
  })
})
```

### Critérios de Aceitação
- [ ] RF06: Monitoramento em tempo real via StateManager
- [ ] RF10: Métricas de uso de tokens logadas
- [ ] Integração transparente (não quebra fluxo existente)
- [ ] Warnings exibidos no spinner/terminal
- [ ] Backward compatibility mantida
- [ ] Cobertura de testes >= 80%

### Dependências
- Fase 1 (tipos)
- Fase 4 (ContextCompactor)

---

## Fase 6: CLI Commands & Hooks

**Objetivo:** Expor funcionalidades via CLI e automação

**Story Points:** 5 SP (3 SP CLI + 2 SP Hooks)

### 6A: Feature Commands

#### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/commands/feature.ts` | Modificar | Adicionar --tokens e compact |
| `src/cli.ts` | Modificar | Registrar comandos context |

#### Tarefas Detalhadas

**6A.1 Modificar `feature status`:**
```typescript
.option('--tokens', 'Show token usage information')
```

Output esperado:
```
Feature: auth
Status: implementing (65%)

Token Usage:
├─ Current: 45,230 tokens (56.5%)
├─ Max: 80,000 tokens
├─ Level: RAW (safe)
├─ Source: api (precision: 100%)
└─ Recommendation: Continue normally
```

**6A.2 Adicionar `feature compact`:**
```typescript
.command('compact <name>')
.description('Compact feature context')
.option('--dry-run', 'Preview compaction without applying')
.option('--level <level>', 'Force compaction level: compact|summarize')
.option('--revert', 'Revert last compaction')
```

**6A.3 Adicionar comandos `context`:**
```typescript
program
  .command('context')
  .description('Manage context and tokens')
  .command('status')
  .description('Show current context status')
  .action(async () => { ... })

  .command('prune')
  .description('Prune old content')
  .option('--dry-run', 'Preview without applying')
  .action(async () => { ... })
```

### 6B: Hooks

#### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `.claude/hooks/pre-overflow.sh` | Criar | Checkpoint antes de overflow |

#### Hook pre-overflow.sh

```bash
#!/bin/bash
# Hook: pre-overflow
# Event: PreToolUse (when context > 90%)
# Action: Create checkpoint automatically

FEATURE=$(cat .claude/active-focus.md 2>/dev/null | grep "^feature:" | cut -d: -f2 | tr -d ' ')

if [ -z "$FEATURE" ]; then
  exit 0
fi

# Check context status
STATUS=$(adk feature status "$FEATURE" --tokens --json 2>/dev/null)
PERCENTAGE=$(echo "$STATUS" | grep -o '"usagePercentage":[0-9.]*' | cut -d: -f2)

if [ "$(echo "$PERCENTAGE > 90" | bc)" -eq 1 ]; then
  echo "⚠️ Context at ${PERCENTAGE}%. Creating safety checkpoint..."
  adk feature checkpoint "$FEATURE" --reason context_overflow --quiet
  echo "✓ Checkpoint created. Consider running: adk feature compact $FEATURE"
fi
```

#### Registrar hook em settings

Instruções para adicionar em `.claude/settings.local.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "tool_name": ".*" },
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/pre-overflow.sh"
          }
        ]
      }
    ]
  }
}
```

### Critérios de Aceitação (Fase 6)
- [ ] CLI `feature status --tokens` funcional
- [ ] CLI `feature compact` com todas as opções
- [ ] CLI `context status` e `context prune`
- [ ] Hook pre-overflow cria checkpoint automaticamente
- [ ] Output colorido e informativo
- [ ] Help messages completas
- [ ] Integração com spinner/ora

### Dependências
- Fase 4 (ContextCompactor)
- Fase 5 (StateManager integration)

---

## Fase 7: Testing & Documentation

**Objetivo:** Garantir qualidade e documentar funcionalidades

**Story Points:** 3 SP

### Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `tests/integration/compaction.test.ts` | Criar | Testes de integração |
| `CLAUDE.md` | Modificar | Documentar novos comandos |
| `.claude/docs/context-compaction.md` | Criar | Documentação detalhada |

### Tarefas Detalhadas

#### 7.1 Testes de Integração

```typescript
describe('Compaction Integration', () => {
  describe('Full compaction flow', () => {
    it('should compact when reaching 70% threshold')
    it('should summarize when reaching 85% threshold')
    it('should create handoff when reaching 95% threshold')
    it('should preserve critical content through all levels')
    it('should allow rollback within 24h')
  })

  describe('Stress test', () => {
    it('should handle 100k token context')
    it('should maintain performance under load')
  })

  describe('Recovery scenarios', () => {
    it('should recover from API failure')
    it('should recover from interrupted compaction')
  })
})
```

#### 7.2 Atualizar CLAUDE.md

Adicionar seções:
- Context Management (novo)
- Comandos de compactação
- Configuração de thresholds
- Troubleshooting

#### 7.3 Criar documentação técnica

`.claude/docs/context-compaction.md`:
- Arquitetura do sistema
- Fluxo de compactação
- Configuração avançada
- Métricas e observabilidade

### Critérios de Aceitação (Fase 7)
- [ ] RNF19: Cobertura >= 80% em todos os módulos
- [ ] RNF20: Cenários de fallback testados
- [ ] RNF21: Precisão de token counting validada
- [ ] Documentação completa no CLAUDE.md
- [ ] Docs técnicos para desenvolvedores
- [ ] Exemplos de uso documentados

### Dependências
- Todas as fases anteriores completas

---

## Resumo de Story Points

| Fase | Descrição | Story Points |
|------|-----------|--------------|
| 1 | Foundation - Types & Config | 3 SP |
| 2 | Token Counter | 5 SP |
| 3 | Memory Pruner & Handoff Template | 5 SP |
| 4 | Context Compactor | 8 SP |
| 5 | StateManager Integration | 5 SP |
| 6 | CLI Commands & Hooks | 5 SP |
| 7 | Testing & Documentation | 3 SP |
| **Total** | | **34 SP** |

---

## Pontos de Verificação (Checkpoints)

| Checkpoint | Após Fase | Validação |
|------------|-----------|-----------|
| CP1 | Fase 1 | Types compilam, testes passam |
| CP2 | Fase 2 | Token counting funcional (API + fallback) |
| CP3 | Fase 3 | Memory pruning e template funcionais |
| CP4 | Fase 4 | Compactação completa com rollback |
| CP5 | Fase 5 | StateManager integrado, warnings funcionam |
| CP6 | Fase 6 | CLI funcional, hooks operacionais |
| CP7 | Fase 7 | Cobertura >= 80%, docs completos |

---

## Estratégia de Testes

### Níveis de Teste

```
┌─────────────────────────────────────────────────────────────────┐
│                       PIRÂMIDE DE TESTES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌──────────────┐                              │
│                    │   E2E (5%)   │                              │
│                    │ Long session │                              │
│                    │  simulation  │                              │
│                    └──────────────┘                              │
│                                                                  │
│              ┌────────────────────────┐                          │
│              │   Integration (25%)    │                          │
│              │ TokenCounter+Compactor │                          │
│              │ StateManager+Compactor │                          │
│              └────────────────────────┘                          │
│                                                                  │
│        ┌──────────────────────────────────┐                      │
│        │         Unit Tests (70%)         │                      │
│        │  TokenCounter, ContextCompactor  │                      │
│        │  MemoryPruner, Type guards       │                      │
│        └──────────────────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mocking Strategy

| Componente | Mock Strategy |
|------------|---------------|
| Anthropic API | Mock `@anthropic-ai/sdk` |
| File System | `fs-extra` com `memfs` ou temp dirs |
| tiktoken | Partial mock para controle de output |
| SnapshotManager | Spy para verificar chamadas |
| executeClaudeCommand | Mock para evitar execução real |

### Test Environment

```typescript
// jest.setup.ts
beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  process.env.TEST_MODE = 'true'
})

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-compaction-'))
  process.env.TEST_FEATURE_PATH = tempDir
})

afterEach(async () => {
  await fs.remove(tempDir)
  delete process.env.TEST_FEATURE_PATH
})
```

---

## Riscos e Mitigações (Atualizados)

| Risco | Probabilidade | Impacto | Mitigação | Fase Afetada |
|-------|---------------|---------|-----------|--------------|
| API rate limit | Média | Médio | Cache agressivo + fallback | 2 |
| tiktoken impreciso | Baixa | Médio | Fator 0.92 + validação | 2 |
| Compactação remove info | Média | Alto | Backup + whitelist | 4 |
| Summarization agressiva | Média | Alto | Template conservador | 4 |
| Performance degradada | Média | Médio | Incremental processing | 4, 5 |
| Breaking changes | Baixa | Médio | Backward compatibility | 1, 5 |
| Hook failure | Baixa | Baixo | Graceful degradation | 6 |

---

## Ordem de Implementação Recomendada

```
Semana 1:
├─ Fase 1: Types & Config (dia 1)
├─ Fase 2: Token Counter (dias 2-3)
└─ Fase 3: Memory Pruner + Template (dias 4-5) [paralelo com finalização F2]

Semana 2:
├─ Fase 4: Context Compactor (dias 1-4)
└─ Checkpoint CP4

Semana 3:
├─ Fase 5: StateManager Integration (dias 1-2)
├─ Fase 6: CLI & Hooks (dias 3-4)
└─ Fase 7: Testing & Documentation (dia 5)
└─ Checkpoint Final
```

---

## Métricas de Sucesso

### Acceptance Criteria Summary

- [ ] Token counting precision >= 95% (API) / >= 85% (offline)
- [ ] Context overflows evitados >= 90%
- [ ] Tokens economizados por compactação >= 30%
- [ ] Compactação completa em < 1s
- [ ] Summarization em < 3s
- [ ] Cobertura de testes >= 80%
- [ ] Zero regressões em funcionalidades existentes
- [ ] Documentação completa e atualizada

---

**Plano aprovado para implementação.**

*Gerado em: 2026-01-22*
*Próximo passo: Iniciar Fase 1 - Types & Config*
