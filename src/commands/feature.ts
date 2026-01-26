import { execFileSync, execSync } from 'node:child_process'
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { createClickUpProvider } from '../providers/clickup/index.js'
import type { LocalFeature, ProviderSpecificConfig } from '../providers/types.js'
import type { ModelType } from '../types/model'
import { executeClaudeCommand } from '../utils/claude'
import { getIntegrationConfig, getProviderConfig } from '../utils/config.js'
import {
  getClaudePath as getClaudePathUtil,
  getFeaturePath as getFeaturePathUtil,
  getMainRepoPath as getMainRepoPathUtil,
} from '../utils/git-paths'
import { HistoryTracker } from '../utils/history-tracker'
import { logger } from '../utils/logger'
import { getModelForPhase } from '../utils/model-router'
import {
  type FeatureProgress,
  isStepCompleted,
  loadProgress,
  saveProgress,
  updateStepStatus,
} from '../utils/progress'
import { parseSpecFromMarkdown, validateSpec } from '../utils/spec-utils'
import { SyncEngine } from '../utils/sync-engine'
import { loadTemplate } from '../utils/templates'
import { setupClaudeSymlink } from '../utils/worktree-utils'
import { memoryCommand } from './memory'

interface FeatureOptions {
  priority?: string
  phase?: string
  context?: string
  description?: string
  skipSpec?: boolean
  baseBranch?: string
  noSync?: boolean
  model?: string
}

interface QuickOptions {
  file?: string
  test?: boolean
  commit?: boolean
}

interface FeatureState {
  exists: boolean
  hasPrd: boolean
  hasTasks: boolean
  hasPlan: boolean
  hasResearch: boolean
  hasQaReport: boolean
  currentStage: string
  featurePath: string
}

type PhaseAction = 'refine' | 'redo' | 'next'

interface PhaseCheckResult {
  action: PhaseAction
  extraContext?: string
}

class FeatureCommand {
  private async setActiveFocus(name: string, status: string): Promise<void> {
    const mainRepoPath = this.getMainRepoPath()
    const focusPath = path.join(mainRepoPath, '.claude/active-focus.md')
    const featurePath = `.claude/plans/features/${name}/`
    const content = `# Foco Ativo

feature: ${name}
status: ${status}
path: ${featurePath}
`
    await fs.writeFile(focusPath, content)
  }

  private hasRemote(): boolean {
    try {
      const remotes = execFileSync('git', ['remote'], { encoding: 'utf-8' }).trim()
      return remotes.length > 0
    } catch {
      return false
    }
  }

  private isInWorktreeForFeature(name: string): boolean {
    try {
      const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
      const expectedBranch = `feature/${featureSlug}`
      const cwd = process.cwd()

      if (cwd.includes(`.worktrees/${featureSlug}`) || cwd.includes(`.worktrees\\${featureSlug}`)) {
        return true
      }

      const currentBranch = execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf-8',
      }).trim()

