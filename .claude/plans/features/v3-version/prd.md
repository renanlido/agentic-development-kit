# PRD: v3-version

**Data:** 2026-02-02
**Status:** Draft
**Autor:** Auto-generated via ADK

---

## 1. Problema

### 1.1 Situação Atual (v2)

O ADK v2 sofre de **fragmentação excessiva de comandos**, criando fricção e carga cognitiva para desenvolvedores:

- **7 comandos separados** para gerenciar features (`new`, `research`, `plan`, `implement`, `sync`, `status`, `compact`)
- **Decisão manual** sobre qual comando executar em cada momento
- **Paralisia por análise**: usuário precisa entender o workflow completo antes de começar
- **Sem persistência de sessão**: contexto perdido entre execuções
- **Agentes produzem stubs**: código placeholder ao invés de implementações reais
- **Leitura parcial de contexto**: AI lê apenas 10-20% do contexto disponível
- **Sem suporte a paralelismo**: execução sequencial de todas as tasks

### 1.2 Impacto

| Problema | Impacto Medido |
|----------|----------------|
| Fragmentação | 5-7 comandos por feature (deveria ser 1) |
| Stub Rate | >30% (deveria ser <5%) |
| Retrabalho | >40% das tasks precisam correção |
| Contexto | Drift significativo durante sessões longas |

### 1.3 Gap vs Padrão Anthropic

Comparando com o padrão "Long-Running Agents" da Anthropic:
- **Falta**: Estado persistente entre sessões
- **Falta**: Checkpoints automáticos
- **Falta**: Memória hierárquica (4 tiers)
- **Falta**: Protocolos anti-stub

---

## 2. Solução Proposta

### 2.1 Filosofia Core

> **"One command per domain, not one command per step."**

### 2.2 Novo Modelo de Comandos

| Comando | Modo | Comportamento |
|---------|------|---------------|
| `adk feature <name>` | Interativo | Executa tudo com validação manual entre fases |
| `adk feature autopilot <name>` | Automático | QA por task + escalação inteligente |
| `adk docs [target]` | Automático | Analyze → Generate → Organize → Done |
| `adk workflow daily` | Automático | Update → Identify → Prioritize → Done |

### 2.3 Sistema Dual de Agentes

1. **Initializer Agent** (primeira execução)
   - Trigger: Sem `feature_list.json`
   - Ação: Analisa PRD → Gera `feature_list.json` + `init.sh`
   - Resultado: Ambiente pronto para código

2. **Coding Agent** (execuções subsequentes)
   - Trigger: `feature_list.json` existe
   - Loop: Read State → Select Task → Implement (TDD) → Update JSON → Commit → Repeat

### 2.4 Autopilot Flow (QA em 2 Camadas)

```
Research → [Manual: Refine/Continue?] → Plan → [Manual: Refine/Continue?] → Implement
                                                                              │
                                                             AUTOMATIC LOOP ──┘
LAYER 1 - QA per Task:
Task 1 → Implement → QA Task → Pass? → Task 2 → ... → Task N
                         └── Fail? → Auto-correct (3x) → ASK HUMAN

LAYER 2 - Final QA:
All tasks done → QA Feature Complete → Pass? → DONE
                                   └── Fail? → Auto-correct (3x) → ASK HUMAN
```

---

## 3. Requisitos Funcionais

### 3.1 Infraestrutura Base

- **RF01**: Criar `src/cli-v3.ts` como entry point separado (v2 permanece intocado)
- **RF02**: Implementar `src/utils/session-store.ts` para persistência de sessões
- **RF03**: Criar `src/utils/claude-v3.ts` com flags `--session-id`, `--resume`, `--continue`
- **RF04**: Manter compatibilidade: v2 e v3 coexistem (`adk` vs `adk3`)

### 3.2 Sistema de Memória (4 Tiers)

