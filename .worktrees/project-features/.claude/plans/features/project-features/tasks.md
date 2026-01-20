# Tasks: project-features

**Data:** 2026-01-20
**Status:** In Progress
**Total Tasks:** 52
**Fases:** 7
**Progresso:** 48/52 tasks (92%)

---

## Fase 1: Consolidacao (Baixo Risco) ✅ COMPLETA

### Task 1.1: Criar tipos para comando Report ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Interface `WeeklyReport` definida em `src/types/report.ts`
  - [x] Interface `FeatureReport` definida
  - [x] Tipos exportados no barrel `src/types/index.ts`

### Task 1.2: Testes para comando Report ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 1.1
- Acceptance Criteria:
  - [x] Testes para `report --weekly` em `tests/commands/report.test.ts`
  - [x] Testes para `report --feature <name>`
  - [x] Mock de git log e filesystem
  - [x] Coverage >= 80%

### Task 1.3: Implementar comando Report ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1.2
- Acceptance Criteria:
  - [x] Criar `src/commands/report.ts` com classe ReportCommand
  - [x] `report --weekly` gera `.claude/reports/weekly-YYYY-MM-DD.md`
  - [x] `report --feature <name>` gera relatorio especifico
  - [x] Integrar com `progress.json` para metricas
  - [x] Todos testes passando

### Task 1.4: Registrar comando Report no CLI ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1.3
- Acceptance Criteria:
  - [x] Remover TODO de `src/cli.ts` linhas 388-396
  - [x] Registrar subcomandos `--weekly` e `--feature`
  - [x] Help text documentado

### Task 1.5: Testes para memory status ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Testes para `memory status` listando todas memorias
  - [x] Teste de contagem de linhas
  - [x] Teste de warning quando proxima do limite
  - [x] Teste de ultima atualizacao

### Task 1.6: Implementar memory status ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 1.5
- Acceptance Criteria:
  - [x] Adicionar metodo `status()` em `src/commands/memory.ts`
  - [x] Listar memorias de projeto e features
  - [x] Mostrar linha count e % do limite
  - [x] Indicar memorias com warning (> 800 linhas)
  - [x] Todos testes passando

### Task 1.7: Testes para rename memory update -> sync ✅
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Teste que `memory sync` funciona
  - [x] Teste que `memory update` ainda funciona (alias)
  - [x] Teste de deprecation warning

### Task 1.8: Renomear memory update para sync ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 1.7
- Acceptance Criteria:
  - [x] Renomear metodo `update()` para `sync()` em memory.ts
  - [x] Manter alias `update` com deprecation warning
  - [x] Atualizar CLI para registrar ambos comandos
  - [x] Todos testes passando

### Task 1.9: Migrar hooks config ✅
- Tipo: Config
- Prioridade: P2
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Documentar estrutura de hooks em `.adk/config.json`
  - [x] Criar migration script (`src/utils/migration.ts`)
  - [x] Backward compatibility com `settings.json` existente
  - [x] Comando `adk config migrate-hooks` adicionado

---

## Fase 2: Context Engineering (Medio Risco) ✅ COMPLETA

### Task 2.1: Definir tipos para Tiered Memory ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Criar `src/types/context.ts`
  - [x] Interface `MemoryTier` com niveis: Project, Feature, Phase, Session
  - [x] Interface `TieredMemory` com metadata
  - [x] Interface `MemoryMetadata` (freshness, relevance, usageCount)

### Task 2.2: Testes para hierarquia de memoria ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 2.1
- Acceptance Criteria:
  - [x] Testes para carregar memoria por tier
  - [x] Testes para merge entre tiers (Project > Feature > Phase > Session)
  - [x] Testes para isolation de session memory
  - [x] Mock de filesystem

### Task 2.3: Implementar tiered memory ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 2.2
- Acceptance Criteria:
  - [x] Criar `src/utils/tiered-memory.ts`
  - [x] Funcao `loadMemoryHierarchy(feature?, phase?)`
  - [x] Funcao `flattenHierarchy(hierarchy)`
  - [x] SessionMemoryCache class com flush
  - [x] Todos testes passando (20 tests)

