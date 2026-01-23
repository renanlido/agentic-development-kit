# PRD: adk-v2-fase3 - Context Compactor & Token Management

**Data:** 2026-01-22
**Status:** Draft
**Autor:** Auto-generated
**Versão:** 1.0

---

## 1. Problema

### 1.1 Contexto

O ADK atualmente não possui capacidade de **gerenciar o contexto de forma inteligente** durante sessões longas. Quando o context window se aproxima do limite, não há mecanismo para prevenir overflow ou compactar informações de forma reversível.

### 1.2 Problemas Específicos

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROBLEMAS SEM CONTEXT COMPACTION                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CONTEXT OVERFLOW:                                                   │
│     └─ Sem prevenção de overflow                                        │
│     └─ Não há estimativa precisa de tokens consumidos                   │
│     └─ Agente para abruptamente quando atinge limite                    │
│                                                                          │
│  2. TOKEN COUNTING IMPRECISO:                                           │
│     └─ Estimativa atual: Math.ceil(text.length / 4)                     │
│     └─ Precisão de apenas ~80%                                          │
│     └─ Não considera tokenização real do Claude                         │
│                                                                          │
│  3. COMPACTAÇÃO INEXISTENTE:                                            │
│     └─ Não remove tool outputs redundantes                              │
│     └─ Não deduplica conteúdo repetido                                  │
│     └─ Pula direto para summarization (lossy)                           │
│                                                                          │
│  4. HANDOFF INADEQUADO:                                                 │
│     └─ Não gera summaries automaticamente                               │
│     └─ Não preserva informações críticas durante compactação            │
│     └─ Sem hierarquia de prioridade de conteúdo                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Impacto no Usuário

- **Agentes long-running falham** inesperadamente ao atingir limite de contexto
- **Trabalho é perdido** quando context overflow ocorre
- **Estimativas de tokens imprecisas** levam a planejamento inadequado
- **Summarization prematura** perde informações importantes (lossy)
- **Memory fading**: informações relevantes se perdem no "ruído" de contexto grande

### 1.4 Insight da Anthropic: Memory Fading Problem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MEMORY FADING PROBLEM                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SINTOMA: "As the CLAUDE.md files grow larger and more monolithic,     │
│           the model's ability to pinpoint the most relevant piece of   │
│           information within the massive block of context diminishes.  │
│           The signal gets lost in the noise."                          │
│                                                                          │
│  CAUSA: Cada token adicionado ao context compete por atenção do LLM    │
│                                                                          │
│  IMPACTO NO ADK:                                                        │
│  ├─ project-context.md deve ter MAX 500 linhas                         │
│  ├─ Context loading deve ser dinâmico                                  │
│  └─ Evitar carregar tudo em SessionStart                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Solução Proposta

### 2.1 Visão Geral

Implementar um **Sistema de Compactação de Contexto** que:
1. **Estima tokens com precisão** via Anthropic API (95%+)
2. **Previne overflow** com alertas e compactação proativa
3. **Segue hierarquia Anthropic** de compactação: Raw → Compact → Summarize
4. **Gera handoff documents** automaticamente quando necessário

### 2.2 Hierarquia de Compactação (Padrão Anthropic)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              HIERARQUIA DE COMPACTAÇÃO (ANTHROPIC)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. RAW CONTEXT (preferido - 0-70% do limite)                           │
│     └─ Manter contexto original sempre que possível                     │
│     └─ Zero perda de informação                                         │
│                                                                          │
│  2. COMPACTION (reversível - 70-85% do limite)                          │
│     └─ Remover tool outputs redundantes                                 │
│     └─ Deduplicar conteúdo repetido                                     │
│     └─ Comprimir file listings verbose                                  │
│     └─ PODE ser revertido se necessário                                 │
│                                                                          │
│  3. SUMMARIZATION (lossy - 85-95% do limite)                            │
│     └─ Resumir apenas quando realmente necessário                       │
│     └─ Preservar decisões críticas                                      │
│     └─ Manter referências a arquivos modificados                        │
│     └─ INFORMAÇÃO PERDIDA - último recurso                              │
│                                                                          │
│  4. CHECKPOINT + NEW SESSION (>95% do limite)                           │
│     └─ Criar handoff document completo                                  │
│     └─ Forçar nova sessão com contexto resumido                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Arquitetura do ContextCompactor

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA CONTEXT COMPACTOR                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ContextCompactor (NOVO)                                                │
│  ├─ estimateTokens()          → Anthropic API + cache + fallback        │
│  ├─ shouldCompact()           → Verifica thresholds (70%, 85%, 95%)     │
│  ├─ getCompactionLevel()      → Retorna: raw | compact | summarize      │
│  ├─ compact()                 → Executa compactação reversível          │
│  ├─ summarize()               → Executa summarization (lossy)           │
│  ├─ createHandoffDocument()   → Gera handoff para nova sessão           │
│  └─ pruneOldContent()         → Remove conteúdo antigo (30+ dias)       │
│                                                                          │
│  TokenCounter (NOVO - Componente Auxiliar)                              │
│  ├─ countViaAPI()             → Anthropic messages.countTokens          │
│  ├─ countOffline()            → Tiktoken como fallback                  │
│  ├─ getCached()               → Cache de contagens (1h TTL)             │
│  └─ invalidateCache()         → Limpa cache quando necessário           │
│                                                                          │
│  Integração com StateManager                                            │
│  ├─ beforeToolUse()           → Verifica tokens antes de operação       │
│  ├─ afterToolUse()            → Atualiza contagem após operação         │
│  └─ onContextWarning()        → Trigger compactação preventiva          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Token Counting Correto (Anthropic API)

