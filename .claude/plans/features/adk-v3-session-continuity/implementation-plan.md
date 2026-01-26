# Implementation Plan: adk-v3-session-continuity

**Data:** 2026-01-25
**Status:** Ready for Implementation
**Sprints:** 0 (Setup) + 1 (Session Store)
**Total Story Points:** 21

---

## Executive Summary

Este plano detalha a implementação do sistema de continuidade de sessão para ADK v3, resolvendo o problema crítico de perda de contexto entre fases de desenvolvimento. A estratégia é criar um CLI completamente separado (v3) para desenvolvimento seguro sem afetar o v2 em produção.

### Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI V3 (Novo)                           │
│                                                                 │
│  cli-v3.ts ──► feature-v3.ts ──► claude-v3.ts ──► Claude CLI   │
│                      │                │                         │
│                      │                ▼                         │
│                      │         SessionStore                     │
│                      │                │                         │
│                      ▼                ▼                         │
│              .claude/plans/features/{name}/sessions/            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CLI V2 (Congelado)                          │
│                                                                 │
│  cli.ts ──► feature.ts ──► claude.ts ──► Claude CLI            │
│                                                                 │
│  ⛔ NENHUMA MODIFICAÇÃO PERMITIDA                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sprint 0: Setup do CLI Isolado

**Objetivo:** Criar infraestrutura básica do CLI v3 completamente separada do v2.

**Story Points Total:** 5

### Fase 0.1: Estrutura de Arquivos Base

| Campo | Valor |
|-------|-------|
| **Objetivo** | Criar arquivos e diretórios básicos para v3 |
| **Story Points** | 2 |
| **Dependências** | Nenhuma |

#### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/cli-v3.ts` | Entry point do CLI v3 |
| `src/commands/feature-v3.ts` | Comandos feature para v3 |
| `src/utils/prompts/.gitkeep` | Diretório para prompts futuros |

#### Implementação: `src/cli-v3.ts`

```typescript
#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { featureV3Command } from './commands/feature-v3.js'

const program = new Command()

program
  .name('adk3')
  .description('ADK v3 - Session Continuity Preview')
  .version('3.0.0-alpha')

const feature = program
  .command('feature')
  .description('Feature commands with session tracking')

feature
  .command('status <name>')
  .description('Show feature status including sessions')
  .action((name) => featureV3Command.status(name))

program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '))
  process.exit(1)
})

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
```

#### Implementação: `src/commands/feature-v3.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import { logger } from '../utils/logger.js'

