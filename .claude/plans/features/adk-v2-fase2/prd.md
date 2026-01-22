# PRD: adk-v2-fase2 - Session Management

**Data:** 2026-01-22
**Status:** Draft
**Autor:** Auto-generated
**Versão:** 1.0

---

## 1. Problema

### 1.1 Contexto

O ADK atualmente não possui capacidade de **gerenciar sessões de longa duração** para agentes. Cada vez que uma sessão Claude Code termina (por timeout, fechamento de janela, ou context overflow), todo o progresso e contexto da sessão é perdido.

### 1.2 Problemas Específicos

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROBLEMAS SEM SESSION MANAGEMENT                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. PERDA DE CONTEXTO:                                                  │
│     └─ Agentes não podem retomar de checkpoints                         │
│     └─ Cada sessão começa do zero                                       │
│     └─ Context overflow perde trabalho realizado                        │
│                                                                          │
│  2. FALTA DE RASTREABILIDADE:                                           │
│     └─ Não há registro de sessões anteriores                            │
│     └─ Impossível auditar o que foi feito                               │
│     └─ Sem histórico de decisões tomadas durante sessão                 │
│                                                                          │
│  3. INEFICIÊNCIA:                                                       │
│     └─ Re-trabalho ao reiniciar features                                │
│     └─ Tokens desperdiçados reconstruindo contexto                      │
│     └─ Tempo perdido "relembrando" o agente do estado                   │
│                                                                          │
│  4. FALTA DE RESILIÊNCIA:                                               │
│     └─ Erros não são recuperáveis                                       │
│     └─ Sem fallback para estados anteriores                             │
│     └─ Interrupções inesperadas causam perda total                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Impacto no Usuário

- **Desenvolvedores perdem horas** de trabalho quando sessões longas são interrompidas
- **Features complexas** que requerem múltiplas sessões são difíceis de gerenciar
- **Context overflow** em tarefas grandes força reinício do zero
- **Sem visibilidade** sobre o progresso real de agentes long-running

---

## 2. Solução Proposta

### 2.1 Visão Geral

Implementar um **Sistema de Gerenciamento de Sessões** que permite:
1. **Checkpoints automáticos** durante execução de agentes
2. **Resume de sessões** interrompidas com flag `--resume`
3. **Handoff documents** em plain-text para recuperação rápida
4. **Histórico de sessões** por feature

### 2.2 Abordagem Técnica

Baseado na recomendação do code review (Seção 8.2), a solução será implementada **estendendo o StateManager existente** ao invés de criar uma nova classe SessionManager, evitando ~800 linhas de código duplicado.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA SESSION MANAGEMENT                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  StateManager (EXISTENTE - ESTENDER)                                    │
│  ├─ loadUnifiedState()      ✅ Já existe                                │
│  ├─ createSnapshot()        ✅ Via SnapshotManager                      │
│  ├─ recordTransition()      ✅ Via HistoryTracker                       │
│  ├─ resumeFromSnapshot()    ❌ NOVO - Adicionar                         │
│  ├─ createContextSummary()  ❌ NOVO - Adicionar                         │
│  ├─ createHandoffDocument() ❌ NOVO - Adicionar                         │
│  └─ listSessions()          ❌ NOVO - Adicionar                         │
│                                                                          │
│  Hooks (EXISTENTES + NOVOS)                                             │
│  ├─ session-bootstrap.sh    ✅ Fase 0 (injetar contexto)                │
│  ├─ session-checkpoint.sh   ✅ Fase 0 (criar checkpoint no Stop)        │
│  └─ task-complete.sh        ❌ NOVO - Commit por task                   │
│                                                                          │
│  CLI (NOVOS FLAGS/COMANDOS)                                             │
│  ├─ adk agent run <name> --resume                                       │
│  ├─ adk agent sessions <feature>                                        │
│  └─ adk feature implement <name> --resume                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Padrão Anthropic: claude-progress.txt

Seguindo a recomendação da Anthropic para handoff documents em **plain-text** (não JSON):

