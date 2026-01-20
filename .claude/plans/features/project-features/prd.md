# PRD: project-features

**Data:** 2026-01-20
**Status:** Draft
**Autor:** ADK Analysis Agent

---

## 1. Problema

O ADK (Agentic Development Kit) evoluiu organicamente e agora possui:

**Problemas de Consistencia:**
- Comando `report` parcialmente implementado (TODO no codigo)
- Sobreposicao funcional entre comandos de memoria (`save` vs `update`)
- Tres arquivos de configuracao separados (`.adk/config.json`, `.env`, `.claude/settings.json`)
- Multiplas formas de executar agents sem diretrizes claras de quando usar cada uma

**Gaps Tecnicos vs Melhores Praticas 2026:**
- Memoria estatica vs padrao emergente de Agentic RAG (retrieval dinamico)
- Ausencia de roteamento de modelos heterogeneos (usar modelo certo para cada fase)
- Falta de revisao AI-on-AI (segunda camada de validacao)
- Context engineering primitivo vs gestao de contexto em camadas
- Sem framework de resiliencia para degradacao cognitiva (CDR)
- Metricas de qualidade binarias (pass/fail) vs scoring de risco

**Documentacao:**
- README.md existente cobre comandos mas omite arquitetura interna
- Falta documentacao de como estender o sistema (novos providers, agents, skills)
- Exemplos praticos limitados de workflows completos

---

## 2. Solucao Proposta

### 2.1 Remocao de Dualidades

1. **Consolidar comandos de memoria**
   - Manter `memory save <feature>` para feature-specific
   - Renomear `memory update` para `memory sync` (clareza de proposito)
   - Adicionar `memory status` para visao geral

2. **Implementar comando `report`**
   - Completar implementacao atualmente em TODO
   - Gerar relatorios semanais automaticamente
   - Integrar com dados de `progress.json`

3. **Unificar configuracao**
   - Manter `.adk/config.json` como fonte principal
   - Manter `.env` apenas para secrets (padrao)
   - Migrar hooks config de `settings.json` para `.adk/config.json`

### 2.2 Melhorias Tecnicas (Alinhamento 2026)

1. **Agentic RAG**
   - Retrieval dinamico de contexto baseado na task atual
   - Reflexao: agent avalia se contexto recuperado e suficiente
   - Cache inteligente de contextos frequentes

2. **Roteamento de Modelos**
   - Research/Planning: Claude Opus 4.5 (raciocinio complexo)
   - Implementation: Claude Sonnet (coding tasks)
   - Validation: Claude Haiku (eficiencia)

3. **AI-on-AI Review**
   - Segundo modelo revisa codigo gerado pelo primeiro
   - Multi-model review para maior cobertura
   - Feedback loop automatico

4. **Context Engineering Avancado**
   - Camadas de contexto: Architecture > Feature > Phase > Session
   - Compressao inteligente com preservacao de decisoes
   - Metricas de qualidade de contexto

5. **Cognitive Degradation Resilience (CDR)**
   - Health probes para detectar anomalias
   - Token pressure guards
   - Fallback logic com templates validados
   - Recovery checkpoints por fase

6. **Quality Gates com Scoring**
   - Risk scoring (probabilidade de issues em producao)
   - Debt tracking (atalhos tomados)
   - Confidence scoring (quao confiante o agent esta)

### 2.3 Documentacao Completa

1. **README.md atualizado** com:
   - Arquitetura interna explicada
   - Fluxos de trabalho completos
   - Guias de extensibilidade
   - Troubleshooting

---

## 3. Requisitos Funcionais

### Consolidacao

- **RF01:** Renomear `adk memory update` para `adk memory sync` mantendo backward compatibility via alias
- **RF02:** Implementar `adk memory status` que mostra overview de todas memorias do projeto
- **RF03:** Implementar `adk report --weekly` gerando relatorio em `.claude/reports/`
- **RF04:** Implementar `adk report --feature <name>` gerando relatorio especifico
- **RF05:** Migrar configuracao de hooks de `.claude/settings.json` para `.adk/config.json`