class FeatureV3Command {
  async status(name: string): Promise<void> {
    const spinner = ora(`Loading status for ${name}...`).start()

    try {
      spinner.succeed(`Feature: ${chalk.cyan(name)}`)
      console.log(chalk.gray('Session tracking not yet implemented'))
      console.log(chalk.gray('This is ADK v3 preview'))
    } catch (error) {
      spinner.fail('Error loading status')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const featureV3Command = new FeatureV3Command()
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/cli-v3.test.ts` | CLI inicializa corretamente |
| | `--version` retorna versão |
| | `--help` exibe ajuda |
| | Comando inválido exibe erro |

#### Critérios de Aceitação

- [ ] `src/cli-v3.ts` compila sem erros
- [ ] `src/commands/feature-v3.ts` compila sem erros
- [ ] Estrutura de diretórios criada
- [ ] Nenhum arquivo v2 modificado

---

### Fase 0.2: Scripts npm e Build

| Campo | Valor |
|-------|-------|
| **Objetivo** | Adicionar scripts para executar v3 sem afetar v2 |
| **Story Points** | 1 |
| **Dependências** | Fase 0.1 |

#### Modificações em `package.json`

```json
{
  "scripts": {
    "adk3": "node dist/cli-v3.js",
    "adk3:dev": "npx tsx src/cli-v3.ts"
  }
}
```

#### Testes Necessários

| Teste | Comando |
|-------|---------|
| Build compila v3 | `npm run build && ls dist/cli-v3.js` |
| Script adk3 funciona | `npm run adk3 -- --version` |
| Script adk3:dev funciona | `npm run adk3:dev -- --version` |

#### Critérios de Aceitação

- [ ] `npm run build` compila `cli-v3.ts` sem erros
- [ ] `npm run adk3 -- --version` exibe `3.0.0-alpha`
- [ ] `npm run adk3 -- --help` exibe comandos disponíveis
- [ ] `npm run adk3 -- feature --help` exibe subcomandos

---

### Fase 0.3: Validação de Isolamento

| Campo | Valor |
|-------|-------|
| **Objetivo** | Garantir que v2 permanece intocado |
| **Story Points** | 2 |
| **Dependências** | Fase 0.2 |

#### Verificações de Isolamento

```bash
git diff src/cli.ts
git diff src/commands/feature.ts
npm run build
node dist/cli.js --version
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/v3-isolation.test.ts` | Verifica que cli.ts não foi modificado |
| | Verifica que feature.ts não foi modificado |
| | v2 e v3 podem coexistir |

#### Critérios de Aceitação

- [ ] `git diff src/cli.ts` retorna vazio
- [ ] `git diff src/commands/feature.ts` retorna vazio
- [ ] v2 CLI (`node dist/cli.js`) continua funcionando
- [ ] v3 CLI (`npm run adk3`) funciona independentemente

---

### Checkpoint Sprint 0

**Validação Completa:**

```bash
npm run build
npm run adk3 -- --version
npm run adk3 -- --help
npm run adk3 -- feature status test
node dist/cli.js --version
git diff src/cli.ts
git diff src/commands/feature.ts
npm test -- tests/cli-v3.test.ts
```

---

## Sprint 1: Session Store & Claude V3

**Objetivo:** Implementar sistema de persistência de sessões e nova interface Claude com captura de session ID.

**Story Points Total:** 16

### Fase 1.1: Tipos e Interfaces

| Campo | Valor |
|-------|-------|
| **Objetivo** | Definir interfaces para v3 |
| **Story Points** | 2 |
| **Dependências** | Sprint 0 completo |

#### Arquivo: `src/types/session-v3.ts`

```typescript
export interface SessionInfoV3 {
  id: string
  claudeSessionId: string | null
  feature: string
  startedAt: string
  lastActivity: string
  status: 'active' | 'completed' | 'interrupted'
  resumable: boolean
  metadata?: {
    model?: string
    exitCode?: number
    duration?: number
  }
}

export interface ClaudeV3Options {
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string
  printSessionId?: boolean
  timeout?: number
  onOutput?: (chunk: string) => void
}

export interface ClaudeV3Result {
  output: string
  sessionId: string | null
  exitCode: number
  duration: number
}
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/types/session-v3.test.ts` | SessionInfoV3 aceita dados válidos |
| | ClaudeV3Options aceita opções válidas |
| | ClaudeV3Result aceita resultados válidos |

#### Critérios de Aceitação

- [ ] Tipos compilam sem erros
- [ ] Tipos são exportados corretamente
- [ ] Compatibilidade com tipos existentes verificada

---

### Fase 1.2: SessionStore Implementation

| Campo | Valor |
|-------|-------|
| **Objetivo** | Criar classe para persistência de sessões |
| **Story Points** | 5 |
| **Dependências** | Fase 1.1 |

#### Arquivo: `src/utils/session-store.ts`

```typescript
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import type { SessionInfoV3 } from '../types/session-v3.js'

export class SessionStore {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  getSessionsPath(feature: string): string {
    return path.join(
      this.getBasePath(),
      '.claude', 'plans', 'features', feature, 'sessions'
    )
  }

  async save(feature: string, session: SessionInfoV3): Promise<void> {
    const sessionsPath = this.getSessionsPath(feature)
    await fs.ensureDir(sessionsPath)

    const currentPath = path.join(sessionsPath, 'current.json')
    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)

    await fs.writeJSON(tempPath, session, { spaces: 2 })
    await fs.move(tempPath, currentPath, { overwrite: true })

    const historyDir = path.join(sessionsPath, 'history')
    await fs.ensureDir(historyDir)
    const historyPath = path.join(historyDir, `${session.id}.json`)
    await fs.copy(currentPath, historyPath)
  }

  async get(feature: string): Promise<SessionInfoV3 | null> {
    const currentPath = path.join(this.getSessionsPath(feature), 'current.json')

    if (!(await fs.pathExists(currentPath))) {
      return null
    }

    try {
      return await fs.readJSON(currentPath)
    } catch {
      return null
    }
  }

  async getLatest(feature: string): Promise<SessionInfoV3 | null> {
    return this.get(feature)
  }

  async list(feature: string): Promise<SessionInfoV3[]> {
    const historyDir = path.join(this.getSessionsPath(feature), 'history')

    if (!(await fs.pathExists(historyDir))) {
      return []
    }

    const files = await fs.readdir(historyDir)
    const sessions: SessionInfoV3[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const session = await fs.readJSON(path.join(historyDir, file))
        sessions.push(session)
      } catch {}
    }

    return sessions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  }

  async update(
    feature: string,
    sessionId: string,
    updates: Partial<SessionInfoV3>
  ): Promise<void> {
    const current = await this.get(feature)

    if (!current || current.id !== sessionId) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const updated: SessionInfoV3 = {
      ...current,
      ...updates,
      lastActivity: new Date().toISOString()
    }

    await this.save(feature, updated)
  }

  async clear(feature: string): Promise<void> {
    const currentPath = path.join(this.getSessionsPath(feature), 'current.json')

    if (await fs.pathExists(currentPath)) {
      await fs.remove(currentPath)
    }
  }

  async isResumable(feature: string): Promise<boolean> {
    const session = await this.get(feature)

    if (!session || !session.resumable) {
      return false
    }

    const lastActivity = new Date(session.lastActivity)
    const hoursSinceActivity =
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)

    return hoursSinceActivity < 24
  }
}

