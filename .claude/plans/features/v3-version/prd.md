# PRD: v3-version

**Data:** 2026-02-02
**Status:** Draft
**Autor:** Auto-generated

---

## 1. Problema

### 1.1 Problema Central

O ADK v2 atual sofre de **fragmentação de comandos** que causa paralisia por análise e perda de contexto entre fases.

| Aspecto | v2 (Atual) | Impacto |
|---------|------------|---------|
| Comandos para features | 7 comandos separados | Usuário decide o que rodar → paralisia |
| Contexto entre fases | ~0% preservado | Agente "esquece" decisões anteriores |
| Conclusão prematura | ~40% das features | Re-trabalho constante |
| Recovery após crash | Manual | Minutos/horas perdidos |

### 1.2 Sintomas Observados

| Sintoma | Causa Raiz | Impacto |
|---------|-----------|---------|
| Código stub em vez de implementação real | Context overload, agente "rushing forward" | Re-trabalho, bugs |
| Agente esquece instruções anteriores | Context window overflow | Inconsistência |
| Repetição de erros já corrigidos | Falta de memória persistente | Perda de produtividade |
| Implementação parcial de features | Attention decay em contextos longos | Features incompletas |

### 1.3 Causas Técnicas

- **Context Pollution:** Informação irrelevante ocupa espaço, degradando performance
- **Attention Decay (Context Rot):** Performance do modelo degrada após ~4000 tokens
- **"Rush Forward" Behavior:** Agentes treinados para minimizar esforço evitam ler arquivos
- **Loss of Operational Details:** Compressão descarta file paths, API endpoints, condições de erro

### 1.4 Gap vs Padrão Anthropic

O ADK v2 não segue o padrão de "Long-Running Agents" recomendado pela Anthropic:
- Sessões one-shot ao invés de persistentes
- Sem memória hierárquica estruturada
- Sem sistema de checkpoints para recovery
- Sem protocolos anti-stub

---

## 2. Solução Proposta

### 2.1 Filosofia ADK v3

> **"Um comando por domínio, não um comando por etapa."**

Cada comando faz TUDO do seu domínio. Zero fragmentação. Zero decisões para o usuário.

### 2.2 Comandos Principais

| Comando | Modo | O que faz |
|---------|------|-----------|
| `adk feature <name>` | Interativo | Research → Plan → Implement com validações manuais entre fases |
| `adk feature autopilot <name>` | Automático | QA por task + QA final + escalonamento inteligente |
| `adk docs [target]` | Automático | Analisa → Gera → Organiza → Done |
| `adk workflow daily` | Automático | Update → Identify → Prioritize → Done |

### 2.3 Arquitetura Dual-Agent

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      adk feature my-feature                             │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────────┐
                    │ Feature existe? │
                    └────────┬────────┘
              ┌──────────────┴──────────────┐
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ NÃO             │          │ SIM             │
    │ → Initializer   │          │ → Coding Agent  │
    │   Agent         │          │   (resume)      │
    └────────┬────────┘          └────────┬────────┘
             │                            │
             ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ 1. Estrutura    │          │ 1. Detectar     │
    │ 2. feature_list │          │    estado atual │
    │ 3. init.sh      │          │ 2. Próxima task │
    │ 4. Git commit   │          │ 3. Implementar  │
    └─────────────────┘          │ 4. QA task      │
                                 │ 5. Commit       │
                                 │ 6. Loop         │
                                 └─────────────────┘
```

### 2.4 Sistema de Memória Hierárquica (4 Tiers)

Baseado no padrão MemGPT:

| Tier | Nome | Tamanho | Quando Carregar |
|------|------|---------|-----------------|
| **1** | Core State | ~2-4K tokens | SEMPRE presente |
| **2** | Session Context | ~8-16K tokens | Início de sessão |
| **3** | Feature Context | ~20-50K tokens | Mudança de task |
| **4** | Project Context | Ilimitado | Referência explícita |

### 2.5 QA em Duas Camadas

```text
CAMADA 1 - QA por Task:
Task N → Implementa → QA Task → Pass? → Task N+1
                         └── Fail? → Auto-correct (3x) → ASK HUMAN

CAMADA 2 - QA Final:
All tasks done → QA Feature Complete → Pass? → DONE
                                   └── Fail? → Auto-correct (3x) → ASK HUMAN
