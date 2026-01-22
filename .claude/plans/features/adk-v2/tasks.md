# Tasks: ADK v2 - Tecnicas Avancadas para Agentes de Longa Duracao

**Feature:** adk-v2
**Data:** 2026-01-21
**Total Tasks:** 78
**Prioridades:** P0 (Bloqueador) | P1 (Core) | P2 (Enhancement)

---

## Fase 0: Hooks de Enforcement (Imediato)

### Task 0.1: Testes para SessionStart Hook
- Tipo: Test
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: `tests/hooks/session-bootstrap.test.ts`
- Acceptance Criteria:
  - [ ] Testa injecao de contexto no inicio de sessao
  - [ ] Testa carregamento de active-focus.md
  - [ ] Testa carregamento de constraints.md da feature ativa
  - [ ] Testa fallback quando arquivos nao existem

### Task 0.2: Implementar SessionStart Hook
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 0.1
- Arquivo: `.claude/hooks/session-bootstrap.sh`
- Acceptance Criteria:
  - [ ] Le active-focus.md e injeta no contexto
  - [ ] Carrega constraints da feature ativa
  - [ ] Executa em < 500ms
  - [ ] Nao bloqueia se arquivos faltarem

### Task 0.3: Testes para Stop Hook (Checkpoint)
- Tipo: Test
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: `tests/hooks/session-checkpoint.test.ts`
- Acceptance Criteria:
  - [ ] Testa criacao de snapshot automatico
  - [ ] Testa atualizacao de claude-progress.txt
  - [ ] Testa graceful degradation em erro

### Task 0.4: Implementar Stop Hook (Checkpoint)
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 0.3
- Arquivo: `.claude/hooks/session-checkpoint.sh`
- Acceptance Criteria:
  - [ ] Cria snapshot da feature ativa
  - [ ] Atualiza claude-progress.txt com estado atual
  - [ ] Async execution (nao bloqueia finalizacao)
  - [ ] Timeout maximo de 2s

### Task 0.5: Testes para TDD Validation Hook
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `tests/hooks/validate-tdd.test.ts`
- Acceptance Criteria:
  - [ ] Testa deteccao de arquivo src/ sendo criado
  - [ ] Testa verificacao de teste correspondente
  - [ ] Testa warning (nao bloqueio)
  - [ ] Testa padroes de nome de teste (*.test.*, *.spec.*)

### Task 0.6: Implementar TDD Validation Hook
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 0.5
- Arquivo: `.claude/hooks/validate-tdd.sh`
- Acceptance Criteria:
  - [ ] Warning ao criar arquivo em src/ sem teste
  - [ ] Verifica *.test.ts, *.spec.ts, __tests__/
  - [ ] NAO bloqueia operacao (exit 0 sempre)
  - [ ] Funciona via CLI e Claude Code direto

### Task 0.7: Testes para State Sync Hook
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `tests/hooks/sync-state.test.ts`
- Acceptance Criteria:
  - [ ] Testa sincronizacao apos escrita de arquivo
  - [ ] Testa atualizacao de progress.md
  - [ ] Testa integracao com StateManager

### Task 0.8: Implementar State Sync Hook
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 0.7
- Arquivo: `.claude/hooks/sync-state.sh`
- Acceptance Criteria:
  - [ ] Chama syncProgressState() apos Write/Edit
  - [ ] Atualiza progress.md com arquivos modificados
  - [ ] Async execution
  - [ ] Graceful fallback em erro

### Task 0.9: Atualizar settings.json com Novos Hooks
- Tipo: Config
- Prioridade: P0
- Dependencias: Tasks 0.2, 0.4, 0.6, 0.8
- Arquivo: `.claude/settings.json`
- Acceptance Criteria:
  - [ ] SessionStart hook registrado
  - [ ] Stop hook registrado
  - [ ] PreToolUse (validate-tdd) registrado
  - [ ] PostToolUse (sync-state) registrado
  - [ ] Matchers corretos para cada evento

