# Implementation Plan: project-management

**Data:** 2026-01-16
**Status:** Ready for Implementation
**Baseado em:** research.md, prd.md

---

## Executive Summary

Este plano detalha a implementação de integração com plataformas de gestão de projetos, começando pelo ClickUp. A implementação segue arquitetura de providers para extensibilidade futura, com foco em operação offline-first e sincronização transparente.

---

## Phase 1: Foundation (Core Infrastructure)

### Objetivo
Criar a infraestrutura base para o sistema de providers e configuração de integração.

### Story Points: 8

### Arquivos a Criar

| Arquivo | Descrição | LOC Est. |
|---------|-----------|----------|
| `src/providers/types.ts` | Interfaces base para todos providers | ~80 |
| `src/providers/index.ts` | Factory e registry de providers | ~60 |
| `src/providers/local.ts` | Provider local (wrapper do comportamento atual) | ~100 |
| `src/utils/integration-config.ts` | Gerenciamento de configuração de integração | ~120 |
| `src/types/provider.ts` | Tipos TypeScript para providers | ~50 |

### Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/utils/paths.ts` | Adicionar `getConfigPath()`, `getCredentialsPath()` | Baixo |
| `package.json` | Nenhuma dependência nova (usa fetch nativo Node.js 18+) | Nenhum |

### Detalhamento Técnico

#### 1.1 Interface ProjectProvider (`src/providers/types.ts`)

```typescript
interface ProjectProvider {
  name: string
  isConfigured(): Promise<boolean>
  testConnection(): Promise<boolean>

  createFeature(feature: FeatureData): Promise<RemoteFeature>
  updateFeature(id: string, data: Partial<FeatureData>): Promise<RemoteFeature>
  getFeature(id: string): Promise<RemoteFeature | null>
  deleteFeature(id: string): Promise<void>

  syncFeature(feature: LocalFeature): Promise<SyncResult>
  getRemoteChanges(since: Date): Promise<RemoteChange[]>
}

interface SyncResult {
  status: 'synced' | 'conflict' | 'error'
  remoteId: string
  remoteUrl: string
  lastSynced: string
  conflicts?: SyncConflict[]
}
```

#### 1.2 LocalProvider (`src/providers/local.ts`)

Wrapper que implementa `ProjectProvider` usando apenas arquivos locais. Serve como fallback quando nenhuma integração está configurada e como base para testes.

#### 1.3 Integration Config (`src/utils/integration-config.ts`)

```typescript
interface IntegrationConfig {
  provider: string | null
  enabled: boolean
  autoSync: boolean
  syncOnPhaseChange: boolean
}

async function loadConfig(): Promise<IntegrationConfig>
async function saveConfig(config: IntegrationConfig): Promise<void>
async function getProviderConfig<T>(provider: string): Promise<T | null>
async function setProviderConfig<T>(provider: string, config: T): Promise<void>
```

### Testes Necessários

| Arquivo de Teste | Cobertura |
|------------------|-----------|
| `tests/providers/local.test.ts` | CRUD completo, sync behavior |
| `tests/utils/integration-config.test.ts` | Load, save, validation |

### Critérios de Aceitação

- [ ] Interface `ProjectProvider` definida e documentada
- [ ] `LocalProvider` implementado e funcionando como wrapper
- [ ] Sistema de configuração lendo/escrevendo `.adk/config.json`
- [ ] Credenciais lidas de `.env` ou variáveis de ambiente
- [ ] Testes unitários com >= 80% coverage
- [ ] Provider registry funcionando com factory pattern

### Dependências
- Nenhuma (fase inicial)

---

## Phase 2: ClickUp Provider (Basic)

### Objetivo
Implementar provider do ClickUp com autenticação e operações CRUD básicas.

### Story Points: 13

### Arquivos a Criar

| Arquivo | Descrição | LOC Est. |
|---------|-----------|----------|
| `src/providers/clickup/index.ts` | Implementação do ClickUpProvider | ~200 |
| `src/providers/clickup/client.ts` | HTTP client para API v2 | ~150 |
| `src/providers/clickup/types.ts` | Tipos da API ClickUp | ~100 |
| `src/providers/clickup/mapper.ts` | Mapeamento ADK ↔ ClickUp | ~120 |
| `src/commands/config.ts` | Comando `adk config` | ~180 |

### Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/cli.ts` | Registrar comando `config` | Baixo |
| `src/providers/index.ts` | Registrar ClickUp provider | Baixo |

### Detalhamento Técnico

#### 2.1 ClickUp HTTP Client (`src/providers/clickup/client.ts`)