```typescript
interface TokenCountResult {
  count: number
  source: 'api' | 'cache' | 'offline'
  precision: number
  timestamp: Date
}

class TokenCounter {
  private cache = new Map<string, { count: number; timestamp: number }>()
  private readonly CACHE_TTL = 3600000

  async count(text: string): Promise<TokenCountResult> {
    const hash = createHash('md5').update(text).digest('hex')
    const cached = this.cache.get(hash)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return { count: cached.count, source: 'cache', precision: 0.95, timestamp: new Date(cached.timestamp) }
    }

    try {
      const result = await anthropic.messages.countTokens({
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: text }]
      })

      this.cache.set(hash, { count: result.input_tokens, timestamp: Date.now() })
      return { count: result.input_tokens, source: 'api', precision: 1.0, timestamp: new Date() }
    } catch {
      return this.countOffline(text)
    }
  }

  private countOffline(text: string): TokenCountResult {
    const enc = encoding_for_model('text-davinci-003')
    const tokens = enc.encode(text)
    enc.free()

    return {
      count: Math.ceil(tokens.length * 0.92),
      source: 'offline',
      precision: 0.88,
      timestamp: new Date()
    }
  }
}
```

---

## 3. Requisitos Funcionais

### 3.1 Token Counting

- **RF01:** O sistema DEVE estimar tokens via Anthropic API com precisão >= 95%
- **RF02:** O sistema DEVE ter fallback offline usando tiktoken quando API indisponível
- **RF03:** O sistema DEVE cachear contagens por 1 hora para evitar chamadas repetidas
- **RF04:** O sistema DEVE invalidar cache quando conteúdo muda
- **RF05:** O sistema DEVE reportar fonte da contagem (api, cache, offline) e precisão

### 3.2 Context Monitoring

- **RF06:** O sistema DEVE monitorar uso de tokens em tempo real durante sessões
- **RF07:** O sistema DEVE alertar quando atingir 70% do limite (warning)
- **RF08:** O sistema DEVE alertar quando atingir 85% do limite (critical)
- **RF09:** O sistema DEVE forçar ação quando atingir 95% do limite (emergency)
- **RF10:** O sistema DEVE logar métricas de uso de tokens para análise

### 3.3 Compactação Reversível

- **RF11:** O sistema DEVE remover tool outputs redundantes (file listings duplicados)
- **RF12:** O sistema DEVE deduplicar conteúdo repetido no contexto
- **RF13:** O sistema DEVE comprimir verbose outputs (git diff, test results)
- **RF14:** O sistema DEVE manter registro de o que foi compactado para possível reversão
- **RF15:** O sistema DEVE preservar decisões críticas e referências a arquivos

### 3.4 Summarization (Lossy)

- **RF16:** O sistema DEVE summarizar apenas quando compactação não for suficiente
- **RF17:** O sistema DEVE preservar: decisões tomadas, arquivos modificados, próximos passos
- **RF18:** O sistema DEVE indicar claramente que informação foi perdida
- **RF19:** O sistema DEVE gerar summary conciso (< 500 tokens)

### 3.5 Handoff Document

