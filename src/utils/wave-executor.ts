import path from 'node:path'
import chalk from 'chalk'
import { ModelType } from '../types/model'
import type {
  EnhancedTask,
  TaskExecutionResult,
  WaveExecutionOptions,
  WaveExecutionResult,
} from '../types/parallel'
import type { StreamEvent } from '../types/stream-events'
import {
  type AgentSelectionResult,
  getAgentConfig,
  selectAgentAndModel,
  selectModelForTask,
} from './agent-router'
import { executeHeadlessWithMetrics } from './claude'
import { resolveConflicts } from './conflict-resolver'
import { updateTaskStatusInFile } from './task-parser'
import {
  completeWaveProgress,
  createTaskEventHandler,
  initWaveProgress,
  setVerboseMode,
} from './wave-progress'
import { createWorktree, getChangedFilesInWorktree, removeWorktree } from './worktree-utils'

const DEFAULT_MAX_CONCURRENT_AGENTS = 2

async function executeWithConcurrencyLimit<T, R>(
  items: T[],
  maxConcurrent: number,
  executor: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let currentIndex = 0
  let activeCount = 0

  return new Promise((resolve) => {
    const executeNext = (): void => {
      while (activeCount < maxConcurrent && currentIndex < items.length) {
        const index = currentIndex++
        activeCount++

        executor(items[index])
          .then((value) => {
            results[index] = { status: 'fulfilled', value }
          })
          .catch((reason) => {
            results[index] = { status: 'rejected', reason }
          })
          .finally(() => {
            activeCount--
            if (currentIndex < items.length) {
              executeNext()
            } else if (activeCount === 0) {
              resolve(results)
            }
          })
      }

      if (items.length === 0) {
        resolve(results)
      }
    }

    executeNext()
  })
}

export interface Wave {
  index: number
  tasks: EnhancedTask[]
  parallelizable: boolean
  conflicts: string[]
}

export interface AgentTaskConfig {
  agentType: string
  model: ModelType
  prompt: string
  worktree?: string
  timeout: number
  runInBackground: boolean
  taskId: string
  taskTitle: string
  onEvent?: (event: StreamEvent) => void
  verbose?: boolean
  disableHooks?: boolean
}

async function executeAgentTask(config: AgentTaskConfig): Promise<TaskExecutionResult> {
  const startTime = Date.now()

  try {
    const result = await executeHeadlessWithMetrics(config.prompt, {
      model: config.model,
      collectMetrics: true,
      showProgress: config.verbose || false,
      onEvent: config.onEvent,
      cwd: config.worktree || process.cwd(),
      disableHooks: config.disableHooks ?? true,
    })

    const filesModified = config.worktree ? await getChangedFilesInWorktree(config.worktree) : []

    return {
      taskId: config.taskId,
      taskTitle: config.taskTitle,
      success: result.success,
      agentType: config.agentType,
      model: config.model,
      duration: Date.now() - startTime,
      tokensUsed: result.metrics?.tokenCount || 0,
      cost: result.metrics?.costUsd || 0,
      filesModified,
    }
  } catch (error) {
    return {
      taskId: config.taskId,
      taskTitle: config.taskTitle,
      success: false,
      agentType: config.agentType,
      model: config.model,
      duration: Date.now() - startTime,
      tokensUsed: 0,
      cost: 0,
      error: error instanceof Error ? error.message : String(error),
      filesModified: [],
    }
  }
}

function buildAgentPrompt(
  task: EnhancedTask,
  agentSelection: AgentSelectionResult,
  featureName: string,
  worktreePath?: string
): string {
  const agentConfig = getAgentConfig(agentSelection.agentType)

  return `
## Agent: ${agentSelection.agentType.toUpperCase()}
${agentConfig?.description || 'Specialized agent'}
Model: ${agentSelection.model}

## Task
ID: ${task.id}
Title: ${task.title}
${task.description ? `Description: ${task.description}` : ''}
Type: ${task.type}
Complexity: ${task.complexity.level} (score: ${task.complexity.score})

## Feature Context
Feature: ${featureName}
${worktreePath ? `Worktree: ${worktreePath}` : ''}

## Files to Modify
${task.files.length > 0 ? task.files.map((f) => `- ${f}`).join('\n') : 'No specific files listed'}

## Instructions
1. Analyze the task requirements
2. Implement the changes following TDD principles
3. Run tests to verify your changes
4. Mark the task as completed:
   .claude/hooks/mark-task.sh ${featureName} "Task ${task.id}" completed

IMPORTANT:
- Focus only on this specific task
- ALWAYS run the mark-task.sh command when done
- Do not make changes outside the scope
`
}

export interface ExtendedWaveOptions extends WaveExecutionOptions {
  verbose?: boolean
  totalWaves?: number
  onTaskEvent?: (taskId: string, event: StreamEvent) => void
  maxConcurrentAgents?: number
  disableHooks?: boolean
}