### Task 2.4: Testes para auto-compressao ✅
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 2.3
- Acceptance Criteria:
  - [x] Teste de deteccao quando memoria > 800 linhas
  - [x] Teste de trigger de compressao automatica
  - [x] Teste de preservacao de decisoes importantes
  - [x] Teste de arquivamento antes de compressao

### Task 2.5: Implementar auto-compressao ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 2.4
- Acceptance Criteria:
  - [x] Criar `src/utils/memory-compression.ts`
  - [x] Funcao `shouldCompress(memory)` retorna boolean
  - [x] Funcao `compressMemoryContent(content, path)` via Claude
  - [x] Funcao `archiveMemory(path)` cria backup
  - [x] Todos testes passando (10 tests)

### Task 2.6: Testes para metricas de contexto ✅
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 2.1
- Acceptance Criteria:
  - [x] Teste de calculo de freshness (baseado em lastUpdated)
  - [x] Teste de decay score over time
  - [x] Teste de minimum score para conteudo antigo
  - [x] Teste de serializacao de metricas

### Task 2.7: Implementar metricas de contexto ✅
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 2.6
- Acceptance Criteria:
  - [x] Funcao `calculateFreshnessScore(updatedAt)` retorna 0-100
  - [x] Decay exponencial com FRESHNESS_DECAY_DAYS = 30
  - [x] MIN_FRESHNESS_SCORE = 5 para conteudo muito antigo
  - [x] Todos testes passando

---

## Fase 3: Agentic RAG (Medio Risco) - COMPLETA

### Task 3.1: Definir tipos para Dynamic Context - DONE
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 2.1
- Acceptance Criteria:
  - [x] Interface `RetrievedContext` em `src/utils/dynamic-context.ts`
  - [x] Interface `RetrievalResult` com score e source
  - [x] Interface `RetrievalOptions` para config

### Task 3.2: Testes para dynamic context retrieval - DONE
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 3.1
- Acceptance Criteria:
  - [x] Testes em `tests/utils/dynamic-context.test.ts`
  - [x] Teste de scoring de relevancia
  - [x] Teste de limite de resultados
  - [x] Mock de filesystem

### Task 3.3: Implementar dynamic context retrieval - DONE
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 3.2
- Acceptance Criteria:
  - [x] Criar `src/utils/dynamic-context.ts`
  - [x] Funcao `dynamicContextRetrieval(task, options?)`
  - [x] Funcao `extractKeywords(task)`
  - [x] Funcao `calculateRelevanceScore(content, keywords)`
  - [x] Todos testes passando (18 tests)

### Task 3.4: Testes para reflection pattern - DONE
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 3.3
- Acceptance Criteria:
  - [x] Teste de validateAction
  - [x] Teste de reflectOnResult
  - [x] Teste de suggestCorrections
  - [x] Teste de ReflectionHistory

### Task 3.5: Implementar reflection pattern - DONE
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3.4
- Acceptance Criteria:
  - [x] Criar `src/utils/reflection.ts`
  - [x] Funcao `validateAction(action, context)`
  - [x] Funcao `reflectOnResult(result, expected)`
  - [x] Funcao `suggestCorrections(validation)`
  - [x] Todos testes passando (17 tests)

### Task 3.6: Testes para context cache - DONE
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 3.3
- Acceptance Criteria:
  - [x] Teste de cache hit
  - [x] Teste de cache miss
  - [x] Teste de TTL expiration
  - [x] Teste de invalidate por pattern

### Task 3.7: Implementar context cache - DONE
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 3.6
- Acceptance Criteria:
  - [x] Class `ContextCache` com TTL (default 5 min)
  - [x] Metodo `get(key)` / `set(key, result)`
  - [x] Metodo `invalidate(pattern?)`
  - [x] Metodo `clear()`
  - [x] Todos testes passando

---

## Fase 4: Model Routing (Baixo Risco) ✅ COMPLETA

### Task 4.1: Definir tipos para Model Routing ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Interface `ModelConfig` em `src/types/model.ts`
  - [x] Enum `ModelType` (opus, sonnet, haiku)
  - [x] Interface `PhaseModelMapping`

### Task 4.2: Testes para model router ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 4.1
- Acceptance Criteria:
  - [x] Testes para `getModelForPhase(phase)` em `tests/utils/model-router.test.ts`
  - [x] Teste de default mapping (research->opus, implement->sonnet, qa->haiku)
  - [x] Teste de override via config
  - [x] Teste de override via CLI flag

