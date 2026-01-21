# PRD: techniques-implementation

**Data:** 2026-01-20
**Status:** Draft
**Autor:** Auto-generated

## 1. Problema

O ADK (Agentic Development Kit) possui uma arquitetura robusta com 35+ componentes implementados, porém há **valor não entregue**: componentes desenvolvidos que não estão integrados nos workflows ou expostos via CLI.

### Métricas Atuais que Evidenciam o Problema

| Métrica | Valor Atual | Alvo |
|---------|-------------|------|
| Taxa de utilização de agentes | 77% (7/9) | 100% |
| Artefatos de State expostos via CLI | 50% | 100% |
| Cobertura de técnicas Claude Code | 70% | 90%+ |
| Daily reports nos últimos 30 dias | 1 | 20+ |

### Problemas Específicos

1. **Agentes Órfãos**: Dois agentes totalmente implementados (`reviewer-secondary` e `documenter`) não fazem parte de nenhum workflow, desperdiçando trabalho de desenvolvimento.

2. **State Management sem CLI**: Sistema completo de sincronização implementado em `src/utils/` (StateManager, SyncEngine, HistoryTracker, SnapshotManager, MetricsCollector) mas sem comandos CLI para o usuário acessar.

3. **Execução Sequencial de Agentes**: Agentes rodam sequencialmente quando poderiam rodar em paralelo, aumentando o tempo de planejamento em 40-60%.

4. **Plan Mode não Integrado**: O Claude Code possui Plan Mode nativo que não está sendo utilizado para garantir requisitos completos.

5. **Workflows de Report Subutilizados**: Apenas 1 arquivo de daily report encontrado, indicando perda de histórico de progresso.

## 2. Solução Proposta

Implementar melhorias incrementais no ADK para alcançar 100% de utilização dos componentes existentes e 90%+ de cobertura das técnicas do Claude Code, organizadas em 4 fases:

### Fase 1: Quick Wins (Agentes Órfãos)
- Integrar `reviewer-secondary` no pipeline do `/implement`
- Criar comando `/docs` para utilizar o agente `documenter`

### Fase 2: CLI Enhancement (State Management)
- Implementar `adk feature sync <name>`
- Implementar `adk feature restore <name>`
- Implementar `adk feature status --unified`
- Implementar `adk feature history <name>`

### Fase 3: Workflow Optimization
- Integrar Plan Mode no workflow `/new-feature`
- Pesquisar e implementar execução paralela de agentes

### Fase 4: Integrations & Documentation
- Documentar MCP integration com exemplos
- Automatizar execução do `/daily` workflow
- Configurar Extended Thinking

## 3. Requisitos Funcionais

### RF01: Integração do Agente reviewer-secondary
O pipeline do comando `/implement` deve incluir o agente `reviewer-secondary` após o `reviewer` para validação cruzada AI-on-AI.

**Pipeline Atual:**
```
implementer → reviewer → tester
```

**Pipeline Proposto:**
```
implementer → reviewer → reviewer-secondary → tester
```

### RF02: Comando /docs
Criar novo slash command `/docs` que aciona o agente `documenter` para gerar documentação técnica automaticamente.

**Entrada:**
- Nome da feature (obrigatório)
- Escopo da documentação (opcional: api, readme, changelog)

**Saída:**
- Arquivos de documentação gerados em local apropriado

### RF03: Comando feature sync
Implementar subcomando `adk feature sync <name>` que:
- Sincroniza `progress.md` com `tasks.md`
- Aceita flags: `--strategy [merge|tasks-wins|progress-wins]`, `--dry-run`, `--verbose`
- Utiliza o `SyncEngine` já implementado em `src/utils/sync-engine.ts`

### RF04: Comando feature restore
Implementar subcomando `adk feature restore <name>` que:
- Lista snapshots disponíveis com `--list`
- Restaura estado a partir de snapshot com `--to <snapshot-id>`
- Utiliza o `SnapshotManager` já implementado em `src/utils/snapshot-manager.ts`

### RF05: Flag --unified para feature status
Adicionar flag `--unified` ao comando `adk feature status <name>` que:
- Exibe estado consolidado de `progress.md` + `tasks.md`
- Mostra métricas coletadas
- Utiliza o `StateManager` já implementado em `src/utils/state-manager.ts`

### RF06: Comando feature history
Implementar subcomando `adk feature history <name>` que:
- Exibe histórico de transições de fase
- Utiliza o `HistoryTracker` já implementado em `src/utils/history-tracker.ts`

### RF07: Integração Plan Mode
O comando `/new-feature` deve:
- Iniciar automaticamente em Plan Mode (`--permission-mode plan`)
- Utilizar interview pattern estruturado para coleta de requisitos
- Exigir aprovação do plano antes de prosseguir para implementação

