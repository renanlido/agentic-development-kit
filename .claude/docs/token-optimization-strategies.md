# Token Optimization Strategies for Agentic CLI

**Data:** 2026-02-02
**Versao:** 1.0
**Status:** Pesquisa Consolidada

---

## Sumario Executivo

Este documento consolida estrategias de otimizacao de tokens coletadas de projetos similares, pesquisa academica e best practices da industria para reducao de custos em sistemas agenticos.

**Descoberta chave:** Organizacoes relatam que 96% dos custos de IA generativa excedem expectativas em escala de producao, com bills mensais chegando a dezenas de milhoes. Token efficiency e agora concern arquitetural de primeira classe.

---

## 1. O Problema do Token Burn em 2026

### 1.1 A Crise de Tokens

Enquanto precos de tokens caiu 280x em 2 anos (Deloitte), bills de empresas estao subindo devido a:
- Reasoning models com multi-step thinking
- Multi-agent loops
- Context acumulativo em workflows longos

> "Token prices have plummeted 280-fold in two years, but enterprise bills are skyrocketing."
> — Deloitte AI Insights 2026

### 1.2 Metricas Relevantes

| Metrica | O que mede | Uso |
|---------|-----------|-----|
| **CPT (Cost Per Task)** | Custo total por task completada | ROI real |
| **Tokens per Task** | Tokens consumidos por task | Eficiencia |
| **Dollar per Decision** | Custo por decisao autonoma | Valor de negocio |

---

## 2. Estrategias de Reducao de Tokens

### 2.1 Prompt Caching

**Impacto:** Ate 80% reducao de latencia, 90% economia de input tokens.

**Implementacao:**
```text
1. Identificar prompts estaticos (system prompts, instrucoes)
2. Cachear em storage persistente
3. Reutilizar em sessoes subsequentes
```

**Tecnicas:**
- **Static Prompt Caching:** Cache de system prompts entre sessoes
- **Response Caching:** Cache de respostas para queries repetidas
- **Plan Caching:** Cache de planos de execucao bem-sucedidos

> "OpenAI's Prompt Caching documents up to 80% latency reduction and up to 90% input token savings."

### 2.2 Model Tiering (Routing)

**Impacto:** 90-97% reducao de custos em decisoes rotineiras.

**Estrategia:**

| Tier | Model | Uso | Custo |
|------|-------|-----|-------|
| **Nano** | gpt-4.1-nano, Haiku | Classificacao, titulos | ~$0.10/1M |
| **Mid** | Claude Sonnet, GPT-4o | Coding, analise | ~$3/1M |
| **Heavy** | Claude Opus, GPT-4-turbo | Arquitetura, decisoes complexas | ~$15/1M |

**Regra:** "Need a conversation title or simple classification? Hand it off to a cheap, fast model."

**Exemplo ADK:**
```typescript
interface ModelRouter {
  selectModel(task: TaskType): Model {
    switch(task.complexity) {
      case 'trivial': return 'haiku'      // Titulos, classificacao
      case 'standard': return 'sonnet'    // Implementacao
      case 'complex': return 'opus'       // Arquitetura
    }
  }
}
```

### 2.3 Context Engineering

**Principio:** "Find the smallest set of high-signal tokens that maximize the likelihood of desired outcome."

**Tecnicas:**

1. **Minimal Viable Context**
   - Carregar apenas tokens necessarios para task atual
   - Usar referencias (file paths) em vez de conteudo completo
   - Progressive disclosure: revelar contexto incrementalmente

2. **System Prompt Optimization**
   - Linguagem clara e direta
   - Evitar logica excessivamente prescritiva
   - Organizar em secoes distintas (XML tags, Markdown headers)
   - Comecar minimo, adicionar apenas quando testes falham

3. **Tool Design Efficiency**
   - Minimizar overlap entre tools
   - Retornar informacao token-efficient
   - Parametros descritivos mas concisos