```markdown
# claude-progress.txt

CURRENT: Implementing authentication middleware (70% complete)

DONE:
- Set up JWT library
- Created auth middleware
- Added tests for happy path

IN PROGRESS:
- Error handling for expired tokens

NEXT:
1. Test edge cases (malformed tokens, missing headers)
2. Integrate with Express app
3. Update docs

FILES: src/middleware/auth.ts, tests/auth.test.ts

ISSUES: None blocking
```

**Benefícios do plain-text:**
| Aspecto | JSON | Plain Text |
|---------|------|------------|
| Tokens consumidos | ~800 | ~200 |
| Tempo de parse pelo Claude | Lento | Rápido (<1s) |
| Editável por humanos | Difícil | Fácil |
| Diffs no git | Ilegível | Claro |

---

## 3. Requisitos Funcionais

### 3.1 Core Session Management

- **RF01:** O sistema DEVE criar checkpoints automáticos quando uma sessão termina (via Stop hook)
- **RF02:** O sistema DEVE permitir listar sessões anteriores de uma feature via `adk agent sessions <feature>`
- **RF03:** O sistema DEVE permitir resumir última sessão via flag `--resume` em comandos de agente
- **RF04:** O sistema DEVE gerar handoff documents em formato plain-text (claude-progress.txt)
- **RF05:** O sistema DEVE manter histórico de sessões com limite configurável (padrão: 10 sessões)

### 3.2 Checkpoint Management

- **RF06:** O sistema DEVE criar snapshot antes de operações que podem falhar
- **RF07:** O sistema DEVE associar commits git aos checkpoints quando aplicável
- **RF08:** O sistema DEVE registrar razão do checkpoint (manual, step_complete, context_warning, error_recovery, task_complete)
- **RF09:** O sistema DEVE permitir restaurar para qualquer checkpoint anterior via `adk feature restore`

### 3.3 CLI Integration

- **RF10:** O comando `adk agent run <name>` DEVE aceitar flag `--resume` para continuar última sessão
- **RF11:** O comando `adk feature implement <name>` DEVE aceitar flag `--resume`
- **RF12:** O comando `adk agent sessions <feature>` DEVE listar sessões com data, duração e status
- **RF13:** O comando `adk agent sessions <feature> --latest` DEVE mostrar detalhes da última sessão

### 3.4 State Synchronization

- **RF14:** O sistema DEVE sincronizar estado entre progress.md e claude-progress.txt
- **RF15:** O sistema DEVE atualizar automaticamente claude-progress.txt após cada task completada
- **RF16:** O sistema DEVE preservar context summary entre sessões

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01:** Criação de checkpoint DEVE completar em < 200ms
- **RNF02:** Carregamento de sessão (resume) DEVE completar em < 500ms
- **RNF03:** Listagem de sessões DEVE completar em < 100ms
- **RNF04:** Geração de handoff document DEVE completar em < 300ms

### 4.2 Confiabilidade

- **RNF05:** Checkpoints DEVEM ser atômicos (tudo ou nada)
- **RNF06:** Sistema DEVE criar snapshot antes de qualquer operação destrutiva
- **RNF07:** Em caso de falha durante checkpoint, estado anterior DEVE ser preservado
- **RNF08:** Sistema DEVE gracefully degradar se arquivos estiverem corrompidos

### 4.3 Compatibilidade

- **RNF09:** DEVE ser compatível com features criadas antes desta implementação (backward compatibility)
- **RNF10:** DEVE funcionar com SnapshotManager e HistoryTracker existentes
- **RNF11:** DEVE integrar com hooks da Fase 0 (session-bootstrap, session-checkpoint)

### 4.4 Usabilidade

- **RNF12:** claude-progress.txt DEVE ser legível por humanos sem ferramentas especiais
- **RNF13:** Mensagens de CLI DEVEM indicar claramente se está resumindo ou iniciando nova sessão
- **RNF14:** Sistema DEVE sugerir `--resume` quando detectar sessão interrompida

### 4.5 Testabilidade

- **RNF15:** Cobertura de testes >= 80% para todos os novos módulos
- **RNF16:** Testes DEVEM cobrir cenários de falha e recovery

---

## 5. User Stories

### US01: Resumir Sessão Interrompida
**Como** desenvolvedor usando ADK
**Quero** poder resumir uma sessão de agente que foi interrompida
**Para** não perder o progresso já realizado

