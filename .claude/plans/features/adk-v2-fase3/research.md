# Research: adk-v2-fase3 - Context Compactor & Token Management

## Current State Analysis

### Existing Infrastructure

O ADK possui infraestrutura robusta já implementada nas Fases 1 e 2:

**Session Management (Fase 2):**
- `StateManager` (`src/utils/state-manager.ts:26-600`) - gerencia estado unificado de features
- `SnapshotManager` (`src/utils/snapshot-manager.ts:13-135`) - cria/restaura snapshots
- Session tracking com checkpoints, handoff documents, e histórico de transições
- Tipos em `src/types/session.ts` incluem `CheckpointReason: 'context_warning'`

**Memory System (Fase 1):**
- `TieredMemory` (`src/utils/tiered-memory.ts:24-232`) - hierarquia de memória (project → feature → phase → session)
- `memory-compression.ts` - compressão de memória baseada em linhas (não tokens)
- `memory-mcp.ts` - integração com MCP Memory

**Config System:**
- `src/utils/config.ts` - gerencia configurações em `.adk/config.json`
- Padrão de merge com defaults já estabelecido

### Current Limitations

1. **Token Counting:** Nenhum sistema de contagem de tokens existe
2. **Context Monitoring:** Sem monitoramento de uso de contexto em tempo real
3. **Compactação:** `memory-compression.ts` usa line count, não token count
4. **Thresholds:** Hardcoded em `memory-compression.ts:6-8` (800/1000 linhas)

## Similar Components

### SnapshotManager Pattern
```
src/utils/snapshot-manager.ts:37-66
- createSnapshot() cria backup antes de operações
- Usa fs-extra para operações atômicas
- Armazena metadata em meta.json
- cleanupOldSnapshots() com retenção configurável
```

Este padrão DEVE ser seguido para backup antes de compactação.

### Memory Compression Pattern
```
src/utils/memory-compression.ts:17-84
- shouldCompress() verifica threshold
- archiveMemory() cria backup antes de comprimir
- Usa executeClaudeCommand() para summarization
```

ContextCompactor deve seguir padrão similar mas com token-based thresholds.

### StateManager Session Methods
```
src/utils/state-manager.ts:260-436
- createSession(), updateSession(), endSession()
- createHandoffDocument() já existe e gera plain-text
- Integração com checkpoints
```

Token monitoring deve integrar com estes métodos.

### Config Loading Pattern
```
src/utils/config.ts:19-52
- mergeWithDefaults() para configurações
- Sanitização de secrets antes de salvar
- Usa getMainRepoPath() para localização
```

CompactionConfig deve seguir este padrão.

## Technical Stack

### Current Dependencies
```json
{
  "dependencies": {
    "chalk": "^5.6.2",
    "commander": "^14.0.2",
    "fs-extra": "^11.3.3",
    "fuse.js": "^7.1.0",
    "inquirer": "^13.2.0",
    "ora": "^9.0.0",
    "simple-git": "^3.30.0",
    "zod": "^4.3.5"
  }
}
```

### Dependencies to Add
```json
{
  "@anthropic-ai/sdk": "^0.27.0",
  "tiktoken": "^1.0.16"
}
```

**Nota:** `@anthropic-ai/sdk` NÃO está instalado atualmente. PRD menciona como instalado mas package.json não inclui.

### Build & Test Tools
- TypeScript 5.3.3
- Jest 30.2.0
- Biome 2.3.11 (lint + format)
- Node.js >= 18.0.0

## Files to Create

### Core Components
- [ ] `src/utils/token-counter.ts` - Token counting com API + tiktoken fallback
- [ ] `src/utils/context-compactor.ts` - Compactação hierárquica (raw → compact → summarize → handoff)
- [ ] `src/utils/memory-pruner.ts` - Arquivamento de conteúdo antigo (30+ dias)

### Types
- [ ] `src/types/compaction.ts` - Interfaces para CompactionLevel, CompactionResult, TokenCountResult, ContextStatus, HandoffDocument expandido, CompactionConfig

### Templates
- [ ] `templates/handoff-document.txt` - Template expandido com seções CURRENT/DONE/IN_PROGRESS/NEXT/FILES/ISSUES (já existe mas precisa expandir)

### Hooks
- [ ] `.claude/hooks/pre-overflow.sh` - Hook para checkpoint automático antes de overflow

### Tests
- [ ] `tests/utils/token-counter.test.ts`
- [ ] `tests/utils/context-compactor.test.ts`
- [ ] `tests/utils/memory-pruner.test.ts`

## Files to Modify

