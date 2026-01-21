# Implementation Plan: techniques-implementation

**Data:** 2026-01-20
**Status:** Ready for Implementation
**Base:** research.md + prd.md

---

## Overview

This plan exposes already-implemented state management utilities via CLI and integrates orphan agents into workflows. The implementation is low-risk since core functionality exists—we are wiring existing components to user-facing interfaces.

**Total Story Points:** 34
**Estimated Phases:** 4

---

## Phase 1: Quick Wins (Orphan Agents)

**Objective:** Integrate `reviewer-secondary` and `documenter` agents into active workflows
**Story Points:** 5
**Risk Level:** Low

### Task 1.1: Add reviewer-secondary to /implement pipeline

**Files:**
- `.claude/commands/implement.md` (modify)

**Changes:**
Add Step 3.5 (Secondary Review) between Review and Atualizar Progress:

```markdown
### 3.5. Secondary Review (AI-on-AI Validation)

Use o Task tool para delegar ao agent `reviewer-secondary`:

**Instrucoes:**
- Analise o codigo ja revisado pelo `reviewer`
- Foque em issues que o primeiro revisor pode ter perdido
- Busque bugs sutis, edge cases, e problemas de seguranca
- Salve findings em `.claude/plans/features/$ARGUMENTS/secondary-review.md`
- Se nenhum issue adicional encontrado, registre: "Nenhum issue adicional encontrado"

**Nota:** Este passo é opcional - se o agent falhar, continue para o próximo step.
```

**Tests:**
- Manual: Execute `/implement` em feature de teste, verify secondary-review.md created
- Verify pipeline continues if reviewer-secondary fails

**Acceptance Criteria:**
- [ ] Step 3.5 added to implement.md after Step 3
- [ ] reviewer-secondary agent is called via Task tool
- [ ] Output saved to `secondary-review.md`
- [ ] Pipeline does not block if agent fails

**Dependencies:** None

---

### Task 1.2: Create /docs slash command

**Files:**
- `.claude/commands/docs.md` (create)

**Implementation:**

```markdown
---
description: Gera/atualiza documentação técnica do projeto
---

# Docs

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

```
Erro: Nome da feature é obrigatório.

Uso: /docs <nome-da-feature> [tipo]

Tipos suportados: api, readme, changelog, all (default: all)

Exemplo: /docs user-authentication api
```

## Pre-requisitos

Verifique se existe:
- `.claude/plans/features/$ARGUMENTS/`

Se NAO existir:
```
Erro: Feature "$ARGUMENTS" não encontrada.
Para ver features disponíveis: adk feature list
```

## Processo

### 1. Identificar Escopo

Extraia o tipo de documentação do argumento (segundo token):
- `api` - Documentação de API
- `readme` - README da feature
- `changelog` - Changelog de mudanças
- `all` ou vazio - Todos os tipos

### 2. Gerar Documentação

Use o Task tool para delegar ao agent `documenter`:

**Instruções:**
- Leia arquivos da feature em `.claude/plans/features/$ARGUMENTS/`
- Leia código implementado (se existir)
- Gere documentação do tipo solicitado
- Salve em local apropriado:
  - API: `docs/api/$ARGUMENTS.md`
  - README: `docs/features/$ARGUMENTS/README.md`
  - CHANGELOG: `docs/features/$ARGUMENTS/CHANGELOG.md`
- Siga convenções de documentação do projeto

### 3. Reportar

Informe ao usuario:
```
📚 Documentação gerada para "$ARGUMENTS"!

Arquivos criados/atualizados:
  [lista de arquivos]

Próximo passo:
  Revise a documentação e faça ajustes se necessário
```

## Importante

- Use linguagem clara e concisa
- Inclua exemplos de código quando relevante
- Mantenha consistência com documentação existente
- SEMPRE use o nome da feature passado: $ARGUMENTS
```

**Tests:**
- Manual: Execute `/docs my-feature api`, verify output
- Verify works with `all` scope

**Acceptance Criteria:**
- [ ] `/docs` command created
- [ ] Supports `api`, `readme`, `changelog`, `all` scopes
- [ ] Delegates to `documenter` agent correctly
- [ ] Creates files in appropriate locations