### Agentic RAG

- **RF06:** Adicionar funcao `dynamicContextRetrieval(task)` em `memory-utils.ts`
- **RF07:** Implementar reflection pattern: agent valida contexto antes de prosseguir
- **RF08:** Criar cache de contexto com TTL configuravel em `.adk/config.json`

### Roteamento de Modelos

- **RF09:** Adicionar campo `modelOverride` em `.adk/config.json` por fase
- **RF10:** Implementar roteamento automatico baseado na fase atual
- **RF11:** Manter override manual via flag `--model <model>`

### AI-on-AI Review

- **RF12:** Criar agent `reviewer-secondary.md` para revisao cruzada
- **RF13:** Integrar revisao secundaria no workflow de QA automaticamente
- **RF14:** Gerar diff de findings entre revisores

### Context Engineering

- **RF15:** Implementar 4 niveis de memoria: Project > Feature > Phase > Session
- **RF16:** Auto-compressao quando memoria excede 800 linhas (warning level)
- **RF17:** Metricas de contexto: freshness, relevance score, usage count

### CDR (Resiliencia)

- **RF18:** Implementar health probes que monitoram tempo de execucao por fase
- **RF19:** Criar warning quando token count excede 80% do limite
- **RF20:** Implementar retry com backoff exponencial (3 tentativas max)
- **RF21:** Criar fallback para templates validados quando agent falha
- **RF22:** Recovery checkpoints automaticos a cada transicao de fase

### Quality Gates

- **RF23:** Adicionar risk score (0-100) no output de QA
- **RF24:** Implementar debt tracking que registra shortcuts tomados
- **RF25:** Adicionar confidence score (0-100) que agent reporta
- **RF26:** QA gate falha automaticamente se risk score > 70

---

## 4. Requisitos Nao-Funcionais

### Performance

- **RNF01:** Retrieval de contexto deve completar em < 500ms
- **RNF02:** Roteamento de modelo nao deve adicionar > 50ms de latencia
- **RNF03:** Health probes executam a cada 30s durante operacoes longas

### Seguranca

- **RNF04:** Tokens de API permanecem exclusivamente em `.env`
- **RNF05:** Logs nao devem conter tokens ou secrets
- **RNF06:** Fallback templates sao read-only (nao podem ser modificados por agents)

### Usabilidade

- **RNF07:** Novos comandos seguem padrao existente de UX (spinner + logger)
- **RNF08:** Backward compatibility para comandos renomeados (aliases)
- **RNF09:** Mensagens de erro incluem sugestao de correcao

### Manutenibilidade

- **RNF10:** Coverage de testes >= 80% para novas funcionalidades
- **RNF11:** Documentacao inline para funcoes publicas
- **RNF12:** Tipos TypeScript para todas interfaces novas

---

## 5. User Stories

### US01: Desenvolvedor Quer Visao Geral de Memoria

**Como** desenvolvedor
**Quero** ver status de todas memorias do projeto
**Para** entender o estado atual do conhecimento armazenado

**Criterios de Aceitacao:**
- [ ] Comando `adk memory status` lista todas memorias
- [ ] Mostra contagem de linhas de cada memoria
- [ ] Indica memorias proximas do limite (warning)
- [ ] Mostra ultima atualizacao de cada memoria

### US02: Desenvolvedor Precisa de Relatorio Semanal

**Como** desenvolvedor
**Quero** gerar relatorio semanal automaticamente
**Para** ter visibilidade do progresso do projeto

**Criterios de Aceitacao:**
- [ ] `adk report --weekly` gera relatorio em markdown
- [ ] Relatorio inclui features trabalhadas na semana
- [ ] Inclui metricas de commits, linhas alteradas
- [ ] Salva em `.claude/reports/weekly-YYYY-MM-DD.md`

### US03: Desenvolvedor Quer Contexto Relevante Automaticamente

**Como** desenvolvedor
**Quero** que o agent recupere contexto relevante automaticamente
**Para** nao precisar especificar manualmente qual contexto usar

