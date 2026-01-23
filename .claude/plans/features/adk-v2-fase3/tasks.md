# Tasks: adk-v2-fase3 - Context Compactor & Token Management

**Feature:** Context Compactor & Token Management
**Data:** 2026-01-22
**Status:** Ready for Implementation

---

## Fase 0: Setup e Dependencias

### Task 0.1: Instalar dependencias necessarias
- **Tipo:** Config
- **Prioridade:** P0
- **Dependencias:** nenhuma
- **Acceptance Criteria:**
  - [ ] `@anthropic-ai/sdk` instalado no package.json
  - [ ] `tiktoken` instalado no package.json
  - [ ] `npm run build` executa sem erros
  - [ ] `npm run type-check` passa

---

## Fase 1: Types (Foundation)

### Task 1.1: Criar tipos para compaction
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 0.1
- **Arquivo:** `src/types/compaction.ts`
- **Acceptance Criteria:**
  - [ ] Interface `CompactionLevel` com levels: raw, compact, summarize, handoff
  - [ ] Interface `CompactionResult` com originalTokens, compactedTokens, savedTokens, savedPercentage
  - [ ] Interface `CompactedItem` com type, originalSize, compactedSize, canRevert
  - [ ] Interface `TokenCountResult` com count, source, precision, timestamp, cached
  - [ ] Interface `ContextStatus` com currentTokens, maxTokens, usagePercentage, level, recommendation
  - [ ] Interface `CompactionConfig` com thresholds, tokenCounter, pruning, compaction sections
  - [ ] Interface `HandoffDocument` expandida com CURRENT, DONE, IN_PROGRESS, NEXT, FILES, ISSUES
  - [ ] Exportar DEFAULT_COMPACTION_CONFIG com valores padrao (70%, 85%, 95%)
  - [ ] `npm run type-check` passa

---

## Fase 2: Token Counter

### Task 2.1: Testes do TokenCounter - API
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 1.1
- **Arquivo:** `tests/utils/token-counter.test.ts`
- **Acceptance Criteria:**
  - [ ] Test suite `describe('TokenCounter')` criado
  - [ ] Test: `countViaAPI()` retorna count e source='api' quando API disponivel
  - [ ] Test: `countViaAPI()` retorna precision=1.0 para chamadas API
  - [ ] Test: Mock de `@anthropic-ai/sdk` configurado
  - [ ] Testes falham (RED phase)

### Task 2.2: Testes do TokenCounter - Cache
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 2.1
- **Arquivo:** `tests/utils/token-counter.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: `getCached()` retorna cache hit quando conteudo ja foi contado
  - [ ] Test: Cache retorna source='cache' e precision=0.95
  - [ ] Test: Cache expira apos TTL (1 hora)
  - [ ] Test: `invalidateCache()` limpa entradas especificas
  - [ ] Testes falham (RED phase)

### Task 2.3: Testes do TokenCounter - Fallback Offline
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 2.2
- **Arquivo:** `tests/utils/token-counter.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: `countOffline()` usa tiktoken quando API falha
  - [ ] Test: Fallback retorna source='offline' e precision=0.88
  - [ ] Test: Fator de ajuste 0.92 aplicado ao resultado tiktoken
  - [ ] Test: Fallback funciona mesmo sem conexao de rede
  - [ ] Testes falham (RED phase)

### Task 2.4: Implementar TokenCounter Core
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 2.3
- **Arquivo:** `src/utils/token-counter.ts`
- **Acceptance Criteria:**
  - [ ] Classe `TokenCounter` exportada
  - [ ] Metodo `count(text: string): Promise<TokenCountResult>`
  - [ ] Metodo privado `countViaAPI()` usando `anthropic.messages.countTokens`
  - [ ] Metodo privado `countOffline()` usando tiktoken
  - [ ] Tratamento de erro quando API key ausente
  - [ ] Todos os testes das Tasks 2.1-2.3 passam (GREEN phase)

### Task 2.5: Implementar TokenCounter Cache
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 2.4
- **Arquivo:** `src/utils/token-counter.ts`
- **Acceptance Criteria:**
  - [ ] Cache em memoria usando Map<hash, { count, timestamp }>
  - [ ] Hash MD5 do conteudo como chave
  - [ ] TTL configuravel (default 1 hora)
  - [ ] Metodo `invalidateCache(hash?: string)`
  - [ ] LRU eviction quando cache > 1000 entries
  - [ ] Todos os testes de cache passam