- **RF05**: Implementar Tier 1 - Core State (~2-4K tokens) - sempre em contexto
  - Arquivo: `memory/core-state.json`
  - Conteúdo: currentTask, decisions, constraints, modifiedFiles

- **RF06**: Implementar Tier 2 - Session Context (~8-16K) - por sessão
  - Arquivos: `session-notes.md`, `decisions.md`, `breadcrumbs.md`
  - Conteúdo: Timeline, learnings, referências para re-fetch

- **RF07**: Implementar Tier 3 - Feature Context (~20-50K) - on-demand
  - Arquivos: `prd.md`, `research.md`, `implementation-plan.md`, `tasks.md`
  - Loading: Apenas quando task muda

- **RF08**: Implementar Tier 4 - Project Context (unlimited) - raramente usado
  - Arquivos: `CLAUDE.md`, `guidelines.md`, `architecture.md`
  - Loading: Apenas por request explícito

### 3.3 Protocolos Anti-Stub

- **RF09**: Implementar "Read Before Write" protocol
  - Obrigatório ler arquivos antes de modificar
  - Explicar o que foi encontrado antes de propor mudanças

- **RF10**: Criar hook `validate-no-stub.sh` que bloqueia writes contendo:
  - `throw new Error.*Not implemented`
  - `TODO:`, `FIXME:`
  - `// stub`, `pass  # stub`
  - `NotImplementedError`

- **RF11**: Implementar "One File, One Step" protocol
  - READ → ANALYZE → EXPLAIN → EDIT → VERIFY → STOP por iteração

- **RF12**: Criar TDD Verification Loop obrigatório
  - Write RED test → Implement → RUN → GREEN/RED → Continue/Fix

### 3.4 Sistema de Compactação

- **RF13**: Implementar two-threshold compaction
  - T_max = 80% (trigger compaction)
  - T_target = 50% (post-compaction target)

- **RF14**: Definir regras de compressão
  - NUNCA comprimir: paths, line numbers, nomes, comandos, erros
  - SEMPRE comprimir: explicações redundantes, outputs processados, tentativas falhas

### 3.5 Hooks de Injeção de Contexto

- **RF15**: Criar `inject-memory.sh` (PreToolUse)
  - Injeta `core-state.json` em cada tool call
  - Inclui constraints ativos e anti-stub reminder

- **RF16**: Criar `auto-checkpoint.sh` (Stop)
  - Cria checkpoint ao fim da sessão
  - Salva: timestamp, feature, core state, git status

### 3.6 Garantia de Leitura (5 Camadas)

- **RF17**: Implementar Strategic Redundancy
  - Info crítica em 5+ lugares (core-state, hooks, prompts, checklists)

- **RF18**: Implementar Comprehension Checkpoint
  - Agent DEVE responder perguntas antes de implementar

- **RF19**: Implementar Critical Info First (CIF)
  - Constraints no INÍCIO do prompt (zona de alta atenção)

- **RF20**: Implementar Progressive Loading
  - Máximo ~20K tokens por task

- **RF21**: Implementar Forced Injection
  - Hook injeta core-state em CADA tool call

### 3.7 Execução Paralela Multi-Agent

- **RF22**: Criar Shared Memory (Tier 0)
  - Arquivo: `shared-state.json`
  - Conteúdo: decisions, file ownership, completed tasks

- **RF23**: Implementar estratégia de isolamento via Git Worktrees
  - Cada agent em worktree separado
  - File locking via fileOwnership

- **RF24**: Criar Aggregator
  - Merge decisions entre agents
  - Resolve conflitos
  - Consolida métricas

- **RF25**: Respeitar limites de paralelismo
  - Max concurrent agents: 3-4
  - Max tasks per wave: 4
  - Recommended start: 2 agents

### 3.8 Indexação de Codebase

- **RF26**: Implementar semantic indexer
  - Parse AST (functions, classes, imports)
  - Gerar embeddings
  - Build dependency graph
  - Calculate importance scores