```

---

## 3. Requisitos Funcionais

### 3.1 CLI e Entry Point

- **RF01:** Criar `src/cli-v3.ts` como entry point separado (comando `adk3` durante dev)
- **RF02:** NÃO modificar `src/cli.ts`, `src/commands/feature.ts`, `src/utils/claude.ts` existentes
- **RF03:** Adicionar script `"adk3": "node dist/cli-v3.js"` no package.json

### 3.2 Session Management

- **RF04:** Criar `src/utils/session-store.ts` para persistência de session IDs vinculados a features
- **RF05:** Criar `src/utils/claude-v3.ts` wrapper que suporta `--session-id` e `--resume`
- **RF06:** Implementar detecção automática de estado (nova feature vs continuar existente)

### 3.3 Sistema de Memória

- **RF07:** Implementar Tier 1 (Core State) com schema `core-state.json` contendo:
  - currentTask (id, name, status, files, lines)
  - taskProgress (total, completed, inProgress, pending, completedIds)
  - criticalDecisions (últimas 5)
  - modifiedFiles
  - constraints (anti-stub rules)
  - breadcrumbs (referências para re-fetch)
  - blockers e nextSteps

- **RF08:** Implementar Tier 2 (Session Context) com:
  - `session-notes.md` (timeline, learnings, commands)
  - `decisions.md` (ADRs simplificados)
  - `breadcrumbs.md` (referências rápidas)

- **RF09:** Criar estrutura de diretórios por feature:
  ```
  .claude/plans/features/{name}/
  ├── memory/
  │   ├── core-state.json
  │   ├── session-notes.md
  │   ├── decisions.md
  │   ├── breadcrumbs.md
  │   └── archive/
  ├── checkpoints/
  │   └── latest.json
  └── sessions/
  ```

### 3.4 Dual-Agent System

- **RF10:** Criar `src/utils/prompts/initializer-agent.ts` com prompt para:
  - Criar estrutura de feature
  - Gerar `feature_list.json` a partir do PRD
  - Gerar `init.sh` para setup
  - Fazer commit inicial

- **RF11:** Criar `src/utils/prompts/coding-agent.ts` com prompt para:
  - Ler `feature_list.json`
  - Selecionar próxima task não completa
  - Implementar com TDD
  - Atualizar JSON com status
  - Fazer commit por task
  - Loop até 100% passing

- **RF12:** Criar `src/utils/feature-list.ts` para gerenciar o schema:
  ```typescript
  interface FeatureList {
    feature: string
    version: "1.0.0"
    tests: FeatureTest[]
    summary: { total, passing, failing, pending }
  }
  ```

### 3.5 Compaction

- **RF13:** Implementar Two-Threshold Architecture:
  - T_max (80%): trigger compaction
  - T_target (50%): post-compaction target

- **RF14:** Preservar na compaction: file paths, line numbers, function names, comandos que funcionaram, mensagens de erro

### 3.6 Protocolos Anti-Stub

- **RF15:** Implementar Read Before Write Protocol obrigatório
- **RF16:** Implementar One File, One Step Protocol
- **RF17:** Implementar TDD Verification Loop
- **RF18:** Criar checklist de completude automático

### 3.7 Hooks de Contexto

- **RF19:** Criar `inject-memory.sh` (PreToolUse) - injeta core-state e constraints
- **RF20:** Criar `auto-checkpoint.sh` (Stop) - cria checkpoint ao fim de sessão
- **RF21:** Criar `validate-no-stub.sh` (PreToolUse:Write) - bloqueia código com stubs
- **RF22:** Criar `comprehension-check.sh` (PreToolUse:Write) - verifica se leu contexto

### 3.8 Comandos de Memória

- **RF23:** Implementar `adk memory status <feature>` - exibe estado da memória
- **RF24:** Implementar `adk memory checkpoint <feature>` - cria checkpoint manual
- **RF25:** Implementar `adk memory compact <feature>` - compacta sessão atual
- **RF26:** Implementar `adk memory restore <feature> <id>` - restaura de checkpoint

### 3.9 Feature Autopilot

- **RF27:** Implementar loop automático com QA por task (máx 3 tentativas de auto-correção)
- **RF28:** Implementar QA final da feature completa
- **RF29:** Implementar escalonamento inteligente (após 3 falhas → pede ajuda humana)
- **RF30:** Implementar detecção de loops infinitos (mesmo erro 2x, mesma correção 3x, 5 iterações sem progresso)

### 3.10 Multi-Agent Parallel Execution (Fase 2)

- **RF31:** Criar `shared-state.json` para memória compartilhada entre agentes
- **RF32:** Implementar file ownership para evitar conflitos
- **RF33:** Implementar agregador de resultados
- **RF34:** Limite de 3-4 agentes simultâneos

### 3.11 Codebase Indexing (Fase 2)

- **RF35:** Criar índice semântico em `.claude/index/`
- **RF36:** Implementar `adk index` para indexação completa
- **RF37:** Implementar `adk search "query"` para busca semântica
- **RF38:** Implementar `adk context "task"` para encontrar arquivos relevantes

### 3.12 Auto Memories (Fase 2)

- **RF39:** Capturar automaticamente decisões arquiteturais
- **RF40:** Capturar padrões descobertos
- **RF41:** Capturar soluções de erros recorrentes
- **RF42:** Implementar `adk memory list/add/search/export/prune`

### 3.13 Visual Progress UI (Fase 2)

- **RF43:** Implementar TUI com Ink para acompanhamento de progresso
- **RF44:** Modos: `--ui` (dashboard), default (spinners), `--verbose` (logs), `--json` (integração)

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01:** Core State deve ter < 2000 tokens (~1500 palavras)
- **RNF02:** Recovery de checkpoint < 30 segundos
- **RNF03:** Compaction efficiency > 50%
- **RNF04:** Context loading < 5 segundos para Tier 1-2

### 4.2 Qualidade

- **RNF05:** Stub Rate < 5% (código placeholder)
- **RNF06:** First-Pass QA Success > 70%
- **RNF07:** Rework Rate < 15%
- **RNF08:** Recovery Success > 95%

### 4.3 Compatibilidade

- **RNF09:** v3 deve coexistir com features v2 existentes
- **RNF10:** Migração automática de `tasks.md` para `feature_list.json`
- **RNF11:** Rollback para v2 se migração falhar

### 4.4 Isolamento

- **RNF12:** CLI v2 DEVE permanecer CONGELADO durante desenvolvimento v3
- **RNF13:** Testes v3 via `npm run adk3`, NUNCA via `npm link`
- **RNF14:** Branch separada `feature/adk-v3` para desenvolvimento

### 4.5 Escalabilidade

- **RNF15:** Suportar features com até 50 tasks
- **RNF16:** Suportar sessões de até 2 horas
- **RNF17:** Multi-agent com máximo 4 agentes simultâneos

---

## 5. User Stories

### US01: Desenvolvedor quer iniciar nova feature

**Como** desenvolvedor
**Quero** executar um único comando para iniciar uma feature
**Para** começar a desenvolver sem decidir qual comando usar

**Critérios de Aceitação:**
- [ ] `adk feature my-feature` detecta que feature não existe
- [ ] Executa Initializer Agent automaticamente
- [ ] Cria estrutura de diretórios com `feature_list.json`
- [ ] Faz commit inicial
- [ ] Continua para próxima fase sem intervenção

---

### US02: Desenvolvedor quer continuar feature existente

**Como** desenvolvedor
**Quero** retomar uma feature de onde parei
**Para** não perder contexto e progresso

**Critérios de Aceitação:**
- [ ] `adk feature my-feature` detecta que feature existe
- [ ] Carrega `core-state.json` com estado atual
- [ ] Identifica próxima task pendente
- [ ] Continua implementação sem perguntar o que fazer
- [ ] Preserva decisões e breadcrumbs da sessão anterior

---

### US03: Desenvolvedor quer execução automática completa

**Como** desenvolvedor
**Quero** que o ADK complete uma feature autonomamente
**Para** poder focar em outras tarefas enquanto feature é implementada

**Critérios de Aceitação:**
- [ ] `adk feature autopilot my-feature` executa Research → Plan → Implement
- [ ] Valida manualmente entre fases (Research→Plan, Plan→Implement)
- [ ] Loop automático durante implementação
- [ ] QA por task com auto-correção (máx 3x)
- [ ] QA final da feature completa
- [ ] Escala para humano se falhar 3x consecutivas

---

### US04: Desenvolvedor quer recuperar sessão após crash

**Como** desenvolvedor
**Quero** recuperar estado após crash ou timeout
**Para** não perder progresso de implementação

**Critérios de Aceitação:**
- [ ] Checkpoint automático criado ao final de cada sessão
- [ ] `adk memory restore my-feature latest` restaura último estado
- [ ] Core state, modified files e decisions preservados
- [ ] Tempo de recovery < 30 segundos
- [ ] Git status e último commit preservados no checkpoint

---

### US05: Desenvolvedor quer evitar código stub

**Como** desenvolvedor
**Quero** que o ADK bloqueie criação de código placeholder
**Para** evitar código incompleto no repositório

**Critérios de Aceitação:**
- [ ] Hook `validate-no-stub.sh` bloqueia Write com patterns de stub
- [ ] Patterns detectados: `throw new Error('Not implemented')`, `TODO:`, `FIXME:`, `// stub`
- [ ] Mensagem clara explicando por que foi bloqueado
- [ ] Agente deve implementar lógica real ou parar e explicar bloqueio