**Critérios de Aceitação:**
- [ ] Comando `adk agent run implementer --resume` carrega último estado
- [ ] Agente recebe contexto completo do que já foi feito
- [ ] claude-progress.txt é lido e injetado na sessão
- [ ] Arquivos modificados são listados para contexto
- [ ] Próximas tarefas são claramente identificadas

### US02: Listar Sessões de uma Feature
**Como** desenvolvedor
**Quero** ver histórico de sessões de uma feature
**Para** entender o progresso e identificar onde retomar

**Critérios de Aceitação:**
- [ ] Comando `adk agent sessions auth-feature` lista todas as sessões
- [ ] Cada sessão mostra: ID, data, duração, status, steps completados
- [ ] Flag `--latest` mostra detalhes da última sessão
- [ ] Output formatado em tabela legível

### US03: Checkpoint Automático no Fim de Sessão
**Como** desenvolvedor
**Quero** que checkpoints sejam criados automaticamente quando fecho o terminal
**Para** nunca perder trabalho mesmo em fechamentos inesperados

**Critérios de Aceitação:**
- [ ] Stop hook cria snapshot automaticamente
- [ ] claude-progress.txt é atualizado com estado atual
- [ ] state.json reflete último estado conhecido
- [ ] Commit é criado se houver mudanças staged

### US04: Handoff Document Legível
**Como** desenvolvedor
**Quero** que o documento de handoff seja legível sem ferramentas
**Para** poder entender rapidamente o estado mesmo sem CLI

**Critérios de Aceitação:**
- [ ] claude-progress.txt usa formato plain-text
- [ ] Seções claramente delimitadas (DONE, IN PROGRESS, NEXT, FILES, ISSUES)
- [ ] Sem JSON ou estruturas complexas
- [ ] Editável manualmente se necessário

### US05: Sugestão de Resume
**Como** desenvolvedor
**Quero** ser avisado quando há sessão para resumir
**Para** não iniciar nova sessão acidentalmente perdendo contexto

**Critérios de Aceitação:**
- [ ] Ao rodar `adk agent run` sem `--resume`, detecta sessão pendente
- [ ] Exibe mensagem: "Sessão anterior encontrada. Use --resume para continuar"
- [ ] Mostra resumo da sessão pendente (última atividade, progresso)
- [ ] Oferece opção de iniciar nova sessão ou resumir

### US06: Checkpoint por Task Completada
**Como** desenvolvedor usando agentes long-running
**Quero** que cada task completada crie um checkpoint com commit
**Para** ter granularidade de recovery por task individual

**Critérios de Aceitação:**
- [ ] Hook task-complete.sh detecta conclusão de task
- [ ] Atualiza claude-progress.txt com task completada
- [ ] Cria commit atômico com mensagem descritiva
- [ ] Cria snapshot associado ao commit
- [ ] Registra no history.json

---

## 6. Escopo

### 6.1 Incluído (In Scope)

**Fase 2 - Core Session Management:**
- Extensão do StateManager com métodos de session
- Tipos TypeScript para Session e Checkpoint
- CLI flags `--resume` para agent run e feature implement
- Comando `adk agent sessions`
- Geração de claude-progress.txt
- Hook task-complete.sh para checkpoints por task
- Integração com hooks da Fase 0
- Testes unitários e de integração

