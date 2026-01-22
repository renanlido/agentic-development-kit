# Long-Running Agents no ADK

Guia completo para implementar agentes de longa duracao no ADK.

---

## Indice

1. [O Problema Fundamental](#1-o-problema-fundamental)
2. [Solucoes da Anthropic](#2-solucoes-da-anthropic)
3. [Estado Atual do ADK](#3-estado-atual-do-adk)
4. [Proposta de Implementacao](#4-proposta-de-implementacao)
5. [Arquitetura Detalhada](#5-arquitetura-detalhada)
6. [Padroes de Implementacao](#6-padroes-de-implementacao)
7. [Roadmap](#7-roadmap)

---

## 1. O Problema Fundamental

### 1.1 Limitacao de Context Window

O desafio central dos long-running agents e que LLMs operam em sessoes discretas, e cada nova sessao comeca sem memoria do que veio antes. Context windows sao limitados, e projetos complexos nao podem ser completados em uma unica janela.

**Dados de pesquisa:**
- Task duration esta dobrando a cada 7 meses (METR Research)
- De tarefas de 1 hora em 2025 para workflows de 8+ horas em 2026
- Single-task reasoning evoluindo para multi-agent coordination

### 1.2 Sintomas do Problema

1. **Context Overflow**: Agente perde informacoes criticas no meio da implementacao
2. **One-Shot Syndrome**: Tentativa de fazer tudo de uma vez, resultando em trabalho incompleto
3. **Half-Implemented Features**: Sessao termina com feature pela metade e sem documentacao
4. **State Loss**: Proxima sessao comeca sem saber o que foi feito

### 1.3 Impacto no ADK Atual

O ADK ja enfrenta esses problemas:
- `feature implement` pode exceder context window em features complexas
- Pipelines de agentes nao persistem estado entre execucoes
- Nao ha mecanismo de checkpoint/resume

---

## 2. Solucoes da Anthropic

### 2.1 Two-Agent System

A Anthropic desenvolveu uma solucao de dois agentes:

```
┌─────────────────────────────────────────────────────────┐
│                    FIRST RUN                              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │           INITIALIZER AGENT                          ││
│  │  - Configura ambiente                                ││
│  │  - Cria estrutura de arquivos                        ││
│  │  - Define feature_list.json                          ││
│  │  - Cria init.sh                                      ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               SUBSEQUENT RUNS (N times)                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │             CODING AGENT                             ││
│  │  1. pwd (verificar diretorio)                        ││
│  │  2. Read claude-progress.txt + git logs              ││
│  │  3. Read feature_list.json                           ││
│  │  4. Execute init.sh (dev server)                     ││
│  │  5. Run e2e tests                                    ││
│  │  6. Work on SINGLE feature                           ││
│  │  7. Commit with descriptive message                  ││
│  │  8. Update progress documentation                    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 2.2 Componentes de State Management

| Componente | Funcao | Formato |
|------------|--------|---------|
| `claude-progress.txt` | Log de sessoes | Text |
| `feature_list.json` | Status de features | JSON |
| Git commits | Version history + recovery | Git |
| `.md` checkpoint files | State dump para handoff | Markdown |

### 2.3 Claude Agent SDK Features

**Automatic Compaction:**
```typescript
const agent = new Agent({
  model: 'claude-sonnet-4',
  compaction: true
})
```

**Subagentes para Paralelizacao:**
- Isolam context windows
- Retornam apenas informacoes relevantes
- Reduzem overhead de tokens

**Session Resumption:**
```typescript
const session = await agent.createSession()
await session.save('session-123')

const resumed = await Agent.resume('session-123')
```

### 2.4 Hosting Patterns

1. **Persistent Containers**: Para tasks que rodam continuamente
2. **Ephemeral Containers**: Hydrated com history e state, spins down apos completar

---

## 3. Estado Atual do ADK

### 3.1 O Que Ja Temos

| Componente | Status | Arquivo |
|------------|--------|---------|
| StateManager | ✅ Implementado | `src/utils/state-manager.ts` |
| ProgressSync | ✅ Implementado | `src/types/progress-sync.ts` |
| HistoryTracker | ✅ Implementado | `src/utils/history-tracker.ts` |
| SnapshotManager | ✅ Implementado | `src/utils/snapshot-manager.ts` |
| Parallel Execution | ✅ Implementado | `src/utils/parallel-executor.ts` |
| Agent Status | ✅ Implementado | `src/commands/agent.ts` |

### 3.2 O Que Falta

| Gap | Descricao | Prioridade |
|-----|-----------|------------|
| Session Resume | Retomar agente de checkpoint | Alta |
| Progress File | Arquivo de progresso entre sessoes | Alta |
| Feature List JSON | Lista de sub-features com status | Alta |
| Init Script | Script de setup por feature | Media |
| Compaction Hook | Summarize automatico pre-overflow | Media |
| Multi-Session Orchestration | Coordenacao de sessoes | Baixa |

### 3.3 Arquitetura Atual de Agentes

```typescript
async run(name: string, options: AgentOptions): Promise<void> {
  const agentPath = path.join(getAgentsPath(), `${name}.md`)
  const agentContent = await fs.readFile(agentPath, 'utf-8')
  const prompt = `Execute agent: ${name}\n${agentContent}`
  await executeClaudeCommand(prompt)
}
```

**Problemas:**
- Sem persistencia de estado entre runs
- Sem mecanismo de checkpoint
- Sem resumo de contexto

---

## 4. Proposta de Implementacao

### 4.1 Nova Estrutura de Arquivos

```
.claude/
├── plans/features/<feature>/
│   ├── prd.md
│   ├── tasks.md
│   ├── progress.md              # Existente
│   ├── state.json               # Existente
│   ├── history.json             # Existente
│   ├── feature-list.json        # NOVO: Lista de sub-features
│   ├── session-log.txt          # NOVO: Log de sessoes
│   ├── init.sh                  # NOVO: Script de setup
│   └── .sessions/               # NOVO: Checkpoints
│       ├── session-001.json
│       └── session-002.json
```

### 4.2 Novos Tipos

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
}

interface CheckpointRef {
  id: string
  createdAt: string
  step: string
  trigger: 'manual' | 'auto' | 'pre-overflow'
}

interface FeatureListItem {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  passes: boolean
  lastTested: string
  dependencies: string[]
}
```

### 4.3 Novos Comandos

```bash
adk agent run <name> --resume            # Resume de ultimo checkpoint
adk agent run <name> --session <id>      # Resume sessao especifica
adk agent checkpoint <name>              # Cria checkpoint manual
adk agent sessions <name>                # Lista sessoes
adk agent sessions <name> --prune        # Remove sessoes antigas
```

---

## 5. Arquitetura Detalhada

### 5.1 Session Manager

```typescript
class SessionManager {
  private sessionsPath: string
  private currentSession: LongRunningSession | null

  async startSession(feature: string): Promise<LongRunningSession> {
    const session: LongRunningSession = {
      id: `session-${Date.now()}`,
      feature,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      currentStep: 'init',
      completedSteps: [],
      pendingSteps: await this.loadPendingSteps(feature),
      contextSummary: '',
      checkpoints: []
    }
    await this.save(session)
    return session
  }

  async resumeSession(sessionId: string): Promise<LongRunningSession> {
    const session = await this.load(sessionId)
    session.lastActivity = new Date().toISOString()
    return session
  }

  async checkpoint(reason: string): Promise<CheckpointRef> {
    const checkpoint: CheckpointRef = {
      id: `cp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      step: this.currentSession!.currentStep,
      trigger: reason === 'pre-overflow' ? 'pre-overflow' : 'manual'
    }
    await this.saveCheckpoint(checkpoint)
    return checkpoint
  }
}
```

### 5.2 Context Compactor

```typescript
class ContextCompactor {
  private readonly maxTokens = 150000
  private readonly warningThreshold = 0.85

  async shouldCompact(currentTokens: number): Promise<boolean> {
    return currentTokens >= this.maxTokens * this.warningThreshold
  }

  async compact(context: string): Promise<string> {
    const prompt = `
Summarize the following context maintaining:
1. Current objective
2. What was completed
3. What is in progress
4. Blockers and next steps
5. Key decisions made

Context:
${context}
`
    return await executeClaudeCommand(prompt, { model: 'haiku' })
  }

  async createHandoffDocument(session: LongRunningSession): Promise<string> {
    return `
# Session Handoff: ${session.feature}

## Current State
- **Step:** ${session.currentStep}
- **Progress:** ${session.completedSteps.length}/${session.pendingSteps.length + session.completedSteps.length}

## Completed
${session.completedSteps.map(s => `- [x] ${s}`).join('\n')}

## Pending
${session.pendingSteps.map(s => `- [ ] ${s}`).join('\n')}

## Context Summary
${session.contextSummary}

## Last Activity
${session.lastActivity}
`
  }
}
```

### 5.3 Long-Running Agent Executor

```typescript
class LongRunningAgentExecutor {
  private sessionManager: SessionManager
  private compactor: ContextCompactor

  async run(agentName: string, options: LongRunningOptions): Promise<void> {
    let session: LongRunningSession

    if (options.resume) {
      session = await this.sessionManager.resumeLatest(options.feature)
      const handoff = await this.compactor.createHandoffDocument(session)
      await this.injectContext(handoff)
    } else {
      session = await this.sessionManager.startSession(options.feature)
    }

    while (session.pendingSteps.length > 0) {
      const step = session.pendingSteps[0]

      try {
        await this.executeStep(agentName, step, session)

        session.completedSteps.push(step)
        session.pendingSteps.shift()
        session.currentStep = session.pendingSteps[0] || 'completed'

        await this.sessionManager.save(session)
        await this.updateProgressFile(session)
        await this.commitProgress(step)

      } catch (error) {
        if (this.isContextOverflow(error)) {
          await this.sessionManager.checkpoint('pre-overflow')
          const summary = await this.compactor.compact(session.contextSummary)
          session.contextSummary = summary
          continue
        }
        throw error
      }
    }
  }

  private async updateProgressFile(session: LongRunningSession): Promise<void> {
    const logPath = path.join(
      this.getFeaturePath(session.feature),
      'session-log.txt'
    )

    const entry = `
[${new Date().toISOString()}] Completed: ${session.currentStep}
Progress: ${session.completedSteps.length}/${session.completedSteps.length + session.pendingSteps.length}
`
    await fs.appendFile(logPath, entry)
  }
}
```

### 5.4 Feature List Manager

```typescript
class FeatureListManager {
  async load(feature: string): Promise<FeatureListItem[]> {
    const listPath = path.join(
      this.getFeaturePath(feature),
      'feature-list.json'
    )

    if (await fs.pathExists(listPath)) {
      return await fs.readJSON(listPath)
    }

    const tasks = await this.parseTasksFile(feature)
    return tasks.map(t => ({
      name: t.name,
      status: 'pending',
      passes: false,
      lastTested: '',
      dependencies: t.dependencies || []
    }))
  }

  async update(
    feature: string,
    itemName: string,
    update: Partial<FeatureListItem>
  ): Promise<void> {
    const list = await this.load(feature)
    const item = list.find(i => i.name === itemName)

    if (item) {
      Object.assign(item, update)
      await this.save(feature, list)
    }
  }

  async getNextWorkable(feature: string): Promise<FeatureListItem | null> {
    const list = await this.load(feature)

    return list.find(item => {
      if (item.status !== 'pending') return false

      const deps = item.dependencies
      return deps.every(dep => {
        const depItem = list.find(i => i.name === dep)
        return depItem?.status === 'completed' && depItem?.passes
      })
    }) || null
  }
}
```

---

## 6. Padroes de Implementacao

### 6.1 Incremental Progress Pattern

**Problema**: Agente tenta fazer tudo de uma vez.

**Solucao**: Forcar trabalho em uma unica feature/step por iteracao.

```typescript
const prompt = `
CRITICAL: Work on ONLY ONE step at a time.

Current Step: ${currentStep}
Do NOT proceed to next step until this is complete and committed.

Workflow:
1. Read current state from session-log.txt
2. Implement ONLY ${currentStep}
3. Write tests for ${currentStep}
4. Verify tests pass
5. Commit with descriptive message
6. Update session-log.txt
7. STOP

Do NOT:
- Start multiple steps
- Skip testing
- Continue without committing
`
```

### 6.2 JSON Over Markdown Pattern

**Problema**: Agentes tendem a modificar/sobrescrever arquivos Markdown.

**Solucao**: Usar JSON para arquivos de estado criticos.

```typescript
const featureList = {
  meta: {
    created: '2026-01-20',
    lastModified: '2026-01-20',
    version: 1
  },
  items: [
    { name: 'auth-login', status: 'completed', passes: true },
    { name: 'auth-logout', status: 'in_progress', passes: false },
    { name: 'auth-refresh', status: 'pending', passes: false }
  ]
}
```

### 6.3 E2E Verification Pattern

**Problema**: Agentes confiam demais em testes unitarios.

**Solucao**: Exigir verificacao e2e como humano faria.

```typescript
const prompt = `
VERIFICATION REQUIRED before marking step complete:

1. Run unit tests: npm test
2. Start dev server: npm run dev
3. Open browser to localhost:3000
4. Test ${currentStep} as end user would
5. Take screenshot as evidence
6. Only then mark as complete
`
```

### 6.4 Handoff Document Pattern

**Problema**: Nova sessao nao sabe o que aconteceu.

**Solucao**: Criar documento estruturado de handoff.

```typescript
async function createHandoff(session: LongRunningSession): Promise<string> {
  return `
# Handoff Document

## What Was Done
${session.completedSteps.map(s => `- ${s}`).join('\n')}

## Current State
- Working on: ${session.currentStep}
- Last commit: ${await getLastCommit()}
- Tests passing: ${await runTests() ? 'Yes' : 'No'}

## What To Do Next
1. Read this document
2. Run init.sh to start dev server
3. Run tests to verify state
4. Continue from ${session.currentStep}

## Context You Need
${session.contextSummary}

## Important Decisions Made
${await loadDecisions(session.feature)}
`
}
```

### 6.5 Pre-Overflow Checkpoint Pattern

**Problema**: Context overflow perde trabalho.

**Solucao**: Checkpoint automatico quando perto do limite.

```typescript
async function checkContextHealth(tokensUsed: number): Promise<void> {
  const threshold = 0.85 * MAX_TOKENS

  if (tokensUsed >= threshold) {
    logger.warn('Context at 85%, creating checkpoint')

    await sessionManager.checkpoint('pre-overflow')

    const summary = await compactor.summarize(currentContext)
    await updateSession({ contextSummary: summary })

    throw new ContextCompactionNeeded()
  }
}
```

---

## 7. Roadmap

### Fase 1: Foundation (1-2 semanas)

**Objetivo:** Infraestrutura basica de long-running sessions.

| Task | Descricao | Arquivo |
|------|-----------|---------|
| SessionManager | Gerenciar sessoes | `src/utils/session-manager.ts` |
| session-log.txt | Log de progresso | Hook de escrita |
| feature-list.json | Status de sub-features | `src/utils/feature-list.ts` |
| CLI --resume | Flag para resume | `src/commands/agent.ts` |

**Entregaveis:**
- `adk agent run <name> --resume`
- Arquivos de sessao persistidos
- Handoff document gerado

### Fase 2: Compaction (1 semana)

**Objetivo:** Prevenir context overflow.

| Task | Descricao | Arquivo |
|------|-----------|---------|
| ContextCompactor | Summarize contexto | `src/utils/context-compactor.ts` |
| Token Counter | Estimar tokens usados | `src/utils/token-counter.ts` |
| Pre-overflow hook | Checkpoint automatico | Hook system |

**Entregaveis:**
- Compaction automatico
- Checkpoints pre-overflow
- Handoff documents

### Fase 3: Multi-Session Orchestration (2 semanas)

**Objetivo:** Coordenar multiplas sessoes.

| Task | Descricao | Arquivo |
|------|-----------|---------|
| Init Script | Script de setup | `src/utils/init-generator.ts` |
| Session Coordinator | Orquestrar sessoes | `src/utils/session-coordinator.ts` |
| E2E Verification | Testes como usuario | Integrar Playwright |

**Entregaveis:**
- `adk agent orchestrate <feature>`
- Sessions coordenadas
- Verificacao e2e

### Fase 4: Integration (1 semana)

**Objetivo:** Integrar com workflow existente.

| Task | Descricao |
|------|-----------|
| Feature Implement | Usar long-running sessions |
| QA Workflow | Verificacao multi-sessao |
| Memory Integration | Contexto semantico |

---

## Referencias

### Anthropic Engineering
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Enabling Claude Code to work more autonomously](https://www.anthropic.com/news/enabling-claude-code-to-work-more-autonomously)

### Workflow Orchestration
- [Temporal + AI Agents](https://temporal.io/blog/build-resilient-agentic-ai-with-temporal)
- [Stateful Agents](https://www.letta.com/blog/stateful-agents)
- [LangGraph Workflows](https://docs.langchain.com/oss/python/langgraph/workflows-agents)

### Design Patterns
- [Google's Multi-Agent Design Patterns](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/)
- [4 Agentic AI Design Patterns](https://research.aimultiple.com/agentic-ai-design-patterns/)

### Claude Agent SDK
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Hosting the Agent SDK](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
