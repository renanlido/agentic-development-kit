# Tasks: v3-version

**Complexidade:** Complexa
**Total de Tasks:** 18 (target: 15-25 baseado na complexidade)
**Data:** 2026-02-02

---

## Fase 1: Core Infrastructure

### Task 1.1: Implementar Core State Manager

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `src/utils/memory/core-state.ts` com classe CoreStateManager
  - Implementar schema completo do core-state.json (currentTask, taskProgress, criticalDecisions, modifiedFiles, constraints, breadcrumbs, blockers, nextSteps)
  - Implementar métodos: load(), save(), updateTask(), addDecision(), addModifiedFile(), addBreadcrumb()
  - Validação de schema com tipos TypeScript
  - Testes unitários para todos os métodos
- O que NÃO FAZER:
  - Hooks de injeção (Task 1.4)
  - Integração com CLI (Fase 2)

#### Critérios de Aceite
- [ ] Arquivo `src/utils/memory/core-state.ts` existe e compila
- [ ] CoreStateManager.load() lê core-state.json ou retorna default
- [ ] CoreStateManager.save() persiste atomicamente (temp file + move)
- [ ] CoreStateManager.updateTask() atualiza currentTask e status
- [ ] Limite de 5 decisões críticas é respeitado (FIFO)
- [ ] Limite de 5 arquivos modificados recentes é respeitado
- [ ] Testes passam com 100% de cobertura dos métodos públicos

#### Arquivos Envolvidos
- `src/utils/memory/core-state.ts` - criar
- `src/types/memory-v3.ts` - criar (interfaces CoreState, TaskState, Decision, etc.)
- `tests/utils/memory/core-state.test.ts` - criar

---

### Task 1.2: Implementar Session Notes Manager

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `src/utils/memory/session-notes.ts` com classe SessionNotesManager
  - Gerar template de session-notes.md (objetivo, timeline, learnings, files read, commands, blockers, next session)
  - Implementar métodos: initialize(), addTimelineEntry(), addLearning(), markFileRead(), addCommand(), updateNextSession()
  - Append-only para timeline (não sobrescrever entradas)
  - Testes unitários
- O que NÃO FAZER:
  - Archive automático (será feito no compactor)
  - Integração com checkpoint

#### Critérios de Aceite
- [ ] Arquivo `src/utils/memory/session-notes.ts` existe e compila
- [ ] SessionNotesManager.initialize() cria session-notes.md com template correto
- [ ] addTimelineEntry() adiciona entrada com timestamp na tabela markdown
- [ ] addLearning() adiciona item na seção Key Learnings
- [ ] markFileRead() atualiza checklist de Files Read
- [ ] Testes passam com cobertura dos métodos públicos

#### Arquivos Envolvidos
- `src/utils/memory/session-notes.ts` - criar
- `tests/utils/memory/session-notes.test.ts` - criar

---

### Task 1.3: Implementar Decisions Manager

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `src/utils/memory/decisions-manager.ts` com classe DecisionsManager
  - Implementar formato ADR simplificado (Context, Options, Decision, Rationale, Consequences)
  - Métodos: addDecision(), listDecisions(), getDecision(id)
  - Auto-incremento de ID (DEC-001, DEC-002, etc.)
  - Parsing de decisions.md existente
  - Testes unitários
- O que NÃO FAZER:
  - Sincronização com core-state (Task 1.1 já guarda últimas 5)
  - Multi-agent shared decisions

#### Critérios de Aceite
- [ ] Arquivo `src/utils/memory/decisions-manager.ts` existe e compila
- [ ] addDecision() cria entrada com ID auto-incrementado
- [ ] listDecisions() retorna todas as decisões do arquivo
- [ ] getDecision(id) retorna decisão específica
- [ ] Parse de decisions.md existente funciona corretamente
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/memory/decisions-manager.ts` - criar
- `tests/utils/memory/decisions-manager.test.ts` - criar

---

### Task 1.4: Implementar Memory Directory Initializer

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependências:** Task 1.1, 1.2, 1.3

#### Escopo
- O que FAZER:
  - Criar `src/utils/memory/initializer.ts` com função initializeMemoryStructure(featureName)
  - Criar estrutura de diretórios: memory/, checkpoints/, sessions/
  - Criar arquivos iniciais: core-state.json, session-notes.md, decisions.md, breadcrumbs.md
  - Não sobrescrever se já existir
  - Testes unitários
- O que NÃO FAZER:
  - Migração de features v2 (Task 4.3)

#### Critérios de Aceite
- [ ] initializeMemoryStructure() cria diretórios memory/, checkpoints/, sessions/
- [ ] Arquivos iniciais são criados com templates corretos
- [ ] Se diretórios/arquivos existem, não sobrescreve
- [ ] Retorna objeto com paths criados
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/memory/initializer.ts` - criar
- `tests/utils/memory/initializer.test.ts` - criar

