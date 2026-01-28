import type { ParallelTasksDocument, ParsedTaskForParallel } from './task-parser.js'
import { canTasksRunInParallel } from './task-parser.js'

export interface Wave {
  number: number
  tasks: ParsedTaskForParallel[]
  estimatedDuration: string
  parallelizable: boolean
  conflicts: string[]
}

export interface SchedulePlan {
  waves: Wave[]
  totalWaves: number
  totalTasks: number
  estimatedSpeedup: string
  sequentialTasks: ParsedTaskForParallel[]
  parallelizableTasks: ParsedTaskForParallel[]
}

export interface SchedulerConfig {
  maxParallelTasks: number
  forceSequential: string[]
  prioritizeByEstimate: boolean
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxParallelTasks: 4,
  forceSequential: ['migration', 'seed', 'config', 'setup'],
  prioritizeByEstimate: true,
}

export function createSchedulePlan(
  doc: ParallelTasksDocument,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): SchedulePlan {
  const waves: Wave[] = []
  const processedIds = new Set<string>()
  const sequentialTasks: ParsedTaskForParallel[] = []
  const parallelizableTasks: ParsedTaskForParallel[] = []

  doc.tasks.filter((t) => t.status === 'completed').forEach((t) => processedIds.add(t.id))

  const pendingTasks = doc.tasks.filter((t) => t.status === 'pending')

  for (const task of pendingTasks) {
    if (shouldForceSequential(task, config.forceSequential)) {
      sequentialTasks.push(task)
    } else {
      parallelizableTasks.push(task)
    }
  }

  let waveNumber = 1
  let remainingTasks = [...pendingTasks]

  while (remainingTasks.length > 0) {
    const readyTasks = remainingTasks.filter((task) =>
      task.dependencies.every((depId) => processedIds.has(depId))
    )

    if (readyTasks.length === 0) {
      const circularTasks = remainingTasks.map((t) => `Task ${t.id}`).join(', ')
      throw new Error(`Circular dependency detected: ${circularTasks}`)
    }

    const { parallelGroup, conflicts } = selectParallelGroup(
      readyTasks,
      config.maxParallelTasks,
      config.forceSequential
    )

    if (config.prioritizeByEstimate) {
      parallelGroup.sort((a, b) => estimateToMinutes(a.estimate) - estimateToMinutes(b.estimate))
    }

    const wave: Wave = {
      number: waveNumber,
      tasks: parallelGroup,
      estimatedDuration: calculateWaveDuration(parallelGroup),
      parallelizable: parallelGroup.length > 1 && conflicts.length === 0,
      conflicts,
    }

    waves.push(wave)

    for (const task of parallelGroup) {
      processedIds.add(task.id)
    }

    remainingTasks = remainingTasks.filter((t) => !processedIds.has(t.id))
    waveNumber++
  }

  const sequentialTime = pendingTasks.reduce((sum, t) => sum + estimateToMinutes(t.estimate), 0)
  const parallelTime = waves.reduce(
    (sum, w) => sum + Math.max(...w.tasks.map((t) => estimateToMinutes(t.estimate))),
    0
  )
  const speedup = sequentialTime > 0 ? (sequentialTime / parallelTime).toFixed(1) : '1.0'

  return {
    waves,
    totalWaves: waves.length,
    totalTasks: pendingTasks.length,
    estimatedSpeedup: `${speedup}x`,
    sequentialTasks,
    parallelizableTasks,
  }
}

function shouldForceSequential(task: ParsedTaskForParallel, keywords: string[]): boolean {
  const titleLower = task.title.toLowerCase()
  return keywords.some((kw) => titleLower.includes(kw.toLowerCase()))
}

