# ADK v3 - MASTER INDEX

**Data**: 2026-01-25
**Última Revisão**: 2026-02-02
**Status**: PLANEJAMENTO COMPLETO - PRONTO PARA IMPLEMENTAÇÃO

---

## ⛔ REGRA MÁXIMA - LER ANTES DE QUALQUER COISA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   🚫  NÃO FAZER `npm link` NO CLI ATUAL                                 │
│   🚫  NÃO MODIFICAR src/cli.ts                                          │
│   🚫  NÃO MODIFICAR src/commands/feature.ts                             │
│                                                                          │
│   ✅  CRIAR src/cli-v3.ts SEPARADO                                      │
│   ✅  TESTAR COM: npm run adk3 -- <comando>                             │
│   ✅  MANTER v2 CONGELADO ATÉ v3 ESTAR 100% VALIDADO                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 DOCUMENTAÇÃO v3 (ESTA PASTA)

### Ordem de Leitura Recomendada

| # | Documento | O que contém | Ler quando |
|---|-----------|--------------|------------|
| 1 | **03-v3-decisions.md** | Decisões finais, estrutura, sprints | PRIMEIRO - visão geral |
| 2 | 01-deep-analysis.md | Análise linha a linha do código v2 | Entender problemas |
| 3 | 02-long-running-agents-gap.md | Gap vs padrão Anthropic | Entender solução |
| 4 | **04-context-memory-implementation.md** | Memória hierárquica, anti-stub, hooks | **CRÍTICO** - resolver stubs |
| 5 | **05-implementation-guide.md** | Guia passo-a-passo, schemas, migração | IMPLEMENTAÇÃO |
| 6 | optimized-context.md | Resumo consolidado para contexto AI | Quick reference |

### Documentação Complementar (fora desta pasta)

| Documento | O que contém | Localização |
|-----------|--------------|-------------|
| context-management-research.md | Pesquisa completa (1000+ linhas, 25+ refs) | `.claude/docs/` |

---

## 📝 CHANGELOG DE REVISÕES

### 2026-02-02 - Competitor Analysis & Missing Features
- ✅ **Análise de Competidores**: Windsurf, Cursor, Cline, Aider, VS 2026
- ✅ **04-context-memory-implementation.md**: Nova seção 14 "Codebase Indexing (Fast Context)"
  - Semantic search com embeddings
  - Dependency graph e importance scores
  - Integração com sistema de memória
- ✅ **04-context-memory-implementation.md**: Nova seção 15 "Auto Memories"
  - Captura automática de decisões e patterns
  - Detecção de soluções de erro recorrentes
  - Injeção automática de memórias relevantes
- ✅ **04-context-memory-implementation.md**: Nova seção 16 "Visual Progress UI"
  - TUI rico para acompanhamento de agentes paralelos
  - Modos: dashboard, minimal, verbose, json
  - Web dashboard (futuro)
- ✅ **04-context-memory-implementation.md**: Seção 17 "Referências" com 25+ fontes
- ✅ **optimized-context.md**: Seções 11-13 com resumos das novas features
- ✅ **optimized-context.md**: Seção 17 com referências e competitor analysis

### 2026-02-02 - Multi-Agent Parallel Execution
- ✅ **04-context-memory-implementation.md**: Nova seção 13 "Multi-Agent Parallel Execution"
- ✅ **Shared Memory Architecture**: Tier 0 compartilhado entre agentes
- ✅ **shared-state.json**: Schema completo (decisions, file ownership, tasks)
- ✅ **Isolation Strategies**: Git Worktrees (default), DevContainers, Branches
- ✅ **Communication**: Blackboard + Summarizer pattern
- ✅ **Conflict Prevention**: Pre-execution, file locking, two-step merge
- ✅ **Result Aggregation**: Merge de session-notes, decisions, metrics
- ✅ **Limits**: Max 3-4 agents (research-based)
- ✅ **Recovery**: Isolate failed agent, continue others
- ✅ **References**: 10+ novas fontes (Google ADK, Tessl.io, Addy Osmani, etc.)
- ✅ **optimized-context.md**: Nova seção 10 com resumo

