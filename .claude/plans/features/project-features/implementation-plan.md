# Implementation Plan: project-features

**Data:** 2026-01-19
**Status:** Ready for Implementation
**Baseado em:** research.md + prd.md

---

## Overview

Este plano detalha a implementacao das melhorias do ADK para alinhamento com melhores praticas de 2026. O trabalho esta dividido em **8 fases** ordenadas por risco crescente, totalizando **132 story points**.

**Estrategia:** Implementar de menor para maior risco, garantindo que cada fase tenha testes e validacao antes de avancar.

---

## Fase 1: Consolidacao - Memory Status

**Objetivo:** Implementar comando `memory status` para visibilidade do estado de memorias.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/commands/memory.ts` | Modificar | Adicionar metodo `status()` |
| `src/cli.ts` | Modificar | Registrar subcommand `memory status` |
| `src/utils/memory-utils.ts` | Modificar | Adicionar `getMemoryStats()` |
| `tests/commands/memory.test.ts` | Criar | Testes para status |

### Tasks

1. Criar interface `MemoryStats` em `memory-utils.ts`:
   ```typescript
   interface MemoryStats {
     path: string
     lineCount: number
     lastUpdated: string
     nearLimit: boolean
     level: 'project' | 'feature' | 'phase' | 'session'
   }
   ```

2. Implementar `getMemoryStats(basePath: string): Promise<MemoryStats[]>`:
   - Escanear `.claude/memory/` para project-level
   - Escanear `.claude/plans/features/*/` para feature-level
   - Calcular `nearLimit` quando lineCount > 800

3. Implementar `status()` em `MemoryCommand`:
   - Chamar `getMemoryStats()`
   - Exibir tabela formatada com chalk
   - Highlight em amarelo para nearLimit

4. Registrar em `cli.ts`:
   ```typescript
   memory.command('status')
     .description('Mostra status de todas as memorias')
     .action(() => memoryCommand.status())
   ```

### Testes Necessarios

- [ ] `getMemoryStats()` retorna lista vazia quando nao ha memorias
- [ ] `getMemoryStats()` encontra memoria de projeto
- [ ] `getMemoryStats()` encontra memorias de features
- [ ] `nearLimit` true quando lineCount > 800
- [ ] `status()` exibe tabela corretamente (mock console)

### Criterios de Aceitacao

- [ ] `adk memory status` lista todas memorias do projeto
- [ ] Mostra contagem de linhas de cada memoria
- [ ] Indica memorias proximas do limite (amarelo)
- [ ] Mostra ultima atualizacao de cada memoria
- [ ] Spinner + logger pattern seguido

### Dependencias

- Nenhuma (primeiro item)

---

## Fase 2: Consolidacao - Memory Sync Rename

**Objetivo:** Renomear `memory update` para `memory sync` mantendo backward compatibility.

**Story Points:** 3

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/commands/memory.ts` | Modificar | Renomear metodo |
| `src/cli.ts` | Modificar | Registrar alias |
| `tests/commands/memory.test.ts` | Modificar | Atualizar testes |

### Tasks

1. Em `MemoryCommand`:
   - Renomear `update()` para `sync()`
   - Manter signature identica

2. Em `cli.ts`:
   - Mudar comando principal para `sync`:
   ```typescript
   memory.command('sync')
     .alias('update')
     .description('Sincroniza memoria do projeto')
   ```
   - Adicionar deprecation warning no alias

3. Atualizar documentacao inline

### Testes Necessarios

- [ ] `sync()` funciona identico ao antigo `update()`
- [ ] Alias `update` ainda funciona
- [ ] Warning de deprecation aparece com alias

### Criterios de Aceitacao

- [ ] `adk memory sync` funciona
- [ ] `adk memory update` funciona com warning
- [ ] Behavior identico entre sync e update
- [ ] Help text atualizado

### Dependencias

- Nenhuma

---

## Fase 3: Consolidacao - Report Command

**Objetivo:** Implementar comando `report` completo (atualmente TODO).

**Story Points:** 8

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/commands/report.ts` | Criar | Classe ReportCommand completa |
| `src/cli.ts` | Modificar | Remover TODO, usar ReportCommand |
| `src/utils/git-utils.ts` | Criar | Utilitarios git para metricas |
| `tests/commands/report.test.ts` | Criar | Testes do report |

### Tasks

1. Criar `src/utils/git-utils.ts`:
   ```typescript
   getCommitsSince(date: string): Promise<CommitInfo[]>
   getChangedLinesSince(date: string): Promise<{added: number, removed: number}>
   getModifiedFilesSince(date: string): Promise<string[]>
   ```

2. Criar interface `WeeklyReport`:
   ```typescript
   interface WeeklyReport {
     period: { start: string, end: string }
     features: FeatureSummary[]
     metrics: {
       commits: number
       linesAdded: number
       linesRemoved: number
       filesModified: number
     }
     highlights: string[]
   }
   ```

3. Criar `src/commands/report.ts`:
   - `weekly()`: Gera relatorio semanal
   - `feature(name: string)`: Gera relatorio de feature especifica
   - Helper `generateMarkdown(report: WeeklyReport): string`

4. Implementar `weekly()`:
   - Calcular periodo (hoje - 7 dias)
   - Buscar commits via git-utils
   - Buscar features trabalhadas via progress.json
   - Salvar em `.claude/reports/weekly-YYYY-MM-DD.md`

5. Implementar `feature(name: string)`:
   - Ler progress.json da feature
   - Ler memoria da feature
   - Compilar timeline de fases
   - Salvar em `.claude/reports/feature-<name>-YYYY-MM-DD.md`

6. Atualizar `cli.ts`:
   ```typescript
   program.command('report')
     .option('-w, --weekly', 'Relatorio semanal')
     .option('-f, --feature <feature>', 'Relatorio de feature')
     .action((options) => reportCommand.run(options))
   ```

### Testes Necessarios

- [ ] `getCommitsSince()` retorna commits no periodo
- [ ] `weekly()` gera markdown valido
- [ ] `weekly()` salva arquivo correto
- [ ] `feature()` falha graciosamente se feature nao existe
- [ ] `feature()` inclui todas fases completadas
- [ ] `generateMarkdown()` formata corretamente

### Criterios de Aceitacao

- [ ] `adk report --weekly` gera relatorio markdown
- [ ] Relatorio inclui features trabalhadas na semana
- [ ] Inclui metricas de commits, linhas alteradas
- [ ] Salva em `.claude/reports/weekly-YYYY-MM-DD.md`
- [ ] `adk report --feature <name>` gera relatorio especifico

### Dependencias

- Progress tracking (`progress.ts`)
- Git instalado no sistema

---

## Fase 4: Consolidacao - Hooks Config Migration

**Objetivo:** Migrar configuracao de hooks de `.claude/settings.json` para `.adk/config.json`.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/config.ts` | Modificar | Adicionar hooks config |
| `src/commands/init.ts` | Modificar | Criar config unificado |
| `src/utils/migration.ts` | Criar | Script de migracao |
| `tests/utils/config.test.ts` | Modificar | Testes de hooks config |

### Tasks

1. Extender interface `AdkConfig`:
   ```typescript
   interface AdkConfig {
     version: string
     integration: IntegrationConfig
     providers: Record<string, ProviderSpecificConfig>
     hooks: HooksConfig
   }

   interface HooksConfig {
     preToolUse?: HookDefinition[]
     postToolUse?: HookDefinition[]
     userPromptSubmit?: HookDefinition[]
     stop?: HookDefinition[]
   }
   ```

2. Criar `src/utils/migration.ts`:
   - `migrateHooksConfig()`: Le `.claude/settings.json`, extrai hooks, adiciona a `.adk/config.json`
   - Backup de `settings.json` antes de modificar

3. Adicionar comando de migracao:
   ```typescript
   adk config migrate-hooks
   ```

4. Atualizar `init.ts` para criar estrutura unificada

### Testes Necessarios

- [ ] `migrateHooksConfig()` le settings.json corretamente
- [ ] Hooks sao copiados para config.json
- [ ] Backup e criado
- [ ] Migracao idempotente (pode rodar multiplas vezes)
- [ ] Config invalido nao quebra migracao

### Criterios de Aceitacao

- [ ] `adk config migrate-hooks` migra configuracao
- [ ] Hooks funcionam da nova localizacao
- [ ] Backup automatico antes de migrar
- [ ] Documentacao atualizada

### Dependencias

- Config system existente

---

## Fase 5: Context Engineering - Tiered Memory

**Objetivo:** Implementar hierarquia de 4 niveis de memoria: Project > Feature > Phase > Session.

**Story Points:** 13

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/types/context.ts` | Criar | Tipos para tiered context |
| `src/utils/memory-utils.ts` | Modificar | Adicionar tiered memory |
| `src/utils/memory-search.ts` | Modificar | Search em todos niveis |
| `tests/utils/memory-utils.test.ts` | Modificar | Testes de tiers |

### Tasks

1. Criar `src/types/context.ts`:
   ```typescript
   type MemoryTier = 'project' | 'feature' | 'phase' | 'session'

   interface TieredMemory {
     tier: MemoryTier
     content: MemoryContent
     metadata: {
       createdAt: string
       updatedAt: string
       lineCount: number
       freshnessScore: number
       relevanceScore: number
       usageCount: number
     }
   }

   interface MemoryHierarchy {
     project: TieredMemory
     feature?: TieredMemory
     phase?: TieredMemory
     session: SessionMemory
   }
   ```

2. Implementar `loadMemoryHierarchy(feature?: string, phase?: string)`:
   - Carregar project memory de `.claude/memory/project-context.md`
   - Carregar feature memory de `.claude/plans/features/<feature>/memory.md`
   - Carregar phase memory de `.claude/plans/features/<feature>/<phase>/memory.md`
   - Session memory mantido apenas em memoria

3. Implementar `flattenHierarchy(hierarchy: MemoryHierarchy)`:
   - Combina todos niveis em um unico contexto
   - Project tem menor prioridade, Session tem maior
   - Deduplicacao de entradas duplicadas

4. Adicionar metricas:
   - `freshnessScore`: Baseado em `updatedAt` (decai com tempo)
   - `relevanceScore`: Baseado em busca fuzzy com task atual
   - `usageCount`: Incrementado a cada acesso

5. Implementar session memory em cache:
   ```typescript
   class SessionMemoryCache {
     private cache: Map<string, TieredMemory>
     add(key: string, content: MemoryContent): void
     get(key: string): TieredMemory | undefined
     flush(toPath?: string): Promise<void>
   }
   ```

### Testes Necessarios

- [ ] `loadMemoryHierarchy()` carrega todos niveis disponiveis
- [ ] `loadMemoryHierarchy()` funciona com niveis faltando
- [ ] `flattenHierarchy()` prioriza corretamente
- [ ] `freshnessScore` decai com tempo
- [ ] `SessionMemoryCache` armazena e recupera
- [ ] `flush()` persiste session memory

### Criterios de Aceitacao

- [ ] 4 niveis de memoria funcionando
- [ ] Project memory sempre carregado
- [ ] Feature memory carregado quando feature especificada
- [ ] Session memory persiste apenas durante sessao
- [ ] Metricas de freshness/relevance calculadas

### Dependencias

- Fase 1 (memory status - usa mesma estrutura)

---

## Fase 6: Context Engineering - Auto-Compression

**Objetivo:** Compressao automatica quando memoria excede threshold.

**Story Points:** 8

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/memory-utils.ts` | Modificar | Adicionar compressao |
| `src/utils/claude.ts` | Modificar | Suportar prompt de compressao |
| `tests/utils/memory-utils.test.ts` | Modificar | Testes de compressao |

### Tasks

1. Definir thresholds em config:
   ```typescript
   interface MemoryConfig {
     warningThreshold: number
     compressionThreshold: number
     targetAfterCompression: number
   }
   ```

2. Implementar `shouldCompress(memory: TieredMemory): boolean`:
   - True se lineCount > compressionThreshold

3. Implementar `compressMemory(memory: TieredMemory): Promise<TieredMemory>`:
   - Gerar prompt para Claude comprimir mantendo decisoes importantes
   - Preservar frontmatter e metadata
   - Arquivar versao original em `<path>.archive-YYYY-MM-DD.md`

4. Integrar no save flow:
   - Apos `saveMemoryContent()`, checar `shouldCompress()`
   - Se true, executar `compressMemory()`
   - Log de compressao executada

5. Adicionar flag para desabilitar:
   ```typescript
   adk memory save --no-compress
   ```

### Testes Necessarios

- [ ] `shouldCompress()` retorna true acima do threshold
- [ ] `compressMemory()` reduz lineCount
- [ ] Frontmatter preservado apos compressao
- [ ] Arquivo original arquivado
- [ ] `--no-compress` pula compressao

### Criterios de Aceitacao

- [ ] Warning em 800 linhas
- [ ] Compressao automatica em 1000 linhas
- [ ] Decisoes importantes preservadas
- [ ] Arquivo original arquivado
- [ ] Pode desabilitar via flag

### Dependencias

- Fase 5 (tiered memory)
- Claude CLI integration

---

## Fase 7: Agentic RAG - Dynamic Context Retrieval

**Objetivo:** Recuperacao dinamica de contexto baseada na task atual.

**Story Points:** 13

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/dynamic-context.ts` | Criar | Retrieval dinamico |
| `src/utils/memory-search.ts` | Modificar | Integrar com dynamic |
| `src/commands/feature.ts` | Modificar | Usar dynamic context |
| `tests/utils/dynamic-context.test.ts` | Criar | Testes de retrieval |

### Tasks

1. Criar `src/utils/dynamic-context.ts`:
   ```typescript
   interface RetrievalResult {
     contexts: RetrievedContext[]
     totalScore: number
     usedSources: string[]
   }

   interface RetrievedContext {
     source: string
     content: string
     score: number
     tier: MemoryTier
   }
   ```

2. Implementar `dynamicContextRetrieval(task: string, options?: RetrievalOptions)`:
   - Extrair keywords da task
   - Buscar em todos tiers de memoria
   - Buscar em decisoes (ADRs)
   - Buscar em codigo existente (patterns)
   - Ranquear por score ponderado
   - Retornar top N contextos (default 5)

3. Implementar scoring ponderado:
   ```typescript
   const WEIGHTS = {
     tier: { project: 10, feature: 25, phase: 35, session: 30 },
     type: { decision: 30, memory: 25, pattern: 25, code: 20 },
     freshness: 20,
   }
   ```

4. Implementar context cache:
   ```typescript
   class ContextCache {
     private cache: Map<string, { result: RetrievalResult, timestamp: number }>
     private ttl: number

     get(taskHash: string): RetrievalResult | undefined
     set(taskHash: string, result: RetrievalResult): void
     invalidate(pattern?: string): void
   }
   ```

5. Integrar em `feature.ts`:
   - Em `research()`: buscar arquitetura relevante
   - Em `plan()`: buscar decisoes similares
   - Em `implement()`: buscar patterns existentes

### Testes Necessarios

- [ ] `dynamicContextRetrieval()` encontra contexto relevante
- [ ] Scoring prioriza tier corretamente
- [ ] Cache funciona com TTL
- [ ] `invalidate()` limpa cache
- [ ] Busca em multiplas fontes

### Criterios de Aceitacao

- [ ] Contexto relevante recuperado automaticamente
- [ ] Agent reporta quais contextos foram usados
- [ ] Cache reduz tempo de retrieval repetido
- [ ] Performance < 500ms para retrieval

### Dependencias

- Fase 5 (tiered memory)
- Memory search existente

---

## Fase 8: Agentic RAG - Reflection Pattern

**Objetivo:** Agent valida se contexto recuperado e suficiente antes de prosseguir.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/dynamic-context.ts` | Modificar | Adicionar reflection |
| `src/utils/claude.ts` | Modificar | Suportar reflection prompt |
| `tests/utils/dynamic-context.test.ts` | Modificar | Testes de reflection |

### Tasks

1. Definir interface de reflection:
   ```typescript
   interface ReflectionResult {
     isSufficient: boolean
     missingAspects: string[]
     suggestedQueries: string[]
     confidence: number
   }
   ```

2. Implementar `reflectOnContext(task: string, contexts: RetrievedContext[])`:
   - Gerar prompt perguntando se contexto e suficiente
   - Usar Claude Haiku para eficiencia
   - Retornar aspectos faltando se insuficiente

3. Implementar loop de retrieval:
   ```typescript
   async function retrieveWithReflection(task: string): Promise<RetrievalResult> {
     let contexts = await dynamicContextRetrieval(task)
     let reflection = await reflectOnContext(task, contexts)

     let attempts = 0
     while (!reflection.isSufficient && attempts < 2) {
       const additionalContexts = await retrieveAdditional(reflection.suggestedQueries)
       contexts = mergeContexts(contexts, additionalContexts)
       reflection = await reflectOnContext(task, contexts)
       attempts++
     }

     return { contexts, reflection }
   }
   ```

4. Integrar no workflow de feature

### Testes Necessarios

- [ ] `reflectOnContext()` identifica contexto suficiente
- [ ] `reflectOnContext()` identifica gaps
- [ ] Loop para apos 2 tentativas
- [ ] `suggestedQueries` sao uteis

### Criterios de Aceitacao

- [ ] Agent avalia contexto antes de prosseguir
- [ ] Busca adicional se insuficiente
- [ ] Maximo 2 iteracoes de reflection
- [ ] Confidence score reportado

### Dependencias

- Fase 7 (dynamic context retrieval)

---

## Fase 9: Model Routing - Configuration

**Objetivo:** Configurar roteamento de modelos por fase.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/model-router.ts` | Criar | Roteamento de modelos |
| `src/utils/config.ts` | Modificar | Adicionar model config |
| `tests/utils/model-router.test.ts` | Criar | Testes de routing |

### Tasks

1. Extender config:
   ```typescript
   interface ModelRoutingConfig {
     enabled: boolean
     defaultModel: 'opus' | 'sonnet' | 'haiku'
     phaseOverrides: {
       research?: 'opus' | 'sonnet' | 'haiku'
       plan?: 'opus' | 'sonnet' | 'haiku'
       implement?: 'opus' | 'sonnet' | 'haiku'
       qa?: 'opus' | 'sonnet' | 'haiku'
     }
   }
   ```

2. Criar `src/utils/model-router.ts`:
   ```typescript
   function getModelForPhase(phase: string, override?: string): string
   function getModelConfig(): ModelRoutingConfig
   function setDefaultModel(model: string): void
   ```

3. Implementar `getModelForPhase()`:
   - Checar override CLI primeiro
   - Checar phaseOverrides em config
   - Fallback para defaultModel

4. Defaults recomendados:
   ```json
   {
     "research": "opus",
     "plan": "opus",
     "implement": "sonnet",
     "qa": "haiku"
   }
   ```

### Testes Necessarios

- [ ] `getModelForPhase()` retorna override CLI se presente
- [ ] `getModelForPhase()` retorna config por fase
- [ ] `getModelForPhase()` fallback para default
- [ ] Config merge funciona corretamente

### Criterios de Aceitacao

- [ ] Configuracao por fase funciona
- [ ] Override CLI funciona
- [ ] Defaults razoaveis aplicados
- [ ] Performance < 50ms de overhead

### Dependencias

- Config system existente

---

## Fase 10: Model Routing - Integration

**Objetivo:** Integrar roteamento automatico nos comandos.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/claude.ts` | Modificar | Suportar model selection |
| `src/commands/feature.ts` | Modificar | Usar model router |
| `src/cli.ts` | Modificar | Adicionar flag global --model |
| `tests/commands/feature.test.ts` | Modificar | Testes de routing |

### Tasks

1. Modificar `executeClaudeCommand()`:
   ```typescript
   interface ClaudeOptions {
     prompt: string
     model?: string
     timeout?: number
   }

   function executeClaudeCommand(options: ClaudeOptions): Promise<string>
   ```

2. Adicionar flag global em `cli.ts`:
   ```typescript
   program
     .option('-m, --model <model>', 'Model override (opus, sonnet, haiku)')
   ```

3. Integrar em `feature.ts`:
   - `research()`: usar `getModelForPhase('research')`
   - `plan()`: usar `getModelForPhase('plan')`
   - `implement()`: usar `getModelForPhase('implement')`

4. Passar model para Claude CLI:
   ```typescript
   const model = getModelForPhase(phase, cliOptions.model)
   await executeClaudeCommand({ prompt, model })
   ```

### Testes Necessarios

- [ ] `executeClaudeCommand()` passa model correto
- [ ] Flag global --model funciona
- [ ] Roteamento automatico por fase
- [ ] Override tem precedencia

### Criterios de Aceitacao

- [ ] Research usa Opus (ou override)
- [ ] Implementation usa Sonnet (ou override)
- [ ] `--model` override funciona
- [ ] Log mostra qual modelo sendo usado

### Dependencias

- Fase 9 (model routing config)

---

## Fase 11: CDR - Health Probes

**Objetivo:** Monitoramento de saude durante execucoes longas.

**Story Points:** 8

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/health-probes.ts` | Criar | Sistema de health probes |
| `src/types/cdr.ts` | Criar | Tipos CDR |
| `tests/utils/health-probes.test.ts` | Criar | Testes de probes |

### Tasks

1. Criar `src/types/cdr.ts`:
   ```typescript
   interface HealthStatus {
     healthy: boolean
     metrics: {
       executionTime: number
       estimatedTokens: number
       errorCount: number
       retryCount: number
     }
     warnings: string[]
     timestamp: string
   }

   interface HealthProbeConfig {
     enabled: boolean
     intervalMs: number
     tokenWarningThreshold: number
     executionTimeWarningMs: number
   }
   ```

2. Criar `src/utils/health-probes.ts`:
   ```typescript
   class HealthProbeManager {
     private intervalId: NodeJS.Timeout | null
     private status: HealthStatus
     private callbacks: ((status: HealthStatus) => void)[]

     start(config: HealthProbeConfig): void
     stop(): void
     getStatus(): HealthStatus
     onWarning(callback: (status: HealthStatus) => void): void
     recordMetric(name: string, value: number): void
   }
   ```

3. Implementar probe loop:
   - Executa a cada `intervalMs`
   - Coleta metricas atuais
   - Dispara callbacks se warning
   - Nao bloqueia operacao principal (async)

4. Integrar warnings:
   - Token pressure > 80%: warning
   - Execution time > 5min: warning
   - Error count > 0: log

### Testes Necessarios

- [ ] `start()` inicia polling
- [ ] `stop()` para polling
- [ ] Callbacks disparados em warning
- [ ] Metricas coletadas corretamente
- [ ] Async nao bloqueia

### Criterios de Aceitacao

- [ ] Probes executam a cada 30s
- [ ] Warning quando token > 80% limite
- [ ] Warning quando execucao > 5min
- [ ] Pode desabilitar via config
- [ ] Nao impacta performance

### Dependencias

- Config system

---

## Fase 12: CDR - Retry with Backoff

**Objetivo:** Retry automatico com backoff exponencial.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/recovery.ts` | Criar | Sistema de recovery |
| `src/utils/claude.ts` | Modificar | Integrar retry |
| `tests/utils/recovery.test.ts` | Criar | Testes de retry |

### Tasks

1. Criar `src/utils/recovery.ts`:
   ```typescript
   interface RetryConfig {
     maxRetries: number
     initialDelayMs: number
     maxDelayMs: number
     backoffMultiplier: number
   }

   async function withRetry<T>(
     operation: () => Promise<T>,
     config: RetryConfig
   ): Promise<T>
   ```

2. Implementar backoff exponencial:
   ```typescript
   function calculateDelay(attempt: number, config: RetryConfig): number {
     const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
     return Math.min(delay, config.maxDelayMs)
   }
   ```

3. Implementar `withRetry()`:
   - Executar operation
   - Se falhar, aguardar delay
   - Retry ate maxRetries
   - Log de cada tentativa
   - Throw apos todas tentativas falharem

4. Integrar em `executeClaudeCommand()`:
   ```typescript
   return withRetry(
     () => executeClaudeCommandInternal(options),
     getRetryConfig()
   )
   ```

### Testes Necessarios

- [ ] `withRetry()` retorna sucesso na primeira tentativa
- [ ] `withRetry()` retenta apos falha
- [ ] Delay aumenta exponencialmente
- [ ] Para apos maxRetries
- [ ] Log de cada tentativa

### Criterios de Aceitacao

- [ ] Retry automatico em falhas
- [ ] Backoff exponencial (1s, 2s, 4s)
- [ ] Maximo 3 tentativas
- [ ] Mensagem clara de recuperacao

### Dependencias

- Fase 11 (health probes - usa mesmos tipos)

---

## Fase 13: CDR - Fallback Templates

**Objetivo:** Templates validados como fallback quando agent falha.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/recovery.ts` | Modificar | Adicionar fallback |
| `templates/fallback/` | Criar | Templates de fallback |
| `tests/utils/recovery.test.ts` | Modificar | Testes de fallback |

### Tasks

1. Criar templates de fallback:
   ```
   templates/fallback/
   ├── research-fallback.md
   ├── plan-fallback.md
   ├── implement-fallback.md
   └── qa-fallback.md
   ```

2. Extender recovery:
   ```typescript
   interface FallbackConfig {
     enabled: boolean
     templatesPath: string
   }

   async function executeWithFallback<T>(
     operation: () => Promise<T>,
     fallbackTemplate: string,
     phase: string
   ): Promise<T | FallbackResult>
   ```

3. Implementar `executeWithFallback()`:
   - Tentar operation com retry
   - Se todas tentativas falharem, carregar template
   - Preencher placeholders basicos
   - Retornar como FallbackResult (marcado)

4. Templates sao read-only:
   - Copiar de `templates/fallback/` para destino
   - Nao permitir edicao in-place

### Testes Necessarios

- [ ] Fallback acionado apos 3 falhas
- [ ] Template correto carregado por fase
- [ ] Placeholders preenchidos
- [ ] FallbackResult marcado como fallback

### Criterios de Aceitacao

- [ ] Fallback acionado apos 3 tentativas
- [ ] Template basico gerado
- [ ] Mensagem clara que e fallback
- [ ] Templates read-only

### Dependencias

- Fase 12 (retry)

---

## Fase 14: CDR - Recovery Checkpoints

**Objetivo:** Checkpoints automaticos para recovery de estado.

**Story Points:** 8

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/recovery.ts` | Modificar | Adicionar checkpoints |
| `src/utils/progress.ts` | Modificar | Integrar checkpoints |
| `tests/utils/recovery.test.ts` | Modificar | Testes de checkpoint |

### Tasks

1. Definir estrutura de checkpoint:
   ```typescript
   interface Checkpoint {
     id: string
     feature: string
     phase: string
     timestamp: string
     state: {
       progress: FeatureProgress
       memory: MemoryContent
       files: string[]
     }
   }
   ```

2. Implementar checkpoint CRUD:
   ```typescript
   createCheckpoint(feature: string, phase: string): Promise<Checkpoint>
   loadCheckpoint(id: string): Promise<Checkpoint>
   listCheckpoints(feature: string): Promise<Checkpoint[]>
   deleteCheckpoint(id: string): Promise<void>
   ```

3. Armazenamento:
   - Path: `.claude/plans/features/<feature>/checkpoints/`
   - Formato: JSON compacto
   - Limite: 5 checkpoints por feature (auto-cleanup)

4. Integrar em transicoes de fase:
   - Criar checkpoint antes de iniciar nova fase
   - Limpar checkpoints antigos apos sucesso

5. Implementar recovery:
   ```typescript
   async function recoverFromCheckpoint(id: string): Promise<void>
   ```

### Testes Necessarios

- [ ] `createCheckpoint()` salva estado
- [ ] `loadCheckpoint()` restaura estado
- [ ] Auto-cleanup apos 5 checkpoints
- [ ] Recovery restaura progress
- [ ] Checkpoint < 1s para criar

### Criterios de Aceitacao

- [ ] Checkpoint automatico em transicao de fase
- [ ] Maximo 5 checkpoints por feature
- [ ] Recovery funciona corretamente
- [ ] Performance < 1s para criar

### Dependencias

- Progress tracking
- Fase 12-13 (retry, fallback)

---

## Fase 15: AI-on-AI Review - Secondary Agent

**Objetivo:** Criar agent de revisao secundaria.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `templates/claude-structure/agents/reviewer-secondary.md` | Criar | Agent de revisao |
| `src/commands/workflow.ts` | Modificar | Integrar no QA |
| `tests/commands/workflow.test.ts` | Modificar | Testes de AI-on-AI |

### Tasks

1. Criar `templates/claude-structure/agents/reviewer-secondary.md`:
   ```markdown
   ---
   name: reviewer-secondary
   description: Secondary code reviewer for AI-on-AI validation
   context: fork
   model: sonnet
   ---

   # Secondary Reviewer Agent

   ## Purpose
   Provide independent code review to catch issues missed by primary reviewer.

   ## Instructions
   1. Review code changes independently
   2. Focus on: logic errors, edge cases, security
   3. Compare with primary review findings
   4. Highlight disagreements
   5. Output consolidated findings

   ## Output Format
   - Findings unique to secondary review
   - Agreements with primary review
   - Disagreements (with rationale)
   - Final risk assessment
   ```

2. Copiar agent no `init.ts`

3. Implementar invocacao em QA:
   ```typescript
   async function runSecondaryReview(feature: string): Promise<ReviewFindings>
   ```

### Testes Necessarios

- [ ] Agent template valido
- [ ] Agent copiado no init
- [ ] `runSecondaryReview()` executa agent

### Criterios de Aceitacao

- [ ] Agent criado e documentado
- [ ] Executavel via `adk agent run reviewer-secondary`
- [ ] Output estruturado

### Dependencias

- Sistema de agents existente

---

## Fase 16: AI-on-AI Review - QA Integration

**Objetivo:** Integrar revisao secundaria no workflow de QA.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/commands/workflow.ts` | Modificar | Integrar reviews |
| `src/utils/review-consolidator.ts` | Criar | Consolidar findings |
| `tests/utils/review-consolidator.test.ts` | Criar | Testes de consolidacao |

### Tasks

1. Criar `src/utils/review-consolidator.ts`:
   ```typescript
   interface ConsolidatedReview {
     agreements: Finding[]
     primaryOnly: Finding[]
     secondaryOnly: Finding[]
     disagreements: Disagreement[]
     overallRisk: number
   }

   function consolidateReviews(
     primary: ReviewFindings,
     secondary: ReviewFindings
   ): ConsolidatedReview
   ```

2. Implementar consolidacao:
   - Comparar findings por tipo e localizacao
   - Identificar agreements (mesmo finding)
   - Identificar disagreements (conclusoes opostas)
   - Calcular risk score consolidado

3. Integrar no `qa()`:
   ```typescript
   async function qa(feature: string): Promise<QAReport> {
     const primaryReview = await runPrimaryReview(feature)
     const secondaryReview = await runSecondaryReview(feature)
     const consolidated = consolidateReviews(primaryReview, secondaryReview)

     return generateQAReport(feature, consolidated)
   }
   ```

4. Adicionar secao no QA report:
   ```markdown
   ## AI-on-AI Review

   ### Agreements (N findings)
   ...

   ### Primary-only (N findings)
   ...

   ### Secondary-only (N findings)
   ...

   ### Disagreements (N items)
   ...
   ```

### Testes Necessarios

- [ ] `consolidateReviews()` identifica agreements
- [ ] `consolidateReviews()` identifica disagreements
- [ ] QA report inclui secao de AI-on-AI
- [ ] Risk score calculado corretamente

### Criterios de Aceitacao

- [ ] Segundo modelo revisa codigo
- [ ] Findings consolidados em relatorio
- [ ] Conflitos destacados
- [ ] Risk score atualizado

### Dependencias

- Fase 15 (secondary agent)

---

## Fase 17: Quality Gates - Risk Scoring

**Objetivo:** Implementar risk score (0-100) no output de QA.

**Story Points:** 8

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/quality-scorer.ts` | Criar | Calculo de scores |
| `src/types/quality.ts` | Criar | Tipos de quality |
| `src/commands/workflow.ts` | Modificar | Integrar scoring |
| `tests/utils/quality-scorer.test.ts` | Criar | Testes de scoring |

### Tasks

1. Criar `src/types/quality.ts`:
   ```typescript
   interface QualityScores {
     risk: number
     confidence: number
     debt: DebtItem[]
   }

   interface DebtItem {
     type: 'todo' | 'skip' | 'workaround' | 'technical'
     description: string
     file: string
     line: number
     severity: 'low' | 'medium' | 'high'
   }
   ```

2. Criar `src/utils/quality-scorer.ts`:
   ```typescript
   function calculateRiskScore(inputs: RiskInputs): number
   function calculateConfidenceScore(inputs: ConfidenceInputs): number
   function detectDebt(files: string[]): Promise<DebtItem[]>
   ```

3. Implementar risk scoring:
   ```typescript
   const RISK_WEIGHTS = {
     coverage: 30,
     lintIssues: 20,
     securityFindings: 30,
     complexity: 20,
   }

   function calculateRiskScore(inputs: RiskInputs): number {
     let score = 0
     if (inputs.coverage < 80) score += RISK_WEIGHTS.coverage
     score += inputs.lintIssues * 5
     score += inputs.securityFindings * 15
     score += inputs.highComplexityFunctions * 10
     return Math.min(score, 100)
   }
   ```

4. Implementar QA gate:
   ```typescript
   if (riskScore > 70) {
     throw new Error(`Risk score ${riskScore} exceeds threshold (70). Deploy blocked.`)
   }
   ```

### Testes Necessarios

- [ ] Risk score 0 quando tudo ok
- [ ] Risk score aumenta com baixa coverage
- [ ] Risk score aumenta com security findings
- [ ] Gate bloqueia quando > 70
- [ ] Pesos corretos aplicados

### Criterios de Aceitacao

- [ ] Risk score (0-100) no QA report
- [ ] Gate falha se risk > 70
- [ ] Breakdown de fatores no report
- [ ] Scores reproduziveis

### Dependencias

- QA workflow existente
- Fase 16 (AI-on-AI integration)

---

## Fase 18: Quality Gates - Debt Tracking

**Objetivo:** Rastrear shortcuts e divida tecnica.

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/quality-scorer.ts` | Modificar | Adicionar debt detection |
| `src/utils/debt-tracker.ts` | Criar | Persistencia de debt |
| `tests/utils/debt-tracker.test.ts` | Criar | Testes de debt |

### Tasks

1. Criar `src/utils/debt-tracker.ts`:
   ```typescript
   interface DebtRegistry {
     feature: string
     items: DebtItem[]
     totalCount: number
     byType: Record<string, number>
     lastUpdated: string
   }

   function loadDebtRegistry(feature: string): Promise<DebtRegistry>
   function saveDebtRegistry(feature: string, registry: DebtRegistry): Promise<void>
   function addDebtItem(feature: string, item: DebtItem): Promise<void>
   function resolveDebtItem(feature: string, itemId: string): Promise<void>
   ```

2. Implementar `detectDebt()`:
   - Buscar `// TODO:` nos arquivos
   - Buscar `it.skip(` em testes
   - Buscar `// HACK:` ou `// WORKAROUND:`
   - Extrair linha e contexto

3. Armazenar em `.claude/plans/features/<feature>/debt.json`

4. Integrar no QA report:
   ```markdown
   ## Technical Debt

   | Type | Count |
   |------|-------|
   | TODO | 5 |
   | Skipped Tests | 2 |
   | Workarounds | 1 |

   ### Details
   ...
   ```

### Testes Necessarios

- [ ] `detectDebt()` encontra TODOs
- [ ] `detectDebt()` encontra skipped tests
- [ ] Registry persiste entre sessoes
- [ ] `resolveDebtItem()` remove item

### Criterios de Aceitacao

- [ ] Debt detectado automaticamente
- [ ] Historico mantido
- [ ] Breakdown por tipo no report
- [ ] Pode marcar como resolvido

### Dependencias

- Fase 17 (risk scoring)

---

## Fase 19: Quality Gates - Confidence Scoring

**Objetivo:** Agent reporta confidence score (0-100).

**Story Points:** 5

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/quality-scorer.ts` | Modificar | Adicionar confidence |
| `src/utils/claude.ts` | Modificar | Extrair confidence |
| `tests/utils/quality-scorer.test.ts` | Modificar | Testes de confidence |

### Tasks

1. Modificar prompts para solicitar confidence:
   ```
   At the end of your response, provide a confidence score (0-100):
   CONFIDENCE: <score>

   Consider:
   - How well do you understand the codebase? (0-100)
   - How confident are you in the solution? (0-100)
   - Are there edge cases you're uncertain about? (reduce score)
   ```

2. Implementar `extractConfidence(response: string)`:
   ```typescript
   function extractConfidence(response: string): number {
     const match = response.match(/CONFIDENCE:\s*(\d+)/)
     if (match) return parseInt(match[1], 10)
     return 50
   }
   ```

3. Implementar `calculateConfidenceScore()`:
   ```typescript
   const CONFIDENCE_INPUTS = {
     agentConfidence: 50,
     testCoverage: 25,
     reviewAgreement: 25,
   }
   ```

4. Adicionar ao QA report

### Testes Necessarios

- [ ] `extractConfidence()` extrai score corretamente
- [ ] Default 50 quando nao especificado
- [ ] Score combinado calculado
- [ ] Score incluido no report

### Criterios de Aceitacao

- [ ] Confidence score (0-100) no report
- [ ] Agent reporta confidence
- [ ] Score combinado com metricas objetivas
- [ ] Correlacao com qualidade real

### Dependencias

- Fase 17-18 (quality scoring, debt)

---

## Fase 20: Documentacao - README Update

**Objetivo:** Atualizar README.md com arquitetura completa.

**Story Points:** 8

### Arquivos Envolvidos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `README.md` | Modificar | Documentacao completa |

### Tasks

1. Adicionar secao de Arquitetura:
   - Diagrama de componentes (ASCII ou Mermaid)
   - Fluxo de dados entre comandos
   - Integracao com Claude Code

2. Documentar novos comandos:
   - `adk memory status`
   - `adk memory sync`
   - `adk report --weekly`
   - `adk report --feature`
   - `adk config migrate-hooks`

3. Documentar configuracoes:
   - Model routing
   - Health probes
   - CDR settings
   - Quality thresholds

4. Adicionar guia de extensibilidade:
   - Como criar novos agents
   - Como criar novos providers
   - Como criar novos skills

5. Adicionar troubleshooting:
   - Problemas comuns
   - Logs e debug
   - Recovery de falhas

6. Adicionar exemplos:
   - Workflow completo de feature
   - Configuracao avancada
   - Integracao com CI/CD

### Criterios de Aceitacao

- [ ] Diagrama de arquitetura incluido
- [ ] Todos comandos documentados
- [ ] Guia de extensibilidade completo
- [ ] Troubleshooting para problemas comuns
- [ ] Exemplos praticos

### Dependencias

- Todas fases anteriores (documentar o que foi implementado)

---

## Resumo de Story Points

| Fase | Descricao | Story Points |
|------|-----------|--------------|
| 1 | Memory Status | 5 |
| 2 | Memory Sync Rename | 3 |
| 3 | Report Command | 8 |
| 4 | Hooks Config Migration | 5 |
| 5 | Tiered Memory | 13 |
| 6 | Auto-Compression | 8 |
| 7 | Dynamic Context Retrieval | 13 |
| 8 | Reflection Pattern | 5 |
| 9 | Model Routing Config | 5 |
| 10 | Model Routing Integration | 5 |
| 11 | Health Probes | 8 |
| 12 | Retry with Backoff | 5 |
| 13 | Fallback Templates | 5 |
| 14 | Recovery Checkpoints | 8 |
| 15 | Secondary Agent | 5 |
| 16 | AI-on-AI QA Integration | 5 |
| 17 | Risk Scoring | 8 |
| 18 | Debt Tracking | 5 |
| 19 | Confidence Scoring | 5 |
| 20 | README Update | 8 |
| **TOTAL** | | **132** |

---

## Pontos de Verificacao

### Checkpoint 1: Apos Fase 4
**Validar:** Consolidacao completa
- [ ] `adk memory status` funcionando
- [ ] `adk memory sync` funcionando (com alias)
- [ ] `adk report` funcionando
- [ ] Hooks migrados

### Checkpoint 2: Apos Fase 8
**Validar:** Context Engineering completo
- [ ] 4 niveis de memoria funcionando
- [ ] Auto-compressao funcionando
- [ ] Dynamic context retrieval funcionando
- [ ] Reflection pattern funcionando

### Checkpoint 3: Apos Fase 14
**Validar:** CDR completo
- [ ] Model routing funcionando
- [ ] Health probes ativos
- [ ] Retry com backoff funcionando
- [ ] Fallback templates funcionando
- [ ] Recovery checkpoints funcionando

### Checkpoint 4: Apos Fase 19
**Validar:** Quality Gates completos
- [ ] AI-on-AI review funcionando
- [ ] Risk scoring implementado
- [ ] Debt tracking funcionando
- [ ] Confidence scoring funcionando
- [ ] Gate blocks quando risk > 70

### Checkpoint Final: Apos Fase 20
**Validar:** Entrega completa
- [ ] Documentacao atualizada
- [ ] Coverage >= 80%
- [ ] Todos testes passando
- [ ] Backward compatibility verificada

---

## Estrategia de Testes

### Unit Tests
Cada fase deve ter testes unitarios para:
- Funcoes puras (scoring, parsing, etc)
- Classes (mocking de dependencias)
- Edge cases identificados

### Integration Tests
Testes de integracao para:
- Fluxo completo de memoria (fases 5-8)
- Fluxo completo de CDR (fases 11-14)
- Fluxo completo de QA (fases 15-19)

### Coverage Target
- Minimo 80% para codigo novo
- Focus em:
  - Recovery paths (retry, fallback)
  - Edge cases de scoring
  - Validacao de config

### Test Commands
```bash
npm test
npm test -- --coverage
npm test -- path/to/test.ts
npm test -- --watch
```

---

## Ordem de Implementacao Recomendada

```
Semana 1-2: Fases 1-4 (Consolidacao)
Semana 3-4: Fases 5-6 (Context Engineering Base)
Semana 5-6: Fases 7-8 (Agentic RAG)
Semana 7:   Fases 9-10 (Model Routing)
Semana 8-9: Fases 11-14 (CDR)
Semana 10:  Fases 15-16 (AI-on-AI Review)
Semana 11:  Fases 17-19 (Quality Gates)
Semana 12:  Fase 20 (Documentacao)
```

---

## Notas de Implementacao

### TDD Obrigatorio
Cada fase deve seguir:
1. Escrever testes primeiro (RED)
2. Implementar codigo minimo (GREEN)
3. Refatorar mantendo testes passando (REFACTOR)

### Commits
Formato: `tipo(escopo): descricao`
- `feat(memory): add memory status command`
- `feat(cdr): implement retry with backoff`
- `test(quality): add risk scoring tests`

### Code Review
Cada fase deve passar por:
1. Self-review antes de commit
2. Testes passando
3. Coverage >= 80%
4. Lint sem erros

### Rollback Strategy
Se uma fase causar problemas:
1. Revert commits da fase
2. Manter fases anteriores funcionando
3. Investigar e corrigir antes de retomar