### 2.4 Just-In-Time Retrieval

**Estrategia:** Carregar dados dinamicamente durante execucao usando identificadores leves.

```text
ANTES (Token Intensive):
- Pre-carregar todos os arquivos relevantes
- Manter tudo em contexto "por precaucao"

DEPOIS (Token Efficient):
- Manter apenas file paths e queries
- Carregar sob demanda quando necessario
- Descartar apos uso
```

**Implementacao ADK:**
```typescript
interface JITLoader {
  breadcrumbs: Map<string, FileReference>  // Apenas referencias

  async loadWhenNeeded(ref: FileReference): Promise<Content> {
    // Carrega apenas quando agente precisa
    return this.readFile(ref.path, ref.lines)
  }
}
```

---

## 3. Context Compression Strategies

### 3.1 Two-Threshold Architecture

**Conceito (Factory.ai):**

```text
Token Count
    │
    │  ┌─────────────────── Tmax (80%) - Trigger compression
    │  │   ← Compression zone
    │  └─────────────────── Tretained (50%) - Post-compression target
    │     ← Normal operation zone
```

**Regras:**
- Quando atinge Tmax (80%), inicia compressao
- Comprimir ate Tretained (50%)
- Manter buffer de 20-30% para operacao normal

### 3.2 Structured Summarization

**O que PRESERVAR:**

| Item | Por que | Exemplo |
|------|---------|---------|
| Session Intent | Objetivo original | "Implementar autenticacao JWT" |
| File Paths | Re-fetch rapido | `src/auth/login.ts:45-60` |
| Artifact Trail | Rastreabilidade | "Modified: auth.ts, user.ts" |
| Decisions | Consistencia | "Usar bcrypt para hash" |
| Breadcrumbs | Navegacao | "Pattern em utils/hash.ts:12" |

**O que COMPRIMIR:**

| Item | Por que | Acao |
|------|---------|------|
| Explanations | Redundancia | Resumir em 1-2 linhas |
| Tool Outputs | Processado | Manter apenas resultado |
| Failed Attempts | Historico | Manter apenas licao |
| Conversations | Clarificacao | Manter apenas decisao final |

### 3.3 Incremental Summarization

**Tecnica (Factory.ai):**

```text
Em vez de regenerar summary completo:
1. Manter summary persistente
2. Atualizar incrementalmente quando mensagens sao truncadas
3. Ancorar cada update em mensagem especifica
```

**Beneficio:** Evita custo de re-summarization a cada threshold.

### 3.4 Observation Masking vs LLM Summarization

**Pesquisa (JetBrains):**

| Tecnica | Como funciona | Trade-off |
|---------|---------------|-----------|
| **Observation Masking** | Substitui observacoes antigas por placeholders | Rapido, perde detalhes |
| **LLM Summarization** | Modelo comprime interacoes em resumos | Preserva mais, mais caro |
| **Hybrid** | Combina ambos | 7-11% reducao de custo + 2.6% mais sucesso |

**Implementacao Hybrid:**
```text
1. Manter reasoning e actions intactos
2. Mascarar observacoes fora de window fixa
3. Usar summarizer para interacoes mais antigas
4. Nao alterar turns mais recentes
```

---

## 4. Multi-Agent Token Optimization

### 4.1 Delegation Framework

**Tres Tiers de Delegacao:**

| Tier | O que delegar | Token Impact |
|------|---------------|--------------|
| **Full Delegate** | Boilerplate, CRUD, testes | Baixo (modelo simples) |
| **Checkpoint** | Interfaces, APIs | Medio (revisao humana) |
| **Reserve Human** | Arquitetura | Alto (evita re-trabalho) |

### 4.2 Plan-and-Execute Pattern

**Impacto:** Ate 90% reducao de custo vs usar frontier models para tudo.