```typescript
class ClickUpClient {
  private baseUrl = 'https://api.clickup.com/api/v2'
  private token: string

  constructor(token: string)

  async getTeams(): Promise<Team[]>
  async getSpaces(teamId: string): Promise<Space[]>
  async getLists(spaceId: string): Promise<List[]>

  async createTask(listId: string, task: CreateTaskPayload): Promise<Task>
  async updateTask(taskId: string, updates: UpdateTaskPayload): Promise<Task>
  async getTask(taskId: string): Promise<Task>
  async deleteTask(taskId: string): Promise<void>

  async setCustomField(taskId: string, fieldId: string, value: unknown): Promise<void>
}
```

Headers obrigatórios:
- `Authorization: {token}`
- `Content-Type: application/json`

#### 2.2 Mapper (`src/providers/clickup/mapper.ts`)

| ADK | ClickUp |
|-----|---------|
| `feature.name` | `task.name` |
| `feature.description` (PRD resumo) | `task.description` |
| `feature.phase` | `task.status` ou custom field |
| `feature.priority` | `task.priority` |
| `feature.progress` | Custom field (number) |

#### 2.3 Config Command (`src/commands/config.ts`)

```bash
adk config integration clickup
```

Fluxo interativo:
1. Solicitar API Token (pk_*)
2. Listar workspaces disponíveis
3. Selecionar workspace
4. Listar spaces
5. Selecionar space
6. Selecionar list padrão
7. Configurar autoSync (sim/não)
8. Salvar configuração

### Testes Necessários

| Arquivo de Teste | Cobertura |
|------------------|-----------|
| `tests/providers/clickup/client.test.ts` | Todos endpoints, error handling, rate limit |
| `tests/providers/clickup/mapper.test.ts` | Mapeamento bidirecional |
| `tests/commands/config.test.ts` | Fluxo de configuração |

### Critérios de Aceitação

- [ ] Autenticação via Personal Token funcionando
- [ ] CRUD de tasks no ClickUp funcionando
- [ ] Comando `adk config integration clickup` disponível
- [ ] Token validado antes de salvar
- [ ] Configuração salva em `.adk/config.json`
- [ ] Token salvo em `.env` (não versionado)
- [ ] Mapeamento feature → task funcionando
- [ ] Rate limiting respeitado (100 req/min)
- [ ] Testes unitários com mocks da API

### Dependências
- Phase 1 completa

---

## Phase 3: Sync System

### Objetivo
Implementar lógica de sincronização bidirecional integrada ao ciclo de features.

### Story Points: 13

### Arquivos a Criar

| Arquivo | Descrição | LOC Est. |
|---------|-----------|----------|
| `src/utils/sync.ts` | Lógica de sincronização | ~200 |
| `src/commands/sync.ts` | Comando `adk sync` | ~100 |

### Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/commands/feature.ts` | Integrar sync em create/research/plan/implement | Médio |
| `src/utils/progress.ts` | Adicionar `remoteId`, `lastSynced` em `FeatureProgress` | Médio |
| `src/types/memory.ts` | Adicionar `SyncMetadata` | Baixo |
| `src/cli.ts` | Registrar comando `sync`, flags `--no-sync` | Baixo |

### Detalhamento Técnico

#### 3.1 Sync Utils (`src/utils/sync.ts`)

```typescript
interface SyncOptions {
  feature: string
  force?: boolean
  direction?: 'push' | 'pull' | 'both'
}

async function syncFeature(options: SyncOptions): Promise<SyncResult>
async function getPendingChanges(feature: string): Promise<PendingChange[]>
async function hasPendingSync(feature: string): Promise<boolean>
```

#### 3.2 Integração com Feature Command

```typescript
// Em cada método que muda estado (create, research, plan, implement, qa, docs)
if (await isIntegrationEnabled() && !options.noSync) {
  const spinner = ora('Sincronizando com ClickUp...').start()
  try {
    const result = await syncFeature({ feature: name })
    spinner.succeed(`Sincronizado: ${result.remoteUrl}`)
  } catch (error) {
    spinner.warn('Sync falhou (operação local completada)')
    logger.debug(error)
  }
}
```

#### 3.3 Metadata de Sync (`sync.md`)

Criar arquivo `.claude/plans/features/<name>/sync.md`:

```markdown
# Sync Metadata

- **Provider**: clickup
- **Remote ID**: abc123
- **Remote URL**: https://app.clickup.com/t/abc123
- **Last Synced**: 2026-01-16T10:30:00Z
- **Status**: synced
- **Pending Changes**: []
```

### Testes Necessários

| Arquivo de Teste | Cobertura |
|------------------|-----------|
| `tests/utils/sync.test.ts` | Sync flow, conflict detection, error handling |
| `tests/commands/sync.test.ts` | Comando CLI |
| `tests/commands/feature-sync.test.ts` | Integração feature + sync |

### Critérios de Aceitação