**Criterios de Aceitacao:**
- [ ] Durante research, agent busca arquitetura relevante
- [ ] Durante planning, agent busca decisoes anteriores similares
- [ ] Durante implementation, agent busca patterns existentes
- [ ] Agent reporta quais contextos foram usados

### US04: Desenvolvedor Quer Usar Modelo Certo para Cada Fase

**Como** desenvolvedor
**Quero** que o modelo apropriado seja usado em cada fase
**Para** otimizar custo e qualidade

**Criterios de Aceitacao:**
- [ ] Research usa modelo de raciocinio (Opus)
- [ ] Implementation usa modelo de coding (Sonnet)
- [ ] Validation usa modelo eficiente (Haiku)
- [ ] Pode override via `--model` flag

### US05: Desenvolvedor Quer Revisao de Codigo Automatica

**Como** desenvolvedor
**Quero** revisao automatica de codigo por segundo modelo
**Para** ter maior confianca na qualidade

**Criterios de Aceitacao:**
- [ ] Durante QA, segundo modelo revisa codigo
- [ ] Findings sao consolidados em um relatorio
- [ ] Conflitos entre revisores sao destacados
- [ ] Risk score e atualizado baseado nos findings

### US06: Desenvolvedor Quer Resiliencia em Falhas

**Como** desenvolvedor
**Quero** que falhas sejam recuperadas automaticamente
**Para** nao perder trabalho e continuar de onde parou

**Criterios de Aceitacao:**
- [ ] Falha em fase retenta automaticamente (3x max)
- [ ] Estado e salvo antes de cada fase (checkpoint)
- [ ] Se agent falha 3x, fallback para template validado
- [ ] Mensagem clara de recuperacao e exibida

### US07: Desenvolvedor Quer Metricas de Qualidade

**Como** desenvolvedor
**Quero** metricas alem de pass/fail
**Para** tomar decisoes informadas sobre deploy

**Criterios de Aceitacao:**
- [ ] QA report inclui risk score (0-100)
- [ ] QA report inclui confidence score (0-100)
- [ ] Historico de debt e mantido
- [ ] Gate falha automaticamente se risk > 70

### US08: Desenvolvedor Quer Documentacao Completa

**Como** desenvolvedor
**Quero** entender a arquitetura interna do ADK
**Para** poder estender e customizar o sistema

**Criterios de Aceitacao:**
- [ ] README inclui diagrama de arquitetura
- [ ] README explica como criar novos agents
- [ ] README explica como criar novos providers
- [ ] Troubleshooting para problemas comuns

---

## 6. Escopo

### Incluido

**Consolidacao:**
- Rename `memory update` para `memory sync`
- Novo comando `memory status`
- Implementacao completa de `report`
- Migracao de config de hooks

**Agentic RAG:**
- Dynamic context retrieval
- Reflection pattern
- Context cache

**Model Routing:**
- Configuracao por fase
- Roteamento automatico
- Override manual

**AI-on-AI Review:**
- Secondary reviewer agent
- Integracao no QA workflow
- Findings consolidation

**Context Engineering:**
- Hierarquia de 4 niveis
- Auto-compressao
- Metricas de contexto

**CDR (Resiliencia):**
- Health probes
- Token pressure guards
- Retry com backoff
- Fallback templates
- Recovery checkpoints

**Quality Gates:**
- Risk scoring
- Debt tracking
- Confidence scoring

**Documentacao:**
- README.md completo atualizado
- Improvement report

### Excluido (Out of Scope)

- Novos providers de project management (apenas ClickUp existente)
- Interface grafica (CLI only)
- Integracao com IDEs (VS Code, JetBrains)
- Telemetria/analytics para Anthropic
- Multi-tenancy/workspace sharing
- Autenticacao/autorizacao de usuarios
- Deploy automatico (apenas preparacao)
- Internationalizacao (i18n)

---