---

### US06: Desenvolvedor quer ver estado da memória

**Como** desenvolvedor
**Quero** consultar estado atual da memória de uma feature
**Para** entender progresso e contexto

**Critérios de Aceitação:**
- [ ] `adk memory status my-feature` exibe dashboard
- [ ] Mostra: task atual, progresso, tokens usados, compactions
- [ ] Mostra: decisões documentadas, checkpoints disponíveis
- [ ] Mostra: warnings se houver
- [ ] Mostra: stub rate, test coverage, lint issues

---

### US07: Desenvolvedor quer migrar feature v2 para v3

**Como** desenvolvedor
**Quero** que features v2 existentes funcionem com v3
**Para** aproveitar novas funcionalidades sem perder trabalho

**Critérios de Aceitação:**
- [ ] `adk3 feature work my-v2-feature` detecta ausência de `feature_list.json`
- [ ] Converte `tasks.md` para formato FeatureTest
- [ ] Gera `feature_list.json` com status preservado
- [ ] Preserva artefatos existentes: prd.md, research.md, progress.md
- [ ] Rollback automático se migração falhar

---

### US08: Desenvolvedor quer execução paralela de tasks (Fase 2)

**Como** desenvolvedor
**Quero** que múltiplos agentes trabalhem em tasks paralelas
**Para** acelerar implementação de features grandes