```text
┌─────────────────────────────────────────────────────────────────┐
│  PLANNER (Opus/GPT-4)                                           │
│  - Cria estrategia high-level                                   │
│  - Divide em sub-tasks                                          │
│  - Define acceptance criteria                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┬─────────────────┐
    ▼                 ▼                 ▼                 ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│Executor │     │Executor │     │Executor │     │Executor │
│(Sonnet) │     │(Sonnet) │     │(Sonnet) │     │(Sonnet) │
│Task 1   │     │Task 2   │     │Task 3   │     │Task 4   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### 4.3 Sub-Agent Summarization

**Regra (Anthropic):** Sub-agentes retornam summaries condensados (1,000-2,000 tokens) em vez de raw exploration data.

```typescript
interface SubAgentResult {
  summary: string         // 1-2K tokens max
  keyFindings: string[]   // Lista de descobertas
  filesModified: string[] // Apenas paths
  decision: string        // Decisao tomada
}
```

---

## 5. MCP e Tool Optimization

### 5.1 Tool Search Feature

**Impacto:** 85% reducao de uso de tokens mantendo acesso a todas as tools.

**Antes:**
- Todas as tool definitions carregadas em system prompt
- 51K tokens de contexto inicial

**Depois (Tool Search):**
- Tool definitions carregadas sob demanda
- 8.5K tokens de contexto inicial
- 46.9% reducao de bloat

**Configuracao:**
```bash
# Ativar tool search com threshold baixo
ENABLE_TOOL_SEARCH=auto:<N>
```

### 5.2 MCP Server Management

**Estrategia:**
1. Monitorar consumo de contexto por MCP server (`/context`)
2. Desabilitar servers nao necessarios para task atual
3. Especialmente valioso proximo de limites de contexto

---

## 6. Claude Code Specific Optimizations

### 6.1 Comandos Essenciais

| Comando | Quando usar | Impacto |
|---------|-------------|---------|
| `/clear` | Entre tasks | Fresh start, evita acumulacao |
| `/compact` | 70% capacity | Reduz 40-60% tokens |
| `/context` | Monitoramento | Ver uso atual |
| `/usage` | Diario | Totais do dia |

### 6.2 CLAUDE.md Optimization

**Problema:** CLAUDE.md carregado em toda sessao, mesmo para tasks nao relacionadas.

**Solucao:**
```text
1. Manter CLAUDE.md < 500 linhas
2. Mover instrucoes especializadas para skills
3. Usar @imports seletivamente
```

### 6.3 Regra 70-80%

> "You should `/compact` immediately at 70% capacity, not 'after this feature'."

**Motivo:** Degradacao nao-linear. 72%→89% acontece mais rapido que 40%→72%.

---

## 7. Infrastructure Optimizations

### 7.1 Spot Instances

**Impacto:** Ate 90% economia vs on-demand.

```text
K8s Workloads em Spot Instances:
- Savings: 60-90%
- Trade-off: Volatilidade
- Mitigacao: Graceful handling de interrupcoes
```

### 7.2 Batch Processing

**Estrategia:**
```text
1. Agrupar requests similares
2. Batch onde possivel
3. Processar em off-peak hours
```

### 7.3 Framework Integration

**Frameworks recomendados para 2026:**

| Framework | Uso | Beneficio |
|-----------|-----|-----------|
| **LiteLLM** | Routing | Switch facil entre modelos |
| **Modal** | Compute | Serverless eficiente |
| **DeepSeek** | Logic | 30x mais barato que GPT-4 |

---

## 8. Metricas de Eficiencia

### 8.1 Token Efficiency Ratio

```text
Token Efficiency = Useful Output / Tokens Consumed

Target: Crescente ao longo do tempo
Medida: Por task, por sessao, por feature
```

### 8.2 Cost Per Task (CPT)

```text
CPT = Total Tokens × Token Price + Compute Cost
            Task Completions

Target: Decrescente
Benchmark: Compare com baseline manual
```

### 8.3 Context Utilization

```text
Context Utilization = Tokens Ativamente Usados / Tokens em Contexto

