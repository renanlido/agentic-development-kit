import chalk from 'chalk'
import { ModelType } from '../types/model'
import type {
  EnhancedTask,
  OrchestratorOptions,
  OrchestratorResult,
  WaveExecutionOptions,
  WaveExecutionResult,
} from '../types/parallel'
import { upgradeModelForRetry } from './agent-router'
import {
  aggregateWaveResults,
  createOrchestratorResult,
  formatMetricsSummary,
} from './result-aggregator'
import {
  analyzeTaskComplexity,
  type ParsedTaskForParallel,
} from './task-parser'
import {
  type Wave,
  executeWaveWithProgress,
  formatWaveResult,
} from './wave-executor'
import {
  type SchedulePlan,
  createSchedulePlan,
} from './wave-scheduler'

export interface WaveOrchestratorConfig {
  featureName: string
  tasks: ParsedTaskForParallel[]
  options: OrchestratorOptions
}

export class WaveOrchestrator {
  private waves: Wave[] = []
  private results: WaveExecutionResult[] = []
  private featureName: string
  private options: OrchestratorOptions
  private enhancedTasks: EnhancedTask[] = []
  private startTime: number = 0

  constructor(config: WaveOrchestratorConfig) {
    this.featureName = config.featureName
    this.options = config.options
    this.enhancedTasks = this.enhanceTasks(config.tasks)

    const schedulerConfig = {
      maxParallelTasks: config.options.maxParallel,
      forceSequential: ['migration', 'seed', 'config', 'setup', 'infraestrutura'],
      prioritizeByEstimate: true,
    }

    const plan = createSchedulePlan(
      {
        featureName: this.featureName,
        tasks: config.tasks,
        totalTasks: config.tasks.length,
        completedTasks: config.tasks.filter((t) => t.status === 'completed').length,
        pendingTasks: config.tasks.filter((t) => t.status === 'pending').length,
      },
      schedulerConfig
    )

    this.waves = this.convertPlanToWaves(plan)
  }

  private enhanceTasks(tasks: ParsedTaskForParallel[]): EnhancedTask[] {
    return tasks.map((task) => {
      const complexity = analyzeTaskComplexity(task.title, '', task.files)

      let model: ModelType
      if (this.options.modelOptimize) {
        model = complexity.recommendedModel
      } else {
        model = ModelType.OPUS
      }

      return {
        id: task.id,
        title: task.title,
        type: task.type,
        status: task.status,
        dependencies: task.dependencies,
        files: task.files,
        estimate: task.estimate,
        complexity,
        model,
        agentType: 'feature-developer',
        retryCount: 0,
      }
    })
  }

  private convertPlanToWaves(plan: SchedulePlan): Wave[] {
    return plan.waves.map((wave, index) => ({
      index: index + 1,
      tasks: wave.tasks.map((task) => {
        const enhanced = this.enhancedTasks.find((t) => t.id === task.id)
        return enhanced || this.createDefaultEnhancedTask(task)
      }),
      parallelizable: wave.parallelizable,
      conflicts: wave.conflicts,
    }))
  }

  private createDefaultEnhancedTask(task: ParsedTaskForParallel): EnhancedTask {
    const complexity = analyzeTaskComplexity(task.title, '', task.files)
    return {
      id: task.id,
      title: task.title,
      type: task.type,
      status: task.status,
      dependencies: task.dependencies,
      files: task.files,
      estimate: task.estimate,
      complexity,
      model: ModelType.OPUS,
      agentType: 'feature-developer',
      retryCount: 0,
    }
  }

  async execute(): Promise<OrchestratorResult> {
    this.startTime = Date.now()
    this.displayExecutionStart()

    const waveOptions: WaveExecutionOptions = {
      useWorktrees: this.options.isolate,
      timeout: this.options.timeout,
      retryOnFailure: this.options.retryFailed,
      maxRetries: 2,
      stopOnError: this.options.stopOnError,
    }

    for (const wave of this.waves) {
      const result = await executeWaveWithProgress(wave, this.featureName, waveOptions)
      this.results.push(result)

      console.log(formatWaveResult(result))

      if (this.options.retryFailed && !result.success) {
        await this.retryFailedTasks(wave, result, waveOptions)
      }

      if (this.options.stopOnError && !result.success) {
        console.log(chalk.red('\nStopping execution due to wave failure'))
        break
      }
    }

    const totalDuration = Date.now() - this.startTime
    const orchestratorResult = createOrchestratorResult(this.results, totalDuration)

    this.displayExecutionSummary(orchestratorResult)

    return orchestratorResult
  }

