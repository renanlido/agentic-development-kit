# ADK - Relatório de Arquitetura, Gaps e Fluxos

**Data de Geração:** 2026-01-30
**Versão ADK:** 1.0.0
**Autor:** Análise Automatizada via Claude Opus 4.5

---

## 📊 Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Arquivos TypeScript | 98 |
| Linhas de Código | 25.201 |
| Testes Totais | 1.747 |
| Testes Falhando | 126 (7.2%) |
| Taxa de Sucesso | 92.8% |
| Test Suites | 86 (11 falhando) |
| Grupos de Comandos | 5 principais + auxiliares |

---

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 O que é o ADK

O **ADK (Agentic Development Kit)** é um orquestrador CLI que implementa o framework **CADD** (Context-Agentic Development & Delivery). Ele atua como um wrapper sobre o Claude Code, automatizando o ciclo de desenvolvimento desde PRD até deployment.

**Stack Tecnológico:**
- Node.js >= 18
- TypeScript 5.3 (strict mode)
- Commander.js 14 (CLI parsing)
- Inquirer 13 (prompts interativos)
- Ora 9 (spinners)
- Biome 2.3 (linting/formatting)

### 1.2 Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLI LAYER (cli.ts)                          │
│  Commander.js parsing, argument handling, command registration  │
├─────────────────────────────────────────────────────────────────┤
│                  COMMAND LAYER (commands/*)                     │
│  Feature, Workflow, Agent, Memory, Deploy, Sync, Context, etc   │
├─────────────────────────────────────────────────────────────────┤
│               INTEGRATION LAYER (providers/*)                   │
│  ClickUp, Local filesystem, future providers                    │
├─────────────────────────────────────────────────────────────────┤
│                  UTILITY LAYER (utils/*)                        │
│  Claude, Templates, Progress, Sync, Token, Compaction, etc      │
├─────────────────────────────────────────────────────────────────┤
│                   TYPE LAYER (types/*)                          │
│  Zod schemas, TypeScript interfaces, enums                      │
├─────────────────────────────────────────────────────────────────┤
│              EXTERNAL SERVICES (Claude Code, MCP)               │
│  Subprocess spawning via utils/claude.ts                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Estrutura de Diretórios

```
src/                           # 98 arquivos (~25k LOC)
├── cli.ts                     # Entry point (Commander.js)
├── cli-v3.ts                  # Experimental session tracking
├── commands/                  # 15 comandos
│   ├── feature.ts             # 4.783 linhas (maior arquivo)
│   ├── workflow.ts            # Automação diária/pre-commit
│   ├── agent.ts               # Gestão de agentes
│   ├── memory.ts              # Sistema de memória
│   ├── context.ts             # Token management
│   ├── sync.ts                # Sincronização com providers
│   └── ...outros
├── utils/                     # 58+ utilitários
│   ├── claude.ts              # Execução headless de Claude
│   ├── progress.ts            # Tracking de progresso
│   ├── state-manager.ts       # Estado unificado
│   ├── context-compactor.ts   # Compactação de contexto
│   ├── parallel-executor.ts   # Execução paralela
│   └── ...outros
├── types/                     # 18 arquivos de tipos
│   ├── progress-sync.ts       # UnifiedFeatureState
│   ├── parallel.ts            # Métricas de execução
│   └── ...outros
└── providers/                 # Sistema de providers
    ├── clickup/               # Integração ClickUp
    └── local.ts               # Provider local
```

---

## 2. GRUPOS DE COMANDOS

### 2.1 Mapeamento de Comandos

| Grupo | Arquivo | Subcomandos | Responsabilidade |
|-------|---------|-------------|------------------|
| **feature** | feature.ts | new, research, tasks, plan, implement, qa, docs, finish, list, sync, status, compact, autopilot, quick | Lifecycle completo de features |
| **workflow** | workflow.ts | daily, pre-commit, pre-deploy | Automação de rotinas |
| **agent** | agent.ts | create, run, pipeline, parallel, status | Gestão de agentes especializados |
| **memory** | memory.ts | save, load, view, compact, search, sync, recall, index, queue | Sistema de memória persistente |
| **deploy** | deploy.ts | staging, production, rollback | Gerenciamento de deploy |
| **context** | context.ts | status, prune | Token management |
| **sync** | sync.ts | sync, push, pull | Sincronização com providers |
| **config** | config.ts | set, get, list | Configuração |
| **spec** | spec.ts | create, validate, generate | Especificações |
| **report** | report.ts | activity, summary | Relatórios de atividade |

### 2.2 Registro de Comandos (cli.ts)

```typescript
program.command('feature')
  .description('Feature lifecycle management')
  .addCommand(/* new */)
  .addCommand(/* research */)
  .addCommand(/* implement */)
  // ...15+ subcomandos
