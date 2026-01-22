# Tasks: adk-v2-fase2 - Session Management

**Feature:** Session Management for Long-Running Agents
**Created:** 2026-01-21
**Status:** Pendente
**Total Tasks:** 24

---

## Fase 2.1: Foundation (Types & Templates)

### Task 1: Criar tipos TypeScript para Session Management
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: `src/types/session.ts`
- Acceptance Criteria:
  - [ ] Interface `LongRunningSession` com campos: id, feature, startedAt, lastActivity, currentStep, completedSteps, pendingSteps, contextSummary, checkpoints, status
  - [ ] Interface `CheckpointRef` com campos: id, createdAt, step, trigger, commitHash?, snapshotPath
  - [ ] Type `CheckpointReason` com valores: manual, step_complete, context_warning, error_recovery, time_limit, task_complete, session_end
  - [ ] Interface `SessionListItem` para listagem CLI
  - [ ] Exportados corretamente do módulo

### Task 2: Testes unitários para parsing de claude-progress.txt
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1
- Arquivo: `tests/utils/handoff-parser.test.ts`
- Acceptance Criteria:
  - [ ] Teste parse de documento vazio retorna defaults
  - [ ] Teste parse de documento completo extrai todas seções (CURRENT, DONE, IN PROGRESS, NEXT, FILES, ISSUES)
  - [ ] Teste parse de documento malformado não quebra (graceful degradation)
  - [ ] Teste extração de lista DONE com múltiplos itens
  - [ ] Teste extração de porcentagem do CURRENT
  - [ ] Cobertura >= 90%

### Task 3: Implementar parser de claude-progress.txt
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1, Task 2
- Arquivo: `src/utils/handoff-parser.ts`
- Acceptance Criteria:
  - [ ] Função `parseHandoffDocument(content: string)` retorna objeto estruturado
  - [ ] Extrai seção CURRENT com task e progress
  - [ ] Extrai lista DONE como array de strings
  - [ ] Extrai lista IN PROGRESS como array de strings
  - [ ] Extrai lista NEXT ordenada como array de strings
  - [ ] Extrai FILES como array de caminhos
  - [ ] Extrai ISSUES (None blocking ou descrição)
  - [ ] Fallback para valores default em caso de erro
  - [ ] Todos os testes de Task 2 passando

### Task 4: Criar template claude-progress.txt
- Tipo: Config
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: `templates/claude-progress.txt`
- Acceptance Criteria:
  - [ ] Template com formato plain-text conforme PRD Seção 2.3
  - [ ] Seções: CURRENT, DONE, IN PROGRESS, NEXT, FILES, ISSUES
  - [ ] Placeholders claros para substituição
  - [ ] Tamanho < 500 bytes

---

## Fase 2.2: StateManager Session Methods

### Task 5: Testes para `listSessions()`
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1
- Arquivo: `tests/utils/session-management.test.ts`
- Acceptance Criteria:
  - [ ] Teste retorna array vazio quando não há sessions/
  - [ ] Teste retorna lista ordenada por data (mais recente primeiro)
  - [ ] Teste preenche campos: id, feature, startedAt, endedAt, duration, status, stepsCompleted, stepsTotal
  - [ ] Teste limita resultados (default 10)
  - [ ] Teste filtra sessões corrompidas
  - [ ] Performance: < 100ms para 10 sessões

### Task 6: Implementar `listSessions()` no StateManager
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1, Task 5
- Arquivo: `src/utils/state-manager.ts`
- Acceptance Criteria:
  - [ ] Método `async listSessions(feature: string, limit?: number): Promise<SessionListItem[]>`
  - [ ] Lê pasta `sessions/` dentro do feature
  - [ ] Parseia cada session-*.json
  - [ ] Ordena por startedAt DESC
  - [ ] Aplica limit (default 10)
  - [ ] Todos os testes de Task 5 passando

### Task 7: Testes para `getLatestSession()`
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 5, Task 6
- Arquivo: `tests/utils/session-management.test.ts` (adicionar)
- Acceptance Criteria:
  - [ ] Teste retorna null quando não há sessões
  - [ ] Teste retorna sessão mais recente
  - [ ] Teste retorna sessão com status 'interrupted' para resume
  - [ ] Teste ignora sessões 'completed'

### Task 8: Implementar `getLatestSession()` no StateManager
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 6, Task 7
- Arquivo: `src/utils/state-manager.ts`
- Acceptance Criteria:
  - [ ] Método `async getLatestSession(feature: string): Promise<LongRunningSession | null>`
  - [ ] Reutiliza `listSessions()` com limit 1
  - [ ] Carrega session completo do JSON
  - [ ] Retorna null se nenhuma sessão

### Task 9: Testes para `createContextSummary()`
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1
- Arquivo: `tests/utils/session-management.test.ts` (adicionar)
- Acceptance Criteria:
  - [ ] Teste gera resumo de feature sem progresso
  - [ ] Teste inclui tasks completadas no resumo
  - [ ] Teste inclui current phase no resumo
  - [ ] Teste inclui arquivos modificados
  - [ ] Teste limita tamanho do resumo (< 2000 chars)
  - [ ] Teste formato plain-text legível