**Arquivos a criar/modificar:**
| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/types/session.ts` | Criar | Tipos LongRunningSession, CheckpointRef |
| `src/utils/state-manager.ts` | Modificar | Adicionar métodos de session |
| `src/commands/agent.ts` | Modificar | Adicionar --resume e sessions |
| `src/commands/feature.ts` | Modificar | Adicionar --resume |
| `.claude/hooks/task-complete.sh` | Criar | Hook de checkpoint por task |
| `templates/claude-progress.txt` | Criar | Template do handoff document |
| `tests/utils/session-management.test.ts` | Criar | Testes |

### 6.2 Excluído (Out of Scope)

- **Context Compactor:** Será Fase 3
- **Token counting via Anthropic API:** Será Fase 3
- **Constitution/Steering:** Será Fase 4
- **Git commits como checkpoints (full implementation):** Será Fase 5
- **Circuit breaker e retry patterns:** Será Fase 6
- **Observabilidade com Arize Phoenix:** Será Fase 6
- **Tasks em pasta (tasks/):** Pode ser considerado para fase futura
- **ADK MCP Server:** Roadmap futuro
- **VS Code Extension:** Roadmap futuro

### 6.3 Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Criar SessionManager separado vs Estender StateManager | Estender StateManager | Evita ~800 linhas duplicadas, reutiliza SnapshotManager e HistoryTracker |
| Formato de handoff: JSON vs Plain-text | Plain-text | Recomendação Anthropic: 75% menos tokens, parse mais rápido |
| Limite de sessões armazenadas | 10 sessões | Balança storage vs histórico útil |
| Checkpoint reason obrigatório | Sim | Permite auditoria e debugging |

---

## 7. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Conflito com SnapshotManager existente | Média | Alto | Criar testes de integração extensivos; usar composition over inheritance |
| R2 | claude-progress.txt corrompido manualmente | Média | Médio | Validação com fallback para state.json; parser tolerante a erros |
| R3 | Hook Stop não executar (kill -9) | Baixa | Alto | Checkpoint periódico via cron; recovery automático no próximo start |
| R4 | Performance degradada com muitas sessões | Baixa | Médio | Limit + auto-prune de sessões antigas; lazy loading |
| R5 | Incompatibilidade com features antigas | Média | Médio | Migração automática na primeira execução; testes de backward compat |
| R6 | Race condition em múltiplas sessões | Baixa | Alto | Mutex no StateManager (já existe em HistoryTracker); file locking |

---

## 8. Métricas de Sucesso

### 8.1 Métricas Quantitativas

| Métrica | Baseline Atual | Meta | Como Medir |
|---------|----------------|------|------------|
| Taxa de recuperação de sessões | 0% (não existe) | >= 90% | % de sessões interrompidas que são resumidas com sucesso |
| Tempo para resume | N/A | < 500ms | Medição no CLI |
| Tokens economizados por resume | 0 | >= 60% | Comparar tokens de start fresh vs resume |
| Cobertura de testes | N/A | >= 80% | Jest coverage report |

### 8.2 Métricas Qualitativas

| Métrica | Como Avaliar |
|---------|--------------|
| Experiência de resume | Feedback de usuários: "O contexto foi restaurado corretamente?" |
| Legibilidade do handoff | Review manual de claude-progress.txt gerados |
| Confiabilidade de checkpoints | Zero perda de dados em 100 execuções de teste |

### 8.3 Critérios de Aceitação da Feature

- [ ] Todos os RF implementados e testados
- [ ] Todos os RNF validados
- [ ] Todas as User Stories atendidas
- [ ] Cobertura de testes >= 80%
- [ ] Documentação atualizada no CLAUDE.md
- [ ] Zero regressões nos testes existentes
- [ ] Code review aprovado

---

## 9. Dependências

### 9.1 Dependências Técnicas

| Dependência | Status | Descrição |
|-------------|--------|-----------|
| StateManager | ✅ Implementado | Base para extensão |
| SnapshotManager | ✅ Implementado | Criação de snapshots |
| HistoryTracker | ✅ Implementado | Registro de transições |
| Hooks Fase 0 | ✅ Implementado | session-bootstrap.sh, session-checkpoint.sh |
| TaskParser | ✅ Implementado | Parse de tasks.md |
| fs-extra | ✅ Instalado | Operações de arquivo |

### 9.2 Dependências de Conhecimento

| Item | Status | Ação |
|------|--------|------|
| Padrão Anthropic de handoff | ✅ Documentado | Seguir recomendações |
| Formato de claude-progress.txt | ✅ Definido | Implementar template |
| Integração com Git | ✅ Conhecimento existente | Reutilizar patterns |

### 9.3 Bloqueadores

Nenhum bloqueador identificado. A Fase 0 (Enforcement Hooks) já está implementada e fornece a base necessária.

---

## 10. Timeline (Sugestão)

### Fase 2.1: Foundation (2-3 dias)
- Criar tipos em `src/types/session.ts`
- Implementar métodos base no StateManager:
  - `resumeFromSnapshot()`
  - `createContextSummary()`
  - `listSessions()`

### Fase 2.2: Handoff Document (1-2 dias)
- Criar template `templates/claude-progress.txt`
- Implementar `createHandoffDocument()` no StateManager
- Implementar parser de claude-progress.txt

### Fase 2.3: CLI Integration (2-3 dias)
- Adicionar flag `--resume` em `adk agent run`
- Adicionar flag `--resume` em `adk feature implement`
- Implementar comando `adk agent sessions`
- Implementar detecção de sessão pendente

### Fase 2.4: Hooks & Integration (1-2 dias)
- Criar hook `task-complete.sh`
- Integrar com hooks da Fase 0
- Testar fluxo completo de checkpoint/resume

### Fase 2.5: Testing & Documentation (2-3 dias)
- Testes unitários para novos métodos
- Testes de integração para fluxo completo
- Atualizar CLAUDE.md
- Atualizar documentação de comandos

**Total Estimado:** 8-13 dias (1.5-2.5 semanas)

---

## 11. Especificações Técnicas

### 11.1 Tipos TypeScript

```typescript
interface LongRunningSession {
  id: string
  feature: string
  startedAt: string
  lastActivity: string
  currentStep: string
  completedSteps: string[]
  pendingSteps: string[]
  contextSummary: string
  checkpoints: CheckpointRef[]
  status: 'active' | 'completed' | 'interrupted' | 'error'
}

