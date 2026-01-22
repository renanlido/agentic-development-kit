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
