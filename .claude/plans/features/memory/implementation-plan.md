# Implementation Plan: Sistema de Memoria Especializada

**Feature**: memory
**Data**: 2026-01-13
**Status**: Ready for Implementation

---

## Arquitetura Atual do ADK

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADK CLI (cli.ts)                               │
│                             Commander.js Router                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  FeatureCommand │         │ WorkflowCommand │         │  AgentCommand   │
│   (feature.ts)  │         │  (workflow.ts)  │         │   (agent.ts)    │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ • create        │         │ • daily         │         │ • create        │
│ • research      │         │ • preCommit     │         │ • run           │
│ • plan          │         │ • preDeploy     │         │ • pipeline      │
│ • implement     │         │ • qa            │         │                 │
│ • autopilot     │         │                 │         │                 │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UTILITIES LAYER                                   │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│    claude.ts         │    templates.ts      │         logger.ts             │
│ ┌──────────────────┐ │ ┌──────────────────┐ │ ┌───────────────────────────┐ │
│ │executeClaudeCmd()│ │ │ loadTemplate()   │ │ │ info/success/warn/error   │ │
│ │isClaudeInstalled│ │ │ copyTemplate()   │ │ │ debug (if DEBUG env)      │ │
│ └──────────────────┘ │ │ copyClaudeStruct │ │ └───────────────────────────┘ │
│                      │ └──────────────────┘ │                               │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SYSTEMS                                   │
├─────────────────────────────────┬───────────────────────────────────────────┤
│         Claude Code CLI         │              File System                   │
│   (subprocess via execSync)     │           (fs-extra lib)                   │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

---

## Arquitetura com Sistema de Memoria

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADK CLI (cli.ts)                               │
│                             Commander.js Router                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     │                                │                                │
     ▼                                ▼                                ▼
┌──────────────┐            ┌─────────────────┐             ┌─────────────────┐
│FeatureCommand│◄──HOOK────►│  MemoryCommand  │◄───HOOK────►│ WorkflowCommand │
│ (feature.ts) │            │  (memory.ts)    │             │  (workflow.ts)  │
├──────────────┤            ├─────────────────┤             ├─────────────────┤
│ • create     │            │ • save          │             │ • daily         │
│ • research ──┼──► save    │ • load          │    save ◄──┼─ preCommit      │
│ • plan ──────┼──► save    │ • view          │    save ◄──┼─ qa             │
│ • implement ─┼──► save    │ • compact       │             │                 │
│ • autopilot  │            │ • search        │             │                 │
└──────────────┘            │ • update        │             └─────────────────┘
                            └────────┬────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UTILITIES LAYER                                   │
├────────────────┬────────────────┬────────────────┬──────────────────────────┤
│   claude.ts    │  templates.ts  │   logger.ts    │   memory-utils.ts [NEW]  │
│ ┌────────────┐ │ ┌────────────┐ │ ┌────────────┐ │ ┌──────────────────────┐ │
│ │executeClaude│ │ │loadTemplate│ │ │info/success│ │ │ getMemoryPath()      │ │
│ │isClaudeInst│ │ │copyTemplate│ │ │warn/error  │ │ │ parseMemoryContent() │ │
│ └────────────┘ │ │copyClaudeSt│ │ │debug       │ │ │ serializeMemory()    │ │
│                │ └────────────┘ │ └────────────┘ │ │ countLines()         │ │
│                │                │                │ │ isOverLimit()        │ │
│                │                │                │ │ mergeMemory()        │ │
│                │                │                │ └──────────────────────┘ │
└────────────────┴────────────────┴────────────────┴──────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TYPES LAYER [NEW]                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/types/memory.ts                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ MemoryContent, ADR, Pattern, Risk, StateInfo, PhaseHistory, MemoryOpts │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SYSTEMS                                   │
├─────────────────────────────────┬───────────────────────────────────────────┤
│         Claude Code CLI         │              File System                   │
│   (compact usa p/ resumir)      │   .claude/plans/features/X/memory.md      │
│                                 │   .claude/memory/ (global)                 │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