### Task 10: Implementar `createContextSummary()` no StateManager
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 9
- Arquivo: `src/utils/state-manager.ts`
- Acceptance Criteria:
  - [ ] Método `async createContextSummary(feature: string): Promise<string>`
  - [ ] Carrega unified state
  - [ ] Formata resumo com: fase atual, % progresso, tasks done, tasks pending
  - [ ] Inclui últimos arquivos modificados (de progress.md)
  - [ ] Limita a 2000 chars
  - [ ] Todos os testes de Task 9 passando

### Task 11: Testes para `createHandoffDocument()`
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 3, Task 4
- Arquivo: `tests/utils/session-management.test.ts` (adicionar)
- Acceptance Criteria:
  - [ ] Teste gera documento no formato plain-text
  - [ ] Teste inclui seção CURRENT com task atual
  - [ ] Teste inclui seção DONE com tasks completadas
  - [ ] Teste inclui seção NEXT com próximas tasks
  - [ ] Teste inclui seção FILES com arquivos modificados
  - [ ] Teste ISSUES é "None blocking" quando sem issues

### Task 12: Implementar `createHandoffDocument()` no StateManager
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 3, Task 4, Task 11
- Arquivo: `src/utils/state-manager.ts`
- Acceptance Criteria:
  - [ ] Método `async createHandoffDocument(feature: string): Promise<string>`
  - [ ] Carrega unified state
  - [ ] Usa template de `templates/claude-progress.txt`
  - [ ] Preenche seções CURRENT, DONE, IN PROGRESS, NEXT, FILES, ISSUES
  - [ ] Salva em `claude-progress.txt` no feature path
  - [ ] Retorna conteúdo gerado
  - [ ] Todos os testes de Task 11 passando

### Task 13: Testes para `resumeFromSnapshot()`
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1, Task 8
- Arquivo: `tests/utils/session-management.test.ts` (adicionar)
- Acceptance Criteria:
  - [ ] Teste resume de snapshot específico por ID
  - [ ] Teste resume do último snapshot (sem ID)
  - [ ] Teste erro quando snapshot não existe
  - [ ] Teste restaura state corretamente
  - [ ] Teste atualiza lastActivity
  - [ ] Performance: < 500ms

### Task 14: Implementar `resumeFromSnapshot()` no StateManager
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 13
- Arquivo: `src/utils/state-manager.ts`
- Acceptance Criteria:
  - [ ] Método `async resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState>`
  - [ ] Usa SnapshotManager.restoreSnapshot() existente
  - [ ] Carrega session correspondente se existir
  - [ ] Atualiza lastActivity para agora
  - [ ] Retorna state unificado
  - [ ] Todos os testes de Task 13 passando

---

## Fase 2.3: CLI Integration

### Task 15: Testes para `adk agent sessions <feature>`
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 6
- Arquivo: `tests/commands/agent-sessions.test.ts`
- Acceptance Criteria:
  - [ ] Teste lista sessões formatada em tabela
  - [ ] Teste mensagem quando não há sessões
  - [ ] Teste flag `--latest` mostra detalhes da última
  - [ ] Teste flag `--id <session-id>` mostra sessão específica
  - [ ] Teste erro quando feature não existe

### Task 16: Implementar comando `adk agent sessions`
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 6, Task 8, Task 15
- Arquivo: `src/commands/agent.ts`
- Acceptance Criteria:
  - [ ] Método `async sessions(feature: string, options: SessionOptions)`
  - [ ] Lista sessões usando StateManager.listSessions()
  - [ ] Formata tabela com: ID, Started, Duration, Status, Progress
  - [ ] Flag `--latest` usa StateManager.getLatestSession()
  - [ ] Sugere `--resume` quando há sessão interrompida
  - [ ] Registrado em `src/cli.ts`
  - [ ] Todos os testes de Task 15 passando

### Task 17: Testes para flag `--resume` em `adk agent run`
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 14
- Arquivo: `tests/commands/agent-resume.test.ts`
- Acceptance Criteria:
  - [ ] Teste --resume carrega último snapshot
  - [ ] Teste --resume injeta contexto no prompt
  - [ ] Teste --resume falha gracefully quando não há sessão
  - [ ] Teste --resume --session <id> carrega sessão específica
  - [ ] Teste detecta sessão pendente e sugere --resume

### Task 18: Implementar flag `--resume` em `adk agent run`
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 14, Task 17
- Arquivo: `src/commands/agent.ts`
- Acceptance Criteria:
  - [ ] Flag `--resume` na options de `run()`
  - [ ] Se --resume, carrega via StateManager.resumeFromSnapshot()
  - [ ] Injeta contextSummary no prompt do agente
  - [ ] Lê claude-progress.txt e adiciona ao contexto
  - [ ] Detecta sessão pendente e sugere --resume (via getLatestSession)
  - [ ] Todos os testes de Task 17 passando