### RF08: Execução Paralela de Agentes
Implementar capacidade de executar agentes em paralelo onde possível:
- `/new-feature`: `[prd-creator + research]` em paralelo → `task-breakdown`
- `/implement`: `architect` → `[tarefas do implementer]` em paralelo → `[reviewer + reviewer-secondary]` em paralelo

### RF09: Documentação MCP Integration
Criar documentação e exemplos de configuração para:
- GitHub MCP: Criar issues, PRs, ler commits
- Notion MCP: Sync com documentação
- Database MCP: Consultas ao banco

### RF10: Automação do Daily Workflow
Documentar e facilitar execução regular do `/daily`:
- Criar checklist de rotina diária
- Sugerir integração com cron/launchd para automação

## 4. Requisitos Não-Funcionais

### RNF01: Performance
- Operações de sync devem completar em < 500ms para features com até 50 tasks
- Carregamento de estado unificado deve ser < 100ms
- Criação de snapshot deve ser < 200ms

### RNF02: Compatibilidade
- Todas as mudanças devem manter retrocompatibilidade com features existentes
- Features criadas antes da implementação devem continuar funcionando
- Graceful degradation quando arquivos esperados não existem

### RNF03: Segurança
- Não expor informações sensíveis em logs ou outputs
- Validar inputs em todos os novos comandos CLI
- Seguir as regras definidas em `.claude/rules/security-rules.md`

### RNF04: Testabilidade
- Cobertura de testes >= 80% para novos módulos
- Seguir padrão TDD conforme `.claude/rules/testing-standards.md`
- Testes unitários e de integração

### RNF05: Documentação
- Atualizar CLAUDE.md com novos comandos
- Documentar novos workflows em arquivos apropriados
- Manter consistência com documentação existente

## 5. User Stories

### US01: Validação Cruzada de Código
**Como** desenvolvedor usando ADK
**Quero** que meu código passe por dois revisores independentes
**Para** capturar bugs e issues que um único revisor poderia perder

**Critérios de Aceitação:**
- [ ] `reviewer-secondary` é executado automaticamente após `reviewer` no `/implement`
- [ ] Output do `reviewer-secondary` é salvo em arquivo separado
- [ ] Issues encontrados são apresentados ao usuário
- [ ] Workflow não bloqueia se `reviewer-secondary` não encontrar issues adicionais

### US02: Geração Automática de Documentação
**Como** desenvolvedor usando ADK
**Quero** gerar documentação técnica automaticamente
**Para** manter a documentação sempre atualizada sem esforço manual

**Critérios de Aceitação:**
- [ ] Comando `/docs <feature-name>` está disponível
- [ ] Documentação é gerada usando o agente `documenter`
- [ ] Suporta diferentes tipos de documentação (api, readme, changelog)
- [ ] Documentação gerada segue convenções do projeto

### US03: Sincronização Manual de Progresso
**Como** desenvolvedor usando ADK
**Quero** sincronizar manualmente o estado de uma feature
**Para** resolver inconsistências entre progress.md e tasks.md

**Critérios de Aceitação:**
- [ ] Comando `adk feature sync <name>` está disponível
- [ ] Flag `--strategy` permite escolher estratégia de resolução
- [ ] Flag `--dry-run` mostra mudanças sem aplicar
- [ ] Flag `--verbose` mostra detalhes do processo
- [ ] Snapshot é criado antes de aplicar mudanças

### US04: Restauração de Estado Anterior
**Como** desenvolvedor usando ADK
**Quero** restaurar uma feature para um estado anterior
**Para** recuperar de erros ou mudanças indesejadas

**Critérios de Aceitação:**
- [ ] Comando `adk feature restore <name> --list` lista snapshots disponíveis
- [ ] Comando `adk feature restore <name> --to <id>` restaura estado
- [ ] Confirmação é solicitada antes de restaurar
- [ ] Estado atual é salvo como snapshot antes de restaurar

### US05: Visualização de Estado Unificado
**Como** desenvolvedor usando ADK
**Quero** ver o estado consolidado de uma feature
**Para** entender rapidamente o progresso e métricas

**Critérios de Aceitação:**
- [ ] Flag `--unified` adicionada ao `adk feature status`
- [ ] Exibe dados de progress.md e tasks.md consolidados
- [ ] Mostra métricas de tempo por fase
- [ ] Indica inconsistências se existirem

### US06: Histórico de Transições
**Como** desenvolvedor usando ADK
**Quero** ver o histórico de transições de uma feature
**Para** auditar mudanças de fase e entender o progresso ao longo do tempo

**Critérios de Aceitação:**
- [ ] Comando `adk feature history <name>` está disponível
- [ ] Mostra data, fase origem, fase destino, comando trigger
- [ ] Mostra duração em cada fase
- [ ] Suporta filtro por período (opcional)

