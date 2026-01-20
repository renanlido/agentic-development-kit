# PRD: Advanced Agentic Techniques

**Feature:** advanced-agentic-techniques
**Data:** 2026-01-14
**Status:** Draft
**Autor:** ADK Team

---

## 1. Contexto e Problema

### 1.1 Situação Atual

O ADK (Agentic Development Kit) já implementa técnicas avançadas de desenvolvimento agentic:
- Phase-gating workflow rigoroso (research → plan → implement → qa → deploy)
- TDD enforcement obrigatório
- Sistema de memória com ADRs, patterns, risks
- Context layering hierárquico (GLOBAL → FEATURE → TASK)
- Gradual deployment com feature flags
- Autopilot com 6 etapas automatizadas

### 1.2 Problemas Identificados

Baseado na análise do codebase e pesquisa de técnicas state-of-the-art de 2025-2026:

| Problema | Impacto | Gap Técnico |
|----------|---------|-------------|
| **Execução sequencial de agentes** | Features demoram mais que o necessário | Falta multi-agent parallelism |
| **Perda de contexto entre sessões** | Decisões repetidas, inconsistências | Memory não persiste adequadamente |
| **Specs criadas durante implementação** | Alto retrabalho, features mal especificadas | Falta Spec-Driven Development |
| **Pipeline de agentes hardcoded** | Inflexibilidade, overhead de contexto | Falta Tool Search dinâmico |
| **Curadoria manual de contexto** | Contexto excessivo ou insuficiente | Falta auto-compactação inteligente |

### 1.3 Evidências de Mercado (2025-2026)

