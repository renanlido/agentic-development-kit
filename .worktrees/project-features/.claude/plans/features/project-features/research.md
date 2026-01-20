# Research: project-features

**Data:** 2026-01-19
**Status:** Completo
**Baseado em:** Analise completa do codebase ADK

---

## Current State Analysis

### Arquitetura Atual

O ADK (Agentic Development Kit) segue uma **arquitetura de orquestracao de prompts**:
- ADK gera prompts estruturados detalhados
- Delega execucao ao Claude Code via `executeClaudeCommand()`
- Nao executa logica complexa diretamente, atua como coordenador

**Componentes Principais:**
```
src/
├── cli.ts              # Entry point Commander.js
├── commands/           # Comandos (feature, memory, workflow, agent, etc.)
├── utils/              # Utilitarios (claude, progress, memory-utils, etc.)
├── providers/          # Integracao com project management (ClickUp)
└── types/              # Interfaces TypeScript
```

### Sistema de Memoria Atual

**Estrutura de 2 niveis:**
1. **Project Level:** `.claude/memory/project-context.md`
2. **Feature Level:** `.claude/plans/features/<feature>/memory.md`

**Capacidades Existentes:**
- Parsing de markdown com frontmatter (`parseMemoryContent`)
- Serializacao estruturada (`serializeMemoryContent`)
- Merge inteligente com deduplicacao (`mergeMemoryContent`)
- Arquivamento quando excede limite (1000 linhas)
- Busca fuzzy com scoring ponderado (fuse.js)
- Sistema de decisoes (ADR) com categorias e tags
- Recall de memoria com threshold de score (0.3)

**Limitacoes:**
- Contexto estatico (nao dinamico)
- Sem hierarquia Session/Phase
- Sem metricas de freshness/relevance
- Compressao manual (requer Claude)

### Sistema de Progresso Atual

**Estrutura (src/utils/progress.ts):**
```typescript
interface FeatureProgress {
  feature: string
  currentPhase: string
  steps: StepProgress[]      // 8 steps default
  lastUpdated: string
  nextStep?: string
}
```

**Steps Default:** prd → research → tasks → arquitetura → implementacao → qa → docs → finish

**Capacidades:**
- Sync entre main repo e worktree
- Tracking de status por step (pending/in_progress/completed/failed)
- Calculo automatico de nextStep
- Timestamps de inicio/fim por step

**Gap para CDR:**
- Sem checkpoints de recovery
- Sem retry automatico
- Sem fallback templates

### Comando Report (TODO)

**Status Atual (cli.ts:388-396):**
```typescript
program.command('report')
  .option('-w, --weekly', 'Relatorio semanal')
  .option('-f, --feature <feature>', 'Relatorio de feature especifica')
  .action((_options) => {
    console.log(chalk.blue('Gerando relatorio...'))
    // TODO: implementar
  })
```

### Sistema de Configuracao

**Localizacao:** `.adk/config.json` (nao versionado)

**Estrutura Atual:**
```typescript
interface AdkConfig {
  version: string
  integration: IntegrationConfig
  providers: Record<string, ProviderSpecificConfig>
}
```

**Gaps:**
- Sem configuracao de model routing por fase
- Sem configuracao de health probes
- Sem configuracao de retry/backoff
- Hooks config ainda em `.claude/settings.json` separado

### Sistema de Agentes

**Agentes Existentes:**
- analyzer, architect, documenter, implementer
- prd-creator, reviewer, tester, task-breakdown

**Status Tracking (agent-status.ts):**
- Tracking de execucao com estados (pending/running/completed/failed)
- Duration tracking
- Changed files tracking
- Cleanup de status antigos

**Pattern Reutilizavel para Health Probes:**
- Cache em memoria com flush para disco
- Polling com intervalo configuravel
- Watch mode com callback

---

## Similar Components

### 1. Memory Search (memoria-search.ts)

**Pattern de Scoring Ponderado:**
```typescript
const WEIGHTS = {
  title: 35,
  context: 20,
  rationale: 20,
  tags: 15,
  chosen: 10,
}
```

**Reutilizavel para:**
- Dynamic context retrieval (Agentic RAG)
- Quality scoring
- Confidence scoring