## 7. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Roteamento de modelo aumenta custos | Medio | Configuracao permite desabilitar; default usa Sonnet para tudo |
| Retry automatico pode causar loops | Alto | Limite de 3 tentativas; fallback para template |
| Context cache pode ficar stale | Medio | TTL configuravel; invalidacao em mudancas de fase |
| Secondary reviewer diverge do primary | Baixo | Merge inteligente de findings; human review final |
| Recovery checkpoints ocupam muito espaco | Baixo | Limite de 5 checkpoints; auto-cleanup de antigos |
| Backward compatibility de rename | Medio | Alias permanente de `update` para `sync` |
| Performance de health probes | Baixo | Async execution; nao bloqueia operacao principal |
| Complexidade de 4 niveis de memoria | Medio | Documentacao clara; migracao gradual |

---

## 8. Metricas de Sucesso

### Consolidacao
- **Metrica 1:** 0 comandos duplicados/sobrepostos
- **Metrica 2:** 100% dos comandos documentados no README

### Agentic RAG
- **Metrica 3:** Contexto relevante encontrado em >= 80% dos casos
- **Metrica 4:** Reducao de 30% em prompts adicionais de contexto

### Model Routing
- **Metrica 5:** Reducao de 25% no custo total de API
- **Metrica 6:** Melhoria de 15% em qualidade de research (medido por PRD completeness)

### AI-on-AI Review
- **Metrica 7:** Aumento de 20% em bugs encontrados pre-deploy
- **Metrica 8:** Reducao de 15% em defects em producao

### CDR
- **Metrica 9:** Taxa de recuperacao de falhas >= 80%
- **Metrica 10:** Zero dados perdidos por falha de agent

### Quality Gates
- **Metrica 11:** Risk score correlaciona >= 70% com defects reais
- **Metrica 12:** Confidence score correlaciona >= 60% com code review humano

---

## 9. Dependencias

### Internas
- Sistema de memoria existente (`memory-utils.ts`)
- Progress tracking (`progress.ts`)
- Claude CLI integration (`claude.ts`)
- Provider system (`src/providers/`)

### Externas
- Claude API (Opus, Sonnet, Haiku)
- Git (worktrees, branches)
- Node.js >= 18

### Bibliotecas (Existentes)
- Commander.js (CLI)
- Inquirer (prompts)
- Ora (spinners)
- Chalk (colors)
- fs-extra (filesystem)
- Zod (validation)
- fuse.js (fuzzy search)

### Novas Dependencias Necessarias
- Nenhuma (usar bibliotecas existentes)

---

## 10. Timeline (Sugestao)

### Fase 1: Consolidacao (Semana 1-2)
- Implementar `memory status`
- Rename `memory update` para `memory sync` com alias
- Implementar `report --weekly` e `report --feature`
- Migrar hooks config

### Fase 2: Context Engineering (Semana 3-4)
- Implementar hierarquia de 4 niveis de memoria
- Auto-compressao de memoria
- Metricas de contexto

### Fase 3: Agentic RAG (Semana 5-6)
- Dynamic context retrieval
- Reflection pattern
- Context cache com TTL

### Fase 4: Model Routing (Semana 7)
- Configuracao por fase
- Roteamento automatico
- Override via flag

### Fase 5: CDR - Resiliencia (Semana 8-9)
- Health probes
- Retry com backoff
- Fallback templates
- Recovery checkpoints

### Fase 6: AI-on-AI Review (Semana 10)
- Secondary reviewer agent
- Integracao no QA
- Findings consolidation

### Fase 7: Quality Gates (Semana 11)
- Risk scoring
- Debt tracking
- Confidence scoring

### Fase 8: Documentacao (Semana 12)
- README.md completo
- Guias de extensibilidade
- Troubleshooting

---

## 11. Analise de Dualidades Encontradas

### 11.1 Dualidades Confirmadas

| Item | Descricao | Acao Recomendada |
|------|-----------|------------------|
| `memory update` vs `memory save` | Sobreposicao de proposito | Rename `update` para `sync`; manter `save` para feature-specific |
| Comando `report` incompleto | TODO no codigo | Implementar completamente |
| 3 arquivos de config | Split de responsabilidade | Manter, mas documentar claramente |
| Pipeline vs Parallel agents | Duas formas de multi-agent | Manter ambos, documentar casos de uso |
| `feature implement` vs `autopilot` | Manual vs automatico | Manter ambos, sao complementares |