### State Management
- [ ] `src/utils/state-manager.ts`
  - Adicionar monitoramento de tokens
  - Método `getContextStatus()` para retornar uso atual
  - Integrar com ContextCompactor

### Feature Command
- [ ] `src/commands/feature.ts:3503-3564` (status method)
  - Adicionar flag `--tokens` para exibir uso de tokens
  - Adicionar subcomando `compact` para compactação manual

### Types
- [ ] `src/types/session.ts:25-32`
  - Expandir `CheckpointReason` com `'context_overflow'`
  - Expandir `HandoffDocument` com campos adicionais

### Config
- [ ] `src/providers/types.ts` (AdkConfig)
  - Adicionar `compaction?: CompactionConfig`

### CLI
- [ ] `src/cli.ts`
  - Adicionar comando `adk context status`
  - Adicionar comando `adk context prune`

## Dependencies

### External
| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@anthropic-ai/sdk` | ^0.27.0 | Token counting via API | **INSTALAR** |
| `tiktoken` | ^1.0.16 | Offline fallback counting | **INSTALAR** |
| `crypto` | builtin | Hash para cache | Disponível |

### Internal
| Module | Purpose |
|--------|---------|
| `StateManager` | Base para integração de monitoramento |
| `SnapshotManager` | Backup antes de compactação |
| `executeClaudeCommand` | Summarization via Claude |
| `loadConfig`/`saveConfig` | Configuração persistente |
| `getMainRepoPath` | Localização de arquivos |

## Risks

### R1: Anthropic API Rate Limit
**Probabilidade:** Média | **Impacto:** Médio

**Descrição:** Chamadas frequentes a `messages.countTokens` podem atingir rate limit

**Mitigação:**
- Cache agressivo com TTL de 1h (hash MD5 do conteúdo como chave)
- Fallback funcional para tiktoken
- Batch counting quando possível

### R2: tiktoken Imprecisão
**Probabilidade:** Baixa | **Impacto:** Médio

**Descrição:** tiktoken usa tokenizer de GPT, não Claude. Precisão ~88%

**Mitigação:**
- Fator de ajuste 0.92 (validado empiricamente)
- Validação periódica contra API
- Reportar `precision` para transparência

### R3: Compactação Remove Info Importante
**Probabilidade:** Média | **Impacto:** Alto

**Descrição:** Compactação automática pode remover contexto crítico

**Mitigação:**
- Backup automático antes de qualquer compactação
- Whitelist de padrões críticos (ADRs, decisões, errors)
- Rollback disponível por 24h
- `preservePatterns` configurável

### R4: Summarization Muito Agressiva
**Probabilidade:** Média | **Impacto:** Alto

**Descrição:** Summarization (lossy) pode perder informações essenciais

**Mitigação:**
- Templates conservadores para summarization
- Preservar: decisões, arquivos modificados, próximos passos
- Indicação clara de perda de informação
- Revisão humana sugerida antes de handoff

### R5: Memory Pruning Arquiva Conteúdo Relevante
**Probabilidade:** Baixa | **Impacto:** Médio

**Descrição:** Conteúdo > 30 dias pode ainda ser relevante

**Mitigação:**
- Threshold configurável (`archiveAfterDays`)
- Recall via MCP Memory mantém acesso
- Log de arquivamento para auditoria

### R6: Breaking Change no Handoff Document
**Probabilidade:** Baixa | **Impacto:** Baixo

**Descrição:** Formato expandido de handoff pode quebrar parsing existente

**Mitigação:**
- `parseHandoffDocument()` em `state-manager.ts:520-588` é tolerante
- Manter backward compatibility com formato atual
- Novas seções são opcionais

## Patterns to Follow

### 1. Atomic File Operations
```typescript
const tempPath = path.join(os.tmpdir(), `file-${Date.now()}.json`)
await fs.writeJSON(tempPath, data, { spaces: 2 })
await fs.move(tempPath, destPath, { overwrite: true })
```

### 2. Error Handling com Spinner
```typescript
const spinner = ora('Doing something...').start()
try {
  await operation()
  spinner.succeed('Done')
} catch (error) {
  spinner.fail('Failed')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 3. Test Environment Isolation
```typescript
beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
  process.env.TEST_FEATURE_PATH = tempDir
})

afterEach(async () => {
  await fs.remove(tempDir)
  delete process.env.TEST_FEATURE_PATH
})
```

### 4. Config Merging Pattern
```typescript
function mergeWithDefaults(config: Partial<Config>): Config {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    nested: {
      ...DEFAULT_CONFIG.nested,
      ...config.nested,
    },
  }
}
```

### 5. Class Export Pattern
```typescript
export class TokenCounter {
  // implementation
}

export const tokenCounter = new TokenCounter()
```

## Anti-Patterns to Avoid

### 1. Direct Path Concatenation
```typescript
const bad = '.claude/plans/features/' + name
const good = path.join('.claude', 'plans', 'features', name)
```

### 2. Synchronous File Operations
```typescript
const bad = fs.readFileSync(path)
const good = await fs.readFile(path, 'utf-8')
```

### 3. Non-Atomic Writes
```typescript
const bad = await fs.writeJSON(path, data)
const good = await atomicWrite(path, data)
```

### 4. Hardcoded Thresholds
```typescript
const bad = if (tokens > 80000)
const good = if (tokens > config.thresholds.emergency * config.maxTokens)
```

### 5. Swallowed Errors
```typescript
const bad = catch {}
const good = catch (error) { logger.debug('Optional operation failed:', error) }
```

## Performance Considerations

### Token Counting
| Operation | Target | Strategy |
|-----------|--------|----------|
| API counting | < 500ms | Async, non-blocking |
| Offline counting | < 50ms | tiktoken is fast |
| Cache lookup | < 5ms | In-memory Map |
| Hash computation | < 1ms | MD5 is sufficient |

### Compaction
| Operation | Target | Strategy |
|-----------|--------|----------|
| Tool output removal | < 200ms | Regex-based, streaming |
| Deduplication | < 500ms | Set-based, single pass |
| Full compaction | < 1s | Incremental processing |
| Summarization | < 3s | Claude API call |

### Memory
- Cache máximo: 1000 entries (LRU eviction)
- Cache TTL: 1 hora
- Backup retention: 10 snapshots por feature

## Security Considerations

### API Key Management
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY not set')
}
```

### Cache Security
- Cache em `.adk/token-cache.json` (local, não commitado)
- Hash MD5 do conteúdo como chave (não o conteúdo)
- TTL evita acúmulo infinito

### Logging
- NUNCA logar conteúdo de arquivos
- NUNCA logar API keys ou tokens
- Logar apenas métricas (token count, percentage, source)

### Sensitive Content
- Não compactar arquivos com patterns: `.env`, `credentials`, `secret`
- Preservar em handoff sem expor valores

## Integration Points

### Hook Integration
```
hooks.json location: .claude/settings.local.json
Event: Stop (session end)
Action: Create checkpoint if context > 70%
```

### StateManager Integration
```typescript
class StateManager {
  private compactor = new ContextCompactor()