  private async retryFailedTasks(
    wave: Wave,
    result: WaveExecutionResult,
    waveOptions: WaveExecutionOptions
  ): Promise<void> {
    const failedTasks = result.tasks.filter((t) => !t.success)

    if (failedTasks.length === 0) return

    console.log(chalk.yellow(`\nRetrying ${failedTasks.length} failed tasks with upgraded models...`))

    for (const failed of failedTasks) {
      const task = wave.tasks.find((t) => t.id === failed.taskId)
      if (!task) continue

      if ((task.retryCount || 0) >= 2) {
        console.log(chalk.red(`  Task ${task.id} exceeded retry limit`))
        continue
      }

      task.retryCount = (task.retryCount || 0) + 1
      task.model = upgradeModelForRetry(task.model)

      console.log(
        chalk.yellow(`  Retrying Task ${task.id} with ${task.model} (attempt ${task.retryCount + 1})`)
      )

      const retryWave: Wave = {
        index: wave.index,
        tasks: [task],
        parallelizable: false,
        conflicts: [],
      }

      const retryResult = await executeWaveWithProgress(
        retryWave,
        this.featureName,
        { ...waveOptions, retryOnFailure: false }
      )

      if (retryResult.success) {
        const originalIndex = result.tasks.findIndex((t) => t.taskId === task.id)
        if (originalIndex >= 0) {
          result.tasks[originalIndex] = retryResult.tasks[0]
        }
      }
    }
  }

  private displayExecutionStart(): void {
    const totalTasks = this.waves.reduce((sum, w) => sum + w.tasks.length, 0)

    console.log()
    console.log(chalk.bold('╭' + '─'.repeat(65) + '╮'))
    console.log(chalk.bold('│') + chalk.cyan.bold('  Parallel Execution Started') + ' '.repeat(37) + chalk.bold('│'))
    console.log(
      chalk.bold('│') +
        `  Feature: ${this.featureName}`.padEnd(65) +
        chalk.bold('│')
    )
    console.log(
      chalk.bold('│') +
        `  Tasks: ${totalTasks}  │  Waves: ${this.waves.length}`.padEnd(65) +
        chalk.bold('│')
    )
    console.log(chalk.bold('╰' + '─'.repeat(65) + '╯'))
  }

  private displayExecutionSummary(result: OrchestratorResult): void {
    const metrics = aggregateWaveResults(this.results)
    console.log(formatMetricsSummary(metrics))

    if (!result.success) {
      console.log(chalk.yellow('\nSome tasks failed. Review the output above for details.'))
      console.log(chalk.gray('You can retry failed tasks with: adk feature implement <name> --parallel --retry-failed'))
    }
  }

  getWaves(): Wave[] {
    return this.waves
  }

  getResults(): WaveExecutionResult[] {
    return this.results
  }

  getProgress(): { completed: number; total: number; percentage: number } {
    const total = this.waves.reduce((sum, w) => sum + w.tasks.length, 0)
    const completed = this.results.reduce(
      (sum, r) => sum + r.tasks.filter((t) => t.success).length,
      0
    )

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }
}

export async function createAndExecuteOrchestrator(
  featureName: string,
  tasks: ParsedTaskForParallel[],
  options: Partial<OrchestratorOptions> = {}
): Promise<OrchestratorResult> {
  const fullOptions: OrchestratorOptions = {
    maxParallel: options.maxParallel ?? 3,
    isolate: options.isolate ?? false,
    timeout: options.timeout ?? 300000,
    retryFailed: options.retryFailed ?? false,
    modelOptimize: options.modelOptimize ?? true,
    stopOnError: options.stopOnError ?? false,
  }

  const orchestrator = new WaveOrchestrator({
    featureName,
    tasks,
    options: fullOptions,
  })

  return orchestrator.execute()
}

export function formatOrchestratorPlan(
  featureName: string,
  tasks: ParsedTaskForParallel[],
  options: Partial<OrchestratorOptions> = {}
): string {
  const lines: string[] = []
  const fullOptions: OrchestratorOptions = {
    maxParallel: options.maxParallel ?? 3,
    isolate: options.isolate ?? false,
    timeout: options.timeout ?? 300000,
    retryFailed: options.retryFailed ?? false,
    modelOptimize: options.modelOptimize ?? true,
    stopOnError: options.stopOnError ?? false,
  }

  const orchestrator = new WaveOrchestrator({
    featureName,
    tasks,
    options: fullOptions,
  })

  const waves = orchestrator.getWaves()

  lines.push(chalk.cyan.bold('\nExecution Plan'))
  lines.push(chalk.gray('─'.repeat(60)))
  lines.push(`Feature: ${featureName}`)
  lines.push(`Total Tasks: ${tasks.length}`)
  lines.push(`Total Waves: ${waves.length}`)
  lines.push(`Max Parallel: ${fullOptions.maxParallel}`)
  lines.push(`Model Optimization: ${fullOptions.modelOptimize ? 'enabled' : 'disabled'}`)
  lines.push(`Worktree Isolation: ${fullOptions.isolate ? 'enabled' : 'disabled'}`)
  lines.push('')

  for (const wave of waves) {
    const parallel = wave.parallelizable ? chalk.green('[parallel]') : chalk.yellow('[sequential]')
    lines.push(`Wave ${wave.index} ${parallel}`)

    for (const task of wave.tasks) {
      const modelTag = chalk.dim(`[${task.model}]`)
      const complexityTag = chalk.dim(`(${task.complexity.level})`)
      lines.push(`  └─ Task ${task.id}: ${task.title} ${modelTag} ${complexityTag}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
