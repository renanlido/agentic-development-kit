import { execFileSync, execSync } from 'node:child_process'
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'
import {
  type FeatureProgress,
  isStepCompleted,
  loadProgress,
  saveProgress,
  updateStepStatus,
} from '../utils/progress'
import { parseSpecFromMarkdown, validateSpec } from '../utils/spec-utils'
import { loadTemplate } from '../utils/templates'
import { memoryCommand } from './memory'

interface FeatureOptions {
  priority?: string
  phase?: string
  context?: string
  description?: string
  skipSpec?: boolean
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
    const focusPath = path.join(process.cwd(), '.claude/active-focus.md')
    const featurePath = `.claude/plans/features/${name}/`
    const content = `# Foco Ativo

feature: ${name}
status: ${status}
path: ${featurePath}
`
    await fs.writeFile(focusPath, content)
  }

  private async getFeatureState(name: string): Promise<FeatureState> {
    const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
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
    if (!state.exists) {
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

    const specPath = path.join(process.cwd(), '.claude/specs', `${name}.md`)
    const featureSpecPath = path.join(process.cwd(), '.claude/plans/features', name, 'spec.md')

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

      const prdTemplate = await loadTemplate('prd-template.md')

      const date = new Date().toISOString().split('T')[0]

      const prdContent = prdTemplate
        .replace(/\[Nome da Feature\]/g, name)
        .replace(/YYYY-MM-DD/g, date)

      if (!state.hasPrd) {
        await fs.writeFile(path.join(state.featurePath, 'prd.md'), prdContent)
      }

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

      // Create git branch
      try {
        execSync(`git checkout -b feature/${name}`, { stdio: 'ignore' })
      } catch {
        // Git not available or already on branch
      }

      spinner.succeed('Feature criada')

      await this.setActiveFocus(name, state.currentStage)

      console.log()
      logger.success(`✨ Feature ${name} criada!`)
      console.log()
      console.log(chalk.cyan('Próximos passos:'))
      console.log(chalk.gray(`  1. Editar PRD: .claude/plans/features/${name}/prd.md`))
      console.log(chalk.gray(`  2. adk feature research ${name}`))
      console.log(chalk.gray(`  3. adk feature tasks ${name}`))
      console.log(chalk.gray(`  4. adk feature plan ${name}`))
      console.log(chalk.gray(`  5. adk feature implement ${name}`))
      console.log(chalk.gray(`  6. adk feature qa ${name}`))
      console.log(chalk.gray(`  7. adk feature docs ${name}`))
    } catch (error) {
      spinner.fail('Erro ao criar feature')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async research(name: string, options: FeatureOptions = {}): Promise<void> {
    const spinner = ora('Executando research phase...').start()

    try {
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
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

      await executeClaudeCommand(prompt)

      spinner.succeed('Research concluído')

      progress = updateStepStatus(progress, 'research', 'completed')
      await saveProgress(name, progress)

      await this.setActiveFocus(name, 'research feito')
      await memoryCommand.save(name, { phase: 'research' })

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
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
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

      await executeClaudeCommand(prompt)

      spinner.succeed('Plano criado')

      progress = updateStepStatus(progress, 'arquitetura', 'completed')
      await saveProgress(name, progress)

      await this.setActiveFocus(name, 'arquitetura pronta')
      await memoryCommand.save(name, { phase: 'plan' })

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

  async tasks(name: string): Promise<void> {
    const spinner = ora('Criando breakdown de tasks...').start()

    try {
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
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

      await executeClaudeCommand(prompt)

      spinner.succeed('Tasks criadas')

      progress = updateStepStatus(progress, 'tasks', 'completed')
      await saveProgress(name, progress)

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
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)

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

      const prompt = `
PHASE 3: IMPLEMENTATION (TDD)

Feature: ${name}
Implementation Plan: .claude/plans/features/${name}/implementation-plan.md
Target Phase: ${phase}
${specSection}
IMPORTANTE: TDD - TESTES PRIMEIRO

Process:

1. WRITE TESTS FIRST
   - Escreva TODOS os testes da fase
   - NÃO escreva implementação ainda
   - Execute e confirme que falham
   - Commit: 'test: add tests for ${name} ${phase}'

2. IMPLEMENT
   - Implemente código para testes passarem
   - Teste após cada mudança
   - Refatore se necessário
   - Commit incrementalmente

3. VERIFY
   - Todos testes passam?
   - Coverage >= 80%?
   - Lint clean?
   - Performance OK?

Não avance para próxima fase até atual estar completa.
`

      spinner.text = 'Executando implementação com Claude Code...'
      await executeClaudeCommand(prompt)

      spinner.succeed('Implementação concluída')

      progress = updateStepStatus(progress, 'implementacao', 'completed')
      await saveProgress(name, progress)

      await this.setActiveFocus(name, 'implementação em andamento')
      await memoryCommand.save(name, { phase: 'implement' })

      console.log()
      logger.success(`✨ ${phase} implementada!`)
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray(`  adk feature qa ${name}`))
    } catch (error) {
      spinner.fail('Erro na implementação')
      const progress = await loadProgress(name)
      updateStepStatus(progress, 'implementacao', 'failed', String(error))
      await saveProgress(name, progress)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async qa(name: string): Promise<void> {
    const spinner = ora('Executando revisão de qualidade...').start()

    try {
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
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

      await executeClaudeCommand(prompt)

      spinner.succeed('QA concluído')

      progress = updateStepStatus(progress, 'qa', 'completed')
      await saveProgress(name, progress)

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

  async docs(name: string): Promise<void> {
    const spinner = ora('Gerando documentação...').start()

    try {
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)

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

      await executeClaudeCommand(prompt)

      spinner.succeed('Documentação gerada')

      progress = updateStepStatus(progress, 'docs', 'completed')
      await saveProgress(name, progress)

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

  async list(): Promise<void> {
    try {
      const featuresPath = path.join(process.cwd(), '.claude/plans/features')

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
    for (const step of inProgressSteps) {
      const label = stepLabels[step.name] || step.name
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
      etapaLabel: string
    ): Promise<boolean> => {
      console.log(chalk.bold.cyan(`\n═══════════════════════════════════════════════════`))
      console.log(chalk.bold.cyan(`  ETAPA ${etapaNum}: ${etapaLabel}`))
      console.log(chalk.bold.cyan(`═══════════════════════════════════════════════════\n`))
      console.log(chalk.gray(`Executando: adk ${args.join(' ')}\n`))

      let success = false
      let attempts = 0
      const maxAttempts = 3

      while (!success && attempts < maxAttempts) {
        try {
          execFileSync('adk', args, { stdio: 'inherit' })
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
      if (!isStepCompleted(progress, 'research')) {
        await executePhase(
          ['feature', 'research', name],
          'research',
          2,
          'RESEARCH - ANÁLISE DO CODEBASE'
        )
      } else {
        console.log(chalk.green('✓ Research já existe, pulando etapa 2'))
      }

      progress = await loadProgress(name)
      if (!isStepCompleted(progress, 'tasks')) {
        await executePhase(['feature', 'tasks', name], 'tasks', 3, 'BREAKDOWN EM TASKS')
      } else {
        console.log(chalk.green('✓ Tasks já existem, pulando etapa 3'))
      }

      progress = await loadProgress(name)
      if (!isStepCompleted(progress, 'arquitetura')) {
        await executePhase(['feature', 'plan', name], 'arquitetura', 4, 'ARQUITETURA')
      } else {
        console.log(chalk.green('✓ Arquitetura já existe, pulando etapa 4'))
      }

      if (await fs.pathExists(planPath)) {
        console.log(chalk.green('\n📐 Arquitetura gerada!'))
        console.log(
          chalk.gray(`   Veja em: .claude/plans/features/${name}/implementation-plan.md\n`)
        )
      }

      const { continueImplement } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueImplement',
          message: 'Arquitetura definida. Iniciar implementação (TDD)?',
          default: true,
        },
      ])

      if (!continueImplement) {
        printProgress(await loadProgress(name))
        console.log(chalk.yellow('\nAutopilot pausado. Continue manualmente com:'))
        console.log(chalk.gray(`  adk feature implement ${name}`))
        return
      }

      progress = await loadProgress(name)
      if (!isStepCompleted(progress, 'implementacao')) {
        await executePhase(
          ['feature', 'implement', name, '--phase', 'All'],
          'implementacao',
          5,
          'IMPLEMENTAÇÃO (TDD)'
        )
      } else {
        console.log(chalk.green('✓ Implementação já concluída, pulando etapa 5'))
      }

      progress = await loadProgress(name)
      if (!isStepCompleted(progress, 'qa')) {
        await executePhase(['feature', 'qa', name], 'qa', 6, 'QA - REVISÃO DE QUALIDADE')
      } else {
        console.log(chalk.green('✓ QA já concluído, pulando etapa 6'))
      }

      progress = await loadProgress(name)
      if (!isStepCompleted(progress, 'docs')) {
        await executePhase(['feature', 'docs', name], 'docs', 7, 'DOCUMENTAÇÃO')
      } else {
        console.log(chalk.green('✓ Documentação já concluída, pulando etapa 7'))
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
      console.log(chalk.yellow('Proximos passos sugeridos:'))
      console.log(chalk.gray('  1. Revise as mudanças: git diff'))
      console.log(chalk.gray('  2. Commit: git add . && git commit'))
      console.log(chalk.gray('  3. Push e PR: git push && gh pr create'))
      console.log()

      const branchName = `feature/${name.replace(/[^a-zA-Z0-9-]/g, '-')}`
      try {
        execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' })
        console.log(chalk.green(`Branch ${branchName} criada`))
      } catch {
        // Already on branch or git not available
      }
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
      await executeClaudeCommand(prompt)

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
}

export const featureCommand = new FeatureCommand()