---

## Fase 2: Prompt System

### Task 2.1: Implementar Feature List Generator

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `src/utils/feature-list.ts` com classe FeatureListManager
  - Implementar schema FeatureList e FeatureTest (id, description, category, steps, status, files, lastTested, evidence)
  - Métodos: create(), load(), save(), updateTestStatus(), getSummary()
  - Validação de schema
  - Testes unitários
- O que NÃO FAZER:
  - Geração automática de testes a partir do PRD (será feito pelo agente)
  - Conversão de tasks.md (Task 4.3)

#### Critérios de Aceite
- [ ] Arquivo `src/utils/feature-list.ts` existe e compila
- [ ] create() gera feature_list.json com estrutura correta
- [ ] load() lê e valida feature_list.json existente
- [ ] updateTestStatus() atualiza status e recalcula summary
- [ ] getSummary() retorna { total, passing, failing, pending }
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/feature-list.ts` - criar
- `src/types/feature-list.ts` - criar
- `tests/utils/feature-list.test.ts` - criar

---

### Task 2.2: Implementar Initializer Agent Prompt

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 2.1

#### Escopo
- O que FAZER:
  - Criar `src/utils/prompts/initializer-agent.ts`
  - Definir prompt para primeira execução: criar estrutura, gerar feature_list.json, gerar init.sh, fazer commit inicial
  - Incluir constraints anti-stub
  - Incluir instruções para ler PRD e research.md
  - Função generateInitializerPrompt(featureName, context)
  - Testes unitários
- O que NÃO FAZER:
  - Execução do prompt (Task 3.1)

#### Critérios de Aceite
- [ ] Arquivo `src/utils/prompts/initializer-agent.ts` existe e compila
- [ ] generateInitializerPrompt() retorna string com prompt completo
- [ ] Prompt inclui missão clara: criar estrutura, feature_list.json, init.sh, commit
- [ ] Prompt inclui constraints anti-stub
- [ ] Prompt referencia PRD e research.md
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/prompts/initializer-agent.ts` - criar
- `tests/utils/prompts/initializer-agent.test.ts` - criar

---

### Task 2.3: Implementar Coding Agent Prompt

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 2.1

#### Escopo
- O que FAZER:
  - Criar `src/utils/prompts/coding-agent.ts`
  - Definir prompt para execuções subsequentes: ler feature_list.json, selecionar próxima task, implementar com TDD, atualizar status, commit
  - Incluir constraints anti-stub
  - Incluir instruções de loop até 100% passing
  - Função generateCodingAgentPrompt(featureName, coreState, context)
  - Testes unitários
- O que NÃO FAZER:
  - QA integrado (Task 3.4)

#### Critérios de Aceite
- [ ] Arquivo `src/utils/prompts/coding-agent.ts` existe e compila
- [ ] generateCodingAgentPrompt() retorna string com prompt completo
- [ ] Prompt inclui loop de implementação
- [ ] Prompt inclui constraints anti-stub
- [ ] Prompt injeta core-state atual
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/prompts/coding-agent.ts` - criar
- `tests/utils/prompts/coding-agent.test.ts` - criar

---

### Task 2.4: Implementar QA Agent Prompt

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 2.1

#### Escopo
- O que FAZER:
  - Criar `src/utils/prompts/qa-agent.ts`
  - Definir prompt para QA por task e QA final
  - Incluir verificação de stubs, testes, type-check, lint
  - Função generateQAPrompt(featureName, mode: 'task' | 'feature', taskId?)
  - Retornar estrutura de issues encontradas
  - Testes unitários
- O que NÃO FAZER:
  - Auto-correção (Task 3.4)

#### Critérios de Aceite
- [ ] Arquivo `src/utils/prompts/qa-agent.ts` existe e compila
- [ ] generateQAPrompt() retorna prompt para QA task ou feature
- [ ] Prompt inclui checklist de verificação
- [ ] Prompt define formato de output estruturado
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/prompts/qa-agent.ts` - criar
- `tests/utils/prompts/qa-agent.test.ts` - criar