function selectParallelGroup(
  readyTasks: ParsedTaskForParallel[],
  maxParallel: number,
  forceSequentialKeywords: string[]
): { parallelGroup: ParsedTaskForParallel[]; conflicts: string[] } {
  const parallelGroup: ParsedTaskForParallel[] = []
  const conflicts: string[] = []

  const sortedTasks = [...readyTasks].sort((a, b) => {
    const aSequential = shouldForceSequential(a, forceSequentialKeywords)
    const bSequential = shouldForceSequential(b, forceSequentialKeywords)
    if (aSequential !== bSequential) return aSequential ? 1 : -1
    return estimateToMinutes(b.estimate) - estimateToMinutes(a.estimate)
  })

  for (const task of sortedTasks) {
    if (parallelGroup.length >= maxParallel) break

    if (shouldForceSequential(task, forceSequentialKeywords)) {
      if (parallelGroup.length === 0) {
        parallelGroup.push(task)
        break
      }
      continue
    }

    let canAdd = true
    for (const existing of parallelGroup) {
      if (!canTasksRunInParallel(task, existing)) {
        canAdd = false
        const sharedFiles = task.files.filter((f) => existing.files.includes(f))
        if (sharedFiles.length > 0) {
          conflicts.push(`Task ${task.id} & ${existing.id}: ${sharedFiles.join(', ')}`)
        }
        break
      }
    }

    if (canAdd) {
      parallelGroup.push(task)
    }
  }

  if (parallelGroup.length === 0 && sortedTasks.length > 0) {
    parallelGroup.push(sortedTasks[0])
  }

  return { parallelGroup, conflicts }
}

function estimateToMinutes(estimate: ParsedTaskForParallel['estimate']): number {
  switch (estimate) {
    case 'P':
      return 60
    case 'M':
      return 180
    case 'G':
      return 360
    default:
      return 180
  }
}

function calculateWaveDuration(tasks: ParsedTaskForParallel[]): string {
  if (tasks.length === 0) return '0h'

  const maxMinutes = Math.max(...tasks.map((t) => estimateToMinutes(t.estimate)))
  const hours = maxMinutes / 60

  if (hours < 1) return `${maxMinutes}min`
  return `${hours}h`
}

export function formatSchedulePlan(plan: SchedulePlan): string {
  const lines: string[] = []

  lines.push(`\n📋 Parallel Execution Plan`)
  lines.push(`   Total Tasks: ${plan.totalTasks}`)
  lines.push(`   Total Waves: ${plan.totalWaves}`)
  lines.push(`   Estimated Speedup: ${plan.estimatedSpeedup}`)
  lines.push('')

  for (const wave of plan.waves) {
    const parallel = wave.parallelizable ? '⚡ parallel' : '📝 sequential'
    lines.push(`Wave ${wave.number} (${wave.estimatedDuration}) [${parallel}]`)

    for (const task of wave.tasks) {
      const estimate = `[${task.estimate}]`
      lines.push(`   └─ Task ${task.id}: ${task.title} ${estimate}`)
      if (task.files.length > 0) {
        lines.push(
          `      Files: ${task.files.slice(0, 3).join(', ')}${task.files.length > 3 ? '...' : ''}`
        )
      }
    }

    if (wave.conflicts.length > 0) {
      lines.push(`   ⚠️  Conflicts:`)
      for (const conflict of wave.conflicts) {
        lines.push(`      - ${conflict}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

export function getNextWave(plan: SchedulePlan, completedTaskIds: Set<string>): Wave | null {
  for (const wave of plan.waves) {
    const allCompleted = wave.tasks.every((t) => completedTaskIds.has(t.id))
    if (!allCompleted) {
      return wave
    }
  }
  return null
}

export function validateDependencies(doc: ParallelTasksDocument): string[] {
  const errors: string[] = []
  const taskIds = new Set(doc.tasks.map((t) => t.id))

  for (const task of doc.tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        errors.push(`Task ${task.id} depends on non-existent Task ${depId}`)
      }
    }
  }

  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(taskId: string): boolean {
    if (recursionStack.has(taskId)) return true
    if (visited.has(taskId)) return false

    visited.add(taskId)
    recursionStack.add(taskId)

    const task = doc.tasks.find((t) => t.id === taskId)
    if (task) {
      for (const depId of task.dependencies) {
        if (hasCycle(depId)) return true
      }
    }

    recursionStack.delete(taskId)
    return false
  }

  for (const task of doc.tasks) {
    visited.clear()
    recursionStack.clear()
    if (hasCycle(task.id)) {
      errors.push(`Circular dependency detected involving Task ${task.id}`)
      break
    }
  }

  return errors
}