### US07: Requisitos Completos com Plan Mode
**Como** desenvolvedor usando ADK
**Quero** que o PRD seja criado com entrevista estruturada
**Para** garantir que todos os requisitos são capturados antes da implementação

**Critérios de Aceitação:**
- [ ] `/new-feature` inicia em Plan Mode automaticamente
- [ ] Interview pattern faz perguntas sobre requisitos, escopo, restrições
- [ ] Usuário revisa e aprova plano antes de prosseguir
- [ ] Plano aprovado é salvo como contexto da feature

### US08: Execução Mais Rápida com Paralelismo
**Como** desenvolvedor usando ADK
**Quero** que agentes independentes executem em paralelo
**Para** reduzir o tempo total de planejamento e implementação

**Critérios de Aceitação:**
- [ ] Agentes sem dependência executam em paralelo
- [ ] Tempo total de `/new-feature` reduzido em >= 30%
- [ ] Erros em agentes paralelos são tratados adequadamente
- [ ] Output de todos os agentes é consolidado corretamente

## 6. Escopo

### Incluído
- Integração do agente `reviewer-secondary` no workflow `/implement`
- Criação do comando `/docs` utilizando agente `documenter`
- Implementação de 4 novos subcomandos em `adk feature`:
  - `sync`
  - `restore`
  - `status --unified`
  - `history`
- Integração do Plan Mode no `/new-feature`
- Documentação de MCP integration
- Documentação e automação do `/daily` workflow
- Atualização do CLAUDE.md com novos comandos

### Excluído (Out of Scope)
- Implementação de novos MCP servers (apenas documentação)
- Refatoração completa do sistema de agentes
- Integração com sistemas externos (ClickUp, GitHub, Notion) - apenas documentação
- Mudanças na estrutura de arquivos de features existentes
- Implementação de Extended Thinking (apenas documentação)
- Criação de novos agentes (usar apenas os existentes)
- Worktree integration para sync bidirecional main ↔ worktree

## 7. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Execução paralela de agentes causa conflitos de estado | Alto | Média | Implementar locks/mutex para operações de escrita; executar em dry-run primeiro |
| Mudanças quebram features existentes | Alto | Baixa | Manter retrocompatibilidade; criar testes de regressão; graceful degradation |
| reviewer-secondary adiciona tempo excessivo ao pipeline | Médio | Média | Tornar opcional via flag `--skip-secondary-review`; otimizar prompts |
| Complexidade aumentada dificulta manutenção | Médio | Média | Documentação clara; seguir padrões existentes; code review rigoroso |
| Sync engine não trata todos os edge cases | Médio | Baixa | Testes extensivos; sempre criar snapshot antes de sync; opção de dry-run |
| Plan Mode interrompe fluxo de trabalho do usuário | Baixo | Média | Tornar opcional via flag `--skip-plan`; experiência fluida de aprovação |

## 8. Métricas de Sucesso

### Métricas Quantitativas

| Métrica | Valor Atual | Meta | Como Medir |
|---------|-------------|------|------------|
| Utilização de agentes | 77% (7/9) | 100% (9/9) | Verificar se todos os agentes são chamados em algum workflow |
| Artefatos state expostos | 50% | 100% | Verificar comandos CLI disponíveis para state management |
| Cobertura técnicas Claude Code | 70% | 90% | Checklist de técnicas implementadas |
| Daily reports (30 dias) | 1 | 20+ | Contar arquivos em `.claude/daily/` |
| Tempo médio de feature | Baseline | -30% | Medir tempo de criação de feature com paralelismo |
| Issues capturados por secondary review | 0 | >0 por feature | Contar issues adicionais encontrados |

### Métricas Qualitativas

- Documentação técnica gerada automaticamente está completa e útil
- Estado unificado fornece visão clara do progresso
- Histórico de transições permite auditoria efetiva
- Restauração de estado funciona sem perda de dados

## 9. Dependências

### Dependências Internas (Já Implementadas)
- `src/utils/state-manager.ts` - StateManager para estado unificado
- `src/utils/sync-engine.ts` - SyncEngine para sincronização
- `src/utils/history-tracker.ts` - HistoryTracker para histórico
- `src/utils/snapshot-manager.ts` - SnapshotManager para snapshots
- `src/utils/metrics-collector.ts` - MetricsCollector para métricas
- `.claude/agents/reviewer-secondary.md` - Agente de revisão secundária
- `.claude/agents/documenter.md` - Agente de documentação
- `.claude/commands/*.md` - Estrutura de comandos existente

### Dependências Externas
- Claude Code CLI instalado e configurado
- Node.js >= 18.0.0
- Commander.js (já incluído)
- Inquirer (já incluído)
- fs-extra (já incluído)