  async beforeToolUse(feature: string): Promise<void> {
    const status = await this.compactor.getContextStatus(feature)
    if (status.level !== 'raw') {
      await this.handleContextWarning(feature, status)
    }
  }
}
```

### CLI Integration
```bash
adk feature status auth --tokens
adk feature compact auth [--dry-run] [--level summarize] [--revert]
adk context status
adk context prune [--dry-run]
```

## Test Strategy

### Unit Tests
| Component | Test Cases |
|-----------|------------|
| TokenCounter | API success, API failure, cache hit, cache miss, offline fallback |
| ContextCompactor | Each level, threshold transitions, preserve patterns |
| MemoryPruner | Age calculation, archive, restore from MCP |

### Integration Tests
| Scenario | Components |
|----------|------------|
| Full compaction flow | TokenCounter + ContextCompactor + SnapshotManager |
| Handoff generation | StateManager + ContextCompactor |
| Config persistence | CompactionConfig + loadConfig/saveConfig |

### E2E Tests
| Scenario | Validation |
|----------|------------|
| Long session simulation | Context grows, compaction triggers, handoff generated |
| Recovery from checkpoint | Restore state, continue work |

## Implementation Order

1. **Types first:** `src/types/compaction.ts`
2. **Token Counter:** Core component, standalone testable
3. **Context Compactor:** Depends on TokenCounter
4. **Memory Pruner:** Independent, can parallel with Compactor
5. **StateManager integration:** Depends on Compactor
6. **Feature command updates:** Depends on all above
7. **Hooks:** After core is stable
8. **CLI commands:** Final integration

## Open Questions

1. **Max context size:** Claude's context window varies by model. Should we detect model or use conservative 80k default?
   - **Recommendation:** Use 80k default, configurable via `maxTokens` in config

2. **Handoff destination:** Should handoff go to clipboard, file, or both?
   - **Recommendation:** File (claude-progress.txt) + terminal output with copy hint

3. **MCP Memory integration depth:** Full integration with semantic search or simple file archive?
   - **Recommendation:** Start with file archive, MCP integration as enhancement

---

*Research completed: 2026-01-22*
*Reviewer: adk-v2-fase3 research phase*