- **RF27**: Criar estrutura de índice
  - `.claude/index/embeddings.db`
  - `.claude/index/symbols.json`
  - `.claude/index/dependencies.json`
  - `.claude/index/importance.json`

- **RF28**: Criar comandos de indexação
  - `adk index` - Index full project
  - `adk index --update` - Incremental
  - `adk search "query"` - Semantic search
  - `adk context "task"` - Find relevant files

### 3.9 Auto Memories

- **RF29**: Implementar auto-capture de patterns
  - Triggers: decisões arquiteturais, patterns descobertos, constraints, erros recorrentes

- **RF30**: Criar storage de memories
  - `.claude/memories/project.json`
  - `.claude/memories/patterns.json`
  - `.claude/memories/decisions.json`
  - `.claude/memories/errors.json`

- **RF31**: Criar comandos de memory
  - `adk memory list`
  - `adk memory add "..." --type decision`
  - `adk memory search "..."`
  - `adk memory export`
  - `adk memory prune --unused-days 30`

### 3.10 Visual Progress UI

- **RF32**: Implementar Rich Terminal UI (TUI)
  - Progress bar geral
  - Status de cada agent
  - Current task details
  - Keyboard shortcuts (pause, resume, logs, quit)

- **RF33**: Criar múltiplos modos de visualização
  - `--ui` - Dashboard TUI completo
  - (default) - Spinners mínimos
  - `--verbose` - Full logs
  - `--json` - Para integração

### 3.11 Comandos Feature v3

- **RF34**: Comando `adk feature <name>` (interativo)
  - Executa Research → Plan → Implement com validação manual entre fases

- **RF35**: Comando `adk feature autopilot <name>` (automático)
  - QA por task + escalação inteligente
  - Auto-correct até 3x antes de perguntar humano

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01**: Core State deve ser atualizado em <5 minutos
- **RNF02**: Compaction efficiency >50%
- **RNF03**: Tokens per Task deve diminuir progressivamente
- **RNF04**: Fast Context (indexação) deve ser 10x mais rápido que glob/grep

### 4.2 Confiabilidade

- **RNF05**: Recovery Success >95% (restaurar de checkpoints)
- **RNF06**: Breadcrumb Accuracy >95%
- **RNF07**: Decision Coverage >90%

### 4.3 Qualidade de Código

- **RNF08**: Stub Rate <5%
- **RNF09**: First-Pass QA Success >70%
- **RNF10**: Rework Rate <15%
- **RNF11**: Context Drift minimal

### 4.4 Compatibilidade

- **RNF12**: v2 e v3 devem coexistir sem conflitos
- **RNF13**: Arquivos em `.claude/` devem ser compatíveis entre versões
- **RNF14**: Node.js >= 18.0.0

### 4.5 Segurança

- **RNF15**: Hooks de validação devem bloquear comandos perigosos
- **RNF16**: File ownership deve prevenir conflitos de escrita

### 4.6 Usabilidade

- **RNF17**: Zero decisões para usuário em modo autopilot
- **RNF18**: UI deve funcionar em terminais 80x24 mínimo
- **RNF19**: Feedback visual claro sobre progresso

---

## 5. User Stories

### US01: Feature Unificada
**Como** desenvolvedor usando ADK
**Quero** executar um único comando para desenvolver uma feature completa
**Para** eliminar a carga cognitiva de decidir qual dos 7 comandos usar

**Critérios de Aceitação:**
- [ ] `adk feature my-feature` executa research, plan, implement sequencialmente
- [ ] Validação manual aparece entre cada fase
- [ ] Posso sair a qualquer momento e retomar depois
- [ ] Estado é persistido automaticamente

### US02: Autopilot com QA
**Como** desenvolvedor
**Quero** deixar o ADK implementar tasks automaticamente com QA
**Para** focar em outras atividades enquanto código é gerado