### Task 2.6: Testes de integracao TokenCounter
- **Tipo:** Test
- **Prioridade:** P1
- **Dependencias:** Task 2.5
- **Arquivo:** `tests/utils/token-counter.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: Fluxo completo API -> Cache -> API expira -> API novamente
  - [ ] Test: Fluxo API fail -> Offline fallback
  - [ ] Test: Performance < 500ms para API, < 50ms para offline
  - [ ] Test: Precisao reportada corretamente em cada cenario
  - [ ] Todos os testes passam

---

## Fase 3: Context Compactor

### Task 3.1: Testes do ContextCompactor - Threshold Detection
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 2.6
- **Arquivo:** `tests/utils/context-compactor.test.ts`
- **Acceptance Criteria:**
  - [ ] Test suite `describe('ContextCompactor')` criado
  - [ ] Test: `shouldCompact()` retorna false quando < 70%
  - [ ] Test: `shouldCompact()` retorna true quando >= 70%
  - [ ] Test: `getCompactionLevel()` retorna 'raw' quando < 70%
  - [ ] Test: `getCompactionLevel()` retorna 'compact' quando 70-85%
  - [ ] Test: `getCompactionLevel()` retorna 'summarize' quando 85-95%
  - [ ] Test: `getCompactionLevel()` retorna 'handoff' quando >= 95%
  - [ ] Testes falham (RED phase)

### Task 3.2: Testes do ContextCompactor - Compaction Reversivel
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 3.1
- **Arquivo:** `tests/utils/context-compactor.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: `compact()` remove tool outputs duplicados
  - [ ] Test: `compact()` deduplica conteudo repetido
  - [ ] Test: `compact()` comprime verbose outputs (git diff, logs)
  - [ ] Test: `compact()` preserva conteudo em `preservePatterns`
  - [ ] Test: `compact()` cria backup antes de compactar
  - [ ] Test: `compact()` retorna `CompactionResult` com metricas
  - [ ] Testes falham (RED phase)

### Task 3.3: Testes do ContextCompactor - Summarization
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 3.2
- **Arquivo:** `tests/utils/context-compactor.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: `summarize()` gera summary < 500 tokens
  - [ ] Test: `summarize()` preserva decisoes tomadas
  - [ ] Test: `summarize()` preserva arquivos modificados
  - [ ] Test: `summarize()` preserva proximos passos
  - [ ] Test: `summarize()` marca `reversible: false` no resultado
  - [ ] Test: `summarize()` usa `executeClaudeCommand()` para gerar summary
  - [ ] Testes falham (RED phase)

### Task 3.4: Testes do ContextCompactor - Handoff Document
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 3.3
- **Arquivo:** `tests/utils/context-compactor.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: `createHandoffDocument()` gera formato plain-text
  - [ ] Test: Handoff inclui secoes CURRENT, DONE, IN_PROGRESS, NEXT, FILES, ISSUES
  - [ ] Test: Handoff cria checkpoint via SnapshotManager antes de gerar
  - [ ] Test: Handoff inclui sessionId e checkpointId
  - [ ] Test: Handoff sugere comando para nova sessao
  - [ ] Testes falham (RED phase)

### Task 3.5: Implementar ContextCompactor Core
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 3.4
- **Arquivo:** `src/utils/context-compactor.ts`
- **Acceptance Criteria:**
  - [ ] Classe `ContextCompactor` exportada
  - [ ] Construtor recebe `CompactionConfig` opcional
  - [ ] Metodo `shouldCompact(feature: string): Promise<boolean>`
  - [ ] Metodo `getCompactionLevel(feature: string): Promise<CompactionLevel>`
  - [ ] Metodo `getContextStatus(feature: string): Promise<ContextStatus>`
  - [ ] Integracao com `TokenCounter` para contagem
  - [ ] Testes da Task 3.1 passam