---

## Fluxo de Dados: Memory Save

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO: memory save <feature>                        │
└──────────────────────────────────────────────────────────────────────────────┘

  Usuario executa                  MemoryCommand                  File System
       │                               │                              │
       │  adk memory save auth         │                              │
       ├──────────────────────────────►│                              │
       │                               │                              │
       │                               │  Verifica feature existe     │
       │                               ├─────────────────────────────►│
       │                               │◄─────────────────────────────┤
       │                               │                              │
       │                               │  Le memoria existente        │
       │                               ├─────────────────────────────►│
       │                               │◄─────────────────────────────┤
       │                               │                              │
       │                               │  Gera prompt para Claude     │
       │                               ├──────────┐                   │
       │                               │          │ executeClaudeCmd  │
       │                               │◄─────────┘                   │
       │                               │                              │
       │                               │  Merge com existente         │
       │                               ├──────────┐                   │
       │                               │          │ mergeMemory()     │
       │                               │◄─────────┘                   │
       │                               │                              │
       │                               │  Verifica limite 1000 linhas │
       │                               ├──────────┐                   │
       │                               │          │ isOverLimit()     │
       │                               │◄─────────┘                   │
       │                               │                              │
       │                               │  Salva memoria               │
       │                               ├─────────────────────────────►│
       │                               │                              │
       │  Exibe confirmacao            │                              │
       │◄──────────────────────────────┤                              │
       │                               │                              │
```

---

## Fluxo de Dados: Hook Automatico

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO: Hook pos-comando (automatico)                       │
└──────────────────────────────────────────────────────────────────────────────┘

  FeatureCommand                  MemoryCommand                  File System
       │                               │                              │
       │  research() completa          │                              │
       ├───────────────┐               │                              │
       │               │               │                              │
       │◄──────────────┘               │                              │
       │                               │                              │
       │  saveMemoryAfterPhase()       │                              │
       ├──────────────────────────────►│                              │
       │                               │                              │
       │                               │  Detecta fase: research      │
       │                               │  Extrai: arquivos analisados │
       │                               │  Extrai: riscos identificados│
       │                               │  Define: proxima fase = plan │
       │                               │                              │
       │                               │  Atualiza memoria            │
       │                               ├─────────────────────────────►│
       │                               │                              │
       │  Continua fluxo normal        │                              │
       │◄──────────────────────────────┤                              │
       │                               │                              │

  IMPORTANTE: Falha no save NAO bloqueia fluxo principal (try/catch com warn)
```

---

## Fluxo de Dados: Memory Search

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO: memory search <query>                               │
└──────────────────────────────────────────────────────────────────────────────┘

  Usuario                         MemoryCommand                  File System
       │                               │                              │
       │  adk memory search "JWT"      │                              │
       ├──────────────────────────────►│                              │
       │                               │                              │
       │                               │  Lista todos memory.md       │
       │                               ├─────────────────────────────►│
       │                               │◄─────────────────────────────┤
       │                               │  [auth/memory.md,            │
       │                               │   payments/memory.md, ...]   │
       │                               │                              │
       │                               │  Para cada arquivo:          │
       │                               │  ┌─────────────────────────┐ │
       │                               │  │ grep interno (nao shell)│ │
       │                               │  │ Coleta matches + context│ │
       │                               │  └─────────────────────────┘ │
       │                               │                              │
       │                               │  Ordena por relevancia       │
       │                               │  (numero de matches)         │
       │                               │                              │
       │  Exibe resultados formatados  │                              │
       │◄──────────────────────────────┤                              │
       │                               │                              │
       │  auth/memory.md:45            │                              │
       │    "ADR-001: Usamos JWT..."   │                              │
       │                               │                              │