### 11.2 Falsos Positivos (Nao Sao Dualidades)

| Item | Motivo |
|------|--------|
| Skills directory "vazio" | Na verdade esta populado (verificado via Glob) |
| Path utilities duplicados | `git-paths.ts` e `paths.ts` tem propositos diferentes |
| Spec validation em multiplos lugares | Defesa em profundidade, nao duplicacao |

### 11.3 Inconsistencias de Nomenclatura

| Atual | Sugestao | Motivo |
|-------|----------|--------|
| `implementation-plan.md` | `plan.md` | Simplificar (ja esta na pasta features) |
| `qa-report.md` | `qa.md` | Consistencia com outros arquivos |
| `progress.json` | Manter | JSON e apropriado para dados estruturados |

---

## 12. Gaps vs Melhores Praticas 2026

### 12.1 Multi-Agent Orchestration

| Melhor Pratica | ADK Atual | Gap |
|----------------|-----------|-----|
| Supervisor pattern | Implementado (pipeline) | Nenhum |
| Adaptive network | Nao implementado | Baixa prioridade |
| Heterogeneous models | Nao implementado | **Alta prioridade** |

### 12.2 Context Engineering

| Melhor Pratica | ADK Atual | Gap |
|----------------|-----------|-----|
| Tiered context | Dois niveis (project, feature) | **Implementar 4 niveis** |
| Intelligent compression | Warning quando excede limite | **Auto-compressao** |
| Context lifecycle | Basico | **Metricas de freshness** |

### 12.3 Agentic RAG

| Melhor Pratica | ADK Atual | Gap |
|----------------|-----------|-----|
| Dynamic retrieval | Static (le arquivos fixos) | **Alta prioridade** |
| Reflection pattern | Nao implementado | **Alta prioridade** |
| Multi-agent retrieval | Nao implementado | Baixa prioridade |

### 12.4 Error Recovery

| Melhor Pratica | ADK Atual | Gap |
|----------------|-----------|-----|
| Health probes | Nao implementado | **Media prioridade** |
| Token pressure guards | Nao implementado | **Media prioridade** |
| Fallback logic | Basico (phase gates) | **Melhorar** |
| Instant rollback | Via git | Nenhum |

### 12.5 Quality Automation

| Melhor Pratica | ADK Atual | Gap |
|----------------|-----------|-----|
| AI-on-AI review | Nao implementado | **Alta prioridade** |
| Risk scoring | Binario (pass/fail) | **Implementar** |
| Confidence scoring | Nao implementado | **Implementar** |
| Debt tracking | Nao implementado | **Baixa prioridade** |

---

## 13. Arquivos a Criar/Modificar

### Novos Arquivos

```
src/
  utils/
    dynamic-context.ts     # Agentic RAG retrieval
    model-router.ts        # Roteamento de modelos
    health-probes.ts       # CDR health monitoring
    recovery.ts            # Checkpoints e recovery
    quality-scorer.ts      # Risk/confidence scoring

  commands/
    report.ts              # Implementacao completa

templates/claude-structure/
  agents/
    reviewer-secondary.md  # Secondary reviewer agent
```

### Arquivos a Modificar

```
src/
  cli.ts                   # Novos comandos, alias
  commands/
    memory.ts              # Rename update>sync, add status
    feature.ts             # Integrar model routing, CDR
    workflow.ts            # Integrar AI-on-AI review

  utils/
    memory-utils.ts        # Tiered memory, compression
    progress.ts            # Recovery checkpoints
    claude.ts              # Model selection

.adk/
  config.json              # Hooks config migration, model routing config

README.md                  # Documentacao completa
```

---

## 14. Definition of Done