### Task 3.6: Implementar ContextCompactor - Compaction Reversivel
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 3.5
- **Arquivo:** `src/utils/context-compactor.ts`
- **Acceptance Criteria:**
  - [ ] Metodo `compact(feature: string): Promise<CompactionResult>`
  - [ ] Funcao `removeDuplicateToolOutputs()` implementada
  - [ ] Funcao `deduplicateContent()` implementada
  - [ ] Funcao `compressVerboseOutputs()` implementada
  - [ ] Backup criado via `SnapshotManager` antes de compactar
  - [ ] Registro de compactacao salvo em `.compaction/history.json`
  - [ ] Testes da Task 3.2 passam

### Task 3.7: Implementar ContextCompactor - Summarization
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 3.6
- **Arquivo:** `src/utils/context-compactor.ts`
- **Acceptance Criteria:**
  - [ ] Metodo `summarize(feature: string): Promise<CompactionResult>`
  - [ ] Template de summarization com preserve patterns
  - [ ] Integracao com `executeClaudeCommand()` para gerar summary
  - [ ] Validacao de summary < 500 tokens
  - [ ] Testes da Task 3.3 passam

### Task 3.8: Implementar ContextCompactor - Handoff Document
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 3.7
- **Arquivo:** `src/utils/context-compactor.ts`
- **Acceptance Criteria:**
  - [ ] Metodo `createHandoffDocument(feature: string): Promise<HandoffDocument>`
  - [ ] Formato plain-text conforme template Anthropic
  - [ ] Checkpoint automatico antes de gerar handoff
  - [ ] Handoff salvo em `claude-progress.txt`
  - [ ] Testes da Task 3.4 passam

### Task 3.9: Criar template handoff-document.txt
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependencias:** Task 3.8
- **Arquivo:** `templates/handoff-document.txt`
- **Acceptance Criteria:**
  - [ ] Template com secoes: CURRENT, DONE, IN_PROGRESS, NEXT, FILES, ISSUES
  - [ ] Placeholders: [Feature Name], [Session ID], [Checkpoint ID], [Date]
  - [ ] Formato plain-text otimizado (menos tokens que JSON)
  - [ ] Instrucoes de uso no template

---

## Fase 4: Memory Pruner

### Task 4.1: Testes do MemoryPruner
- **Tipo:** Test
- **Prioridade:** P1
- **Dependencias:** Task 1.1
- **Arquivo:** `tests/utils/memory-pruner.test.ts`
- **Acceptance Criteria:**
  - [ ] Test suite `describe('MemoryPruner')` criado
  - [ ] Test: `getOldContent()` identifica conteudo > 30 dias
  - [ ] Test: `archive()` move conteudo para `.compaction/archived/`
  - [ ] Test: `archive()` cria log de arquivamento
  - [ ] Test: `pruneProjectContext()` limita a 500 linhas
  - [ ] Test: Threshold de dias configuravel
  - [ ] Testes falham (RED phase)

### Task 4.2: Implementar MemoryPruner
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependencias:** Task 4.1
- **Arquivo:** `src/utils/memory-pruner.ts`
- **Acceptance Criteria:**
  - [ ] Classe `MemoryPruner` exportada
  - [ ] Metodo `getOldContent(feature: string, days: number): Promise<string[]>`
  - [ ] Metodo `archive(feature: string): Promise<void>`
  - [ ] Metodo `pruneProjectContext(maxLines: number): Promise<void>`
  - [ ] Log de arquivamento em `.compaction/archive-log.json`
  - [ ] Todos os testes da Task 4.1 passam

---

## Fase 5: Integracao com StateManager

### Task 5.1: Testes de integracao StateManager + ContextCompactor
- **Tipo:** Test
- **Prioridade:** P0
- **Dependencias:** Task 3.8
- **Arquivo:** `tests/utils/state-manager.test.ts` (adicionar)
- **Acceptance Criteria:**
  - [ ] Test: `beforeToolUse()` verifica tokens e alerta se > 70%
  - [ ] Test: `afterToolUse()` atualiza contagem de tokens
  - [ ] Test: `onContextWarning()` dispara compactacao preventiva
  - [ ] Test: `getContextStatus()` retorna status atual
  - [ ] Testes falham (RED phase)

### Task 5.2: Implementar integracao StateManager
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependencias:** Task 5.1
- **Arquivo:** `src/utils/state-manager.ts`
- **Acceptance Criteria:**
  - [ ] Import de `ContextCompactor` adicionado
  - [ ] Propriedade privada `compactor: ContextCompactor`
  - [ ] Metodo `getContextStatus(feature: string): Promise<ContextStatus>`
  - [ ] Metodo privado `handleContextWarning()` para alertas
  - [ ] Integracao com createCheckpoint quando nivel='handoff'
  - [ ] Todos os testes da Task 5.1 passam