Target: > 70%
Problema: < 50% indica context bloat
```

---

## 9. Implementacao ADK Recomendada

### 9.1 Quick Wins (Implementar Primeiro)

1. **CLAUDE.md Diet:** Reduzir para < 500 linhas
2. **Compaction Automatica:** Trigger em 70%
3. **Clear entre Tasks:** Checkpoint + clear entre features
4. **Model Routing:** Haiku para tasks triviais

### 9.2 Medium Term

1. **Tool Search:** Habilitar para MCP servers
2. **Structured Summarization:** Two-threshold architecture
3. **JIT Loading:** Breadcrumbs + lazy load

### 9.3 Long Term

1. **Plan Caching:** Reutilizar planos bem-sucedidos
2. **Multi-Model Pipeline:** Planner (Opus) + Executors (Sonnet/Haiku)
3. **Active Memory Management:** Self-directed compression

---

## 10. Checklist de Otimizacao

### Pre-Sessao
- [ ] CLAUDE.md < 500 linhas
- [ ] MCP servers desnecessarios desabilitados
- [ ] Tool Search habilitado

### Durante Sessao
- [ ] Monitorar context % no status bar
- [ ] Compactar em 70%
- [ ] Usar breadcrumbs em vez de conteudo completo

### Entre Tasks
- [ ] Criar checkpoint
- [ ] Clear context
- [ ] Validar que estado foi preservado

### Por Feature
- [ ] Medir tokens total
- [ ] Calcular CPT
- [ ] Comparar com baseline

---

## 11. Referencias

### Artigos e Documentacao

1. [Anthropic: Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
2. [Factory.ai: Compressing Context](https://factory.ai/news/compressing-context)
3. [Factory.ai: Evaluating Compression](https://factory.ai/news/evaluating-compression)
4. [JetBrains: Smarter Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
5. [Google ADK: Context Compaction](https://google.github.io/adk-docs/context/compaction/)
6. [FlowHunt: Context Engineering for AI Agents](https://www.flowhunt.io/blog/context-engineering-ai-agents-token-optimization/)
7. [Tetrate: MCP Token Optimization](https://tetrate.io/learn/ai/mcp/token-optimization-strategies)

### Claude Code Specific

8. [Claude Code Context Management](https://claudefa.st/blog/guide/mechanics/context-management)
9. [Claude Code Token Management Guide](https://richardporter.dev/blog/claude-code-token-management)
10. [Claude Code MCP Context Reduction](https://medium.com/@joe.njenga/claude-code-just-cut-mcp-context-bloat-by-46-9)
11. [Claude Code Optimization Gist](https://gist.github.com/johnlindquist/849b813e76039a908d962b2f0923dc9a)
12. [Claude Docs: Context Windows](https://docs.claude.com/en/docs/build-with-claude/context-windows)

### Multi-Agent e Custo

13. [Medium: 2026 Agentic AI Stack](https://medium.com/@ap3617180/the-2026-agentic-ai-stack-stop-your-token-burn-with-deepseek-modal-and-plan-caching)
14. [DataRobot: Cut Agentic AI Costs](https://www.datarobot.com/blog/cut-agentic-ai-development-costs/)
15. [CIO: AI Agent Budgets 2026](https://www.cio.com/article/4099548/how-to-get-ai-agent-budgets-right-in-2026.html)
16. [PromptEngineering: 2026 Playbook](https://promptengineering.org/agents-at-work-the-2026-playbook-for-building-reliable-agentic-workflows/)

### Pesquisa Academica

17. [ACON: Context Compression for LLM Agents](https://arxiv.org/html/2510.00615v1)
18. [MemGPT: LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
19. [Active Context Compression](https://arxiv.org/html/2601.07190)
20. [Letta: Agent Memory](https://www.letta.com/blog/agent-memory)

---

*Documento consolidado de pesquisa de otimizacao de tokens.*
*Ultima atualizacao: 2026-02-02*