```

---

## Estrutura de Arquivos de Memoria

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ESTRUTURA DE ARQUIVOS DE MEMORIA                         │
└─────────────────────────────────────────────────────────────────────────────┘

.claude/
├── memory/                              # MEMORIA GLOBAL (existente)
│   ├── project-context.md               # Contexto geral do projeto
│   ├── architecture.md                  # Arquitetura documentada
│   ├── current-state.md                 # Estado atual
│   └── conventions.md                   # Convencoes de codigo
│
└── plans/
    └── features/
        ├── auth/
        │   ├── prd.md
        │   ├── tasks.md
        │   ├── implementation-plan.md
        │   ├── context.md
        │   ├── memory.md                # [NEW] MEMORIA DA FEATURE
        │   └── memory-archive/          # [NEW] BACKUP DE COMPACTS
        │       └── memory-2026-01-13.md
        │
        ├── payments/
        │   ├── ...
        │   └── memory.md                # [NEW] MEMORIA DA FEATURE
        │
        └── memory/                      # ESTA FEATURE
            ├── prd.md
            ├── tasks.md
            └── implementation-plan.md

```

---

## Formato Padrao: memory.md

```markdown
# Memoria: [Feature Name]

**Ultima Atualizacao**: 2026-01-13 14:30
**Fase Atual**: implement
**Status**: in_progress

## Resumo Executivo

Breve descricao do estado atual da feature em 2-3 frases.

## Decisoes Arquiteturais

- **[ADR-001]**: Usar JWT para autenticacao
  - Razao: Stateless, escalavel, padrao da industria

- **[ADR-002]**: Armazenar tokens em httpOnly cookies
  - Razao: Mais seguro contra XSS que localStorage

## Padroes Identificados

- **Singleton Pattern**: Usado em commands (FeatureCommand, WorkflowCommand)
  - Arquivos: `src/commands/*.ts`

- **Error Handling**: Ora spinner + logger + process.exit(1)
  - Arquivos: Todos os commands

## Riscos e Dependencias

| Risco | Mitigacao |
|-------|-----------|
| Token expirado nao tratado | Implementar refresh token |
| Sessao nao invalidada no logout | Blacklist de tokens |

**Dependencias**:
- jsonwebtoken (npm)
- bcrypt (npm)
- Modulo de usuarios (interno)

## Estado Atual

**Concluido**:
- [x] Estrutura de arquivos
- [x] Testes unitarios para JWT utils

**Em Progresso**:
- [ ] Middleware de autenticacao

**Pendente**:
- [ ] Integracao com frontend
- [ ] Testes E2E

## Proximos Passos

1. Completar middleware de autenticacao
2. Adicionar refresh token
3. Integrar com login form

## Historico de Fases

| Data | Fase | Resultado |
|------|------|-----------|
| 2026-01-10 | research | completed |
| 2026-01-11 | plan | completed |
| 2026-01-12 | implement | in_progress |
```

---

## Padroes a Seguir (Extraidos do Codebase)

### 1. Padrao de Classe de Comando

```typescript
class MemoryCommand {
  async save(feature: string, options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Salvando memoria...').start()

    try {
      // Logica aqui
      spinner.succeed('Memoria salva')
    } catch (error) {
      spinner.fail('Erro ao salvar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const memoryCommand = new MemoryCommand()
```

### 2. Padrao de Validacao de Prerequisitos

```typescript
async save(feature: string): Promise<void> {
  const featurePath = path.join(process.cwd(), '.claude/plans/features', feature)

  if (!(await fs.pathExists(featurePath))) {
    spinner.fail(`Feature ${feature} nao encontrada`)
    logger.info(`Crie primeiro: adk feature new ${feature}`)
    process.exit(1)
  }

  // Continua...
}
```

### 3. Padrao de Import com node: Protocol

```typescript
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
```

### 4. Padrao de Opcoes com Interface

```typescript
interface MemoryOptions {
  feature?: string
  global?: boolean
  query?: string
  force?: boolean
}
```

### 5. Padrao de Prompt para Claude

```typescript
const prompt = `
TITULO DO PROMPT

Context: ${contextPath}
Feature: ${feature}

Tasks:
1. Tarefa 1
2. Tarefa 2

Output: ${outputPath}

IMPORTANTE: Restricoes aqui
`
```

---

## Detalhes de Implementacao por Arquivo

### src/types/memory.ts

```typescript
export interface MemoryContent {
  feature: string
  lastUpdated: string
  phase: MemoryPhase
  status: MemoryStatus
  summary: string
  decisions: ADR[]
  patterns: Pattern[]
  risks: Risk[]
  state: StateInfo
  nextSteps: string[]
  history: PhaseHistory[]
}

export type MemoryPhase = 'research' | 'plan' | 'implement' | 'qa' | 'deploy'
export type MemoryStatus = 'in_progress' | 'blocked' | 'completed'

export interface ADR {
  id: string
  decision: string
  reason: string
}

export interface Pattern {
  name: string
  description: string
  files: string[]
}

export interface Risk {
  description: string
  mitigation: string
}

export interface StateInfo {
  completed: string[]
  inProgress: string[]
  pending: string[]
}

export interface PhaseHistory {
  date: string
  phase: MemoryPhase
  result: 'completed' | 'blocked' | 'skipped'
}

export interface MemoryOptions {
  feature?: string
  global?: boolean
  query?: string
  force?: boolean
  phase?: MemoryPhase
}

export const MEMORY_LINE_LIMIT = 1000
export const MEMORY_WARNING_THRESHOLD = 0.8
```

### src/utils/memory-utils.ts

```typescript
import path from 'node:path'
import fs from 'fs-extra'
import type { MemoryContent, MemoryPhase, MEMORY_LINE_LIMIT } from '../types/memory'

export function getMemoryPath(feature?: string): string {
  const basePath = process.cwd()

  if (feature) {
    return path.join(basePath, '.claude/plans/features', feature, 'memory.md')
  }

  return path.join(basePath, '.claude/memory/project-context.md')
}

export function parseMemoryContent(content: string): MemoryContent {
  // Parse markdown para MemoryContent
  // Usar regex para extrair secoes
}

export function serializeMemoryContent(memory: MemoryContent): string {
  // Converter MemoryContent para markdown formatado
}

export function countLines(content: string): number {
  return content.split('\n').length
}

export function isMemoryOverLimit(
  content: string,
  limit = MEMORY_LINE_LIMIT
): { over: boolean; warning: boolean; count: number } {
  const count = countLines(content)
  return {
    over: count > limit,
    warning: count > limit * MEMORY_WARNING_THRESHOLD,
    count
  }
}

export function mergeMemoryContent(
  existing: MemoryContent,
  update: Partial<MemoryContent>
): MemoryContent {
  // Mesclar sem duplicar decisions
  // Atualizar lastUpdated
}

export function createDefaultMemory(feature: string): MemoryContent {
  return {
    feature,
    lastUpdated: new Date().toISOString(),
    phase: 'research',
    status: 'in_progress',
    summary: '',
    decisions: [],
    patterns: [],
    risks: [],
    state: { completed: [], inProgress: [], pending: [] },
    nextSteps: [],
    history: []
  }
}
```

### src/commands/memory.ts

```typescript
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'
import {
  getMemoryPath,
  parseMemoryContent,
  serializeMemoryContent,
  isMemoryOverLimit,
  mergeMemoryContent,
  createDefaultMemory,
} from '../utils/memory-utils'
import type { MemoryOptions, MemoryContent } from '../types/memory'

class MemoryCommand {
  async save(feature: string, options: MemoryOptions = {}): Promise<void> {
    // Implementacao conforme Task I2
  }

  async load(feature: string, options: MemoryOptions = {}): Promise<void> {
    // Implementacao conforme Task I3
  }

  async view(feature?: string, options: MemoryOptions = {}): Promise<void> {
    // Implementacao conforme Task I4
  }

  async compact(feature: string, options: MemoryOptions = {}): Promise<void> {
    // Implementacao conforme Task I5
  }

  async search(query: string, options: MemoryOptions = {}): Promise<void> {
    // Implementacao conforme Task I6
  }

  async update(options: MemoryOptions = {}): Promise<void> {
    // Implementacao conforme Task I7
  }
}

export const memoryCommand = new MemoryCommand()
```

---

## Modificacoes em Arquivos Existentes

### src/commands/feature.ts

Adicionar apos cada fase bem-sucedida:

```typescript
private async saveMemoryAfterPhase(feature: string, phase: MemoryPhase): Promise<void> {
  try {
    await memoryCommand.save(feature, { phase })
  } catch (error) {
    logger.warn(`Memoria nao salva: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Em research(), apos executeClaudeCommand:
await this.saveMemoryAfterPhase(name, 'research')

// Em plan(), apos executeClaudeCommand:
await this.saveMemoryAfterPhase(name, 'plan')

// Em implement(), apos executeClaudeCommand:
await this.saveMemoryAfterPhase(name, 'implement')
```

### src/cli.ts

Substituir comandos memory existentes por:

```typescript
import { memoryCommand } from './commands/memory'

const memory = program
  .command('memory')
  .description('Gerencia memoria especializada por feature')

memory
  .command('save <feature>')
  .description('Salva contexto atual para feature')
  .action((feature) => memoryCommand.save(feature))

memory
  .command('load <feature>')
  .description('Carrega memoria de feature')
  .action((feature) => memoryCommand.load(feature))

memory
  .command('view [feature]')
  .description('Visualiza memoria')
  .option('-g, --global', 'Visualiza memoria global')
  .action((feature, options) => memoryCommand.view(feature, options))

memory
  .command('compact <feature>')
  .description('Compacta memoria grande')
  .action((feature) => memoryCommand.compact(feature))

memory
  .command('search <query>')
  .description('Busca em memorias')
  .option('-f, --feature <feature>', 'Filtrar por feature')
  .action((query, options) => memoryCommand.search(query, options))

memory
  .command('update')
  .description('Atualiza memoria global')
  .action(() => memoryCommand.update())
```

---

## Ordem de Implementacao

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORDEM DE IMPLEMENTACAO                                │
└─────────────────────────────────────────────────────────────────────────────┘

SEMANA 1: Fundacao
├── Dia 1: T0 - Setup estrutura
├── Dia 2: T1 - Testes MemoryUtils
├── Dia 3: I1 - Implementar MemoryUtils
└── Dia 4: Verificar + ajustar

SEMANA 2: Comandos Basicos
├── Dia 1: T2 + I2 - memory save
├── Dia 2: T3 + I3 - memory load
├── Dia 3: T4 + I4 - memory view
└── Dia 4: Testes integracao

SEMANA 3: Comandos Avancados
├── Dia 1: T5 + I5 - memory compact
├── Dia 2: T6 + I6 - memory search
├── Dia 3: T7 + I7 - memory update
└── Dia 4: Testes integracao

SEMANA 4: Integracao + Finalizacao
├── Dia 1: T8 + I8 - Hook pos-comando
├── Dia 2: I9 - Registro CLI
├── Dia 3: R1 - E2E + docs
└── Dia 4: Code review + merge
```

---

## Riscos e Mitigacoes

| Risco | Impacto | Probabilidade | Mitigacao |
|-------|---------|---------------|-----------|
| Parse de markdown falha | Alto | Media | Testes extensivos + fallback para default |
| Memoria cresce demais | Alto | Media | Alertas automaticos + comando compact |
| Hook bloqueia fluxo | Alto | Baixa | try/catch com warn (nao bloqueia) |
| Performance de search | Medio | Baixa | Grep interno otimizado + limite de arquivos |
| Conflito de merge | Medio | Media | Estrategia de merge conservadora |

---

## Criterios de Aceitacao Final

- [ ] Todos os comandos funcionam via CLI
- [ ] Testes com coverage >= 80%
- [ ] Hook automatico nao bloqueia fluxo
- [ ] Search completa em < 100ms
- [ ] Documentacao CLAUDE.md atualizada
- [ ] Nenhum erro de lint
- [ ] Tipos TypeScript corretos

---

**Criado por**: ADK Autopilot - Architect Agent
**Aprovado por**: [Pendente]
**Data**: 2026-01-13
