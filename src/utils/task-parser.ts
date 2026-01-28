import type { TaskState, TasksDocument } from '../types/progress-sync'

const CHECKBOX_REGEX = /^(\s*)- \[([x~! ])\]\s*(.+)$/i
const PRIORITY_REGEX = /P([0-4]):/i

export type { TaskStatus } from '../types/progress-sync'

/**
 * Extracts task status from markdown checkbox format.
 *
 * Supported formats:
 * - `[ ]` → pending
 * - `[x]` → completed
 * - `[~]` → in_progress
 * - `[!]` → blocked
 */
export function extractTaskStatus(line: string): TaskState['status'] {
  const match = line.match(CHECKBOX_REGEX)
  if (!match) {
    return 'pending'
  }

  const checkboxChar = match[2].toLowerCase()
  switch (checkboxChar) {
    case 'x':
      return 'completed'
    case '~':
      return 'in_progress'
    case '!':
      return 'blocked'
    default:
      return 'pending'
  }
}

export function extractPriority(text: string): number | undefined {
  const match = text.match(PRIORITY_REGEX)
  if (!match) {
    return undefined
  }
  return parseInt(match[1], 10)
}

function extractNotes(text: string): string | undefined {
  const parenMatch = text.match(/\(([^)]+)\)$/)
  if (parenMatch) {
    return parenMatch[1]
  }
  return undefined
}

function cleanTaskName(text: string): string {
  return text
    .replace(PRIORITY_REGEX, '')
    .replace(/\([^)]+\)$/, '')
    .trim()
}

/**
 * Parses tasks.md file into structured TasksDocument.
 *
 * Extracts tasks with status, priorities (P0-P4), acceptance criteria,
 * and handles nested subtasks. Gracefully degrades on malformed input.
 */