### 2. Agent Status Tracking

**Pattern de Estado com Timestamps:**
```typescript
interface AgentStatus {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  duration?: number
  error?: string
}
```

**Reutilizavel para:**
- Health probes monitoring
- CDR recovery checkpoints
- Execution metrics

### 3. Sync Queue System (sync-queue.ts)

**Pattern de Queue Persistente:**
- Enqueue de operacoes
- Retry com backoff
- Max retries configuravel

**Reutilizavel para:**
- CDR retry logic
- Fallback orchestration

### 4. Config Management

**Pattern de Merge com Defaults:**
```typescript
function mergeWithDefaults(config: Partial<AdkConfig>): AdkConfig {
  return {
    version: config.version ?? DEFAULT_ADK_CONFIG.version,
    integration: { ...DEFAULT_INTEGRATION_CONFIG, ...config.integration },
    providers: config.providers ?? {},
  }
}
```

**Reutilizavel para:**
- Model routing config
- Health probe config
- CDR config

---

## Technical Stack

### Dependencias Atuais
- **CLI:** Commander.js v14, Inquirer v13
- **Terminal:** Ora (spinners), Chalk (colors)
- **Filesystem:** fs-extra v11
- **Validation:** Zod
- **Search:** fuse.js (fuzzy search)
- **Runtime:** Node.js >= 18

### TypeScript Config
- Target: ES2020
- Module: CommonJS
- Strict mode com checks adicionais
- Source maps habilitados

### Patterns de Codigo
- Classes singleton para commands
- Error handling: ora spinner + logger + process.exit(1)
- Async/await consistente
- Path utilities centralizados

---

## Files to Create

### Novos Utilitarios
- [ ] `src/utils/dynamic-context.ts` - Agentic RAG retrieval
- [ ] `src/utils/model-router.ts` - Roteamento de modelos por fase
- [ ] `src/utils/health-probes.ts` - Monitoramento CDR
- [ ] `src/utils/recovery.ts` - Checkpoints e recovery
- [ ] `src/utils/quality-scorer.ts` - Risk/confidence scoring

### Novos Comandos
- [ ] `src/commands/report.ts` - Implementacao completa de report

### Novos Agentes
- [ ] `templates/claude-structure/agents/reviewer-secondary.md` - Revisor secundario para AI-on-AI

### Novos Tipos
- [ ] `src/types/context.ts` - Tipos para tiered context
- [ ] `src/types/quality.ts` - Tipos para scoring
- [ ] `src/types/cdr.ts` - Tipos para resiliencia

---

## Files to Modify

### CLI Principal
- [ ] `src/cli.ts`
  - Remover TODO do report
  - Adicionar alias `memory sync` para `memory update`
  - Adicionar comando `memory status`
  - Adicionar flag `--model` global

### Comandos
- [ ] `src/commands/memory.ts`
  - Renomear `update` para `sync`
  - Adicionar `status` subcommand
  - Integrar 4 niveis de memoria

- [ ] `src/commands/feature.ts`
  - Integrar model routing por fase
  - Adicionar CDR (retry/checkpoint)
  - Adicionar dynamic context retrieval

- [ ] `src/commands/workflow.ts`
  - Integrar AI-on-AI review no QA
  - Adicionar quality scoring output
  - Integrar health probes

### Utilitarios
- [ ] `src/utils/memory-utils.ts`
  - Implementar tiered memory (4 niveis)
  - Adicionar auto-compressao
  - Metricas de contexto (freshness, relevance)

- [ ] `src/utils/progress.ts`
  - Adicionar recovery checkpoints
  - Integrar com CDR system

- [ ] `src/utils/claude.ts`
  - Suportar model selection
  - Adicionar retry com backoff
  - Timeout configuravel

- [ ] `src/utils/config.ts`
  - Adicionar model routing config
  - Adicionar health probe config
  - Adicionar CDR config

### Configuracao
- [ ] Migrar hooks de `.claude/settings.json` para `.adk/config.json`

### Documentacao
- [ ] `README.md` - Documentacao completa de arquitetura

---

## Dependencies