**Critérios de Aceitação:**
- [ ] `adk feature autopilot my-feature` roda sem intervenção
- [ ] Cada task passa por QA antes da próxima
- [ ] Auto-correção até 3x antes de escalar para humano
- [ ] QA final ao completar todas as tasks

### US03: Sessões Persistentes
**Como** desenvolvedor
**Quero** retomar sessões de onde parei
**Para** não perder contexto entre sessões de trabalho

**Critérios de Aceitação:**
- [ ] `adk feature my-feature --resume` retoma última sessão
- [ ] `adk feature my-feature --continue` continua do ponto exato
- [ ] Core State preserva decisões, constraints, arquivos modificados
- [ ] Session Notes documentam timeline e learnings

### US04: Zero Stubs
**Como** tech lead
**Quero** que código gerado seja sempre implementação real
**Para** eliminar retrabalho de completar placeholders

**Critérios de Aceitação:**
- [ ] Hook bloqueia writes com TODO, FIXME, NotImplementedError
- [ ] Agent para e explica bloqueios ao invés de criar stubs
- [ ] TDD é obrigatório (test first)
- [ ] Checklist de completude é verificado

### US05: Execução Paralela
**Como** desenvolvedor com tasks independentes
**Quero** executar múltiplas tasks simultaneamente
**Para** acelerar o desenvolvimento de features grandes

**Critérios de Aceitação:**
- [ ] `adk feature autopilot --parallel --agents 4` usa 4 agentes
- [ ] Cada agent em worktree isolado
- [ ] File ownership previne conflitos
- [ ] Aggregator merge resultados automaticamente

### US06: Contexto Inteligente
**Como** agent AI
**Quero** receber apenas contexto relevante para minha task
**Para** evitar confusão e melhorar qualidade do output

**Critérios de Aceitação:**
- [ ] Tier 1 (Core State) sempre presente
- [ ] Tier 2-4 carregados sob demanda
- [ ] Compaction automática em 80% de uso
- [ ] Máximo ~20K tokens por task

### US07: Busca Semântica
**Como** desenvolvedor
**Quero** encontrar código relevante por descrição
**Para** não precisar conhecer toda estrutura do projeto

**Critérios de Aceitação:**
- [ ] `adk search "authentication logic"` retorna arquivos relevantes
- [ ] `adk context "implement login"` sugere arquivos para a task
- [ ] Índice atualiza incrementalmente
- [ ] Resultados rankeados por relevância

### US08: Memories Automáticas
**Como** desenvolvedor em equipe
**Quero** que decisões arquiteturais sejam capturadas automaticamente
**Para** que novos membros entendam padrões do projeto

**Critérios de Aceitação:**
- [ ] Decisões tipo "usar X ao invés de Y" são capturadas
- [ ] Patterns descobertos são documentados
- [ ] Memories são injetadas em contexto quando relevantes
- [ ] Posso exportar para compartilhar com equipe

### US09: Visualização de Progresso
**Como** desenvolvedor
**Quero** ver progresso visual da execução
**Para** saber quanto falta e status de cada agent

**Critérios de Aceitação:**
- [ ] TUI mostra barra de progresso geral
- [ ] Cada agent tem seu status visível
- [ ] Keyboard shortcuts funcionam (pause, resume, logs)
- [ ] Modo `--verbose` mostra logs completos

### US10: Comprehension Checkpoint
**Como** sistema
**Quero** garantir que agent leu contexto antes de implementar
**Para** evitar implementações que ignoram constraints

**Critérios de Aceitação:**
- [ ] Agent deve responder: qual task atual, arquivos modificados, últimas decisões, constraints
- [ ] Se não conseguir responder, deve ler arquivos necessários
- [ ] Info crítica aparece em 3+ lugares (redundância estratégica)

---

## 6. Escopo

### 6.1 Incluído

