# Tasks: techniques-implementation

**Criado:** 2026-01-20
**Total de Tasks:** 35
**Fases:** 4

---

## Fase 1: Quick Wins (Agentes Órfãos) ✅ COMPLETA

### Task 1.1: Integrar reviewer-secondary no /implement ✅
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Nenhuma
- **Arquivo:** `.claude/commands/implement.md`
- **Status:** ✅ COMPLETO (2026-01-20)
- **Acceptance Criteria:**
  - [x] Step 3.5 (Secondary Review) adicionado após Step 3 (Review)
  - [x] Usa Task tool para delegar ao agente `reviewer-secondary`
  - [x] Output salvo em `secondary-review.md` na pasta da feature
  - [x] Step é não-bloqueante (continua mesmo se não encontrar issues)
  - [x] Flag `--skip-secondary-review` documentada para bypass

### Task 1.2: Criar comando /docs ✅
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Nenhuma
- **Arquivo:** `.claude/commands/docs.md`
- **Status:** ✅ COMPLETO (2026-01-20)
- **Acceptance Criteria:**
  - [x] Arquivo criado seguindo padrão de slash commands existente
  - [x] Aceita argumento `$ARGUMENTS` com nome da feature
  - [x] Suporta parâmetro de escopo opcional: `api`, `readme`, `changelog`
  - [x] Delega ao agente `documenter` via Task tool
  - [x] Documentação gerada salva em local apropriado
  - [x] Mensagem de erro clara quando feature não existe

### Task 1.3: Documentar workflow /daily ✅
- **Tipo:** Documentation
- **Prioridade:** P1
- **Dependências:** Nenhuma
- **Arquivo:** `CLAUDE.md`
- **Status:** ✅ COMPLETO (2026-01-20)
- **Acceptance Criteria:**
  - [x] Seção "Daily Workflow" expandida no CLAUDE.md
  - [x] Checklist de rotina diária documentado
  - [x] Instruções para automação via cron/launchd incluídas
  - [x] Benefícios do uso regular explicados

---

## Fase 2: CLI Enhancement (State Management) ✅ COMPLETA (via implementação anterior)

### Task 2.1: Testes para feature sync
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Nenhuma
- **Arquivo:** `src/commands/__tests__/feature-sync.test.ts`
- **Acceptance Criteria:**
  - [ ] Teste: sync bem-sucedido com estratégia padrão (merge)
  - [ ] Teste: sync com estratégia `tasks-wins`
  - [ ] Teste: sync com estratégia `progress-wins`
  - [ ] Teste: dry-run não aplica mudanças
  - [ ] Teste: dry-run retorna preview das mudanças
  - [ ] Teste: verbose mostra detalhes no output
  - [ ] Teste: erro quando feature não existe
  - [ ] Teste: snapshot criado antes de aplicar mudanças
  - [ ] Coverage >= 80%

### Task 2.2: Implementar feature sync
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 2.1
- **Arquivos:** `src/commands/feature.ts`, `src/cli.ts`
- **Acceptance Criteria:**
  - [ ] Método `async sync(name, options)` implementado em FeatureCommand
  - [ ] Usa SyncEngine de `src/utils/sync-engine.ts`
  - [ ] Flag `--strategy` aceita: `merge`, `tasks-wins`, `progress-wins`
  - [ ] Flag `--dry-run` mostra mudanças sem aplicar
  - [ ] Flag `--verbose` mostra detalhes do processo
  - [ ] Cria snapshot antes de sync (não dry-run)
  - [ ] Spinner com mensagens de progresso
  - [ ] Subcomando registrado em `src/cli.ts`
  - [ ] Testes passando