**Critérios de Aceitação:**
- [ ] `adk feature autopilot my-feature --parallel` usa múltiplos agentes
- [ ] Shared state sincroniza decisões entre agentes
- [ ] File ownership evita conflitos
- [ ] Máximo 4 agentes simultâneos
- [ ] Merge automático de resultados ao fim de cada wave

---

## 6. Escopo

### 6.1 Incluído (Fase 1 - MVP)

- CLI v3 separado (`adk3`)
- Session management com `--session-id` e `--resume`
- Sistema de memória 4-tier completo
- Dual-agent system (Initializer + Coding)
- Feature list com schema estruturado
- Compaction com two-threshold
- Protocolos anti-stub (Read-First, One-Step, TDD)
- Hooks de contexto (inject, checkpoint, validate)
- Comandos de memória (status, checkpoint, compact, restore)
- Autopilot com QA em duas camadas
- Migração automática de features v2

### 6.2 Incluído (Fase 2 - Enhancements)

- Multi-agent parallel execution
- Codebase indexing (semantic search)
- Auto memories (captura automática)
- Visual Progress UI (TUI com Ink)
- Web Dashboard (localhost)

### 6.3 Excluído (Out of Scope)

- Modificação do CLI v2 existente
- Migração para Python SDK
- Implementação de Constitution/Steering
- Tarefas pendentes de v2-fase3
- Browser automation nativo (dependente de Playwright MCP)
- Suporte a múltiplas features simultâneas na mesma sessão
- Cloud deployment do dashboard

---

## 7. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| **API do Claude CLI muda flags** | Alto | Média | Verificar `--help` antes de cada sprint; criar abstração |
| **Rate limits em sessões longas** | Alto | Média | Implementar backoff exponencial; compaction agressiva |
| **Perda de contexto mesmo com `--resume`** | Alto | Média | Checkpoints frequentes; core-state sempre atualizado |
| **Loops infinitos de QA** | Médio | Alta | Limite de 3 tentativas; detecção de padrões repetidos |
| **Conflitos em multi-agent** | Alto | Alta | File ownership; sequential para mesmo arquivo |
| **v2 quebra durante dev v3** | Crítico | Baixa | Isolamento total; nunca `npm link`; branch separada |
| **Migração v2→v3 falha** | Médio | Média | Rollback automático; v2 continua funcionando |