**Dependencies:** None

---

### Task 1.3: Document /daily workflow usage

**Files:**
- `CLAUDE.md` (modify - add section)

**Changes:**
Add new section "Daily Workflow Best Practices":

```markdown
### Daily Workflow

O comando `/daily` atualiza o estado do projeto e sincroniza memória:

\`\`\`bash
# Via slash command
/daily

# Via CLI
adk workflow daily
\`\`\`

**O que o /daily faz:**
1. Revisa git log desde ontem
2. Atualiza project memory com estado atual
3. Gera report em `.claude/daily/YYYY-MM-DD.md`
4. Atualiza `.claude/memory/project-context.md`

**Quando usar:**
- Início de cada sessão de trabalho
- Após longos períodos sem trabalhar no projeto
- Antes de iniciar nova feature

**Automação sugerida (macOS):**
\`\`\`bash
# Criar launchd job para executar daily às 9:00
# Arquivo: ~/Library/LaunchAgents/com.adk.daily.plist
\`\`\`
```

**Tests:**
- Manual: Verify documentation renders correctly

**Acceptance Criteria:**
- [ ] Section added to CLAUDE.md
- [ ] Clear explanation of /daily purpose
- [ ] Usage examples provided
- [ ] Automation suggestion included

**Dependencies:** None

---

## Phase 2: CLI Enhancement (State Management)

**Objective:** Expose StateManager, SyncEngine, SnapshotManager, HistoryTracker via CLI
**Story Points:** 13
**Risk Level:** Low-Medium

### Task 2.1: Implement `adk feature sync <name>`

**Files:**
- `src/commands/feature.ts` (modify - add sync method)
- `src/cli.ts` (modify - register subcommand)

**Implementation in feature.ts:**

```typescript
interface SyncOptions {
  strategy?: 'merge' | 'tasks-wins' | 'progress-wins'
  dryRun?: boolean
  verbose?: boolean
}

async sync(name: string, options: SyncOptions = {}): Promise<void> {
  const spinner = ora('Sincronizando estado da feature...').start()

  try {
    const featurePath = this.getFeaturePath(name)

    if (!(await fs.pathExists(featurePath))) {
      spinner.fail(`Feature "${name}" não encontrada`)
      process.exit(1)
    }

    const engine = new SyncEngine({
      strategy: options.strategy || 'merge'
    })

    if (options.dryRun) {
      spinner.text = 'Executando dry-run...'
      const preview = await engine.dryRun(name)
      spinner.succeed('Dry-run concluído')

      console.log(chalk.cyan('\n📋 Mudanças que seriam aplicadas:'))
      if (preview.changes.length === 0) {
        console.log(chalk.gray('  Nenhuma mudança necessária'))
      } else {
        preview.changes.forEach(change => {
          console.log(`  ${change.type}: ${change.description}`)
        })
      }

      if (preview.inconsistencies.length > 0) {
        console.log(chalk.yellow('\n⚠️ Inconsistências detectadas:'))
        preview.inconsistencies.forEach(inc => {
          console.log(`  ${inc.type}: ${inc.description}`)
        })
      }
      return
    }

    const result = await engine.sync(name)

    spinner.succeed(`Sincronização concluída em ${result.duration}ms`)

    if (options.verbose) {
      console.log(chalk.cyan('\n📊 Resultado:'))
      console.log(`  Inconsistências resolvidas: ${result.inconsistenciesResolved}`)
      console.log(`  Mudanças aplicadas: ${result.changes.length}`)
      console.log(`  Snapshot criado: ${result.snapshotCreated ? 'Sim' : 'Não'}`)
    }

  } catch (error) {
    spinner.fail('Falha na sincronização')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

**Registration in cli.ts:**

```typescript
feature
  .command('sync <name>')
  .description('Sincroniza estado progress.md com tasks.md')
  .option('--strategy <type>', 'Estratégia: merge|tasks-wins|progress-wins', 'merge')
  .option('--dry-run', 'Mostra mudanças sem aplicar')
  .option('--verbose', 'Saída detalhada')
  .action((name, options) => featureCommand.sync(name, options))
