import chalk from 'chalk'
import { ModelType } from '../types/model'
import type {
  OrchestratorResult,
  TaskExecutionResult,
  WaveExecutionResult,
} from '../types/parallel'

export interface AggregatedMetrics {
  totalDuration: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  totalTokens: number
  totalCost: number
  averageTaskDuration: number
  modelUsage: Record<ModelType, number>
  filesModified: string[]
  conflictCount: number
  speedupFactor: number
}

export function aggregateWaveResults(waves: WaveExecutionResult[]): AggregatedMetrics {
  const allTasks: TaskExecutionResult[] = []
  let totalDuration = 0
  let conflictCount = 0
  const filesModified = new Set<string>()

  for (const wave of waves) {
    allTasks.push(...wave.tasks)
    totalDuration += wave.duration
    conflictCount += wave.conflicts.length

    for (const task of wave.tasks) {
      for (const file of task.filesModified) {
        filesModified.add(file)
      }
    }
  }

  const completedTasks = allTasks.filter((t) => t.success).length
  const failedTasks = allTasks.length - completedTasks
  const totalTokens = allTasks.reduce((sum, t) => sum + t.tokensUsed, 0)
  const totalCost = allTasks.reduce((sum, t) => sum + t.cost, 0)

  const modelUsage: Record<ModelType, number> = {
    [ModelType.OPUS]: 0,
    [ModelType.SONNET]: 0,
    [ModelType.HAIKU]: 0,
  }

  for (const task of allTasks) {
    modelUsage[task.model] = (modelUsage[task.model] || 0) + 1
  }

  const sequentialEstimate = allTasks.reduce((sum, t) => sum + t.duration, 0)
  const speedupFactor = sequentialEstimate > 0 ? sequentialEstimate / totalDuration : 1

  return {
    totalDuration,
    totalTasks: allTasks.length,
    completedTasks,
    failedTasks,
    totalTokens,
    totalCost,
    averageTaskDuration: allTasks.length > 0 ? totalDuration / allTasks.length : 0,
    modelUsage,
    filesModified: Array.from(filesModified),
    conflictCount,
    speedupFactor,
  }
}

export function createOrchestratorResult(
  waves: WaveExecutionResult[],
  totalDuration: number
): OrchestratorResult {
  const metrics = aggregateWaveResults(waves)
  const success = waves.every((w) => w.success)

  return {
    success,
    waves,
    totalDuration,
    totalTasks: metrics.totalTasks,
    completedTasks: metrics.completedTasks,
    failedTasks: metrics.failedTasks,
    totalCost: metrics.totalCost,
    totalTokens: metrics.totalTokens,
    modelUsage: metrics.modelUsage,
  }
}

export function formatMetricsSummary(metrics: AggregatedMetrics): string {
  const lines: string[] = []

  lines.push('')
  lines.push(chalk.bold('═'.repeat(60)))
  lines.push(chalk.bold.green('  Parallel Execution Complete'))
  lines.push(chalk.bold('═'.repeat(60)))
  lines.push('')

  const durationSecs = (metrics.totalDuration / 1000).toFixed(1)
  const tokenStr =
    metrics.totalTokens > 1000
      ? `${(metrics.totalTokens / 1000).toFixed(1)}k`
      : `${metrics.totalTokens}`

  lines.push(`  ${chalk.cyan('Duration')}     ${durationSecs}s`)
  lines.push(
    `  ${chalk.cyan('Tasks')}        ${metrics.completedTasks}/${metrics.totalTasks} succeeded`
  )
  lines.push(`  ${chalk.cyan('Tokens')}       ${tokenStr}`)
  lines.push(`  ${chalk.cyan('Cost')}         $${metrics.totalCost.toFixed(4)}`)
  lines.push(`  ${chalk.cyan('Speedup')}      ${metrics.speedupFactor.toFixed(1)}x`)

  lines.push('')
  lines.push(`  ${chalk.cyan('Model Usage')}`)

  if (metrics.modelUsage[ModelType.OPUS] > 0) {
    lines.push(`    ${chalk.magenta('opus')}    ${metrics.modelUsage[ModelType.OPUS]} tasks`)
  }
  if (metrics.modelUsage[ModelType.SONNET] > 0) {
    lines.push(`    ${chalk.blue('sonnet')}  ${metrics.modelUsage[ModelType.SONNET]} tasks`)
  }
  if (metrics.modelUsage[ModelType.HAIKU] > 0) {
    lines.push(`    ${chalk.green('haiku')}   ${metrics.modelUsage[ModelType.HAIKU]} tasks`)
  }

  if (metrics.failedTasks > 0) {
    lines.push('')
    lines.push(chalk.red(`  Failed Tasks: ${metrics.failedTasks}`))
  }

  if (metrics.conflictCount > 0) {
    lines.push('')
    lines.push(chalk.yellow(`  Conflicts: ${metrics.conflictCount}`))
  }

  lines.push('')
  lines.push(chalk.bold('═'.repeat(60)))

  return lines.join('\n')
}

export function formatCompactSummary(metrics: AggregatedMetrics): string {
  const successRate = ((metrics.completedTasks / Math.max(metrics.totalTasks, 1)) * 100).toFixed(0)
  const duration = (metrics.totalDuration / 1000).toFixed(1)

  return (
    `Tasks: ${metrics.completedTasks}/${metrics.totalTasks} (${successRate}%) | ` +
    `Duration: ${duration}s | ` +
    `Speedup: ${metrics.speedupFactor.toFixed(1)}x | ` +
    `Cost: $${metrics.totalCost.toFixed(4)}`
  )
}

export function getFailedTasks(waves: WaveExecutionResult[]): TaskExecutionResult[] {
  return waves.flatMap((w) => w.tasks.filter((t) => !t.success))
}

export function getSuccessfulTasks(waves: WaveExecutionResult[]): TaskExecutionResult[] {
  return waves.flatMap((w) => w.tasks.filter((t) => t.success))
}

export function calculateCostByModel(waves: WaveExecutionResult[]): Record<ModelType, number> {
  const costs: Record<ModelType, number> = {
    [ModelType.OPUS]: 0,
    [ModelType.SONNET]: 0,
    [ModelType.HAIKU]: 0,
  }

  for (const wave of waves) {
    for (const task of wave.tasks) {
      costs[task.model] = (costs[task.model] || 0) + task.cost
    }
  }

  return costs
}