- [ ] `adk feature new` sincroniza automaticamente quando configurado
- [ ] Mudanças de fase atualizam status no ClickUp
- [ ] Flag `--no-sync` disponível em todos comandos de feature
- [ ] Comando `adk sync` para sincronização manual
- [ ] Comando `adk sync <feature>` para sync específico
- [ ] Metadata de sync persistida em `sync.md`
- [ ] URL do ClickUp exibida após sync
- [ ] Falha de sync não bloqueia operação local

### Dependências
- Phase 2 completa

---

## Phase 4: Offline Queue & Robustness

### Objetivo
Garantir funcionamento offline e robustez em cenários de falha.

### Story Points: 8

### Arquivos a Criar

| Arquivo | Descrição | LOC Est. |
|---------|-----------|----------|
| `src/utils/sync-queue.ts` | Queue para operações offline | ~150 |

### Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/utils/sync.ts` | Integrar queue, retry logic | Médio |
| `src/providers/clickup/client.ts` | Exponential backoff, rate limit handling | Médio |

### Detalhamento Técnico

#### 4.1 Sync Queue (`src/utils/sync-queue.ts`)

```typescript
interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  feature: string
  data: unknown
  createdAt: string
  retries: number
  lastError?: string
}

async function enqueue(operation: QueuedOperation): Promise<void>
async function dequeue(): Promise<QueuedOperation | null>
async function processQueue(): Promise<QueueResult[]>
async function getPendingCount(): Promise<number>
async function clearQueue(): Promise<void>
```

Persistência: `.adk/sync-queue.json`

#### 4.2 Retry com Exponential Backoff

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error

      const delay = baseDelay * Math.pow(2, attempt)
      await sleep(delay)
    }
  }
}
```

#### 4.3 Rate Limit Handling

```typescript
class RateLimiter {
  private remaining = 100
  private resetAt: Date | null = null

  async checkLimit(): Promise<void>
  updateFromHeaders(headers: Headers): void
}
```

### Testes Necessários

| Arquivo de Teste | Cobertura |
|------------------|-----------|
| `tests/utils/sync-queue.test.ts` | Enqueue, dequeue, persistence |
| `tests/utils/retry.test.ts` | Exponential backoff, max retries |

### Critérios de Aceitação

- [ ] Operações funcionam sem internet
- [ ] Mudanças pendentes salvas em queue local
- [ ] `adk sync` processa queue automaticamente
- [ ] Retry automático com exponential backoff
- [ ] Rate limit respeitado (header X-RateLimit-Remaining)
- [ ] Mensagens de erro claras e acionáveis
- [ ] Log de operações para debugging

### Dependências
- Phase 3 completa

---

## Phase 5: Conflict Resolution

### Objetivo
Detectar e resolver conflitos de sincronização bidirecional.

### Story Points: 8

### Arquivos a Criar

| Arquivo | Descrição | LOC Est. |
|---------|-----------|----------|
| `src/utils/conflict-resolution.ts` | Detecção e resolução de conflitos | ~180 |

### Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/utils/sync.ts` | Integrar conflict detection | Médio |
| `src/utils/integration-config.ts` | Adicionar `conflictStrategy` | Baixo |

### Detalhamento Técnico

#### 5.1 Conflict Detection

```typescript
interface Conflict {
  field: string
  localValue: unknown
  remoteValue: unknown
  localTimestamp: string
  remoteTimestamp: string
}

type ConflictStrategy = 'local-wins' | 'remote-wins' | 'manual' | 'newest-wins'

async function detectConflicts(
  local: LocalFeature,
  remote: RemoteFeature
): Promise<Conflict[]>

async function resolveConflicts(
  conflicts: Conflict[],
  strategy: ConflictStrategy
): Promise<ResolvedData>
```

#### 5.2 Estratégias de Resolução

| Estratégia | Comportamento |
|------------|---------------|
| `local-wins` | Sempre usa valor local |
| `remote-wins` | Sempre usa valor remoto |
| `newest-wins` | Usa timestamp mais recente |
| `manual` | Prompt interativo para usuário |

#### 5.3 Prompt Interativo para Manual

```typescript
const { resolution } = await inquirer.prompt([{
  type: 'list',
  name: 'resolution',
  message: `Conflito em ${conflict.field}:`,
  choices: [
    { name: `Local: ${conflict.localValue}`, value: 'local' },
    { name: `Remoto: ${conflict.remoteValue}`, value: 'remote' },
  ]
}])
```

### Testes Necessários

| Arquivo de Teste | Cobertura |
|------------------|-----------|
| `tests/utils/conflict-resolution.test.ts` | Todas estratégias, edge cases |

### Critérios de Aceitação

- [ ] Conflitos detectados antes de sync
- [ ] Estratégia configurável em `.adk/config.json`
- [ ] Prompt interativo para estratégia `manual`
- [ ] Log de conflitos resolvidos
- [ ] Backup antes de sobrescrever dados