- **RF20:** O sistema DEVE gerar handoff document quando atingir 95% do limite
- **RF21:** O handoff DEVE seguir formato plain-text (padrão Anthropic)
- **RF22:** O handoff DEVE incluir: CURRENT, DONE, IN_PROGRESS, NEXT, FILES, ISSUES
- **RF23:** O sistema DEVE criar checkpoint automático antes de handoff
- **RF24:** O sistema DEVE sugerir comando para nova sessão com contexto resumido

### 3.6 Memory Pruning

- **RF25:** O sistema DEVE arquivar conteúdo com mais de 30 dias
- **RF26:** O sistema DEVE limitar project-context.md a 500 linhas
- **RF27:** O sistema DEVE manter registro de conteúdo arquivado para recall via MCP Memory

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01:** Token counting via API DEVE completar em < 500ms
- **RNF02:** Token counting offline DEVE completar em < 50ms
- **RNF03:** Compactação DEVE completar em < 1s para contexto de até 100k tokens
- **RNF04:** Summarization DEVE completar em < 3s
- **RNF05:** Cache lookup DEVE completar em < 5ms

### 4.2 Precisão

- **RNF06:** Token counting via API DEVE ter precisão >= 95%
- **RNF07:** Token counting offline DEVE ter precisão >= 85%
- **RNF08:** Thresholds DEVEM ser configuráveis (default: 70%, 85%, 95%)

### 4.3 Confiabilidade

- **RNF09:** Sistema DEVE funcionar mesmo se Anthropic API estiver indisponível
- **RNF10:** Sistema DEVE preservar informações críticas mesmo em summarization
- **RNF11:** Sistema DEVE criar backup antes de qualquer compactação
- **RNF12:** Sistema DEVE permitir rollback de compactação em até 24h

### 4.4 Usabilidade

- **RNF13:** Alertas de context DEVEM ser claros e acionáveis
- **RNF14:** Handoff documents DEVEM ser legíveis por humanos
- **RNF15:** Sistema DEVE indicar quanto espaço foi liberado após compactação

### 4.5 Segurança

- **RNF16:** API key da Anthropic DEVE ser lida de variável de ambiente
- **RNF17:** Cache DEVE estar em diretório local, não exposto
- **RNF18:** Conteúdo sensível (secrets) NUNCA deve ser logado

### 4.6 Testabilidade

- **RNF19:** Cobertura de testes >= 80% para todos os novos módulos
- **RNF20:** Testes DEVEM incluir cenários de fallback e recovery
- **RNF21:** Testes DEVEM validar precisão de token counting

---

## 5. User Stories

### US01: Prevenção de Context Overflow
**Como** desenvolvedor usando agentes long-running
**Quero** ser alertado antes de atingir o limite de contexto
**Para** tomar ação preventiva e não perder trabalho

**Critérios de Aceitação:**
- [ ] Alerta visual aparece quando atingir 70% (warning amarelo)
- [ ] Alerta aparece quando atingir 85% (critical vermelho)
- [ ] Sistema sugere ações: compactar, criar checkpoint, nova sessão
- [ ] Estimativa de tokens restantes é exibida
- [ ] Precisão da estimativa é >= 95%

### US02: Compactação Automática Reversível
**Como** desenvolvedor
**Quero** que o sistema compacte contexto automaticamente
**Para** maximizar espaço sem perder informações importantes

**Critérios de Aceitação:**
- [ ] Tool outputs redundantes são automaticamente comprimidos
- [ ] Conteúdo duplicado é deduplicado
- [ ] Registro de compactação é mantido para possível reversão
- [ ] Compactação pode ser desfeita em até 24h
- [ ] Informações críticas (decisões, arquivos) são preservadas

### US03: Summarization Inteligente
**Como** desenvolvedor
**Quero** que summarization preserve o essencial
**Para** poder continuar trabalhando mesmo com contexto reduzido

**Critérios de Aceitação:**
- [ ] Summary inclui decisões tomadas durante a sessão
- [ ] Summary lista arquivos criados/modificados
- [ ] Summary indica próximos passos planejados
- [ ] Summary é conciso (< 500 tokens)
- [ ] Indicação clara de que informação foi perdida

### US04: Handoff Document Automático
**Como** desenvolvedor
**Quero** que handoff document seja gerado automaticamente
**Para** poder iniciar nova sessão com contexto completo

