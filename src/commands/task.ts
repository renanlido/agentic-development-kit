import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'
import { parseTasksForParallel, updateTaskStatusInFile } from '../utils/task-parser'

interface TaskAddOptions {
  description?: string
  feature?: string
  type?: string
  estimate?: string
  dependencies?: string
  sync?: boolean
}

interface TaskStatusOptions {
  feature?: string
}

class TaskCommand {
  private program: Command

  constructor() {
    this.program = new Command('task')
      .description('Manage tasks for features (AI-friendly interface)')

    this.setupCommands()
  }

  private setupCommands(): void {
    this.program
      .command('add')
      .description('Add a new task to the current feature')
      .option('-d, --description <text>', 'Task description (required for AI usage)')
      .option('-f, --feature <name>', 'Feature name (auto-detects from active-focus if not provided)')
      .option('-t, --type <type>', 'Task type: Feature, Refactor, Bugfix, Config, Docs, Test', 'Feature')
      .option('-e, --estimate <size>', 'Estimate: P (small), M (medium), G (large)', 'M')
      .option('--deps <ids>', 'Comma-separated dependency task IDs (e.g., "1,2,3")')
      .option('--sync', 'Sync with PRD and other docs using AI agent')
      .action((options: TaskAddOptions) => this.addTask(options))

    this.program
      .command('list')
      .description('List all tasks for a feature')
      .option('-f, --feature <name>', 'Feature name')
      .action((options: TaskStatusOptions) => this.listTasks(options))

    this.program
      .command('status')
      .description('Show task completion status')
      .option('-f, --feature <name>', 'Feature name')
      .action((options: TaskStatusOptions) => this.showStatus(options))

    this.program
      .command('complete <taskId>')
      .description('Mark a task as completed')
      .option('-f, --feature <name>', 'Feature name')
      .action((taskId: string, options: TaskStatusOptions) => this.markComplete(taskId, options))

    this.program
      .command('sync')
      .description('Sync tasks with PRD and other feature docs using AI')
      .option('-f, --feature <name>', 'Feature name')
      .action((options: TaskStatusOptions) => this.syncDocs(options))
  }

  private async getActiveFeature(): Promise<string | null> {
    const activeFocusPath = path.join(process.cwd(), '.claude', 'active-focus.md')
    if (await fs.pathExists(activeFocusPath)) {
      const content = await fs.readFile(activeFocusPath, 'utf-8')
      const match = content.match(/feature:\s*(\S+)/i) || content.match(/name:\s*(\S+)/i)
      if (match) {
        return match[1]
      }
    }
    return null
  }

  private getFeaturePath(name: string): string {
    return path.join(process.cwd(), '.claude', 'plans', 'features', name)
  }