Fontes pesquisadas:
- [Agentic AI, MCP, and spec-driven development - GitHub Blog](https://github.blog/developer-skills/agentic-ai-mcp-and-spec-driven-development-top-blog-posts-of-2025/)
- [Multi-agent AI workflows - InfoWorld](https://www.infoworld.com/article/4035926/multi-agent-ai-workflows-the-next-evolution-of-ai-coding.html)
- [5 Key Trends Shaping Agentic Development in 2026 - The New Stack](https://thenewstack.io/5-key-trends-shaping-agentic-development-in-2026/)
- [Best AI Coding Agents for 2026 - Faros AI](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [Prompt engineering overview - Claude Docs](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview)

**Tendências confirmadas:**
- Multi-agent parallelism com git worktrees (Claude Squad, Conductor)
- Spec-Driven Development (SDD) gerando 2-5x aumento de velocidade
- Memory persistence como top concern para 2026
- Tool Search Tool (meta-tool) para descoberta on-demand
- Role-based agent orchestration (CrewAI pattern)

---

## 2. Usuários e Personas

### 2.1 Persona Principal: Developer usando ADK

**Nome:** Dev Senior
**Contexto:** Desenvolvedor experiente que usa ADK para automatizar ciclo de desenvolvimento
**Frequência:** Diária, múltiplas features em paralelo

**Dores:**
- Espera enquanto agentes executam sequencialmente
- Precisa re-explicar contexto em novas sessões
- Features entregues diferem das expectativas
- Intervenção manual frequente no processo

**Ganhos esperados:**
- Executar múltiplas tarefas em paralelo
- Contexto preservado entre sessões
- Specs claras antes de implementar
- Menos babysitting do processo

### 2.2 Persona Secundária: Tech Lead

**Nome:** Tech Lead
**Contexto:** Coordena múltiplas features e desenvolvedores usando ADK
**Frequência:** Semanal, revisão de features

**Dores:**
- Dificuldade de rastrear decisões arquiteturais
- Inconsistência entre features similares
- Tempo gasto revisando implementações incorretas

**Ganhos esperados:**
- Histórico de decisões acessível
- Padrões reutilizados automaticamente
- Menos revisões por erros de especificação

---

## 3. Requisitos Funcionais

### RF-01: Multi-Agent Parallel Execution

**Descrição:** Permitir execução de múltiplos agentes em paralelo usando git worktrees para isolamento.

```gherkin
Funcionalidade: Execução paralela de agentes
  Como desenvolvedor
  Quero executar múltiplos agentes simultaneamente
  Para reduzir tempo total de desenvolvimento

  Cenário: Executar pipeline em paralelo
    Dado que tenho uma feature "auth-system" com tasks definidas
    Quando executo "adk agent parallel auth-system"
    Então o sistema cria worktrees isolados para cada agente
    E executa analyzer, implementer e tester em paralelo
    E merge os resultados na branch principal
    E reporta conflitos se houver

  Cenário: Limitar paralelismo
    Dado que executo "adk agent parallel auth-system --max-agents 2"
    Quando há 4 agentes para executar
    Então executa no máximo 2 agentes simultaneamente
    E aguarda conclusão antes de iniciar próximos
```

**Comandos novos:**
- `adk agent parallel <feature> [--max-agents N]`
- `adk agent status` - Ver status de agentes em execução

### RF-02: Spec-Driven Development (SDD)

**Descrição:** Workflow que exige especificações detalhadas antes de qualquer implementação.

```gherkin
Funcionalidade: Desenvolvimento guiado por especificação
  Como desenvolvedor
  Quero definir specs completas antes de implementar
  Para reduzir retrabalho e aumentar assertividade

  Cenário: Criar spec antes de implementação
    Dado que inicio "adk feature new payment-gateway"
    Quando o sistema cria a estrutura da feature
    Então gera automaticamente spec-template.md
    E bloqueia implementação até spec ser aprovada
    E valida spec contra schema definido

  Cenário: Validar spec antes de prosseguir
    Dado que tenho uma spec em ".claude/plans/features/payment/spec.md"
    Quando executo "adk feature plan payment"
    Então o sistema valida se spec contém:
      | Campo | Obrigatório |
      | Inputs/Outputs | Sim |
      | Comportamentos | Sim |
      | Edge cases | Sim |
      | Acceptance criteria | Sim |
    E bloqueia se faltar campos obrigatórios
```

**Comandos novos:**
- `adk spec create <feature>` - Criar spec interativamente
- `adk spec validate <feature>` - Validar spec contra schema
- `adk spec generate <feature>` - Gerar código a partir de spec

### RF-03: Memory Persistence System

**Descrição:** Sistema de memória que persiste decisões, padrões e contexto entre sessões.

```gherkin
Funcionalidade: Persistência de memória entre sessões
  Como desenvolvedor
  Quero que o sistema lembre decisões anteriores
  Para não repetir discussões e manter consistência

  Cenário: Salvar decisão arquitetural
    Dado que durante implementação decido usar "Repository Pattern"
    Quando a decisão é registrada
    Então persiste em ".claude/memory/decisions/repo-pattern.md"
    E inclui contexto, alternativas consideradas e rationale
    E é automaticamente carregada em features similares

  Cenário: Carregar contexto relevante
    Dado que inicio nova feature "user-management"
    Quando o sistema analisa a feature
    Então busca decisões relacionadas (auth, database, patterns)
    E carrega automaticamente no contexto do agente
    E exibe "Contexto carregado: 3 decisões, 2 padrões"

  Cenário: Compactar memória automaticamente
    Dado que memória de uma feature excede 1000 linhas
    Quando o sistema detecta o limite
    Então compacta automaticamente preservando essenciais
    E arquiva versão completa em ".claude/memory/archive/"
```

**Comandos novos:**
- `adk memory recall <query>` - Buscar memória por contexto
- `adk memory link <feature> <decision>` - Vincular decisão a feature
- `adk memory export` - Exportar base de conhecimento

### RF-04: Tool Search Tool (Dynamic Discovery)

**Descrição:** Meta-tool que permite descobrir e carregar tools sob demanda, reduzindo overhead de contexto.

```gherkin
Funcionalidade: Descoberta dinâmica de tools
  Como desenvolvedor
  Quero que agentes descubram tools necessárias dinamicamente
  Para reduzir overhead de contexto inicial

  Cenário: Carregar tool sob demanda
    Dado que um agente precisa executar testes
    Quando o agente não tem "test-runner" tool carregada
    Então consulta Tool Search com "execute tests"
    E Tool Search retorna "test-runner" como match
    E carrega tool dinamicamente
    E continua execução

  Cenário: Registrar nova tool
    Dado que crio tool customizada "security-scanner"
    Quando executo "adk tool register security-scanner"
    Então tool é indexada com metadata (nome, descrição, triggers)
    E torna-se descobrível via Tool Search
```

**Comandos novos:**
- `adk tool search <query>` - Buscar tools disponíveis
- `adk tool register <name>` - Registrar nova tool
- `adk tool list [--discoverable]` - Listar tools

---

## 4. Requisitos Não-Funcionais

### RNF-01: Performance

| Métrica | Target | Atual |
|---------|--------|-------|
| Tempo de execução paralela (3 agentes) | < 1.5x tempo de 1 agente | N/A (sequencial) |
| Tempo de carregamento de memória | < 500ms | ~200ms |
| Overhead de Tool Search | < 100ms por lookup | N/A |
| Compactação de memória | < 5s para 1000 linhas | ~10s (manual) |

### RNF-02: Backward Compatibility

- Todos os comandos existentes devem continuar funcionando
- Novos comandos são adições, não substituições
- Estrutura de arquivos existente é preservada
- Pipelines atuais funcionam sem modificação

### RNF-03: Simplicidade

- Novos comandos seguem padrão existente (`adk <command> <subcommand>`)
- Configuração mínima necessária (defaults sensatos)
- Documentação inline em cada comando (`--help`)
- Mensagens de erro claras e acionáveis

### RNF-04: Confiabilidade

- Rollback automático se merge paralelo falhar
- Validação de specs antes de prosseguir
- Memory corruption detection e recovery
- Graceful degradation se Tool Search falhar

---

## 5. Métricas de Sucesso

| Métrica | Baseline | Target | Prazo |
|---------|----------|--------|-------|
| Taxa de retrabalho (features que precisam correção) | ~30% | < 15% | Após 10 features |
| Satisfação do desenvolvedor (NPS interno) | N/A | > 8/10 | Após 1 mês de uso |
| % de tarefas automatizadas | ~60% | > 85% | Após implementação |
| Tempo médio de feature (research → deploy) | ~4h | < 2h | Após 10 features |
| Decisões repetidas entre sessões | ~20% | < 5% | Após 20 sessões |

---

## 6. Non-Goals (O que NÃO será feito)

1. **Substituir Claude Code CLI** - ADK continua sendo orquestrador, não executor
2. **Multi-model support** - Foco em Claude, não em fallback para outros LLMs
3. **GUI/Interface gráfica** - Mantemos foco em CLI
4. **Cloud sync de memória** - Memória é local por design
5. **Auto-deploy sem aprovação** - Humano sempre aprova deploy
6. **Refatoração automática de código existente** - Apenas features novas usam SDD

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Conflitos em merge paralelo | Alta | Médio | Detecção automática + fallback para sequencial |
| Memory bloat (arquivos grandes) | Média | Médio | Auto-compactação quando > 80% limite |
| Tool Search retorna tool errada | Baixa | Alto | Confidence threshold + confirmação em casos ambíguos |
| SDD adiciona overhead em features simples | Média | Baixo | Flag `--quick` para skip SDD |
| Backward compatibility quebra | Baixa | Alto | Suite de testes de regressão antes de release |
| Curva de aprendizado dos novos comandos | Média | Baixo | Documentação clara + exemplos inline |

---

## 8. Dependências Técnicas

### 8.1 Novas Dependências

| Pacote | Propósito | Justificativa |
|--------|-----------|---------------|
| `simple-git` | Operações git programáticas (worktrees) | Já usado indiretamente, formalizar |
| `fuse.js` | Fuzzy search para Tool Search | Leve, sem deps externas |
| `zod` | Validação de schemas (specs) | Type-safe, já popular no ecossistema |

### 8.2 Dependências de Infraestrutura

- Git >= 2.20 (suporte a worktrees)
- Claude Code CLI instalado
- Node.js >= 18 (já requerido)

---

## 9. Roadmap Sugerido

### Fase 1: Foundation
- Memory Persistence System (RF-03)
- Backward compatibility tests

### Fase 2: Specification
- Spec-Driven Development (RF-02)
- Spec validation schemas

### Fase 3: Discovery
- Tool Search Tool (RF-04)
- Tool registration system

### Fase 4: Parallelism
- Multi-Agent Parallel Execution (RF-01)
- Conflict resolution system

---

## 10. Referências

### Pesquisa de Mercado (2025-2026)
- [GitHub Blog - Agentic AI and Spec-Driven Development](https://github.blog/developer-skills/agentic-ai-mcp-and-spec-driven-development-top-blog-posts-of-2025/)
- [The New Stack - 5 Key Trends in Agentic Development 2026](https://thenewstack.io/5-key-trends-shaping-agentic-development-in-2026/)
- [InfoWorld - Multi-agent AI Workflows](https://www.infoworld.com/article/4035926/multi-agent-ai-workflows-the-next-evolution-of-ai-coding.html)
- [Faros AI - Best AI Coding Agents 2026](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [RedMonk - 10 Things Developers Want from Agentic IDEs](https://redmonk.com/kholterhoff/2025/12/22/10-things-developers-want-from-their-agentic-ides-in-2025/)

### Técnicas de Prompt Engineering
- [Claude Docs - Prompt Engineering Overview](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview)
- [Anthropic - Interactive Prompt Engineering Tutorial](https://github.com/anthropics/prompt-eng-interactive-tutorial)
- [IBM - 2026 Guide to Prompt Engineering](https://www.ibm.com/think/prompt-engineering)

### Frameworks de Referência
- [CrewAI - Role-based Agent Orchestration](https://www.crewai.com/)
- [LangChain - AI Agent Framework](https://www.langchain.com/)
- [Repobird - Agentic Coding Best Practices](https://repobird.ai/blogs/agentic-coding-best-practices)