### 2026-02-02 - Garantia de Leitura de Contexto (5 Camadas)
- ✅ **04-context-memory-implementation.md**: Nova seção 12 "Garantia de Leitura de Contexto"
- ✅ **Camada 1**: Forced Injection (hook injeta em toda operação)
- ✅ **Camada 2**: Progressive Loading (carregar apenas necessário)
- ✅ **Camada 3**: Critical Info First (constraints no início do prompt)
- ✅ **Camada 4**: Comprehension Checkpoint (verificar se leu)
- ✅ **Camada 5**: Strategic Redundancy (info crítica em 5+ lugares)
- ✅ **optimized-context.md**: Nova seção 8 com resumo das 5 camadas
- ✅ **Hook**: comprehension-check.sh documentado

### 2026-02-02 - Especificação Completa de Memória e Anti-Stub
- ✅ **04-context-memory-implementation.md**: Reescrito completamente (87 → 938 linhas)
- ✅ **Arquitetura MemGPT**: 4 tiers de memória hierárquica documentados
- ✅ **core-state.json**: Schema completo com todos os campos
- ✅ **Templates**: session-notes.md, decisions.md, breadcrumbs.md
- ✅ **Compaction Estruturada**: Two-threshold architecture, regras de preservação
- ✅ **Protocolos Anti-Stub**: Read Before Write, One File One Step, TDD Loop
- ✅ **Hooks de Injeção**: inject-memory.sh, auto-checkpoint.sh, validate-no-stub.sh
- ✅ **Métricas e KPIs**: Stub rate, drift, recovery, dashboard
- ✅ **Checklist de Implementação**: 6 fases detalhadas
- ✅ **Referências**: 25+ fontes acadêmicas e industriais
- ✅ **context-management-research.md**: Pesquisa completa arquivada em `.claude/docs/`

### 2026-02-02 - Objetivos Estratégicos v3
- ✅ **03-v3-decisions.md**: Nova seção 8 com objetivos estratégicos
- ✅ **8.1**: Sistema coeso (hooks, skills, memory, agents, constraints)
- ✅ **8.2**: Injeção automática de contexto por fase/task
- ✅ **8.3**: Feedback loop inteligente (volta fases quando necessário)
- ✅ **8.4**: Detecção de loops infinitos
- ✅ **8.5**: Enriquecimento de contexto pelo usuário (MEDIUM/LOW)
- ✅ **8.6**: Gerenciamento de contexto em 4 tiers para assertividade

### 2026-02-02 - QA em 2 Camadas
- ✅ **CAMADA 1**: QA por task durante implementação
- ✅ **CAMADA 2**: QA Final da feature completa após todas tasks
- ✅ **03-v3-decisions.md**: Diagrama de QA em 2 camadas
- ✅ **05-implementation-guide.md**: Lógica de QA em 2 camadas documentada
- ✅ **02-long-running-agents-gap.md**: Fluxo visual atualizado
- ✅ **optimized-context.md**: Autopilot flow com 2 layers

### 2026-02-02 - Fluxo Autopilot
- ✅ **03-v3-decisions.md**: Adicionado fluxo detalhado do autopilot
- ✅ **05-implementation-guide.md**: Documentada lógica do autopilot com escalonamento
- ✅ **REGRAS**: Validação manual entre fases, automático na implementação
- ✅ **ESCALONAMENTO**: Auto-correção 3x, depois pede ajuda humana

### 2026-02-02 - Alinhamento com Filosofia ADK
- ✅ **FILOSOFIA**: Consolidada "Um comando por domínio, não um comando por etapa"
- ✅ **02-long-running-agents-gap.md**: Removida fragmentação `feature new` + `feature work`
- ✅ **03-v3-decisions.md**: Fluxo atualizado para comando único
- ✅ **05-implementation-guide.md**: Comandos únicos documentados (seção 3.1)
- ✅ **optimized-context.md**: Core Mission atualizada com filosofia ADK

### 2026-02-02 - Revisão Técnica
- ✅ **01-deep-analysis.md**: Corrigida análise de `claude.ts` - modo headless JÁ é assíncrono
- ✅ **05-implementation-guide.md**: Adicionadas flags reais do Claude CLI (`--resume`, `--session-id`)
- ✅ **05-implementation-guide.md**: Schema canônico de `feature_list.json` consolidado (seção 6)
- ✅ **05-implementation-guide.md**: Plano de migração de features v2→v3 (seção 7)
- ✅ **05-implementation-guide.md**: Known Limitations documentadas (seção 8)
- ✅ **05-implementation-guide.md**: Diagrama de estados da sessão (seção 9)
- ✅ **optimized-context.md**: Atualizado para referenciar schema canônico

---

## 🎯 RESUMO EXECUTIVO