---

## Fase 3: Feature Commands v3

### Task 3.1: Implementar Comando `adk3 feature work`

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependências:** Task 1.4, 2.1, 2.2, 2.3

#### Escopo
- O que FAZER:
  - Expandir `src/commands/feature-v3.ts` com método work(name)
  - Detectar estado: feature existe? session ativa?
  - Se nova feature: executar Initializer Agent
  - Se feature existente: executar Coding Agent com resume
  - Integrar com session-store para tracking
  - Integrar com core-state para contexto
  - Validação manual entre fases (Research→Plan→Implement)
  - Testes de integração
- O que NÃO FAZER:
  - Modo autopilot (Task 3.3)
  - QA automático (Task 3.4)

#### Critérios de Aceite
- [ ] `adk3 feature work <name>` funciona para nova feature
- [ ] `adk3 feature work <name>` retoma feature existente
- [ ] Session ID é persistido e reutilizado com --resume
- [ ] Core-state é carregado e injetado
- [ ] Usuário é perguntado entre fases
- [ ] Testes de integração passam

#### Arquivos Envolvidos
- `src/commands/feature-v3.ts` - modificar
- `src/cli-v3.ts` - modificar (adicionar comando work)
- `tests/commands/feature-v3.test.ts` - criar/modificar

---

### Task 3.2: Implementar Comandos de Memória

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 1.1, 1.2, 1.3, 1.4

#### Escopo
- O que FAZER:
  - Criar `src/commands/memory.ts` com classe MemoryCommand
  - Implementar subcomandos: status, checkpoint, compact, restore
  - `status`: exibe core-state, session-notes resumido, checkpoints disponíveis
  - `checkpoint`: cria checkpoint manual
  - `compact`: compacta sessão atual
  - `restore`: restaura de checkpoint
  - Registrar em cli-v3.ts
  - Testes
- O que NÃO FAZER:
  - Compaction avançada (usar context-compactor.ts existente)

#### Critérios de Aceite
- [ ] `adk3 memory status <feature>` exibe dashboard de memória
- [ ] `adk3 memory checkpoint <feature>` cria checkpoint
- [ ] `adk3 memory compact <feature>` compacta sessão
- [ ] `adk3 memory restore <feature> <id>` restaura checkpoint
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/commands/memory.ts` - criar
- `src/cli-v3.ts` - modificar
- `tests/commands/memory.test.ts` - criar

---

### Task 3.3: Implementar Comando `adk3 feature autopilot`

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependências:** Task 3.1

#### Escopo
- O que FAZER:
  - Adicionar método autopilot(name) em feature-v3.ts
  - Loop automático durante implementação
  - Validação manual entre Research→Plan e Plan→Implement
  - Integrar com QA por task (Task 3.4)
  - Escalonamento inteligente: 3 falhas → pede ajuda humana
  - Detecção de loops infinitos (mesmo erro 2x, mesma correção 3x)
  - Testes de integração
- O que NÃO FAZER:
  - Multi-agent paralelo (Fase 2 do projeto)

#### Critérios de Aceite
- [ ] `adk3 feature autopilot <name>` executa loop automático
- [ ] Validação manual ocorre entre fases
- [ ] Loop para após 3 falhas consecutivas
- [ ] Detecção de loops infinitos funciona
- [ ] Usuário é notificado para intervenção
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/commands/feature-v3.ts` - modificar
- `src/cli-v3.ts` - modificar
- `tests/commands/feature-v3.test.ts` - modificar

---

### Task 3.4: Implementar QA em Duas Camadas

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependências:** Task 2.4, 3.3

#### Escopo
- O que FAZER:
  - Criar `src/utils/qa-runner.ts` com classe QARunner
  - Implementar Camada 1: QA por task (após cada task)
  - Implementar Camada 2: QA final (após todas tasks)
  - Auto-correção: gerar prompt de fix, executar, verificar (max 3x)
  - Integrar com feature-v3.ts autopilot
  - Retornar resultado estruturado (pass/fail, issues)
  - Testes
- O que NÃO FAZER:
  - Classificação de severidade (HIGH/MEDIUM/LOW) - simplificar para pass/fail