### Internas
- Memory system (`memory-utils.ts`, `memory-search.ts`)
- Progress tracking (`progress.ts`)
- Claude CLI integration (`claude.ts`)
- Agent status system (`agent-status.ts`)
- Config system (`config.ts`)
- Provider system (`src/providers/`)

### Externas
- Claude API (Opus, Sonnet, Haiku)
- Git (worktrees, branches)
- Node.js >= 18

### Novas Dependencias
- **Nenhuma** - usar bibliotecas existentes (Zod, fuse.js, ora, chalk)

---

## Risks

| Risco | Impacto | Probabilidade | Mitigacao |
|-------|---------|---------------|-----------|
| Model routing aumenta custos API | Alto | Media | Config permite desabilitar; default usa Sonnet para tudo |
| Retry automatico causa loops infinitos | Alto | Baixa | Limite de 3 tentativas; fallback para template |
| Context cache stale causa decisoes erradas | Medio | Media | TTL configuravel; invalidacao em mudanca de fase |
| 4 niveis de memoria aumenta complexidade | Medio | Alta | Documentacao clara; migracao gradual; camadas opcionais |
| Breaking change em `memory update` → `sync` | Medio | Alta | Alias permanente; deprecation warning por 3 versoes |
| Health probes impactam performance | Baixo | Baixa | Async execution; intervalo configuravel; opt-in |
| Recovery checkpoints ocupam espaco | Baixo | Media | Limite de 5 checkpoints; auto-cleanup |
| AI-on-AI review divergente | Baixo | Baixa | Merge inteligente; human review final; diff destacado |

### Riscos de Integracao

| Componente | Risco | Mitigacao |
|------------|-------|-----------|
| `executeClaudeCommand` | Timeout em operacoes longas | Adicionar timeout configuravel + progress feedback |
| Memory parsing | Formato invalido quebra sistema | Fallback para default memory; validation antes de parse |
| Worktree sync | Conflitos entre repos | Usar estrategia newest-wins; log de conflitos |
| Config migration | Settings.json incompativel | Migration script + backup automatico |

---

## Patterns to Follow

### 1. Command Pattern (memory.ts)

```typescript
class MemoryCommand {
  async save(feature: string, options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Salvando memoria...').start()
    try {
      // Logic
      spinner.succeed('Memoria salva')
    } catch (error) {
      spinner.fail('Erro ao salvar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}
```

### 2. Config Merge Pattern (config.ts)

```typescript
function mergeWithDefaults(config: Partial<AdkConfig>): AdkConfig {
  return {
    version: config.version ?? DEFAULT_ADK_CONFIG.version,
    integration: { ...DEFAULT_INTEGRATION_CONFIG, ...config.integration },
    providers: config.providers ?? {},
  }
}
```

### 3. Status Tracking Pattern (agent-status.ts)

```typescript
interface StatusEntity {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  duration?: number
  error?: string
}
```

### 4. Sync Pattern (progress.ts)

```typescript
async function syncFiles(mainPath: string, worktreePath: string | null) {
  if (!worktreePath) return { newestPath: mainPath, needsSync: false }

  const mainModTime = await getFileModTime(mainPath)
  const worktreeModTime = await getFileModTime(worktreePath)

  if (worktreeModTime > mainModTime) {
    // Copy worktree → main
  } else if (mainModTime > worktreeModTime) {
    // Copy main → worktree
  }
}
```

### 5. Prompt Engineering Pattern (workflow.ts)

```
PHASE N: PHASE_NAME

Input: <file paths or context>
Output: <target file path>

Tasks:
1. Specific task
2. Another task

IMPORTANT: <critical constraints>
```

---

## Performance Considerations

### Context Retrieval
- **Requisito:** < 500ms para retrieval
- **Estrategia:**
  - Cache em memoria para contextos frequentes
  - Indexacao lazy de decisoes
  - Limitar busca a arquivos modificados recentemente

### Model Routing
- **Requisito:** < 50ms de overhead
- **Estrategia:**
  - Cache de model selection por fase
  - Lookup em memoria (sem I/O)
  - Pre-calculado no inicio da sessao

