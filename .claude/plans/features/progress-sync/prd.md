# PRD: progress-sync

**Data:** 2026-01-20
**Status:** Draft
**Autor:** Auto-generated

---

## 1. Problema

### Contexto Atual

O ADK (Agentic Development Kit) utiliza dois arquivos principais para rastrear o estado de uma feature durante o ciclo de desenvolvimento:

1. **`progress.md`**: Arquivo markdown que registra o status das etapas do workflow (prd, research, tasks, arquitetura, implementacao, qa, docs, finish)
2. **`tasks.md`**: Arquivo markdown detalhado com breakdown de tasks, acceptance criteria, dependencias e status individual

### Problemas Identificados

1. **Perda de Contexto entre Fases**: Quando uma etapa do workflow e concluida (ex: `adk feature plan`), o `progress.md` e atualizado para marcar a fase como completa, mas **detalhes importantes da execucao sao perdidos** - como quais tasks especificas foram concluidas, issues encontrados, decisoes tomadas durante a implementacao.

2. **Dessincronia entre Arquivos**: O `progress.md` e `tasks.md` frequentemente ficam dessincronizados:
   - `progress.md` pode indicar que "implementacao" esta completa
   - `tasks.md` ainda mostra tasks individuais como "Todo" ou "In Progress"
   - Nao ha mecanismo automatico para reconciliar esses estados

3. **Informacoes Perdidas apos Etapa**: Apos completar uma fase como "implementacao", informacoes valiosas sao sobrescritas ou perdidas:
   - Tempo gasto em cada task
   - Problemas encontrados e como foram resolvidos
   - Arquivos criados/modificados por task
   - Metricas de cobertura de testes por task

4. **Falta de Rastreabilidade**: Nao e possivel responder perguntas como:
   - "Quais tasks da Story 2 ja foram implementadas?"
   - "Qual foi o ultimo estado do progress antes do QA?"
   - "Quais arquivos foram tocados durante a Task 3.2?"

5. **Worktrees Desatualizados**: O sistema atual de sync entre main repo e worktrees (em `progress.ts`) usa apenas timestamp para decidir qual versao manter, podendo perder informacoes mais granulares de uma das versoes.

6. **Ausencia de Historico**: Nao existe historico de transicoes de estado - uma vez que uma fase avanca, o estado anterior e perdido permanentemente.

### Impacto

- **Retrabalho**: Desenvolvedores precisam re-investigar o estado real das tasks manualmente
- **Decisoes Incorretas**: Falta de visibilidade sobre o progresso real pode levar a estimativas erradas
- **Contexto Perdido**: Agentes AI perdem contexto valioso entre sessoes sobre o que ja foi feito
- **Dificuldade de Retomada**: Ao retomar uma feature apos pausa, muito contexto precisa ser reconstruido

---

## 2. Solucao Proposta

### Visao Geral

Implementar um **Sistema de Sincronizacao Inteligente** que:

1. **Sincroniza bidirecionalmente** `progress.md` e `tasks.md` apos cada etapa do workflow
2. **Preserva historico** de transicoes de estado em formato compacto
3. **Agrega metricas** automaticamente (tempo, arquivos, testes)
4. **Detecta e resolve conflitos** entre estados inconsistentes
5. **Gera snapshots** em pontos criticos para rollback

### Arquitetura da Solucao

