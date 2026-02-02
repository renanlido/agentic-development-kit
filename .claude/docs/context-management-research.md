# Pesquisa: Gerenciamento de Contexto para Agentes de Longa Duracao

**Data:** 2026-02-02
**Versao:** 1.0
**Status:** Pesquisa Concluida

---

## Sumario Executivo

Este documento consolida pesquisa sobre tecnicas para resolver problemas de contexto em agentes de IA de longa duracao, especialmente:

- Tarefas sendo resolvidas com "stub" em vez de implementacao real
- Mismatch e perda de contexto ao longo do tempo
- Uso de memoria local controlada
- Tecnicas para agentes de longa duracao em implementacoes complexas

**Descoberta chave:** 65% das falhas de IA empresarial em 2025 foram atribuidas a context drift ou memory loss durante raciocinio multi-step.

---

## Indice

1. [O Problema Central](#1-o-problema-central)
2. [Taxonomia de Memoria para Agentes](#2-taxonomia-de-memoria-para-agentes)
3. [Arquitetura MemGPT (Memoria Hierarquica)](#3-arquitetura-memgpt-memoria-hierarquica)
4. [Context Engineering (Anthropic)](#4-context-engineering-anthropic)
5. [Compaction Estruturada](#5-compaction-estruturada)
6. [Arquiteturas Multi-Agent](#6-arquiteturas-multi-agent)
7. [Prevencao de Stubs e Implementacoes Incompletas](#7-prevencao-de-stubs-e-implementacoes-incompletas)
8. [Implementacao Pratica para ADK](#8-implementacao-pratica-para-adk)
9. [Metricas e KPIs](#9-metricas-e-kpis)
10. [Referencias e Fontes](#10-referencias-e-fontes)

---

## 1. O Problema Central

### 1.1 Sintomas Identificados

| Sintoma | Causa Raiz | Impacto |
|---------|-----------|---------|
| Codigo stub em vez de implementacao real | Context overload, agente "rushing forward" | Re-trabalho, bugs em producao |
| Agente esquece instrucoes anteriores | Context window overflow | Inconsistencia, decisoes conflitantes |
| Repeticao de erros ja corrigidos | Falta de memoria persistente | Perda de produtividade |
| Implementacao parcial de features | Attention decay em contextos longos | Features incompletas |
| Arquitetura inconsistente | Perda de decisoes arquiteturais | Divida tecnica |

### 1.2 Causas Tecnicas

#### Context Pollution
Informacao irrelevante ocupa espaco no contexto, degradando performance. RAG frequentemente insere dados irrelevantes no context window.

#### Attention Decay (Context Rot)
Performance do modelo degrada conforme token count aumenta. Pesquisa indica que apos ~4000 tokens, atencao comeca a se dispersar.

#### "Rush Forward" Behavior
Agentes treinados para minimizar esforco evitam ler arquivos e analisar estruturas existentes. Mesmo quando explicitamente fornecidos arquivos, frequentemente nao os leem.

#### Loss of Operational Details
Compressao agressiva descarta detalhes operacionais criticos:
- File paths
- API endpoints
- Condicoes de erro
- Numeros de linha

### 1.3 Estatisticas de Mercado (2025-2026)

- 65% das falhas de IA empresarial: context drift ou memory loss
- Claude Sonnet 4.5: manteve foco por mais de 30 horas em testes internos
- Modelos anteriores: drift apos 1-2 horas de trabalho continuo

---

## 2. Taxonomia de Memoria para Agentes

### 2.1 Tipos de Memoria

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMORIA DE AGENTES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EPISODICA           SEMANTICA           PROCEDURAL            │
│  ─────────           ─────────           ──────────            │
│  "O que aconteceu"   "O que eu sei"      "Como fazer"          │
│                                                                 │
│  - Eventos passados  - Fatos extraidos   - Instrucoes          │
│  - Conversas         - Relacoes          - Workflows           │
│  - Decisoes tomadas  - Patterns          - Best practices      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Duracao da Memoria

| Tipo | Duracao | Uso | Exemplo |
|------|---------|-----|---------|
| **Working Memory** | Sessao atual | Contexto imediato | Ultima tool output |
| **Short-term** | Horas | Conversacao recente | Ultimos 10 turnos |
| **Medium-term** | Dias | Summaries comprimidos | Resumo da sessao anterior |
| **Long-term** | Permanente | Fatos e patterns | Decisoes arquiteturais |

### 2.3 Diferenca: Context Window vs Memory

| Aspecto | Context Window | Memory Real |
|---------|----------------|-------------|
| Persistencia | Reset a cada sessao | Persiste cross-session |
| Capacidade | Limitada (tokens) | Potencialmente ilimitada |
| Custo | Alto (processa tudo) | Baixo (recupera sob demanda) |
| Precisao | Alta (tudo visivel) | Variavel (depende de retrieval) |

---

## 3. Arquitetura MemGPT (Memoria Hierarquica)

### 3.1 Conceito Central

MemGPT (Memory-GPT) trata context windows como recurso de memoria restrito e implementa hierarquia similar a sistemas operacionais:

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLM PROCESSOR                              │
│                    (Inferencia ativa)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: MAIN CONTEXT (In-Context) - "RAM"                      │
│  ─────────────────────────────────────────                      │
│  Capacidade: ~8-16K tokens                                      │
│  Latencia: Instantanea                                          │
│  Conteudo:                                                      │
│    - System prompt                                              │
│    - Core memories (fatos essenciais)                           │
│    - Mensagens recentes                                         │
│    - Estado atual da task                                       │
│                                                                 │
│  Caracteristica: SEMPRE acessivel durante inferencia            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ (swap via tool calls)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: RECALL MEMORY (Searchable) - "SSD"                     │
│  ─────────────────────────────────────────                      │
│  Capacidade: ~100K-1M tokens                                    │
│  Latencia: Baixa (semantic search)                              │
│  Conteudo:                                                      │
│    - Conversas recentes comprimidas                             │
│    - Tool outputs sumarizados                                   │
│    - Decisoes com timestamps                                    │
│                                                                 │
│  Caracteristica: Searchable, reconstrucao de memorias           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ (retrieval sob demanda)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: ARCHIVAL MEMORY (Long-term) - "HDD"                    │
│  ─────────────────────────────────────────                      │
│  Capacidade: Ilimitada                                          │
│  Latencia: Media (disk + index)                                 │
│  Conteudo:                                                      │
│    - Historico completo de sessoes                              │
│    - Documentos de referencia                                   │
│    - Patterns aprendidos                                        │
│    - Lessons learned                                            │
│                                                                 │
│  Caracteristica: Persistente, pode ser promovido para tiers     │
│                  superiores quando necessario                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Self-Editing Memory

O "LLM OS" move dados para dentro e fora do context window usando tool calls designadas:

```typescript
// Tools de gerenciamento de memoria
interface MemoryTools {
  // Core Memory (sempre em contexto)
  core_memory_append(key: string, value: string): void
  core_memory_replace(key: string, old: string, new_value: string): void

  // Recall Memory (searchable)
  recall_memory_search(query: string, limit: number): Memory[]
  recall_memory_insert(content: string, metadata: object): void

  // Archival Memory (long-term)
  archival_memory_search(query: string): Memory[]
  archival_memory_insert(content: string): void
}
```

### 3.3 Strategic Forgetting

MemGPT prioriza **precisao** sobre **recall**:

- Summarization estrategica: comprime sem perder detalhes criticos
- Targeted deletion: remove informacao comprovadamente irrelevante
- Evita "context pollution": muito conteudo irrelevante degrada performance

### 3.4 Resultados

- Benchmark Passkey.Retrieval: 100% accuracy com sequencias de ate 10.2M tokens
- Supera tanto RAG quanto full-context LLMs no LongBench dataset
- Permite conversas ilimitadas com LLMs de contexto finito

---

## 4. Context Engineering (Anthropic)

### 4.1 Definicao

> "Context Engineering e a pratica de curar o menor conjunto de tokens de alto sinal que o modelo ve em cada step."

Diferente de prompt engineering que foca em craftar inputs, context engineering gerencia TODOS elementos que influenciam comportamento do modelo.

### 4.2 Principio Central

> "Encontre o menor conjunto de tokens de alto sinal que maximize a probabilidade do resultado desejado."

Contexto e um recurso finito com "attention budget" que degrada conforme token count aumenta.

### 4.3 Tres Estrategias da Anthropic

#### 4.3.1 Compaction

**O que e:** Sumarizar historico de conversa quando se aproxima do limite, reiniciar com summary comprimido.

**Como implementar:**
1. Maximizar recall primeiro (capturar TUDO relevante)
2. Iterar para melhorar precision (eliminar superfluo)
3. Preservar: decisoes arquiteturais, issues nao resolvidas
4. Descartar: tool outputs redundantes, mensagens duplicadas

**Implementacao lightweight:** "Tool result clearing" - limpar outputs antigos de tools.

```typescript
interface CompactionConfig {
  maxTokens: number           // Trigger de compaction
  targetTokens: number        // Tamanho pos-compaction
  preserveKeys: string[]      // Chaves que NUNCA sao comprimidas
  summarizationPrompt: string // Template de sumarizacao
}
```

#### 4.3.2 Structured Note-Taking (Agentic Memory)

**O que e:** Agente escreve notas persistentes em memoria externa, puxadas de volta quando necessario.

**Por que funciona:** Espelha cognicao humana - nao memorizamos tudo, mantemos sistemas de indexacao externos.

**Template recomendado:**

```markdown
# SESSION_NOTES.md

## Objective
[Objetivo claro e especifico]

## Progress
- [x] Step 1: Descricao
- [x] Step 2: Descricao
- [ ] Step 3: Descricao (current)
- [ ] Step 4: Descricao

## Key Decisions
| Decision | Rationale | Timestamp |
|----------|-----------|-----------|
| Usar X em vez de Y | Performance 2x melhor | 2026-02-02 10:30 |

## Files Modified
| File | Lines | Status |
|------|-------|--------|
| src/foo.ts | 100-150 | Done |
| src/bar.ts | 200-250 | In Progress |

## Blockers & Questions
- [ ] Precisa clarificar: como tratar edge case X?

## Next Session Instructions
1. Ler este arquivo
2. Verificar status do Step 3
3. Continuar implementacao
```

#### 4.3.3 Multi-Agent Architectures

**O que e:** Delegar tasks especializadas para sub-agentes focados.

**Beneficios:**
- Cada sub-agente opera com context window limpo
- Exploracao profunda (30K+ tokens) sem poluir contexto principal
- Retorna summaries condensados (1-2K tokens)
- Separacao clara de concerns

**Arquitetura:**

```
┌─────────────────────────────────────────────────────────────────┐
│  LEAD AGENT (Orchestrator)                                      │
│  Contexto: Plano de alto nivel, status das tasks                │
│  NAO ve: Detalhes de implementacao                              │
│  Responsabilidade: Coordenar, decidir, sintetizar               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │Research │  │Implement│  │ Review  │
    │ Agent   │  │ Agent   │  │ Agent   │
    │         │  │         │  │         │
    │ ~30K    │  │ ~30K    │  │ ~30K    │
    │ tokens  │  │ tokens  │  │ tokens  │
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │
         ▼            ▼            ▼
      Summary      Summary      Summary
      (1-2K)       (1-2K)       (1-2K)
```

### 4.4 Selecao de Estrategia

| Cenario | Estrategia Recomendada |
|---------|------------------------|
| Muita interacao back-and-forth | Compaction |
| Desenvolvimento iterativo com milestones claros | Note-taking |
| Pesquisa complexa com exploracao paralela | Multi-agent |
| Tarefas longas (>30min) | Combinacao das tres |

---

## 5. Compaction Estruturada

### 5.1 O Problema com Summarization Generica

Summarization generica trata todo conteudo como igualmente comprimivel. Mas um file path pode ser EXATAMENTE o que o agente precisa para continuar trabalhando.

**Descoberta da Factory.ai:** "A maior surpresa foi o quanto estrutura importa."

### 5.2 Two-Threshold Architecture

```
Token Count
    │
    │  ┌─────────────────────────── T_max (trigger de compaction)
    │  │
    │  │   ← Zona de compressao
    │  │
    │  └─────────────────────────── T_retained (pos-compaction)
    │
    │     ← Zona de operacao normal
    │
    └────────────────────────────────────────────────────────────────
```

**Tradeoff:**
- Gap estreito: compressao frequente (mais overhead, melhor contexto recente)
- Gap largo: compressao rara (menos overhead, risco de perder informacao)

### 5.3 Template de Compaction Estruturada

```markdown
# COMPACTED_STATE.md

## 1. Session Intent (NUNCA comprimir)
[Objetivo original do usuario - preservar EXATAMENTE como foi declarado]

## 2. High-Level Timeline
| Timestamp | Action | Result |
|-----------|--------|--------|
| 10:30 | Criou interface QAResult | Success |
| 10:45 | Implementou parseQAReport | Success |
| 11:00 | Testou com report real | 2 edge cases falharam |

## 3. Artifact Trail (file paths sao CRITICOS)
| File | Operation | Lines | Content Hash |
|------|-----------|-------|--------------|
| src/commands/feature.ts | MODIFIED | 3192-3383 | abc123 |
| src/commands/feature.ts | MODIFIED | 3112-3170 | def456 |

## 4. Decisions Made (com rationale completo)
### Decision 1: Usar 3 iteracoes max para QA fix loop
- **Rationale:** Evita loops infinitos em casos onde Claude nao consegue resolver
- **Alternativas consideradas:** 5 iteracoes (muito longo), 1 iteracao (insuficiente)
- **Timestamp:** 2026-02-02 10:15

## 5. Breadcrumbs (referencias para re-fetch)
- qa-report.md: linha 14 contem "Overall Status"
- Issues seguem padrao: `#### Issue #N: description (Severity: LEVEL)`
- Arquivo de teste: tests/commands/feature-qa.test.ts

## 6. Test Results (ultimos)
```
npm run type-check: PASS
npm run build: PASS
npm test (feature.ts): 45/45 PASS
```

## 7. Pending Work (especifico, NAO vago)
- [ ] Testar parseQAReport com report que tem 0 issues
- [ ] Verificar edge case: report malformado (sem tabela)
- [ ] Adicionar extracao de "suggestion" das issues

## 8. Known Issues
- Regex pode falhar se formato do report mudar significativamente
- Nao trata reports em outros idiomas
```

### 5.4 Regras de Compaction

1. **NUNCA comprimir:**
   - File paths completos
   - Numeros de linha
   - Nomes de funcoes/variaveis
   - Comandos exatos que funcionaram
   - Mensagens de erro especificas

2. **SEMPRE comprimir:**
   - Explicacoes redundantes
   - Tool outputs ja processados
   - Tentativas falhas (manter apenas a licao)
   - Conversas de clarificacao (manter apenas a decisao)

3. **Comprimir com cuidado:**
   - Codigo (manter assinatura, comprimir implementacao)
   - Logs (manter erros, comprimir sucesso)
   - Discussoes (manter decisao final, comprimir debate)

---

## 6. Arquiteturas Multi-Agent

### 6.1 Chain of Agents (CoA)

**Problema:** Tasks complexas excedem limite de contexto de qualquer LLM individual.

**Solucao:** Cadeia de agentes onde cada um processa parte do contexto.

**Complexidade:** Reduz de O(n²) para O(nk), onde n = input tokens, k = context limit.

```
Input (100K tokens)
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent 1    │────▶│  Agent 2    │────▶│  Agent 3    │
│  (0-30K)    │     │  (30K-60K)  │     │  (60K-100K) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │
       ▼                  ▼                   ▼
   Summary 1          Summary 2           Summary 3
       │                  │                   │
       └──────────────────┼───────────────────┘
                          ▼
                  ┌─────────────┐
                  │ Synthesizer │
                  │   Agent     │
                  └─────────────┘
                          │
                          ▼
                    Final Output
```

### 6.2 Intrinsic Memory Agents (IMA)

**Conceito:** Agentes heterogeneos com memorias contextuais estruturadas.

**Componentes:**
- **Memory Controller:** Gerencia qual memoria cada agente acessa
- **Shared Memory:** Conhecimento comum entre agentes
- **Private Memory:** Conhecimento especializado por agente

### 6.3 Sub-Agent Isolation Pattern

```typescript
interface SubAgentConfig {
  role: string              // "researcher" | "implementer" | "reviewer"
  contextBudget: number     // Max tokens para este agente
  inputSummary: string      // Resumo do que precisa fazer
  outputFormat: {
    maxTokens: number       // Max tokens no retorno
    requiredFields: string[] // Campos obrigatorios no output
  }
}

// Exemplo de uso
const researchAgent: SubAgentConfig = {
  role: "researcher",
  contextBudget: 30000,
  inputSummary: "Encontrar todos os arquivos que implementam QA",
  outputFormat: {
    maxTokens: 2000,
    requiredFields: ["files_found", "patterns_identified", "recommendations"]
  }
}
```

### 6.4 Beneficios do Isolamento

| Beneficio | Descricao |
|-----------|-----------|
| **Isolamento de complexidade** | Previne poluicao de contexto cross-task |
| **Context windows limpos** | Cada task em contexto focado |
| **Paralelizacao** | Subtasks podem rodar concorrentemente |
| **Especializacao** | Diferentes system prompts ou modelos por agente |

---

## 7. Prevencao de Stubs e Implementacoes Incompletas

### 7.1 Por que Agentes Criam Stubs?

1. **Rushing forward:** Agente minimiza esforco, pula leitura de arquivos
2. **Context overload:** Muita informacao, agente "esquece" partes da task
3. **Ambiguidade:** Instrucoes nao claras sobre nivel de detalhe esperado
4. **Falta de feedback:** Sem testes, agente assume que esta tudo ok

### 7.2 Protocolo "Read Before Write"

```markdown
## MANDATORY: Read First Protocol

ANTES de escrever QUALQUER codigo:

1. **READ** o plano de implementacao:
   - .claude/plans/features/{name}/implementation-plan.md
   - Entender contexto completo

2. **READ** arquivos relacionados:
   - Listar todos os arquivos que serao modificados
   - Ler cada um completamente

3. **EXPLAIN** o que encontrou:
   - Resumir estrutura existente
   - Identificar pontos de integracao

4. **PROPOSE** mudancas:
   - Descrever o que vai fazer
   - Aguardar confirmacao

5. **IMPLEMENT** (somente apos aprovacao):
   - Codigo real, NAO stubs
   - Testes junto com implementacao
```

### 7.3 Anti-Stub Rules

Incluir em TODO prompt de implementacao:

```markdown
## Anti-Stub Rules (OBRIGATORIO)

VOCE NAO PODE:
- [ ] Criar funcoes placeholder (throw new Error('Not implemented'))
- [ ] Deixar TODO comments em lugar de codigo real
- [ ] Criar catch blocks vazios
- [ ] Retornar valores hardcoded para "testar depois"
- [ ] Pular validacao de inputs
- [ ] Implementar apenas o "happy path"

SE NAO CONSEGUIR IMPLEMENTAR COMPLETAMENTE:
1. PARE imediatamente
2. Explique o que esta bloqueando
3. Liste o que precisa para continuar
4. AGUARDE instrucoes

NUNCA assuma que "esta bom o suficiente".
```

### 7.4 Test-Driven Verification Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   1. WRITE RED TEST                                             │
│      - Teste que FALHA                                          │
│      - Escrito para o ESTADO DE SUCESSO pretendido              │
│      - NUNCA editado novamente                                  │
│                                                                 │
│                         │                                       │
│                         ▼                                       │
│                                                                 │
│   2. IMPLEMENT                                                  │
│      - Codigo real (NAO stub)                                   │
│      - Minimo necessario para passar o teste                    │
│                                                                 │
│                         │                                       │
│                         ▼                                       │
│                                                                 │
│   3. RUN TEST                                                   │
│      - Se GREEN: continuar para proximo teste                   │
│      - Se RED: voltar para step 2                               │
│                                                                 │
│                         │                                       │
│                         ▼                                       │
│                                                                 │
│   4. REFACTOR (opcional)                                        │
│      - Melhorar codigo mantendo testes GREEN                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 One File, One Step Protocol

Previne agente de "rushing forward":

```markdown
## One Step Protocol

CADA iteracao deve seguir EXATAMENTE:

1. **READ**: Ler UM arquivo especifico
2. **ANALYZE**: Explicar o que encontrou
3. **EXPLAIN**: Propor UMA mudanca
4. **EDIT**: Modificar APENAS esse arquivo
5. **VERIFY**: Rodar lint/test nesse arquivo
6. **STOP**: Aguardar aprovacao antes de continuar

VOCE NAO PODE:
- Modificar multiplos arquivos em uma iteracao
- Pular o step de READ
- Continuar sem verificacao
```

### 7.6 Verification Checklist

Antes de considerar task completa:

```markdown
## Completion Checklist

### Codigo
- [ ] Todas as funcoes tem implementacao real (nao stubs)
- [ ] Todos os branches tem tratamento (if/else, try/catch)
- [ ] Inputs sao validados
- [ ] Erros sao tratados com mensagens uteis

### Testes
- [ ] Testes existem para cada funcao publica
- [ ] Happy path testado
- [ ] Edge cases testados
- [ ] Erros testados

### Verificacao
- [ ] Type check passa: `npm run type-check`
- [ ] Lint passa: `npm run check`
- [ ] Testes passam: `npm test`
- [ ] Build funciona: `npm run build`

### Documentacao
- [ ] Funcoes complexas tem JSDoc
- [ ] README atualizado se necessario
- [ ] CHANGELOG atualizado se necessario
```

---

## 8. Implementacao Pratica para ADK

### 8.1 Nova Estrutura de Diretorios

```
.claude/plans/features/{feature-name}/
├── tasks.md                      # Tasks decompostas (existente)
├── implementation-plan.md        # Plano arquitetural (existente)
├── qa-report.md                  # Relatorio QA (existente)
│
├── memory/                       # NOVO: Sistema de memoria
│   ├── core-state.json          # TIER 1: Estado atual (sempre em contexto)
│   ├── session-notes.md         # TIER 2: Notas da sessao atual
│   ├── decisions.md             # TIER 2: Decisoes com rationale
│   ├── breadcrumbs.md           # TIER 2: Referencias para re-fetch
│   └── archive/                 # TIER 3: Sessoes anteriores
│       ├── session-001.md       # Sessao compactada
│       ├── session-002.md
│       └── lessons-learned.md   # Patterns aprendidos
│
├── checkpoints/                  # NOVO: Snapshots para recovery
│   ├── checkpoint-task-1.1.json
│   ├── checkpoint-task-1.2.json
│   └── latest.json              # Symlink para ultimo checkpoint
│
└── verification/                 # NOVO: Resultados de verificacao
    ├── test-results.json
    ├── coverage.json
    └── lint-results.json
```

### 8.2 core-state.json (Tier 1 - Sempre em Contexto)

```json
{
  "version": "1.0",
  "feature": "qa-fix-loop",
  "updatedAt": "2026-02-02T11:30:00Z",

  "currentTask": {
    "id": "1.3",
    "name": "Implementar generateFixPrompt",
    "status": "in_progress",
    "startedAt": "2026-02-02T10:30:00Z",
    "estimatedCompletion": "2026-02-02T12:00:00Z"
  },

  "taskProgress": {
    "total": 5,
    "completed": 2,
    "inProgress": 1,
    "pending": 2,
    "completedIds": ["1.1", "1.2"]
  },

  "criticalDecisions": [
    {
      "id": "dec-001",
      "decision": "Usar 3 iteracoes max para QA fix loop",
      "rationale": "Evita loops infinitos, permite revisao manual",
      "timestamp": "2026-02-02T10:15:00Z",
      "reversible": true
    },
    {
      "id": "dec-002",
      "decision": "Parsear QA report com regex em vez de markdown parser",
      "rationale": "Performance melhor, menos dependencias",
      "timestamp": "2026-02-02T10:20:00Z",
      "reversible": true
    }
  ],

  "modifiedFiles": [
    {
      "path": "src/commands/feature.ts",
      "sections": [
        {"name": "QAResult interface", "lines": "90-112"},
        {"name": "parseQAReport method", "lines": "3192-3250"},
        {"name": "executeQAWithFixes method", "lines": "3330-3383"}
      ],
      "lastModified": "2026-02-02T11:00:00Z"
    }
  ],

  "constraints": [
    "NAO criar stubs - implementar logica real",
    "NAO modificar codigo fora do escopo da task",
    "SEMPRE rodar type-check apos modificacoes",
    "SEMPRE atualizar este arquivo apos cada mudanca"
  ],

  "blockers": [],

  "nextSteps": [
    "Completar implementacao de generateFixPrompt",
    "Testar com QA report real",
    "Verificar edge cases"
  ]
}
```

### 8.3 session-notes.md (Tier 2 - Notas Estruturadas)

```markdown
# Session Notes: qa-fix-loop
**Session ID:** sess-2026-02-02-001
**Started:** 2026-02-02 10:00
**Last Update:** 2026-02-02 11:30

## Objective
Implementar fase de correcao pos-QA no autopilot com loop automatico de fixes.

## Progress Timeline

| Time | Action | Result | Notes |
|------|--------|--------|-------|
| 10:00 | Leu plano de implementacao | OK | Entendeu arquitetura |
| 10:15 | Definiu interfaces QAResult, QAIssue | OK | Linhas 90-112 |
| 10:30 | Implementou parseQAReport | OK | Linhas 3192-3250 |
| 10:45 | Implementou printQASummary | OK | Linhas 3252-3271 |
| 11:00 | Implementou generateFixPrompt | OK | Linhas 3273-3325 |
| 11:15 | Implementou executeQAWithFixes | OK | Linhas 3327-3383 |
| 11:30 | Atualizou autopilotLoop (2 locais) | OK | Linhas 3112-3170, 5257-5320 |

## Key Learnings This Session

1. **QA Report Format:** Overall Status esta na linha 14, formato: `| **Overall Status** | [emoji] **PASS/FAIL** |`

2. **Dois loops autopilot:** Existem dois metodos `autopilotLoop` - um padrao e um para parallel. Ambos precisam das mesmas modificacoes.

3. **Regex para issues:** Formato e `#### Issue #N: description (Severity: LEVEL)` seguido de `**File**: \`path:line\``

## Files Read This Session

- [x] src/commands/feature.ts (completo, 5500+ linhas)
- [x] .claude/plans/features/adk-v3-session-continuity/qa-report.md (exemplo de report)
- [x] tests/utils/task-parser.test.ts (referencia de padroes de teste)

## Commands Executed

```bash
npm run type-check  # PASS
npm run build       # PASS
npm run check       # PASS (warnings em outros arquivos)
```

## Questions/Blockers

Nenhum no momento.

## Next Session Should

1. Criar testes unitarios para parseQAReport
2. Testar integracao com feature real
3. Verificar edge cases (report vazio, malformado, etc.)
```

### 8.4 decisions.md (Tier 2 - Registro de Decisoes)

```markdown
# Decision Log: qa-fix-loop

## DEC-001: Numero maximo de iteracoes de correcao
**Date:** 2026-02-02
**Status:** Approved

### Context
O loop de correcao pos-QA precisa de um limite para evitar loops infinitos.

### Options Considered
1. **3 iteracoes** - Conservador, permite revisao manual cedo
2. **5 iteracoes** - Mais chances de resolver automaticamente
3. **Configuravel** - Usuario define via flag

### Decision
Usar **3 iteracoes** como default.

### Rationale
- Evita consumo excessivo de tokens em casos irresoluveis
- Usuario pode revisar qa-report.md e ajustar manualmente
- Futuro: pode ser tornado configuravel se necessario

### Consequences
- Positivo: Previne loops infinitos
- Negativo: Pode parar antes de resolver problemas complexos
- Mitigacao: Usuario informado para revisar report

---

## DEC-002: Estrategia de parsing do QA report
**Date:** 2026-02-02
**Status:** Approved

### Context
Precisamos extrair metricas e issues do qa-report.md.

### Options Considered
1. **Regex** - Simples, sem dependencias
2. **Markdown parser** - Mais robusto, adiciona dependencia
3. **LLM extraction** - Mais flexivel, mais lento e caro

### Decision
Usar **Regex** com fallbacks para valores default.

### Rationale
- Performance: regex e instantaneo
- Simplicidade: nao adiciona dependencias
- Fallback: se regex falhar, assume FAIL e continua

### Consequences
- Positivo: Rapido, sem dependencias
- Negativo: Pode quebrar se formato do report mudar muito
- Mitigacao: Regex escritos para serem flexiveis com whitespace
```

### 8.5 Hook de Injecao de Memoria

```bash
#!/bin/bash
# .claude/hooks/inject-memory.sh
# Hook: PreToolUse (para qualquer tool)

set -e

# Buscar feature ativa
FOCUS_FILE=".claude/active-focus.md"
if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

FEATURE=$(grep "feature:" "$FOCUS_FILE" | cut -d' ' -f2)
if [ -z "$FEATURE" ]; then
  exit 0
fi

MEMORY_PATH=".claude/plans/features/$FEATURE/memory"
CORE_STATE="$MEMORY_PATH/core-state.json"

echo "## Memory Context Injection"
echo ""

# Injetar core state se existir
if [ -f "$CORE_STATE" ]; then
  echo "### Current State (from core-state.json)"
  echo '```json'
  cat "$CORE_STATE"
  echo '```'
  echo ""
fi

# Injetar constraints
echo "### Active Constraints"
echo "- NAO criar stubs - implementar logica real"
echo "- NAO modificar codigo fora do escopo da task atual"
echo "- SEMPRE rodar type-check apos modificacoes"
echo "- SEMPRE atualizar core-state.json apos mudancas significativas"
echo ""

# Injetar anti-stub rules
echo "### Anti-Stub Protocol"
echo "- LEIA arquivos antes de modificar"
echo "- IMPLEMENTE logica real, nunca placeholders"
echo "- TESTE apos cada mudanca"
echo "- PARE e pergunte se algo nao estiver claro"
```

### 8.6 Hook de Checkpoint Automatico

```bash
#!/bin/bash
# .claude/hooks/auto-checkpoint.sh
# Hook: Stop (quando sessao termina)

set -e

FOCUS_FILE=".claude/active-focus.md"
if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

FEATURE=$(grep "feature:" "$FOCUS_FILE" | cut -d' ' -f2)
if [ -z "$FEATURE" ]; then
  exit 0
fi

MEMORY_PATH=".claude/plans/features/$FEATURE/memory"
CHECKPOINT_PATH=".claude/plans/features/$FEATURE/checkpoints"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$CHECKPOINT_PATH"

# Criar checkpoint
CHECKPOINT_FILE="$CHECKPOINT_PATH/checkpoint-$TIMESTAMP.json"

cat > "$CHECKPOINT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "feature": "$FEATURE",
  "coreState": $(cat "$MEMORY_PATH/core-state.json" 2>/dev/null || echo "null"),
  "gitStatus": "$(git status --porcelain 2>/dev/null | head -20)",
  "lastCommit": "$(git log -1 --oneline 2>/dev/null || echo 'none')"
}
EOF

# Atualizar symlink para latest
ln -sf "checkpoint-$TIMESTAMP.json" "$CHECKPOINT_PATH/latest.json"

echo "Checkpoint criado: $CHECKPOINT_FILE"
```

### 8.7 Comando ADK para Gerenciar Memoria

```typescript
// src/commands/memory.ts (extensao)

interface MemoryCommands {
  // Visualizar estado atual
  status(feature: string): void

  // Atualizar estado manualmente
  update(feature: string, key: string, value: string): void

  // Criar checkpoint
  checkpoint(feature: string, description: string): void

  // Restaurar de checkpoint
  restore(feature: string, checkpointId: string): void

  // Compactar sessao atual
  compact(feature: string): void

  // Arquivar sessao
  archive(feature: string): void
}

// Uso:
// adk memory status my-feature
// adk memory checkpoint my-feature "Completed task 1.2"
// adk memory compact my-feature
// adk memory restore my-feature checkpoint-20260202-113000
```

---

## 9. Metricas e KPIs

### 9.1 Metricas de Qualidade

| Metrica | Definicao | Target | Como Medir |
|---------|-----------|--------|------------|
| **Stub Rate** | % de tasks com codigo stub | <5% | Grep por "Not implemented", "TODO" |
| **First-Pass Success** | % de tasks que passam QA na primeira tentativa | >70% | qa-report.md status |
| **Context Drift** | Desvio do objetivo original | Minimo | Comparar output com task description |
| **Rework Rate** | % de codigo que precisa ser refeito | <15% | Git history analysis |

### 9.2 Metricas de Eficiencia

| Metrica | Definicao | Target | Como Medir |
|---------|-----------|--------|------------|
| **Tokens per Task** | Media de tokens consumidos por task | Decrescente | Log de API |
| **Sessions per Feature** | Numero de sessoes para completar feature | Decrescente | Checkpoint count |
| **Compaction Efficiency** | Ratio de compressao mantendo qualidade | >50% | Before/after token count |
| **Recovery Success** | % de sessoes que recuperam contexto com sucesso | >95% | Checkpoint restore success |

### 9.3 Metricas de Memoria

| Metrica | Definicao | Target | Como Medir |
|---------|-----------|--------|------------|
| **Core State Freshness** | Idade media do core-state.json | <5min | Timestamp comparison |
| **Decision Coverage** | % de decisoes significativas documentadas | >90% | decisions.md completeness |
| **Breadcrumb Accuracy** | % de breadcrumbs que levam ao conteudo correto | >95% | Manual sampling |

### 9.4 Dashboard de Monitoramento

```markdown
# Feature Memory Health: {feature-name}

## Current Session
- Duration: 1h 30min
- Tasks Completed: 3/5
- Tokens Used: ~45K
- Compactions: 0

## Memory Status
- Core State: Fresh (2min ago)
- Session Notes: 15 entries
- Decisions: 4 documented
- Checkpoints: 3 available

## Quality Indicators
- Stub Rate: 0%
- Test Coverage: 85%
- Lint Issues: 0

## Warnings
- None
```

---

## 10. Referencias e Fontes

### 10.1 Papers Academicos

1. **Memory in the Age of AI Agents** (Dec 2025, Updated Jan 2026)
   - Survey completo sobre memoria em agentes
   - https://arxiv.org/abs/2512.13564

2. **MemGPT: Towards LLMs as Operating Systems** (Oct 2023)
   - Arquitetura de memoria hierarquica
   - https://arxiv.org/abs/2310.08560

3. **Chain of Agents: LLMs Collaborating on Long-Context Tasks** (NeurIPS 2024)
   - Multi-agent para contextos longos
   - https://proceedings.neurips.cc/paper_files/paper/2024/file/ee71a4b14ec26710b39ee6be113d7750-Paper-Conference.pdf

4. **Human-Inspired Episodic Memory for Infinite Context** (ICLR 2025)
   - EM-LLM, 100% accuracy em 10.2M tokens
   - https://proceedings.iclr.cc/paper_files/paper/2025/file/c05144b635df16ac9bbf8246bbbd55ca-Paper-Conference.pdf

5. **Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory**
   - Sistema de memoria para producao
   - https://arxiv.org/pdf/2504.19413

### 10.2 Documentacao Oficial

1. **Anthropic: Effective Context Engineering for AI Agents**
   - Guia oficial de context engineering
   - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

2. **Anthropic: Effective Harnesses for Long-Running Agents**
   - Arquiteturas para agentes de longa duracao
   - https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

3. **OpenAI Cookbook: Context Personalization with Agents SDK**
   - Exemplo pratico de memoria persistente
   - https://cookbook.openai.com/examples/agents_sdk/context_personalization

4. **LangChain: Context Engineering for Agents**
   - Guia de context engineering
   - https://www.blog.langchain.com/context-engineering-for-agents/

### 10.3 Artigos Tecnicos

1. **Factory.ai: Compressing Context**
   - Estrategias de compressao estruturada
   - https://factory.ai/news/compressing-context

2. **Factory.ai: Evaluating Context Compression**
   - Framework de avaliacao de compressao
   - https://factory.ai/news/evaluating-compression

3. **Letta: Agent Memory Guide**
   - Como construir agentes que lembram
   - https://www.letta.com/blog/agent-memory

4. **Letta: RAG is not Agent Memory**
   - Diferencas entre RAG e memoria real
   - https://www.letta.com/blog/rag-vs-agent-memory

5. **Continue.dev: Task Decomposition**
   - Best practices para decomposicao de tasks
   - https://blog.continue.dev/task-decomposition/

### 10.4 Blog Posts e Guias

1. **Addy Osmani: My LLM Coding Workflow Going Into 2026**
   - Workflow pratico com TDD
   - https://addyosmani.com/blog/ai-coding-workflow/

2. **Augment Code: Best Practices for AI Coding Agents**
   - Guidelines para agentes de codigo
   - https://www.augmentcode.com/blog/best-practices-for-using-ai-coding-agents

3. **ByteBridge: AI Agents Context Management Breakthroughs**
   - Overview de avancos em 2025-2026
   - https://bytebridge.medium.com/ai-agents-context-management-breakthroughs-and-long-running-task-execution-d5cee32aeaa4

4. **JetBrains: Coding Guidelines for AI Agents**
   - Como criar guidelines efetivas
   - https://blog.jetbrains.com/idea/2025/05/coding-guidelines-for-your-ai-agents/

### 10.5 Ferramentas e Frameworks

1. **Letta (ex-MemGPT)** - Framework de memoria para agentes
   - https://www.letta.com/
   - https://docs.letta.com/concepts/memgpt/

2. **Mem0** - Sistema de memoria para agentes
   - https://mem0.ai/

3. **Zep** - Knowledge graph para memoria de agentes
   - https://www.getzep.com/

4. **Agent Skills for Context Engineering** (GitHub)
   - Colecao de skills para gerenciamento de contexto
   - https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering

---

## Apendice A: Glossario

| Termo | Definicao |
|-------|-----------|
| **Context Window** | Numero maximo de tokens que LLM pode processar por vez |
| **Context Rot** | Degradacao de performance conforme contexto aumenta |
| **Context Pollution** | Informacao irrelevante ocupando espaco no contexto |
| **Compaction** | Processo de comprimir contexto mantendo informacao essencial |
| **Agentic Memory** | Sistema de memoria gerenciado pelo proprio agente |
| **Episodic Memory** | Memoria de eventos e experiencias passadas |
| **Semantic Memory** | Memoria de fatos e conhecimento geral |
| **Procedural Memory** | Memoria de como fazer tarefas |
| **Breadcrumbs** | Referencias que permitem re-fetch de informacao |
| **Strategic Forgetting** | Descarte intencional de informacao irrelevante |

---

## Apendice B: Checklist de Implementacao

### Fase 1: Infraestrutura Basica
- [ ] Criar estrutura de diretorios memory/
- [ ] Implementar core-state.json schema
- [ ] Criar hook de injecao de memoria
- [ ] Criar hook de checkpoint automatico

### Fase 2: Gerenciamento de Sessao
- [ ] Implementar session-notes.md automatico
- [ ] Criar decisions.md com tracking
- [ ] Implementar breadcrumbs.md

### Fase 3: Compaction
- [ ] Criar template de compaction estruturada
- [ ] Implementar two-threshold architecture
- [ ] Testar preservacao de informacao critica

### Fase 4: Comandos ADK
- [ ] `adk memory status`
- [ ] `adk memory checkpoint`
- [ ] `adk memory compact`
- [ ] `adk memory restore`

### Fase 5: Anti-Stub Enforcement
- [ ] Implementar Read Before Write protocol
- [ ] Criar verification checklist automatico
- [ ] Integrar com QA para detectar stubs

### Fase 6: Metricas
- [ ] Implementar coleta de metricas
- [ ] Criar dashboard de monitoramento
- [ ] Setup de alertas para degradacao

---

**Documento criado em:** 2026-02-02
**Ultima atualizacao:** 2026-02-02
**Autor:** ADK Research
**Versao:** 1.0