### Task 4.3: Implementar model router ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 4.2
- Acceptance Criteria:
  - [x] Criar `src/utils/model-router.ts`
  - [x] Funcao `getModelForPhase(phase, override?)` retorna model
  - [x] Defaults: research/planning->opus, implement->sonnet, validation->haiku
  - [x] Ler override de `.adk/config.json`
  - [x] Todos testes passando (24 tests)

### Task 4.4: Adicionar config de model routing ✅
- Tipo: Config
- Prioridade: P1
- Dependencias: Task 4.3
- Acceptance Criteria:
  - [x] Campo `modelRouting` em `.adk/config.json`
  - [x] Estrutura: `{ research: "opus", implement: "sonnet", qa: "haiku" }`
  - [x] Campo `modelRouting.enabled` (default: true)
  - [x] Funcoes `getModelRoutingConfig` e `updateModelRoutingConfig` em config.ts

### Task 4.5: Integrar model routing em executeClaudeCommand ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 4.3
- Acceptance Criteria:
  - [x] Modificar `src/utils/claude.ts`
  - [x] Adicionar parametro `model` em `executeClaudeCommand`
  - [x] Passar `--model` flag para Claude CLI
  - [x] Validacao de modelo com allowlist (seguranca)

### Task 4.6: Adicionar flag --model global ✅
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 4.5
- Acceptance Criteria:
  - [x] Flag `-m, --model <model>` em comandos feature (new, research, tasks, plan, implement, qa, docs)
  - [x] Override tem precedencia sobre config
  - [x] Help text documentado

---

## Fase 5: CDR - Resiliencia (Alto Risco) ✅ COMPLETA

### Task 5.1: Definir tipos para CDR ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Criar `src/types/cdr.ts`
  - [x] Interface `HealthProbe` (phase, status, metrics)
  - [x] Interface `RecoveryCheckpoint` (phase, state, timestamp)
  - [x] Interface `RetryConfig` (maxRetries, backoffMs, maxBackoffMs)

### Task 5.2: Testes para health probes ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 5.1
- Acceptance Criteria:
  - [x] Testes para `startHealthProbe(phase)` em `tests/utils/health-probes.test.ts`
  - [x] Teste de monitoramento de tempo por fase
  - [x] Teste de callback em anomalia
  - [x] Teste de token pressure warning (80%)
  - [x] Mock de timers (jest.useFakeTimers)
  - [x] 33 testes passando

### Task 5.3: Implementar health probes ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 5.2
- Acceptance Criteria:
  - [x] Criar `src/utils/health-probes.ts`
  - [x] Funcao `startHealthProbe(phase, callback)` inicia monitoramento
  - [x] Funcao `stopHealthProbe(probeId)` para parada
  - [x] Metricas: duration, tokenEstimate, errorCount
  - [x] Intervalo: 30s (configuravel)
  - [x] Todos testes passando

### Task 5.4: Testes para retry com backoff ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 5.1
- Acceptance Criteria:
  - [x] Testes para `retryWithBackoff(fn, config)`
  - [x] Teste de retry ate 3x
  - [x] Teste de backoff exponencial (1s, 2s, 4s)
  - [x] Teste de sucesso na N-esima tentativa
  - [x] Teste de falha apos max retries

### Task 5.5: Implementar retry com backoff ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 5.4
- Acceptance Criteria:
  - [x] Adicionar em `src/utils/recovery.ts`
  - [x] Funcao `retryWithBackoff<T>(fn, config)` generica
  - [x] Backoff exponencial: baseMs * 2^attempt
  - [x] Max retries: 3 (default)
  - [x] Todos testes passando

### Task 5.6: Testes para recovery checkpoints ✅
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 5.1
- Acceptance Criteria:
  - [x] Teste de criar checkpoint
  - [x] Teste de restaurar checkpoint
  - [x] Teste de limite de 5 checkpoints
  - [x] Teste de auto-cleanup de antigos
  - [x] Usando filesystem real em diretorio de teste

