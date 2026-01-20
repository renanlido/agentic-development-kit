import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { statusToPhase } from '../providers/clickup/mapper.js'
import type { RemoteFeature } from '../providers/types.js'
import { loadConfig } from '../utils/config.js'
import { getClaudePath, getMainRepoPath } from '../utils/git-paths.js'

interface ImportOptions {
  list?: boolean
  dryRun?: boolean
  force?: boolean
  id?: string
}

interface ImportProgress {
  feature: string
  currentPhase: string
  steps: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
  lastUpdated: string
  remoteId: string
  syncStatus: 'synced'
  lastSynced: string
}

const DEFAULT_STEPS = [
  { name: 'prd', status: 'pending' as const },
  { name: 'research', status: 'pending' as const },
  { name: 'tasks', status: 'pending' as const },
  { name: 'arquitetura', status: 'pending' as const },
  { name: 'implementacao', status: 'pending' as const },
  { name: 'qa', status: 'pending' as const },
  { name: 'docs', status: 'pending' as const },
]

export class ImportCommand {
  private log(message: string): void {
    console.log(message)
  }

  async run(options: ImportOptions): Promise<void> {
    const spinner = ora('Importing features from remote...').start()

    try {
      const config = await loadConfig()
      const { integration, providers } = config

      if (!integration.enabled || !integration.provider) {
        spinner.stop()
        this.log(chalk.yellow('No integration configured. Run: adk config integration'))
        return
      }

      const projectRoot = getMainRepoPath()
      const envPath = path.join(projectRoot, '.env')
      const envExists = await fs.pathExists(envPath)

      let apiToken: string | undefined
      if (envExists) {
        const envContent = await fs.readFile(envPath, 'utf-8')
        const tokenMatch = envContent.match(/CLICKUP_API_TOKEN=(.+)/)
        apiToken = tokenMatch?.[1]
      }

      if (!apiToken) {
        spinner.stop()
        this.log(chalk.red('No CLICKUP_API_TOKEN found. Set it in .env file'))
        return
      }

      const providerConfig = providers[integration.provider]
      if (!providerConfig?.listId) {
        spinner.stop()
        this.log(chalk.yellow('Provider not fully configured. Run: adk config integration'))
        return
      }

      const { createClickUpProvider } = await import('../providers/clickup/index.js')
      const provider = createClickUpProvider()

      const connectResult = await provider.connect({ token: apiToken })
      if (!connectResult.success) {
        spinner.stop()
        this.log(chalk.red('Failed to connect to ClickUp'))
        return
      }

      let tasks: RemoteFeature[]

      if (options.id) {
        spinner.text = `Fetching task ${options.id}...`
        const task = await provider.getFeature(options.id)
        if (!task) {
          spinner.stop()
          this.log(chalk.red(`Task ${options.id} not found or doesn't exist`))
          return
        }
        tasks = [task]
      } else {
        spinner.text = 'Fetching tasks from ClickUp...'
        tasks = await provider.getTasks(providerConfig.listId)
      }

      if (tasks.length === 0) {
        spinner.stop()
        this.log(chalk.yellow('No tasks found. Nothing to import.'))
        return
      }

      if (options.list) {
        spinner.stop()
        this.log(chalk.bold('\nAvailable tasks from ClickUp:'))
        this.log('')
        for (const task of tasks) {
          const phase = task.phase || this.statusToPhase(task.status || 'to do')
          this.log(`  ${chalk.cyan(task.id)} - ${task.name} (${chalk.gray(phase)})`)
        }
        this.log('')
        return
      }

      if (options.dryRun) {
        spinner.stop()
        this.log(chalk.bold('\n[Dry Run] Would import the following tasks:'))
        this.log('')
        for (const task of tasks) {
          const sanitizedName = this.sanitizeName(task.name)
          this.log(`  - ${task.name} -> ${chalk.cyan(sanitizedName)}`)
        }
        this.log('')
        return
      }

      const featuresDir = path.join(getClaudePath(), 'plans', 'features')
      await fs.ensureDir(featuresDir)

      let imported = 0
      let skipped = 0

      for (const task of tasks) {
        const sanitizedName = this.sanitizeName(task.name)
        const featurePath = path.join(featuresDir, sanitizedName)
        const progressPath = path.join(featurePath, 'progress.json')

        const exists = await fs.pathExists(progressPath)

        if (exists && !options.force) {
          skipped++
          continue
        }

        await fs.ensureDir(featurePath)

        const phase = task.phase || this.statusToPhase(task.status || 'to do')
        const progress = this.createProgress(sanitizedName, task.id, phase, task.progress)

        await fs.writeJson(progressPath, progress, { spaces: 2 })
        imported++
      }

      spinner.succeed(`Imported ${imported} feature(s)`)
      this.log(`  Imported ${imported} feature(s) from remote`)

      if (skipped > 0) {
        this.log(
          chalk.yellow(`  ${skipped} feature(s) skipped (already exist). Use --force to overwrite.`)
        )
      }
    } catch (error) {
      spinner.fail('Failed to import features')
      this.log(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`))
    }
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  private statusToPhase(status: string): string {
    return statusToPhase(status)
  }

  private createProgress(
    featureName: string,
    remoteId: string,
    phase: string,
    _progress?: number
  ): ImportProgress {
    const steps = DEFAULT_STEPS.map((step) => {
      const phaseIndex = this.getPhaseIndex(phase)
      const stepIndex = this.getPhaseIndex(step.name)

      let status: 'pending' | 'in_progress' | 'completed' = 'pending'
      if (stepIndex < phaseIndex) {
        status = 'completed'
      } else if (stepIndex === phaseIndex) {
        status = 'in_progress'
      }

      return { ...step, status }
    })

    return {
      feature: featureName,
      currentPhase: phase,
      steps,
      lastUpdated: new Date().toISOString(),
      remoteId,
      syncStatus: 'synced',
      lastSynced: new Date().toISOString(),
    }
  }

  private getPhaseIndex(phase: string): number {
    const phases = [
      'prd',
      'research',
      'tasks',
      'arquitetura',
      'implementacao',
      'qa',
      'docs',
      'implement',
      'done',
    ]
    const normalizedPhase = phase === 'implement' ? 'implementacao' : phase
    const index = phases.indexOf(normalizedPhase)
    return index >= 0 ? index : 0
  }
}

export const importCommand = new ImportCommand()