```

**Tests:**
- `src/commands/__tests__/feature.sync.test.ts` (create)
  - Test sync with merge strategy
  - Test dry-run shows changes without applying
  - Test verbose flag output
  - Test non-existent feature error
  - Test no changes scenario

**Acceptance Criteria:**
- [ ] Command registered in CLI
- [ ] Uses existing SyncEngine
- [ ] `--strategy` flag works (merge, tasks-wins, progress-wins)
- [ ] `--dry-run` shows preview without changes
- [ ] `--verbose` shows detailed output
- [ ] Snapshot created before sync
- [ ] Error handling for missing feature

**Dependencies:** SyncEngine (`src/utils/sync-engine.ts`)

---

### Task 2.2: Implement `adk feature restore <name>`

**Files:**
- `src/commands/feature.ts` (modify - add restore method)
- `src/cli.ts` (modify - register subcommand)

**Implementation in feature.ts:**

```typescript
interface RestoreOptions {
  list?: boolean
  to?: string
}

async restore(name: string, options: RestoreOptions = {}): Promise<void> {
  const spinner = ora('Carregando snapshots...').start()

  try {
    const featurePath = this.getFeaturePath(name)

    if (!(await fs.pathExists(featurePath))) {
      spinner.fail(`Feature "${name}" não encontrada`)
      process.exit(1)
    }

    const { SnapshotManager } = await import('../utils/snapshot-manager')
    const snapshotManager = new SnapshotManager()

    if (options.list) {
      const snapshots = await snapshotManager.listSnapshots(name)
      spinner.succeed(`${snapshots.length} snapshots encontrados`)

      if (snapshots.length === 0) {
        console.log(chalk.gray('\nNenhum snapshot disponível'))
        return
      }

      console.log(chalk.cyan('\n📸 Snapshots disponíveis:'))
      snapshots.forEach((snap, index) => {
        console.log(`  ${index + 1}. ${snap.id}`)
        console.log(`     Criado: ${snap.createdAt}`)
        console.log(`     Trigger: ${snap.trigger}`)
        console.log(`     Fase: ${snap.phase}`)
      })
      return
    }

    if (!options.to) {
      spinner.fail('Especifique --list para ver snapshots ou --to <id> para restaurar')
      process.exit(1)
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Restaurar feature "${name}" para snapshot "${options.to}"?`,
        default: false,
      },
    ])

    if (!confirm) {
      spinner.info('Restauração cancelada')
      return
    }

    spinner.text = 'Restaurando...'
    const result = await snapshotManager.restoreSnapshot(name, options.to)

    spinner.succeed(`Restaurado para snapshot: ${options.to}`)
    console.log(chalk.green(`\n✅ Estado anterior salvo como: ${result.preRestoreSnapshot}`))

  } catch (error) {
    spinner.fail('Falha na restauração')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

**Registration in cli.ts:**

```typescript
feature
  .command('restore <name>')
  .description('Restaura feature para estado anterior (snapshot)')
  .option('--list', 'Lista snapshots disponíveis')
  .option('--to <id>', 'ID do snapshot para restaurar')
  .action((name, options) => featureCommand.restore(name, options))
```

**Tests:**
- `src/commands/__tests__/feature.restore.test.ts` (create)
  - Test --list shows available snapshots
  - Test restore with confirmation
  - Test restore creates pre-restore backup
  - Test cancelled restore
  - Test invalid snapshot ID

**Acceptance Criteria:**
- [ ] Command registered in CLI
- [ ] Uses existing SnapshotManager
- [ ] `--list` shows available snapshots with metadata
- [ ] `--to <id>` restores specific snapshot
- [ ] Confirmation prompt before restore
- [ ] Pre-restore snapshot created
- [ ] Error handling for invalid snapshot ID

**Dependencies:** SnapshotManager (`src/utils/snapshot-manager.ts`)

---

### Task 2.3: Implement `adk feature history <name>`

**Files:**
- `src/commands/feature.ts` (modify - add history method)
- `src/cli.ts` (modify - register subcommand)

**Implementation in feature.ts:**

```typescript
interface HistoryOptions {
  limit?: number
}

async history(name: string, options: HistoryOptions = {}): Promise<void> {
  const spinner = ora('Carregando histórico...').start()

  try {
    const featurePath = this.getFeaturePath(name)

    if (!(await fs.pathExists(featurePath))) {
      spinner.fail(`Feature "${name}" não encontrada`)
      process.exit(1)
    }

    const tracker = new HistoryTracker()
    const history = await tracker.getHistory(name, options.limit)

    spinner.succeed(`${history.length} transições encontradas`)

    if (history.length === 0) {
      console.log(chalk.gray('\nNenhuma transição registrada'))
      return
    }

    console.log(chalk.cyan('\n📜 Histórico de Transições:'))
    console.log()

    history.forEach((entry, index) => {
      const date = new Date(entry.timestamp).toLocaleString('pt-BR')
      const duration = entry.duration ? `(${Math.round(entry.duration / 1000)}s)` : ''

      console.log(chalk.bold(`${history.length - index}. ${entry.fromPhase} → ${entry.toPhase}`))
      console.log(`   📅 ${date} ${duration}`)
      console.log(`   🔧 Trigger: ${entry.trigger}`)
      if (entry.notes) {
        console.log(`   📝 ${entry.notes}`)
      }
      console.log()
    })

  } catch (error) {
    spinner.fail('Falha ao carregar histórico')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

**Registration in cli.ts:**

```typescript
feature
  .command('history <name>')
  .description('Exibe histórico de transições da feature')
  .option('-l, --limit <n>', 'Limite de entradas', parseInt)
  .action((name, options) => featureCommand.history(name, options))
```

**Tests:**
- `src/commands/__tests__/feature.history.test.ts` (create)
  - Test history displays transitions
  - Test --limit flag
  - Test empty history
  - Test non-existent feature

**Acceptance Criteria:**
- [ ] Command registered in CLI
- [ ] Uses existing HistoryTracker
- [ ] Shows timestamp, from/to phase, trigger, duration
- [ ] `--limit` flag works
- [ ] Handles empty history gracefully

**Dependencies:** HistoryTracker (`src/utils/history-tracker.ts`)

---

### Task 2.4: Add `--unified` flag to `adk feature status`

**Files:**
- `src/commands/feature.ts` (modify - existing status or create if needed)
- `src/cli.ts` (modify - add flag)

**Note:** First verify if `feature status` exists. If not, create it.

**Implementation:**

```typescript
interface StatusOptions {
  unified?: boolean
}

async status(name: string, options: StatusOptions = {}): Promise<void> {
  const spinner = ora('Carregando status...').start()

  try {
    const featurePath = this.getFeaturePath(name)

    if (!(await fs.pathExists(featurePath))) {
      spinner.fail(`Feature "${name}" não encontrada`)
      process.exit(1)
    }

    if (options.unified) {
      const { StateManager } = await import('../utils/state-manager')
      const manager = new StateManager()
      const state = await manager.loadUnifiedState(name)

      spinner.succeed('Estado unificado carregado')

      console.log(chalk.cyan(`\n📊 Estado Unificado: ${name}`))
      console.log()
      console.log(`Fase Atual: ${chalk.bold(state.currentPhase)}`)
      console.log(`Progresso: ${chalk.bold(state.progress + '%')}`)
      console.log(`Última Atualização: ${state.lastUpdated}`)

      console.log(chalk.cyan('\n📋 Tasks:'))
      const tasksByStatus = {
        completed: state.tasks.filter(t => t.status === 'completed'),
        in_progress: state.tasks.filter(t => t.status === 'in_progress'),
        pending: state.tasks.filter(t => t.status === 'pending'),
        blocked: state.tasks.filter(t => t.status === 'blocked'),
      }

      console.log(`  ✅ Completed: ${tasksByStatus.completed.length}`)
      console.log(`  🔄 In Progress: ${tasksByStatus.in_progress.length}`)
      console.log(`  ⏳ Pending: ${tasksByStatus.pending.length}`)
      console.log(`  🚫 Blocked: ${tasksByStatus.blocked.length}`)

      if (state.transitions.length > 0) {
        console.log(chalk.cyan('\n🕐 Últimas Transições:'))
        state.transitions.slice(-3).forEach(t => {
          console.log(`  ${t.fromPhase} → ${t.toPhase} (${new Date(t.timestamp).toLocaleDateString('pt-BR')})`)
        })
      }

      return
    }

    // Default status behavior (existing or simple)
    const progress = await loadProgress(name)
    spinner.succeed('Status carregado')

    console.log(chalk.cyan(`\n📊 Feature: ${name}`))
    console.log(`Fase: ${progress.currentPhase}`)
    console.log(`Última atualização: ${progress.lastUpdated}`)

  } catch (error) {
    spinner.fail('Falha ao carregar status')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

**Registration in cli.ts:**

```typescript
feature
  .command('status <name>')
  .description('Mostra status da feature')
  .option('--unified', 'Mostra estado consolidado (progress.md + tasks.md)')
  .action((name, options) => featureCommand.status(name, options))
```

**Tests:**
- `src/commands/__tests__/feature.status.test.ts` (create)
  - Test basic status display
  - Test --unified flag shows consolidated state
  - Test task breakdown by status
  - Test transitions display

**Acceptance Criteria:**
- [ ] Command registered (if new) or flag added
- [ ] Uses existing StateManager for `--unified`
- [ ] Shows progress percentage
- [ ] Shows task breakdown by status
- [ ] Shows recent transitions
- [ ] Works without --unified for simple view

**Dependencies:** StateManager (`src/utils/state-manager.ts`)

---

## Phase 3: Workflow Optimization

**Objective:** Integrate Plan Mode and research parallel execution
**Story Points:** 10
**Risk Level:** Medium

### Task 3.1: Integrate Plan Mode in /new-feature

**Files:**
- `.claude/commands/new-feature.md` (modify)

**Changes:**

Add interview pattern before PRD creation:

```markdown
## Processo

### 0. Entrevista de Requisitos (Plan Mode)

Antes de criar qualquer artefato, conduza uma entrevista estruturada com o usuário para garantir entendimento completo:

**Perguntas obrigatórias:**

1. **Objetivo Principal**
   "Qual problema esta feature resolve ou que valor ela entrega?"

2. **Usuários Alvo**
   "Quem vai usar esta funcionalidade? (desenvolvedores, usuários finais, admins, etc.)"

3. **Escopo**
   "O que está INCLUÍDO e o que está EXCLUÍDO desta feature?"

4. **Integrações**
   "Esta feature precisa integrar com algum sistema/serviço existente?"

5. **Restrições**
   "Há restrições técnicas, de prazo, ou de escopo que devo considerar?"

6. **Critérios de Sucesso**
   "Como saberemos que esta feature foi implementada com sucesso?"

**Apresente um resumo e peça confirmação:**
```
📋 Resumo dos Requisitos:

Objetivo: [objetivo]
Usuários: [usuarios]
Escopo: [escopo]
Integrações: [integrações]
Restrições: [restrições]
Critérios: [criterios]

Confirma estas informações? (y/n)
```

Se o usuário disser "n" ou pedir alterações, ajuste e confirme novamente.

### 1. Criar Estrutura
[resto permanece igual]
```

**Add skip flag documentation:**

```markdown
## Flags Suportadas

- `--skip-plan`: Pula a fase de entrevista e vai direto para criação do PRD
  Uso: Quando os requisitos já estão bem definidos

Exemplo: /new-feature user-auth --skip-plan
```

**Tests:**
- Manual: Execute `/new-feature test-feature`, verify interview happens
- Manual: Execute with `--skip-plan`, verify interview skipped

**Acceptance Criteria:**
- [ ] Interview pattern added before PRD creation
- [ ] 6 structured questions
- [ ] Summary and confirmation step
- [ ] `--skip-plan` flag documented
- [ ] Can iterate on requirements before confirming

**Dependencies:** None

---

### Task 3.2: Research parallel agent execution

**Files:**
- `.claude/plans/features/techniques-implementation/parallel-research.md` (create)

**Deliverable:** Research document covering:
1. Claude Code parallel Task tool capabilities
2. Agent output consolidation patterns
3. Error handling in parallel contexts
4. Recommended parallelization points in ADK

**Content Structure:**

```markdown
# Parallel Agent Execution Research

## Current State
[Analysis of how agents currently run sequentially]

## Parallelization Opportunities

### /new-feature workflow
- Current: prd-creator → task-breakdown (sequential)
- Potential: [prd-creator + research] → task-breakdown

### /implement workflow
- Current: architect → implementer → reviewer → tester
- Potential: architect → implementer → [reviewer + reviewer-secondary] → tester

## Technical Approach

### Using Task Tool with Multiple Calls
[How to invoke multiple Task tools in single response]

### Output Consolidation
[How to merge outputs from parallel agents]

### Error Handling
[What happens if one parallel agent fails]

## Risks and Mitigations
[Identified risks and proposed solutions]

## Recommendation
[Go/No-Go for Phase 3.3 implementation]
```

**Tests:**
- Review: Document reviewed for completeness

**Acceptance Criteria:**
- [ ] Research document created
- [ ] Parallelization opportunities mapped
- [ ] Technical approach documented
- [ ] Risks identified
- [ ] Clear recommendation provided

**Dependencies:** None

---

### Task 3.3: Implement parallel execution (conditional)

**Note:** This task depends on Task 3.2 research outcome. Implementation only if research recommends proceeding.

**Files:**
- `.claude/commands/implement.md` (modify)
- `.claude/commands/new-feature.md` (modify)

**Changes (if approved):**

For `/implement`:
```markdown
### 3 & 3.5. Review (Paralelo)

Execute reviewer e reviewer-secondary em paralelo usando múltiplas chamadas ao Task tool na mesma resposta:

[Task tool call 1: reviewer agent]
[Task tool call 2: reviewer-secondary agent]

Consolide outputs em:
- `review.md` (do reviewer)
- `secondary-review.md` (do reviewer-secondary)
```

**Tests:**
- Manual: Verify parallel execution reduces total time
- Verify both outputs are captured

**Acceptance Criteria:**
- [ ] Parallel execution implemented (if approved)
- [ ] Both agent outputs captured
- [ ] Error handling for partial failure
- [ ] Measurable time reduction

**Dependencies:** Task 3.2 research

---

## Phase 4: Documentation

**Objective:** Complete documentation of all new features
**Story Points:** 6
**Risk Level:** Low

### Task 4.1: Update CLAUDE.md with new CLI commands

**Files:**
- `CLAUDE.md` (modify)

**Add new section:**

```markdown
## State Management Commands

ADK exposes internal state utilities via CLI for manual control:

### feature sync
Synchronizes `progress.md` with `tasks.md`:

\`\`\`bash
adk feature sync my-feature
adk feature sync my-feature --strategy tasks-wins
adk feature sync my-feature --dry-run
adk feature sync my-feature --verbose
\`\`\`

**Strategies:**
- `merge` (default): Combines information from both sources
- `tasks-wins`: Task status updates phase status
- `progress-wins`: Phase status overrides task status

### feature restore
Restores feature to previous state from snapshot:

\`\`\`bash
adk feature restore my-feature --list
adk feature restore my-feature --to pre-sync-2026-01-20
\`\`\`

### feature history
Shows phase transition history:

\`\`\`bash
adk feature history my-feature
adk feature history my-feature --limit 10
\`\`\`

### feature status
Shows feature status with optional unified view:

\`\`\`bash
adk feature status my-feature
adk feature status my-feature --unified
\`\`\`
```

**Tests:**
- Manual: Verify documentation renders correctly

**Acceptance Criteria:**
- [ ] All 4 new commands documented
- [ ] Examples provided for each
- [ ] Strategy options explained
- [ ] Consistent with existing documentation style

**Dependencies:** Phase 2 completion

---

### Task 4.2: Document MCP integration examples

**Files:**
- `CLAUDE.md` (modify - add section)

**Add section:**

```markdown
## MCP Integration Examples

ADK can be enhanced with MCP servers for external integrations:

### GitHub MCP
\`\`\`json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
\`\`\`

**Use cases:**
- Create issues from feature PRDs
- Open PRs after implementation
- Read commit history for daily reports

### Notion MCP
\`\`\`json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-notion"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}"
      }
    }
  }
}
\`\`\`

**Use cases:**
- Sync PRDs to Notion pages
- Import requirements from Notion
- Update project documentation

### Configuration Location
Add MCP configuration to `.claude/settings.json`:
\`\`\`json
{
  "mcpServers": { ... }
}
\`\`\`
```

**Tests:**
- Manual: Verify configuration examples are correct

**Acceptance Criteria:**
- [ ] GitHub MCP example provided
- [ ] Notion MCP example provided
- [ ] Use cases listed for each
- [ ] Configuration location documented

**Dependencies:** None

---

### Task 4.3: Document /docs command usage

**Files:**
- `CLAUDE.md` (modify)

**Add section:**

```markdown
### Documentation Generation

The `/docs` command generates technical documentation using the `documenter` agent:

\`\`\`bash
/docs my-feature          # Generates all documentation types
/docs my-feature api      # API documentation only
/docs my-feature readme   # Feature README only
/docs my-feature changelog # Changelog only
\`\`\`

**Output locations:**
- API docs: `docs/api/<feature>.md`
- README: `docs/features/<feature>/README.md`
- Changelog: `docs/features/<feature>/CHANGELOG.md`
```

**Tests:**
- Manual: Verify documentation is accurate

**Acceptance Criteria:**
- [ ] /docs command documented
- [ ] All scope options listed
- [ ] Output locations documented

**Dependencies:** Task 1.2

---

## Verification Checkpoints

### After Phase 1
- [ ] `/implement` includes secondary review step
- [ ] `/docs` command works with all scopes
- [ ] CLAUDE.md has /daily documentation

### After Phase 2
- [ ] `adk feature sync` works with all flags
- [ ] `adk feature restore` lists and restores snapshots
- [ ] `adk feature history` shows transitions
- [ ] `adk feature status --unified` shows consolidated view
- [ ] All tests pass with >= 80% coverage

### After Phase 3
- [ ] `/new-feature` has interview pattern
- [ ] Parallel execution research complete
- [ ] (Optional) Parallel execution implemented

### After Phase 4
- [ ] CLAUDE.md fully updated
- [ ] MCP examples documented
- [ ] All new commands documented

---

## Test Strategy

### Unit Tests (Phase 2)
- Mock SyncEngine, SnapshotManager, HistoryTracker, StateManager
- Test option parsing
- Test error handling
- Target: >= 80% coverage per file

### Integration Tests (Phase 2)
- Test actual sync operations on test feature
- Test snapshot creation/restoration
- Test history recording

### Manual Tests (Phase 1, 3, 4)
- Execute slash commands in Claude Code
- Verify output format
- Verify error messages

### Regression Tests
- Run existing test suite after each phase
- Verify no breaking changes

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Parallel execution conflicts | Defer to Phase 3.3 only after research |
| Breaking existing workflows | All changes are additive, not modifying |
| Test coverage drop | Add tests before implementation (TDD) |
| State file corruption | Always create snapshot before sync/restore |

---

## Summary

| Phase | Tasks | Story Points | Dependencies |
|-------|-------|--------------|--------------|
| 1 | 1.1, 1.2, 1.3 | 5 | None |
| 2 | 2.1, 2.2, 2.3, 2.4 | 13 | Phase 1 |
| 3 | 3.1, 3.2, 3.3 | 10 | Phase 2 |
| 4 | 4.1, 4.2, 4.3 | 6 | Phase 2, 3 |
| **Total** | **10 tasks** | **34 points** | |

**Recommended Implementation Order:**
1. Phase 1 first (quick wins, no dependencies)
2. Phase 2 (CLI, enables Phase 4)
3. Phase 3.1 and 3.2 in parallel
4. Phase 3.3 conditional on research
5. Phase 4 after Phase 2

**Ready for Implementation:** Yes