interface CheckpointRef {
  id: string
  createdAt: string
  step: string
  trigger: CheckpointReason
  commitHash?: string
  snapshotPath: string
}

type CheckpointReason =
  | 'manual'
  | 'step_complete'
  | 'context_warning'
  | 'error_recovery'
  | 'time_limit'
  | 'task_complete'
  | 'session_end'

interface SessionListItem {
  id: string
  feature: string
  startedAt: string
  endedAt: string | null
  duration: string
  status: LongRunningSession['status']
  stepsCompleted: number
  stepsTotal: number
}
```

### 11.2 Estrutura de Arquivos

```
.claude/plans/features/<feature-name>/
├── progress.md              # Status geral (existente)
├── state.json               # Estado unificado (existente)
├── history.json             # Histórico transições (existente)
├── claude-progress.txt      # NOVO: Handoff document plain-text
├── sessions/                # NOVO: Pasta de sessões
│   ├── session-20260122-103000.json
│   └── session-20260122-143000.json
└── .snapshots/              # Snapshots (existente)
    └── ...
```

### 11.3 Comandos CLI

```bash
adk agent run <name> --resume
adk agent run <name> --resume --session <session-id>
adk agent sessions <feature>
adk agent sessions <feature> --latest
adk agent sessions <feature> --id <session-id>
adk feature implement <name> --resume
```

### 11.4 Output Esperado

**`adk agent sessions auth-feature`:**
```
Sessions for feature: auth-feature

ID                          Started              Duration    Status       Progress
──────────────────────────────────────────────────────────────────────────────────
session-20260122-143000     2026-01-22 14:30     2h 15m      interrupted  5/8 (62%)
session-20260122-103000     2026-01-22 10:30     1h 45m      completed    8/8 (100%)
session-20260121-160000     2026-01-21 16:00     0h 30m      error        2/8 (25%)

Use: adk agent run <name> --resume to continue the latest session
```

---

## 12. Referências

- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [ADK Unified Analysis v4.3](./../../analysis/unified-analysis.md)
- [Code Review v3.0 - Seção 8.2](./../../analysis/unified-analysis.md#82-sessionmanager---revisao-critica)
- [Fase 0: Enforcement Hooks](./../../adk-v2/README.md)

---

## 13. Changelog

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-01-22 | 1.0 | Criação inicial do PRD |

---

**Aprovações:**

| Papel | Nome | Data | Status |
|-------|------|------|--------|
| Product Owner | [A DEFINIR] | - | Pendente |
| Tech Lead | [A DEFINIR] | - | Pendente |
| Arquiteto | [A DEFINIR] | - | Pendente |