      if (currentBranch === expectedBranch) {
        const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
          encoding: 'utf-8',
        }).trim()

        if (gitDir.includes('.git/worktrees')) {
          return true
        }
      }

      const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
        encoding: 'utf-8',
      }).trim()

      return gitDir.includes('.git/worktrees') || gitDir.endsWith(`.git/worktrees/${featureSlug}`)
    } catch {
      return false
    }
  }

  private getMainRepoPath(): string {
    return getMainRepoPathUtil()
  }

  private getClaudePath(): string {
    return getClaudePathUtil()
  }

  private getFeaturePath(name: string): string {
    return getFeaturePathUtil(name)
  }

  private async syncFeatureToRemote(
    name: string,
    progress: FeatureProgress,
    noSync?: boolean
  ): Promise<void> {
    if (noSync) {
      return
    }

    const integration = await getIntegrationConfig()
    if (!integration.enabled || !integration.provider) {
      return
    }

    const token = await this.getTokenFromEnv(integration.provider)
    if (!token) {
      return
    }

    try {
      const provider = this.createProviderInstance(integration.provider)
      if (!provider) {
        return
      }

      const providerConfig = await getProviderConfig<ProviderSpecificConfig>(integration.provider)
      const connectionResult = await provider.connect({
        token,
        workspaceId: providerConfig?.workspaceId as string | undefined,
        spaceId: providerConfig?.spaceId as string | undefined,
        listId: providerConfig?.listId as string | undefined,
      })

      if (!connectionResult.success) {
        logger.warn(`Sync skipped: ${connectionResult.message}`)
        return
      }

      const localFeature = this.progressToLocalFeature(name, progress)
      const progressPath = path.join(this.getFeaturePath(name), 'progress.json')
      let remoteId: string | undefined

      if (await fs.pathExists(progressPath)) {
        try {
          const progressData = await fs.readJson(progressPath)
          remoteId = progressData.remoteId
        } catch {
          // Ignore JSON parse errors
        }
      }

      const result = await provider.syncFeature(localFeature, remoteId)

      if (result.status === 'synced' && result.remoteId) {
        const progressData = (await fs.pathExists(progressPath))
          ? await fs.readJson(progressPath)
          : {}

        await fs.writeJson(
          progressPath,
          {
            ...progressData,
            syncStatus: 'synced',
            remoteId: result.remoteId,
            lastSynced: result.lastSynced,
          },
          { spaces: 2 }
        )
        logger.info(`Synced to ${integration.provider}`)
      }
    } catch (error) {
      logger.warn(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async syncProgressState(
    name: string,
    fromPhase: string,
    toPhase: string,
    trigger: string
  ): Promise<void> {
    try {
      const syncEngine = new SyncEngine({ strategy: 'merge' })
      await syncEngine.sync(name)

      const historyTracker = new HistoryTracker()
      await historyTracker.recordTransition(name, {
        timestamp: new Date().toISOString(),
        fromPhase,
        toPhase,
        trigger,
      })
    } catch {}
  }

  private async getTokenFromEnv(provider: string): Promise<string | null> {
    const envPath = path.join(this.getMainRepoPath(), '.env')

    if (await fs.pathExists(envPath)) {
      const content = await fs.readFile(envPath, 'utf-8')
      const key = `${provider.toUpperCase()}_API_TOKEN`
      const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
      return match ? match[1].trim() : null
    }

    return null
  }

  private createProviderInstance(providerName: string) {
    switch (providerName) {
      case 'clickup':
        return createClickUpProvider()
      default:
        return null
    }
  }

  private progressToLocalFeature(name: string, progress: FeatureProgress): LocalFeature {
    const completedSteps = progress.steps.filter((s) => s.status === 'completed').length
    const totalSteps = progress.steps.length

    return {
      name,
      phase: progress.currentPhase,
      progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      lastUpdated: progress.lastUpdated,
    }
  }

  private async getDefaultBranch(): Promise<string> {
    try {
      const remote = execFileSync('git', ['remote', 'show', 'origin'], { encoding: 'utf-8' })
      const match = remote.match(/HEAD branch: (.+)/)
      return match ? match[1].trim() : 'main'
    } catch {
      return 'main'
    }
  }

  private async setupWorktree(
    name: string,
    baseBranch = 'main'
  ): Promise<{ success: boolean; worktreePath?: string; branch?: string; error?: string }> {
    const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
    const branchName = `feature/${featureSlug}`
    const mainRepo = this.getMainRepoPath()
    const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)

    try {
      if (await fs.pathExists(worktreeDir)) {
        try {
          execFileSync('git', ['rev-parse', '--git-dir'], {
            cwd: worktreeDir,
            encoding: 'utf-8',
            stdio: 'pipe',
          })
          await setupClaudeSymlink(worktreeDir, mainRepo)
          return { success: true, worktreePath: worktreeDir, branch: branchName }
        } catch {
          await fs.remove(worktreeDir)
          try {
            execFileSync('git', ['worktree', 'prune'], { stdio: 'pipe' })
          } catch {
            // ignore prune errors
          }
        }
      }

      await fs.ensureDir(path.dirname(worktreeDir))

      try {
        execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], {
          stdio: 'ignore',
        })
      } catch {
        const hasRemote = this.hasRemote()
        if (hasRemote) {
          try {
            execFileSync('git', ['fetch', 'origin', baseBranch], { stdio: 'pipe' })
          } catch {
            // Ignore fetch errors
          }
        }

        try {
          execFileSync('git', ['branch', branchName, baseBranch], { stdio: 'pipe' })
        } catch {
          execFileSync('git', ['branch', branchName], { stdio: 'pipe' })
        }
      }

      const currentBranch = execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim()

      if (currentBranch === branchName) {
        return {
          success: true,
          worktreePath: process.cwd(),
          branch: branchName,
        }
      }

      execFileSync('git', ['worktree', 'add', worktreeDir, branchName], { stdio: 'pipe' })

      await setupClaudeSymlink(worktreeDir, mainRepo)

      return { success: true, worktreePath: worktreeDir, branch: branchName }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async getFeatureState(name: string): Promise<FeatureState> {
    const featurePath = this.getFeaturePath(name)
    const exists = await fs.pathExists(featurePath)

    const hasPrd = await fs.pathExists(path.join(featurePath, 'prd.md'))
    const hasTasks = await fs.pathExists(path.join(featurePath, 'tasks.md'))
    const hasPlan = await fs.pathExists(path.join(featurePath, 'implementation-plan.md'))
    const hasResearch = await fs.pathExists(path.join(featurePath, 'research.md'))
    const hasQaReport = await fs.pathExists(path.join(featurePath, 'qa-report.md'))

    let currentStage = 'não iniciada'
    if (hasQaReport) {
      currentStage = 'qa concluído'
    } else if (hasPlan) {
      currentStage = 'arquitetura pronta'
    } else if (hasResearch) {
      currentStage = 'research feito'
    } else if (hasTasks) {
      currentStage = 'tasks definidas'
    } else if (hasPrd) {
      currentStage = 'PRD criado'
    } else if (exists) {
      currentStage = 'estrutura criada'
    }

    return {
      exists,
      hasPrd,
      hasTasks,
      hasPlan,
      hasResearch,
      hasQaReport,
      currentStage,
      featurePath,
    }
  }

  private async askToResume(name: string, state: FeatureState): Promise<boolean> {
    const hasContent = state.hasPrd || state.hasResearch || state.hasTasks || state.hasPlan
    if (!state.exists || !hasContent) {
      return true
    }

    console.log()
    console.log(chalk.yellow(`Feature "${name}" já existe!`))
    console.log(chalk.gray(`  Status atual: ${state.currentStage}`))
    console.log()

    try {
      const { shouldResume } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldResume',
          message: 'Deseja retomar de onde parou?',
          default: true,
        },
      ])

      return shouldResume
    } catch {
      return false
    }
  }

  private async loadContext(options: FeatureOptions): Promise<string> {
    let context = ''

    if (options.context) {
      const contextPath = path.resolve(options.context)
      if (await fs.pathExists(contextPath)) {
        const stat = await fs.stat(contextPath)
        if (stat.isDirectory()) {
          const files = await fs.readdir(contextPath)
          const textFiles = files.filter((f) => /\.(md|txt|json|yaml|yml)$/i.test(f))
          const contents: string[] = []
          for (const file of textFiles.sort()) {
            const filePath = path.join(contextPath, file)
            const fileStat = await fs.stat(filePath)
            if (fileStat.isFile()) {
              const content = await fs.readFile(filePath, 'utf-8')
              contents.push(`# File: ${file}\n\n${content}`)
            }
          }
          context = contents.join('\n\n---\n\n')
        } else {
          context = await fs.readFile(contextPath, 'utf-8')
        }
      }
    }

    if (options.description) {
      context = options.description + (context ? `\n\n---\n\n${context}` : '')
    }

    return context
  }

  private async checkPhaseExists(
    _phaseName: string,
    phaseLabel: string,
    outputPath: string,
    nextPhaseName: string
  ): Promise<PhaseCheckResult | null> {
    if (!(await fs.pathExists(outputPath))) {
      return null
    }

    console.log()
    console.log(chalk.yellow(`${phaseLabel} já existe para esta feature.`))
    console.log(chalk.gray(`  Arquivo: ${outputPath}`))
    console.log()

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `O que deseja fazer com ${phaseLabel}?`,
        choices: [
          { name: `🔧 Refinar - Adicionar contexto e melhorar`, value: 'refine' },
          { name: `🔄 Refazer - Começar do zero`, value: 'redo' },
          { name: `⏭️  Próxima - Ir para ${nextPhaseName}`, value: 'next' },
        ],
      },
    ])

    if (action === 'refine') {
      const { extraContext } = await inquirer.prompt([
        {
          type: 'input',
          name: 'extraContext',
          message: 'Adicione contexto extra (ou deixe vazio para manter):',
        },
      ])
      return { action: 'refine', extraContext: extraContext || undefined }
    }

    return { action }
  }

  private async validateSpecGate(
    name: string,
    options: { skipSpec?: boolean } = {}
  ): Promise<{ valid: boolean; specContent?: string }> {
    if (options.skipSpec) {
      console.log()
      console.log(chalk.yellow('⚠️  Pulando validação de spec (--skip-spec)'))
      console.log(chalk.yellow('   Isso pode levar a problemas de implementação.'))
      console.log()
      return { valid: true }
    }

    const specPath = path.join(this.getClaudePath(), 'specs', `${name}.md`)
    const featureSpecPath = path.join(this.getFeaturePath(name), 'spec.md')

    let actualSpecPath: string | null = null
    if (await fs.pathExists(specPath)) {
      actualSpecPath = specPath
    } else if (await fs.pathExists(featureSpecPath)) {
      actualSpecPath = featureSpecPath
    }

    if (!actualSpecPath) {
      return { valid: true }
    }

    const specContent = await fs.readFile(actualSpecPath, 'utf-8')
    const parsedSpec = parseSpecFromMarkdown(specContent)
    const validation = validateSpec(parsedSpec)

    if (!validation.valid) {
      console.log()
      console.log(chalk.red('❌ Spec validation failed:'))
      for (const error of validation.errors) {
        console.log(chalk.red(`   - ${error.field}: ${error.message}`))
      }
      console.log()
      console.log(chalk.yellow('Opções:'))
      console.log(chalk.gray(`  1. Corrija a spec: adk spec validate --fix ${name}`))
      console.log(chalk.gray('  2. Use --skip-spec para ignorar (não recomendado)'))
      console.log()
      return { valid: false }
    }

    if (validation.warnings.length > 0) {
      console.log()
      console.log(chalk.yellow('⚠️  Spec warnings:'))
      for (const warning of validation.warnings) {
        console.log(chalk.yellow(`   - ${warning}`))
      }
      console.log()
    }

    return { valid: true, specContent }
  }

  async create(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora()

    try {
      const state = await this.getFeatureState(name)

      if (state.exists) {
        const shouldResume = await this.askToResume(name, state)
        if (!shouldResume) {
          logger.info('Operação cancelada.')
          return
        }
        logger.info('Continuando com feature existente...')
      }

      spinner.start('Criando estrutura da feature...')

      await fs.ensureDir(state.featurePath)

      const contextFromOptions = await this.loadContext(options)
      const hasContext = contextFromOptions && contextFromOptions.trim().length > 0

      const prdPath = path.join(state.featurePath, 'prd.md')

      if (!state.hasPrd) {
        if (hasContext) {
          spinner.text = 'Gerando PRD a partir do contexto...'

          const descriptionSection = options.description
            ? `

## Descrição da Feature

${options.description}
`
            : ''

          const prdPrompt = `
TASK: Gerar PRD (Product Requirements Document) completo

## Contexto Fornecido

<context>
${contextFromOptions}
</context>

## Instruções

Com base no contexto acima, crie um PRD completo e detalhado para a feature "${name}".${descriptionSection}

O PRD DEVE seguir esta estrutura:

# PRD: ${name}

**Data:** ${new Date().toISOString().split('T')[0]}
**Status:** Draft
**Autor:** [Auto-generated]

## 1. Problema

[Descreva o problema que esta feature resolve, baseado no contexto]

## 2. Solução Proposta

[Descreva a solução de forma clara e objetiva]

## 3. Requisitos Funcionais

- RF01: [Requisito 1]
- RF02: [Requisito 2]
...

## 4. Requisitos Não-Funcionais

- RNF01: Performance - [especificar]
- RNF02: Segurança - [especificar]
...

## 5. User Stories

### US01: [Título]
**Como** [persona]
**Quero** [ação]
**Para** [benefício]

**Critérios de Aceitação:**
- [ ] Critério 1
- [ ] Critério 2

## 6. Escopo

### Incluído
- Item 1
- Item 2

### Excluído (Out of Scope)
- Item 1
- Item 2

## 7. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Risco 1 | Alto/Médio/Baixo | Como mitigar |

## 8. Métricas de Sucesso

- Métrica 1: [como medir]
- Métrica 2: [como medir]

## 9. Dependências

- Dependência 1
- Dependência 2

## 10. Timeline (Sugestão)

- Fase 1: [descrição]
- Fase 2: [descrição]

---

IMPORTANTE:
- Extraia TODAS as informações relevantes do contexto
- Seja específico e detalhado
- Não deixe placeholders genéricos - preencha com informações reais do contexto
- Se alguma informação não estiver no contexto, faça inferências razoáveis ou marque como [A DEFINIR]

Output: Salve o PRD em ${prdPath}
`

          const prdModel = getModelForPhase('prd', options.model as ModelType | undefined)
          await executeClaudeCommand(prdPrompt, { model: prdModel })
          spinner.succeed('PRD gerado a partir do contexto')
        } else {
          const prdTemplate = await loadTemplate('prd-template.md')
          const date = new Date().toISOString().split('T')[0]
          const prdContent = prdTemplate
            .replace(/\[Nome da Feature\]/g, name)
            .replace(/YYYY-MM-DD/g, date)
          await fs.writeFile(prdPath, prdContent)
          spinner.succeed('PRD template criado')
          console.log(chalk.yellow('  Dica: Edite o PRD ou use -c para passar contexto'))
        }
      }

      spinner.start('Criando arquivos de contexto...')

      const featureContext = contextFromOptions || '[Adicione contexto específico desta feature]'
      const contextContent = `# ${name} Context

Inherits: .claude/memory/project-context.md

## Feature-specific Context

${featureContext}

## Dependencies

[Liste dependências externas e internas]

## Related Files

[Liste arquivos relacionados para referência]
`
      const contextPath = path.join(state.featurePath, 'context.md')
      if (!(await fs.pathExists(contextPath))) {
        await fs.writeFile(contextPath, contextContent)
      }

      const constraintsContent = `# Constraints: ${name}

## Escopo Permitido
- src/
- .claude/plans/features/${name}/

## Restricoes
- NAO adicionar dependencias externas sem aprovacao
- NAO modificar arquivos fora do escopo sem justificativa

## Padrao de Commits
- Usar conventional commits
- Prefixo: feat(${name}):

## Notas
- Atualize este arquivo conforme necessario
`
      const constraintsPath = path.join(state.featurePath, 'constraints.md')
      if (!(await fs.pathExists(constraintsPath))) {
        await fs.writeFile(constraintsPath, constraintsContent)
      }

      // Create git branch (without checkout - repo stays on current branch)
      try {
        execFileSync('git', ['branch', `feature/${name}`], { stdio: 'ignore' })
      } catch {
        // Git not available or branch already exists
      }

      spinner.succeed('Estrutura criada')

      let progress = await loadProgress(name)
      progress = updateStepStatus(progress, 'prd', 'completed')
      await saveProgress(name, progress)

      await this.setActiveFocus(name, state.currentStage)

      await this.syncFeatureToRemote(name, progress, options.noSync)

      console.log()
      logger.success(`✨ Feature ${name} criada!`)
      console.log()

      if (hasContext) {
        console.log(chalk.green('PRD gerado automaticamente a partir do contexto fornecido.'))
        console.log(chalk.gray(`  Revise: .claude/plans/features/${name}/prd.md`))
        console.log()
        console.log(chalk.cyan('Próximos passos:'))
        console.log(chalk.gray(`  1. Revisar PRD gerado`))
        console.log(chalk.gray(`  2. adk feature research ${name}`))
      } else {
        console.log(chalk.cyan('Próximos passos:'))
        console.log(chalk.gray(`  1. Editar PRD: .claude/plans/features/${name}/prd.md`))
        console.log(chalk.gray(`  2. adk feature research ${name}`))
      }
      console.log(chalk.gray(`  3. adk feature tasks ${name}`))
      console.log(chalk.gray(`  4. adk feature plan ${name}`))
      console.log(chalk.gray(`  5. adk feature implement ${name}`))
      console.log(chalk.gray(`  6. adk feature qa ${name}`))
      console.log(chalk.gray(`  7. adk feature docs ${name}`))
    } catch (error) {
      spinner.fail('Erro ao criar feature')
      try {
        const progress = await loadProgress(name)
        updateStepStatus(progress, 'prd', 'failed', String(error))
        await saveProgress(name, progress)
      } catch {
        // Ignore if can't save progress
      }
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async research(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Executando research phase...').start()

    try {
      const featurePath = this.getFeaturePath(name)
      const researchPath = path.join(featurePath, 'research.md')

      if (!(await fs.pathExists(featurePath))) {
        spinner.text = `Criando estrutura da feature ${name}...`
        await fs.ensureDir(featurePath)
      }

      spinner.stop()

      const phaseCheck = await this.checkPhaseExists('research', 'Research', researchPath, 'Tasks')

      if (phaseCheck) {
        if (phaseCheck.action === 'next') {
          let progress = await loadProgress(name)
          progress = updateStepStatus(progress, 'research', 'completed')
          await saveProgress(name, progress)
          console.log(chalk.green('✓ Research marcado como concluído'))
          console.log(chalk.yellow(`\nPróximo: adk feature tasks ${name}`))
          return
        }

        if (phaseCheck.action === 'redo') {
          await fs.remove(researchPath)
        }

        if (phaseCheck.extraContext) {
          options.context = phaseCheck.extraContext
        }
      }

      spinner.start('Executando research phase...')

      let progress = await loadProgress(name)
      progress = updateStepStatus(progress, 'research', 'in_progress')
      await saveProgress(name, progress)

      let contextContent = await this.loadContext(options)

      if (phaseCheck?.action === 'refine' && (await fs.pathExists(researchPath))) {
        const existingContent = await fs.readFile(researchPath, 'utf-8')
        const refineContext = phaseCheck.extraContext
          ? `\n\nContexto adicional do usuário: ${phaseCheck.extraContext}`
          : ''
        contextContent = `## Research Existente (refinar/melhorar):\n\n${existingContent}${refineContext}\n\n${contextContent || ''}`
      }

      if (contextContent) {
        spinner.text = 'Research com contexto adicional...'
      }

      const contextSection = contextContent
        ? `
## Contexto Adicional

<context>
${contextContent}
</context>

`
        : ''

      const prompt = `
PHASE 1: RESEARCH

Feature: ${name}
PRD: .claude/plans/features/${name}/prd.md
${contextSection}
Tasks:
1. Leia PRD completamente
2. Analise codebase atual:
   - Componentes similares
   - Padrões estabelecidos
   - Tech stack
   - Dependências
3. Identifique:
   - Arquivos a criar
   - Arquivos a modificar
   - Breaking changes potenciais
   - Riscos técnicos
   - Performance considerations
4. Busque no código exemplos de:
   - Similar features
   - Patterns to follow
   - Anti-patterns to avoid

Output: .claude/plans/features/${name}/research.md

Estrutura do research.md:
# Research: ${name}

## Current State Analysis
[Descreva estado atual]

## Similar Components
[Liste componentes similares e como funcionam]

## Technical Stack
[Liste tecnologias envolvidas]

## Files to Create
- [ ] file1.ts
- [ ] file2.ts

## Files to Modify
- [ ] existing-file.ts (change X)

## Dependencies
- External: [npm packages]
- Internal: [outros módulos]

## Risks
- Risk 1: [description + mitigation]

## Patterns to Follow
- Pattern 1: [example from codebase]

## Performance Considerations
[Lista de considerações]

## Security Considerations
[Lista de considerações]
`

      const researchModel = getModelForPhase('research', options.model as ModelType | undefined)
      await executeClaudeCommand(prompt, { model: researchModel })

      spinner.succeed('Research concluído')

      progress = updateStepStatus(progress, 'research', 'completed')
      await saveProgress(name, progress)
      await this.syncProgressState(name, 'prd', 'research', 'adk feature research')

      await this.setActiveFocus(name, 'research feito')
      await memoryCommand.save(name, { phase: 'research' })
      await this.syncFeatureToRemote(name, progress, options.noSync)

      console.log()
      logger.success(`Research salvo em: ${chalk.cyan(`${featurePath}/research.md`)}`)
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray(`  adk feature tasks ${name}`))
    } catch (error) {
      spinner.fail('Erro no research')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'research', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async plan(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Criando plano de implementação...').start()

    try {
      const featurePath = this.getFeaturePath(name)
      const planPath = path.join(featurePath, 'implementation-plan.md')

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${name} não encontrada`)
        process.exit(1)
      }

      const researchPath = path.join(featurePath, 'research.md')
      const prdPath = path.join(featurePath, 'prd.md')
      const hasResearch = await fs.pathExists(researchPath)
      const hasPrd = await fs.pathExists(prdPath)

      if (!hasResearch && !hasPrd) {
        spinner.fail(`Execute research primeiro: adk feature research ${name}`)
        process.exit(1)
      }

      spinner.text = 'Validando spec...'
      const specValidation = await this.validateSpecGate(name, { skipSpec: options.skipSpec })
      if (!specValidation.valid) {
        spinner.fail('Spec inválida. Corrija antes de continuar.')
        process.exit(1)
      }

      spinner.stop()

      const phaseCheck = await this.checkPhaseExists(
        'arquitetura',
        'Plano de Implementação',
        planPath,
        'Implementação'
      )

      if (phaseCheck) {
        if (phaseCheck.action === 'next') {
          let progress = await loadProgress(name)
          progress = updateStepStatus(progress, 'arquitetura', 'completed')
          await saveProgress(name, progress)
          console.log(chalk.green('✓ Plano marcado como concluído'))
          console.log(chalk.yellow(`\nPróximo: adk feature implement ${name}`))
          return
        }

        if (phaseCheck.action === 'redo') {
          await fs.remove(planPath)
        }
      }

      spinner.start('Criando plano de implementação...')

      let progress = await loadProgress(name)
      progress = updateStepStatus(progress, 'arquitetura', 'in_progress')
      await saveProgress(name, progress)

      const inputFile = hasResearch ? 'research.md' : 'prd.md'

      let existingPlanContext = ''
      if (phaseCheck?.action === 'refine' && (await fs.pathExists(planPath))) {
        const existingContent = await fs.readFile(planPath, 'utf-8')
        const refineContext = phaseCheck.extraContext
          ? `\n\nContexto adicional do usuário: ${phaseCheck.extraContext}`
          : ''
        existingPlanContext = `
## Plano Existente (refinar/melhorar):

<existing-plan>
${existingContent}
</existing-plan>
${refineContext}
`
      }

      const specSection = specValidation.specContent
        ? `
## Spec (Especificação Formal)

<spec>
${specValidation.specContent}
</spec>

IMPORTANTE: O plano DEVE seguir a spec acima. Todos os acceptance criteria da spec devem estar cobertos.
`
        : ''

      const prompt = `
PHASE 2: DETAILED PLANNING

Input: .claude/plans/features/${name}/${inputFile}
PRD: .claude/plans/features/${name}/prd.md
${existingPlanContext}${specSection}
Tasks:
1. Crie breakdown detalhado em fases
2. Para cada fase:
   - Objetivo claro
   - Arquivos envolvidos
   - Testes necessários
   - Critérios de aceitação
   - Dependências
   - Estimativa (story points)
3. Defina ordem ótima de implementação
4. Identifique pontos de verificação
5. Planeje estratégia de testes

Output: .claude/plans/features/${name}/implementation-plan.md

IMPORTANTE: Este é apenas o plano. NÃO IMPLEMENTE AINDA.
`

      const planModel = getModelForPhase('planning', options.model as ModelType | undefined)
      await executeClaudeCommand(prompt, { model: planModel })

      spinner.succeed('Plano criado')

      progress = updateStepStatus(progress, 'arquitetura', 'completed')
      await saveProgress(name, progress)
      await this.syncProgressState(name, 'tasks', 'arquitetura', 'adk feature plan')

      await this.setActiveFocus(name, 'arquitetura pronta')
      await memoryCommand.save(name, { phase: 'plan' })
      await this.syncFeatureToRemote(name, progress, options.noSync)

      console.log()
      logger.success(`Plano salvo em: ${chalk.cyan(`${featurePath}/implementation-plan.md`)}`)
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray('  Revisar plano e então executar:'))
      console.log(chalk.gray(`  adk feature implement ${name}`))
    } catch (error) {
      spinner.fail('Erro ao criar plano')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'arquitetura', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async tasks(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Criando breakdown de tasks...').start()

    try {
      const featurePath = this.getFeaturePath(name)
      const tasksPath = path.join(featurePath, 'tasks.md')

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${name} não encontrada`)
        process.exit(1)
      }

      const researchPath = path.join(featurePath, 'research.md')
      const prdPath = path.join(featurePath, 'prd.md')
      const hasResearch = await fs.pathExists(researchPath)
      const hasPrd = await fs.pathExists(prdPath)

      if (!hasResearch && !hasPrd) {
        spinner.fail(`Execute research primeiro: adk feature research ${name}`)
        process.exit(1)
      }

      spinner.stop()

      const phaseCheck = await this.checkPhaseExists('tasks', 'Tasks', tasksPath, 'Plano')

      if (phaseCheck) {
        if (phaseCheck.action === 'next') {
          let progress = await loadProgress(name)
          progress = updateStepStatus(progress, 'tasks', 'completed')
          await saveProgress(name, progress)
          console.log(chalk.green('✓ Tasks marcadas como concluídas'))
          console.log(chalk.yellow(`\nPróximo: adk feature plan ${name}`))
          return
        }

        if (phaseCheck.action === 'redo') {
          await fs.remove(tasksPath)
        }
      }

      spinner.start('Criando breakdown de tasks...')

      let progress = await loadProgress(name)
      progress = updateStepStatus(progress, 'tasks', 'in_progress')
      await saveProgress(name, progress)

      const inputFile = hasResearch ? 'research.md' : 'prd.md'

      let existingTasksContext = ''
      if (phaseCheck?.action === 'refine' && (await fs.pathExists(tasksPath))) {
        const existingContent = await fs.readFile(tasksPath, 'utf-8')
        const refineContext = phaseCheck.extraContext
          ? `\n\nContexto adicional do usuário: ${phaseCheck.extraContext}`
          : ''
        existingTasksContext = `
## Tasks Existentes (refinar/melhorar):

<existing-tasks>
${existingContent}
</existing-tasks>
${refineContext}
`
      }

      const prompt = `
PHASE: TASK BREAKDOWN

Feature: ${name}
Input: .claude/plans/features/${name}/${inputFile}
PRD: .claude/plans/features/${name}/prd.md
${existingTasksContext}
## Workflow

1. Leia o PRD e research completamente
2. Extraia requisitos funcionais
3. Quebre em tasks atomicas e testaveis
4. Ordene: testes ANTES de implementacao (TDD)
5. Identifique dependencias entre tasks

## Output: .claude/plans/features/${name}/tasks.md

Estrutura:
\`\`\`markdown
# Tasks: ${name}

## Task 1: [nome descritivo]
- Tipo: Test | Implementation | Config
- Prioridade: P0 | P1 | P2
- Dependencias: [lista ou "nenhuma"]
- Acceptance Criteria:
  - [ ] Criterio 1
  - [ ] Criterio 2

## Task 2: [nome descritivo]
...
\`\`\`

IMPORTANTE:
- Testes SEMPRE vem antes da implementacao correspondente
- Tasks devem ser atomicas (1-2 horas de trabalho max)
- Cada task deve ter criterios de aceitacao claros
`

      const tasksModel = getModelForPhase('planning', options.model as ModelType | undefined)
      await executeClaudeCommand(prompt, { model: tasksModel })

      spinner.succeed('Tasks criadas')

      progress = updateStepStatus(progress, 'tasks', 'completed')
      await saveProgress(name, progress)
      await this.syncProgressState(name, 'research', 'tasks', 'adk feature tasks')

      await this.setActiveFocus(name, 'tasks definidas')
      await memoryCommand.save(name, { phase: 'tasks' })

      console.log()
      logger.success(`Tasks salvas em: ${chalk.cyan(`${featurePath}/tasks.md`)}`)
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray(`  adk feature plan ${name}`))
    } catch (error) {
      spinner.fail('Erro ao criar tasks')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'tasks', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async implement(name: string, options: FeatureOptions): Promise<void> {
    const spinner = ora('Iniciando implementação...').start()

    try {
      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${name} não encontrada`)
        process.exit(1)
      }

      const planPath = path.join(featurePath, 'implementation-plan.md')
      if (!(await fs.pathExists(planPath))) {
        spinner.fail(`Execute planning primeiro: adk feature plan ${name}`)
        process.exit(1)
      }

      let progress = await loadProgress(name)

      if (isStepCompleted(progress, 'implementacao')) {
        spinner.stop()
        console.log()
        console.log(chalk.yellow('Implementação já foi concluída para esta feature.'))

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'O que deseja fazer?',
            choices: [
              { name: '🔄 Continuar implementando - Adicionar mais código', value: 'continue' },
              { name: '⏭️  Próxima - Ir para QA', value: 'next' },
            ],
          },
        ])

        if (action === 'next') {
          console.log(chalk.green('✓ Implementação mantida como concluída'))
          console.log(chalk.yellow(`\nPróximo: adk feature qa ${name}`))
          return
        }

        spinner.start('Continuando implementação...')
      }

      if (!this.isInWorktreeForFeature(name)) {
        spinner.stop()

        const baseBranch = options.baseBranch || (await this.getDefaultBranch())
        const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
        const mainRepo = this.getMainRepoPath()
        const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)

        const result = await this.setupWorktree(name, baseBranch)

        if (result.success && result.worktreePath) {
          const isCurrentDir = result.worktreePath === process.cwd()
          if (isCurrentDir) {
            console.log()
            console.log(chalk.green(`✓ Já está na branch da feature: feature/${featureSlug}`))
            console.log()
          } else {
            console.log()
            console.log(chalk.cyan('📂 Configuração de Worktree'))
            console.log(chalk.gray(`   Worktree: ${worktreeDir}`))
            console.log(chalk.gray(`   Branch: feature/${featureSlug}`))
            console.log(chalk.gray(`   Base: ${baseBranch}`))
            console.log()
            console.log(chalk.green(`✓ Worktree criado: ${result.worktreePath}`))
            console.log()
            console.log(chalk.yellow('Execute a implementação no worktree:'))
            console.log(chalk.white(`  cd ${result.worktreePath}`))
            console.log(chalk.white(`  adk feature implement ${name}`))
            console.log()
            return
          }
        } else {
          spinner.fail(`Erro ao criar worktree: ${result.error}`)
          process.exit(1)
        }
      }

      spinner.start('Iniciando implementação...')

      progress = updateStepStatus(progress, 'implementacao', 'in_progress')
      await saveProgress(name, progress)

      spinner.text = 'Validando spec...'
      const specValidation = await this.validateSpecGate(name, { skipSpec: options.skipSpec })
      if (!specValidation.valid) {
        spinner.fail('Spec inválida. Corrija antes de implementar.')
        progress = updateStepStatus(progress, 'implementacao', 'pending')
        await saveProgress(name, progress)
        process.exit(1)
      }

      spinner.text = 'Iniciando implementação...'

      let phase = options.phase || 'all'

      if (phase === 'all') {
        spinner.stop()
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'phase',
            message: 'Qual fase implementar?',
            choices: ['All', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'],
          },
        ])
        phase = answers.phase
        spinner.start('Executando implementação...')
      }

      const specSection = specValidation.specContent
        ? `
## Spec (Especificação Formal)

<spec>
${specValidation.specContent}
</spec>

IMPORTANTE: A implementação DEVE seguir a spec acima. Todos os acceptance criteria da spec devem ser cobertos pelos testes.
`
        : ''

      const checkpointPath = path.join(featurePath, '.task-checkpoint.md')
      let checkpointContext = ''

      if (await fs.pathExists(checkpointPath)) {
        const checkpointContent = await fs.readFile(checkpointPath, 'utf-8')
        checkpointContext = `
## 📌 CHECKPOINT DA ÚLTIMA SESSÃO

O contexto foi limpo. Leia o checkpoint abaixo para recuperar o estado:

<checkpoint>
${checkpointContent}
</checkpoint>

Use este checkpoint para entender:
- Qual task foi completada por último
- Qual é a próxima task pendente
- Progresso atual (X/Y tasks)

Após ler o checkpoint, continue do ponto correto.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
      }

      const prompt = `
PHASE 3: IMPLEMENTATION (TDD)

Feature: ${name}
Implementation Plan: .claude/plans/features/${name}/implementation-plan.md
Tasks: .claude/plans/features/${name}/tasks.md
Target Phase: ${phase}
${specSection}
${checkpointContext}
IMPORTANTE: TDD - TESTES PRIMEIRO

CRITICAL: TASK TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você DEVE atualizar tasks.md conforme progride. Isso é ESSENCIAL para continuidade.

ANTES de começar uma task:
  ./.claude/hooks/mark-task.sh ${name} "<task-pattern>" in_progress

APÓS completar uma task:
  ./.claude/hooks/mark-task.sh ${name} "<task-pattern>" completed

Exemplo:
  ./.claude/hooks/mark-task.sh ${name} "Task 1.1" in_progress
  # ... trabalha na task ...
  ./.claude/hooks/mark-task.sh ${name} "Task 1.1" completed

Use um pattern único da task (número, nome curto, etc). O script atualiza automaticamente.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Process:

1. CHECK TASKS & START
   - Leia tasks.md para ver quais tasks estão pendentes [ ]
   - Encontre a primeira task pendente (não [x] ou [~])
   - Marque como in_progress: ./.claude/hooks/mark-task.sh ${name} "<task-id>" in_progress

2. WRITE TESTS FIRST (TDD)
   - Escreva TODOS os testes da task atual
   - NÃO escreva implementação ainda
   - Execute e confirme que falham
   - Commit: 'test: add tests for <task-description>'

3. IMPLEMENT
   - Implemente código para testes passarem
   - Teste após cada mudança
   - Refatore se necessário
   - Commit incrementalmente

4. VERIFY & MARK COMPLETE
   - Todos testes passam?
   - Coverage >= 80%?
   - Lint clean?
   - Performance OK?
   - Marque como completed: ./.claude/hooks/mark-task.sh ${name} "<task-id>" completed

5. CREATE CHECKPOINT & PAUSE
   - Execute: ./.claude/hooks/create-checkpoint.sh ${name} "<task-id>" "<breve-descricao>"
   - O script criará automaticamente o checkpoint com:
     * Task completada
     * Arquivos modificados
     * Próxima task pendente
     * Progresso atual
   - Após executar create-checkpoint.sh, PARE IMEDIATAMENTE
   - Mostre a mensagem do script ao usuário
   - NÃO continue para próxima task - o usuário precisa limpar o contexto

IMPORTANTE:
- NÃO implemente tasks que já estão [x] ou [~] em tasks.md
- SEMPRE marque in_progress ANTES de começar
- SEMPRE marque completed APÓS terminar
- SEMPRE crie checkpoint APÓS completar uma task
- SEMPRE pause para permitir limpeza de contexto
- Se der Ctrl+C, a próxima sessão continuará da task [~]

⚠️ CRITICAL: Após completar UMA task, PARE para limpeza de contexto.
NÃO implemente múltiplas tasks na mesma sessão - o contexto fica sujo.

Não avance para próxima fase até todas as tasks estarem [x].
`

      spinner.text = 'Executando implementação com Claude Code...'
      const implModel = getModelForPhase('implement', options.model as ModelType | undefined)
      await executeClaudeCommand(prompt, { model: implModel })

      spinner.text = 'Verificando progresso das tasks...'
      const taskStatus = await this.checkTasksCompletion(name)

      if (taskStatus.allDone) {
        spinner.succeed('Implementação concluída - todas as tasks completas!')
        progress = updateStepStatus(progress, 'implementacao', 'completed')
        console.log(chalk.green(`✓ ${taskStatus.completed}/${taskStatus.total} tasks concluídas (100%)`))
      } else {
        spinner.succeed(`Sessão de implementação finalizada`)
        progress = updateStepStatus(progress, 'implementacao', 'in_progress')
        console.log(chalk.yellow(`⚠️  ${taskStatus.completed}/${taskStatus.total} tasks concluídas (${taskStatus.percentage}%)`))
        console.log(chalk.gray(`   Ainda restam ${taskStatus.total - taskStatus.completed} tasks pendentes`))
      }

      await saveProgress(name, progress)
      await this.syncProgressState(name, 'arquitetura', 'implementacao', 'adk feature implement')

      await this.setActiveFocus(name, taskStatus.allDone ? 'implementação concluída' : 'implementação em andamento')
      await memoryCommand.save(name, { phase: 'implement' })
      await this.syncFeatureToRemote(name, progress, options.noSync)

      console.log()
      if (taskStatus.allDone) {
        logger.success(`✨ ${phase} implementada!`)
        console.log()
        console.log(chalk.yellow('Próximo passo:'))
        console.log(chalk.gray(`  adk feature qa ${name}`))
      } else {
        console.log(chalk.cyan('Próximos passos:'))
        console.log(chalk.gray('  1. Revisar tasks.md e marcar as concluídas'))
        console.log(chalk.gray(`  2. Continuar: adk feature implement ${name}`))
        console.log(chalk.gray(`  3. Ou use: adk feature autopilot ${name}`))
      }
    } catch (error) {
      spinner.fail('Erro na implementação')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'implementacao', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async qa(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Executando revisão de qualidade...').start()

    try {
      if (!this.isInWorktreeForFeature(name)) {
        spinner.stop()

        const baseBranch = options.baseBranch || (await this.getDefaultBranch())
        const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
        const mainRepo = this.getMainRepoPath()
        const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)

        if (await fs.pathExists(worktreeDir)) {
          console.log()
          console.log(chalk.yellow('⚠️  QA deve ser executado no worktree da feature.'))
          console.log()
          console.log(chalk.white(`  cd ${worktreeDir}`))
          console.log(chalk.white(`  adk feature qa ${name}`))
          console.log()
          return
        }

        const result = await this.setupWorktree(name, baseBranch)

        if (result.success && result.worktreePath) {
          const isCurrentDir = result.worktreePath === process.cwd()
          if (isCurrentDir) {
            console.log()
            console.log(chalk.green(`✓ Já está na branch da feature: feature/${featureSlug}`))
            console.log()
          } else {
            console.log()
            console.log(chalk.cyan('📂 Configuração de Worktree'))
            console.log(chalk.gray(`   Worktree: ${worktreeDir}`))
            console.log(chalk.gray(`   Branch: feature/${featureSlug}`))
            console.log(chalk.gray(`   Base: ${baseBranch}`))
            console.log()
            console.log(chalk.green(`✓ Worktree criado: ${result.worktreePath}`))
            console.log()
            console.log(chalk.yellow('Execute o QA no worktree:'))
            console.log(chalk.white(`  cd ${result.worktreePath}`))
            console.log(chalk.white(`  adk feature qa ${name}`))
            console.log()
            return
          }
        } else {
          spinner.fail(`Erro ao criar worktree: ${result.error}`)
          process.exit(1)
        }
      }

      spinner.start('Executando revisão de qualidade...')

      const featurePath = this.getFeaturePath(name)
      const qaReportPath = path.join(featurePath, 'qa-report.md')

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${name} não encontrada`)
        process.exit(1)
      }

      const planPath = path.join(featurePath, 'implementation-plan.md')
      if (!(await fs.pathExists(planPath))) {
        spinner.fail(`Execute implement primeiro: adk feature implement ${name}`)
        process.exit(1)
      }

      spinner.stop()

      const phaseCheck = await this.checkPhaseExists(
        'qa',
        'QA Report',
        qaReportPath,
        'Documentação'
      )

      if (phaseCheck) {
        if (phaseCheck.action === 'next') {
          let progress = await loadProgress(name)
          progress = updateStepStatus(progress, 'qa', 'completed')
          await saveProgress(name, progress)
          console.log(chalk.green('✓ QA marcado como concluído'))
          console.log(chalk.yellow(`\nPróximo: adk feature docs ${name}`))
          return
        }

        if (phaseCheck.action === 'redo') {
          await fs.remove(qaReportPath)
        }
      }

      spinner.start('Executando revisão de qualidade...')

      let progress = await loadProgress(name)
      progress = updateStepStatus(progress, 'qa', 'in_progress')
      await saveProgress(name, progress)

      let existingQaContext = ''
      if (phaseCheck?.action === 'refine' && (await fs.pathExists(qaReportPath))) {
        const existingContent = await fs.readFile(qaReportPath, 'utf-8')
        const refineContext = phaseCheck.extraContext
          ? `\n\nContexto adicional do usuário: ${phaseCheck.extraContext}`
          : ''
        existingQaContext = `
## QA Report Existente (refinar/melhorar):

<existing-qa>
${existingContent}
</existing-qa>
${refineContext}
`
      }

      const prompt = `
PHASE: QA - REVISAO DE QUALIDADE

Feature: ${name}
Plan: .claude/plans/features/${name}/implementation-plan.md
${existingQaContext}
## Checklist de Revisao

### Qualidade de Codigo
- [ ] Codigo legivel e bem estruturado?
- [ ] Sem codigo duplicado?
- [ ] Tratamento de erros adequado?
- [ ] Nomes descritivos para variaveis e funcoes?

### Testes
- [ ] Coverage >= 80%?
- [ ] Happy path testado?
- [ ] Edge cases cobertos?
- [ ] Erros testados?
- [ ] Testes sao independentes?

### Seguranca
- [ ] Input validado?
- [ ] Sem SQL injection?
- [ ] Sem XSS?
- [ ] Secrets nao expostos?
- [ ] Autenticacao/autorizacao OK?

### Performance
- [ ] Sem loops desnecessarios?
- [ ] Queries otimizadas?
- [ ] Sem memory leaks obvios?
- [ ] Lazy loading onde apropriado?

## Output: .claude/plans/features/${name}/qa-report.md

Estrutura do report:
\`\`\`markdown
# QA Report: ${name}

## Summary
- Status: PASS | FAIL
- Issues encontradas: N
- Coverage: X%

## Issues

### [CRITICAL|HIGH|MEDIUM|LOW] Issue 1
- Arquivo: path/to/file.ts:linha
- Descricao: ...
- Sugestao de fix: ...

## Checklist Results
[Checklist preenchido]

## Recomendacoes
[Lista de melhorias sugeridas]
\`\`\`

Se encontrar issues CRITICAL ou HIGH, o status deve ser FAIL.
`

      const qaModel = getModelForPhase('qa', options.model as ModelType | undefined)
      await executeClaudeCommand(prompt, { model: qaModel })

      spinner.succeed('QA concluído')

      progress = updateStepStatus(progress, 'qa', 'completed')
      await saveProgress(name, progress)
      await this.syncProgressState(name, 'implementacao', 'qa', 'adk feature qa')

      await this.setActiveFocus(name, 'qa concluído')
      await memoryCommand.save(name, { phase: 'qa' })

      console.log()
      logger.success(`QA Report salvo em: ${chalk.cyan(`${featurePath}/qa-report.md`)}`)
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray(`  adk feature docs ${name}`))
    } catch (error) {
      spinner.fail('Erro no QA')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'qa', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async docs(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Gerando documentação...').start()

    try {
      if (!this.isInWorktreeForFeature(name)) {
        spinner.stop()

        const baseBranch = options.baseBranch || (await this.getDefaultBranch())
        const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
        const mainRepo = this.getMainRepoPath()
        const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)

        if (await fs.pathExists(worktreeDir)) {
          console.log()
          console.log(chalk.yellow('⚠️  Docs deve ser executado no worktree da feature.'))
          console.log()
          console.log(chalk.white(`  cd ${worktreeDir}`))
          console.log(chalk.white(`  adk feature docs ${name}`))
          console.log()
          return
        }

        const result = await this.setupWorktree(name, baseBranch)

        if (result.success && result.worktreePath) {
          const isCurrentDir = result.worktreePath === process.cwd()
          if (isCurrentDir) {
            console.log()
            console.log(chalk.green(`✓ Já está na branch da feature: feature/${featureSlug}`))
            console.log()
          } else {
            console.log()
            console.log(chalk.cyan('📂 Configuração de Worktree'))
            console.log(chalk.gray(`   Worktree: ${worktreeDir}`))
            console.log(chalk.gray(`   Branch: feature/${featureSlug}`))
            console.log(chalk.gray(`   Base: ${baseBranch}`))
            console.log()
            console.log(chalk.green(`✓ Worktree criado: ${result.worktreePath}`))
            console.log()
            console.log(chalk.yellow('Execute docs no worktree:'))
            console.log(chalk.white(`  cd ${result.worktreePath}`))
            console.log(chalk.white(`  adk feature docs ${name}`))
            console.log()
            return
          }
        } else {
          spinner.fail(`Erro ao criar worktree: ${result.error}`)
          process.exit(1)
        }
      }

      spinner.start('Gerando documentação...')

      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${name} não encontrada`)
        process.exit(1)
      }

      let progress = await loadProgress(name)

      if (isStepCompleted(progress, 'docs')) {
        spinner.stop()
        console.log()
        console.log(chalk.yellow('Documentação já foi concluída para esta feature.'))

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'O que deseja fazer?',
            choices: [
              { name: '🔄 Atualizar - Melhorar documentação existente', value: 'update' },
              { name: '✅ Finalizar - Feature completa', value: 'done' },
            ],
          },
        ])

        if (action === 'done') {
          console.log(chalk.green('✓ Documentação mantida como concluída'))
          console.log(chalk.bold.green('\n✨ Feature completa!'))
          return
        }

        spinner.start('Atualizando documentação...')
      }

      progress = updateStepStatus(progress, 'docs', 'in_progress')
      await saveProgress(name, progress)

      const prompt = `
PHASE: DOCUMENTACAO

Feature: ${name}
PRD: .claude/plans/features/${name}/prd.md
Plan: .claude/plans/features/${name}/implementation-plan.md

## Gere documentacao para:

### 1. README da feature (se aplicavel)
- O que faz
- Como usar
- Exemplos de uso
- Configuracao necessaria

### 2. Atualize documentacao existente
- Se modificou APIs, atualize docs de API
- Se adicionou comandos, documente
- Se mudou configuracao, atualize

### 3. Comentarios no codigo (minimos)
- Apenas onde logica nao e obvia
- JSDoc para funcoes publicas importantes
- Explicacao de algoritmos complexos

## Principios

- Documentacao clara e util
- Exemplos que funcionam
- NAO documente codigo obvio
- Mantenha docs atualizadas com codigo

## Output

- Atualize arquivos de documentacao relevantes
- Adicione JSDoc onde necessario
- NAO crie documentacao desnecessaria
`

      const docsModel = getModelForPhase('docs', options.model as ModelType | undefined)
      await executeClaudeCommand(prompt, { model: docsModel })

      spinner.succeed('Documentação gerada')

      progress = updateStepStatus(progress, 'docs', 'completed')
      await saveProgress(name, progress)
      await this.syncProgressState(name, 'qa', 'docs', 'adk feature docs')

      await this.setActiveFocus(name, 'documentação concluída')
      await memoryCommand.save(name, { phase: 'docs' })

      console.log()
      logger.success('✨ Feature completa!')
      console.log()
      console.log(chalk.cyan('Próximos passos sugeridos:'))
      console.log(chalk.gray('  1. Revise as mudanças: git diff'))
      console.log(chalk.gray('  2. Commit: git add . && git commit'))
      console.log(chalk.gray('  3. Push e PR: git push && gh pr create'))
    } catch (error) {
      spinner.fail('Erro na documentação')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'docs', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async finish(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Finalizando feature...').start()

    try {
      const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
      const mainRepo = this.getMainRepoPath()
      const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)
      const isInWorktree = this.isInWorktreeForFeature(name)
      const hasWorktree = await fs.pathExists(worktreeDir)

      let progress = await loadProgress(name)
      progress = updateStepStatus(progress, 'finish', 'in_progress')
      await saveProgress(name, progress)

      const workDir = isInWorktree ? process.cwd() : hasWorktree ? worktreeDir : mainRepo
      const useWorktree = isInWorktree || hasWorktree

      spinner.text = 'Verificando mudanças...'
      let hasChanges = false
      try {
        const status = execFileSync('git', ['status', '--porcelain'], {
          encoding: 'utf-8',
          cwd: workDir,
        }).trim()
        hasChanges = status.length > 0
      } catch {
        hasChanges = false
      }

      if (hasChanges) {
        spinner.text = 'Commitando mudanças...'
        try {
          execFileSync('git', ['add', '.'], { cwd: workDir, stdio: 'pipe' })
          execFileSync('git', ['commit', '-m', `feat(${name}): complete feature implementation`], {
            cwd: workDir,
            stdio: 'pipe',
          })
        } catch {
          // Commit may fail if nothing to commit
        }
      }

      const baseBranch = options.baseBranch || (await this.getDefaultBranch())
      const featureBranch = `feature/${featureSlug}`

      if (this.hasRemote()) {
        spinner.text = 'Enviando para remoto...'
        try {
          execFileSync('git', ['push', '-u', 'origin', featureBranch], {
            cwd: workDir,
            stdio: 'pipe',
          })
        } catch {
          // Push may fail if already pushed or no remote
        }

        spinner.text = 'Criando Pull Request...'
        try {
          const prTitle = `feat(${name}): feature implementation`
          const prBody = `## Summary
- Feature: ${name}
- Implements all planned functionality

## Test Plan
- All tests passing
- QA validation completed
- Documentation updated`

          execFileSync(
            'gh',
            ['pr', 'create', '--title', prTitle, '--body', prBody, '--base', baseBranch],
            { cwd: workDir, stdio: 'pipe' }
          )
          spinner.succeed('Pull Request criado')
        } catch {
          spinner.warn('PR já existe ou gh CLI não disponível')
        }
      } else {
        spinner.info('Merge local requer ação manual (para não alterar branch do repo principal)')
        console.log()
        console.log(chalk.cyan('Para fazer merge, execute no repo principal:'))
        console.log(chalk.gray(`  cd ${mainRepo}`))
        console.log(chalk.gray(`  git merge ${featureBranch}`))
        console.log()
        console.log(chalk.dim('Ou crie um PR com: adk feature finish --pr'))
      }

      if (useWorktree && (await fs.pathExists(worktreeDir))) {
        const { cleanup } = await inquirer.prompt<{ cleanup: boolean }>([
          {
            type: 'confirm',
            name: 'cleanup',
            message: 'Limpar worktree?',
            default: true,
          },
        ])

        if (cleanup) {
          spinner.start('Limpando worktree...')
          try {
            execFileSync('git', ['worktree', 'remove', worktreeDir, '--force'], {
              cwd: mainRepo,
              stdio: 'pipe',
            })
            spinner.succeed('Worktree removida')
          } catch {
            spinner.warn('Não foi possível remover worktree automaticamente')
            console.log(chalk.gray(`  Execute: git worktree remove ${worktreeDir} --force`))
          }
        }
      }

      progress = updateStepStatus(progress, 'finish', 'completed')
      await saveProgress(name, progress)
      await this.syncProgressState(name, 'docs', 'finish', 'adk feature finish')

      await this.setActiveFocus(name, 'finalizada')
      await memoryCommand.save(name, { phase: 'finish' })

      console.log()
      logger.success('🎉 Feature finalizada com sucesso!')
      console.log()
      console.log(chalk.cyan('Resumo:'))
      console.log(chalk.gray(`  Feature: ${name}`))
      console.log(chalk.gray(`  Branch: ${featureBranch}`))
      if (this.hasRemote()) {
        console.log(chalk.gray('  Status: PR criado'))
      } else {
        console.log(chalk.gray(`  Status: Merged em ${baseBranch}`))
      }
    } catch (error) {
      spinner.fail('Erro ao finalizar feature')
      try {
        const progress = await loadProgress(name)
        updateStepStatus(progress, 'finish', 'failed', String(error))
        await saveProgress(name, progress)
      } catch {
        // Ignore
      }
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async list(): Promise<void> {
    try {
      const featuresPath = path.join(this.getClaudePath(), 'plans/features')

      if (!(await fs.pathExists(featuresPath))) {
        logger.warn('Nenhuma feature encontrada')
        return
      }

      const features = await fs.readdir(featuresPath)

      if (features.length === 0) {
        logger.warn('Nenhuma feature encontrada')
        return
      }

      console.log()
      console.log(chalk.bold.cyan('Features do Projeto:'))
      console.log()

      for (const feature of features) {
        const featurePath = path.join(featuresPath, feature)
        const stats = await fs.stat(featurePath)

        if (stats.isDirectory()) {
          let progress = await loadProgress(feature)

          const prdPath = path.join(featurePath, 'prd.md')
          const tasksPath = path.join(featurePath, 'tasks.md')
          const planPath = path.join(featurePath, 'implementation-plan.md')
          const memoryPath = path.join(featurePath, 'memory.md')
          const progressPath = path.join(featurePath, 'progress.md')

          const hasPrd = await fs.pathExists(prdPath)
          const hasTasks = await fs.pathExists(tasksPath)
          const hasPlan = await fs.pathExists(planPath)
          const hasMemory = await fs.pathExists(memoryPath)
          const hasProgressFile = await fs.pathExists(progressPath)

          const researchPath = path.join(featurePath, 'research.md')
          const qaReportPath = path.join(featurePath, 'qa-report.md')
          const hasResearch = await fs.pathExists(researchPath)
          const hasQaReport = await fs.pathExists(qaReportPath)

          if (!hasProgressFile) {
            if (hasPrd) {
              progress = updateStepStatus(progress, 'prd', 'completed')
            }
            if (hasResearch) {
              progress = updateStepStatus(progress, 'research', 'completed')
            }
            if (hasTasks) {
              progress = updateStepStatus(progress, 'tasks', 'completed')
            }
            if (hasPlan) {
              progress = updateStepStatus(progress, 'arquitetura', 'completed')
            }
            if (hasMemory) {
              const memContent = await fs.readFile(memoryPath, 'utf-8')
              if (memContent.includes('**Status**: completed')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
                progress = updateStepStatus(progress, 'qa', 'completed')
                progress = updateStepStatus(progress, 'docs', 'completed')
              } else if (memContent.includes('**Fase Atual**: implement')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
              } else if (memContent.includes('**Fase Atual**: qa')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
                progress = updateStepStatus(progress, 'qa', 'in_progress')
              } else if (memContent.includes('**Fase Atual**: docs')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
                progress = updateStepStatus(progress, 'qa', 'completed')
                progress = updateStepStatus(progress, 'docs', 'in_progress')
              }
            }
            if (hasQaReport) {
              progress = updateStepStatus(progress, 'qa', 'completed')
            }
          }

          const completedSteps = progress.steps.filter((s) => s.status === 'completed').length
          const totalSteps = progress.steps.length
          const progressPercent =
            totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

          let statusIcon = '○'
          let statusColor = chalk.gray
          if (progressPercent === 100) {
            statusIcon = '●'
            statusColor = chalk.green
          } else if (progressPercent > 0) {
            statusIcon = '◐'
            statusColor = chalk.yellow
          }

          console.log(statusColor(`  ${statusIcon} ${feature}`))

          const getStepIcon = (stepName: string): string => {
            const step = progress.steps.find((s) => s.name === stepName)
            if (!step) {
              return '  '
            }
            switch (step.status) {
              case 'completed':
                return chalk.green('✓')
              case 'in_progress':
                return chalk.yellow('~')
              case 'failed':
                return chalk.red('✗')
              default:
                return chalk.gray('○')
            }
          }

          const stepLabels: Record<string, string> = {
            prd: 'PRD',
            research: 'Research',
            tasks: 'Tasks',
            arquitetura: 'Arquitetura',
            implementacao: 'Impl',
            qa: 'QA',
            docs: 'Docs',
          }

          const stepsLine = progress.steps
            .map((s) => `${getStepIcon(s.name)} ${stepLabels[s.name] || s.name}`)
            .join('  ')

          console.log(chalk.gray(`    ${stepsLine}`))

          const artifacts: string[] = []
          if (hasPrd) {
            artifacts.push('prd')
          }
          if (hasTasks) {
            artifacts.push('tasks')
          }
          if (hasPlan) {
            artifacts.push('plan')
          }
          if (hasMemory) {
            artifacts.push('memory')
          }

          if (artifacts.length > 0) {
            console.log(chalk.gray(`    Arquivos: ${artifacts.join(', ')}`))
          }

          console.log()
        }
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async fixWorktrees(): Promise<void> {
    const spinner = ora('Corrigindo symlinks das worktrees...').start()

    try {
      const mainRepo = this.getMainRepoPath()
      const { fixWorktreeSymlinks } = await import('../utils/worktree-utils')
      const { fixed, errors } = await fixWorktreeSymlinks(mainRepo)

      if (errors.length > 0) {
        spinner.warn(`${fixed} worktrees corrigidas, ${errors.length} erros`)
        for (const err of errors) {
          console.log(chalk.red(`  ✗ ${err}`))
        }
      } else if (fixed === 0) {
        spinner.info('Nenhuma worktree encontrada para corrigir')
      } else {
        spinner.succeed(`${fixed} worktrees corrigidas com sucesso`)
      }

      console.log()
      console.log(chalk.gray('Os symlinks .claude agora apontam para o repositório principal.'))
      console.log(chalk.gray('Mudanças em .claude/ serão refletidas em todas as worktrees.'))
    } catch (error) {
      spinner.fail('Erro ao corrigir worktrees')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async getLatestSnapshot(name: string): Promise<{
    inProgressTask?: string
    nextTask?: string
    timestamp?: string
  } | null> {
    const featurePath = this.getFeaturePath(name)
    const snapshotDir = path.join(featurePath, '.snapshots')

    if (!(await fs.pathExists(snapshotDir))) {
      return null
    }

    const files = await fs.readdir(snapshotDir)
    const snapshots = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()

    if (snapshots.length === 0) {
      return null
    }

    const latestSnapshot = path.join(snapshotDir, snapshots[0])
    const content = await fs.readJSON(latestSnapshot)

    return {
      inProgressTask: content.tasks?.inProgressTask,
      nextTask: content.tasks?.nextTask,
      timestamp: content.timestamp
    }
  }

  private async checkTasksCompletion(name: string): Promise<{
    completed: number
    total: number
    percentage: number
    allDone: boolean
  }> {
    const featurePath = this.getFeaturePath(name)
    const tasksPath = path.join(featurePath, 'tasks.md')

    if (!(await fs.pathExists(tasksPath))) {
      return { completed: 0, total: 0, percentage: 0, allDone: false }
    }

    const content = await fs.readFile(tasksPath, 'utf-8')
    const lines = content.split('\n')

    let completed = 0
    let total = 0

    for (const line of lines) {
      if (/^\s*- \[x\]/i.test(line)) {
        completed++
        total++
      } else if (/^\s*- \[ \]/i.test(line)) {
        total++
      } else if (/^\s*- \[~\]/i.test(line)) {
        total++
      } else if (/^\s*- \[!\]/i.test(line)) {
        total++
      }
    }

    const percentage = total > 0 ? Math.floor((completed * 100) / total) : 0
    const allDone = total > 0 && completed === total

    return { completed, total, percentage, allDone }
  }

  async autopilot(name: string, options: FeatureOptions = {}): Promise<void> {
    console.log()
    console.log(chalk.bold.magenta('🚀 ADK Autopilot (Subprocess Mode)'))
    console.log(chalk.gray('━'.repeat(50)))
    console.log(chalk.gray('Cada etapa roda em uma sessão separada do Claude'))
    console.log()

    const state = await this.getFeatureState(name)

    if (state.exists) {
      const shouldResume = await this.askToResume(name, state)
      if (!shouldResume) {
        logger.info('Operação cancelada.')
        return
      }

      const snapshot = await this.getLatestSnapshot(name)
      if (snapshot?.inProgressTask) {
        console.log(chalk.cyan('📌 Última sessão estava trabalhando em:'))
        console.log(chalk.yellow(`   ${snapshot.inProgressTask}`))
        console.log()

        const taskStatus = await this.checkTasksCompletion(name)
        if (!taskStatus.allDone) {
          console.log(chalk.yellow(`⚠️  ${taskStatus.completed}/${taskStatus.total} tasks concluídas (${taskStatus.percentage}%)`))
          console.log(chalk.gray(`   ${taskStatus.total - taskStatus.completed} tasks ainda pendentes\n`))
        }
      }
    }

    await this.setActiveFocus(name, state.currentStage)

    const featurePath = state.featurePath
    const prdPath = path.join(featurePath, 'prd.md')
    const planPath = path.join(featurePath, 'implementation-plan.md')

    await fs.ensureDir(featurePath)

    let progress = await loadProgress(name)

    if (state.hasPrd && !isStepCompleted(progress, 'prd')) {
      progress = updateStepStatus(progress, 'prd', 'completed')
    }
    if (state.hasResearch && !isStepCompleted(progress, 'research')) {
      progress = updateStepStatus(progress, 'research', 'completed')
    }
    if (state.hasTasks && !isStepCompleted(progress, 'tasks')) {
      progress = updateStepStatus(progress, 'tasks', 'completed')
    }
    if (state.hasPlan && !isStepCompleted(progress, 'arquitetura')) {
      progress = updateStepStatus(progress, 'arquitetura', 'completed')
    }

    const stepLabels: Record<string, string> = {
      prd: 'PRD',
      research: 'Research',
      tasks: 'Tasks',
      arquitetura: 'Arquitetura',
      implementacao: 'Implementação',
      qa: 'QA',
      docs: 'Documentação',
    }

    const inProgressSteps = progress.steps.filter((s) => s.status === 'in_progress')
    const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
    const mainRepo = this.getMainRepoPath()
    const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)
    const worktreeExists = await fs.pathExists(worktreeDir)

    for (const step of inProgressSteps) {
      const label = stepLabels[step.name] || step.name
      const isWorktreeStep = ['implementacao', 'qa', 'docs'].includes(step.name)

      if (isWorktreeStep && worktreeExists) {
        console.log(chalk.yellow(`\n⚠️  A etapa "${label}" estava em andamento na worktree.\n`))
        console.log(chalk.cyan(`   Worktree: ${worktreeDir}`))
        console.log(chalk.cyan(`   Branch: feature/${featureSlug}\n`))

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: `O que deseja fazer?`,
            choices: [
              { name: '▶️  Continuar na worktree existente', value: 'continue_worktree' },
              { name: '✅ Já foi concluída - marcar como completa', value: 'complete' },
              { name: '🔄 Recomeçar do zero', value: 'redo' },
              { name: '⏭️  Pular esta etapa', value: 'skip' },
            ],
          },
        ])

        if (action === 'continue_worktree') {
          console.log(chalk.green(`\n✓ Continuando na worktree existente...`))
        } else if (action === 'complete') {
          progress = updateStepStatus(progress, step.name, 'completed')
        } else if (action === 'redo') {
          progress = updateStepStatus(progress, step.name, 'pending')
        } else if (action === 'skip') {
          progress = updateStepStatus(progress, step.name, 'completed')
          const stepIndex = progress.steps.findIndex((s) => s.name === step.name)
          if (stepIndex >= 0) {
            progress.steps[stepIndex].notes = 'skipped'
          }
        }
      } else {
        console.log(
          chalk.yellow(
            `\n⚠️  A etapa "${label}" estava em andamento quando a sessão anterior foi interrompida.\n`
          )
        )

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: `O que deseja fazer com a etapa "${label}"?`,
            choices: [
              { name: '✅ Já foi concluída - marcar como completa', value: 'complete' },
              { name: '🔄 Precisa ser refeita - executar novamente', value: 'redo' },
              { name: '⏭️  Pular esta etapa', value: 'skip' },
            ],
          },
        ])

        if (action === 'complete') {
          progress = updateStepStatus(progress, step.name, 'completed')
        } else if (action === 'redo') {
          progress = updateStepStatus(progress, step.name, 'pending')
        } else if (action === 'skip') {
          progress = updateStepStatus(progress, step.name, 'completed')
          const stepIndex = progress.steps.findIndex((s) => s.name === step.name)
          if (stepIndex >= 0) {
            progress.steps[stepIndex].notes = 'skipped'
          }
        }
      }
    }

    await saveProgress(name, progress)

    const getStatusIcon = (prog: FeatureProgress, stepName: string): string => {
      const step = prog.steps.find((s) => s.name === stepName)
      if (!step) {
        return '⏳'
      }
      switch (step.status) {
        case 'completed':
          return '✅'
        case 'in_progress':
          return '🔄'
        case 'failed':
          return '❌'
        default:
          return '⏳'
      }
    }

    const printProgress = (prog: FeatureProgress) => {
      console.log(chalk.gray('\n📋 Progresso:'))
      const stepNames = [
        { key: 'prd', label: 'PRD' },
        { key: 'research', label: 'Research' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'arquitetura', label: 'Arquitetura' },
        { key: 'implementacao', label: 'Implementação' },
        { key: 'qa', label: 'QA' },
        { key: 'docs', label: 'Documentação' },
      ]
      for (const { key, label } of stepNames) {
        console.log(`   ${getStatusIcon(prog, key)} ${label}`)
      }
      console.log()
    }

    const executePhase = async (
      args: string[],
      stepName: string,
      etapaNum: number,
      etapaLabel: string,
      cwd?: string
    ): Promise<boolean> => {
      console.log(chalk.bold.cyan(`\n═══════════════════════════════════════════════════`))
      console.log(chalk.bold.cyan(`  ETAPA ${etapaNum}: ${etapaLabel}`))
      console.log(chalk.bold.cyan(`═══════════════════════════════════════════════════\n`))

      if (cwd) {
        console.log(chalk.gray(`Worktree: ${cwd}`))
      }
      console.log(chalk.gray(`Executando: adk ${args.join(' ')}\n`))

      let success = false
      let attempts = 0
      const maxAttempts = 3

      const execOptions: { stdio: 'inherit'; cwd?: string } = { stdio: 'inherit' }
      if (cwd) {
        execOptions.cwd = cwd
      }

      while (!success && attempts < maxAttempts) {
        try {
          execFileSync('adk', args, execOptions)
          success = true
        } catch {
          attempts++
          console.log()
          console.log(chalk.red(`❌ Erro na etapa ${etapaLabel}`))

          if (attempts >= maxAttempts) {
            console.log(chalk.red(`Máximo de tentativas (${maxAttempts}) atingido.`))
          }

          const { errorAction } = await inquirer.prompt([
            {
              type: 'list',
              name: 'errorAction',
              message: 'O que deseja fazer?',
              choices: [
                { name: '🔄 Tentar novamente', value: 'retry' },
                { name: '⏭️  Pular esta etapa', value: 'skip' },
                { name: '🛑 Abortar autopilot', value: 'abort' },
              ],
            },
          ])

          if (errorAction === 'retry') {
            console.log(chalk.yellow(`\nTentativa ${attempts + 1}/${maxAttempts}...`))
          } else if (errorAction === 'skip') {
            let prog = await loadProgress(name)
            prog = updateStepStatus(prog, stepName, 'completed')
            const stepIndex = prog.steps.findIndex((s) => s.name === stepName)
            if (stepIndex >= 0) {
              prog.steps[stepIndex].notes = 'skipped'
            }
            await saveProgress(name, prog)
            return true
          } else {
            printProgress(await loadProgress(name))
            console.log(chalk.yellow('\nAutopilot abortado. Continue com:'))
            console.log(chalk.gray(`  adk feature autopilot ${name}`))
            process.exit(1)
          }
        }
      }

      return success
    }

    try {
      printProgress(progress)

      if (!isStepCompleted(progress, 'prd')) {
        if (!(await fs.pathExists(prdPath))) {
          await this.create(name, options)
        }

        progress = await loadProgress(name)
        progress = updateStepStatus(progress, 'prd', 'completed')
        await saveProgress(name, progress)

        const { continueFlow } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueFlow',
            message: 'PRD criado. Revisar e continuar para research?',
            default: true,
          },
        ])

        if (!continueFlow) {
          console.log(chalk.yellow('\nAutopilot pausado. Continue com:'))
          console.log(chalk.gray(`  adk feature autopilot ${name}`))
          return
        }
      } else {
        console.log(chalk.green('✓ PRD já existe, pulando etapa 1'))
      }

      progress = await loadProgress(name)
      const researchPath = path.join(featurePath, 'research.md')
      const researchExists = await fs.pathExists(researchPath)

      if (!isStepCompleted(progress, 'research') && !researchExists) {
        await executePhase(
          ['feature', 'research', name],
          'research',
          2,
          'RESEARCH - ANÁLISE DO CODEBASE'
        )
      } else {
        console.log(chalk.green('✓ Research já existe, pulando etapa 2'))
        if (!isStepCompleted(progress, 'research')) {
          progress = updateStepStatus(progress, 'research', 'completed')
          await saveProgress(name, progress)
        }
      }

      progress = await loadProgress(name)
      const tasksPath = path.join(featurePath, 'tasks.md')
      const tasksExists = await fs.pathExists(tasksPath)

      if (!isStepCompleted(progress, 'tasks') && !tasksExists) {
        await executePhase(['feature', 'tasks', name], 'tasks', 3, 'BREAKDOWN EM TASKS')
      } else {
        console.log(chalk.green('✓ Tasks já existem, pulando etapa 3'))
        if (!isStepCompleted(progress, 'tasks')) {
          progress = updateStepStatus(progress, 'tasks', 'completed')
          await saveProgress(name, progress)
        }
      }

      progress = await loadProgress(name)
      const planExists = await fs.pathExists(planPath)

      if (!isStepCompleted(progress, 'arquitetura') && !planExists) {
        await executePhase(['feature', 'plan', name], 'arquitetura', 4, 'ARQUITETURA')
      } else {
        console.log(chalk.green('✓ Arquitetura já existe, pulando etapa 4'))
        if (!isStepCompleted(progress, 'arquitetura')) {
          progress = updateStepStatus(progress, 'arquitetura', 'completed')
          await saveProgress(name, progress)
        }
      }

      if (await fs.pathExists(planPath)) {
        console.log(chalk.green('\n📐 Arquitetura gerada!'))
        console.log(
          chalk.gray(`   Veja em: .claude/plans/features/${name}/implementation-plan.md\n`)
        )
      }

      progress = await loadProgress(name)
      const implementDone = isStepCompleted(progress, 'implementacao')
      const qaDone = isStepCompleted(progress, 'qa')
      const docsDone = isStepCompleted(progress, 'docs')

      const taskStatus = await this.checkTasksCompletion(name)
      const implementReallyDone = implementDone && taskStatus.allDone

      if (implementReallyDone && qaDone && docsDone) {
        console.log(chalk.green('✓ Implementação já concluída, pulando etapa 5'))
        console.log(chalk.green('✓ QA já concluído, pulando etapa 6'))
        console.log(chalk.green('✓ Documentação já concluída, pulando etapa 7'))
      } else {
        const pendingSteps: string[] = []
        if (!implementReallyDone) {
          if (!taskStatus.allDone) {
            pendingSteps.push(`Implementação (${taskStatus.completed}/${taskStatus.total} tasks)`)
          } else {
            pendingSteps.push('Implementação')
          }
        }
        if (!qaDone && implementReallyDone) {
          pendingSteps.push('QA')
        }
        if (!docsDone && qaDone) {
          pendingSteps.push('Documentação')
        }

        const { continueImplement } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueImplement',
            message: `Continuar com: ${pendingSteps.join(' → ')}?`,
            default: true,
          },
        ])

        if (!continueImplement) {
          printProgress(await loadProgress(name))
          console.log(chalk.yellow('\nAutopilot pausado. Continue manualmente com:'))
          if (!implementReallyDone) {
            console.log(chalk.gray(`  adk feature implement ${name}`))
            if (!taskStatus.allDone) {
              console.log()
              console.log(chalk.cyan('📋 Progresso das tasks:'))
              console.log(chalk.gray(`   ${taskStatus.completed}/${taskStatus.total} concluídas (${taskStatus.percentage}%)`))
            }
          } else if (!qaDone) {
            console.log(chalk.gray(`  adk feature qa ${name}`))
          } else {
            console.log(chalk.gray(`  adk feature docs ${name}`))
          }
          return
        }

        let worktreePath: string | undefined
        let worktreeBranch: string | undefined
        const baseBranch = options.baseBranch || (await this.getDefaultBranch())
        const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')

        if (this.isInWorktreeForFeature(name)) {
          worktreePath = process.cwd()
          worktreeBranch = `feature/${featureSlug}`
          console.log(chalk.green(`✓ Já está no worktree da feature: ${worktreePath}`))
          console.log()
        } else {
          console.log()
          console.log(chalk.cyan('📂 Configurando Worktree'))
          console.log(chalk.gray('━'.repeat(50)))

          const result = await this.setupWorktree(name, baseBranch)

          if (result.success && result.worktreePath) {
            worktreePath = result.worktreePath
            worktreeBranch = result.branch

            const isCurrentDir = result.worktreePath === process.cwd()
            if (isCurrentDir) {
              console.log(chalk.green(`✓ Já está na branch da feature: ${worktreeBranch}`))
              console.log(chalk.gray(`  Diretório: ${worktreePath}`))
              console.log()
              console.log(chalk.yellow('Continuando no diretório atual.'))
            } else {
              console.log(chalk.green(`✓ Worktree criado: ${worktreePath}`))
              console.log(chalk.gray(`  Branch: ${worktreeBranch}`))
              console.log(chalk.gray(`  Base: ${baseBranch}`))
              console.log()
              console.log(chalk.yellow('As próximas etapas serão executadas no worktree.'))
              console.log(
                chalk.yellow('Múltiplos agentes podem trabalhar em paralelo em worktrees diferentes.')
              )
            }
          } else {
            console.log(chalk.red(`Erro ao criar worktree: ${result.error}`))
            console.log(
              chalk.yellow('Não é possível continuar sem worktree para garantir isolamento.')
            )
            process.exit(1)
          }
          console.log()
        }

        if (!implementReallyDone) {
          const implementArgs = ['feature', 'implement', name, '--phase', 'All']
          await executePhase(implementArgs, 'implementacao', 5, 'IMPLEMENTAÇÃO (TDD)', worktreePath)

          progress = await loadProgress(name)
          const updatedTaskStatus = await this.checkTasksCompletion(name)

          if (!updatedTaskStatus.allDone) {
            console.log()
            console.log(chalk.yellow('━'.repeat(50)))
            console.log(chalk.yellow('⚠️  IMPLEMENTAÇÃO INCOMPLETA'))
            console.log(chalk.yellow('━'.repeat(50)))
            console.log()
            console.log(chalk.white(`   ${updatedTaskStatus.completed}/${updatedTaskStatus.total} tasks concluídas (${updatedTaskStatus.percentage}%)`))
            console.log(chalk.gray(`   Restam ${updatedTaskStatus.total - updatedTaskStatus.completed} tasks pendentes em tasks.md`))
            console.log()
            console.log(chalk.cyan('📝 Para continuar implementando:'))
            console.log(chalk.gray(`   adk feature autopilot ${name}`))
            console.log()
            console.log(chalk.cyan('📋 Ou marque tasks manualmente:'))
            console.log(chalk.gray(`   ./.claude/hooks/mark-task.sh ${name} "<pattern>" completed`))
            console.log()
            printProgress(progress)
            return
          }
        } else {
          console.log(chalk.green('✓ Implementação já concluída, pulando etapa 5'))
        }

        progress = await loadProgress(name)
        if (!qaDone && implementReallyDone) {
          await executePhase(
            ['feature', 'qa', name],
            'qa',
            6,
            'QA - REVISÃO DE QUALIDADE',
            worktreePath
          )
        } else {
          console.log(chalk.green('✓ QA já concluído, pulando etapa 6'))
        }

        progress = await loadProgress(name)
        if (!docsDone && qaDone) {
          await executePhase(['feature', 'docs', name], 'docs', 7, 'DOCUMENTAÇÃO', worktreePath)
        } else if (docsDone) {
          console.log(chalk.green('✓ Documentação já concluída, pulando etapa 7'))
        }

        if (worktreePath && worktreeBranch) {
          const hasRemote = this.hasRemote()
          const mainRepoPath = this.getMainRepoPath()

          console.log()
          console.log(chalk.yellow('Próximos passos:'))
          console.log()
          console.log(chalk.cyan(`📂 Worktree: ${worktreePath}`))
          console.log(chalk.cyan(`🌿 Branch: ${worktreeBranch}`))
          console.log()

          console.log(chalk.gray('  1. Revise as mudanças:'))
          console.log(chalk.white(`     git diff`))
          console.log()
          console.log(chalk.gray('  2. Commit final (se houver mudanças pendentes):'))
          console.log(
            chalk.white(`     git add . && git commit -m "feat(${name}): complete implementation"`)
          )
          console.log()

          if (hasRemote) {
            console.log(chalk.gray('  3. Push e abra PR:'))
            console.log(chalk.white(`     git push -u origin ${worktreeBranch}`))
            console.log(
              chalk.white(`     gh pr create --base ${baseBranch} --title "feat: ${name}"`)
            )
            console.log()
            console.log(chalk.gray('  4. Após merge do PR, limpe o worktree:'))
            console.log(chalk.white(`     cd ${mainRepoPath}`))
            console.log(chalk.white(`     git worktree remove ${worktreePath}`))
            console.log(chalk.white(`     git branch -d ${worktreeBranch}`))
          } else {
            console.log(chalk.gray('  3. No repo principal, faça merge:'))
            console.log(chalk.white(`     cd ${mainRepoPath}`))
            console.log(chalk.white(`     git merge ${worktreeBranch}`))
            console.log()
            console.log(chalk.gray('  4. Limpe o worktree:'))
            console.log(chalk.white(`     git worktree remove ${worktreePath}`))
            console.log(chalk.white(`     git branch -d ${worktreeBranch}`))
          }
        }
      }

      console.log(chalk.bold.green('\n═══════════════════════════════════════════════════'))
      console.log(chalk.bold.green('  ✨ AUTOPILOT COMPLETO!'))
      console.log(chalk.bold.green('═══════════════════════════════════════════════════\n'))

      await memoryCommand.save(name, { phase: 'docs' })

      printProgress(await loadProgress(name))

      console.log(chalk.cyan('Arquivos gerados:'))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/prd.md`))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/research.md`))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/tasks.md`))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/implementation-plan.md`))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/qa-report.md`))
      console.log()
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async quick(description: string, options: QuickOptions = {}): Promise<void> {
    console.log()
    console.log(chalk.bold.cyan('⚡ ADK Quick Task'))
    console.log(chalk.gray('━'.repeat(50)))
    console.log()
    console.log(chalk.white(`Tarefa: ${description}`))
    if (options.file) {
      console.log(chalk.gray(`Foco: ${options.file}`))
    }
    console.log()

    const fileContext = options.file
      ? `\nARQUIVO FOCO: ${options.file}\nComece analisando este arquivo.`
      : ''

    const prompt = `
QUICK TASK - Tarefa Rapida

## Descricao
${description}
${fileContext}

## Regras IMPORTANTES

1. **ANALISE RAPIDA**: Identifique o problema/necessidade rapidamente
2. **SOLUCAO MINIMA**: Implemente APENAS o necessario, sem over-engineering
3. **FOCO**: Nao refatore codigo nao relacionado
4. **TESTES**: ${options.test !== false ? 'Rode os testes existentes apos a mudanca' : 'Nao precisa rodar testes'}

## Processo

1. Entenda o que precisa ser feito
2. Localize o codigo relevante
3. Faca a mudanca minima necessaria
4. ${options.test !== false ? 'Rode: npm test (ou comando de teste do projeto)' : 'Verifique se nao quebrou nada obvio'}
5. Resuma o que foi feito

## Output esperado

Ao finalizar, mostre:
- O que foi alterado (arquivos e linhas)
- Se os testes passaram${options.test !== false ? '' : ' (se rodou)'}
- Qualquer observacao importante

NAO crie PRD, tasks, ou documentacao formal. Isso e uma tarefa rapida.
`

    try {
      const defaultModel = getModelForPhase('default')
      await executeClaudeCommand(prompt, { model: defaultModel })

      console.log()
      console.log(chalk.bold.green('✅ Quick task concluída!'))

      if (options.commit) {
        console.log()
        console.log(chalk.gray('Commitando alterações...'))
        try {
          execSync('git add -A', { stdio: 'ignore' })
          const shortDesc = description.replace(/"/g, '\\"').slice(0, 50)
          execSync(`git commit -m "fix: ${shortDesc}"`, { stdio: 'inherit' })
          console.log(chalk.green('Commit criado!'))
        } catch {
          logger.warn('Não foi possível commitar (sem alterações ou erro)')
        }
      } else {
        const { shouldCommit } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldCommit',
            message: 'Deseja commitar as alterações?',
            default: false,
          },
        ])

        if (shouldCommit) {
          const { commitType } = await inquirer.prompt([
            {
              type: 'list',
              name: 'commitType',
              message: 'Tipo do commit:',
              choices: [
                { name: 'fix: correção de bug', value: 'fix' },
                { name: 'feat: nova funcionalidade', value: 'feat' },
                { name: 'refactor: refatoração', value: 'refactor' },
                { name: 'style: formatação/estilo', value: 'style' },
                { name: 'chore: manutenção', value: 'chore' },
              ],
            },
          ])

          try {
            execSync('git add -A', { stdio: 'ignore' })
            const shortDesc = description.replace(/"/g, '\\"').slice(0, 50)
            execSync(`git commit -m "${commitType}: ${shortDesc}"`, { stdio: 'inherit' })
            console.log(chalk.green('Commit criado!'))
          } catch {
            logger.warn('Não foi possível commitar (sem alterações ou erro)')
          }
        }
      }

      console.log()
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private getFeatureFromWorktree(): string | null {
    const cwd = process.cwd()
    const worktreeMatch = cwd.match(/\.worktrees[/\\]([^/\\]+)/)
    return worktreeMatch ? worktreeMatch[1] : null
  }

  private async getActiveFocus(): Promise<string | null> {
    const worktreeFeature = this.getFeatureFromWorktree()
    if (worktreeFeature) {
      return worktreeFeature
    }

    const focusPath = path.join(this.getClaudePath(), 'active-focus.md')
    try {
      const content = await fs.readFile(focusPath, 'utf-8')
      const match = content.match(/feature:\s*(.+)/i)
      return match ? match[1].trim() : null
    } catch {
      return null
    }
  }

  async next(name?: string): Promise<void> {
    console.log()
    console.log(chalk.bold.cyan('⏭️  ADK Next Step'))
    console.log(chalk.gray('━'.repeat(50)))

    let featureName: string | null = name ?? null

    if (!featureName) {
      featureName = await this.getActiveFocus()
    }

    if (!featureName) {
      console.log()
      logger.error('Nenhuma feature ativa encontrada.')
      console.log(chalk.gray('  Use: adk feature next <nome>'))
      console.log(chalk.gray('  Ou: adk feature new <nome> para criar uma nova'))
      console.log()
      process.exit(1)
    }

    if (name) {
      await this.setActiveFocus(name, 'em andamento')
    }

    console.log(chalk.gray(`Feature: ${featureName}`))
    console.log()

    const progress = await loadProgress(featureName)

    const stepOrder = [
      { name: 'prd', label: 'PRD', method: () => this.create(featureName) },
      { name: 'research', label: 'Research', method: () => this.research(featureName) },
      { name: 'tasks', label: 'Tasks', method: () => this.tasks(featureName) },
      { name: 'arquitetura', label: 'Plan', method: () => this.plan(featureName) },
      {
        name: 'implementacao',
        label: 'Implement',
        method: () => this.implement(featureName, { phase: 'All' }),
      },
      { name: 'qa', label: 'QA', method: () => this.qa(featureName) },
      { name: 'docs', label: 'Docs', method: () => this.docs(featureName) },
      { name: 'finish', label: 'Finish', method: () => this.finish(featureName) },
    ]

    const state = await this.getFeatureState(featureName)
    if (state.hasPrd && !isStepCompleted(progress, 'prd')) {
      progress.steps = progress.steps.map((s) =>
        s.name === 'prd' ? { ...s, status: 'completed' as const } : s
      )
    }

    let nextStep = null
    for (const step of stepOrder) {
      const stepProgress = progress.steps.find((s) => s.name === step.name)
      if (
        !stepProgress ||
        stepProgress.status === 'pending' ||
        stepProgress.status === 'in_progress'
      ) {
        nextStep = step
        break
      }
    }

    if (!nextStep) {
      console.log(chalk.green('✨ Feature completa! Todas as etapas foram concluídas.'))
      console.log()
      console.log(chalk.cyan('Próximos passos sugeridos:'))
      console.log(chalk.gray('  git diff'))
      console.log(chalk.gray('  git add . && git commit'))
      console.log(chalk.gray('  git push && gh pr create'))
      console.log()
      return
    }

    console.log(chalk.yellow(`Próxima etapa: ${nextStep.label}`))
    console.log()

    const completedSteps = stepOrder
      .filter((s) => {
        const sp = progress.steps.find((p) => p.name === s.name)
        return sp && sp.status === 'completed'
      })
      .map((s) => s.label)

    if (completedSteps.length > 0) {
      console.log(chalk.gray(`Etapas concluídas: ${completedSteps.join(' → ')}`))
      console.log()
    }

    const worktreeSteps = ['implementacao', 'qa', 'docs', 'finish']
    const needsWorktree = worktreeSteps.includes(nextStep.name)
    const featureSlug = featureName.replace(/[^a-zA-Z0-9-]/g, '-')
    const mainRepo = this.getMainRepoPath()
    const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)

    if (needsWorktree && !this.isInWorktreeForFeature(featureName)) {
      const worktreeExists = await fs.pathExists(worktreeDir)

      if (!worktreeExists) {
        console.log(chalk.cyan('📂 Criando worktree...'))
        const result = await this.setupWorktree(featureName)
        if (!result.success) {
          console.log(chalk.red(`Erro ao criar worktree: ${result.error}`))
          process.exit(1)
        }
        console.log(chalk.green(`✓ Worktree criada: ${worktreeDir}`))
      }

      console.log(chalk.cyan(`📂 Executando na worktree: ${worktreeDir}`))
      console.log(
        chalk.bold(`Executando: adk feature ${nextStep.label.toLowerCase()} ${featureName}`)
      )
      console.log(chalk.gray('━'.repeat(50)))
      console.log()

      const args = ['feature', nextStep.label.toLowerCase(), featureName]
      if (nextStep.name === 'implementacao') {
        args.push('--phase', 'All')
      }
      execFileSync('adk', args, {
        stdio: 'inherit',
        cwd: worktreeDir,
      })
      return
    }

    console.log(
      chalk.bold(`Executando: adk feature ${nextStep.label.toLowerCase()} ${featureName}`)
    )
    console.log(chalk.gray('━'.repeat(50)))
    console.log()

    await nextStep.method()
  }

  async refine(name: string, options: RefineOptions = {}): Promise<void> {
    const { analyzeTasksForRefinement, loadTasksForFeature } = await import(
      '../utils/task-refiner.js'
    )
    const { SnapshotManager } = await import('../utils/snapshot-manager.js')

    console.log()
    console.log(chalk.bold.cyan('🔧 ADK Feature Refine'))
    console.log(chalk.gray('━'.repeat(50)))

    const spinner = ora('Analisando estado da feature...').start()

    try {
      const featurePath = this.getFeaturePath(name)
      const state = await this.getFeatureState(name)

      if (!state.exists) {
        spinner.fail(`Feature "${name}" não encontrada`)
        console.log(chalk.gray(`  Caminho esperado: ${featurePath}`))
        process.exit(1)
      }

      const snapshotManager = new SnapshotManager()
      await snapshotManager.createSnapshot(name, 'pre-refine')

      const refinable = await this.analyzeRefinableArtifacts(name, state)
      spinner.succeed('Análise concluída')

      console.log()
      console.log(chalk.cyan('📋 Artefatos que podem ser refinados:'))
      console.log()

      for (const artifact of refinable) {
        const icon = artifact.canRefine ? chalk.green('✓') : chalk.yellow('⚠')
        const reason = artifact.canRefine ? '' : chalk.gray(` (${artifact.reason})`)
        const stats = artifact.taskStats
          ? chalk.gray(
              ` [${artifact.taskStats.completed}✓ ${artifact.taskStats.inProgress}~ ${artifact.taskStats.pending}○]`
            )
          : ''
        console.log(`   ${icon} ${artifact.name}${stats}${reason}`)
      }

      const canRefine = refinable.filter((a) => a.canRefine)
      if (canRefine.length === 0) {
        console.log()
        console.log(chalk.yellow('Nenhum artefato pode ser refinado no momento.'))
        return
      }

      let context = options.context || ''

      if (!context) {
        console.log()
        const response = await inquirer.prompt([
          {
            type: 'editor',
            name: 'context',
            message: 'Adicione o contexto para refinamento (abrirá editor):',
            default: '',
          },
        ])
        context = response.context
      }

      if (!context || context.trim() === '') {
        console.log(chalk.yellow('Refinamento cancelado - nenhum contexto fornecido.'))
        return
      }

      console.log()
      console.log(chalk.gray('Contexto recebido:'))
      console.log(chalk.gray('─'.repeat(40)))
      console.log(chalk.gray(context.substring(0, 200) + (context.length > 200 ? '...' : '')))
      console.log(chalk.gray('─'.repeat(40)))
      console.log()

      const defaultTargets = options.all
        ? canRefine.map((a) => a.type)
        : options.prd
          ? ['prd']
          : options.research
            ? ['research']
            : options.tasks
              ? ['tasks', 'tasks-pending']
              : []

      let targets: string[]
      if (defaultTargets.length > 0) {
        targets = defaultTargets.filter((t) => canRefine.some((c) => c.type === t))
      } else {
        const { selectedTargets } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedTargets',
            message: 'O que deseja refinar?',
            choices: canRefine.map((a) => ({
              name: a.name,
              value: a.type,
              checked: false,
            })),
          },
        ])
        targets = selectedTargets
      }

      if (targets.length === 0) {
        console.log(chalk.yellow('Nenhum alvo selecionado para refinamento.'))
        return
      }

      console.log()
      const results: Array<{ target: string; success: boolean; changes: number }> = []

      for (const target of targets) {
        const refineSpinner = ora(`Refinando ${target}...`).start()

        try {
          if (target === 'prd') {
            await this.refinePrd(name, context)
            results.push({ target: 'PRD', success: true, changes: 1 })
            refineSpinner.succeed(`PRD refinado`)
          } else if (target === 'research') {
            await this.refineResearch(name, context)
            results.push({ target: 'Research', success: true, changes: 1 })
            refineSpinner.succeed(`Research refinado`)
          } else if (target === 'tasks' || target === 'tasks-pending') {
            const tasksPath = path.join(featurePath, 'tasks.md')
            const tasksData = await loadTasksForFeature(name)
            const analysis = analyzeTasksForRefinement(tasksData.tasks)

            const preservedInfo =
              analysis.preservedTasks.length > 0
                ? `\n\nTasks que NAO podem ser modificadas (já iniciadas/completadas):\n${analysis.preservedTasks.map((t) => `- [${t.status === 'completed' ? 'x' : '~'}] ${t.name}`).join('\n')}`
                : ''

            const pendingInfo =
              analysis.pendingTasks.length > 0
                ? `\n\nTasks pendentes que podem ser refinadas:\n${analysis.pendingTasks.map((t) => `- [ ] ${t.name}`).join('\n')}`
                : '\n\nNão há tasks pendentes para refinar.'

            const prompt = `FASE: REFINAMENTO PROGRESSIVO DE TASKS

Feature: ${name}
Arquivo: ${tasksPath}

## Contexto Adicional do Usuario
${context}
${preservedInfo}
${pendingInfo}

## PRINCIPIO FUNDAMENTAL: PENSAMENTO PROGRESSIVO

O refinamento deve CONSTRUIR sobre o trabalho existente, nao substituir ou duplicar.
Pense assim: "O que FALTA para cobrir o novo contexto?" e NAO "O que preciso criar do zero?"

## Processo de Analise (OBRIGATORIO - Faca ANTES de qualquer edicao)

### Passo 1: Leia e Entenda
- Leia o arquivo ${tasksPath} COMPLETO
- Identifique TODAS as tasks existentes e seus objetivos
- Entenda a estrutura e organizacao atual (fases, prioridades, dependencias)

### Passo 2: Mapeie o Contexto Adicional
Para cada ponto do contexto adicional, pergunte-se:
- "Alguma task existente JA COBRE isso?" → Se sim, NAO crie nova
- "Alguma task existente PARCIALMENTE cobre?" → Se sim, REFINE a descricao dela
- "Nenhuma task cobre?" → SOMENTE entao considere criar nova

### Passo 3: Decida as Acoes
Classifique cada necessidade em:
1. **COBERTO**: Task existente ja atende → Nenhuma acao
2. **REFINAR**: Task existente precisa de ajuste → Melhorar descricao/criterios
3. **GAP REAL**: Cenario genuinamente novo → Criar task com [REFINAMENTO]

## Regras Anti-Duplicacao

ANTES de criar qualquer task nova, verifique:
- [ ] Nao existe task com objetivo similar?
- [ ] Nao existe task que poderia ser expandida para cobrir isso?
- [ ] Nao e um sub-item de uma task existente?
- [ ] E realmente um GAP e nao uma variacao do que ja existe?

Se a resposta para QUALQUER pergunta for "existe/sim", NAO crie task nova.

## Acoes Permitidas

1. **REFINAR task pendente**: Melhorar descricao, adicionar criterios de aceitacao
   - Mantenha o checkbox [ ] original
   - Melhore a clareza sem mudar o escopo fundamental

2. **ADICIONAR task genuinamente nova**: Apenas para gaps REAIS
   - Use prefixo [REFINAMENTO] no nome
   - Justifique mentalmente: "Isso NAO e coberto por nenhuma task existente porque..."
   - Posicione logicamente (na fase correta, com dependencias certas)

3. **NAO FAZER**:
   - Criar tasks similares as existentes
   - Criar tasks que sao sub-itens de outras
   - Criar tasks vagas ou genericas
   - Modificar tasks [x] ou [~]

## Formato de Saida

Se adicionar novas tasks, use este formato:
\`\`\`markdown
## Tasks Adicionadas em Refinamento (YYYY-MM-DD)

### Task X.Y: [REFINAMENTO] Nome descritivo
- Tipo: Implementation/Test/Config
- Prioridade: P0/P1/P2
- Dependencias: Task X.Z (se houver)
- Justificativa: Este cenario nao era coberto porque...
- Acceptance Criteria:
  - [ ] Criterio especifico 1
  - [ ] Criterio especifico 2
\`\`\`

## Acao Esperada

1. Use Read para ler ${tasksPath}
2. Analise seguindo o processo acima (Passos 1-3)
3. Use Edit APENAS se houver refinamentos ou gaps reais
4. Se NAO houver gaps, informe: "Analise concluida: tasks existentes ja cobrem o contexto adicional"
5. Se houver mudancas, liste o que foi feito e por que
`

            const modelType = getModelForPhase('planning', options.model as ModelType | undefined)
            await executeClaudeCommand(prompt, { model: modelType })

            results.push({
              target: 'Tasks',
              success: true,
              changes: 1,
            })
            refineSpinner.succeed(`Tasks refinadas`)
          }
        } catch (error) {
          refineSpinner.fail(`Erro ao refinar ${target}`)
          results.push({ target, success: false, changes: 0 })
          logger.error(error instanceof Error ? error.message : String(error))
        }
      }

      if (targets.includes('prd') && !targets.includes('tasks') && state.hasTasks) {
        let shouldCascade = options.cascade

        if (shouldCascade === undefined) {
          console.log()
          const response = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'cascade',
              message: 'PRD foi refinado. Deseja atualizar tasks baseado nas mudanças?',
              default: true,
            },
          ])
          shouldCascade = response.cascade
        }

        if (shouldCascade) {
          const cascadeSpinner = ora('Atualizando tasks em cascata...').start()
          try {
            const tasksPath = path.join(featurePath, 'tasks.md')
            const prdPath = path.join(featurePath, 'prd.md')
            const tasksData = await loadTasksForFeature(name)
            const analysis = analyzeTasksForRefinement(tasksData.tasks)

            const preservedInfo =
              analysis.preservedTasks.length > 0
                ? `\n\nTasks que NAO podem ser modificadas:\n${analysis.preservedTasks.map((t) => `- [${t.status === 'completed' ? 'x' : '~'}] ${t.name}`).join('\n')}`
                : ''

            const prompt = `FASE: CASCATA PROGRESSIVA - ATUALIZACAO DE TASKS APOS REFINAMENTO DE PRD

Feature: ${name}
Arquivo PRD: ${prdPath}
Arquivo Tasks: ${tasksPath}

## Contexto
O PRD foi refinado com o seguinte contexto:
${context}

Agora precisamos verificar se as tasks existentes ainda cobrem todos os requisitos.
${preservedInfo}

## PRINCIPIO FUNDAMENTAL: CASCATA INTELIGENTE

A cascata NAO significa "criar tasks para tudo que mudou no PRD".
Significa: "verificar se as tasks existentes ainda sao suficientes e adicionar APENAS o que falta".

## Processo de Analise (OBRIGATORIO)

### Passo 1: Leia Ambos os Arquivos
- Leia o PRD completo em ${prdPath}, focando na secao de Refinamento
- Leia todas as tasks em ${tasksPath}

### Passo 2: Mapeie Mudancas do PRD vs Tasks Existentes
Para cada mudanca/adicao no PRD refinado:
- "Alguma task existente JA IMPLEMENTA isso?" → Coberto, nada a fazer
- "Alguma task existente pode ser AJUSTADA?" → Considere refinar a task
- "E um requisito GENUINAMENTE NOVO sem cobertura?" → Considere criar task

### Passo 3: Filtre Rigorosamente
Antes de criar qualquer task [CASCATA], valide:
- [ ] O requisito do PRD NAO e coberto por NENHUMA task existente?
- [ ] NAO e uma variacao ou detalhe de algo ja coberto?
- [ ] E uma entrega DISTINTA que precisa de task propria?

## Regras de Cascata

1. **Prefira NAO criar** - Na duvida, as tasks existentes provavelmente cobrem
2. **Cascata e exceção** - So crie task [CASCATA] para gaps OBVIOS e SIGNIFICATIVOS
3. **Seja especifico** - Se criar, a task deve ter escopo claro e criterios de aceitacao

## Acoes Permitidas

1. **Nenhuma acao**: Se tasks existentes cobrem as mudancas do PRD (CASO MAIS COMUM)
2. **Criar task [CASCATA]**: APENAS para requisitos novos sem NENHUMA cobertura

## Formato para Novas Tasks (se necessario)

\`\`\`markdown
## Tasks Adicionadas por Cascata (YYYY-MM-DD)

### Task X.Y: [CASCATA] Nome descritivo
- Tipo: Implementation/Test
- Prioridade: P1
- Origem: Requisito RF-XX adicionado no refinamento do PRD
- Justificativa: Nenhuma task existente cobre este requisito porque...
- Acceptance Criteria:
  - [ ] Criterio 1
  - [ ] Criterio 2
\`\`\`

## Acao Esperada

1. Use Read para ler ${prdPath} (foco na secao Refinamento)
2. Use Read para ler ${tasksPath}
3. Analise o mapeamento mudancas vs tasks
4. Se NAO houver gaps: informe "Cascata concluida: tasks existentes ja cobrem as mudancas do PRD"
5. Se houver gaps REAIS: use Edit para adicionar tasks [CASCATA] com justificativa clara
`

            const modelType = getModelForPhase('planning', options.model as ModelType | undefined)
            await executeClaudeCommand(prompt, { model: modelType })

            cascadeSpinner.succeed(`Tasks atualizadas em cascata`)
            results.push({ target: 'Tasks (cascata)', success: true, changes: 1 })
          } catch (error) {
            cascadeSpinner.fail('Erro na atualização em cascata')
            logger.error(error instanceof Error ? error.message : String(error))
          }
        }
      }

      await this.syncProgressState(name, 'refine', state.currentStage, 'adk feature refine')

      console.log()
      console.log(chalk.green('✅ Refinamento concluído!'))
      console.log()
      console.log(chalk.cyan('Resumo:'))
      for (const r of results) {
        const icon = r.success ? chalk.green('✓') : chalk.red('✗')
        const changes = r.success ? chalk.gray(` (${r.changes} alterações)`) : ''
        console.log(`   ${icon} ${r.target}${changes}`)
      }
      console.log()
    } catch (error) {
      spinner.fail('Erro no refinamento')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async analyzeRefinableArtifacts(
    name: string,
    state: FeatureState
  ): Promise<RefinableArtifact[]> {
    const { analyzeTasksForRefinement, loadTasksForFeature } = await import(
      '../utils/task-refiner.js'
    )
    const result: RefinableArtifact[] = []

    if (state.hasPrd) {
      result.push({ type: 'prd', name: 'PRD', canRefine: true })
    }

    if (state.hasResearch) {
      result.push({ type: 'research', name: 'Research', canRefine: true })
    }

    if (state.hasTasks) {
      const tasksData = await loadTasksForFeature(name)
      const analysis = analyzeTasksForRefinement(tasksData.tasks)

      const total = tasksData.tasks.length
      const pending = analysis.pendingTasks.length
      const inProgress = tasksData.tasks.filter((t) => t.status === 'in_progress').length
      const completed = tasksData.tasks.filter((t) => t.status === 'completed').length

      if (analysis.canRefineAll) {
        result.push({
          type: 'tasks',
          name: 'Tasks (todas)',
          canRefine: true,
          taskStats: { total, pending, inProgress, completed },
        })
      } else if (pending > 0) {
        result.push({
          type: 'tasks-pending',
          name: `Tasks (${pending} pendentes)`,
          canRefine: true,
          taskStats: { total, pending, inProgress, completed },
        })
      } else {
        result.push({
          type: 'tasks',
          name: 'Tasks',
          canRefine: false,
          reason: 'todas as tasks já foram completadas',
          taskStats: { total, pending, inProgress, completed },
        })
      }
    }

    return result
  }

  private async refinePrd(name: string, context: string): Promise<void> {
    const featurePath = this.getFeaturePath(name)
    const prdPath = path.join(featurePath, 'prd.md')

    const prompt = `FASE: REFINAMENTO DE PRD

Feature: ${name}
Arquivo: ${prdPath}

## Contexto Adicional do Usuario
${context}

## Sua Tarefa

1. Leia o arquivo PRD existente em: ${prdPath}
2. Analise o conteudo e incorpore o contexto adicional fornecido
3. Use a ferramenta Edit para adicionar uma secao "## Refinamento" ao FINAL do arquivo com:
   - Data do refinamento: ${new Date().toISOString().split('T')[0]}
   - Contexto adicional incorporado
   - Impacto nas outras secoes (se houver)
4. Se necessario, use Edit para atualizar secoes especificas afetadas pelo novo contexto

IMPORTANTE:
- Use a ferramenta Edit para modificar o arquivo diretamente
- Mantenha a estrutura original do PRD
- NAO remova conteudo existente, apenas adicione/modifique
- NAO reescreva o arquivo inteiro, use edits pontuais
- Ao finalizar, confirme as mudancas feitas

## Acao Esperada

Use Read para ler ${prdPath}, depois use Edit para adicionar a secao de refinamento.
`

    await executeClaudeCommand(prompt)
  }

  private async refineResearch(name: string, context: string): Promise<void> {
    const featurePath = this.getFeaturePath(name)
    const researchPath = path.join(featurePath, 'research.md')

    const prompt = `FASE: REFINAMENTO DE RESEARCH

Feature: ${name}
Arquivo: ${researchPath}

## Contexto Adicional do Usuario
${context}

## Sua Tarefa

1. Leia o arquivo Research existente em: ${researchPath}
2. Analise o conteudo e incorpore o contexto adicional fornecido
3. Use a ferramenta Edit para adicionar uma secao "## Descobertas Adicionais" ao FINAL do arquivo com:
   - Data do refinamento: ${new Date().toISOString().split('T')[0]}
   - Novas descobertas baseadas no contexto
   - Impacto no plano de implementacao (se houver)
4. Se necessario, use Edit para atualizar a secao de riscos

IMPORTANTE:
- Use a ferramenta Edit para modificar o arquivo diretamente
- Mantenha a estrutura original do research
- NAO remova conteudo existente, apenas adicione/modifique
- NAO reescreva o arquivo inteiro, use edits pontuais
- Ao finalizar, confirme as mudancas feitas

## Acao Esperada

Use Read para ler ${researchPath}, depois use Edit para adicionar a secao de descobertas adicionais.
`

    await executeClaudeCommand(prompt)
  }

  async sync(
    name: string,
    options: {
      strategy?: 'merge' | 'tasks-wins' | 'progress-wins'
      dryRun?: boolean
      verbose?: boolean
    } = {}
  ): Promise<void> {
    const spinner = ora('Sincronizando estado da feature...').start()

    try {
      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" não encontrada`)
        logger.error(`Feature "${name}" não encontrada`)
        process.exit(1)
      }

      const syncEngine = new SyncEngine({
        strategy: options.strategy || 'merge',
      })

      if (options.dryRun) {
        spinner.text = 'Executando dry-run...'
        const preview = await syncEngine.dryRun(name)
        spinner.succeed('Dry-run concluído')

        console.log(chalk.cyan('\n📋 Mudanças que seriam aplicadas:'))
        if (preview.changes.length === 0) {
          console.log(chalk.gray('  Nenhuma mudança necessária'))
        } else {
          for (const change of preview.changes) {
            console.log(
              `  ${change.field}: ${String(change.oldValue)} → ${String(change.newValue)}`
            )
          }
        }

        if (preview.inconsistencies.length > 0) {
          console.log(chalk.yellow('\n⚠️ Inconsistências detectadas:'))
          for (const inc of preview.inconsistencies) {
            console.log(`  ${inc.type}: ${inc.description}`)
          }
        }
        return
      }

      const result = await syncEngine.sync(name, { strategy: options.strategy })

      spinner.succeed(`Sincronização concluída em ${result.duration}ms`)

      if (options.verbose) {
        console.log(chalk.cyan('\n📊 Resultado:'))
        console.log(`  Inconsistências resolvidas: ${result.inconsistenciesResolved}`)
        console.log(`  Mudanças aplicadas: ${result.changesApplied.length}`)
        console.log(`  Snapshot criado: ${result.snapshotCreated ? 'Sim' : 'Não'}`)
      }
    } catch (error) {
      spinner.fail('Falha na sincronização')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async restore(name: string, options: { list?: boolean; to?: string } = {}): Promise<void> {
    const spinner = ora('Carregando snapshots...').start()

    try {
      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" não encontrada`)
        logger.error(`Feature "${name}" não encontrada`)
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
        for (let i = 0; i < snapshots.length; i++) {
          const snap = snapshots[i]
          console.log(`  ${i + 1}. ${snap.id}`)
          console.log(`     Criado: ${snap.createdAt}`)
          console.log(`     Trigger: ${snap.trigger}`)
        }
        return
      }

      if (!options.to) {
        spinner.fail('Especifique --list para ver snapshots ou --to <id> para restaurar')
        logger.error('Opção --to ou --list é obrigatória')
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
      await snapshotManager.restoreSnapshot(name, options.to)

      spinner.succeed(`Restaurado para snapshot: ${options.to}`)
      console.log(chalk.green('\n✅ Backup pré-restauração criado automaticamente'))
    } catch (error) {
      spinner.fail('Falha na restauração')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async history(name: string, options: { limit?: number } = {}): Promise<void> {
    const spinner = ora('Carregando histórico...').start()

    try {
      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" não encontrada`)
        logger.error(`Feature "${name}" não encontrada`)
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

      for (let i = 0; i < history.length; i++) {
        const entry = history[i]
        const date = new Date(entry.timestamp).toLocaleString('pt-BR')
        const duration = entry.duration ? `(${Math.round(entry.duration / 1000)}s)` : ''

        console.log(chalk.bold(`${history.length - i}. ${entry.fromPhase} → ${entry.toPhase}`))
        console.log(`   📅 ${date} ${duration}`)
        console.log(`   🔧 Trigger: ${entry.trigger}`)
        console.log()
      }
    } catch (error) {
      spinner.fail('Falha ao carregar histórico')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async status(name: string, options: { unified?: boolean; tokens?: boolean } = {}): Promise<void> {
    const spinner = ora('Carregando status...').start()

    try {
      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" não encontrada`)
        logger.error(`Feature "${name}" não encontrada`)
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
        console.log(`Progresso: ${chalk.bold(`${state.progress}%`)}`)
        console.log(`Última Atualização: ${state.lastUpdated}`)

        console.log(chalk.cyan('\n📋 Tasks:'))
        const tasksByStatus = {
          completed: state.tasks.filter((t) => t.status === 'completed'),
          in_progress: state.tasks.filter((t) => t.status === 'in_progress'),
          pending: state.tasks.filter((t) => t.status === 'pending'),
          blocked: state.tasks.filter((t) => t.status === 'blocked'),
        }

        console.log(`  ✅ Completed: ${tasksByStatus.completed.length}`)
        console.log(`  🔄 In Progress: ${tasksByStatus.in_progress.length}`)
        console.log(`  ⏳ Pending: ${tasksByStatus.pending.length}`)
        console.log(`  🚫 Blocked: ${tasksByStatus.blocked.length}`)

        if (state.transitions.length > 0) {
          console.log(chalk.cyan('\n🕐 Últimas Transições:'))
          const recentTransitions = state.transitions.slice(-3)
          for (const t of recentTransitions) {
            const date = new Date(t.timestamp).toLocaleDateString('pt-BR')
            console.log(`  ${t.fromPhase} → ${t.toPhase} (${date})`)
          }
        }

        if (options.tokens && state.tokenUsage) {
          console.log(chalk.cyan('\n🔢 Token Usage:'))
          console.log(`  Current: ${state.tokenUsage.currentTokens.toLocaleString()} tokens`)
          console.log(`  Max: ${state.tokenUsage.maxTokens.toLocaleString()} tokens`)
          console.log(`  Usage: ${state.tokenUsage.usagePercentage.toFixed(1)}%`)

          let levelColor = chalk.green
          if (state.tokenUsage.level === 'compact') levelColor = chalk.yellow
          else if (state.tokenUsage.level === 'summarize') levelColor = chalk.yellow
          else if (state.tokenUsage.level === 'handoff') levelColor = chalk.red

          console.log(`  Level: ${levelColor(state.tokenUsage.level.toUpperCase())}`)
          console.log(`  Last Checked: ${new Date(state.tokenUsage.lastChecked).toLocaleString('pt-BR')}`)

          if (state.lastCompaction) {
            console.log(chalk.cyan('\n📦 Last Compaction:'))
            console.log(`  When: ${new Date(state.lastCompaction.timestamp).toLocaleString('pt-BR')}`)
            console.log(`  Level: ${state.lastCompaction.level}`)
            console.log(
              `  Saved: ${state.lastCompaction.savedTokens.toLocaleString()} tokens (${state.lastCompaction.tokensBefore.toLocaleString()} → ${state.lastCompaction.tokensAfter.toLocaleString()})`
            )
          }
        }

        return
      }

      const progress = await loadProgress(name)

      if (options.tokens) {
        const { StateManager } = await import('../utils/state-manager')
        const manager = new StateManager()
        const status = await manager.getContextStatus(name)

        spinner.succeed('Status carregado')

        console.log(chalk.cyan(`\n📊 Feature: ${name}`))
        console.log(`Fase: ${progress.currentPhase}`)
        console.log(`Última atualização: ${progress.lastUpdated}`)

        console.log(chalk.cyan('\n🔢 Token Usage:'))
        console.log(`  Current: ${status.currentTokens.toLocaleString()} tokens (${status.usagePercentage.toFixed(1)}%)`)
        console.log(`  Max: ${status.maxTokens.toLocaleString()} tokens`)

        let levelColor = chalk.green
        if (status.level === 'compact') levelColor = chalk.yellow
        else if (status.level === 'summarize') levelColor = chalk.yellow
        else if (status.level === 'handoff') levelColor = chalk.red

        console.log(`  Level: ${levelColor(status.level.toUpperCase())} (${status.recommendation})`)
        console.log(`  Can Continue: ${status.canContinue ? chalk.green('Yes') : chalk.red('No')}`)
      } else {
        spinner.succeed('Status carregado')

        console.log(chalk.cyan(`\n📊 Feature: ${name}`))
        console.log(`Fase: ${progress.currentPhase}`)
        console.log(`Última atualização: ${progress.lastUpdated}`)
      }
    } catch (error) {
      spinner.fail('Falha ao carregar status')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async compact(
    name: string,
    options: { dryRun?: boolean; level?: string; revert?: string } = {}
  ): Promise<void> {
    const spinner = ora('Processando compactação...').start()

    try {
      const featurePath = this.getFeaturePath(name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" não encontrada`)
        logger.error(`Feature "${name}" não encontrada`)
        process.exit(1)
      }

      const { StateManager } = await import('../utils/state-manager')
      const manager = new StateManager()

      if (options.revert) {
        const { contextCompactor } = await import('../utils/context-compactor')
        const success = await contextCompactor.revertCompaction(name, options.revert)

        if (success) {
          spinner.succeed(`Compactação ${options.revert} revertida com sucesso`)
        } else {
          spinner.fail('Falha ao reverter compactação (pode ter expirado)')
          process.exit(1)
        }
        return
      }

      const status = await manager.getContextStatus(name)

      spinner.info(`Token usage atual: ${status.currentTokens.toLocaleString()} (${status.usagePercentage.toFixed(1)}%)`)

      if (options.dryRun) {
        spinner.info('Modo dry-run: nenhuma mudança será aplicada')

        console.log(chalk.cyan('\n📊 Simulação de Compactação'))
        console.log(`Feature: ${name}`)
        console.log(`Current: ${status.currentTokens.toLocaleString()} tokens`)
        console.log(`Level: ${status.level}`)
        console.log(`Recommendation: ${status.recommendation}`)

        if (status.level === 'raw') {
          console.log(chalk.green('\nℹ️  Contexto está OK, compactação não necessária'))
        } else {
          console.log(
            chalk.yellow(
              '\n⚠️  Compactação recomendada. Execute sem --dry-run para aplicar.'
            )
          )
        }

        spinner.succeed('Simulação completa')
        return
      }

      const levelToUse = options.level as 'compact' | 'summarize' | 'handoff' | undefined

      if (levelToUse && !['compact', 'summarize', 'handoff'].includes(levelToUse)) {
        spinner.fail('Level inválido. Use: compact, summarize ou handoff')
        process.exit(1)
      }

      spinner.text = 'Compactando contexto...'

      const result = await manager.triggerCompaction(name, levelToUse)

      spinner.succeed('Compactação completa')

      console.log(chalk.cyan('\n✨ Resultado da Compactação'))
      console.log(`Original: ${result.originalTokens.toLocaleString()} tokens`)
      console.log(`Compactado: ${result.compactedTokens.toLocaleString()} tokens`)
      console.log(chalk.green(`Economizados: ${result.savedTokens.toLocaleString()} tokens`))
      console.log(`Itens compactados: ${result.itemsCompacted}`)
      console.log(`Level: ${result.level}`)

      if (result.canRevert) {
        console.log(
          chalk.yellow(
            `\nℹ️  Pode reverter em até 24h com: adk feature compact ${name} --revert ${result.historyId}`
          )
        )
      }
    } catch (error) {
      spinner.fail('Falha na compactação')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

interface RefineOptions {
  prd?: boolean
  research?: boolean
  tasks?: boolean
  all?: boolean
  cascade?: boolean
  context?: string
  model?: string
}

interface RefinableArtifact {
  type: 'prd' | 'research' | 'tasks' | 'tasks-pending'
  name: string
  canRefine: boolean
  reason?: string
  taskStats?: {
    total: number
    pending: number
    inProgress: number
    completed: number
  }
}

export const featureCommand = new FeatureCommand()