### Health Probes
- **Requisito:** Async, nao bloquear operacao principal
- **Estrategia:**
  - Execucao em background com `setInterval`
  - Escrever para arquivo apenas quando necessario
  - Intervalo configuravel (default 30s)

### Memory Tiers
- **Requisito:** Nao degradar operacoes existentes
- **Estrategia:**
  - Carregamento lazy por tier
  - Session memory apenas em memoria
  - Auto-flush em save points

### Recovery Checkpoints
- **Requisito:** < 1s para criar checkpoint
- **Estrategia:**
  - Serializar apenas estado essencial
  - JSON compacto (sem markdown)
  - Limite de 5 checkpoints

---

## Security Considerations

### API Tokens
- **Atual:** Tokens em `.env`, nunca em `config.json`
- **Manutencao:** `saveConfig()` filtra keys com 'token'/'secret'
- **Risco:** Model routing nao deve expor tokens diferentes

### Input Validation
- **Atual:** Zod para validacao de specs
- **Novo:** Validar config de model routing, TTL, retry counts

### Fallback Templates
- **Requisito:** Read-only, nao modificaveis por agents
- **Implementacao:** Templates em diretorio separado com permissoes restritas

### Logs
- **Requisito:** Nao logar tokens ou secrets
- **Implementacao:** Logger com sanitizacao automatica

---

## Architecture Decisions (Pre-Implementation)

### ADR-001: Tiered Memory Implementation
**Decisao:** Implementar 4 niveis como extensao do sistema existente
**Razao:** Minimizar breaking changes, reusar `MemoryContent` interface
**Alternativas:** Reescrever sistema de memoria (rejeitado - muito invasivo)

### ADR-002: Model Routing Strategy
**Decisao:** Config-driven com override via CLI flag
**Razao:** Flexibilidade para usuarios, defaults seguros
**Alternativas:** Hardcoded por fase (rejeitado - inflexivel)

### ADR-003: CDR Retry Implementation
**Decisao:** Reusar pattern do `sync-queue.ts` com backoff exponencial
**Razao:** Pattern ja testado no projeto
**Alternativas:** Biblioteca externa (rejeitado - sem necessidade)

### ADR-004: Health Probes Design
**Decisao:** Polling-based com callback pattern (similar ao watch de agent-status)
**Razao:** Consistencia com patterns existentes
**Alternativas:** Event-based (rejeitado - complexidade desnecessaria)

### ADR-005: AI-on-AI Review Integration
**Decisao:** Novo agent `reviewer-secondary.md` invocado apos QA primario
**Razao:** Reusar sistema de agentes existente
**Alternativas:** Pipeline hardcoded (rejeitado - menos flexivel)

---

## Implementation Order (Recommended)

### Fase 1: Consolidacao (Baixo Risco)
1. Implementar `report` command completo
2. Rename `memory update` → `memory sync` com alias
3. Implementar `memory status`
4. Migrar hooks config

### Fase 2: Context Engineering (Medio Risco)
1. Implementar tiered memory (4 niveis)
2. Auto-compressao com threshold
3. Metricas de contexto

### Fase 3: Agentic RAG (Medio Risco)
1. Dynamic context retrieval
2. Reflection pattern
3. Context cache com TTL

### Fase 4: Model Routing (Baixo Risco)
1. Config por fase
2. Roteamento automatico
3. Override via `--model`

### Fase 5: CDR (Alto Risco - Testar Bem)
1. Health probes
2. Retry com backoff
3. Fallback templates
4. Recovery checkpoints

### Fase 6: Quality Gates (Medio Risco)
1. AI-on-AI review agent
2. Risk scoring
3. Confidence scoring
4. Debt tracking

### Fase 7: Documentacao
1. README.md completo
2. Guias de extensibilidade
3. Troubleshooting

---

## Test Strategy

### Unit Tests
- `dynamic-context.ts` - Mock de filesystem, testar scoring
- `model-router.ts` - Testar routing por fase e overrides
- `health-probes.ts` - Mock de timers, testar callbacks
- `recovery.ts` - Testar checkpoint CRUD
- `quality-scorer.ts` - Testar calculo de scores