#### Infraestrutura
- `src/cli-v3.ts` - Entry point v3
- `src/utils/session-store.ts` - Persistência de sessões
- `src/utils/claude-v3.ts` - Integração Claude com flags de sessão

#### Sistema de Memória
- `src/utils/memory/core-state.ts` - Tier 1
- `src/utils/memory/session-notes.ts` - Tier 2
- `src/utils/memory/compactor.ts` - Compactação automática
- `src/utils/memory/loader.ts` - Loading progressivo

#### Prompts e Agentes
- `src/utils/prompts/initializer.ts` - Initializer Agent
- `src/utils/prompts/coding.ts` - Coding Agent
- `src/utils/feature-list.ts` - Schema feature_list.json

#### Comandos
- `src/commands/feature-v3.ts` - Feature unificada + autopilot
- `src/commands/memory-v3.ts` - Comandos de memory

#### Hooks
- `inject-memory.sh` - Injeção de contexto
- `auto-checkpoint.sh` - Checkpoint automático
- `validate-no-stub.sh` - Bloqueio de stubs

#### Indexação
- `src/utils/indexer/` - Sistema de indexação semântica
- `.claude/index/` - Armazenamento de índices

#### UI
- `src/utils/tui/` - Terminal UI com ink/blessed
- Progress bars, status de agents, keyboard handling

### 6.2 Excluído (Out of Scope)

- **Web Dashboard**: Futuro - apenas CLI por agora
- **DevContainers**: Apenas Git Worktrees para isolamento
- **Embeddings externos**: Usar solução local (não OpenAI embeddings)
- **Migração automática v2→v3**: Manual por feature
- **Múltiplos projetos simultâneos**: Um projeto por sessão
- **Cloud sync de sessions**: Apenas local
- **Integrações IDE**: Apenas CLI
- **Suporte Windows**: Apenas macOS/Linux inicialmente

---

## 7. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Complexidade do sistema de memória | Alto | Média | Implementar incrementalmente, começar com Tier 1 apenas |
| Performance da indexação em projetos grandes | Médio | Alta | Indexação incremental, limite de arquivos, exclude patterns |
| Conflitos em execução paralela | Alto | Média | File locking robusto, detector de conflitos pre-wave |
| AI continua produzindo stubs | Alto | Média | 5 camadas de garantia, hook de bloqueio, comprehension checkpoint |
| Overhead de memória com TUI | Baixo | Baixa | Fallback para modo minimal se detectar terminal limitado |
| Incompatibilidade v2/v3 | Médio | Baixa | Entry points separados, arquivos em namespaces diferentes |
| Claude CLI sem suporte a --session-id | Alto | Baixa | Verificar flags disponíveis, fallback para workaround |
| Compaction muito agressiva perde info | Alto | Média | Never-compress list, dry-run, revert window 24h |

---

## 8. Métricas de Sucesso

### 8.1 Qualidade

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Stub Rate | <5% | Grep por patterns de stub em commits |
| First-Pass QA Success | >70% | Tasks aprovadas sem correção / Total tasks |
| Context Drift | Minimal | Decisões contraditórias por sessão |
| Rework Rate | <15% | Tasks reabertas / Total tasks |

### 8.2 Eficiência

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Tokens per Task | Decreasing | Média de tokens gastos por task |
| Sessions per Feature | Decreasing | Sessões até feature completa |
| Compaction Efficiency | >50% | (tokens_before - tokens_after) / tokens_before |
| Recovery Success | >95% | Restaurações bem-sucedidas / Total tentativas |

### 8.3 Memória

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Core State Freshness | <5min | Tempo desde última atualização |
| Decision Coverage | >90% | Decisões documentadas / Total decisões |
| Breadcrumb Accuracy | >95% | Breadcrumbs válidos / Total breadcrumbs |