```
┌─────────────────────────────────────────────────────────────────┐
│                    Progress Sync System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │ progress.md  │◄───►│  SyncEngine  │◄───►│  tasks.md    │    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│                              │                                   │
│                       ┌──────▼───────┐                          │
│                       │ StateManager │                          │
│                       └──────┬───────┘                          │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Snapshots  │    │   History    │    │   Metrics    │       │
│  │ .snapshots/ │    │ history.json │    │ metrics.json │       │
│  └─────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Principais

1. **SyncEngine**: Orquestra sincronizacao entre progress.md e tasks.md
2. **StateManager**: Gerencia estado unificado da feature
3. **SnapshotManager**: Cria/restaura snapshots de estado
4. **HistoryTracker**: Mantem log de transicoes
5. **MetricsCollector**: Agrega metricas automaticamente
6. **ConflictResolver**: Detecta e resolve inconsistencias

---

## 3. Requisitos Funcionais

### RF01: Sincronizacao Automatica Pos-Fase

O sistema DEVE sincronizar automaticamente `progress.md` e `tasks.md` apos cada comando de fase (`feature prd`, `feature research`, `feature plan`, `feature implement`, `workflow qa`).

**Detalhes:**
- Ao completar uma fase, extrair tasks relacionadas de `tasks.md`
- Atualizar status das tasks correspondentes baseado no resultado da fase
- Propagar timestamps e notas entre os arquivos
- Atualizar `lastUpdated` em ambos os arquivos

### RF02: Preservacao de Detalhes de Tasks

O sistema DEVE preservar detalhes granulares de cada task apos conclusao de fase.

**Detalhes:**
- Manter acceptance criteria com status individual (passed/failed)
- Preservar notas e observacoes adicionadas durante execucao
- Registrar arquivos criados/modificados por task
- Manter referencia a commits associados

### RF03: Historico de Transicoes

O sistema DEVE manter historico compacto de transicoes de estado.

**Detalhes:**
- Registrar cada mudanca de status em `history.json`
- Incluir: timestamp, fase anterior, fase nova, trigger (comando), usuario
- Limitar historico a ultimas 50 transicoes (configuravel)
- Permitir consulta: "qual era o estado em data X?"

### RF04: Snapshots em Pontos Criticos

O sistema DEVE criar snapshots automaticos em transicoes de fase.

**Detalhes:**
- Criar snapshot antes de: `implement`, `qa`, `finish`
- Armazenar em `.snapshots/` com nome: `{fase}-{timestamp}.json`
- Incluir: progress.md, tasks.md, metrics.json
- Limitar a 10 snapshots mais recentes (auto-cleanup)

### RF05: Deteccao de Inconsistencias

O sistema DEVE detectar quando `progress.md` e `tasks.md` estao inconsistentes.

**Detalhes:**
- Verificar se fase marcada como "completed" tem todas as tasks P0 concluidas
- Alertar se tasks estao "in_progress" mas fase ja avancou
- Detectar tasks orfas (sem fase correspondente)
- Gerar relatorio de inconsistencias quando solicitado

### RF06: Resolucao de Conflitos

O sistema DEVE oferecer estrategias de resolucao para inconsistencias.

**Detalhes:**
- Estrategia "progress-wins": Status do progress.md prevalece
- Estrategia "tasks-wins": Status mais detalhado das tasks prevalece
- Estrategia "manual": Solicita intervencao do usuario
- Estrategia "merge": Combina informacoes de ambos

### RF07: Metricas Automaticas

O sistema DEVE coletar e agregar metricas automaticamente.

**Detalhes:**
- Tempo total por fase (baseado em timestamps)
- Numero de tasks completadas vs total por fase
- Arquivos modificados por fase (via git diff)
- Coverage delta apos fase de implementacao

### RF08: Comando de Status Unificado

O sistema DEVE fornecer comando para visualizar estado unificado.

**Detalhes:**
- `adk feature status <name> --unified` mostra visao consolidada
- Exibe: fase atual, tasks pendentes, metricas, ultimas transicoes
- Destaca inconsistencias se existirem
- Sugere proxima acao recomendada

### RF09: Comando de Sync Manual

O sistema DEVE permitir sincronizacao manual sob demanda.

**Detalhes:**
- `adk feature sync <name>` forca sincronizacao
- Flag `--strategy <progress|tasks|merge>` para escolher estrategia
- Flag `--dry-run` para preview de mudancas
- Flag `--verbose` para log detalhado

### RF10: Integracao com Worktrees

O sistema DEVE sincronizar corretamente entre main repo e worktrees.

**Detalhes:**
- Sync bidirecional inteligente (nao apenas por timestamp)
- Merge de historico de ambas as fontes
- Preservar snapshots em ambos os locais
- Detectar conflitos entre worktree e main

---

## 4. Requisitos Nao-Funcionais

### RNF01: Performance

- Sincronizacao DEVE completar em < 500ms para features com ate 50 tasks
- Leitura de estado unificado DEVE completar em < 100ms
- Criacao de snapshot DEVE completar em < 200ms
- Nao deve impactar performance dos comandos existentes em mais de 10%

### RNF02: Seguranca

- Snapshots NAO devem conter tokens ou credenciais
- Historico NAO deve expor informacoes sensiveis
- Arquivos de sync devem seguir permissoes do diretorio pai
- Validar input antes de processar (prevenir path traversal)

### RNF03: Confiabilidade

- Sync DEVE ser atomico (tudo ou nada)
- Em caso de falha, estado anterior DEVE ser preservado
- Corrupcao de arquivo DEVE ser detectada e reportada
- Fallback para estado seguro em caso de erro critico

### RNF04: Compatibilidade

- DEVE ser backward-compatible com progress.md existentes
- DEVE funcionar sem tasks.md (graceful degradation)
- DEVE manter formato atual dos arquivos (apenas adicionar campos opcionais)
- DEVE funcionar com features criadas antes da implementacao

### RNF05: Manutenibilidade

- Codigo DEVE seguir padroes existentes do projeto
- Coverage de testes >= 85% para novo codigo
- Funcoes de sync DEVEM ser puras quando possivel
- Log detalhado para debugging

### RNF06: Usabilidade

- Mensagens de erro DEVEM ser claras e acionaveis
- Sync automatico DEVE ser transparente (nao interromper workflow)
- Conflitos DEVEM ser explicados em linguagem simples
- Documentacao inline para todas as APIs publicas

---

## 5. User Stories

### US01: Sincronizacao Automatica Pos-Implementacao

**Como** desenvolvedor usando ADK
**Quero** que progress.md e tasks.md sejam sincronizados automaticamente apos completar implementacao
**Para** ter visibilidade precisa do estado real da feature sem trabalho manual

**Criterios de Aceitacao:**
- [ ] Apos `adk feature implement <name>` completar, tasks implementadas sao marcadas como "completed" em tasks.md
- [ ] progress.md reflete o novo status da fase "implementacao"
- [ ] Timestamps sao atualizados em ambos os arquivos
- [ ] Nenhuma informacao de tasks anteriores e perdida
- [ ] Log indica que sincronizacao foi realizada

### US02: Preservacao de Detalhes de Tasks Completadas

**Como** desenvolvedor retomando uma feature apos pausa
**Quero** ver detalhes de como cada task foi completada
**Para** entender o contexto e decisoes tomadas anteriormente

**Criterios de Aceitacao:**
- [ ] Tasks completadas mantem notas adicionadas durante execucao
- [ ] Acceptance criteria mostram status individual (passed/failed)
- [ ] Arquivos modificados por task sao listados
- [ ] Tempo gasto por task e registrado
- [ ] Commits associados sao referenciados

### US03: Rollback para Estado Anterior

**Como** desenvolvedor que encontrou problema apos QA
**Quero** restaurar o estado da feature para antes do QA
**Para** investigar e corrigir o problema com contexto completo

**Criterios de Aceitacao:**
- [ ] Snapshot automatico existe para momento pre-QA
- [ ] Comando `adk feature restore <name> --to pre-qa` restaura estado
- [ ] Restauracao inclui progress.md, tasks.md e metricas
- [ ] Usuario e avisado sobre arquivos de codigo que nao sao restaurados
- [ ] Historico registra a operacao de rollback

### US04: Deteccao de Estado Inconsistente

**Como** desenvolvedor trabalhando em feature complexa
**Quero** ser alertado quando progress.md e tasks.md estao inconsistentes
**Para** corrigir o problema antes que cause confusao

**Criterios de Aceitacao:**
- [ ] Sistema detecta quando fase "completed" tem tasks P0 pendentes
- [ ] Alerta e mostrado ao executar `adk feature status <name>`
- [ ] Alerta sugere comando para resolver (`adk feature sync`)
- [ ] Inconsistencias sao listadas de forma clara
- [ ] Nivel de severidade e indicado (warning vs error)

### US05: Visualizacao de Progresso Unificado

**Como** tech lead revisando progresso de feature
**Quero** ver visao consolidada de progress + tasks em um unico comando
**Para** entender rapidamente o estado real sem abrir multiplos arquivos

**Criterios de Aceitacao:**
- [ ] `adk feature status <name> --unified` mostra visao consolidada
- [ ] Exibe: fase atual, % conclusao, tasks por status, metricas principais
- [ ] Destaca inconsistencias se existirem
- [ ] Mostra ultimas 5 transicoes de estado
- [ ] Sugere proxima acao recomendada

### US06: Sync entre Main Repo e Worktree

**Como** desenvolvedor usando worktrees para desenvolvimento paralelo
**Quero** que progresso seja sincronizado entre main repo e worktree
**Para** ter visibilidade consistente independente de onde estou trabalhando

**Criterios de Aceitacao:**
- [ ] Alteracoes em worktree sao propagadas para main repo
- [ ] Alteracoes em main repo sao propagadas para worktree
- [ ] Conflitos sao detectados e reportados
- [ ] Historico e preservado de ambas as fontes
- [ ] Sync funciona mesmo com worktree offline (queue)

---

## 6. Escopo

### Incluido

- Sincronizacao automatica entre progress.md e tasks.md
- Sistema de snapshots com auto-cleanup
- Historico de transicoes de estado
- Coleta automatica de metricas basicas
- Deteccao e resolucao de inconsistencias
- Comando `feature sync` para sincronizacao manual
- Integracao com sistema de worktrees existente
- Atualizacao do comando `feature status` com flag `--unified`
- Atualizacao dos hooks de pos-fase para trigger de sync
- Testes unitarios e de integracao

### Excluido (Out of Scope)

- Sincronizacao com sistemas externos (ClickUp, Jira) - ja existe feature separada
- UI grafica para visualizacao de progresso
- Notificacoes push sobre mudancas de estado
- Merge automatico de codigo entre worktrees
- Integracao com CI/CD para atualizacao de status
- Exportacao de metricas para ferramentas de analytics
- Versionamento semantico de snapshots
- Compressao de snapshots antigos

---

## 7. Riscos e Mitigacoes

| Risco | Impacto | Probabilidade | Mitigacao |
|-------|---------|---------------|-----------|
| Corrupcao de arquivos durante sync | Alto | Baixa | Implementar sync atomico com backup pre-operacao; validar integridade apos cada operacao |
| Performance degradada em features grandes | Medio | Media | Implementar lazy loading; cachear estado parseado; otimizar regex de parsing |
| Inconsistencia entre worktrees | Alto | Media | Usar locks durante sync; implementar queue para sync offline; detectar conflitos proativamente |
| Backward compatibility quebrada | Alto | Baixa | Manter formato atual; adicionar apenas campos opcionais; criar migracao automatica |
| Snapshots ocupando muito espaco | Baixo | Media | Limitar numero de snapshots; implementar compressao; auto-cleanup |
| Sync interferindo em workflow do usuario | Medio | Media | Sync assincrono quando possivel; timeouts curtos; fallback silencioso em caso de erro |
| Parsing incorreto de tasks.md complexos | Medio | Media | Testes extensivos com casos reais; fallback para parsing parcial; alertar usuario sobre parse incompleto |

---

## 8. Metricas de Sucesso

### Quantitativas

- **Reducao de retrabalho**: Medir tempo gasto verificando estado manualmente (baseline vs pos-implementacao)
- **Precisao de sync**: >= 99% de operacoes de sync completadas sem erro
- **Performance**: p95 de tempo de sync < 500ms
- **Adocao**: >= 80% das features novas usando sync automatico apos 2 semanas
- **Cobertura de testes**: >= 85% no codigo novo

### Qualitativas

- **Satisfacao do usuario**: Feedback positivo sobre visibilidade de progresso
- **Reducao de perguntas**: Menos duvidas sobre "qual o estado real da feature"
- **Confianca no sistema**: Usuarios confiam nos dados de progress/tasks

### Como Medir

1. **Reducao de retrabalho**: Survey antes/depois com desenvolvedores
2. **Precisao de sync**: Log de operacoes de sync com status (success/fail)
3. **Performance**: Metricas de tempo coletadas automaticamente
4. **Adocao**: Analise de arquivos criados em `.snapshots/`
5. **Cobertura**: Relatorio de coverage do Jest

---

## 9. Dependencias

### Dependencias Internas (Codigo Existente)

| Componente | Arquivo | Uso |
|------------|---------|-----|
| FeatureProgress types | `src/utils/progress.ts` | Tipos e funcoes de parse de progress.md |
| Git path utils | `src/utils/git-paths.ts` | Resolucao de paths em main repo vs worktree |
| Feature command | `src/commands/feature.ts` | Integracao com comandos de fase |
| Logger | `src/utils/logger.ts` | Logging consistente |
| Template system | `src/utils/templates.ts` | Possiveis templates para novos arquivos |

### Dependencias Externas (NPM)

| Pacote | Versao | Uso |
|--------|--------|-----|
| fs-extra | ^11.x | Operacoes de arquivo atomicas |
| chalk | ^5.x | Output colorido (ja existe) |
| ora | ^9.x | Spinners (ja existe) |
| glob | ^10.x | Pattern matching de arquivos (ja existe) |

### Pre-Requisitos

- Feature de worktrees funcionando (ja existe)
- Formato atual de progress.md estavel
- Formato atual de tasks.md estavel

---

## 10. Timeline (Sugestao)

### Fase 1: Foundation (Tasks 1-8)

**Objetivo:** Infraestrutura base para sync

- Task 1: Definir tipos e interfaces para estado unificado
- Task 2: Implementar parser de tasks.md
- Task 3: Testes para parser de tasks.md
- Task 4: Implementar StateManager
- Task 5: Testes para StateManager
- Task 6: Implementar SyncEngine base
- Task 7: Testes para SyncEngine
- Task 8: Integrar sync automatico em comandos de fase

### Fase 2: History & Snapshots (Tasks 9-14)

**Objetivo:** Persistencia e rastreabilidade

- Task 9: Implementar HistoryTracker
- Task 10: Testes para HistoryTracker
- Task 11: Implementar SnapshotManager
- Task 12: Testes para SnapshotManager
- Task 13: Implementar auto-cleanup de snapshots
- Task 14: Integrar snapshots nos pontos criticos

### Fase 3: Conflict Resolution (Tasks 15-20)

**Objetivo:** Robustez e recuperacao de erros

- Task 15: Implementar deteccao de inconsistencias
- Task 16: Testes para deteccao de inconsistencias
- Task 17: Implementar estrategias de resolucao
- Task 18: Testes para resolucao de conflitos
- Task 19: Implementar comando `feature sync`
- Task 20: Testes de integracao para sync manual

### Fase 4: Metrics & Polish (Tasks 21-26)

**Objetivo:** Metricas e UX final

- Task 21: Implementar MetricsCollector
- Task 22: Testes para MetricsCollector
- Task 23: Implementar flag `--unified` em status
- Task 24: Testes para status unificado
- Task 25: Implementar comando de restore de snapshot
- Task 26: Testes de integracao end-to-end

### Fase 5: Worktree Integration (Tasks 27-30)

**Objetivo:** Integracao completa com worktrees

- Task 27: Atualizar sync de worktrees para usar SyncEngine
- Task 28: Testes para sync de worktrees
- Task 29: Documentacao final
- Task 30: QA e polish final

---

## Apendice A: Formato Proposto de State Unificado

```typescript
interface UnifiedFeatureState {
  feature: string
  phase: string
  phaseStatus: 'not_started' | 'in_progress' | 'completed' | 'blocked'