---

## 8. Métricas de Sucesso

### 8.1 Métricas de Qualidade

| Métrica | v2 Atual | v3 Target | Como Medir |
|---------|----------|-----------|------------|
| Stub Rate | ~20% | <5% | Grep patterns em código gerado |
| First-Pass QA Success | ~30% | >70% | qa-report status na primeira tentativa |
| Rework Rate | ~30% | <15% | Git history de alterações em mesmos arquivos |
| Context Drift | Alto | Mínimo | Comparar output vs task original |

### 8.2 Métricas de Eficiência

| Métrica | v2 Atual | v3 Target | Como Medir |
|---------|----------|-----------|------------|
| Sessões por feature | 7+ | 1-3 | Contagem de `claude` invocations |
| Contexto entre fases | ~0% | >95% | Verificar se decisões são lembradas |
| Conclusão prematura | ~40% | <5% | Features completas vs abandonadas |
| Recovery após crash | Manual (~10min) | <30s | Tempo para restaurar checkpoint |

### 8.3 Métricas de Memória

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Core State Freshness | <5min | Idade do core-state.json |
| Decision Coverage | >90% | Decisões documentadas vs tomadas |
| Breadcrumb Accuracy | >95% | Breadcrumbs corretos vs total |
| Compaction Efficiency | >50% | Ratio tokens antes/depois |

### 8.4 Métricas Multi-Agent (Fase 2)

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Speedup vs Sequential | >2x | Tempo paralelo vs sequencial |
| Conflict Rate | <5% | Conflitos de merge detectados |
| Coordination Overhead | <20% | Tempo gasto em sync vs implementação |

---

## 9. Dependências

### 9.1 Dependências Técnicas

| Dependência | Tipo | Status | Descrição |
|-------------|------|--------|-----------|
| Claude CLI | Externa | Disponível | Flags `--session-id`, `--resume`, `-c` verificadas |
| Node.js >= 18.0.0 | Runtime | Disponível | Já é requisito do v2 |
| Commander.js v14 | Lib | Disponível | CLI parsing |
| Ora v9 | Lib | Disponível | Spinners |
| Chalk v5 | Lib | Disponível | Cores no terminal |
| fs-extra v11 | Lib | Disponível | Operações de arquivo |
| Ink (novo) | Lib | A instalar | TUI React para terminal |

### 9.2 Dependências de Código v2

| Módulo | Caminho | Uso no v3 |
|--------|---------|-----------|
| Progress Tracker | `src/utils/progress.ts` | Manter atualização de progress.md |
| Token Counter | `src/utils/token-counter.ts` | Monitorar custos |
| Context Compactor | `src/utils/context-compactor.ts` | Base para compaction |
| Git Paths | `src/utils/git-paths.ts` | Resolução de worktrees |

### 9.3 Artefatos v2 Preservados

| Artefato | Ação no v3 |
|----------|------------|
| `tasks.md` | MANTER - fonte para gerar `feature_list.json` |
| `progress.md` | MANTER - log de alto nível |
| `prd.md` | MANTER - entrada para Initializer |
| `state.json` | MANTER - adicionar campos v3 |

---

## 10. Timeline (Sugestão)

### Sprint 0: Setup (1 dia)
- [ ] Criar branch `feature/adk-v3`
- [ ] Criar `src/cli-v3.ts`
- [ ] Adicionar script `adk3` no package.json
- [ ] Tag v2.0.0 estável
- [ ] **NÃO fazer npm link**

### Sprint 1: Session Store (3 dias)
- [ ] `src/utils/session-store.ts`
- [ ] `src/utils/claude-v3.ts`
- [ ] Testes unitários

### Sprint 2: Sistema de Memória - Tier 1 (3 dias)
- [ ] Schema `core-state.json`
- [ ] Estrutura de diretórios memory/
- [ ] Hook `inject-memory.sh`
- [ ] Testes

### Sprint 3: Sistema de Memória - Tier 2 (3 dias)
- [ ] Template `session-notes.md`
- [ ] Template `decisions.md`
- [ ] Template `breadcrumbs.md`
- [ ] Hook `auto-checkpoint.sh`

### Sprint 4: Dual-Agent Prompts (3 dias)
- [ ] `src/utils/prompts/initializer-agent.ts`
- [ ] `src/utils/prompts/coding-agent.ts`
- [ ] `src/utils/feature-list.ts`
- [ ] `src/utils/init-script.ts`