export async function executeWave(
  wave: Wave,
  featureName: string,
  options: ExtendedWaveOptions
): Promise<WaveExecutionResult> {
  const startTime = Date.now()
  const taskResults: TaskExecutionResult[] = []
  const worktreePaths: string[] = []
  const maxConcurrent = options.maxConcurrentAgents || DEFAULT_MAX_CONCURRENT_AGENTS

  const executeTask = async (task: EnhancedTask): Promise<TaskExecutionResult> => {
    const agentSelection = selectAgentAndModel(task.title, task.type, task.complexity)
    const model = selectModelForTask(task)

    let worktreePath: string | undefined
    if (options.useWorktrees && wave.tasks.length > 1) {
      try {
        const worktreeBase = path.join(process.cwd(), '.worktrees', `${featureName}-${task.id}`)
        const branch = `feature/${featureName}/task-${task.id}`
        await createWorktree(branch, worktreeBase)
        worktreePath = worktreeBase
        worktreePaths.push(worktreePath)
      } catch {
        console.log(chalk.yellow(`  Warning: Could not create worktree for task ${task.id}`))
      }
    }

    const prompt = buildAgentPrompt(task, agentSelection, featureName, worktreePath)

    const eventHandler = options.onTaskEvent
      ? (event: StreamEvent) => options.onTaskEvent!(task.id, event)
      : createTaskEventHandler(task.id)

    return executeAgentTask({
      agentType: agentSelection.agentType,
      model,
      prompt,
      worktree: worktreePath,
      timeout: options.timeout || 300000,
      runInBackground: false,
      taskId: task.id,
      taskTitle: task.title,
      onEvent: eventHandler,
      verbose: options.verbose,
      disableHooks: options.disableHooks ?? true,
    })
  }

  const results = await executeWithConcurrencyLimit(wave.tasks, maxConcurrent, executeTask)

  for (const result of results) {
    if (result.status === 'fulfilled') {
      taskResults.push(result.value)
    } else {
      taskResults.push({
        taskId: 'unknown',
        taskTitle: 'Unknown task',
        success: false,
        agentType: 'unknown',
        model: ModelType.SONNET,
        duration: 0,
        tokensUsed: 0,
        cost: 0,
        error: result.reason?.message || 'Promise rejected',
        filesModified: [],
      })
    }
  }

  const tasksFilePath = path.join(
    process.cwd(),
    '.claude',
    'plans',
    'features',
    featureName,
    'tasks.md'
  )
  for (const taskResult of taskResults) {
    if (taskResult.success && taskResult.taskId !== 'unknown') {
      try {
        await updateTaskStatusInFile(tasksFilePath, taskResult.taskId, 'completed')
      } catch {}
    }
  }

  const conflicts = await resolveConflicts(taskResults, options)

  if (!options.retryOnFailure) {
    for (const wt of worktreePaths) {
      try {
        await removeWorktree(wt, true)
      } catch {}
    }
  }

  const success =
    taskResults.every((t) => t.success) && !conflicts.some((c) => c.resolution === 'manual')

  return {
    waveIndex: wave.index,
    tasks: taskResults,
    duration: Date.now() - startTime,
    conflicts,
    success,
  }
}

export async function executeWaveWithProgress(
  wave: Wave,
  featureName: string,
  options: ExtendedWaveOptions
): Promise<WaveExecutionResult> {
  const totalWaves = options.totalWaves || 1
  const verbose = options.verbose || false

  setVerboseMode(verbose)

  if (wave.conflicts.length > 0) {
    console.log(chalk.yellow('  Conflicts detected:'))
    for (const conflict of wave.conflicts) {
      console.log(chalk.gray(`    - ${conflict}`))
    }
  }

  initWaveProgress(
    wave.index,
    totalWaves,
    wave.tasks.map((t) => ({ id: t.id, title: t.title }))
  )

  const result = await executeWave(wave, featureName, {
    ...options,
    verbose,
  })

  completeWaveProgress()

  return result
}

export function formatWaveResult(result: WaveExecutionResult): string {
  const lines: string[] = []
  const successCount = result.tasks.filter((t) => t.success).length
  const totalTokens = result.tasks.reduce((sum, t) => sum + t.tokensUsed, 0)
  const totalCost = result.tasks.reduce((sum, t) => sum + t.cost, 0)

  const statusIcon = result.success ? chalk.green('✓') : chalk.red('✗')
  lines.push(
    `${statusIcon} Wave ${result.waveIndex} Complete (${(result.duration / 1000).toFixed(1)}s)`
  )
  lines.push(`  Tasks: ${successCount}/${result.tasks.length} succeeded`)
  lines.push(`  Tokens: ${totalTokens.toLocaleString()}`)
  lines.push(`  Cost: $${totalCost.toFixed(4)}`)

  if (result.conflicts.length > 0) {
    lines.push(`  Conflicts: ${result.conflicts.length}`)
  }

  return lines.join('\n')
}