### Task 5.7: Implementar recovery checkpoints ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.6
- Acceptance Criteria:
  - [x] Criar `src/utils/recovery.ts`
  - [x] Funcao `createCheckpoint(feature, phase, state)`
  - [x] Funcao `restoreCheckpoint(feature, phase)`
  - [x] Persistir em `.claude/plans/features/<feature>/checkpoints/`
  - [x] Limite de 5 checkpoints por feature
  - [x] 33 testes passando

### Task 5.8: Testes para fallback templates ✅
- Tipo: Test
- Prioridade: P1
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Teste de carregamento de template fallback
  - [x] Teste de validacao read-only
  - [x] Teste de uso quando agent falha 3x
  - [x] 25 testes passando

### Task 5.9: Implementar fallback templates ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.8
- Acceptance Criteria:
  - [x] Templates em `templates/fallback/`
  - [x] Templates para cada fase (prd, research, planning, implement, qa, validation, docs)
  - [x] Funcao `loadFallbackTemplate(phase)`
  - [x] Validacao de integridade do template
  - [x] Todos testes passando

### Task 5.10: Integrar CDR em feature command ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 5.5, Task 5.7, Task 5.9
- Acceptance Criteria:
  - [x] Criar `src/utils/cdr-integration.ts` com wrapper unificado
  - [x] Funcao `executeWithCDR(fn, options)` com retry, checkpoint e fallback
  - [x] Funcao `recoverPhase(feature, phase, resumeFn)` para recuperacao
  - [x] Funcao `validatePhaseHealth(feature, phase)` para validacao
  - [x] 13 testes passando

---

## Fase 6: Quality Gates (Medio Risco) ✅ COMPLETA

### Task 6.1: Definir tipos para Quality Scoring ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Tipos em `src/utils/quality-gates.ts` (DebtItem, RiskFactors, ConfidenceFactors)
  - [x] Tipos em `src/utils/ai-review.ts` (ReviewFinding, Severity, Agreement, Disagreement)
  - [x] Interface `QualityGateResult` (passed, riskScore, threshold, recommendation)

### Task 6.2: Testes para quality scorer ✅
- Tipo: Test
- Prioridade: P0
- Dependencias: Task 6.1
- Acceptance Criteria:
  - [x] Testes em `tests/utils/quality-gates.test.ts`
  - [x] Teste de weighted sum com pesos configurados
  - [x] Teste de range 0-100
  - [x] Teste de threshold (> 70 falha gate)
  - [x] 20 testes passando

### Task 6.3: Implementar quality scorer ✅
- Tipo: Implementation
- Prioridade: P0
- Dependencias: Task 6.2
- Acceptance Criteria:
  - [x] Criar `src/utils/quality-gates.ts`
  - [x] Funcao `calculateOverallRiskScore(factors)` retorna 0-100
  - [x] Funcao `calculateConfidenceScore(factors)` retorna 0-100
  - [x] Classe `QualityGate` com metodo `evaluate()`
  - [x] Todos testes passando

### Task 6.4: Testes para debt tracking ✅
- Tipo: Test
- Prioridade: P2
- Dependencias: Task 6.1
- Acceptance Criteria:
  - [x] Testes incluidos em quality-gates.test.ts
  - [x] Teste de DebtItem com tipos (shortcut, hack, todo, workaround)
  - [x] Teste de severity (low, medium, high)

### Task 6.5: Implementar debt tracking ✅
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 6.4
- Acceptance Criteria:
  - [x] Interface `DebtItem` em quality-gates.ts
  - [x] Tipos de debt: shortcut, hack, todo, workaround
  - [x] Severidade: low, medium, high
  - [x] Todos testes passando

### Task 6.6: Criar agent reviewer-secondary ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: nenhuma
- Acceptance Criteria:
  - [x] Criar `templates/claude-structure/agents/reviewer-secondary.md`
  - [x] Frontmatter com name, description, context: fork
  - [x] Instructions para revisao cruzada
  - [x] Foco em: bugs, security, performance, maintainability

### Task 6.7: Testes para AI-on-AI review integration ✅
- Tipo: Test
- Prioridade: P1
- Dependencias: Task 6.6
- Acceptance Criteria:
  - [x] Testes em `tests/utils/ai-review.test.ts`
  - [x] Teste de consolidateReviews()
  - [x] Teste de merge de findings
  - [x] Teste de agreements e disagreements
  - [x] 15 testes passando