- [ ] Todos RFs implementados e testados
- [ ] Todos RNFs verificados
- [ ] Coverage >= 80% para codigo novo
- [ ] README.md atualizado com arquitetura completa
- [ ] Improvement report gerado
- [ ] Backward compatibility verificada
- [ ] Documentacao de migracao para usuarios existentes

---

## Anexo A: Improvement Report Template

O improvement report final deve conter:

1. **Executive Summary** - Resumo das melhorias
2. **Dualidades Removidas** - Lista com before/after
3. **Novas Funcionalidades** - Lista com descricao
4. **Alinhamento com Industria** - Gaps fechados
5. **Metricas de Impacto Esperado** - Numeros projetados
6. **Guia de Migracao** - Para usuarios existentes

---

## Anexo B: Fontes de Pesquisa

- The New Stack: "5 Key Trends Shaping Agentic Development in 2026"
- Instaclustr: "Agentic AI Frameworks: Top 8 Options in 2026"
- MachineLearningMastery: "7 Agentic AI Trends to Watch in 2026"
- Azure Architecture Center: "AI Agent Orchestration Patterns"
- The New Stack: "Memory for AI Agents: A New Paradigm of Context Engineering"
- arxiv.org: "Agentic Retrieval-Augmented Generation: A Survey"
- Qodo: "How AI Code Assistants Are Revolutionizing TDD"
- Cloud Security Alliance: "Cognitive Degradation Resilience Framework"
- IBM: "The 2026 Guide to Prompt Engineering"

---

## Refinamento (2026-01-20)

### Contexto Adicional

Avaliacao solicitada: verificar se `adk feature refine <feature> --context` esta bem implementado e funcional, e se e possivel refinar apenas uma etapa ao inves de todas.

### Analise Realizada

**Implementacao Existente:**

A funcionalidade de refinamento esta bem implementada com a seguinte arquitetura:

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/types/refine.ts` | Tipos TypeScript (RefineOptions, RefinableArtifact, RefineResult) |
| `src/utils/task-refiner.ts` | Funcoes utilitarias para refinamento de tasks |
| `src/commands/feature.ts` | Metodo `refine()` com logica principal |
| `.claude/commands/refine.md` | Slash command para uso interativo |
| `src/cli.ts` | Registro do comando com opcoes |

**Opcoes Disponiveis:**

```bash
adk feature refine <name> [opcoes]

Opcoes:
  --prd           Refinar apenas PRD
  --research      Refinar apenas Research
  --tasks         Refinar apenas Tasks pendentes
  --all           Refinar todos os artefatos elegiveis
  --cascade       Propagar mudancas para fases seguintes
  --no-cascade    Nao propagar mudancas
  -c, --context   Contexto adicional inline
  -m, --model     Modelo a usar (opus, sonnet, haiku)
```

**Resposta a Pergunta do Usuario:**

✅ **SIM**, e possivel refinar apenas uma etapa ao inves de todas:
- `adk feature refine <nome> --prd` → refina apenas o PRD
- `adk feature refine <nome> --research` → refina apenas o Research
- `adk feature refine <nome> --tasks` → refina apenas as Tasks pendentes
- `adk feature refine <nome> --all` → refina todos os artefatos elegiveis
- Sem flags → modo interativo pergunta quais artefatos refinar

**Mecanismos de Seguranca:**

1. **Snapshot pre-refine**: Cria snapshot antes de qualquer modificacao
2. **Preservacao de tasks**: Tasks com status `completed` ou `in_progress` sao preservadas automaticamente
3. **Cascata opcional**: Propagacao de mudancas e configuravel (default pergunta ao usuario)

### Mudancas Aplicadas

Nenhuma mudanca de codigo necessaria - a implementacao atende aos requisitos.

### Impacto em Outras Fases

- **Tasks**: Adicionar documentacao de uso do comando `refine` no guia do usuario
- **QA**: Incluir testes de refinamento seletivo no checklist de validacao

### Recomendacoes Futuras

1. Adicionar flag `--dry-run` para preview das mudancas antes de aplicar
2. Considerar `--interactive` explicito para forcar modo interativo mesmo com flags
3. Documentar exemplos de uso no README ou help do comando