### Task 5.3: Expandir tipos de session
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependencias:** Task 5.2
- **Arquivo:** `src/types/session.ts`
- **Acceptance Criteria:**
  - [ ] `CheckpointReason` expandido com `'context_overflow'`
  - [ ] `SessionState` expandido com `tokenUsage?: { current: number, max: number }`
  - [ ] `npm run type-check` passa

---

## Fase 6: CLI Commands

### Task 6.1: Testes do comando feature status --tokens
- **Tipo:** Test
- **Prioridade:** P1
- **Dependencias:** Task 5.2
- **Arquivo:** `tests/commands/feature.test.ts` (adicionar)
- **Acceptance Criteria:**
  - [ ] Test: `feature status <name> --tokens` exibe uso de tokens
  - [ ] Test: Output inclui current, max, percentage, level, source
  - [ ] Test: Output inclui recommendation
  - [ ] Testes falham (RED phase)

### Task 6.2: Testes do comando feature compact
- **Tipo:** Test
- **Prioridade:** P1
- **Dependencias:** Task 6.1
- **Arquivo:** `tests/commands/feature.test.ts` (adicionar)
- **Acceptance Criteria:**
  - [ ] Test: `feature compact <name>` executa compactacao
  - [ ] Test: `feature compact <name> --dry-run` mostra preview
  - [ ] Test: `feature compact <name> --level summarize` forca nivel
  - [ ] Test: `feature compact <name> --revert` reverte ultima compactacao
  - [ ] Testes falham (RED phase)

### Task 6.3: Implementar flag --tokens no feature status
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependencias:** Task 6.2
- **Arquivo:** `src/commands/feature.ts`
- **Acceptance Criteria:**
  - [ ] Option `--tokens` adicionada ao comando status
  - [ ] Integracao com `StateManager.getContextStatus()`
  - [ ] Output formatado com chalk (cores por level)
  - [ ] Todos os testes da Task 6.1 passam

### Task 6.4: Implementar comando feature compact
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependencias:** Task 6.3
- **Arquivo:** `src/commands/feature.ts`
- **Acceptance Criteria:**
  - [ ] Subcomando `compact <name>` adicionado
  - [ ] Options: `--dry-run`, `--level <level>`, `--revert`
  - [ ] Integracao com `ContextCompactor`
  - [ ] Spinner e feedback visual com ora
  - [ ] Todos os testes da Task 6.2 passam

### Task 6.5: Testes dos comandos context
- **Tipo:** Test
- **Prioridade:** P2
- **Dependencias:** Task 4.2
- **Arquivo:** `tests/commands/context.test.ts` (criar)
- **Acceptance Criteria:**
  - [ ] Test: `adk context status` exibe status global
  - [ ] Test: `adk context prune` executa pruning
  - [ ] Test: `adk context prune --dry-run` mostra preview
  - [ ] Testes falham (RED phase)

### Task 6.6: Implementar comandos context
- **Tipo:** Implementation
- **Prioridade:** P2
- **Dependencias:** Task 6.5
- **Arquivo:** `src/commands/context.ts` (criar) + `src/cli.ts`
- **Acceptance Criteria:**
  - [ ] Classe `ContextCommand` criada
  - [ ] Subcomando `status` exibe contexto global
  - [ ] Subcomando `prune` executa MemoryPruner
  - [ ] Registrado em `src/cli.ts`
  - [ ] Todos os testes da Task 6.5 passam

---

## Fase 7: Hooks

### Task 7.1: Criar hook pre-overflow.sh
- **Tipo:** Implementation
- **Prioridade:** P2
- **Dependencias:** Task 5.2
- **Arquivo:** `.claude/hooks/pre-overflow.sh`
- **Acceptance Criteria:**
  - [ ] Script verifica uso de contexto via `adk context status --json`
  - [ ] Se > 85%, cria checkpoint automatico
  - [ ] Se > 95%, sugere handoff e nova sessao
  - [ ] Output formatado para terminal
  - [ ] Script executavel (chmod +x)