```

---

## 3. FLUXOS DE EXECUÇÃO

### 3.1 Fluxo Principal: Feature Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE LIFECYCLE (8 FASES)                  │
└─────────────────────────────────────────────────────────────────┘

FASE 0: NEW (Inicialização)
├─ Cria estrutura em .claude/plans/features/<name>/
├─ Gera prd.md via Claude
├─ Inicializa progress.md
└─ Define active-focus.md

FASE 1: RESEARCH (Análise)
├─ PRÉ-REQUISITO: prd.md existe
├─ Analisa codebase, padrões, riscos
└─ OUTPUT: research.md

FASE 2: TASKS (Decomposição)
├─ PRÉ-REQUISITO: research.md
├─ Decompõe em tarefas executáveis
└─ OUTPUT: tasks.md (checkbox format)

FASE 3: PLAN (Arquitetura)
├─ PRÉ-REQUISITO: research.md + spec válida
├─ Cria plano técnico detalhado
└─ OUTPUT: implementation-plan.md

FASE 4: IMPLEMENT (Implementação)
├─ PRÉ-REQUISITO: implementation-plan.md
├─ DECISÃO: --parallel ou sequencial
├─ Cria worktree isolado
├─ Executa tasks (agentes especializados)
└─ OUTPUT: código implementado

FASE 5: QA (Quality Assurance)
├─ Code review automatizado
├─ Verificação de testes
└─ OUTPUT: qa-report.md

FASE 6: DOCS (Documentação)
├─ Gera/atualiza documentação
└─ OUTPUT: README, API docs

FASE 7: FINISH (Finalização)
├─ Commit + push + PR
├─ Cleanup do worktree
└─ Sync com provider remoto
```

### 3.2 Fluxo de Execução Paralela

```
feature implement <name> --parallel --agents 4
           │
           ▼
┌─────────────────────────────────────┐
│  parseTasksForParallel()            │
│  Extrai tasks de tasks.md           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  createSchedulePlan()               │
│  Agrupa tasks em waves (ondas)      │
│  baseado em dependências            │
└──────────────┬──────────────────────┘
               │
               ▼
     ┌─────────┴─────────┐
     │     WAVE 1        │
     ├───────────────────┤
     │ Task A  │ Task B  │  ← Paralelo
     │ (agent1)│ (agent2)│
     └────────┬──────────┘
              │ aguarda wave
              ▼
     ┌─────────────────┐
     │     WAVE 2      │
     ├─────────────────┤
     │ Task C │ Task D │  ← Paralelo
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ Merge & Cleanup │
     └─────────────────┘
```

### 3.3 Fluxo de Agent Routing

```
Task detectada
       │
       ▼
┌─────────────────────────────────────┐
│  detectTaskType(title, content)     │
│  Analisa keywords                   │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
  "unit test"     "feature"
       │               │
       ▼               ▼
┌─────────────┐ ┌─────────────┐
│ unit-test-  │ │ feature-    │
│ specialist  │ │ developer   │
│ (Sonnet)    │ │ (Opus)      │
└─────────────┘ └─────────────┘
```