**Critérios de Aceitação:**
- [ ] Handoff é gerado quando atingir 95% do limite
- [ ] Formato plain-text conforme padrão Anthropic
- [ ] Inclui seções: CURRENT, DONE, IN_PROGRESS, NEXT, FILES, ISSUES
- [ ] Checkpoint é criado automaticamente antes do handoff
- [ ] Comando para nova sessão é sugerido

### US05: Token Counting Preciso
**Como** desenvolvedor
**Quero** saber exatamente quantos tokens estou usando
**Para** planejar adequadamente tarefas longas

**Critérios de Aceitação:**
- [ ] Contagem via Anthropic API com precisão >= 95%
- [ ] Fallback offline funciona quando API indisponível
- [ ] Cache evita chamadas repetidas
- [ ] Fonte da contagem (api/cache/offline) é exibida
- [ ] Precisão da estimativa é exibida

### US06: Memory Pruning Automático
**Como** desenvolvedor
**Quero** que conteúdo antigo seja arquivado automaticamente
**Para** evitar memory fading e manter contexto relevante

**Critérios de Aceitação:**
- [ ] Conteúdo > 30 dias é arquivado automaticamente
- [ ] project-context.md limitado a 500 linhas
- [ ] Conteúdo arquivado é indexado no MCP Memory para recall
- [ ] Pruning ocorre em background, não bloqueia operações
- [ ] Log de o que foi arquivado é mantido

---

## 6. Escopo

### 6.1 Incluído (In Scope)

**Fase 3 - Context Compactor & Token Management:**
- Classe ContextCompactor com hierarquia de compactação
- Classe TokenCounter com API + fallback + cache
- Integração com StateManager para monitoramento em tempo real
- CLI para visualizar uso de tokens
- Hook de pre-overflow para checkpoint automático
- Memory Pruner para arquivamento de conteúdo antigo
- Testes unitários e de integração