### Task 7.2: Documentar hook em settings.local.json
- **Tipo:** Config
- **Prioridade:** P2
- **Dependencias:** Task 7.1
- **Arquivo:** `.claude/docs/hooks-v2.md`
- **Acceptance Criteria:**
  - [ ] Documentacao do hook pre-overflow adicionada
  - [ ] Exemplo de configuracao em settings.local.json
  - [ ] Instrucoes de ativacao/desativacao

---

## Fase 8: Config e Documentacao

### Task 8.1: Adicionar CompactionConfig ao sistema de config
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependencias:** Task 1.1
- **Arquivo:** `src/providers/types.ts`
- **Acceptance Criteria:**
  - [ ] Interface `AdkConfig` expandida com `compaction?: CompactionConfig`
  - [ ] Defaults definidos em `src/utils/config.ts`
  - [ ] Merge correto com config existente

### Task 8.2: Atualizar CLAUDE.md com novos comandos
- **Tipo:** Config
- **Prioridade:** P2
- **Dependencias:** Task 6.6
- **Arquivo:** `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] Secao sobre Token Management adicionada
  - [ ] Comandos `feature status --tokens` e `feature compact` documentados
  - [ ] Comandos `context status` e `context prune` documentados
  - [ ] Configuracao de thresholds documentada

---

## Fase 9: Testes de Integracao e Stress

### Task 9.1: Testes de integracao end-to-end
- **Tipo:** Test
- **Prioridade:** P1
- **Dependencias:** Task 6.4
- **Arquivo:** `tests/integration/context-compactor.test.ts` (criar)
- **Acceptance Criteria:**
  - [ ] Test: Fluxo completo TokenCounter -> Compactor -> StateManager
  - [ ] Test: Checkpoint criado automaticamente quando nivel='handoff'
  - [ ] Test: Handoff document gerado com formato correto
  - [ ] Test: Rollback funciona em 24h

### Task 9.2: Testes de stress com contexto grande
- **Tipo:** Test
- **Prioridade:** P2
- **Dependencias:** Task 9.1
- **Arquivo:** `tests/integration/context-compactor.test.ts`
- **Acceptance Criteria:**
  - [ ] Test: Compactacao de 100k tokens completa em < 1s
  - [ ] Test: Summarization completa em < 3s
  - [ ] Test: Cache de tokens funciona corretamente com grande volume
  - [ ] Test: Zero memory leaks em operacoes repetidas

### Task 9.3: Validar cobertura de testes
- **Tipo:** Test
- **Prioridade:** P1
- **Dependencias:** Task 9.2
- **Arquivo:** N/A (npm run test:coverage)
- **Acceptance Criteria:**
  - [ ] Coverage >= 80% para `token-counter.ts`
  - [ ] Coverage >= 80% para `context-compactor.ts`
  - [ ] Coverage >= 80% para `memory-pruner.ts`
  - [ ] Coverage report gerado sem erros

---

## Resumo de Dependencias

```
Fase 0 (Setup)
  └── Fase 1 (Types)
        ├── Fase 2 (TokenCounter)
        │     └── Fase 3 (ContextCompactor)
        │           └── Fase 5 (StateManager Integration)
        │                 └── Fase 6 (CLI Commands)
        │                       └── Fase 7 (Hooks)
        │                             └── Fase 8 (Config/Docs)
        │                                   └── Fase 9 (Integration Tests)
        └── Fase 4 (MemoryPruner) [paralelo com Fase 3]
```

## Prioridades

| Prioridade | Descricao | Tasks |
|------------|-----------|-------|
| P0 | Bloqueador - deve ser feito primeiro | 0.1, 1.1, 2.1-2.6, 3.1-3.8, 5.1-5.2 |
| P1 | Importante - core functionality | 3.9, 4.1-4.2, 5.3, 6.1-6.4, 8.1, 9.1, 9.3 |
| P2 | Desejavel - enhancement | 6.5-6.6, 7.1-7.2, 8.2, 9.2 |

## Estimativa

- **P0 Tasks:** ~18 tasks (core)
- **P1 Tasks:** ~11 tasks (important)
- **P2 Tasks:** ~7 tasks (enhancement)
- **Total:** 36 tasks

---

*Gerado: 2026-01-22*
*Baseado em: prd.md v1.0 + research.md*