export const sessionStore = new SessionStore()
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/utils/session-store.test.ts` | save() persiste sessão corretamente |
| | save() usa atomic write pattern |
| | get() retorna sessão existente |
| | get() retorna null quando não existe |
| | getLatest() retorna sessão atual |
| | list() retorna histórico ordenado |
| | list() ignora arquivos corrompidos |
| | update() atualiza sessão existente |
| | update() lança erro se sessão não existe |
| | update() atualiza lastActivity |
| | clear() remove sessão atual |
| | isResumable() retorna true se < 24h |
| | isResumable() retorna false se > 24h |
| | isResumable() retorna false se não resumable |

#### Critérios de Aceitação

- [ ] SessionStore salva sessão em `current.json`
- [ ] SessionStore copia para `history/`
- [ ] SessionStore usa atomic write (temp → move)
- [ ] SessionStore valida janela de 24h para resume
- [ ] Cobertura de testes >= 90%
- [ ] Performance < 50ms para operações individuais

---

### Fase 1.3: Claude V3 - Spawn Assíncrono

| Campo | Valor |
|-------|-------|
| **Objetivo** | Criar executor Claude com spawn assíncrono |
| **Story Points** | 4 |
| **Dependências** | Fase 1.2 |

#### Arquivo: `src/utils/claude-v3.ts`

```typescript
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ClaudeV3Options, ClaudeV3Result } from '../types/session-v3.js'
import { logger } from './logger.js'

const SESSION_ID_PATTERN = /Session ID: ([a-f0-9-]+)/i

export function parseSessionId(output: string): string | null {
  const match = output.match(SESSION_ID_PATTERN)
  return match ? match[1] : null
}

export async function executeClaudeCommandV3(
  prompt: string,
  options: ClaudeV3Options = {}
): Promise<ClaudeV3Result> {
  const startTime = Date.now()
  const tempFile = path.join(os.tmpdir(), `adk3-prompt-${Date.now()}.txt`)

  try {
    fs.writeFileSync(tempFile, prompt)

    const args = ['--dangerously-skip-permissions']

    if (options.printSessionId !== false) {
      args.push('--print-session-id')
    }

    if (options.model) {
      args.push('--model', options.model)
    }

    if (options.resume) {
      args.push('--resume', options.resume)
    }

    logger.debug(`Executing: claude ${args.join(' ')}`)

    return new Promise((resolve, reject) => {
      const claude = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      const input = fs.readFileSync(tempFile, 'utf-8')
      claude.stdin.write(input)
      claude.stdin.end()

      claude.stdout.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk

        if (options.onOutput) {
          options.onOutput(chunk)
        }

        process.stdout.write(chunk)
      })

      claude.stderr.on('data', (data) => {
        const chunk = data.toString()
        stderr += chunk
        process.stderr.write(chunk)
      })

      const timeout = options.timeout || 300000
      const timer = setTimeout(() => {
        claude.kill('SIGTERM')
        reject(new Error(`Claude command timed out after ${timeout}ms`))
      }, timeout)

      claude.on('close', (code) => {
        clearTimeout(timer)

        const duration = Date.now() - startTime
        const sessionId = parseSessionId(stdout) || parseSessionId(stderr)

        resolve({
          output: stdout,
          sessionId,
          exitCode: code || 0,
          duration
        })
      })

      claude.on('error', (error) => {
        clearTimeout(timer)
        reject(new Error(`Failed to start Claude: ${error.message}`))
      })
    })
  } finally {
    try {
      fs.unlinkSync(tempFile)
    } catch {}
  }
}