### 3.4 Fluxo de Context Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN MANAGEMENT FLOW                        │
└─────────────────────────────────────────────────────────────────┘

        Usage < 70%           70-85%           85-95%          > 95%
            │                   │                │               │
            ▼                   ▼                ▼               ▼
        ┌───────┐         ┌─────────┐      ┌──────────┐    ┌─────────┐
        │ RAW   │         │ COMPACT │      │ SUMMARIZE│    │ HANDOFF │
        │(ok)   │         │(warn)   │      │(urgent)  │    │(critical)│
        └───────┘         └────┬────┘      └────┬─────┘    └────┬────┘
                               │                 │               │
                               ▼                 ▼               ▼
                          Comprime          Cria resumo    Gera handoff
                          seções            + arquiva      document
                          verbosas          detalhes       mínimo
```

---

## 4. PADRÕES DE DESIGN IDENTIFICADOS

### 4.1 Padrões Aplicados

| Padrão | Onde | Uso |
|--------|------|-----|
| **Singleton** | Commands (feature, memory, etc) | Uma instância por comando |
| **Factory** | providers/index.ts | Criação de providers |
| **Strategy** | Conflict resolution | merge/tasks-wins/progress-wins |
| **State Machine** | Feature lifecycle | Transições de fase |
| **Command** | Commander.js | CLI parsing |
| **Template Method** | Feature phases | Validação antes de execução |
| **Builder** | Wave scheduler | Construção de plano |
| **Retry/Fallback** | CDR (Cognitive Delivery Resilience) | Resiliência |
| **Observer** | Hook system | Eventos de tool use |
| **Composite** | StateManager | Agregação de progress + tasks |

### 4.2 Princípios Seguidos

- **Single Responsibility**: Cada módulo com propósito único
- **Dependency Injection**: Utils recebem deps para testabilidade
- **Type Safety**: TypeScript strict + Zod validation
- **Resilience**: Retry, fallback, health probes, snapshots
- **Observability**: Logging, metrics, progress tracking

---

## 5. SISTEMA DE HOOKS

### 5.1 Hooks Disponíveis

| Hook | Evento | Propósito |
|------|--------|-----------|
| `inject-focus.sh` | UserPromptSubmit | Injeta contexto da feature ativa |
| `scope-check.sh` | PreToolUse (Write) | Alerta edições fora do escopo |
| `validate-bash.sh` | PreToolUse (Bash) | Bloqueia comandos perigosos |
| `session-bootstrap.sh` | SessionStart | Auto-carrega feature context |
| `session-checkpoint.sh` | Stop | Cria snapshot de recovery |
| `pre-overflow.sh` | PreToolUse | Avisa quando contexto > 90% |
| `block-ai-commits.sh` | PreToolUse | Bloqueia commits com menção a IA |

### 5.2 Configuração (settings.json)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "command": "bash .claude/hooks/inject-focus.sh" }
    ],
    "PreToolUse": [
      { "command": "bash .claude/hooks/scope-check.sh", "matcher": "Write" },
      { "command": "bash .claude/hooks/validate-bash.sh", "matcher": "Bash" }
    ]
  }
}
```

---

## 6. INTEGRAÇÕES EXTERNAS

### 6.1 Claude Code Integration

```typescript
executeClaudeCommand(prompt, options)
├─ Valida modelo (opus/sonnet/haiku)
├─ Spawn processo: claude -p --dangerously-skip-permissions
├─ Parse stream JSON
├─ Coleta métricas (tools, tokens, duration)
└─ Retorna resultado
```

### 6.2 MCP Memory Integration

```typescript
MemoryMCP {
  connect()           // Handshake com servidor
  index(content)      // Indexa documento
  recall(query)       // Busca semântica

  // Features:
  - Retry com exponential backoff
  - Timeout protection (5s)
  - Fallback para Fuse.js (keyword search)
}
```

### 6.3 ClickUp Integration

```typescript
ClickUpProvider {
  connect()           // Auth com API token
  getWorkspaces()     // Lista workspaces
  getTasks()          // Fetch remote tasks
  createTask()        // Push local → remote
  sync()              // Bidirecional

  // Mapping:
  research → To Do
  implement → In Progress
  qa → In Review
  complete → Done
}
```