  progress: {
    steps: StepProgress[]
    lastUpdated: string
  }

  tasks: {
    total: number
    byStatus: {
      pending: number
      in_progress: number
      completed: number
      blocked: number
    }
    byPriority: {
      P0: { total: number; completed: number }
      P1: { total: number; completed: number }
      P2: { total: number; completed: number }
    }
    items: TaskState[]
  }

  metrics: {
    startedAt: string
    totalDuration: number
    phasesDuration: Record<string, number>
    filesModified: number
    testsAdded: number
    coverageDelta: number
  }

  history: TransitionEntry[]

  inconsistencies: Inconsistency[]

  lastSynced: string
  syncStatus: 'synced' | 'pending' | 'conflict'
}
```

---

## Apendice B: Exemplo de History Entry

```json
{
  "id": "trans-2026-01-20-001",
  "timestamp": "2026-01-20T14:30:00.000Z",
  "fromPhase": "tasks",
  "toPhase": "arquitetura",
  "trigger": "adk feature next my-feature",
  "duration": 45000,
  "tasksCompleted": 5,
  "notes": "All P0 tasks completed successfully"
}
```

---

## Apendice C: Estrutura de Arquivos Proposta

```
.claude/plans/features/<feature-name>/
├── progress.md          # Existente - estado de alto nivel
├── tasks.md             # Existente - breakdown detalhado
├── prd.md               # Existente - requisitos
├── state.json           # NOVO - estado unificado (cache)
├── history.json         # NOVO - historico de transicoes
├── metrics.json         # NOVO - metricas agregadas
└── .snapshots/          # NOVO - diretorio de snapshots
    ├── pre-implement-2026-01-20.json
    ├── pre-qa-2026-01-21.json
    └── pre-finish-2026-01-22.json
```