**Arquivos a criar/modificar:**

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/utils/context-compactor.ts` | Criar | Classe principal de compactação |
| `src/utils/token-counter.ts` | Criar | Contagem de tokens com API + fallback |
| `src/utils/memory-pruner.ts` | Criar | Arquivamento de conteúdo antigo |
| `src/types/compaction.ts` | Criar | Tipos para compactação |
| `src/utils/state-manager.ts` | Modificar | Integrar monitoramento de tokens |
| `src/commands/feature.ts` | Modificar | Adicionar --tokens flag |
| `.claude/hooks/pre-overflow.sh` | Criar | Hook de checkpoint antes de overflow |
| `templates/handoff-document.txt` | Criar | Template do handoff |
| `tests/utils/context-compactor.test.ts` | Criar | Testes |
| `tests/utils/token-counter.test.ts` | Criar | Testes |

### 6.2 Excluído (Out of Scope)

- **MCP Memory RAG Integration:** Já implementado na Fase 1
- **Constitution/Steering:** Será Fase 4
- **Circuit breaker e retry patterns:** Será Fase 5
- **Observabilidade com Arize Phoenix:** Será Fase 5
- **Tasks em pasta (tasks/):** Será Fase 6
- **ADK MCP Server customizado:** Roadmap futuro
- **VS Code Extension:** Roadmap futuro
- **UI visual para monitoramento:** Roadmap futuro

### 6.3 Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Token counting primário | Anthropic API | 95%+ precisão vs 80% de estimativas |
| Fallback para counting | tiktoken | Biblioteca madura, ~88% precisão para Claude |
| Cache TTL | 1 hora | Balança freshness vs performance |
| Thresholds de compactação | 70%, 85%, 95% | Baseado em recomendações Anthropic |
| Formato de handoff | Plain-text | 75% menos tokens que JSON, parse mais rápido |
| Limite project-context.md | 500 linhas | Evita memory fading |
| Arquivamento | 30 dias | Conteúdo antigo raramente relevante |

---

## 7. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Anthropic API rate limit | Média | Médio | Cache agressivo + fallback offline funcional |
| R2 | tiktoken impreciso para Claude | Baixa | Médio | Fator de ajuste 0.92 + validação periódica |
| R3 | Compactação remove info importante | Média | Alto | Whitelist de padrões críticos; backup antes de compactar |
| R4 | Summarization muito agressiva | Média | Alto | Templates conservadores; revisão humana sugerida |
| R5 | Memory pruning arquiva conteúdo relevante | Baixa | Médio | Threshold configurável; recall via MCP Memory |
| R6 | Performance degradada com contexto grande | Média | Médio | Processamento incremental; lazy evaluation |
| R7 | Cache inconsistente | Baixa | Baixo | Invalidação proativa; TTL curto |

---

## 8. Métricas de Sucesso

### 8.1 Métricas Quantitativas

| Métrica | Baseline Atual | Meta | Como Medir |
|---------|----------------|------|------------|
| Precisão token counting (API) | N/A | >= 95% | Comparar com contagem real pós-request |
| Precisão token counting (offline) | ~80% | >= 85% | Validação contra API |
| Context overflows evitados | 0% (não previne) | >= 90% | Log de sessões que atingiram checkpoint |
| Tokens economizados por compactação | N/A | >= 30% | Antes vs depois da compactação |
| Tempo de compactação | N/A | < 1s | Medição em runtime |
| Cobertura de testes | N/A | >= 80% | Jest coverage report |

### 8.2 Métricas Qualitativas

| Métrica | Como Avaliar |
|---------|--------------|
| Qualidade do handoff | Review manual: contexto suficiente para continuar? |
| Preservação de info crítica | Checklist: decisões, arquivos, próximos passos presentes? |
| Usabilidade dos alertas | Feedback: alertas são claros e acionáveis? |

### 8.3 Critérios de Aceitação da Feature

- [ ] Todos os RF implementados e testados
- [ ] Todos os RNF validados
- [ ] Todas as User Stories atendidas
- [ ] Cobertura de testes >= 80%
- [ ] Zero context overflows em testes de stress
- [ ] Handoff documents revisados e aprovados
- [ ] Documentação atualizada no CLAUDE.md
- [ ] Code review aprovado

---

## 9. Dependências

### 9.1 Dependências Técnicas

| Dependência | Status | Descrição |
|-------------|--------|-----------|
| StateManager | ✅ Implementado | Base para monitoramento |
| Session Management (Fase 2) | ✅ Implementado | Checkpoints e handoff |
| SnapshotManager | ✅ Implementado | Backup antes de compactação |
| MCP Memory (Fase 1) | ✅ Implementado | Armazenar conteúdo arquivado |
| @anthropic-ai/sdk | ✅ Instalado | API para token counting |
| tiktoken | ❌ Instalar | Fallback offline |

### 9.2 Dependências de Conhecimento

| Item | Status | Ação |
|------|--------|------|
| Anthropic token counting API | ✅ Documentado | Implementar conforme docs |
| tiktoken para Claude | ⚠️ Parcial | Validar fator de ajuste |
| Padrão de handoff Anthropic | ✅ Documentado | Seguir template |
| Memory fading problem | ✅ Entendido | Implementar limites |

### 9.3 Bloqueadores

Nenhum bloqueador crítico identificado. A Fase 2 (Session Management) deve estar completa para integração com checkpoints.

---

## 10. Timeline (Sugestão)

### Fase 3.1: Token Counter (2-3 dias)
- Implementar `src/utils/token-counter.ts`
- Integração com Anthropic API
- Implementar fallback tiktoken
- Sistema de cache com TTL
- Testes unitários

### Fase 3.2: Context Compactor Core (3-4 dias)
- Implementar `src/utils/context-compactor.ts`
- Lógica de compactação reversível
- Deduplicação de conteúdo
- Compressão de tool outputs
- Registro de compactação para rollback

### Fase 3.3: Summarization & Handoff (2-3 dias)
- Implementar summarization inteligente
- Template de handoff document
- Geração automática de handoff
- Integração com Session Management (Fase 2)

### Fase 3.4: Memory Pruner (1-2 dias)
- Implementar `src/utils/memory-pruner.ts`
- Arquivamento de conteúdo antigo
- Limite de linhas para project-context.md
- Integração com MCP Memory

### Fase 3.5: Integration & Hooks (2-3 dias)
- Integrar com StateManager
- Criar hook `pre-overflow.sh`
- CLI flag `--tokens` para feature status
- Monitoramento em tempo real

### Fase 3.6: Testing & Documentation (2-3 dias)
- Testes de integração
- Testes de stress (contexto grande)
- Atualizar CLAUDE.md
- Documentar comandos e configurações

**Total Estimado:** 12-18 dias (2.5-3.5 semanas)

---

## 11. Especificações Técnicas

### 11.1 Tipos TypeScript

```typescript
interface CompactionLevel {
  level: 'raw' | 'compact' | 'summarize' | 'handoff'
  threshold: number
  description: string
}