### Pré-requisitos
- Estrutura de projeto ADK inicializada (`adk init`)
- Features devem seguir estrutura padrão em `.claude/plans/features/<name>/`

## 10. Timeline (Sugestão)

### Fase 1: Quick Wins (2-3 dias)
**Objetivo:** Integrar agentes órfãos e entregar valor imediato

- [ ] Adicionar `reviewer-secondary` ao pipeline do `/implement`
  - Editar `.claude/commands/implement.md`
  - Testar integração
- [ ] Criar comando `/docs`
  - Criar `.claude/commands/docs.md`
  - Integrar com agente `documenter`
  - Testar geração de documentação
- [ ] Documentar execução do `/daily`
  - Criar checklist de rotina diária
  - Adicionar ao CLAUDE.md

### Fase 2: CLI Enhancement (5-7 dias)
**Objetivo:** Expor State Management via CLI

- [ ] Implementar `adk feature sync <name>`
  - Adicionar subcomando em `src/commands/feature.ts`
  - Utilizar `SyncEngine` existente
  - Implementar flags `--strategy`, `--dry-run`, `--verbose`
  - Testes unitários e integração
- [ ] Implementar `adk feature restore <name>`
  - Adicionar subcomando em `src/commands/feature.ts`
  - Utilizar `SnapshotManager` existente
  - Implementar flags `--list`, `--to <id>`
  - Testes unitários e integração
- [ ] Implementar `adk feature status --unified`
  - Adicionar flag em subcomando existente
  - Utilizar `StateManager` existente
  - Formatar output para CLI
  - Testes unitários
- [ ] Implementar `adk feature history <name>`
  - Adicionar subcomando em `src/commands/feature.ts`
  - Utilizar `HistoryTracker` existente
  - Formatar output para CLI
  - Testes unitários

### Fase 3: Workflow Optimization (7-10 dias)
**Objetivo:** Melhorar qualidade e performance dos workflows

- [ ] Integrar Plan Mode no `/new-feature`
  - Modificar `.claude/commands/new-feature.md`
  - Implementar interview pattern estruturado
  - Adicionar flag `--skip-plan` para bypass
  - Testar fluxo completo
- [ ] Pesquisar execução paralela de agentes
  - Mapear quais agentes podem rodar em paralelo
  - Identificar pontos de sincronização necessários
  - Documentar abordagem proposta
- [ ] Implementar execução paralela
  - Modificar pipelines para suportar paralelismo
  - Implementar consolidação de outputs
  - Tratamento de erros em execução paralela
  - Testes de integração

### Fase 4: Integrations & Documentation (3-5 dias)
**Objetivo:** Completar documentação e configurações

- [ ] Documentar MCP integration
  - Criar exemplos de configuração para GitHub MCP
  - Criar exemplos de configuração para Notion MCP
  - Adicionar seção ao CLAUDE.md
- [ ] Documentar Extended Thinking
  - Criar guia de quando usar
  - Documentar configuração de tokens
- [ ] Automatizar daily workflow
  - Criar script para execução via cron/launchd
  - Documentar configuração
- [ ] Atualizar CLAUDE.md
  - Documentar todos os novos comandos
  - Atualizar seções de workflow
  - Adicionar exemplos de uso

---

## Apêndice A: Componentes Existentes para Reutilização

### Agentes a Integrar
```
.claude/agents/reviewer-secondary.md
.claude/agents/documenter.md
```

### Utilitários Implementados
```
src/utils/state-manager.ts      - Gerenciamento de estado unificado
src/utils/sync-engine.ts        - Motor de sincronização
src/utils/history-tracker.ts    - Histórico de transições
src/utils/snapshot-manager.ts   - Gerenciamento de snapshots
src/utils/metrics-collector.ts  - Coleta de métricas
src/utils/progress-conflict.ts  - Detecção de conflitos
```

### Arquivos a Modificar
```
.claude/commands/implement.md   - Adicionar reviewer-secondary
.claude/commands/new-feature.md - Integrar Plan Mode
src/commands/feature.ts         - Adicionar subcomandos CLI
CLAUDE.md                       - Documentar novos recursos
```

## Apêndice B: Referência de Técnicas Claude Code

### Técnicas a Implementar nesta Feature
| Técnica | Status Atual | Implementação |
|---------|--------------|---------------|
| Multi-Agent Pipelines | 77% | Integrar agentes órfãos |
| Parallel Execution | 0% | Fase 3 |
| Plan Mode Integration | 0% | Fase 3 |
| State Snapshots CLI | 0% | Fase 2 |
| Interview Pattern | Parcial | Fase 3 |

### Técnicas Fora de Escopo
- MCP Server Implementation
- Extended Thinking Runtime Config
- Tool Search Optimization
- Conditional Agent Hooks