export function isClaudeInstalledV3(): boolean {
  try {
    const result = spawnSync('which', ['claude'], { stdio: 'pipe' })
    return result.status === 0
  } catch {
    return false
  }
}
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/utils/claude-v3.test.ts` | parseSessionId() extrai ID corretamente |
| | parseSessionId() retorna null se não encontrado |
| | executeClaudeCommandV3() usa spawn assíncrono |
| | executeClaudeCommandV3() captura stdout |
| | executeClaudeCommandV3() captura stderr |
| | executeClaudeCommandV3() passa --print-session-id |
| | executeClaudeCommandV3() passa --model quando fornecido |
| | executeClaudeCommandV3() passa --resume quando fornecido |
| | executeClaudeCommandV3() respeita timeout |
| | executeClaudeCommandV3() retorna exitCode |
| | executeClaudeCommandV3() retorna duration |
| | executeClaudeCommandV3() chama onOutput callback |
| | isClaudeInstalledV3() detecta Claude CLI |

#### Critérios de Aceitação

- [ ] Usa `spawn` (não `spawnSync` para execução principal)
- [ ] Captura output completo
- [ ] Extrai session ID do output
- [ ] Suporta --resume flag
- [ ] Suporta timeout configurável
- [ ] Suporta callback para streaming
- [ ] Cobertura de testes >= 85%

---

### Fase 1.4: Integração SessionStore + Claude V3

| Campo | Valor |
|-------|-------|
| **Objetivo** | Integrar SessionStore com executeClaudeCommandV3 |
| **Story Points** | 3 |
| **Dependências** | Fase 1.3 |

#### Adicionar em: `src/utils/claude-v3.ts`

```typescript
import { sessionStore } from './session-store.js'
import type { SessionInfoV3 } from '../types/session-v3.js'

export async function executeWithSessionTracking(
  feature: string,
  prompt: string,
  options: ClaudeV3Options = {}
): Promise<ClaudeV3Result> {
  const existingSession = await sessionStore.get(feature)
  const isResumable = await sessionStore.isResumable(feature)

  let sessionId = existingSession?.claudeSessionId || null

  if (isResumable && sessionId && !options.resume) {
    options.resume = sessionId
    logger.info(`Resuming session ${sessionId}`)
  }

  const result = await executeClaudeCommandV3(prompt, options)

  const sessionInfo: SessionInfoV3 = {
    id: `session-${Date.now()}`,
    claudeSessionId: result.sessionId,
    feature,
    startedAt: existingSession?.startedAt || new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    status: result.exitCode === 0 ? 'active' : 'interrupted',
    resumable: result.sessionId !== null,
    metadata: {
      model: options.model,
      exitCode: result.exitCode,
      duration: result.duration
    }
  }

  await sessionStore.save(feature, sessionInfo)

  return result
}
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/utils/claude-v3-integration.test.ts` | executeWithSessionTracking() salva sessão |
| | Retoma sessão automaticamente se resumable |
| | Não retoma se não resumable |
| | Atualiza lastActivity após execução |
| | Marca como interrupted se exitCode != 0 |
| | Preserva startedAt em sessões contínuas |

#### Critérios de Aceitação

- [ ] Sessão salva automaticamente após execução
- [ ] Resume automático quando aplicável
- [ ] Session ID do Claude armazenado
- [ ] Metadata inclui model, exitCode, duration

---

### Fase 1.5: Comando Feature Status com Sessions

| Campo | Valor |
|-------|-------|
| **Objetivo** | Implementar `adk3 feature status` com info de sessões |
| **Story Points** | 2 |
| **Dependências** | Fase 1.4 |

#### Atualizar: `src/commands/feature-v3.ts`

```typescript
import chalk from 'chalk'
import ora from 'ora'
import path from 'node:path'
import fs from 'fs-extra'
import { sessionStore } from '../utils/session-store.js'
import { logger } from '../utils/logger.js'