### 8.4 Adoção

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Comandos por feature | 1-2 | Média de comandos diferentes usados |
| Tempo até primeira task | <5min | Tempo do `adk feature` até primeira task iniciada |
| % uso autopilot | >60% | Sessões autopilot / Total sessões |

---

## 9. Dependências

### 9.1 Técnicas

| Dependência | Tipo | Status |
|-------------|------|--------|
| Claude CLI com --session-id | Externa | Verificar disponibilidade |
| Git Worktrees | Sistema | Disponível |
| Node.js >= 18 | Runtime | Disponível |
| better-sqlite3 | NPM | A instalar |
| ink ou blessed | NPM | A instalar |
| transformers.js ou similar | NPM | A avaliar para embeddings |

### 9.2 Arquiteturais

| Dependência | Descrição |
|-------------|-----------|
| v2 congelado | Não modificar `src/cli.ts`, `src/commands/feature.ts`, `src/utils/claude.ts` |
| Estrutura `.claude/` | Manter compatibilidade com estrutura existente |
| Hook system existente | Reusar infraestrutura de hooks |

### 9.3 Conhecimento

| Dependência | Fonte |
|-------------|-------|
| Padrão Anthropic Long-Running Agents | anthropic.com/engineering/effective-harnesses |
| Context Engineering | anthropic.com/engineering/effective-context-engineering |
| Multi-Agent patterns | Google ADK, MongoDB, Tessl.io research |

---

## 10. Timeline (Sugestão)

### Phase 1: Infraestrutura Base (Foundation)
- `src/cli-v3.ts` - Entry point
- `src/utils/session-store.ts` - Persistência
- `src/utils/claude-v3.ts` - Integração Claude
- Testes de integração básicos

### Phase 2: Sistema de Memória (Memory Core)
- `src/utils/memory/core-state.ts` - Tier 1
- `src/utils/memory/session-notes.ts` - Tier 2
- `src/utils/memory/compactor.ts` - Compactação
- `src/utils/memory/loader.ts` - Loading progressivo
- Hooks de injeção e checkpoint

### Phase 3: Lógica de Agentes (Agent Logic)
- `src/utils/prompts/initializer.ts` - Initializer Agent
- `src/utils/prompts/coding.ts` - Coding Agent
- `src/utils/feature-list.ts` - Schema
- Protocolos anti-stub
- TDD enforcement

### Phase 4: Comandos Principais (Core Commands)
- `src/commands/feature-v3.ts` - Feature unificada
- Modo interativo
- Modo autopilot
- QA em 2 camadas

### Phase 5: Hooks de Validação (Quality Gates)
- `inject-memory.sh`
- `auto-checkpoint.sh`
- `validate-no-stub.sh`
- Comprehension checkpoint

### Phase 6: Execução Paralela (Parallel Execution)
- Shared State (Tier 0)
- Git Worktree management
- Aggregator
- Conflict resolver

### Phase 7: Indexação (Semantic Search)
- Indexer
- Symbol extraction
- Embedding generation (local)
- Query engine

### Phase 8: Auto Memories (Knowledge Capture)
- Pattern detection
- Auto-capture triggers
- Memory storage
- Memory injection

### Phase 9: Visual UI (Progress Visualization)
- Rich TUI
- Multi-agent dashboard
- Keyboard shortcuts
- Multiple output modes

### Phase 10: Integração Final (Integration)
- Add `"adk3": "node dist/cli-v3.js"` to package.json
- Documentation
- Migration guide
- Full test with real feature

---

## 11. Estrutura de Diretórios Resultante