#### Critérios de Aceite
- [ ] QARunner.runTaskQA() executa QA após task
- [ ] QARunner.runFeatureQA() executa QA final
- [ ] Auto-correção tenta até 3 vezes
- [ ] Resultado retorna { passed, issues, attempts }
- [ ] Integração com autopilot funciona
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/qa-runner.ts` - criar
- `src/commands/feature-v3.ts` - modificar
- `tests/utils/qa-runner.test.ts` - criar

---

## Fase 4: Hooks e Anti-Stub

### Task 4.1: Implementar Hook validate-no-stub

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `.claude/hooks/validate-no-stub.sh`
  - Detectar patterns: `throw new Error('Not implemented')`, `TODO:`, `FIXME:`, `// stub`, `pass # stub`
  - Bloquear Write se detectado
  - Mensagem clara explicando bloqueio
  - Registrar em settings.json como PreToolUse:Write
  - Testes manuais
- O que NÃO FAZER:
  - Validação de outros tipos de código (apenas stubs)

#### Critérios de Aceite
- [ ] Hook `.claude/hooks/validate-no-stub.sh` existe e é executável
- [ ] Detecta todos os patterns de stub listados
- [ ] Retorna exit code 1 para bloquear
- [ ] Mensagem de erro é clara e útil
- [ ] Hook registrado em settings.json

#### Arquivos Envolvidos
- `.claude/hooks/validate-no-stub.sh` - criar
- `.claude/settings.json` - modificar

---

### Task 4.2: Implementar Hook comprehension-check

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependências:** Task 1.1

#### Escopo
- O que FAZER:
  - Criar `.claude/hooks/comprehension-check.sh`
  - Verificar se core-state.json foi lido recentemente
  - Emitir reminder sobre task atual e constraints
  - NÃO bloquear, apenas informar
  - Registrar em settings.json como PreToolUse:Write
  - Testes manuais
- O que NÃO FAZER:
  - Bloquear operações (apenas reminder)

#### Critérios de Aceite
- [ ] Hook `.claude/hooks/comprehension-check.sh` existe e é executável
- [ ] Emite reminder com task atual e constraints
- [ ] Retorna exit code 0 (não bloqueia)
- [ ] Hook registrado em settings.json

#### Arquivos Envolvidos
- `.claude/hooks/comprehension-check.sh` - criar
- `.claude/settings.json` - modificar

---

### Task 4.3: Implementar Migração v2 → v3

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 1.4, 2.1

#### Escopo
- O que FAZER:
  - Criar `src/utils/migration-v3.ts` com função migrateFeatureToV3(featureName)
  - Detectar feature v2 (tem tasks.md, não tem feature_list.json)
  - Converter tasks.md para feature_list.json
  - Preservar artefatos existentes (prd.md, research.md, progress.md)
  - Criar estrutura de memória
  - Rollback automático se falhar
  - Testes
- O que NÃO FAZER:
  - Migração de sessions existentes

#### Critérios de Aceite
- [ ] migrateFeatureToV3() detecta feature v2 corretamente
- [ ] Converte tasks.md para feature_list.json com status preservado
- [ ] Cria estrutura memory/ com arquivos iniciais
- [ ] Preserva todos os artefatos v2
- [ ] Rollback funciona se migração falhar
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/migration-v3.ts` - criar
- `tests/utils/migration-v3.test.ts` - criar

---

## Fase 5: Integração e CLI

### Task 5.1: Expandir CLI v3 com Todos os Comandos

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 3.1, 3.2, 3.3

#### Escopo
- O que FAZER:
  - Atualizar `src/cli-v3.ts` com todos os comandos v3
  - Comandos de feature: work, autopilot, status
  - Comandos de memory: status, checkpoint, compact, restore
  - Flags globais: --verbose, --json
  - Help text completo
  - Validação de argumentos
  - Testes
- O que NÃO FAZER:
  - Migrar comandos v2 (são separados)

#### Critérios de Aceite
- [ ] Todos os comandos registrados em cli-v3.ts
- [ ] Help text completo para cada comando
- [ ] Flags --verbose e --json funcionam
- [ ] Validação de argumentos com mensagens claras
- [ ] `adk3 --help` exibe todos os comandos
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/cli-v3.ts` - modificar
- `tests/cli-v3.test.ts` - criar

---

### Task 5.2: Implementar Compaction v3 com Two-Threshold

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 1.1, 1.2