  private async addTask(options: TaskAddOptions): Promise<void> {
    let featureName = options.feature

    if (!featureName) {
      featureName = (await this.getActiveFeature()) ?? undefined
    }

    if (!featureName) {
      const features = await this.listFeatures()
      if (features.length === 0) {
        logger.error('No features found. Create one first with: adk feature new <name>')
        process.exit(1)
      }

      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Select feature:',
          choices: features,
        },
      ])
      featureName = selected
    }

    const featurePath = this.getFeaturePath(featureName!)
    const tasksPath = path.join(featurePath, 'tasks.md')

    if (!(await fs.pathExists(tasksPath))) {
      logger.error(`tasks.md not found for feature "${featureName}"`)
      logger.info(`Run: adk feature tasks ${featureName}`)
      process.exit(1)
    }

    let description = options.description

    if (!description) {
      const { desc } = await inquirer.prompt([
        {
          type: 'input',
          name: 'desc',
          message: 'Task description:',
          validate: (input: string) => input.trim().length > 0 || 'Description is required',
        },
      ])
      description = desc
    }

    const spinner = ora('Adding task...').start()

    try {
      const content = await fs.readFile(tasksPath, 'utf-8')
      const doc = parseTasksForParallel(content, featureName!)

      const newTaskId = doc.totalTasks + 1
      const deps = options.dependencies
        ? options.dependencies.split(',').map((d) => d.trim())
        : []
      const depsStr = deps.length > 0 ? `Task ${deps.join(', Task ')}` : 'nenhuma'

      const newTaskContent = `

---

### Task ${newTaskId}: ${description}

**Tipo:** ${options.type || 'Feature'}
**Estimativa:** ${options.estimate || 'M'}
**Dependências:** ${depsStr}

#### Escopo
- O que FAZER:
  - ${description}
- O que NÃO FAZER:
  - (definir durante implementação)

#### Critérios de Aceite
- [ ] Implementação completa
- [ ] Testes passando
- [ ] Code review aprovado

#### Arquivos Envolvidos
- (a definir)
`

      const updatedContent = content.trimEnd() + newTaskContent
      await fs.writeFile(tasksPath, updatedContent)

      spinner.succeed(chalk.green(`Task ${newTaskId} added: ${description}`))

      console.log()
      console.log(chalk.gray(`   Feature: ${featureName}`))
      console.log(chalk.gray(`   Type: ${options.type || 'Feature'}`))
      console.log(chalk.gray(`   Estimate: ${options.estimate || 'M'}`))
      if (deps.length > 0) {
        console.log(chalk.gray(`   Dependencies: ${deps.join(', ')}`))
      }

      if (options.sync) {
        console.log()
        await this.syncDocs({ feature: featureName })
      }
    } catch (error) {
      spinner.fail('Failed to add task')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async listTasks(options: TaskStatusOptions): Promise<void> {
    let featureName = options.feature || (await this.getActiveFeature())

    if (!featureName) {
      logger.error('No feature specified. Use -f <name> or set active focus.')
      process.exit(1)
    }

    const featurePath = this.getFeaturePath(featureName)
    const tasksPath = path.join(featurePath, 'tasks.md')

    if (!(await fs.pathExists(tasksPath))) {
      logger.error(`tasks.md not found for feature "${featureName}"`)
      process.exit(1)
    }

    const content = await fs.readFile(tasksPath, 'utf-8')
    const doc = parseTasksForParallel(content, featureName)

    console.log()
    console.log(chalk.cyan.bold(`Tasks: ${featureName}`))
    console.log(chalk.gray('─'.repeat(60)))

    for (const task of doc.tasks) {
      const icon =
        task.status === 'completed'
          ? chalk.green('✓')
          : task.status === 'in_progress'
            ? chalk.yellow('◐')
            : chalk.gray('○')

      const statusColor =
        task.status === 'completed'
          ? chalk.green
          : task.status === 'in_progress'
            ? chalk.yellow
            : chalk.white

      console.log(`${icon} ${statusColor(`Task ${task.id}`)}: ${task.title}`)
      if (task.dependencies.length > 0) {
        console.log(chalk.gray(`   deps: ${task.dependencies.join(', ')}`))
      }
    }

    console.log()
    console.log(chalk.gray(`Total: ${doc.totalTasks} | Completed: ${doc.completedTasks} | Pending: ${doc.pendingTasks}`))
  }

  private async showStatus(options: TaskStatusOptions): Promise<void> {
    let featureName = options.feature || (await this.getActiveFeature())

    if (!featureName) {
      logger.error('No feature specified. Use -f <name> or set active focus.')
      process.exit(1)
    }

    const featurePath = this.getFeaturePath(featureName)
    const tasksPath = path.join(featurePath, 'tasks.md')

    if (!(await fs.pathExists(tasksPath))) {
      logger.error(`tasks.md not found for feature "${featureName}"`)
      process.exit(1)
    }

    const content = await fs.readFile(tasksPath, 'utf-8')
    const doc = parseTasksForParallel(content, featureName)

    const percentage = Math.round((doc.completedTasks / doc.totalTasks) * 100)
    const barLength = 30
    const filledLength = Math.round((percentage / 100) * barLength)
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)

    console.log()
    console.log(chalk.cyan.bold(`Feature: ${featureName}`))
    console.log()
    console.log(`Progress: [${chalk.green(bar)}] ${percentage}%`)
    console.log()
    console.log(`  ${chalk.green('✓')} Completed:   ${doc.completedTasks}`)
    console.log(`  ${chalk.yellow('◐')} In Progress: ${doc.tasks.filter((t) => t.status === 'in_progress').length}`)
    console.log(`  ${chalk.gray('○')} Pending:     ${doc.pendingTasks}`)
    console.log(`  ${chalk.cyan('Σ')} Total:       ${doc.totalTasks}`)
  }

  private async markComplete(taskId: string, options: TaskStatusOptions): Promise<void> {
    let featureName = options.feature || (await this.getActiveFeature())

    if (!featureName) {
      logger.error('No feature specified. Use -f <name> or set active focus.')
      process.exit(1)
    }

    const featurePath = this.getFeaturePath(featureName)
    const tasksPath = path.join(featurePath, 'tasks.md')

    const spinner = ora(`Marking task ${taskId} as completed...`).start()

    try {
      const updated = await updateTaskStatusInFile(tasksPath, taskId, 'completed')

      if (updated) {
        spinner.succeed(chalk.green(`Task ${taskId} marked as completed`))
      } else {
        spinner.warn(`Task ${taskId} was already completed or not found`)
      }
    } catch (error) {
      spinner.fail('Failed to update task')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async syncDocs(options: TaskStatusOptions): Promise<void> {
    let featureName = options.feature || (await this.getActiveFeature())

    if (!featureName) {
      logger.error('No feature specified. Use -f <name> or set active focus.')
      process.exit(1)
    }

    const featurePath = this.getFeaturePath(featureName)
    const spinner = ora('Syncing documentation with AI...').start()

    const prdPath = path.join(featurePath, 'prd.md')
    const tasksPath = path.join(featurePath, 'tasks.md')
    const planPath = path.join(featurePath, 'implementation-plan.md')

    const hasPrd = await fs.pathExists(prdPath)
    const hasTasks = await fs.pathExists(tasksPath)
    const hasPlan = await fs.pathExists(planPath)

    if (!hasTasks) {
      spinner.fail('tasks.md not found')
      process.exit(1)
    }

    const tasksContent = await fs.readFile(tasksPath, 'utf-8')
    const prdContent = hasPrd ? await fs.readFile(prdPath, 'utf-8') : ''
    const planContent = hasPlan ? await fs.readFile(planPath, 'utf-8') : ''

    const prompt = `You are a documentation sync agent. Your job is to ensure consistency between feature documents.

## Feature: ${featureName}

## Current tasks.md:
\`\`\`markdown
${tasksContent.slice(0, 5000)}
\`\`\`

${hasPrd ? `## Current prd.md:\n\`\`\`markdown\n${prdContent.slice(0, 3000)}\n\`\`\`\n` : ''}

${hasPlan ? `## Current implementation-plan.md:\n\`\`\`markdown\n${planContent.slice(0, 3000)}\n\`\`\`\n` : ''}

## Instructions:

1. Analyze if tasks.md has any new tasks that are not reflected in the PRD or implementation plan
2. If there are inconsistencies, update the relevant documents to maintain alignment
3. Focus on:
   - Adding new functional requirements to PRD if needed
   - Updating implementation plan with new tasks
   - Ensuring acceptance criteria are aligned

4. If documents are already aligned, just confirm that.

5. Use the Write tool to update any files that need changes.

Be concise. Only make necessary changes.`

    spinner.text = 'AI agent analyzing documentation...'

    try {
      await executeClaudeCommand(prompt, {
        headless: true,
        showProgress: false,
      })

      spinner.succeed(chalk.green('Documentation sync complete'))
    } catch (error) {
      spinner.fail('Sync failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }

  private async listFeatures(): Promise<string[]> {
    const featuresPath = path.join(process.cwd(), '.claude', 'plans', 'features')
    if (!(await fs.pathExists(featuresPath))) {
      return []
    }

    const entries = await fs.readdir(featuresPath, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  }

  public getCommand(): Command {
    return this.program
  }
}

export const taskCommand = new TaskCommand()
export default taskCommand.getCommand()