class FeatureV3Command {
  async status(name: string): Promise<void> {
    const spinner = ora(`Loading status for ${name}...`).start()

    try {
      const featurePath = path.join(
        process.cwd(),
        '.claude', 'plans', 'features', name
      )

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" not found`)
        process.exit(1)
      }

      spinner.succeed(`Feature: ${chalk.cyan(name)}`)

      const currentSession = await sessionStore.get(name)
      const sessions = await sessionStore.list(name)
      const isResumable = await sessionStore.isResumable(name)

      console.log()
      console.log(chalk.bold('Session Info:'))

      if (currentSession) {
        console.log(`  Current: ${chalk.green(currentSession.id)}`)
        console.log(`  Claude ID: ${currentSession.claudeSessionId || chalk.gray('N/A')}`)
        console.log(`  Status: ${this.formatStatus(currentSession.status)}`)
        console.log(`  Resumable: ${isResumable ? chalk.green('Yes') : chalk.red('No')}`)
        console.log(`  Last Activity: ${this.formatDate(currentSession.lastActivity)}`)

        if (currentSession.metadata?.model) {
          console.log(`  Model: ${currentSession.metadata.model}`)
        }
      } else {
        console.log(chalk.gray('  No active session'))
      }

      console.log()
      console.log(chalk.bold('Session History:'))

      if (sessions.length === 0) {
        console.log(chalk.gray('  No sessions recorded'))
      } else {
        const recent = sessions.slice(0, 5)
        for (const session of recent) {
          const status = this.formatStatus(session.status)
          const date = this.formatDate(session.startedAt)
          console.log(`  ${session.id} | ${status} | ${date}`)
        }

        if (sessions.length > 5) {
          console.log(chalk.gray(`  ... and ${sessions.length - 5} more`))
        }
      }
    } catch (error) {
      spinner.fail('Error loading status')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'active': return chalk.green('active')
      case 'completed': return chalk.blue('completed')
      case 'interrupted': return chalk.yellow('interrupted')
      default: return chalk.gray(status)
    }
  }

  private formatDate(isoDate: string): string {
    const date = new Date(isoDate)
    return date.toLocaleString()
  }
}

export const featureV3Command = new FeatureV3Command()
```

#### Testes Necessários

| Arquivo | Casos de Teste |
|---------|----------------|
| `tests/commands/feature-v3.test.ts` | status() exibe info de sessão atual |
| | status() exibe histórico de sessões |
| | status() indica se é resumable |
| | status() funciona sem sessões |
| | status() falha graciosamente se feature não existe |

#### Critérios de Aceitação

- [ ] Exibe sessão atual com Claude session ID
- [ ] Exibe status (active/completed/interrupted)
- [ ] Indica se sessão é resumable
- [ ] Lista histórico de sessões (últimas 5)
- [ ] Funciona mesmo sem sessões prévias

---

### Checkpoint Sprint 1

**Validação Completa:**

```bash
npm run build
npm test -- tests/utils/session-store.test.ts
npm test -- tests/utils/claude-v3.test.ts
npm test -- tests/commands/feature-v3.test.ts
npm run test:coverage -- --collectCoverageFrom='src/utils/session-store.ts'
npm run test:coverage -- --collectCoverageFrom='src/utils/claude-v3.ts'
npm run adk3 -- feature status my-feature
git diff src/cli.ts
git diff src/commands/feature.ts
git diff src/utils/claude.ts
```

---

## Ordem de Implementação

```
Sprint 0: Setup (5 SP)
├── 0.1 Estrutura de Arquivos Base (2 SP)
├── 0.2 Scripts npm e Build (1 SP)
└── 0.3 Validação de Isolamento (2 SP)

Sprint 1: Session Store (16 SP)
├── 1.1 Tipos e Interfaces (2 SP)
├── 1.2 SessionStore Implementation (5 SP)
├── 1.3 Claude V3 - Spawn Assíncrono (4 SP)
├── 1.4 Integração SessionStore + Claude V3 (3 SP)
└── 1.5 Comando Feature Status com Sessions (2 SP)
```

---

## Pontos de Verificação

### Gate 1: Após Sprint 0

| Verificação | Comando | Resultado Esperado |
|-------------|---------|-------------------|
| Build compila | `npm run build` | Exit 0, cli-v3.js existe |
| v3 version | `npm run adk3 -- --version` | `3.0.0-alpha` |
| v3 help | `npm run adk3 -- --help` | Mostra comandos |
| v2 intacto | `git diff src/cli.ts` | Vazio |
| Testes | `npm test -- tests/cli-v3.test.ts` | Pass |

### Gate 2: Após Fase 1.2

| Verificação | Resultado Esperado |
|-------------|-------------------|
| SessionStore.save() persiste | JSON em `sessions/current.json` |
| SessionStore.get() recupera | Retorna sessão salva |
| SessionStore.list() lista | Array ordenado por data |
| Atomic writes | Usa temp file pattern |
| Cobertura | >= 90% |

### Gate 3: Após Fase 1.3

| Verificação | Resultado Esperado |
|-------------|-------------------|
| spawn assíncrono | Não usa spawnSync para main exec |
| Captura stdout | Output completo disponível |
| Session ID extraído | parseSessionId funciona |
| Timeout funciona | Mata processo após timeout |
| Cobertura | >= 85% |

### Gate 4: Final Sprint 1

| Verificação | Resultado Esperado |
|-------------|-------------------|
| Integração completa | executeWithSessionTracking salva sessão |
| feature status | Exibe info de sessões |
| Todos os testes | Pass |
| Cobertura total | >= 80% |
| v2 intacto | Nenhum arquivo modificado |

---

## Estratégia de Testes

### Estrutura de Testes

```
tests/
├── cli-v3.test.ts                    # Testes CLI v3
├── v3-isolation.test.ts              # Testes de isolamento
├── types/
│   └── session-v3.test.ts            # Testes de tipos
├── utils/
│   ├── session-store.test.ts         # Testes SessionStore
│   ├── claude-v3.test.ts             # Testes Claude V3
│   └── claude-v3-integration.test.ts # Testes integração
└── commands/
    └── feature-v3.test.ts            # Testes comandos
