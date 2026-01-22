# PRD: ADK v2 - Técnicas Avançadas para Agentes de Longa Duração

**Data:** 2026-01-21
**Status:** Draft
**Autor:** Auto-generated
**Versão:** 1.0

---

## 1. Problema

### 1.1 Problema Central

O ADK atualmente utiliza busca por keywords literais para recuperação de contexto, o que resulta em contexto relevante não sendo recuperado. Por exemplo:

- "auth" **NÃO** encontra "autenticacao"
- "user" **NÃO** encontra "usuario"
- Keywords em inglês apenas, sem suporte multilingual

**Código problemático atual** (`src/utils/memory-search.ts:17-29`):
```typescript
function simpleSearch(text: string, query: string): number {
  const words = lowerQuery.split(/\s+/)
  for (const word of words) {
    if (lowerText.includes(word)) matches++  // LITERAL MATCH ONLY
  }
}
```

### 1.2 Gaps Identificados

Apesar do ADK estar 94% implementado (66/70 features), faltam 4 componentes críticos para suportar agentes de longa duração:

| Componente | Estado | Impacto |
|------------|--------|---------|
| MCP Memory RAG | 0% | Busca semântica impossível |
| SessionManager | 0% | Agentes não retomam de checkpoints |
| ContextCompactor | 0% | Context overflow perde trabalho |
| Constitution/Steering | 0% | Princípios não estruturados |

### 1.3 Problemas Secundários

1. **Técnicas ADK não aplicadas autonomamente**: Quando Claude Code executa diretamente (sem CLI), técnicas como TDD, state sync, e constraints não são enforced
2. **Ausência de checkpoints via Git**: Commits não são usados como checkpoints naturais para recovery
3. **Falta de resiliência**: Sem retry com backoff, circuit breaker, ou fallback para operações de agentes
4. **Memory fading**: CLAUDE.md grande demais faz o modelo perder informação relevante no "ruído"
5. **Ausência de observabilidade**: Sem métricas de latência, tokens, qualidade, ou progresso

---

## 2. Solução Proposta

### 2.1 Visão Geral

Implementar as 4 capacidades faltantes do ADK para habilitar agentes de longa duração com:

1. **MCP Memory RAG**: Busca semântica via embeddings que indexa sem compactar
2. **SessionManager**: Extensão do StateManager para checkpoints e resume de sessões
3. **ContextCompactor**: Prevenção de overflow com summarization inteligente e handoff documents
4. **Constitution/Steering**: Contexto estruturado persistente seguindo GitHub Spec Kit pattern

### 2.2 Arquitetura Dual-Mode

A solução opera em dois modos complementares:

```
┌─────────────────────────────────────────────────────────────┐
│  MODO CLI (explícito)     │  MODO AUTONOMO (Claude Code)   │
├─────────────────────────────────────────────────────────────┤
│  adk feature implement    │  "implementa autenticacao"     │
│  Prompts estruturados     │  Hooks + CLAUDE.md + MCP       │
│  Validação via CLI        │  Validação automática          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Princípios Fundamentais

1. **NUNCA compactar → SEMPRE indexar → RECALL focado** (conta-gotas)
2. **Reutilizar antes de criar** (StateManager > SessionManager)
3. **Plain text > JSON** para handoffs e documentos de progresso
4. **Context loading dinâmico** baseado em keywords (Powers pattern)
5. **Git commits como checkpoints** para recovery de long-running agents

---

## 3. Requisitos Funcionais

### 3.1 MCP Memory RAG (P0 - Bloqueador)

- **RF01**: Integrar MCP server de busca semântica (`@yikizi/mcp-local-rag` ou `mcp-memory-service`)
- **RF02**: Criar wrapper `MemoryMCP` com métodos `index(content, metadata)` e `recall(query, options)`
- **RF03**: Implementar comando `adk memory index --file <path>` para indexação manual
- **RF04**: Implementar comando `adk memory recall <query>` para busca semântica
- **RF05**: Criar hook post-write para indexação automática de arquivos `.claude/*`
- **RF06**: Configuração via `.adk/memory.json` com embedding model, chunk size, storage path
- **RF07**: Suportar busca híbrida (semantic + keyword) com reranking

### 3.2 SessionManager (P1)

- **RF08**: Estender `StateManager` com método `resumeFromSnapshot(feature, snapshotId?)`
- **RF09**: Implementar método `createContextSummary(feature)` para handoff documents
- **RF10**: Adicionar flag `--resume` ao comando `adk agent run` para retomar última sessão
- **RF11**: Implementar comando `adk agent sessions <feature>` para listar sessões
- **RF12**: Criar formato `claude-progress.txt` (plain text) para tracking de progresso
- **RF13**: Registrar checkpoints com reasons: manual, step_complete, context_warning, error_recovery, task_complete

### 3.3 ContextCompactor (P1)

- **RF14**: Implementar `estimateTokens(text)` usando Anthropic API com fallback offline (tiktoken)
- **RF15**: Criar método `shouldCompact(currentTokens, maxTokens)` com threshold de 80%
- **RF16**: Implementar hierarquia de compactação: raw context → compaction (reversível) → summarization (lossy)
- **RF17**: Gerar handoff documents no formato plain text com seções: Summary, Current State, Pending Steps, Key Decisions, Files Modified, Next Actions
- **RF18**: Integrar com hook `Stop` para checkpoint automático no fim de sessão
- **RF19**: Arquivar mensagens antigas via MCP Memory ao invés de deletar

### 3.4 Constitution/Steering (P2)

- **RF20**: Criar template `.claude/constitution.md` (arquivo único com princípios imutáveis)
- **RF21**: Manter `.claude/rules/*.md` existentes para regras modulares
- **RF22**: Criar diretório `.claude/context/` para contexto mutável (product, architecture, tech-stack)
- **RF23**: Implementar comando `adk validate` para validação contra constitution
- **RF24**: Adicionar flag `--fix` para sugerir correções automáticas

### 3.5 Hooks de Enforcement Automático

- **RF25**: Criar hook `SessionStart` (`session-bootstrap.sh`) para injeção de contexto no início de sessão
- **RF26**: Expandir hook `UserPromptSubmit` (`inject-focus.sh`) com constraints e técnicas ADK
- **RF27**: Criar hook `PreToolUse` (`validate-tdd.sh`) para validação de TDD antes de escrita
- **RF28**: Criar hook `PostToolUse` (`sync-state.sh`) para sincronização de estado após escrita
- **RF29**: Criar hook `Stop` (`session-checkpoint.sh`) para checkpoint automático no fim de sessão
- **RF30**: Criar hook `PostToolUse` (`check-task-complete.sh`) para detectar task completion

### 3.6 Git Commits como Checkpoints

- **RF31**: Criar hook `task-complete.sh` que faz commit atômico após cada task
- **RF32**: Atualizar `claude-progress.txt` antes de cada commit
- **RF33**: Incluir commit hash no histórico de transições (history.json)
- **RF34**: Implementar método `completeTask(feature, taskName)` no StateManager
- **RF35**: Adicionar flag `--commit` ao comando `adk feature implement` para commits automáticos

### 3.7 Resiliência

- **RF36**: Implementar função `withRetry(fn, options)` com exponential backoff e jitter
- **RF37**: Criar classe `AgentCircuitBreaker` com estados closed/open/half-open
- **RF38**: Implementar `AgentFallbackChain` para fallback hierárquico entre modelos
- **RF39**: Criar classe `MemoryPruner` para evitar memory fading (max 500 linhas em project-context.md)

### 3.8 Observabilidade

- **RF40**: Criar classe `ADKTracer` com integração OpenTelemetry
- **RF41**: Implementar método `recordTokenUsage(input, output)` para métricas de tokens
- **RF42**: Integrar com Arize Phoenix para visualização local de traces
- **RF43**: Criar comando `adk diagnostics` para health check do sistema

### 3.9 MCP Powers Pattern (Context Dinâmico)

- **RF44**: Criar diretório `.claude/powers/` com arquivos JSON de configuração
- **RF45**: Implementar `ContextLoader` que ativa contexto baseado em keywords do prompt
- **RF46**: Cada power define: name, triggers, steering file, tools, context files

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01**: Busca semântica deve retornar em < 100ms (p95)
- **RNF02**: Token counting deve ter 95%+ de precisão vs estimativa por caracteres (80%)
- **RNF03**: Context loading dinâmico deve reduzir tokens consumidos em 60-80%
- **RNF04**: Indexação assíncrona via queue para eliminar 100-500ms de latência por escrita
- **RNF05**: Sync de estado deve completar em < 500ms para features com 50 tasks

### 4.2 Segurança

- **RNF06**: API tokens armazenados apenas em `.env` (nunca em config.json)
- **RNF07**: Hooks devem usar `execFileNoThrow` para evitar command injection
- **RNF08**: Validação de input em todos os comandos CLI
- **RNF09**: Secrets nunca indexados no MCP Memory

### 4.3 Confiabilidade

- **RNF10**: Retry com max 3-5 tentativas para operações LLM
- **RNF11**: Circuit breaker com threshold de 5 falhas e timeout de 1 minuto
- **RNF12**: Snapshots criados automaticamente antes de operações destrutivas
- **RNF13**: Rollback disponível via Git para qualquer task individual

### 4.4 Usabilidade

- **RNF14**: Técnicas ADK aplicadas automaticamente em ambos os modos (CLI e autônomo)
- **RNF15**: Documentação de cada hook com exemplos de uso
- **RNF16**: Mensagens de erro claras e acionáveis
- **RNF17**: Curva de aprendizado baixa - funciona "magicamente" para novos usuários

### 4.5 Manutenibilidade

- **RNF18**: Cobertura de testes >= 80% para novos módulos
- **RNF19**: Testes unitários para todos os hooks
- **RNF20**: CI/CD workflow para validação de hooks
- **RNF21**: Código extensível para novos providers MCP

---

## 5. User Stories

### US01: Busca Semântica de Contexto
**Como** desenvolvedor usando ADK
**Quero** buscar por "auth" e encontrar documentos sobre "autenticacao"
**Para** recuperar contexto relevante independente da linguagem usada

**Critérios de Aceitação:**
- [ ] Query "auth" retorna documentos contendo "autenticacao", "authentication", "login"
- [ ] Query "user" retorna documentos contendo "usuario", "account", "profile"
- [ ] Resultados ordenados por relevância semântica (não apenas keyword match)
- [ ] Tempo de resposta < 100ms

### US02: Retomada de Sessão de Agente
**Como** desenvolvedor trabalhando em feature complexa
**Quero** retomar uma sessão de agente de onde parei
**Para** não perder progresso após context overflow ou interrupção

**Critérios de Aceitação:**
- [ ] Comando `adk agent run <name> --resume` retoma última sessão
- [ ] Sessão retomada inclui contexto de tasks completadas
- [ ] Arquivo `claude-progress.txt` mostra histórico de progresso
- [ ] Checkpoints criados automaticamente após cada task

### US03: Prevenção de Context Overflow
**Como** agente de longa duração
**Quero** que meu contexto seja compactado inteligentemente
**Para** não perder informações críticas quando o limite é atingido

**Critérios de Aceitação:**
- [ ] Alerta quando contexto atinge 80% do limite
- [ ] Compactação reversível aplicada antes de summarization
- [ ] Handoff document gerado automaticamente em plain text
- [ ] Informações arquivadas recuperáveis via MCP Memory

### US04: TDD Enforced Automaticamente
**Como** desenvolvedor
**Quero** que o ADK me lembre de escrever testes primeiro
**Para** seguir TDD mesmo quando esqueço

**Critérios de Aceitação:**
- [ ] Warning exibido ao criar arquivo em src/ sem teste correspondente
- [ ] Warning não bloqueia operação (apenas alerta)
- [ ] Teste considerado existente se arquivo *.test.* ou *.spec.* existe
- [ ] Hook funciona tanto via CLI quanto Claude Code direto

### US05: Commits como Checkpoints
**Como** desenvolvedor trabalhando em feature longa
**Quero** que cada task completada seja commitada automaticamente
**Para** ter recovery granular via Git

**Critérios de Aceitação:**
- [ ] Commit criado após cada task com mensagem descritiva
- [ ] Formato: `feat(feature): complete task-name`
- [ ] Arquivo `claude-progress.txt` atualizado antes do commit
- [ ] Rollback de task individual possível via `git revert`

### US06: Context Loading Dinâmico
**Como** desenvolvedor
**Quero** que contexto de segurança seja carregado apenas quando eu mencionar "auth" ou "security"
**Para** economizar tokens e manter foco

**Critérios de Aceitação:**
- [ ] Powers definidos em `.claude/powers/*.json`
- [ ] Cada power tem lista de triggers (keywords)
- [ ] Contexto carregado apenas quando trigger detectado
- [ ] Economia de 60-80% de tokens em workflows típicos

### US07: Observabilidade de Agentes
**Como** desenvolvedor debugando problema com agente
**Quero** ver traces de execução e métricas
**Para** entender onde agente falhou ou está lento

**Critérios de Aceitação:**
- [ ] Traces disponíveis via Arize Phoenix local
- [ ] Métricas de tokens consumidos por sessão
- [ ] Latência por tool call com p50, p95, p99
- [ ] Taxa de retry e circuit breaker state visíveis

### US08: Validação contra Constitution
**Como** desenvolvedor
**Quero** validar que meu código segue os princípios do projeto
**Para** manter consistência arquitetural

**Critérios de Aceitação:**
- [ ] Comando `adk validate` verifica código contra constitution.md
- [ ] Violações listadas com referência ao princípio violado
- [ ] Flag `--fix` sugere correções
- [ ] Integração com pre-commit hook

---

## 6. Escopo

### 6.1 Incluído

#### Fase 1: Hooks de Enforcement (Imediato)
- Hook `SessionStart` para bootstrap de contexto
- Hook `Stop` para checkpoint automático
- Expansão de CLAUDE.md com técnicas obrigatórias
- Hook de TDD validation
- Hook de state sync

#### Fase 2: MCP Memory RAG (Semanas 1-2)
- Benchmark de providers MCP
- Integração com provider escolhido
- Comandos `adk memory index` e `adk memory recall`
- Hook de indexação post-write
- Configuração via `.adk/memory.json`

#### Fase 3: Session Management (Semana 3)
- Extensão do StateManager
- Formato `claude-progress.txt`
- Flag `--resume` para agentes
- Comando `adk agent sessions`

#### Fase 4: Context Compactor (Semana 4)
- Token counting via Anthropic API
- Hierarquia de compactação
- Handoff document generator
- Integração com MCP Memory para arquivamento

#### Fase 5: Constitution/Steering (Semana 5)
- Template constitution.md
- Diretório .claude/context/
- Comando `adk validate`
- MCP Powers pattern

#### Fase 6: Resiliência e Observabilidade
- Retry com backoff e jitter
- Circuit breaker
- Integração Arize Phoenix
- Comando `adk diagnostics`

### 6.2 Excluído (Out of Scope)

- VS Code Extension
- Suporte a múltiplos LLM providers (apenas Claude)
- Interface gráfica/dashboard
- Autenticação multi-usuário
- Deploy em cloud (apenas local-first)
- Knowledge Graph completo (apenas semantic search)
- Integração com ferramentas além de ClickUp
- Event sourcing completo (apenas checkpoints)
- Bidirectional main ↔ worktree sync (Fase futura)
- ADK MCP Server customizado (Fase futura)

---

## 7. Riscos e Mitigações

| # | Risco | Impacto | Probabilidade | Mitigação |
|---|-------|---------|---------------|-----------|
| R1 | Provider MCP escolhido tem single maintainer | Alto | Média | Benchmark 2+ providers; abstrair via wrapper; ter fallback para keyword search |
| R2 | Token counting via API adiciona latência | Médio | Alta | Implementar cache com hash de conteúdo; fallback offline com tiktoken |
| R3 | Hooks bloqueiam operações do usuário | Alto | Baixa | Todos hooks usam async (`&`); timeout máximo de 2s; fallback silencioso |
| R4 | Memory fading com CLAUDE.md grande | Alto | Alta | Implementar MemoryPruner com limit de 500 linhas; Powers pattern para loading dinâmico |
| R5 | Commits automáticos poluem histórico Git | Médio | Média | Commits apenas em task completion; squash opcional no merge; convenção clara de mensagens |
| R6 | Complexidade de debugging com múltiplos hooks | Médio | Alta | Cada hook loggable com verbose; comando `adk diagnostics` para status; testes unitários |
| R7 | Incompatibilidade com versões futuras do Claude Code | Alto | Baixa | Monitorar changelog do Claude Code; abstrair hooks em camada intermediária |
| R8 | Overhead de observabilidade afeta performance | Baixo | Média | Tracing opcional (opt-in); sampling configurável; batch de métricas |

---

## 8. Métricas de Sucesso

### 8.1 Métricas de Qualidade de Busca

| Métrica | Baseline (keyword) | Target (semantic) |
|---------|-------------------|-------------------|
| Recall para queries cross-language | 20% | 80% |
| Precision dos top-5 resultados | 60% | 85% |
| Tempo de resposta p95 | N/A | < 100ms |

### 8.2 Métricas de Produtividade

| Métrica | Como Medir | Target |
|---------|------------|--------|
| Recovery time após context overflow | Tempo até retomar trabalho | < 30s (vs minutos manual) |
| Taxa de commits por feature | Commits / tasks completadas | 1:1 (cada task = 1 commit) |
| Tokens economizados por Powers | Tokens sem powers - com powers | 60-80% redução |

### 8.3 Métricas de Confiabilidade

| Métrica | Como Medir | Target |
|---------|------------|--------|
| Taxa de retry bem-sucedido | Retries que resultam em sucesso / total | > 90% |
| Uptime do circuit breaker | Tempo em estado closed / total | > 95% |
| Rollbacks necessários | Tasks revertidas / total | < 5% |

### 8.4 Métricas de Adoção

| Métrica | Como Medir | Target |
|---------|------------|--------|
| Uso de hooks | Sessões com hooks ativos / total | 100% (default) |
| Uso de --resume | Sessões retomadas / sessões interrompidas | > 80% |
| Cobertura de testes | Linhas cobertas / total (novos módulos) | >= 80% |

---

## 9. Dependências

### 9.1 Dependências Externas

| Dependência | Tipo | Criticidade | Alternativa |
|-------------|------|-------------|-------------|
| `@yikizi/mcp-local-rag` ou `mcp-memory-service` | MCP Server | P0 | Fallback para keyword search atual |
| Anthropic API (token counting) | API | P1 | tiktoken offline |
| Arize Phoenix | Observabilidade | P2 | Logs simples; integração futura |
| OpenTelemetry SDK | Instrumentação | P2 | Métricas custom |

### 9.2 Dependências Internas

| Dependência | Tipo | Status | Impacto se Indisponível |
|-------------|------|--------|-------------------------|
| StateManager | Módulo existente | ✅ Pronto | Bloqueia SessionManager |
| SnapshotManager | Módulo existente | ✅ Pronto | Bloqueia checkpoints |
| HistoryTracker | Módulo existente | ✅ Pronto | Bloqueia audit trail |
| Hook system (settings.json) | Infraestrutura | ✅ Pronto | Bloqueia enforcement automático |
| Git | Ferramenta externa | ✅ Assumido | Bloqueia commits como checkpoints |

### 9.3 Ordem de Dependências

```
MCP Memory RAG ◀── P0 BLOQUEADOR
       │
       ├──────────────────────┐
       ▼                      ▼
SessionManager           Constitution/
(estende StateManager)   Steering
       │
       ▼
ContextCompactor
(usa MCP para arquivar)
```

---

## 10. Timeline (Sugestão)

### Fase 0: Preparação e Hooks (Semana 0 - Imediata)

**Duração:** 1-2 dias
**Entregáveis:**
- `.claude/hooks/session-bootstrap.sh` (SessionStart hook)
- `.claude/hooks/session-checkpoint.sh` (Stop hook)
- `.claude/hooks/validate-tdd.sh` (TDD validation)
- `.claude/hooks/sync-state.sh` (State sync)
- Atualização de `.claude/settings.json` com novos hooks
- Expansão de CLAUDE.md com técnicas obrigatórias

### Fase 1: MCP Memory RAG (Semanas 1-2)

**Duração:** 10-14 dias
**Entregáveis:**
- Benchmark documentado de providers MCP (2-3 dias)
- `.claude/mcp.json` configurado com provider escolhido
- `src/utils/memory-mcp.ts` - wrapper do MCP
- `src/commands/memory.ts` - comandos index e recall
- `.claude/hooks/post-write-index.sh` - indexação automática
- `.adk/memory.json` - schema de configuração
- `tests/memory-mcp.test.ts` - testes

### Fase 2: Session Management (Semana 3)

**Duração:** 5-7 dias
**Entregáveis:**
- `src/types/session.ts` - tipos de sessão
- Extensão de `src/utils/state-manager.ts` com métodos resume/handoff
- `templates/claude-progress.txt` - template de progresso
- Flag `--resume` em `src/commands/agent.ts`
- Subcomando `adk agent sessions`
- `tests/session-manager.test.ts` - testes

### Fase 3: Context Compactor (Semana 4)

**Duração:** 5-7 dias
**Entregáveis:**
- `src/utils/token-counter.ts` - contagem via API + fallback
- `src/utils/context-compactor.ts` - compactação hierárquica
- Handoff document generator (método em ContextCompactor)
- Integração com hook Stop para pre-overflow checkpoint
- Integração com MCP Memory para arquivamento
- `tests/context-compactor.test.ts` - testes

### Fase 4: Constitution/Steering e Powers (Semana 5)

**Duração:** 3-5 dias
**Entregáveis:**
- `templates/constitution.md` - template de princípios
- `templates/context/*.md` - templates de contexto
- `.claude/powers/*.json` - configuração de powers
- `src/utils/context-loader.ts` - loading dinâmico
- `src/commands/validate.ts` - validação contra constitution
- Testes de integração

### Fase 5: Git Commits como Checkpoints (Semana 5)

**Duração:** 2-3 dias (paralelo com Fase 4)
**Entregáveis:**
- `.claude/hooks/task-complete.sh` - commit automático
- `.claude/hooks/check-task-complete.sh` - detecção de completion
- Método `completeTask` no StateManager
- Flag `--commit` em `adk feature implement`
- Integração com HistoryTracker

### Fase 6: Resiliência e Observabilidade (Semana 6)

**Duração:** 5-7 dias
**Entregáveis:**
- `src/utils/resilience.ts` - retry com backoff
- `src/utils/circuit-breaker.ts` - circuit breaker
- `src/utils/observability.ts` - integração OpenTelemetry
- `src/utils/memory-pruner.ts` - prevenção de memory fading
- `src/commands/diagnostics.ts` - health check
- Testes e CI/CD workflow para hooks

---

## 11. Critérios de Aceite da Feature

### 11.1 Critérios de Go-Live

- [ ] Busca semântica funcional com recall > 80% para queries cross-language
- [ ] Hooks de enforcement ativos por default em toda sessão
- [ ] SessionManager permite retomar sessões interrompidas
- [ ] ContextCompactor previne perda de contexto em overflow
- [ ] Commits automáticos por task com rollback granular
- [ ] Cobertura de testes >= 80% para todos os novos módulos
- [ ] Documentação completa em CLAUDE.md
- [ ] CI/CD passando para validação de hooks

### 11.2 Critérios de Sucesso Pós-Launch (30 dias)

- [ ] 100% das sessões usando hooks de enforcement
- [ ] Redução de 60%+ em tokens consumidos (Powers pattern)
- [ ] < 5% de rollbacks de tasks
- [ ] Tempo de recovery < 30s após context overflow
- [ ] Zero incidents críticos relacionados a memory fading

---

## 12. Apêndices

### A. Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADK ARCHITECTURE 2.0                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         USER INTERFACE                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │ CLI Commands│  │   Hooks     │  │ CLAUDE.md   │                   │   │
│  │  │ 13 commands │  │ 6 hooks     │  │ Técnicas    │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        ORCHESTRATION LAYER                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │  │ StateManager    │  │ ContextCompactor│  │ ContextLoader       │   │   │
│  │  │ + resume/handoff│  │ + token counting│  │ + Powers pattern    │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        MEMORY LAYER                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    MCP Memory Server                             │ │   │
│  │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │ │   │
│  │  │  │  SQLite-vec   │  │  Embeddings   │  │  Semantic Search  │   │ │   │
│  │  │  └───────────────┘  └───────────────┘  └───────────────────┘   │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │  ┌───────────────┐  ┌───────────────┐                                │   │
│  │  │ Constitution  │  │    Powers     │                                │   │
│  │  │ (principles)  │  │ (dynamic ctx) │                                │   │
│  │  └───────────────┘  └───────────────┘                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        RESILIENCE LAYER                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Retry     │  │  Circuit    │  │  Fallback   │  │   Tracer    │  │   │
│  │  │  + backoff  │  │   Breaker   │  │    Chain    │  │ (Phoenix)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B. Estrutura de Arquivos Proposta

```
.claude/
├── constitution.md           # Princípios imutáveis
├── active-focus.md          # Feature atual (existente)
├── settings.json            # Hooks configurados (existente)
├── context/                 # Contexto mutável (NOVO)
│   ├── product.md
│   ├── architecture.md
│   └── tech-stack.md
├── powers/                  # Powers para context dinâmico (NOVO)
│   ├── security.json
│   ├── testing.json
│   └── database.json
├── hooks/                   # Hooks de enforcement (expandir)
│   ├── session-bootstrap.sh # SessionStart (NOVO)
│   ├── session-checkpoint.sh # Stop (NOVO)
│   ├── validate-tdd.sh      # PreToolUse (NOVO)
│   ├── sync-state.sh        # PostToolUse (NOVO)
│   ├── task-complete.sh     # Após task (NOVO)
│   ├── inject-focus.sh      # Existente
│   ├── scope-check.sh       # Existente
│   ├── validate-bash.sh     # Existente
│   └── post-write.sh        # Existente
├── rules/                   # Regras modulares (existente)
│   ├── security-rules.md
│   ├── code-style.md
│   ├── git-workflow.md
│   └── testing-standards.md
└── memory/                  # Memória do projeto (existente)
    └── project-context.md

.adk/
├── config.json              # Configuração geral (existente)
├── memory.json              # Configuração MCP Memory (NOVO)
├── memory.db                # SQLite-vec database (NOVO)
└── sync-queue.json          # Queue de sync (existente)

src/utils/
├── memory-mcp.ts            # Wrapper MCP (NOVO)
├── context-loader.ts        # Powers pattern (NOVO)
├── context-compactor.ts     # Compactação (NOVO)
├── token-counter.ts         # Contagem de tokens (NOVO)
├── resilience.ts            # Retry/backoff (NOVO)
├── circuit-breaker.ts       # Circuit breaker (NOVO)
├── observability.ts         # Tracing (NOVO)
├── memory-pruner.ts         # Memory fading prevention (NOVO)
├── state-manager.ts         # Estender com resume/handoff
├── snapshot-manager.ts      # Existente
├── history-tracker.ts       # Existente
└── ...

src/commands/
├── diagnostics.ts           # Health check (NOVO)
├── validate.ts              # Validação constitution (NOVO)
├── memory.ts                # Estender com index/recall semântico
├── agent.ts                 # Estender com --resume e sessions
└── ...
```

### C. Comparativo de Providers MCP

| Critério | @yikizi/mcp-local-rag | mcp-memory-service |
|----------|----------------------|-------------------|
| Local-first | ✅ Sim | ✅ Sim |
| Otimizado para código | ✅ Sim | Parcial |
| Manutenção | Ativa | Ativa (13+ apps) |
| Response time | A testar | 5ms reportado |
| Hybrid search | ✅ Sim | ✅ Sim |
| Storage | SQLite | SQLite |

**Recomendação:** Benchmark com documentos reais do ADK antes de escolher.

---

**Documento criado em:** 2026-01-21
**Próxima revisão:** Após benchmark de MCP providers