---

## 7. GAPS E PROBLEMAS IDENTIFICADOS

### 7.1 Problemas Críticos 🔴

| Issue | Localização | Impacto | Recomendação |
|-------|-------------|---------|--------------|
| **126 testes falhando** | tests/ | Qualidade comprometida | Corrigir antes de release |
| **Arquivo monolítico** | feature.ts (4.783 linhas) | Manutenção difícil | Dividir em módulos |
| **Uso de `any`** | progress-sync.ts, state-sync-hook.ts | Type safety | Usar `unknown` + type guards |
| **Validação de input ausente** | feature names, bounds | Segurança | Adicionar validação |
| **Symlinks circulares** | .claude/ directories | Biome errors | Melhorar fix-worktrees |

### 7.2 Problemas Altos 🟠

| Issue | Localização | Impacto | Recomendação |
|-------|-------------|---------|--------------|
| **Catch blocks vazios** | state-manager.ts:67 | Erros silenciosos | Log + rethrow |
| **Código duplicado** | Prompt patterns (~10x) | DRY violation | Extrair utility |
| **Timeout inconsistente** | Vários arquivos (5s, 30s, 2s) | Comportamento imprevisível | Unificar configuração |
| **Math.random()** | sync-queue.ts | Segurança | Usar crypto.randomBytes |
| **11 test suites com skip/todo** | tests/ | Cobertura incompleta | Implementar testes |

### 7.3 Problemas Médios 🟡

| Issue | Localização | Impacto | Recomendação |
|-------|-------------|---------|--------------|
| **Operações síncronas** | execFileSync() em vários | Performance | Avaliar necessidade |
| **Template caching ausente** | loadTemplate() | Performance | Adicionar cache |
| **Versão hardcoded** | cli.ts:24 | Manutenção | Ler de package.json |
| **JSDoc ausente** | Métodos públicos | Documentação | Adicionar gradualmente |
| **cli-v3.ts experimental** | cli-v3.ts | Drift de código | Deprecar ou manter |

### 7.4 Problemas Baixos 🟢

| Issue | Localização | Impacto | Recomendação |
|-------|-------------|---------|--------------|
| **4 violações Biome** | context.ts | Estilo | `npm run check:fix` |
| **Comando deprecated** | memory update | API | Remover em próxima major |
| **Hard-coded values** | agent count (3) | Configurabilidade | Extrair para config |

---

## 8. COBERTURA DE TESTES

### 8.1 Status Atual

```
Test Suites: 11 failed, 75 passed, 86 total
Tests:       126 failed, 1621 passed, 1747 total
Pass Rate:   92.8%
```

### 8.2 Testes Falhando (Principais Causas)

| Categoria | Qtd | Causa Raiz |
|-----------|-----|------------|
| Model router | 4 | Mapping retorna opus ao invés de sonnet |
| Progress sync | 1 | Parser não reconhece status "failed" |
| Compaction | 1 | `pruneProjectContext` retorna 0 linhas |
| Skipped/todo | 11+ | Não implementados |

### 8.3 Áreas com Cobertura Fraca

| Componente | Status | Observação |
|------------|--------|------------|
| utils/logger.ts | Missing | Sem testes |
| commands/init.ts | Parcial | 1 teste básico |
| commands/agent.ts | Parcial | Falta edge cases |
| Error paths | Fraco | Maioria happy path |
| ClickUp provider | Parcial | Mock-based |

---

## 9. RECOMENDAÇÕES DE AÇÃO

### 9.1 Prioridade Crítica (Antes do Próximo Release)

1. **Corrigir 126 testes falhando**
   - Ajustar model-router para retornar modelos corretos
   - Adicionar status "failed" no parser de progress
   - Corrigir pruneProjectContext

2. **Adicionar validação de input**
   ```typescript
   function validateFeatureName(name: string): void {
     if (/[/\\]|\.\./.test(name)) {
       throw new Error('Feature name contains invalid characters')
     }
     if (name.length > 50) {
       throw new Error('Feature name too long (max 50 chars)')
     }
   }
   ```