### Task 0.10: Expandir CLAUDE.md com Tecnicas ADK
- Tipo: Documentation
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: `CLAUDE.md`
- Acceptance Criteria:
  - [ ] Secao "Tecnicas Obrigatorias" adicionada
  - [ ] TDD-first documentado
  - [ ] State sync documentado
  - [ ] Hooks e seus propositos listados

---

## Fase 1: MCP Memory RAG (P0 - Bloqueador)

### Task 1.1: Definir Types para MCP Memory
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Arquivo: `src/types/mcp-memory.ts`
- Acceptance Criteria:
  - [ ] Interface MemoryDocument (id, content, metadata, embedding)
  - [ ] Interface MemoryQuery (query, options: limit, threshold, hybrid)
  - [ ] Interface MemoryResult (documents, scores, timings)
  - [ ] Interface MemoryConfig (provider, storagePath, chunkSize, model)
  - [ ] Type guards para validacao

### Task 1.2: Testes para MemoryMCP Wrapper
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1.1
- Arquivo: `tests/utils/memory-mcp.test.ts`
- Acceptance Criteria:
  - [ ] Testa index(content, metadata)
  - [ ] Testa recall(query, options)
  - [ ] Testa busca hibrida (semantic + keyword)
  - [ ] Testa fallback para keyword search
  - [ ] Testa connection error handling
  - [ ] Testa response time < 100ms mock

### Task 1.3: Implementar MemoryMCP Wrapper
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1.2
- Arquivo: `src/utils/memory-mcp.ts`
- Acceptance Criteria:
  - [ ] Metodo index(content, metadata) funcional
  - [ ] Metodo recall(query, options) funcional
  - [ ] Conexao com MCP server configuravel
  - [ ] Fallback para simpleSearch em caso de erro
  - [ ] Logging de performance metrics

### Task 1.4: Criar Schema de Configuracao MCP Memory
- Tipo: Config
- Prioridade: P0
- Dependencias: Task 1.1
- Arquivo: `.adk/memory.json`
- Acceptance Criteria:
  - [ ] Schema Zod para validacao
  - [ ] provider: string (mcp-local-rag | mcp-memory-service)
  - [ ] storagePath: string (default: .adk/memory.db)
  - [ ] chunkSize: number (default: 512)
  - [ ] embeddingModel: string
  - [ ] hybridSearch: boolean (default: true)

### Task 1.5: Testes para Comando memory index
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1.3
- Arquivo: `tests/commands/memory-index.test.ts`
- Acceptance Criteria:
  - [ ] Testa indexacao de arquivo individual
  - [ ] Testa indexacao de diretorio
  - [ ] Testa filtro por extensao
  - [ ] Testa skip de arquivos binarios
  - [ ] Testa idempotencia (re-index)

### Task 1.6: Implementar Comando memory index
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1.5
- Arquivo: `src/commands/memory.ts` (modificar)
- Acceptance Criteria:
  - [ ] Subcomando `adk memory index --file <path>`
  - [ ] Subcomando `adk memory index --dir <path>`
  - [ ] Opcao --filter para extensoes
  - [ ] Spinner com progresso
  - [ ] Resumo de arquivos indexados

### Task 1.7: Testes para Comando memory recall (semantico)
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1.3
- Arquivo: `tests/commands/memory-recall.test.ts`
- Acceptance Criteria:
  - [ ] Testa recall semantico
  - [ ] Testa recall hibrido
  - [ ] Testa limite de resultados
  - [ ] Testa formatacao de output
  - [ ] Testa query cross-language (auth -> autenticacao)

### Task 1.8: Modificar Comando memory recall para Semantico
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1.7
- Arquivo: `src/commands/memory.ts` (modificar)
- Acceptance Criteria:
  - [ ] Usa MCP Memory para busca semantica
  - [ ] Fallback para keyword search se MCP falhar
  - [ ] Opcao --hybrid para busca combinada
  - [ ] Opcao --limit para numero de resultados
  - [ ] Output formatado com scores