### Task 2.3: Testes para feature restore
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 2.2
- **Arquivo:** `src/commands/__tests__/feature-restore.test.ts`
- **Acceptance Criteria:**
  - [ ] Teste: --list retorna snapshots disponíveis
  - [ ] Teste: --list formata output corretamente
  - [ ] Teste: --list quando não há snapshots
  - [ ] Teste: restore com --to <id> funciona
  - [ ] Teste: restore cria snapshot pré-restore
  - [ ] Teste: restore falha com snapshot inválido
  - [ ] Teste: erro quando feature não existe
  - [ ] Coverage >= 80%

### Task 2.4: Implementar feature restore
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 2.3
- **Arquivos:** `src/commands/feature.ts`, `src/cli.ts`
- **Acceptance Criteria:**
  - [ ] Método `async restore(name, options)` implementado em FeatureCommand
  - [ ] Usa SnapshotManager de `src/utils/snapshot-manager.ts`
  - [ ] Flag `--list` lista snapshots com data, trigger, id
  - [ ] Flag `--to <id>` restaura snapshot específico
  - [ ] Confirmação solicitada antes de restaurar (inquirer)
  - [ ] Cria snapshot do estado atual antes de restaurar
  - [ ] Spinner com mensagens de progresso
  - [ ] Subcomando registrado em `src/cli.ts`
  - [ ] Testes passando

### Task 2.5: Testes para feature history
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 2.4
- **Arquivo:** `src/commands/__tests__/feature-history.test.ts`
- **Acceptance Criteria:**
  - [ ] Teste: retorna histórico de transições
  - [ ] Teste: formata output com data, from, to, trigger
  - [ ] Teste: mostra duração de cada fase
  - [ ] Teste: --limit restringe número de entradas
  - [ ] Teste: histórico vazio tratado gracefully
  - [ ] Teste: erro quando feature não existe
  - [ ] Coverage >= 80%

### Task 2.6: Implementar feature history
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 2.5
- **Arquivos:** `src/commands/feature.ts`, `src/cli.ts`
- **Acceptance Criteria:**
  - [ ] Método `async history(name, options)` implementado em FeatureCommand
  - [ ] Usa HistoryTracker de `src/utils/history-tracker.ts`
  - [ ] Flag `--limit <n>` limita número de entradas
  - [ ] Output formatado em tabela com chalk
  - [ ] Mostra: data, fase origem, fase destino, comando trigger
  - [ ] Calcula e mostra duração em cada fase
  - [ ] Spinner com mensagens de progresso
  - [ ] Subcomando registrado em `src/cli.ts`
  - [ ] Testes passando

### Task 2.7: Testes para feature status --unified
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 2.6
- **Arquivo:** `src/commands/__tests__/feature-status-unified.test.ts`
- **Acceptance Criteria:**
  - [ ] Teste: --unified exibe estado consolidado
  - [ ] Teste: mostra dados de progress.md e tasks.md
  - [ ] Teste: mostra métricas de tempo por fase
  - [ ] Teste: indica inconsistências se existirem
  - [ ] Teste: funciona sem --unified (comportamento existente)
  - [ ] Coverage >= 80%

### Task 2.8: Implementar feature status --unified
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 2.7
- **Arquivos:** `src/commands/feature.ts`, `src/cli.ts`
- **Acceptance Criteria:**
  - [ ] Modifica método `status()` existente para aceitar `--unified`
  - [ ] Usa StateManager de `src/utils/state-manager.ts`
  - [ ] Usa MetricsCollector de `src/utils/metrics-collector.ts`
  - [ ] Exibe estado consolidado quando --unified presente
  - [ ] Mostra progresso percentual calculado
  - [ ] Mostra métricas de tempo por fase
  - [ ] Indica inconsistências detectadas
  - [ ] Flag registrada em `src/cli.ts`
  - [ ] Testes passando

---

## Fase 3: Workflow Optimization