interface CompactionResult {
  originalTokens: number
  compactedTokens: number
  savedTokens: number
  savedPercentage: number
  level: CompactionLevel['level']
  itemsCompacted: CompactedItem[]
  reversible: boolean
}

interface CompactedItem {
  type: 'tool_output' | 'duplicate' | 'verbose' | 'old_content'
  originalSize: number
  compactedSize: number
  canRevert: boolean
  revertPath?: string
}

interface TokenCountResult {
  count: number
  source: 'api' | 'cache' | 'offline'
  precision: number
  timestamp: Date
  cached: boolean
}

interface ContextStatus {
  currentTokens: number
  maxTokens: number
  usagePercentage: number
  level: CompactionLevel['level']
  recommendation: string
  canContinue: boolean
}

interface HandoffDocument {
  feature: string
  createdAt: string
  current: string
  done: string[]
  inProgress: string[]
  next: string[]
  files: string[]
  issues: string[]
  sessionId: string
  checkpointId: string
}
```

### 11.2 Configuração

```typescript
interface CompactionConfig {
  thresholds: {
    warning: number      // default: 0.70
    critical: number     // default: 0.85
    emergency: number    // default: 0.95
  }
  tokenCounter: {
    apiEnabled: boolean  // default: true
    cacheEnabled: boolean // default: true
    cacheTTL: number     // default: 3600000 (1h)
  }
  pruning: {
    archiveAfterDays: number    // default: 30
    maxProjectContextLines: number // default: 500
    enabled: boolean            // default: true
  }
  compaction: {
    preservePatterns: string[]  // patterns to never compact
    autoCompact: boolean        // default: true
    backupBeforeCompact: boolean // default: true
  }
}
```

### 11.3 Estrutura de Arquivos

```
.claude/plans/features/<feature-name>/
├── claude-progress.txt         # Handoff document (Fase 2)
├── .compaction/                # NOVO: Dados de compactação
│   ├── history.json           # Histórico de compactações
│   ├── backup/                # Backups para rollback
│   │   └── 2026-01-22-103000.json
│   └── archived/              # Conteúdo arquivado
│       └── old-context-2025-12.md
└── ...

.adk/
├── token-cache.json           # NOVO: Cache de contagem
└── compaction-config.json     # NOVO: Configuração
```

### 11.4 Comandos CLI

```bash
adk feature status <name> --tokens
adk feature compact <name>
adk feature compact <name> --dry-run
adk feature compact <name> --level summarize
adk feature compact <name> --revert
adk context status
adk context prune
adk context prune --dry-run
```

### 11.5 Output Esperado

**`adk feature status auth --tokens`:**
```
Feature: auth
Status: implementing (65%)

Token Usage:
├─ Current: 45,230 tokens (56.5%)
├─ Max: 80,000 tokens
├─ Level: RAW (safe)
├─ Source: api (precision: 100%)
└─ Recommendation: Continue normally

Recent Activity:
├─ Last compaction: None
├─ Last pruning: 2026-01-20
└─ Archived items: 3 files

Use: adk feature compact auth --dry-run to preview compaction
```

**`adk feature compact auth --dry-run`:**
```
Compaction Preview for: auth

Current: 45,230 tokens
After compaction: 31,661 tokens (estimated)
Savings: 13,569 tokens (30%)

Items to compact:
├─ Tool outputs (12): 8,234 tokens → 2,411 tokens
├─ Duplicates (3): 2,156 tokens → 0 tokens
├─ Verbose logs (5): 3,179 tokens → 954 tokens
└─ Total: 13,569 tokens saved

This compaction is REVERSIBLE for 24 hours.

Run: adk feature compact auth to apply
```

---

## 12. Referências

- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: messages.countTokens API](https://docs.anthropic.com/en/api/messages-count-tokens)
- [ADK Unified Analysis v4.3 - Seção 8.3](./../../analysis/unified-analysis.md#83-contextcompactor---revisao-critica)
- [Memory Fading Problem - Seção 9.12.5](./../../analysis/unified-analysis.md#9125-memory-fading-problema-identificado-pela-anthropic)
- [tiktoken](https://github.com/openai/tiktoken)

---

## 13. Changelog

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-01-22 | 1.0 | Criação inicial do PRD |

---

**Aprovações:**

| Papel | Nome | Data | Status |
|-------|------|------|--------|
| Product Owner | [A DEFINIR] | - | Pendente |
| Tech Lead | [A DEFINIR] | - | Pendente |
| Arquiteto | [A DEFINIR] | - | Pendente |