export function parseTasksFile(content: string): TasksDocument {
  if (!content || content.trim() === '') {
    return { tasks: [], acceptanceCriteria: [] }
  }

  const lines = content.split('\n')
  const tasks: TaskState[] = []
  const acceptanceCriteria: Array<{ description: string; met: boolean }> = []

  let currentPhase: string | undefined
  let inAcceptanceCriteria = false

  for (const line of lines) {
    const phaseMatch = line.match(/^##\s+(Phase\s+\d+|Fase\s+\d+)/i)
    if (phaseMatch) {
      currentPhase = phaseMatch[1]
      inAcceptanceCriteria = false
      continue
    }

    if (line.toLowerCase().includes('acceptance criteria')) {
      inAcceptanceCriteria = true
      continue
    }

    const checkboxMatch = line.match(CHECKBOX_REGEX)
    if (checkboxMatch) {
      const [, , checkboxChar, rawText] = checkboxMatch
      const status = extractTaskStatus(line)
      const priority = extractPriority(rawText)
      const notes = extractNotes(rawText)
      const name = cleanTaskName(rawText)

      if (inAcceptanceCriteria) {
        acceptanceCriteria.push({
          description: name,
          met: checkboxChar.toLowerCase() === 'x',
        })
      } else {
        tasks.push({
          name,
          status,
          priority,
          phase: currentPhase,
          notes,
        })
      }
    } else if (inAcceptanceCriteria) {
      const bulletMatch = line.match(/^\s*-\s+(.+)$/)
      if (bulletMatch) {
        acceptanceCriteria.push({
          description: bulletMatch[1].trim(),
          met: false,
        })
      }
    }
  }

  return { tasks, acceptanceCriteria }
}

export function serializeTasksMarkdown(doc: TasksDocument): string {
  const lines: string[] = ['# Tasks', '']

  const tasksByPhase = new Map<string, TaskState[]>()

  for (const task of doc.tasks) {
    const phase = task.phase || 'Uncategorized'
    if (!tasksByPhase.has(phase)) {
      tasksByPhase.set(phase, [])
    }
    tasksByPhase.get(phase)?.push(task)
  }

  for (const [phase, tasks] of tasksByPhase) {
    lines.push(`## ${phase}`, '')

    for (const task of tasks) {
      const checkbox = getCheckboxChar(task.status)
      const priority = task.priority !== undefined ? `P${task.priority}: ` : ''
      const statusEmoji = task.status === 'completed' ? ' ✅' : ''
      lines.push(`- [${checkbox}] ${priority}${task.name}${statusEmoji}`)
    }

    lines.push('')
  }

  if (doc.acceptanceCriteria.length > 0) {
    lines.push('**Acceptance Criteria:**')
    for (const criterion of doc.acceptanceCriteria) {
      const checkbox = criterion.met ? 'x' : ' '
      lines.push(`- [${checkbox}] ${criterion.description}`)
    }
  }

  return lines.join('\n')
}

function getCheckboxChar(status: TaskState['status']): string {
  switch (status) {
    case 'completed':
      return 'x'
    case 'in_progress':
      return '~'
    case 'blocked':
      return '!'
    default:
      return ' '
  }
}

export function parseTasksMarkdown(content: string): TasksDocument {
  return parseTasksFile(content)
}

export interface ParsedTaskForParallel {
  id: string
  title: string
  type: 'Feature' | 'Refactor' | 'Bugfix' | 'Config' | 'Docs' | 'Test'
  status: 'pending' | 'in_progress' | 'completed'
  dependencies: string[]
  files: string[]
  estimate: 'P' | 'M' | 'G'
}

export interface ParallelTasksDocument {
  featureName: string
  tasks: ParsedTaskForParallel[]
  totalTasks: number
  completedTasks: number
  pendingTasks: number
}

const TASK_HEADER_REGEX = /^##\s+Task\s+(\d+(?:\.\d+)?):?\s*(.+)$/i
const DEPENDENCY_REGEX = /^\*?\*?Depend[êe]ncias\*?\*?:\s*(.+)$/im
const FILES_SECTION_REGEX = /^### Arquivos/i
const TYPE_REGEX = /^\*?\*?Tipo\*?\*?:\s*(\w+)/im
const ESTIMATE_REGEX = /^\*?\*?Estimativa\*?\*?:\s*\[?([PMG])\]?/im

export function parseTasksForParallel(content: string, featureName: string): ParallelTasksDocument {
  const lines = content.split('\n')
  const tasks: ParsedTaskForParallel[] = []

  let currentTask: Partial<ParsedTaskForParallel> | null = null
  let inFilesSection = false

  for (const line of lines) {
    const trimmed = line.trim()

    const taskMatch = trimmed.match(TASK_HEADER_REGEX)
    if (taskMatch) {
      if (currentTask && currentTask.id) {
        tasks.push(finalizeParallelTask(currentTask))
      }

      const isCompleted = /\[x\]/i.test(trimmed)
      const isInProgress = /\[~\]/i.test(trimmed)

      currentTask = {
        id: taskMatch[1],
        title: taskMatch[2].replace(/\s*\[.?\]\s*/, '').trim(),
        type: 'Feature',
        status: isCompleted ? 'completed' : isInProgress ? 'in_progress' : 'pending',
        dependencies: [],
        files: [],
        estimate: 'M',
      }
      inFilesSection = false
      continue
    }

    if (!currentTask) continue

    if (trimmed.match(/^#+\s+/)) {
      inFilesSection = false
    }

    const typeMatch = trimmed.match(TYPE_REGEX)
    if (typeMatch) {
      currentTask.type = typeMatch[1] as ParsedTaskForParallel['type']
      continue
    }

    const estimateMatch = trimmed.match(ESTIMATE_REGEX)
    if (estimateMatch) {
      currentTask.estimate = estimateMatch[1] as ParsedTaskForParallel['estimate']
      continue
    }

    const depMatch = trimmed.match(DEPENDENCY_REGEX)
    if (depMatch) {
      const depsStr = depMatch[1].trim().toLowerCase()
      if (depsStr !== 'nenhuma' && depsStr !== 'none' && depsStr !== '-') {
        currentTask.dependencies = extractTaskDependencies(depMatch[1])
      }
      continue
    }

    if (trimmed.match(FILES_SECTION_REGEX)) {
      inFilesSection = true
      continue
    }

    if (inFilesSection && trimmed.startsWith('-')) {
      const file = extractFilePathFromLine(trimmed)
      if (file) {
        currentTask.files?.push(file)
      }
    }
  }

  if (currentTask && currentTask.id) {
    tasks.push(finalizeParallelTask(currentTask))
  }

  const completedTasks = tasks.filter((t) => t.status === 'completed').length

  return {
    featureName,
    tasks,
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks: tasks.length - completedTasks,
  }
}

function finalizeParallelTask(task: Partial<ParsedTaskForParallel>): ParsedTaskForParallel {
  return {
    id: task.id || '0',
    title: task.title || 'Untitled',
    type: task.type || 'Feature',
    status: task.status || 'pending',
    dependencies: task.dependencies || [],
    files: task.files || [],
    estimate: task.estimate || 'M',
  }
}

function extractTaskDependencies(depString: string): string[] {
  const deps: string[] = []

  const taskRefs = depString.match(/Task\s*(\d+(?:\.\d+)?)/gi)
  if (taskRefs) {
    for (const ref of taskRefs) {
      const match = ref.match(/(\d+(?:\.\d+)?)/)
      if (match) {
        deps.push(match[1])
      }
    }
  }

  if (deps.length === 0) {
    const numbersOnly = depString.match(/\d+(?:\.\d+)?/g)
    if (numbersOnly) {
      deps.push(...numbersOnly)
    }
  }

  return [...new Set(deps)]
}

function extractFilePathFromLine(line: string): string | null {
  const backtickMatch = line.match(/`([^`]+)`/)
  if (backtickMatch) {
    return backtickMatch[1].split(/\s+-/)[0].trim()
  }

  const pathMatch = line.match(/[-*]\s*(.+?)(?:\s*[-–]|$)/)
  if (pathMatch) {
    const potentialPath = pathMatch[1].trim()
    if (potentialPath.includes('/') || potentialPath.includes('.')) {
      return potentialPath
    }
  }

  return null
}

export function getTaskByIdForParallel(
  doc: ParallelTasksDocument,
  taskId: string
): ParsedTaskForParallel | undefined {
  return doc.tasks.find((t) => t.id === taskId)
}

export function getPendingTasksForParallel(doc: ParallelTasksDocument): ParsedTaskForParallel[] {
  return doc.tasks.filter((t) => t.status === 'pending')
}

export function getReadyTasksForParallel(doc: ParallelTasksDocument): ParsedTaskForParallel[] {
  const completedIds = new Set(doc.tasks.filter((t) => t.status === 'completed').map((t) => t.id))

  return doc.tasks.filter((t) => {
    if (t.status !== 'pending') return false
    return t.dependencies.every((depId) => completedIds.has(depId))
  })
}

export function detectFileConflictsForParallel(
  tasks: ParsedTaskForParallel[]
): Map<string, ParsedTaskForParallel[]> {
  const fileToTasks = new Map<string, ParsedTaskForParallel[]>()

  for (const task of tasks) {
    for (const file of task.files) {
      const existing = fileToTasks.get(file) || []
      existing.push(task)
      fileToTasks.set(file, existing)
    }
  }

  const conflicts = new Map<string, ParsedTaskForParallel[]>()
  for (const [file, fileTasks] of fileToTasks) {
    if (fileTasks.length > 1) {
      conflicts.set(file, fileTasks)
    }
  }

  return conflicts
}

export function canTasksRunInParallel(
  task1: ParsedTaskForParallel,
  task2: ParsedTaskForParallel
): boolean {
  if (task1.dependencies.includes(task2.id) || task2.dependencies.includes(task1.id)) {
    return false
  }

  const files1 = new Set(task1.files)
  for (const file of task2.files) {
    if (files1.has(file)) {
      return false
    }
  }

  return true
}