### Integration Tests
- Memory tiering com filesystem real
- Model routing end-to-end
- CDR com falhas simuladas
- AI-on-AI review pipeline

### Coverage Target
- >= 80% para codigo novo
- Focus em edge cases de retry/recovery

---

## Questions Resolved

1. **Q:** Onde armazenar checkpoints?
   **A:** `.claude/plans/features/<feature>/checkpoints/`

2. **Q:** Como detectar degradacao cognitiva?
   **A:** Metricas de tempo por fase + token count + error rate

3. **Q:** Qual TTL default para context cache?
   **A:** 5 minutos (configuravel via `.adk/config.json`)

4. **Q:** Como calcular risk score?
   **A:** Weighted sum: coverage (30%) + lint issues (20%) + security findings (30%) + complexity (20%)

5. **Q:** O que e "debt" no debt tracking?
   **A:** Shortcuts documentados: TODO comments, skipped tests, temporary workarounds

---

## Next Steps

1. Criar `implementation-plan.md` com tasks detalhadas
2. Definir interface TypeScript para novos tipos
3. Criar stubs dos novos arquivos
4. Implementar em ordem de menor para maior risco

---

## Descobertas Adicionais (2026-01-20)

### Contexto do Refinamento

Avaliacao solicitada: verificar se o comando `adk feature refine` esta bem implementado e funcional, e se permite refinamento seletivo de artefatos individuais.

### Novos Insights

**1. Arquitetura do Comando Refine**

O comando `refine` foi implementado com uma arquitetura bem estruturada:

| Componente | Arquivo | Funcao |
|------------|---------|--------|
| Tipos | `src/types/refine.ts` | RefineOptions, RefinableArtifact, RefineResult, TaskRefineResult |
| Utilitarios | `src/utils/task-refiner.ts` | analyzeTasksForRefinement, loadTasksForFeature, buildRefineTasksPrompt |
| Comando | `src/commands/feature.ts` | Metodo `refine()` com logica principal |
| CLI | `src/cli.ts` | Registro com opcoes --prd, --research, --tasks, --all, --cascade |
| Slash Command | `.claude/commands/refine.md` | Template interativo |

**2. Capacidade de Refinamento Seletivo**

O sistema suporta refinamento granular atraves de flags:

```bash
adk feature refine <nome> --prd       # Apenas PRD
adk feature refine <nome> --research  # Apenas Research
adk feature refine <nome> --tasks     # Apenas Tasks pendentes
adk feature refine <nome> --all       # Todos elegiveis
adk feature refine <nome>             # Modo interativo (pergunta ao usuario)
```

**3. Mecanismos de Seguranca Identificados**

- **Snapshot pre-refine**: Cria backup antes de qualquer modificacao via SnapshotManager
- **Preservacao de tasks**: Tasks com status `completed` ou `in_progress` sao automaticamente protegidas
- **Cascata opcional**: Propagacao de mudancas do PRD para Tasks e configuravel

**4. Pattern de Analise de Artefatos**

```typescript
async analyzeRefinableArtifacts(name: string, state: FeatureState): Promise<RefinableArtifact[]>
```

O sistema analisa cada artefato antes de permitir refinamento, verificando:
- Existencia do arquivo
- Status das tasks (completed/in_progress vs pending)
- Elegibilidade para modificacao

### Riscos Atualizados

| Risco | Status | Observacao |
|-------|--------|------------|
| Comando refine nao funcional | ❌ Mitigado | Implementacao completa e funcional |
| Refinamento destrutivo | ❌ Mitigado | Snapshot + preservacao de tasks |
| Falta de granularidade | ❌ Mitigado | Flags permitem selecao individual |

### Recomendacoes Futuras

1. **--dry-run**: Adicionar flag para preview de mudancas antes de aplicar
2. **--force**: Flag para sobrescrever protecoes em casos especiais
3. **Historico de refinamentos**: Log de todas as operacoes de refinamento em history.json

### Status de Implementacao

Com base na avaliacao, o sistema de refinamento esta:
- ✅ Funcional
- ✅ Bem arquitetado
- ✅ Com mecanismos de seguranca
- ✅ Granular (permite selecao individual)