### Task 3.1: Pesquisar execução paralela de agentes
- **Tipo:** Research
- **Prioridade:** P1
- **Dependências:** Nenhuma
- **Arquivo:** `.claude/plans/features/techniques-implementation/parallel-research.md`
- **Acceptance Criteria:**
  - [ ] Documentar como Claude Code executa agentes em paralelo
  - [ ] Identificar quais agentes podem rodar em paralelo no /new-feature
  - [ ] Identificar pontos de sincronização necessários
  - [ ] Documentar padrão Promise.all para paralelismo
  - [ ] Avaliar riscos de race conditions
  - [ ] Propor abordagem de implementação

### Task 3.2: Integrar Plan Mode no /new-feature ✅
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Nenhuma
- **Arquivo:** `.claude/commands/new-feature.md`
- **Status:** ✅ COMPLETO (2026-01-20)
- **Acceptance Criteria:**
  - [x] Workflow inicia com EnterPlanMode automaticamente
  - [x] Interview pattern estruturado com perguntas sobre:
    - Requisitos funcionais
    - Escopo e limitações
    - Restrições técnicas
    - Dependências
  - [x] Aprovação do plano obrigatória antes de prosseguir
  - [x] Flag `--skip-plan` documentada para bypass
  - [x] Plano aprovado salvo como contexto da feature

### Task 3.3: Testes para execução paralela
- **Tipo:** Test
- **Prioridade:** P1
- **Dependências:** Task 3.1, Task 3.2
- **Arquivo:** `src/commands/__tests__/parallel-agents.test.ts`
- **Acceptance Criteria:**
  - [ ] Teste: agentes independentes executam em paralelo
  - [ ] Teste: outputs são consolidados corretamente
  - [ ] Teste: erro em um agente não afeta outros
  - [ ] Teste: resultado agregado contém todos os outputs
  - [ ] Teste: tempo total < soma dos tempos individuais
  - [ ] Coverage >= 80%

### Task 3.4: Implementar execução paralela no /new-feature
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependências:** Task 3.3
- **Arquivos:** `.claude/commands/new-feature.md`, `.claude/skills/new-feature.md`
- **Acceptance Criteria:**
  - [ ] `[prd-creator + research]` executam em paralelo
  - [ ] `task-breakdown` executa após ambos completarem
  - [ ] Outputs de agentes paralelos consolidados
  - [ ] Erros em agentes paralelos tratados gracefully
  - [ ] Tempo de criação de feature reduzido >= 30%
  - [ ] Testes passando

### Task 3.5: Implementar execução paralela no /implement
- **Tipo:** Implementation
- **Prioridade:** P2
- **Dependências:** Task 3.4
- **Arquivos:** `.claude/commands/implement.md`, `.claude/skills/implement.md`
- **Acceptance Criteria:**
  - [ ] `[reviewer + reviewer-secondary]` executam em paralelo
  - [ ] Outputs de review consolidados
  - [ ] Tarefas independentes do implementer em paralelo (quando possível)
  - [ ] Erros tratados adequadamente
  - [ ] Testes passando

---

## Fase 4: Documentation & Integration

### Task 4.1: Documentar MCP Integration - GitHub
- **Tipo:** Documentation
- **Prioridade:** P1
- **Dependências:** Nenhuma
- **Arquivo:** `docs/mcp-integration.md` ou seção em `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] Exemplo de configuração do GitHub MCP
  - [ ] Casos de uso: criar issues, PRs, ler commits
  - [ ] Exemplo de workflow integrado com ADK
  - [ ] Troubleshooting comum

### Task 4.2: Documentar MCP Integration - Notion
- **Tipo:** Documentation
- **Prioridade:** P2
- **Dependências:** Task 4.1
- **Arquivo:** `docs/mcp-integration.md` ou seção em `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] Exemplo de configuração do Notion MCP
  - [ ] Casos de uso: sync com documentação, criar páginas
  - [ ] Exemplo de integração com features do ADK