### Task 19: Testes para flag `--resume` em `adk feature implement`
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 14
- Arquivo: `tests/commands/feature-resume.test.ts`
- Acceptance Criteria:
  - [ ] Teste --resume carrega último estado
  - [ ] Teste --resume exibe resumo antes de continuar
  - [ ] Teste --resume falha gracefully quando não há estado
  - [ ] Teste prompt interativo para confirmar resume

### Task 20: Implementar flag `--resume` em `adk feature implement`
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 14, Task 19
- Arquivo: `src/commands/feature.ts`
- Acceptance Criteria:
  - [ ] Flag `--resume` na options de `implement()`
  - [ ] Detecta sessão pendente e oferece resume
  - [ ] Carrega state via StateManager.resumeFromSnapshot()
  - [ ] Exibe resumo do progresso antes de continuar
  - [ ] Modifica prompt para incluir contexto
  - [ ] Todos os testes de Task 19 passando

---

## Fase 2.4: Hooks & Automation

### Task 21: Testes para hook task-complete.sh
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 12
- Arquivo: `tests/hooks/task-complete.test.ts`
- Acceptance Criteria:
  - [ ] Teste detecta conclusão de task (via grep em commit message)
  - [ ] Teste atualiza claude-progress.txt
  - [ ] Teste cria snapshot com reason 'task_complete'
  - [ ] Teste registra em history.json
  - [ ] Teste não quebra quando arquivos faltam (fail-silent)

### Task 22: Criar hook task-complete.sh
- Tipo: Config
- Prioridade: P1
- Dependencias: Task 12, Task 21
- Arquivo: `.claude/hooks/task-complete.sh`
- Acceptance Criteria:
  - [ ] Detecta PostToolUse (git commit)
  - [ ] Extrai task do commit message
  - [ ] Chama StateManager para criar handoff
  - [ ] Cria snapshot via SnapshotManager
  - [ ] Registra transição via HistoryTracker
  - [ ] Atualiza sessions/session-*.json
  - [ ] Executável (chmod +x)
  - [ ] Registrado em `.claude/settings.json`

### Task 23: Registrar hook task-complete em settings.json
- Tipo: Config
- Prioridade: P1
- Dependencias: Task 22
- Arquivo: `.claude/settings.json`
- Acceptance Criteria:
  - [ ] Hook registrado em PostToolUse com matcher "Bash" (git commit)
  - [ ] Path correto: `.claude/hooks/task-complete.sh`
  - [ ] Não quebra hooks existentes

---

## Fase 2.5: Integration & Documentation

### Task 24: Testes E2E do fluxo session completo
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 18, Task 20, Task 22
- Arquivo: `tests/e2e/session-management.e2e.test.ts`
- Acceptance Criteria:
  - [ ] Teste ciclo: start → checkpoint → resume → complete
  - [ ] Teste recovery de sessão interrompida
  - [ ] Teste múltiplas sessões para mesma feature
  - [ ] Teste backward compatibility com features pre-v2
  - [ ] Teste cleanup automático (max 10 sessões)

---

## Resumo de Métricas

| Métrica | Target |
|---------|--------|
| Total Tasks | 24 |
| Tasks P0 | 14 |
| Tasks P1 | 9 |
| Tasks P2 | 1 |
| Cobertura Testes | >= 80% |
| Performance Resume | < 500ms |
| Performance List | < 100ms |

---

## Ordem de Execução (TDD Flow)

```
Phase 1: Types
  └─ Task 1 (types) → Task 4 (template)

Phase 2: Parser
  └─ Task 2 (tests) → Task 3 (impl)

Phase 3: StateManager Core
  └─ Task 5 (tests) → Task 6 (listSessions)
  └─ Task 7 (tests) → Task 8 (getLatestSession)
  └─ Task 9 (tests) → Task 10 (createContextSummary)
  └─ Task 11 (tests) → Task 12 (createHandoffDocument)
  └─ Task 13 (tests) → Task 14 (resumeFromSnapshot)

Phase 4: CLI
  └─ Task 15 (tests) → Task 16 (agent sessions)
  └─ Task 17 (tests) → Task 18 (agent --resume)
  └─ Task 19 (tests) → Task 20 (feature --resume)

Phase 5: Hooks
  └─ Task 21 (tests) → Task 22 (task-complete.sh) → Task 23 (settings)

Phase 6: Integration
  └─ Task 24 (E2E tests)
```

---

## Notas

1. **TDD First:** Cada task de implementação tem uma task de teste correspondente que DEVE ser completada primeiro

2. **Atomic Tasks:** Cada task representa 1-2 horas de trabalho focado

3. **Dependencies:** Seguir ordem de dependências para evitar bloqueios

4. **Performance:** Validar targets de performance em cada implementação

5. **Backward Compatibility:** Manter compatibilidade com features existentes (StateManager já tem graceful degradation)