### Filosofia ADK

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  "UM COMANDO POR DOMÍNIO, NÃO UM COMANDO POR ETAPA"                    │
│                                                                         │
│  ❌ ERRADO: feature new → research → plan → implement → qa → docs      │
│  ✅ CERTO:  adk feature <name>  → Faz TUDO automaticamente             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Problema Central

```text
v2: 7 comandos fragmentados = 7 decisões = paralisia por análise
v3: 1 comando por domínio = 0 decisões = execução fluida
```

### Solução

```text
adk feature <name>  → Detecta estado → Inicializa ou Continua → Loop até 100%
adk docs [target]   → Analisa → Gera → Organiza → Done
adk workflow daily  → Update → Identify → Prioritize → Done
```

### O que v2 tem que FUNCIONA

- ✅ Token counting
- ✅ Context compaction
- ✅ Progress tracking
- ✅ Snapshots
- ✅ Retry com backoff
- ✅ Hooks básicos

### O que v2 tem mas NÃO FUNCIONA

- ❌ MCP Memory (é Fuse.js fuzzy, não semântico)
- ❌ Session management (código existe mas nunca é chamado)
- ❌ Continuidade entre fases (0%)

### O que v3 vai CRIAR

**Código:**
- 🆕 `src/cli-v3.ts` - Entry point (comando único por domínio)
- 🆕 `src/commands/feature-v3.ts` - `adk feature <name>` faz TUDO
- 🆕 `src/utils/claude-v3.ts` - Com session tracking
- 🆕 `src/utils/session-store.ts` - Persistência
- 🆕 `src/utils/prompts/*.ts` - Prompts diferenciados (Initializer/Coding)
- 🆕 `src/utils/memory/*.ts` - Sistema de memória hierárquica

**Artefatos por Feature:**
- 🆕 `feature_list.json` - Testes estruturados
- 🆕 `init.sh` - Setup automático
- 🆕 `memory/core-state.json` - Tier 1: Estado sempre em contexto
- 🆕 `memory/session-notes.md` - Tier 2: Notas da sessão
- 🆕 `memory/decisions.md` - Tier 2: Registro de decisões
- 🆕 `memory/breadcrumbs.md` - Tier 2: Referências para re-fetch
- 🆕 `checkpoints/*.json` - Snapshots para recovery

**Hooks:**
- 🆕 `inject-memory.sh` - Injeção de contexto (PreToolUse)
- 🆕 `auto-checkpoint.sh` - Checkpoint automático (Stop)
- 🆕 `validate-no-stub.sh` - Bloqueio de stubs (Write)
- 🆕 `comprehension-check.sh` - Verificação de leitura (PreToolUse)
- 🆕 `auto-memory-capture.sh` - Captura automática de memórias (PostToolUse)

**Features Baseadas em Competidores (Windsurf, Cursor, Cline):**
- 🆕 `.claude/index/` - Codebase indexing (semantic search, embeddings)
- 🆕 `.claude/memories/` - Auto memories (patterns, decisions, errors)
- 🆕 `src/ui/progress-dashboard.tsx` - Visual Progress UI (TUI com Ink)
- 🆕 Comandos: `adk index`, `adk search`, `adk memory`, `adk dashboard`

---

## 🚀 PRÓXIMOS PASSOS

### Imediato (antes de codar)

```bash
# 1. Ler 03-v3-decisions.md completo
# 2. Tag v2 estável
git tag -a v2.0.0 -m "ADK v2 stable"
git push --tags

# 3. Branch v3
git checkout -b feature/adk-v3

# 4. Criar estrutura vazia
mkdir -p src/utils/prompts
touch src/cli-v3.ts
touch src/commands/feature-v3.ts
# etc...

# 5. Adicionar ao package.json:
# "adk3": "node dist/cli-v3.js"

# 6. NUNCA fazer npm link
```

---

## ✅ CHECKLIST PRÉ-IMPLEMENTAÇÃO

- [ ] Li 03-v3-decisions.md completo
- [ ] Li 05-implementation-guide.md (incluindo seções 6-9)
- [ ] Entendi por que NÃO fazer npm link
- [x] **Verificado flags do Claude CLI** (2026-02-02): `--resume`, `--session-id`, `-c`
- [ ] Tag v2.0.0 criada
- [ ] Branch feature/adk-v3 criada
- [ ] Estrutura de arquivos v3 criada
- [ ] Script adk3 no package.json

---

*Master Index - ADK v3 Planning*
