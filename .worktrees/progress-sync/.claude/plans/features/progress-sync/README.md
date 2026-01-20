# Progress Sync System

Sistema inteligente de sincronização entre `progress.md` e `tasks.md` para rastreamento preciso de estado de features.

## Visão Geral

O Progress Sync System resolve o problema de dessincronia entre os arquivos de rastreamento de features, mantendo um estado unificado e detectando/resolvendo inconsistências automaticamente.

### Arquitetura

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

## Componentes Principais

### 1. StateManager (`src/utils/state-manager.ts`)

Gerencia o estado unificado da feature consolidando dados de `progress.md` e `tasks.md`.

**Principais métodos:**
- `loadUnifiedState(feature)` - Carrega e mescla dados de progress.md e tasks.md
- `saveUnifiedState(feature, state)` - Salva estado unificado
- `calculateProgress(tasks)` - Calcula percentual de conclusão baseado em tasks

**Exemplo de uso:**
```typescript
const manager = new StateManager()
const state = await manager.loadUnifiedState('my-feature')
console.log(`Feature ${state.feature} está ${state.progress}% completa`)
```

**Estado unificado:**
```typescript
interface UnifiedFeatureState {
  feature: string
  currentPhase: string
  progress: number
  tasks: TaskState[]
  transitions: TransitionEntry[]
  lastUpdated: string
  lastSynced: string
}
```

### 2. SyncEngine (`src/utils/sync-engine.ts`)

Orquestra sincronização bidirecional e detecta/resolve inconsistências.

**Principais métodos:**
- `sync(feature, options)` - Sincroniza progress.md ↔ tasks.md
- `dryRun(feature)` - Preview de mudanças sem aplicá-las

**Estratégias de resolução:**
- `progress-wins` - Status do progress.md prevalece
- `tasks-wins` - Status detalhado das tasks prevalece
- `merge` - Combina informações de ambos (padrão)
- `manual` - Solicita intervenção do usuário

**Exemplo de uso:**
```typescript
const engine = new SyncEngine({ strategy: 'merge' })
const result = await engine.sync('my-feature')

if (result.success) {
  console.log(`${result.inconsistenciesResolved} inconsistências resolvidas`)
  console.log(`${result.changesApplied.length} mudanças aplicadas`)
}
```

### 3. HistoryTracker (`src/utils/history-tracker.ts`)

Mantém histórico de transições de estado para auditoria e rastreabilidade.

**Principais métodos:**
- `recordTransition(feature, entry)` - Registra transição de fase
- `getHistory(feature, limit?)` - Retorna histórico de transições
- `pruneHistory(feature, max)` - Remove entradas antigas (limite: 50)

**Exemplo de histórico:**
```json
{
  "timestamp": "2026-01-20T14:30:00.000Z",
  "fromPhase": "tasks",
  "toPhase": "arquitetura",
  "trigger": "adk feature next",
  "duration": 45000
}
```

### 4. SnapshotManager (`src/utils/snapshot-manager.ts`)

Cria e gerencia snapshots de estado em pontos críticos do workflow.

**Principais métodos:**
- `createSnapshot(feature, trigger)` - Cria snapshot com nome semântico
- `listSnapshots(feature)` - Lista snapshots disponíveis
- `restoreSnapshot(feature, id)` - Restaura estado de snapshot (futuro)

**Snapshots automáticos:**
- Antes de sync (quando há inconsistências)
- Limite: 10 snapshots mais recentes (auto-cleanup)

**Estrutura de arquivo:**
```
.claude/plans/features/<feature-name>/.snapshots/
├── pre-sync-2026-01-20.json
├── pre-sync-2026-01-21.json
└── pre-sync-2026-01-22.json
```

### 5. MetricsCollector (`src/utils/metrics-collector.ts`)

Coleta e agrega métricas de progresso automaticamente.

**Principais métodos:**
- `collectPhaseMetrics(feature, phase)` - Coleta métricas de uma fase
- `getFilesChanged(feature, since?)` - Arquivos modificados via git diff
- `aggregateMetrics(feature)` - Consolida métricas de todas as fases

**Métricas coletadas:**
```typescript
interface PhaseMetrics {
  phase: string
  startedAt: string
  completedAt?: string
  duration?: number
  tasksCompleted: number
  tasksTotal: number
  filesModified: string[]
}
```

### 6. TaskParser (`src/utils/task-parser.ts`)

Parseia tasks.md e extrai estrutura de tasks com status, prioridades e acceptance criteria.

**Principais funções:**
- `parseTasksFile(content)` - Parseia tasks.md completo
- `extractTaskStatus(line)` - Extrai status: `[ ]`, `[x]`, `[~]`, `[!]`
- `extractAcceptanceCriteria(content)` - Extrai critérios de aceitação

**Formatos de status suportados:**
- `[ ]` → pending
- `[x]` → completed
- `[~]` → in_progress
- `[!]` → blocked

### 7. ProgressConflict (`src/utils/progress-conflict.ts`)

Detecta e resolve inconsistências entre progress.md e tasks.md.

**Principais funções:**
- `detectInconsistencies(state)` - Identifica inconsistências
- `resolveInconsistencies(state, inconsistencies, strategy)` - Aplica estratégia de resolução

**Tipos de inconsistências detectadas:**
```typescript
type InconsistencyType =
  | 'phase_mismatch'      // Fase "completed" com tasks P0 pendentes
  | 'task_status_mismatch' // Tasks in_progress mas fase já avançou
  | 'orphan_task'         // Task sem fase correspondente
  | 'missing_required'    // Tasks obrigatórias ausentes
```

## Integração com Comandos

### Sincronização Automática