### Task 6.8: Integrar AI-on-AI review ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 6.7
- Acceptance Criteria:
  - [x] Criar `src/utils/ai-review.ts`
  - [x] Funcao `consolidateReviews(primary, secondary)`
  - [x] Funcao `calculateAiReviewRisk(consolidated)`
  - [x] Deteccao de agreements e disagreements
  - [x] Todos testes passando

### Task 6.9: Integrar scores no QA output ✅
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 6.3, Task 6.8
- Acceptance Criteria:
  - [x] Funcao `evaluateQualityGate()` em quality-gates.ts
  - [x] Retorna recommendation: APPROVE, REVIEW, BLOCK
  - [x] Gate falha automaticamente se risk > threshold (default 70)
  - [x] Todos testes passando

---

## Fase 7: Documentacao

### Task 7.1: Atualizar README.md com arquitetura
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Todas as fases anteriores
- Acceptance Criteria:
  - [ ] Diagrama de arquitetura (ASCII ou Mermaid)
  - [ ] Explicacao de cada componente principal
  - [ ] Fluxo de dados entre componentes

### Task 7.2: Documentar extensibilidade
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Task 7.1
- Acceptance Criteria:
  - [ ] Como criar novos agents
  - [ ] Como criar novos providers
  - [ ] Como criar novos skills
  - [ ] Exemplos praticos

### Task 7.3: Criar troubleshooting guide
- Tipo: Implementation
- Prioridade: P2
- Dependencias: Task 7.1
- Acceptance Criteria:
  - [ ] Problemas comuns e solucoes
  - [ ] Debug de model routing
  - [ ] Debug de CDR/recovery
  - [ ] FAQ

### Task 7.4: Gerar improvement report
- Tipo: Implementation
- Prioridade: P1
- Dependencias: Todas as fases anteriores
- Acceptance Criteria:
  - [ ] Executive summary
  - [ ] Dualidades removidas (before/after)
  - [ ] Novas funcionalidades
  - [ ] Gaps fechados com industria 2026
  - [ ] Guia de migracao

---

## Resumo por Fase

| Fase | Tasks | Tipo Test | Tipo Impl | Tipo Config |
|------|-------|-----------|-----------|-------------|
| 1. Consolidacao | 9 | 3 | 5 | 1 |
| 2. Context Engineering | 7 | 3 | 4 | 0 |
| 3. Agentic RAG | 7 | 3 | 4 | 0 |
| 4. Model Routing | 6 | 1 | 4 | 1 |
| 5. CDR | 10 | 5 | 5 | 0 |
| 6. Quality Gates | 9 | 4 | 5 | 0 |
| 7. Documentacao | 4 | 0 | 4 | 0 |
| **Total** | **52** | **19** | **31** | **2** |

---

## Dependencias Criticas

```
Fase 1 (Consolidacao)
  - Nenhuma dependencia externa

Fase 2 (Context Engineering)
  - Task 2.3 depende de Fase 1 completa

Fase 3 (Agentic RAG)
  - Task 3.1 depende de Task 2.1 (tipos de context)
  - Task 3.3 reutiliza memory-search.ts

Fase 4 (Model Routing)
  - Task 4.5 modifica claude.ts (impacto amplo)

Fase 5 (CDR)
  - Task 5.10 depende de 5.5, 5.7, 5.9
  - Alto risco - testar extensivamente

Fase 6 (Quality Gates)
  - Task 6.8 depende de agent system existente
  - Task 6.9 depende de 6.3 e 6.8

Fase 7 (Documentacao)
  - Depende de todas as fases anteriores
```

---

## Notas de Implementacao

### TDD Rigoroso
- SEMPRE escrever testes ANTES da implementacao
- Coverage minimo: 80% para codigo novo
- Rodar `npm test` apos cada task

### Commits Atomicos
- Um commit por task completada
- Formato: `feat(scope): descricao` ou `test(scope): descricao`
- NUNCA mencionar IA/Claude nos commits

### Backward Compatibility
- Manter aliases para comandos renomeados
- Deprecation warning por 3 versoes
- Migration guides para breaking changes

### Performance
- Context retrieval: < 500ms
- Model routing: < 50ms overhead
- Health probes: async, nao bloqueante
