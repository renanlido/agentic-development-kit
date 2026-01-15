import { execSync } from 'node:child_process'
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'
import { isStepCompleted, loadProgress, saveProgress, updateStepStatus } from '../utils/progress'
import { generateSpecTemplate, parseSpecFromMarkdown, validateSpec } from '../utils/spec-utils'
import { loadTemplate } from '../utils/templates'
import { memoryCommand } from './memory'

interface FeatureOptions {
  priority?: string
  phase?: string
  context?: string
  description?: string
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
  currentStage: string
  featurePath: string
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

    let currentStage = 'não iniciada'
    if (hasPlan) {
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

    return { exists, hasPrd, hasTasks, hasPlan, hasResearch, currentStage, featurePath }
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
        context = await fs.readFile(contextPath, 'utf-8')
      }
    }

    if (options.description) {
      context = options.description + (context ? `\n\n---\n\n${context}` : '')
    }

    return context
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
      const taskTemplate = await loadTemplate('task-template.md')
      const planTemplate = await loadTemplate('feature-plan.md')

      const date = new Date().toISOString().split('T')[0]

      const prdContent = prdTemplate
        .replace(/\[Nome da Feature\]/g, name)
        .replace(/YYYY-MM-DD/g, date)

      const taskContent = taskTemplate
        .replace(/\[Feature Name\]/g, name)
        .replace(/YYYY-MM-DD/g, date)

      const planContent = planTemplate
        .replace(/\[Feature Name\]/g, name)
        .replace(/\[feature-x\]/g, name)
        .replace(/YYYY-MM-DD/g, date)

      if (!state.hasPrd) {
        await fs.writeFile(path.join(state.featurePath, 'prd.md'), prdContent)
      }
      if (!state.hasTasks) {
        await fs.writeFile(path.join(state.featurePath, 'tasks.md'), taskContent)
      }
      await fs.writeFile(path.join(state.featurePath, 'plan.md'), planContent)

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
      console.log(chalk.gray(`  2. Executar: adk feature research ${name}`))
      console.log(chalk.gray(`  3. Executar: adk feature plan ${name}`))
      console.log(chalk.gray(`  4. Executar: adk feature implement ${name}`))
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

      if (!(await fs.pathExists(featurePath))) {
        spinner.text = `Criando estrutura da feature ${name}...`
        await fs.ensureDir(featurePath)
      }

      const contextContent = await this.loadContext(options)
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

      await this.setActiveFocus(name, 'research feito')
      await memoryCommand.save(name, { phase: 'research' })

      console.log()
      logger.success(`Research salvo em: ${chalk.cyan(`${featurePath}/research.md`)}`)
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray(`  adk feature plan ${name}`))
    } catch (error) {
      spinner.fail('Erro no research')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async plan(name: string): Promise<void> {
    const spinner = ora('Criando plano de implementação...').start()

    try {
      const featurePath = path.join(process.cwd(), '.claude/plans/features', name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${name} não encontrada`)
        process.exit(1)
      }

      const researchPath = path.join(featurePath, 'research.md')
      if (!(await fs.pathExists(researchPath))) {
        spinner.fail(`Execute research primeiro: adk feature research ${name}`)
        process.exit(1)
      }

      const prompt = `
PHASE 2: DETAILED PLANNING

Input: .claude/plans/features/${name}/research.md
PRD: .claude/plans/features/${name}/prd.md

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

      spinner.text = 'Validando spec...'

      const specPath = path.join(process.cwd(), '.claude/specs', `${name}.md`)
      const hasSpec = await fs.pathExists(specPath)

      if (!hasSpec) {
        spinner.warn('Spec não encontrada. Gerando template...')

        const specDir = path.join(process.cwd(), '.claude/specs')
        await fs.ensureDir(specDir)

        const specTemplate = generateSpecTemplate(name)
        await fs.writeFile(specPath, specTemplate)

        console.log()
        console.log(chalk.yellow('Spec Gate: Uma spec é necessária antes da implementação.'))
        console.log(chalk.gray(`  Template criado em: ${specPath}`))
        console.log()
        console.log(chalk.cyan('Próximos passos:'))
        console.log(chalk.gray('  1. Preencha a spec com os detalhes da feature'))
        console.log(chalk.gray(`  2. Execute: adk spec validate ${name}`))
        console.log(chalk.gray(`  3. Execute: adk feature implement ${name}`))
        process.exit(0)
      }

      const specContent = await fs.readFile(specPath, 'utf-8')
      const parsedSpec = parseSpecFromMarkdown(specContent)
      const validation = validateSpec(parsedSpec)

      if (!validation.valid) {
        spinner.fail('Spec inválida')
        console.log()
        console.log(chalk.red('Spec Gate: A spec precisa ser válida antes da implementação.'))
        console.log()
        console.log(chalk.yellow('Erros:'))
        for (const error of validation.errors) {
          console.log(chalk.red(`  - ${error.field}: ${error.message}`))
        }
        console.log()
        console.log(chalk.gray(`Edite: ${specPath}`))
        console.log(chalk.gray(`Valide: adk spec validate ${name}`))
        process.exit(1)
      }

      if (validation.warnings.length > 0) {
        console.log()
        console.log(chalk.yellow('Avisos da spec:'))
        for (const warning of validation.warnings) {
          console.log(chalk.yellow(`  - ${warning}`))
        }
        console.log()
      }

      spinner.text = 'Spec válida. Iniciando implementação...'

      let phase = options.phase || 'all'

      if (phase === 'all') {
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'phase',
            message: 'Qual fase implementar?',
            choices: ['All', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'],
          },
        ])
        phase = answers.phase
      }

      const prompt = `
PHASE 3: IMPLEMENTATION (TDD)

Feature: ${name}
Implementation Plan: .claude/plans/features/${name}/implementation-plan.md
Target Phase: ${phase}

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

      await this.setActiveFocus(name, 'implementação em andamento')
      await memoryCommand.save(name, { phase: 'implement' })

      console.log()
      logger.success(`✨ ${phase} implementada!`)
    } catch (error) {
      spinner.fail('Erro na implementação')
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

          if (!hasProgressFile) {
            if (hasPrd) {
              progress = updateStepStatus(progress, 'entendimento', 'completed')
            }
            if (hasTasks) {
              progress = updateStepStatus(progress, 'breakdown', 'completed')
            }
            if (hasPlan) {
              progress = updateStepStatus(progress, 'arquitetura', 'completed')
            }
            if (hasMemory) {
              const memContent = await fs.readFile(memoryPath, 'utf-8')
              if (memContent.includes('**Status**: completed')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
                progress = updateStepStatus(progress, 'revisao', 'completed')
                progress = updateStepStatus(progress, 'documentacao', 'completed')
              } else if (memContent.includes('**Fase Atual**: implement')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
              } else if (memContent.includes('**Fase Atual**: qa')) {
                progress = updateStepStatus(progress, 'implementacao', 'completed')
                progress = updateStepStatus(progress, 'revisao', 'in_progress')
              }
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
            entendimento: 'PRD',
            breakdown: 'Tasks',
            arquitetura: 'Arquitetura',
            implementacao: 'Implementacao',
            revisao: 'Revisao',
            documentacao: 'Docs',
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
    console.log(chalk.bold.magenta('🚀 ADK Autopilot'))
    console.log(chalk.gray('━'.repeat(50)))
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

    const contextContent = await this.loadContext(options)

    let progress = await loadProgress(name)

    if (state.hasPrd && !isStepCompleted(progress, 'entendimento')) {
      progress = updateStepStatus(progress, 'entendimento', 'completed')
    }
    if (state.hasTasks && !isStepCompleted(progress, 'breakdown')) {
      progress = updateStepStatus(progress, 'breakdown', 'completed')
    }
    if (state.hasPlan && !isStepCompleted(progress, 'arquitetura')) {
      progress = updateStepStatus(progress, 'arquitetura', 'completed')
    }
    await saveProgress(name, progress)

    const getStatusIcon = (stepName: string): string => {
      const step = progress.steps.find((s) => s.name === stepName)
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

    const printProgress = () => {
      console.log(chalk.gray('\n📋 Progresso:'))
      const stepNames = [
        { key: 'entendimento', label: 'Entendimento' },
        { key: 'breakdown', label: 'Breakdown' },
        { key: 'arquitetura', label: 'Arquitetura' },
        { key: 'implementacao', label: 'Implementação' },
        { key: 'revisao', label: 'Revisão' },
        { key: 'documentacao', label: 'Documentação' },
      ]
      for (const { key, label } of stepNames) {
        console.log(`   ${getStatusIcon(key)} ${label}`)
      }
      console.log()
    }

    const contextSection = contextContent
      ? `
## Contexto Fornecido pelo Usuario

<context>
${contextContent}
</context>

Use este contexto para entender melhor o que o usuario precisa. Ainda assim, faca perguntas para clarificar pontos importantes.
`
      : ''

    try {
      await fs.ensureDir(featurePath)

      printProgress()

      if (!isStepCompleted(progress, 'entendimento')) {
        progress = updateStepStatus(progress, 'entendimento', 'in_progress')
        await saveProgress(name, progress)

        console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════'))
        console.log(chalk.bold.cyan('  ETAPA 1: ENTENDIMENTO DA FEATURE'))
        console.log(chalk.bold.cyan('═══════════════════════════════════════════════════\n'))

        const prdPrompt = `
AUTOPILOT - ETAPA 1: ENTENDIMENTO

Voce e um Product Manager senior. Precisa entender completamente a feature "${name}".
${contextSection}
## OBRIGATORIO: Faca perguntas ANTES de criar o PRD

Pergunte ao usuario:

1. **Problema**: Qual problema esta feature resolve?
2. **Usuarios**: Quem vai usar? (tipo de usuario, frequencia)
3. **Requisitos criticos**: O que DEVE funcionar? (lista os must-haves)
4. **Restricoes**: Ha limitacoes tecnicas, de tempo ou orcamento?
5. **Sucesso**: Como saber se funcionou? (metricas)

## Apos receber respostas, crie:

Output: .claude/plans/features/${name}/prd.md

Estrutura:
- Contexto e Problema
- Usuarios e Personas
- Requisitos Funcionais (com Gherkin)
- Requisitos Nao-Funcionais
- Metricas de Sucesso
- Non-Goals (o que NAO sera feito)
- Riscos

IMPORTANTE: NAO invente respostas. PERGUNTE ao usuario.
`

        await executeClaudeCommand(prdPrompt)

        if (!(await fs.pathExists(prdPath))) {
          progress = updateStepStatus(progress, 'entendimento', 'failed', 'PRD não foi criado')
          await saveProgress(name, progress)
          logger.error('PRD não foi criado. Abortando.')
          process.exit(1)
        }

        progress = updateStepStatus(progress, 'entendimento', 'completed')
        await saveProgress(name, progress)

        const { continueFlow } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueFlow',
            message: 'PRD criado. Revisar e continuar para breakdown?',
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

      if (!isStepCompleted(progress, 'breakdown')) {
        progress = updateStepStatus(progress, 'breakdown', 'in_progress')
        await saveProgress(name, progress)

        console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════'))
        console.log(chalk.bold.cyan('  ETAPA 2: BREAKDOWN EM TASKS'))
        console.log(chalk.bold.cyan('═══════════════════════════════════════════════════\n'))

        const taskPrompt = `
AUTOPILOT - ETAPA 2: TASK BREAKDOWN

Feature: ${name}
PRD: .claude/plans/features/${name}/prd.md

## Workflow

1. Leia o PRD completamente
2. Extraia requisitos funcionais
3. Quebre em tasks atomicas e testaveis
4. Ordene: testes ANTES de implementacao (TDD)
5. Identifique dependencias

## Output: .claude/plans/features/${name}/tasks.md

Estrutura:
\`\`\`markdown
# Tasks: ${name}

## Task 1: [nome]
- Tipo: Test | Implementation | Config
- Prioridade: P0 | P1 | P2
- Dependencias: [lista]
- Acceptance Criteria:
  - [ ] Criterio 1
  - [ ] Criterio 2

## Task 2: [nome]
...
\`\`\`

IMPORTANTE: Testes SEMPRE vem antes da implementacao correspondente.
`

        await executeClaudeCommand(taskPrompt)
        progress = updateStepStatus(progress, 'breakdown', 'completed')
        await saveProgress(name, progress)
      } else {
        console.log(chalk.green('✓ Tasks já existem, pulando etapa 2'))
      }

      if (!isStepCompleted(progress, 'arquitetura')) {
        progress = updateStepStatus(progress, 'arquitetura', 'in_progress')
        await saveProgress(name, progress)

        console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════'))
        console.log(chalk.bold.cyan('  ETAPA 3: ARQUITETURA'))
        console.log(chalk.bold.cyan('═══════════════════════════════════════════════════\n'))

        const architectPrompt = `
AUTOPILOT - ETAPA 3: ARQUITETURA

Feature: ${name}
PRD: .claude/plans/features/${name}/prd.md
Tasks: .claude/plans/features/${name}/tasks.md

## Workflow

1. Leia PRD e Tasks
2. Analise arquitetura atual do projeto
3. Identifique padroes existentes
4. Projete a arquitetura da feature

## OBRIGATORIO: Mostre a arquitetura visualmente

Desenhe usando ASCII:

\`\`\`
┌─────────────────────────────────────────────────────┐
│                   ARQUITETURA                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│   [Component A] ──────► [Component B]               │
│        │                     │                      │
│        ▼                     ▼                      │
│   [Component C] ◄────── [Component D]               │
│                                                     │
└─────────────────────────────────────────────────────┘
\`\`\`

## Output: .claude/plans/features/${name}/implementation-plan.md

Inclua:
1. Diagrama ASCII da arquitetura
2. Camadas afetadas
3. Arquivos a criar/modificar
4. Padroes a seguir (com exemplos do codebase)
5. Riscos e mitigacoes
6. Ordem de implementacao

IMPORTANTE:
- Mostre o diagrama da arquitetura CLARAMENTE
- Use caixas ASCII para visualizacao
- Explique o fluxo de dados
`

        await executeClaudeCommand(architectPrompt)
        progress = updateStepStatus(progress, 'arquitetura', 'completed')
        await saveProgress(name, progress)
      } else {
        console.log(chalk.green('✓ Arquitetura já existe, pulando etapa 3'))
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
          message: 'Arquitetura definida. Iniciar implementacao (TDD)?',
          default: true,
        },
      ])

      if (!continueImplement) {
        printProgress()
        console.log(chalk.yellow('\nAutopilot pausado. Continue manualmente com:'))
        console.log(chalk.gray(`  adk feature implement ${name}`))
        return
      }

      if (!isStepCompleted(progress, 'implementacao')) {
        progress = updateStepStatus(progress, 'implementacao', 'in_progress')
        await saveProgress(name, progress)

        console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════'))
        console.log(chalk.bold.cyan('  ETAPA 4: IMPLEMENTACAO (TDD)'))
        console.log(chalk.bold.cyan('═══════════════════════════════════════════════════\n'))

        const implementPrompt = `
AUTOPILOT - ETAPA 4: IMPLEMENTACAO

Feature: ${name}
Plan: .claude/plans/features/${name}/implementation-plan.md
Tasks: .claude/plans/features/${name}/tasks.md

## Workflow TDD OBRIGATORIO

Para CADA task:

1. RED: Escreva o teste primeiro
   - Teste deve falhar
   - Commit: "test: add test for [funcionalidade]"

2. GREEN: Implemente o minimo
   - Faca o teste passar
   - Commit: "feat: implement [funcionalidade]"

3. REFACTOR: Melhore se necessario
   - Mantenha testes passando
   - Commit: "refactor: improve [o que melhorou]"

## Verificacao apos cada task

- [ ] Teste passa?
- [ ] Sem erros de lint?
- [ ] Codigo segue padroes do projeto?

## Output

- Arquivos de teste criados
- Implementacao funcionando
- Todos testes passando
`

        await executeClaudeCommand(implementPrompt)
        progress = updateStepStatus(progress, 'implementacao', 'completed')
        await saveProgress(name, progress)
      } else {
        console.log(chalk.green('✓ Implementação já concluída, pulando etapa 4'))
      }

      if (!isStepCompleted(progress, 'revisao')) {
        progress = updateStepStatus(progress, 'revisao', 'in_progress')
        await saveProgress(name, progress)

        console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════'))
        console.log(chalk.bold.cyan('  ETAPA 5: REVISAO'))
        console.log(chalk.bold.cyan('═══════════════════════════════════════════════════\n'))

        const reviewPrompt = `
AUTOPILOT - ETAPA 5: REVISAO

Feature: ${name}

## Checklist de Revisao

### Qualidade
- [ ] Codigo legivel e bem estruturado?
- [ ] Sem codigo duplicado?
- [ ] Tratamento de erros adequado?

### Testes
- [ ] Coverage >= 80%?
- [ ] Happy path testado?
- [ ] Edge cases cobertos?
- [ ] Erros testados?

### Seguranca
- [ ] Input validado?
- [ ] Sem SQL injection?
- [ ] Sem XSS?
- [ ] Secrets nao expostos?

### Performance
- [ ] Sem loops desnecessarios?
- [ ] Queries otimizadas?
- [ ] Sem memory leaks obvios?

## Output

Se encontrar problemas:
- Liste cada issue com arquivo:linha
- Classifique: CRITICAL | HIGH | MEDIUM | LOW
- Sugira correcao

Se OK:
- Confirme que passou em todos os checks
`

        await executeClaudeCommand(reviewPrompt)
        progress = updateStepStatus(progress, 'revisao', 'completed')
        await saveProgress(name, progress)
      } else {
        console.log(chalk.green('✓ Revisão já concluída, pulando etapa 5'))
      }

      if (!isStepCompleted(progress, 'documentacao')) {
        progress = updateStepStatus(progress, 'documentacao', 'in_progress')
        await saveProgress(name, progress)

        console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════'))
        console.log(chalk.bold.cyan('  ETAPA 6: DOCUMENTACAO'))
        console.log(chalk.bold.cyan('═══════════════════════════════════════════════════\n'))

        const docPrompt = `
AUTOPILOT - ETAPA 6: DOCUMENTACAO

Feature: ${name}

## Gere documentacao para:

### 1. README da feature (se aplicavel)
- O que faz
- Como usar
- Exemplos

### 2. Atualize documentacao existente
- Se modificou APIs, atualize docs de API
- Se adicionou comandos, documente

### 3. Comentarios no codigo
- Apenas onde logica nao e obvia
- JSDoc para funcoes publicas importantes

## Output

- Documentacao clara e util
- Exemplos que funcionam
- Sem documentacao de codigo obvio
`

        await executeClaudeCommand(docPrompt)
        progress = updateStepStatus(progress, 'documentacao', 'completed')
        await saveProgress(name, progress)
      } else {
        console.log(chalk.green('✓ Documentação já concluída, pulando etapa 6'))
      }

      console.log(chalk.bold.green('\n═══════════════════════════════════════════════════'))
      console.log(chalk.bold.green('  ✨ AUTOPILOT COMPLETO!'))
      console.log(chalk.bold.green('═══════════════════════════════════════════════════\n'))

      await memoryCommand.save(name, { phase: 'implement' })

      printProgress()

      console.log(chalk.cyan('Arquivos gerados:'))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/prd.md`))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/tasks.md`))
      console.log(chalk.gray(`  📄 .claude/plans/features/${name}/implementation-plan.md`))
      console.log()
      console.log(chalk.yellow('Proximos passos:'))
      console.log(chalk.gray('  1. Revise os arquivos gerados'))
      console.log(chalk.gray(`  2. Execute: adk workflow qa ${name}`))
      console.log(chalk.gray(`  3. Execute: adk workflow pre-deploy -f ${name}`))
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