### Task 1.9: Testes para Post-Write Index Hook
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 1.3
- Arquivo: `tests/hooks/post-write-index.test.ts`
- Acceptance Criteria:
  - [ ] Testa indexacao automatica de .claude/*
  - [ ] Testa skip de arquivos fora do escopo
  - [ ] Testa async execution (nao bloqueia)
  - [ ] Testa debounce de multiplas escritas

### Task 1.10: Implementar Post-Write Index Hook
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 1.9
- Arquivo: `.claude/hooks/post-write-index.sh`
- Acceptance Criteria:
  - [ ] Indexa arquivos .claude/* automaticamente
  - [ ] Execucao async (background)
  - [ ] Queue de indexacao com debounce
  - [ ] Log de arquivos indexados

### Task 1.11: Integrar MCP Server no settings.json
- Tipo: Config
- Prioridade: P0
- Dependencias: Tasks 1.3, 1.4
- Arquivo: `.claude/mcp.json`
- Acceptance Criteria:
  - [ ] MCP server configurado
  - [ ] Connection string definida
  - [ ] Tools expostos (index, recall)

---

## Fase 2: Session Management (P1)

### Task 2.1: Definir Types de Sessao
- Tipo: Implementation
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `src/types/session.ts`
- Acceptance Criteria:
  - [ ] Interface SessionState (id, feature, startedAt, checkpoints)
  - [ ] Interface SessionCheckpoint (timestamp, reason, snapshotId, commitHash)
  - [ ] Interface SessionSummary (tasks completed, files modified, decisions)
  - [ ] Enum CheckpointReason (manual, step_complete, context_warning, error_recovery, task_complete)
  - [ ] Type guards

### Task 2.2: Testes para StateManager.resumeFromSnapshot
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 2.1
- Arquivo: `tests/utils/state-manager-resume.test.ts`
- Acceptance Criteria:
  - [ ] Testa resume do ultimo snapshot
  - [ ] Testa resume de snapshot especifico
  - [ ] Testa restauracao de estado completo
  - [ ] Testa error handling (snapshot nao existe)

### Task 2.3: Implementar StateManager.resumeFromSnapshot
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 2.2
- Arquivo: `src/utils/state-manager.ts` (modificar)
- Acceptance Criteria:
  - [ ] Metodo resumeFromSnapshot(feature, snapshotId?)
  - [ ] Restaura state.json do snapshot
  - [ ] Restaura progress.md e tasks.md
  - [ ] Cria pre-resume snapshot automatico
  - [ ] Registra transicao no HistoryTracker

### Task 2.4: Testes para StateManager.createContextSummary
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 2.1
- Arquivo: `tests/utils/state-manager-summary.test.ts`
- Acceptance Criteria:
  - [ ] Testa geracao de summary completo
  - [ ] Testa formato plain text
  - [ ] Testa inclusao de tasks, decisions, files

### Task 2.5: Implementar StateManager.createContextSummary
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 2.4
- Arquivo: `src/utils/state-manager.ts` (modificar)
- Acceptance Criteria:
  - [ ] Metodo createContextSummary(feature)
  - [ ] Gera plain text com secoes: Summary, Current State, Pending Steps, Key Decisions, Files Modified, Next Actions
  - [ ] Limita tamanho (max 2000 tokens)
  - [ ] Prioriza informacoes recentes

### Task 2.6: Criar Template claude-progress.txt
- Tipo: Implementation
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `templates/claude-progress.txt`
- Acceptance Criteria:
  - [ ] Formato plain text (nao markdown)
  - [ ] Secoes: CURRENT TASK, COMPLETED, PENDING, BLOCKERS, CONTEXT
  - [ ] Placeholders para substituicao dinamica
  - [ ] Legivel por humanos e LLMs

### Task 2.7: Testes para Flag --resume no Agent
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 2.3
- Arquivo: `tests/commands/agent-resume.test.ts`
- Acceptance Criteria:
  - [ ] Testa retomada de sessao com --resume
  - [ ] Testa carregamento de contexto do snapshot
  - [ ] Testa erro quando nao ha snapshot

### Task 2.8: Implementar Flag --resume no Agent
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 2.7
- Arquivo: `src/commands/agent.ts` (modificar)
- Acceptance Criteria:
  - [ ] Flag --resume no comando run
  - [ ] Chama StateManager.resumeFromSnapshot()
  - [ ] Injeta summary no prompt do agente
  - [ ] Mostra resumo do ponto de retomada

### Task 2.9: Testes para Comando agent sessions
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 2.1
- Arquivo: `tests/commands/agent-sessions.test.ts`
- Acceptance Criteria:
  - [ ] Testa listagem de sessoes
  - [ ] Testa filtro por feature
  - [ ] Testa ordenacao por data

### Task 2.10: Implementar Comando agent sessions
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 2.9
- Arquivo: `src/commands/agent.ts` (modificar)
- Acceptance Criteria:
  - [ ] Subcomando `adk agent sessions <feature>`
  - [ ] Lista snapshots com timestamps
  - [ ] Mostra checkpoint reasons
  - [ ] Permite selecionar para --resume

---

## Fase 3: Context Compactor (P1)

### Task 3.1: Definir Types para Context Compactor
- Tipo: Implementation
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `src/types/context-compactor.ts`
- Acceptance Criteria:
  - [ ] Interface TokenEstimate (count, method, confidence)
  - [ ] Interface CompactionResult (original, compacted, ratio, method)
  - [ ] Interface HandoffDocument (summary, state, pending, decisions, files, nextActions)
  - [ ] Enum CompactionMethod (none, reversible, summarization)
  - [ ] Type guards

### Task 3.2: Testes para Token Counter
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 3.1
- Arquivo: `tests/utils/token-counter.test.ts`
- Acceptance Criteria:
  - [ ] Testa estimativa via API (mock)
  - [ ] Testa fallback offline (tiktoken/chars)
  - [ ] Testa cache com hash de conteudo
  - [ ] Testa precisao >= 95% vs baseline

### Task 3.3: Implementar Token Counter
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3.2
- Arquivo: `src/utils/token-counter.ts`
- Acceptance Criteria:
  - [ ] Metodo estimateTokens(text): TokenEstimate
  - [ ] API Anthropic como primary (se disponivel)
  - [ ] tiktoken como fallback
  - [ ] chars/4 como ultimo recurso
  - [ ] Cache com hash MD5 do conteudo

### Task 3.4: Testes para shouldCompact
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 3.3
- Arquivo: `tests/utils/context-compactor-should.test.ts`
- Acceptance Criteria:
  - [ ] Testa threshold de 80%
  - [ ] Testa false quando abaixo do threshold
  - [ ] Testa true quando acima

### Task 3.5: Implementar shouldCompact
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3.4
- Arquivo: `src/utils/context-compactor.ts`
- Acceptance Criteria:
  - [ ] Metodo shouldCompact(currentTokens, maxTokens): boolean
  - [ ] Threshold configuravel (default 80%)
  - [ ] Retorna info sobre margin restante

### Task 3.6: Testes para Compactacao Hierarquica
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 3.5
- Arquivo: `tests/utils/context-compactor-hierarchy.test.ts`
- Acceptance Criteria:
  - [ ] Testa compactacao reversivel primeiro
  - [ ] Testa summarization apenas quando necessario
  - [ ] Testa preservacao de informacoes criticas
  - [ ] Testa arquivamento via MCP Memory

### Task 3.7: Implementar Compactacao Hierarquica
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3.6
- Arquivo: `src/utils/context-compactor.ts` (modificar)
- Acceptance Criteria:
  - [ ] Metodo compact(context, targetTokens)
  - [ ] Hierarquia: raw -> reversible -> summarization
  - [ ] Arquiva contexto removido no MCP Memory
  - [ ] Retorna CompactionResult com detalhes

### Task 3.8: Testes para Handoff Document Generator
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 3.1
- Arquivo: `tests/utils/context-compactor-handoff.test.ts`
- Acceptance Criteria:
  - [ ] Testa geracao de plain text
  - [ ] Testa todas as secoes obrigatorias
  - [ ] Testa limite de tamanho

### Task 3.9: Implementar Handoff Document Generator
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3.8
- Arquivo: `src/utils/context-compactor.ts` (modificar)
- Acceptance Criteria:
  - [ ] Metodo generateHandoff(feature): string
  - [ ] Secoes: Summary, Current State, Pending Steps, Key Decisions, Files Modified, Next Actions
  - [ ] Formato plain text legivel
  - [ ] Maximo de 2000 tokens

### Task 3.10: Integrar Compactor com Hook Stop
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Tasks 0.4, 3.7, 3.9
- Arquivo: `.claude/hooks/session-checkpoint.sh` (modificar)
- Acceptance Criteria:
  - [ ] Verifica shouldCompact antes de checkpoint
  - [ ] Gera handoff se necessario
  - [ ] Arquiva contexto no MCP Memory

---

## Fase 4: Constitution/Steering (P2)

### Task 4.1: Criar Template constitution.md
- Tipo: Implementation
- Prioridade: P2
- Dependencias: nenhuma
- Arquivo: `templates/constitution.md`
- Acceptance Criteria:
  - [ ] Secao "Principios Imutaveis"
  - [ ] Secao "Restricoes Absolutas"
  - [ ] Secao "Padroes de Qualidade"
  - [ ] Formato estruturado para validacao

### Task 4.2: Criar Template context/*.md
- Tipo: Implementation
- Prioridade: P2
- Dependencias: nenhuma
- Arquivos: `templates/context/product.md`, `templates/context/architecture.md`, `templates/context/tech-stack.md`
- Acceptance Criteria:
  - [ ] product.md: visao, objetivos, stakeholders
  - [ ] architecture.md: patterns, camadas, decisoes
  - [ ] tech-stack.md: linguagens, frameworks, dependencias
  - [ ] Placeholders para customizacao

### Task 4.3: Definir Schema de Powers
- Tipo: Implementation
- Prioridade: P2
- Dependencias: nenhuma
- Arquivo: `src/types/powers.ts`
- Acceptance Criteria:
  - [ ] Interface Power (name, triggers, steeringFile, tools, contextFiles)
  - [ ] Interface PowersConfig (powers[], defaultPower)
  - [ ] Type guards para validacao

### Task 4.4: Criar Powers Iniciais
- Tipo: Config
- Prioridade: P2
- Dependencias: Task 4.3
- Arquivos: `.claude/powers/security.json`, `.claude/powers/testing.json`, `.claude/powers/database.json`
- Acceptance Criteria:
  - [ ] security.json: triggers [auth, security, password, token]
  - [ ] testing.json: triggers [test, tdd, coverage, spec]
  - [ ] database.json: triggers [db, query, migration, schema]
  - [ ] Cada power aponta para steering file e context files

### Task 4.5: Testes para ContextLoader
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 4.3
- Arquivo: `tests/utils/context-loader.test.ts`
- Acceptance Criteria:
  - [ ] Testa deteccao de keywords no prompt
  - [ ] Testa carregamento de power correto
  - [ ] Testa merge de multiplos powers
  - [ ] Testa fallback quando nenhum power match

### Task 4.6: Implementar ContextLoader
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 4.5
- Arquivo: `src/utils/context-loader.ts`
- Acceptance Criteria:
  - [ ] Metodo loadForPrompt(prompt): LoadedContext
  - [ ] Detecta triggers no prompt
  - [ ] Carrega steering files e context files
  - [ ] Merge de powers quando multiplos match
  - [ ] Cache de powers carregados (LRU)

### Task 4.7: Testes para Comando validate
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 4.1
- Arquivo: `tests/commands/validate.test.ts`
- Acceptance Criteria:
  - [ ] Testa validacao contra constitution
  - [ ] Testa deteccao de violacoes
  - [ ] Testa flag --fix
  - [ ] Testa output formatado

### Task 4.8: Implementar Comando validate
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 4.7
- Arquivo: `src/commands/validate.ts`
- Acceptance Criteria:
  - [ ] Comando `adk validate` funcional
  - [ ] Le constitution.md e verifica codigo
  - [ ] Lista violacoes com referencias
  - [ ] Flag --fix sugere correcoes
  - [ ] Exit code 1 se violacoes criticas

### Task 4.9: Registrar Comando validate no CLI
- Tipo: Config
- Prioridade: P2
- Dependencias: Task 4.8
- Arquivo: `src/cli.ts` (modificar)
- Acceptance Criteria:
  - [ ] Comando registrado
  - [ ] Help text descritivo
  - [ ] Options documentadas

---

## Fase 5: Git Commits como Checkpoints (P1)

### Task 5.1: Testes para Hook task-complete
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `tests/hooks/task-complete.test.ts`
- Acceptance Criteria:
  - [ ] Testa criacao de commit apos task
  - [ ] Testa formato de mensagem
  - [ ] Testa atualizacao de progress.txt antes do commit
  - [ ] Testa skip quando nao ha mudancas

### Task 5.2: Implementar Hook task-complete
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.1
- Arquivo: `.claude/hooks/task-complete.sh`
- Acceptance Criteria:
  - [ ] Commit atomico apos cada task
  - [ ] Formato: feat(feature): complete task-name
  - [ ] Atualiza claude-progress.txt antes
  - [ ] Nao commita se nao ha staged changes

### Task 5.3: Testes para Hook check-task-complete
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `tests/hooks/check-task-complete.test.ts`
- Acceptance Criteria:
  - [ ] Testa deteccao de task completion
  - [ ] Testa patterns de deteccao
  - [ ] Testa trigger do hook task-complete

### Task 5.4: Implementar Hook check-task-complete
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.3
- Arquivo: `.claude/hooks/check-task-complete.sh`
- Acceptance Criteria:
  - [ ] Detecta markers de task completion
  - [ ] Patterns: "Task X completed", checkbox marked
  - [ ] Chama task-complete hook quando detectado

### Task 5.5: Testes para StateManager.completeTask
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Arquivo: `tests/utils/state-manager-complete.test.ts`
- Acceptance Criteria:
  - [ ] Testa marcacao de task como completed
  - [ ] Testa criacao de checkpoint
  - [ ] Testa registro no HistoryTracker
  - [ ] Testa inclusao de commit hash

### Task 5.6: Implementar StateManager.completeTask
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.5
- Arquivo: `src/utils/state-manager.ts` (modificar)
- Acceptance Criteria:
  - [ ] Metodo completeTask(feature, taskName)
  - [ ] Atualiza tasks.md e progress.md
  - [ ] Cria checkpoint com reason: task_complete
  - [ ] Registra commit hash no history.json

### Task 5.7: Testes para Flag --commit no Feature Implement
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 5.6
- Arquivo: `tests/commands/feature-commit.test.ts`
- Acceptance Criteria:
  - [ ] Testa ativacao de commits automaticos
  - [ ] Testa desativacao com --no-commit

### Task 5.8: Implementar Flag --commit no Feature Implement
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.7
- Arquivo: `src/commands/feature.ts` (modificar)
- Acceptance Criteria:
  - [ ] Flag --commit (default: true)
  - [ ] Flag --no-commit para desativar
  - [ ] Integra com hook task-complete

---

## Fase 6: Resiliencia e Observabilidade (P2)

### Task 6.1: Definir Types de Resiliencia
- Tipo: Implementation
- Prioridade: P2
- Dependencias: nenhuma
- Arquivo: `src/types/resilience.ts`
- Acceptance Criteria:
  - [ ] Interface CircuitBreakerConfig (threshold, timeout, halfOpenMax)
  - [ ] Enum CircuitState (closed, open, half_open)
  - [ ] Interface FallbackChain (handlers[])

### Task 6.2: Testes para Circuit Breaker
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 6.1
- Arquivo: `tests/utils/circuit-breaker.test.ts`
- Acceptance Criteria:
  - [ ] Testa transicao closed -> open
  - [ ] Testa transicao open -> half_open
  - [ ] Testa transicao half_open -> closed
  - [ ] Testa threshold de falhas (5)
  - [ ] Testa timeout (1 min)

### Task 6.3: Implementar Circuit Breaker
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 6.2
- Arquivo: `src/utils/circuit-breaker.ts`
- Acceptance Criteria:
  - [ ] Classe AgentCircuitBreaker
  - [ ] Estados: closed, open, half_open
  - [ ] Threshold de 5 falhas
  - [ ] Timeout de 1 minuto
  - [ ] Metodo execute(fn) com state machine

### Task 6.4: Expandir withRetry com Jitter
- Tipo: Implementation
- Prioridade: P2
- Dependencias: nenhuma
- Arquivo: `src/utils/retry.ts` (modificar)
- Acceptance Criteria:
  - [ ] Adicionar jitter ao backoff
  - [ ] Opcao jitterFactor (default 0.3)
  - [ ] Manter backward compatibility

### Task 6.5: Testes para Memory Pruner
- Tipo: Test
- Prioridade: P2
- Dependencias: nenhuma
- Arquivo: `tests/utils/memory-pruner.test.ts`
- Acceptance Criteria:
  - [ ] Testa limite de 500 linhas
  - [ ] Testa preservacao de informacoes criticas
  - [ ] Testa arquivamento no MCP Memory
  - [ ] Testa idempotencia

### Task 6.6: Implementar Memory Pruner
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 6.5
- Arquivo: `src/utils/memory-pruner.ts`
- Acceptance Criteria:
  - [ ] Classe MemoryPruner
  - [ ] Limite de 500 linhas para project-context.md
  - [ ] Prune por idade (oldest first)
  - [ ] Preserva secoes marcadas como critical
  - [ ] Arquiva removidos no MCP Memory

### Task 6.7: Testes para Observability (Tracer)
- Tipo: Test
- Prioridade: P2
- Dependencias: nenhuma
- Arquivo: `tests/utils/observability.test.ts`
- Acceptance Criteria:
  - [ ] Testa registro de spans
  - [ ] Testa metricas de tokens
  - [ ] Testa export para console (mock)

### Task 6.8: Implementar ADKTracer
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 6.7
- Arquivo: `src/utils/observability.ts`
- Acceptance Criteria:
  - [ ] Classe ADKTracer
  - [ ] Integracao OpenTelemetry (opcional)
  - [ ] Metodo recordTokenUsage(input, output)
  - [ ] Metodo startSpan/endSpan
  - [ ] Fallback para console logging

### Task 6.9: Testes para Comando diagnostics
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 6.8
- Arquivo: `tests/commands/diagnostics.test.ts`
- Acceptance Criteria:
  - [ ] Testa health check de MCP Memory
  - [ ] Testa status de hooks
  - [ ] Testa metricas de performance

### Task 6.10: Implementar Comando diagnostics
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 6.9
- Arquivo: `src/commands/diagnostics.ts`
- Acceptance Criteria:
  - [ ] Comando `adk diagnostics` funcional
  - [ ] Health check de MCP Memory
  - [ ] Status de todos os hooks
  - [ ] Metricas de circuit breaker
  - [ ] Performance summary

### Task 6.11: Registrar Comando diagnostics no CLI
- Tipo: Config
- Prioridade: P2
- Dependencias: Task 6.10
- Arquivo: `src/cli.ts` (modificar)
- Acceptance Criteria:
  - [ ] Comando registrado
  - [ ] Help text descritivo

---

## Tasks de Integracao e QA

### Task 7.1: Testes de Integracao E2E - Hooks
- Tipo: Test
- Prioridade: P1
- Dependencias: Todas tasks de hooks (Fase 0, 5)
- Arquivo: `tests/integration/hooks.integration.test.ts`
- Acceptance Criteria:
  - [ ] Testa fluxo completo SessionStart -> Stop
  - [ ] Testa TDD validation em cenario real
  - [ ] Testa state sync em multiplas escritas
  - [ ] Testa task-complete com commit

### Task 7.2: Testes de Integracao E2E - Memory
- Tipo: Test
- Prioridade: P0
- Dependencias: Todas tasks de MCP Memory (Fase 1)
- Arquivo: `tests/integration/memory.integration.test.ts`
- Acceptance Criteria:
  - [ ] Testa index -> recall fluxo completo
  - [ ] Testa busca semantica cross-language
  - [ ] Testa fallback para keyword search
  - [ ] Testa performance < 100ms

### Task 7.3: Testes de Integracao E2E - Session
- Tipo: Test
- Prioridade: P1
- Dependencias: Todas tasks de Session (Fase 2)
- Arquivo: `tests/integration/session.integration.test.ts`
- Acceptance Criteria:
  - [ ] Testa create -> checkpoint -> resume
  - [ ] Testa handoff document generation
  - [ ] Testa recovery apos context overflow

### Task 7.4: Atualizar Documentacao CLAUDE.md
- Tipo: Documentation
- Prioridade: P1
- Dependencias: Todas implementacoes core
- Arquivo: `CLAUDE.md` (modificar)
- Acceptance Criteria:
  - [ ] MCP Memory documentado
  - [ ] Session Management documentado
  - [ ] Context Compactor documentado
  - [ ] Todos novos hooks documentados
  - [ ] Comandos novos documentados

### Task 7.5: CI/CD Workflow para Hooks
- Tipo: Config
- Prioridade: P2
- Dependencias: Tasks de testes de hooks
- Arquivo: `.github/workflows/hooks.yml`
- Acceptance Criteria:
  - [ ] Lint de shell scripts
  - [ ] Testes de hooks em CI
  - [ ] Validacao de settings.json

### Task 7.6: Benchmark de MCP Providers
- Tipo: Research
- Prioridade: P0
- Dependencias: Task 1.1
- Arquivo: `.claude/plans/features/adk-v2/mcp-benchmark.md`
- Acceptance Criteria:
  - [ ] Testar @yikizi/mcp-local-rag
  - [ ] Testar mcp-memory-service
  - [ ] Comparar: latencia, recall, setup
  - [ ] Escolha documentada com justificativa

---

## Resumo por Prioridade

### P0 - Bloqueador (20 tasks)
- Task 0.1-0.4, 0.9: Hooks basicos de enforcement
- Task 1.1-1.8, 1.11: MCP Memory RAG completo
- Task 7.2, 7.6: Integracao e benchmark de memory

### P1 - Core (35 tasks)
- Task 0.5-0.8, 0.10: Hooks adicionais
- Task 1.9-1.10: Post-write indexing
- Task 2.1-2.8: Session Management core
- Task 3.1-3.10: Context Compactor
- Task 5.1-5.8: Git Commits como Checkpoints
- Task 7.1, 7.3, 7.4: Integracao e docs

### P2 - Enhancement (23 tasks)
- Task 2.9-2.10: agent sessions command
- Task 4.1-4.9: Constitution/Steering
- Task 6.1-6.11: Resiliencia e Observabilidade
- Task 7.5: CI/CD

---

## Dependencias Criticas

```
MCP Memory RAG (1.1-1.11) ◀── P0 BLOQUEADOR
       │
       ├─────────────────────────────────────┐
       ▼                                     ▼
Session Management (2.1-2.10)         Constitution (4.1-4.9)
       │                                     │
       ▼                                     ▼
Context Compactor (3.1-3.10)          Context Loader (4.5-4.6)
       │
       ▼
Git Checkpoints (5.1-5.8)
       │
       ▼
Resiliencia (6.1-6.11)
```

---

## Estimativa de Esforco

| Fase | Tasks | Complexidade | Estimativa |
|------|-------|--------------|------------|
| Fase 0 | 10 | Media | 2-3 dias |
| Fase 1 | 11 | Alta | 8-10 dias |
| Fase 2 | 10 | Media | 4-5 dias |
| Fase 3 | 10 | Media | 4-5 dias |
| Fase 4 | 9 | Baixa | 3-4 dias |
| Fase 5 | 8 | Media | 3-4 dias |
| Fase 6 | 11 | Media | 4-5 dias |
| Integracao | 6 | Media | 2-3 dias |
| **Total** | **78** | - | **30-39 dias** |

---

**Criado em:** 2026-01-21
**Proximo passo:** Iniciar implementacao pela Fase 0 (Hooks de Enforcement)