### Dependências
- Phase 4 completa

---

## Phase 6: Advanced Features & Polish

### Objetivo
Recursos adicionais de valor e polimento da experiência.

### Story Points: 8

### Arquivos a Criar

| Arquivo | Descrição | LOC Est. |
|---------|-----------|----------|
| `src/commands/import.ts` | Comando `adk import` | ~150 |

### Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/cli.ts` | Registrar `import`, flags `--remote` | Baixo |
| `src/commands/feature.ts` | Adicionar `status --remote` | Baixo |

### Detalhamento Técnico

#### 6.1 Import Command

```bash
adk import clickup <list-id>
```

Fluxo:
1. Listar tasks da list
2. Para cada task:
   - Criar estrutura de feature
   - Mapear descrição para PRD inicial
   - Mapear subtasks para tasks.md
   - Salvar metadata de sync

#### 6.2 Remote Status

```bash
adk feature status <name> --remote
```

Output:
```
Feature: my-feature
Local:  Phase plan, 60% complete
Remote: In Progress (ClickUp)
Sync:   ✓ Synced (last: 2h ago)
URL:    https://app.clickup.com/t/abc123
```

### Testes Necessários

| Arquivo de Teste | Cobertura |
|------------------|-----------|
| `tests/commands/import.test.ts` | Import flow |

### Critérios de Aceitação

- [ ] `adk import clickup <list-id>` funcionando
- [ ] Confirmação antes de sobrescrever features existentes
- [ ] `adk feature status --remote` mostra status do ClickUp
- [ ] Exibe divergências local/remoto
- [ ] Link direto para item no ClickUp

### Dependências
- Phase 5 completa

---

## Verification Checkpoints

### Checkpoint 1: After Phase 2
- [ ] `adk config integration clickup` funciona end-to-end
- [ ] Task criada manualmente no ClickUp é visível
- [ ] Sem breaking changes em comandos existentes

### Checkpoint 2: After Phase 3
- [ ] `adk feature new test-feature` cria task no ClickUp
- [ ] Mudança de fase atualiza status remoto
- [ ] `--no-sync` impede sincronização

### Checkpoint 3: After Phase 5
- [ ] Trabalho offline é possível
- [ ] Queue processada ao reconectar
- [ ] Conflitos resolvidos corretamente

### Checkpoint Final
- [ ] Todos testes passando
- [ ] Coverage >= 80%
- [ ] Documentação completa
- [ ] Zero regressions em features existentes

---

## Test Strategy

### Unit Tests
- Cada módulo novo tem arquivo de teste correspondente
- Mocks para API do ClickUp
- Coverage mínimo: 80%

### Integration Tests
- Testar fluxo completo de configuração
- Testar sync em cenários reais (com API key de teste)
- Testar comportamento offline

### E2E Tests (Manual)
- Criar feature com sync
- Verificar no ClickUp
- Fazer mudança no ClickUp
- Sincronizar de volta

### Test Data
- Fixtures para respostas da API ClickUp
- Features de exemplo para testes de sync
- Configurações de teste em `.adk/test-config.json`

---

## Risk Mitigation Checklist

| Risco | Mitigação | Status |
|-------|-----------|--------|
| Rate limiting | Implementar cache + backoff | Fase 4 |
| Token exposure | .env + .gitignore validation | Fase 1 |
| Conflitos de sync | Estratégias configuráveis | Fase 5 |
| API changes | Versionar client, testes de integração | Contínuo |
| Performance | Sync assíncrono, cache | Fase 3-4 |

---

## Definition of Done

Uma fase está completa quando:

1. [ ] Todos arquivos criados/modificados conforme plano
2. [ ] Testes escritos ANTES da implementação (TDD)
3. [ ] Coverage >= 80% para novos arquivos
4. [ ] Código passa em `npm run check`
5. [ ] Sem breaking changes em features existentes
6. [ ] Documentação inline atualizada
7. [ ] Checkpoint da fase verificado

---

## Summary Table

| Fase | Objetivo | Story Points | Dependência |
|------|----------|--------------|-------------|
| 1 | Foundation | 8 | - |
| 2 | ClickUp Basic | 13 | Fase 1 |
| 3 | Sync System | 13 | Fase 2 |
| 4 | Offline Queue | 8 | Fase 3 |
| 5 | Conflict Resolution | 8 | Fase 4 |
| 6 | Polish | 8 | Fase 5 |
| **Total** | | **58** | |

---

## Next Steps

1. Iniciar Phase 1: Foundation
2. Criar estrutura de diretórios `src/providers/`
3. Implementar testes primeiro (TDD)
4. Seguir ordem de implementação definida

---

> **IMPORTANTE**: Este documento é o plano de implementação. NÃO IMPLEMENTE até aprovação.