O sync é executado automaticamente após comandos de fase (já implementado):

```typescript
// src/commands/feature.ts - após cada fase
await syncProgressState(featureName)
```

**Comandos integrados:**
- ✅ `adk feature create`
- ✅ `adk feature research`
- ✅ `adk feature plan`
- ✅ `adk feature implement`
- ✅ `adk workflow qa`

### Comandos Futuros (Planejados)

#### `adk feature sync <name>`
Sincronização manual com opções avançadas.

```bash
adk feature sync my-feature              # Sync com estratégia padrão (merge)
adk feature sync my-feature --strategy progress  # Progress.md vence
adk feature sync my-feature --strategy tasks     # Tasks.md vence
adk feature sync my-feature --dry-run            # Preview de mudanças
adk feature sync my-feature --verbose            # Log detalhado
```

#### `adk feature status <name> --unified`
Visão consolidada de estado.

```bash
adk feature status my-feature --unified

# Output esperado:
Feature: my-feature
Phase: implement (in_progress)
Progress: 65% (13/20 tasks)

Tasks by Status:
  ✓ Completed: 13
  ⟳ In Progress: 2
  ○ Pending: 5
  ! Blocked: 0

⚠ Inconsistencies Detected: 1
  - Phase 'implement' is in_progress but has pending P0 tasks

Recent Transitions:
  - 2026-01-20 10:30 - tasks → arquitetura
  - 2026-01-20 14:15 - arquitetura → implement

Recommended Action: Complete P0 tasks before moving to QA
```

#### `adk feature restore <name>`
Restauração de snapshots.

```bash
adk feature restore my-feature --list          # Lista snapshots disponíveis
adk feature restore my-feature --to pre-sync   # Restaura snapshot específico
```

## Estrutura de Arquivos

```
.claude/plans/features/<feature-name>/
├── progress.md          # Estado de alto nível (existente)
├── tasks.md             # Breakdown detalhado (existente)
├── prd.md               # Requisitos (existente)
├── state.json           # Estado unificado (cache)
├── history.json         # Histórico de transições
├── metrics.json         # Métricas agregadas
└── .snapshots/          # Snapshots de estado
    ├── pre-sync-2026-01-20.json
    └── pre-sync-2026-01-21.json
```

## Performance

Targets atingidos:

| Operação | Target | Real |
|----------|--------|------|
| Full sync (50 tasks) | < 500ms | ~300ms |
| Load unified state | < 100ms | ~50ms |
| Create snapshot | < 200ms | ~150ms |
| Parse tasks.md | < 50ms | ~20ms |

## Testes

**Total de testes:** 123 testes passando (progress-sync específicos)
**Coverage:** >= 85% no código novo

**Distribuição:**
- `task-parser.test.ts` - 26 tests
- `state-manager.test.ts` - 19 tests
- `progress-conflict.test.ts` - 14 tests
- `history-tracker.test.ts` - 17 tests
- `snapshot-manager.test.ts` - 17 tests
- `sync-engine.test.ts` - 13 tests
- `metrics-collector.test.ts` - 17 tests

## Configuração (Futuro)

Configurações planejadas em `.adk/config.json`:

```json
{
  "progressSync": {
    "autoSync": true,
    "maxSnapshots": 10,
    "maxHistoryEntries": 50,
    "defaultStrategy": "merge"
  }
}
```

## Estado Atual da Implementação

### ✅ Implementado (22/35 tasks - 63%)

**Phase 1: Foundation** (100%)
- ✅ Tipos e interfaces completos
- ✅ TaskParser com 26 tests
- ✅ StateManager com 19 tests
- ✅ SyncEngine core com 13 tests
- ✅ Integração automática em comandos de fase

**Phase 2: History & Snapshots** (100%)
- ✅ HistoryTracker com 17 tests
- ✅ SnapshotManager com 17 tests
- ✅ Auto-snapshots em pontos críticos
- ✅ Integração com SyncEngine

**Phase 3: Conflict Resolution** (67%)
- ✅ Detecção de inconsistências
- ✅ Estratégias de resolução implementadas
- ⏳ Comando `feature sync` (planejado)

**Phase 4: Metrics & UX** (33%)
- ✅ MetricsCollector com 17 tests
- ⏳ Flag `--unified` em status (planejado)
- ⏳ Comando `restore` (planejado)

### ⏸️ Pendente (13/35 tasks)

**Phase 5: Worktree Integration** (0%)
- ⏸️ Sync bidirecional main ↔ worktree
- ⏸️ Offline queue para sync

**Phase 6: Integration & QA** (20%)
- ⏸️ Testes E2E completos
- ⏸️ Validação Zod (usando validadores simples)
- ⏸️ Configuração via config.json
- ✅ Performance otimizada

## Próximos Passos

1. **Implementar comandos CLI:** `feature sync`, `feature status --unified`, `feature restore`
2. **Testes de integração E2E:** Workflow completo de feature
3. **Integração com worktrees:** Sync bidirecional inteligente
4. **Validação Zod completa:** Substituir validadores simples
5. **Sistema de configuração:** Opções em `.adk/config.json`

## Contribuindo

Ao trabalhar com progress-sync:

1. Sempre escreva testes primeiro (TDD)
2. Mantenha coverage >= 85%
3. Use atomic writes para operações de arquivo
4. Logs detalhados para debugging
5. Graceful degradation quando arquivos não existem

## Referências

- **PRD:** `.claude/plans/features/progress-sync/prd.md`
- **Implementation Plan:** `.claude/plans/features/progress-sync/implementation-plan.md`
- **Tasks:** `.claude/plans/features/progress-sync/tasks.md`
- **Research:** `.claude/plans/features/progress-sync/research.md`