```

### Padrão de Teste (SessionStore)

```typescript
describe('SessionStore', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('save', () => {
    it('should persist session to current.json', async () => {
      const store = new SessionStore()
      const session: SessionInfoV3 = {
        id: 'session-1',
        claudeSessionId: 'claude-123',
        feature: 'test-feature',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: true
      }

      await store.save('test-feature', session)

      const saved = await store.get('test-feature')
      expect(saved).toEqual(session)
    })
  })
})
```

### Mocking do Claude CLI

```typescript
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn()
}))

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

beforeEach(() => {
  const mockProcess = {
    stdin: { write: jest.fn(), end: jest.fn() },
    stdout: new Readable({ read() {} }),
    stderr: new Readable({ read() {} }),
    on: jest.fn(),
    kill: jest.fn()
  }

  mockSpawn.mockReturnValue(mockProcess as any)
})
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Modificação acidental de v2 | Média | Alto | Gate checks, CI validation |
| Claude CLI não suporta --print-session-id | Baixa | Alto | Verificar manualmente antes de implementar |
| Session ID não persistente | Baixa | Médio | Testes de integração reais |
| Performance degradada | Baixa | Baixo | Benchmark < 50ms |
| npm link acidental | Média | Alto | Documentação, nunca usar npm link |

---

## Arquivos Finais

### Criados

| Arquivo | Sprint | Fase |
|---------|--------|------|
| `src/cli-v3.ts` | 0 | 0.1 |
| `src/commands/feature-v3.ts` | 0 | 0.1 |
| `src/utils/prompts/.gitkeep` | 0 | 0.1 |
| `src/types/session-v3.ts` | 1 | 1.1 |
| `src/utils/session-store.ts` | 1 | 1.2 |
| `src/utils/claude-v3.ts` | 1 | 1.3 |
| `tests/cli-v3.test.ts` | 0 | 0.1 |
| `tests/v3-isolation.test.ts` | 0 | 0.3 |
| `tests/types/session-v3.test.ts` | 1 | 1.1 |
| `tests/utils/session-store.test.ts` | 1 | 1.2 |
| `tests/utils/claude-v3.test.ts` | 1 | 1.3 |
| `tests/utils/claude-v3-integration.test.ts` | 1 | 1.4 |
| `tests/commands/feature-v3.test.ts` | 1 | 1.5 |

### Modificados

| Arquivo | Sprint | Fase | Modificação |
|---------|--------|------|-------------|
| `package.json` | 0 | 0.2 | Adicionar scripts adk3 |

### NÃO MODIFICAR

| Arquivo | Motivo |
|---------|--------|
| `src/cli.ts` | CLI v2 congelado |
| `src/commands/feature.ts` | Comandos v2 congelados |
| `src/utils/claude.ts` | Claude v2 congelado |
| `src/utils/state-manager.ts` | StateManager v2 congelado |

---

## Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Cobertura de testes SessionStore | >= 90% |
| Cobertura de testes Claude V3 | >= 85% |
| Cobertura total novos arquivos | >= 80% |
| Performance SessionStore ops | < 50ms |
| Session ID capturado | 100% execuções (quando disponível) |
| Arquivos v2 modificados | 0 |

---

*Plano gerado em 2026-01-25*
*Baseado em: research.md, prd.md, análise do código existente*