#### Escopo
- O que FAZER:
  - Criar `src/utils/memory/compactor-v3.ts` com classe CompactorV3
  - Implementar two-threshold: T_max (80%) trigger, T_target (50%) pós-compaction
  - Preservar: file paths, line numbers, function names, comandos, erros
  - Comprimir: explicações redundantes, tentativas falhas, conversas
  - Gerar COMPACTED_STATE.md com template estruturado
  - Integrar com token-counter.ts existente
  - Testes
- O que NÃO FAZER:
  - Compaction automática (será acionada manualmente ou via threshold)

#### Critérios de Aceite
- [ ] CompactorV3.shouldCompact() retorna true quando >80%
- [ ] CompactorV3.compact() reduz para ~50%
- [ ] Informações críticas são preservadas
- [ ] Template COMPACTED_STATE.md é gerado corretamente
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/memory/compactor-v3.ts` - criar
- `tests/utils/memory/compactor-v3.test.ts` - criar

---

### Task 5.3: Implementar Init Script Generator

**Tipo:** Feature
**Estimativa:** P (1-2h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `src/utils/init-script.ts` com função generateInitScript(featureName, context)
  - Gerar init.sh com: instalação de dependências, setup de ambiente, comandos de verificação
  - Detectar stack do projeto (package.json, requirements.txt, etc.)
  - Template configurável
  - Testes
- O que NÃO FAZER:
  - Execução do script (feito pelo agente)

#### Critérios de Aceite
- [ ] generateInitScript() gera init.sh válido
- [ ] Detecta stack e adapta comandos
- [ ] Script inclui verificações (npm install, type-check, etc.)
- [ ] Testes passam

#### Arquivos Envolvidos
- `src/utils/init-script.ts` - criar
- `tests/utils/init-script.test.ts` - criar

---

### Task 5.4: Testes de Integração End-to-End

**Tipo:** Test
**Estimativa:** G (4-8h)
**Dependências:** Todas as tasks anteriores

#### Escopo
- O que FAZER:
  - Criar suite de testes e2e em `tests/e2e/`
  - Testar fluxo completo: nova feature → work → autopilot → conclusão
  - Testar migração v2 → v3
  - Testar recovery de checkpoint
  - Testar detecção de loops infinitos
  - Testar hooks anti-stub
  - Documentar casos de teste
- O que NÃO FAZER:
  - Testes de performance (Fase 2)

#### Critérios de Aceite
- [ ] Suite e2e existe em `tests/e2e/`
- [ ] Fluxo completo de nova feature funciona
- [ ] Migração v2 → v3 funciona
- [ ] Recovery de checkpoint funciona
- [ ] Hooks anti-stub funcionam
- [ ] Todos os testes e2e passam

#### Arquivos Envolvidos
- `tests/e2e/feature-workflow.test.ts` - criar
- `tests/e2e/migration.test.ts` - criar
- `tests/e2e/hooks.test.ts` - criar

---

## Resumo de Dependências

```
Fase 1 (Core):
  1.1 ──┐
  1.2 ──┼──► 1.4
  1.3 ──┘

Fase 2 (Prompts):
  2.1 ──┬──► 2.2
       └──► 2.3
       └──► 2.4

Fase 3 (Commands):
  1.4, 2.1, 2.2, 2.3 ──► 3.1 ──► 3.3 ──► 3.4
  1.1, 1.2, 1.3, 1.4 ──► 3.2

Fase 4 (Hooks):
  (independentes) ──► 4.1, 4.2
  1.4, 2.1 ──► 4.3

Fase 5 (Integração):
  3.1, 3.2, 3.3 ──► 5.1
  1.1, 1.2 ──► 5.2
  (independente) ──► 5.3
  TODAS ──► 5.4
```

---

## Ordem de Execução Sugerida

**Wave 1 (Paralelo):** 1.1, 1.2, 1.3, 2.1, 4.1, 5.3
**Wave 2 (Paralelo):** 1.4, 2.2, 2.3, 2.4, 4.2
**Wave 3 (Paralelo):** 3.1, 3.2, 4.3
**Wave 4 (Sequencial):** 3.3, 5.1, 5.2
**Wave 5 (Sequencial):** 3.4
**Wave 6 (Final):** 5.4

---

*Tasks geradas: 2026-02-02*
*Metodologia: Vertical Slicing*
*Cada task é um slice completo com teste + implementação*