### Task 4.3: Documentar MCP Integration - Database
- **Tipo:** Documentation
- **Prioridade:** P2
- **Dependências:** Task 4.2
- **Arquivo:** `docs/mcp-integration.md` ou seção em `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] Exemplo de configuração genérica de Database MCP
  - [ ] Casos de uso: consultas, migrations
  - [ ] Considerações de segurança

### Task 4.4: Documentar Extended Thinking
- **Tipo:** Documentation
- **Prioridade:** P2
- **Dependências:** Nenhuma
- **Arquivo:** Seção em `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] Quando usar Extended Thinking
  - [ ] Configuração de budget de tokens
  - [ ] Trade-offs de performance vs qualidade
  - [ ] Exemplos de tasks que beneficiam

### Task 4.5: Atualizar CLAUDE.md - Novos Comandos CLI
- **Tipo:** Documentation
- **Prioridade:** P0
- **Dependências:** Tasks 2.2, 2.4, 2.6, 2.8
- **Arquivo:** `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] `adk feature sync` documentado com flags e exemplos
  - [ ] `adk feature restore` documentado com flags e exemplos
  - [ ] `adk feature history` documentado com flags e exemplos
  - [ ] `adk feature status --unified` documentado
  - [ ] Seção "Progress Sync System" atualizada com novos comandos

### Task 4.6: Atualizar CLAUDE.md - Novos Slash Commands
- **Tipo:** Documentation
- **Prioridade:** P0
- **Dependências:** Tasks 1.1, 1.2
- **Arquivo:** `CLAUDE.md`
- **Acceptance Criteria:**
  - [ ] `/docs` documentado com argumentos e exemplos
  - [ ] `/implement` atualizado mencionando `reviewer-secondary`
  - [ ] Tabela de slash commands atualizada

### Task 4.7: Criar automação para /daily
- **Tipo:** Config
- **Prioridade:** P2
- **Dependências:** Task 1.3
- **Arquivo:** `scripts/daily-cron.sh` ou documentação
- **Acceptance Criteria:**
  - [ ] Script shell para execução do /daily
  - [ ] Exemplo de configuração crontab
  - [ ] Exemplo de configuração launchd (macOS)
  - [ ] Instruções de instalação documentadas

---

## Resumo por Fase

| Fase | Tasks | Testes | Implementação | Documentação |
|------|-------|--------|---------------|--------------|
| 1 - Quick Wins | 3 | 0 | 2 | 1 |
| 2 - CLI Enhancement | 8 | 4 | 4 | 0 |
| 3 - Workflow Optimization | 5 | 1 | 3 | 1 |
| 4 - Documentation | 7 | 0 | 0 | 7 |
| **Total** | **23** | **5** | **9** | **9** |

## Ordem de Execução Recomendada

```
Fase 1 (Paralelo):
  ├── Task 1.1 (implement.md)
  ├── Task 1.2 (/docs)
  └── Task 1.3 (daily docs)

Fase 2 (Sequencial por comando):
  ├── Task 2.1 → Task 2.2 (sync)
  ├── Task 2.3 → Task 2.4 (restore)
  ├── Task 2.5 → Task 2.6 (history)
  └── Task 2.7 → Task 2.8 (status --unified)

Fase 3 (Sequencial):
  ├── Task 3.1 (research)
  ├── Task 3.2 (Plan Mode)
  ├── Task 3.3 → Task 3.4 (paralelo /new-feature)
  └── Task 3.5 (paralelo /implement)

Fase 4 (Paralelo após dependências):
  ├── Task 4.5, 4.6 (depende de Fase 1 e 2)
  ├── Task 4.1 → 4.2 → 4.3 (MCP docs)
  ├── Task 4.4 (Extended Thinking)
  └── Task 4.7 (depende de 1.3)
```

## Critérios Globais

- **Todos os testes devem passar antes de marcar implementação como completa**
- **Coverage >= 80% em novos módulos**
- **Seguir padrões existentes de código e documentação**
- **Validar inputs conforme security-rules.md**
- **Nenhum commit pode mencionar IA ou Claude**