### Sprint 5: Anti-Stub Protocols (2 dias)
- [ ] Hook `validate-no-stub.sh`
- [ ] Hook `comprehension-check.sh`
- [ ] Verification checklist

### Sprint 6: Comandos Feature v3 (5 dias)
- [ ] `src/commands/feature-v3.ts`
- [ ] `adk feature <name>` (interativo)
- [ ] `adk feature autopilot <name>`
- [ ] QA em duas camadas
- [ ] Escalonamento inteligente

### Sprint 7: Comandos Memory (3 dias)
- [ ] `adk memory status`
- [ ] `adk memory checkpoint`
- [ ] `adk memory compact`
- [ ] `adk memory restore`

### Sprint 8: Compaction (3 dias)
- [ ] Two-threshold architecture
- [ ] Template de compaction estruturada
- [ ] Testes de preservação

### Sprint 9: Git Integration (2 dias)
- [ ] `src/utils/git-context.ts`
- [ ] Auto-commit por task
- [ ] Integração com checkpoints

### Sprint 10: Migração v2→v3 (2 dias)
- [ ] Detecção de feature v2
- [ ] Conversão tasks.md → feature_list.json
- [ ] Rollback automático

### Sprint 11: Testes e Validação (3 dias)
- [ ] Testes completos de integração
- [ ] Teste com feature real
- [ ] Documentação

### Sprint 12: Release (2 dias)
- [ ] Merge para CLI principal
- [ ] Release v3.0.0
- [ ] Atualização do CLAUDE.md

---

## 11. Arquivos a Criar

### 11.1 Novos Arquivos de Código

```
src/
├── cli-v3.ts                           # Entry point v3
├── commands/
│   └── feature-v3.ts                   # Comandos v3
├── utils/
│   ├── claude-v3.ts                    # executeClaudeCommand com session
│   ├── session-store.ts                # Persistência de session IDs
│   ├── feature-list.ts                 # Generator feature_list.json
│   ├── init-script.ts                  # Generator init.sh
│   ├── git-context.ts                  # Git log reading
│   ├── prompts/
│   │   ├── initializer-agent.ts        # Prompt primeira sessão
│   │   └── coding-agent.ts             # Prompt sessões subsequentes
│   └── memory/
│       ├── core-state.ts               # Tier 1 management
│       ├── session-notes.ts            # Tier 2 management
│       └── compactor.ts                # Compaction logic
```

### 11.2 Novos Hooks

```
.claude/hooks/
├── inject-memory.sh                    # PreToolUse - injeta contexto
├── auto-checkpoint.sh                  # Stop - cria checkpoint
├── validate-no-stub.sh                 # PreToolUse:Write - bloqueia stubs
└── comprehension-check.sh              # PreToolUse:Write - verifica leitura
```

### 11.3 Estrutura por Feature

```
.claude/plans/features/{name}/
├── feature_list.json                   # Lista estruturada de testes
├── init.sh                             # Script de setup
├── memory/
│   ├── core-state.json                 # Tier 1
│   ├── session-notes.md                # Tier 2
│   ├── decisions.md                    # Tier 2
│   ├── breadcrumbs.md                  # Tier 2
│   └── archive/                        # Sessões antigas
├── checkpoints/
│   └── latest.json
└── sessions/
    └── session-*.json
```

---

## 12. Referências

### Documentação de Planejamento

| Documento | Conteúdo |
|-----------|----------|
| `00-MASTER-INDEX.md` | Status, roadmap, changelog |
| `01-deep-analysis.md` | Análise v2 codebase |
| `02-long-running-agents-gap.md` | Gap vs padrão Anthropic |
| `03-v3-decisions.md` | Decisões aprovadas, objetivos |
| `04-context-memory-implementation.md` | Especificação memória, anti-stub, hooks |
| `05-implementation-guide.md` | Guia passo-a-passo, schemas |

### Referências Externas

| Fonte | Tópico |
|-------|--------|
| Anthropic | Context Engineering, Long-Running Agents |
| Google ADK | Multi-Agent Framework |
| Factory.ai | Context Compression |
| Tessl.io | Parallel AI Agents |
| MongoDB | Memory Engineering |
| MemGPT (Letta) | Hierarchical Memory |

---

*PRD gerado automaticamente baseado nos documentos de planejamento v3.*
*Última atualização: 2026-02-02*