3. **Resolver symlinks circulares**
   - Melhorar detecção em fix-worktrees
   - Adicionar verificação antes de criar symlinks

4. **Remover `any` types**
   ```typescript
   // De:
   let state: any = {}

   // Para:
   let state: Partial<UnifiedFeatureState> = {}
   ```

### 9.2 Prioridade Alta (Próximo Sprint)

5. **Refatorar feature.ts**
   - Extrair: `feature-worktree.ts` (gestão de worktrees)
   - Extrair: `feature-sync.ts` (sincronização)
   - Extrair: `feature-execute.ts` (execução de tasks)
   - Manter: `feature.ts` como orquestrador

6. **Padronizar error handling**
   ```typescript
   // Criar utility:
   export function logAndExit(error: unknown, exitCode = 1): never {
     logger.error(error instanceof Error ? error.message : String(error))
     process.exit(exitCode)
   }
   ```

7. **Extrair prompt builder**
   ```typescript
   // utils/prompt-builder.ts
   export function buildDeploymentPrompt(feature: string, tasks: string[]): string
   export function buildResearchPrompt(prd: string, context: string): string
   ```

### 9.3 Prioridade Média (Backlog)

8. **Adicionar template caching**
9. **Documentar algoritmos complexos** (wave-scheduler, parallel-executor)
10. **Decidir sobre cli-v3.ts** (deprecar ou promover)
11. **Unificar timeouts em configuração**

---

## 10. DEPENDÊNCIAS PRINCIPAIS

| Package | Versão | Uso |
|---------|--------|-----|
| commander | ^14.0 | CLI parsing |
| inquirer | ^13.2 | Prompts interativos |
| ora | ^9.0 | Progress spinners |
| chalk | ^5.6 | Terminal colors |
| fs-extra | ^11.3 | File system operations |
| @anthropic-ai/sdk | ^0.32 | Claude SDK |
| fuse.js | ^7.1 | Fuzzy search |
| simple-git | ^3.30 | Git operations |
| tiktoken | ^1.0.22 | Token counting |
| zod | ^4.3 | Schema validation |

---

## 11. MÉTRICAS DE SAÚDE DO CÓDIGO

### 11.1 Complexidade por Módulo

| Arquivo | Linhas | Complexidade | Status |
|---------|--------|--------------|--------|
| feature.ts | 4.783 | ALTA | Precisa refatoração |
| state-manager.ts | 763 | MÉDIA | Aceitável |
| context-compactor.ts | 501 | MÉDIA | Aceitável |
| stream-parser.ts | 496 | MÉDIA | Aceitável |
| memory.ts | 898 | MÉDIA-ALTA | Considerar split |

### 11.2 Debt Score Estimado

| Categoria | Pontos | Peso |
|-----------|--------|------|
| Testes falhando | 126 × 2 | 252 |
| `any` types | 4 × 5 | 20 |
| Catch vazios | 3 × 10 | 30 |
| TODO/FIXME | 5 × 3 | 15 |
| Código duplicado | 10 × 2 | 20 |
| **TOTAL** | | **337** |

*Score < 100: Saudável | 100-300: Atenção | > 300: Crítico*

---

## 12. CONCLUSÃO

O ADK é uma ferramenta robusta com arquitetura bem definida, mas possui débito técnico significativo que precisa ser endereçado:

**Pontos Fortes:**
- Arquitetura em camadas clara
- Sistema de hooks extensível
- Suporte a execução paralela
- Gestão de contexto sofisticada
- Integração com providers externos

**Pontos a Melhorar:**
- Cobertura de testes (126 falhando)
- Arquivo monolítico (feature.ts)
- Validação de inputs
- Consistência de padrões de erro
- Type safety (eliminar `any`)

**Recomendação Geral:**
Focar nas correções críticas antes de adicionar novas features. O sistema está funcional mas precisa de consolidação técnica.

---

*Relatório gerado automaticamente em 2026-01-30*
*Próxima revisão sugerida: 2026-02-28*