```
src/
├── cli-v3.ts                    # Entry point v3
├── commands/
│   ├── feature-v3.ts            # Comando unificado
│   └── memory-v3.ts             # Comandos de memory
└── utils/
    ├── claude-v3.ts             # Integração Claude
    ├── session-store.ts         # Persistência sessões
    ├── feature-list.ts          # Schema feature_list
    ├── memory/
    │   ├── core-state.ts        # Tier 1
    │   ├── session-notes.ts     # Tier 2
    │   ├── compactor.ts         # Compactação
    │   └── loader.ts            # Loading progressivo
    ├── prompts/
    │   ├── initializer.ts       # Initializer Agent
    │   └── coding.ts            # Coding Agent
    ├── indexer/
    │   ├── parser.ts            # AST parsing
    │   ├── embedder.ts          # Embedding generation
    │   └── searcher.ts          # Query engine
    ├── parallel/
    │   ├── worktree-manager.ts  # Git worktrees
    │   ├── aggregator.ts        # Result merge
    │   └── shared-state.ts      # Tier 0
    └── tui/
        ├── dashboard.ts         # Main UI
        ├── progress.ts          # Progress bars
        └── agent-panel.ts       # Agent status

.claude/
├── hooks/
│   ├── inject-memory.sh         # PreToolUse
│   ├── auto-checkpoint.sh       # Stop
│   └── validate-no-stub.sh      # Write
├── index/                       # Semantic index
│   ├── embeddings.db
│   ├── symbols.json
│   ├── dependencies.json
│   └── importance.json
├── memories/                    # Auto memories
│   ├── project.json
│   ├── patterns.json
│   ├── decisions.json
│   └── errors.json
└── plans/features/{name}/
    ├── memory/                  # v3 memory tiers
    │   ├── core-state.json
    │   ├── session-notes.md
    │   ├── decisions.md
    │   ├── breadcrumbs.md
    │   └── archive/
    ├── checkpoints/
    │   ├── checkpoint-*.json
    │   └── latest.json
    ├── sessions/
    │   └── session-*.json
    └── feature_list.json        # v3 feature tests
```

---

## 12. Critérios de Aceite Globais

A feature v3-version será considerada completa quando:

1. [ ] `adk3 feature my-feature` executa ciclo completo (research → plan → implement)
2. [ ] `adk3 feature autopilot my-feature` funciona sem intervenção humana
3. [ ] Sessões são persistidas e podem ser retomadas
4. [ ] Stub Rate <5% em teste real
5. [ ] Execução paralela funciona com 2+ agents
6. [ ] Compaction automática ativa em 80% de uso
7. [ ] TUI mostra progresso corretamente
8. [ ] Todos os hooks de validação funcionando
9. [ ] v2 permanece funcional (sem breaking changes)
10. [ ] Documentação completa

---

## 13. Referências

### Documentos de Planejamento
- `00-MASTER-INDEX.md` - Status, roadmap, changelog
- `01-deep-analysis.md` - Análise codebase v2
- `02-long-running-agents-gap.md` - Gap vs Anthropic
- `03-v3-decisions.md` - Decisões aprovadas
- `04-context-memory-implementation.md` - Specs memória, anti-stub
- `05-implementation-guide.md` - Guia step-by-step
- `context-management-research.md` - Research completo (25+ fontes)

### Fontes Externas
- Anthropic Context Engineering: anthropic.com/engineering/effective-context-engineering
- Anthropic Long-Running Agents: anthropic.com/engineering/effective-harnesses
- Google ADK Multi-Agent: developers.googleblog.com/multi-agent-framework
- Factory.ai Context Compression: factory.ai/news/compressing-context
- Tessl.io Parallel Agents: tessl.io/blog/how-to-parallelize-ai-coding-agents
- MongoDB Memory Engineering: medium.com/mongodb/multi-agent-memory-engineering
- MemGPT (Letta): arxiv.org/abs/2310.08560

### Análise de Competidores
- Windsurf: SWE-grep, Fast Context, Auto Memories
- Cursor: Codebase Indexing, Composer UI
- Cline: MCP Integration, Deep Context
- Aider: Git-native workflows
- VS 2026: Cloud Agent with Progress UI

---

*PRD gerado automaticamente via ADK. Última atualização: 2026-02-02*
