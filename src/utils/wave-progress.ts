import chalk from 'chalk'
import type { StreamEvent } from '../types/stream-events'

export interface TaskProgress {
  taskId: string
  taskTitle: string
  startTime: number
  toolCount: number
  tokenCount: number
  lastAction: string
  lastToolName?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  cost: number
}

export interface WaveProgressState {
  waveIndex: number
  totalWaves: number
  tasks: Map<string, TaskProgress>
  startTime: number
}

let currentState: WaveProgressState | null = null
let lastRenderTime = 0
let renderInterval: NodeJS.Timeout | null = null
let verboseMode = false
let logLines: string[] = []

const RENDER_INTERVAL = 250

export function setVerboseMode(enabled: boolean): void {
  verboseMode = enabled
}

export function initWaveProgress(
  waveIndex: number,
  totalWaves: number,
  tasks: Array<{ id: string; title: string }>
): void {
  currentState = {
    waveIndex,
    totalWaves,
    tasks: new Map(),
    startTime: Date.now(),
  }

  for (const task of tasks) {
    currentState.tasks.set(task.id, {
      taskId: task.id,
      taskTitle: task.title,
      startTime: Date.now(),
      toolCount: 0,
      tokenCount: 0,
      lastAction: 'Initializing...',
      status: 'pending',
      cost: 0,
    })
  }

  logLines = []

  if (!verboseMode) {
    renderProgress()
    renderInterval = setInterval(renderProgress, RENDER_INTERVAL)
  }
}

export function updateTaskProgress(taskId: string, event: StreamEvent): void {
  if (!currentState) return

  const task = currentState.tasks.get(taskId)
  if (!task) return

  if (task.status === 'pending') {
    task.status = 'running'
    task.startTime = Date.now()
  }

  if (event.type === 'stream_event' && event.event) {
    const delta = event.event
    if (delta.type === 'content_block_delta' && delta.delta?.type === 'text_delta') {
      const text = delta.delta.text?.trim()
      if (text && text.length > 3) {
        task.lastAction = `💭 ${truncate(text, 50)}`
      }
    }
  }

  if (event.type === 'assistant' && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === 'tool_use' && block.name) {
        task.toolCount++
        task.lastToolName = block.name
        task.lastAction = formatToolAction(block.name, block.input)

        if (verboseMode) {
          addLogLine(taskId, `🔧 ${block.name}`, block.input)
        }
      }
      if (block.type === 'text' && block.text) {
        const text = block.text.trim()
        if (text.length > 10) {
          task.lastAction = `💭 ${truncate(text, 50)}`
        }
      }
    }
  }

  if (event.type === 'user' && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === 'tool_result') {
        const isError = block.content && /error|fail|exception/i.test(block.content)
        if (task.lastToolName) {
          task.lastAction = isError
            ? `❌ ${task.lastToolName} failed`
            : `✓ ${task.lastToolName} done`
        }
      }
    }
  }

  if (event.type === 'result') {
    const isError = event.subtype?.startsWith('error_')
    task.status = isError ? 'failed' : 'completed'
    task.cost = event.total_cost_usd || 0
    if (event.usage) {
      task.tokenCount = (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0)
    }
  }

  if (!verboseMode) {
    const now = Date.now()
    if (now - lastRenderTime > RENDER_INTERVAL) {
      renderProgress()
      lastRenderTime = now
    }
  }
}

export function completeWaveProgress(): void {
  if (renderInterval) {
    clearInterval(renderInterval)
    renderInterval = null
  }

  if (currentState && !verboseMode) {
    clearProgressDisplay()
    renderFinalSummary()
  }

  currentState = null
}

function formatToolAction(toolName: string, input?: Record<string, unknown>): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✏️',
    Edit: '📝',
    Bash: '⚡',
    Glob: '🔍',
    Grep: '🔎',
    Task: '🤖',
    WebFetch: '🌐',
    WebSearch: '🔍',
  }

  const icon = icons[toolName] || '🔧'

  if (toolName === 'Read' && input?.file_path) {
    return `${icon} Reading ${truncatePath(String(input.file_path))}`
  }
  if (toolName === 'Write' && input?.file_path) {
    return `${icon} Writing ${truncatePath(String(input.file_path))}`
  }
  if (toolName === 'Edit' && input?.file_path) {
    return `${icon} Editing ${truncatePath(String(input.file_path))}`
  }
  if (toolName === 'Bash' && input?.command) {
    return `${icon} Running: ${truncate(String(input.command), 40)}`
  }
  if (toolName === 'Grep' && input?.pattern) {
    return `${icon} Searching: ${truncate(String(input.pattern), 30)}`
  }
  if (toolName === 'Task' && input?.description) {
    return `${icon} Agent: ${truncate(String(input.description), 35)}`
  }

  return `${icon} ${toolName}`
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/')
  if (parts.length <= 3) return filePath
  return '.../' + parts.slice(-2).join('/')
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

function addLogLine(taskId: string, action: string, details?: Record<string, unknown>): void {
  const task = currentState?.tasks.get(taskId)
  if (!task) return

  const elapsed = formatDuration(Date.now() - task.startTime)
  const prefix = chalk.dim(`[${taskId}]`) + chalk.gray(` ${elapsed}`)
  let line = `${prefix} ${action}`

  if (details) {
    if (details.file_path) {
      line += chalk.cyan(` ${truncatePath(String(details.file_path))}`)
    } else if (details.command) {
      line += chalk.yellow(` ${truncate(String(details.command), 50)}`)
    } else if (details.pattern) {
      line += chalk.magenta(` "${truncate(String(details.pattern), 30)}"`)
    }
  }

  logLines.push(line)
  console.log(line)
}

function renderProgress(): void {
  if (!currentState) return

  const lines: string[] = []
  const elapsed = formatDuration(Date.now() - currentState.startTime)

  lines.push('')
  lines.push(
    chalk.cyan.bold(`Wave ${currentState.waveIndex}/${currentState.totalWaves}`) +
      chalk.gray(` (${currentState.tasks.size} tasks)`) +
      chalk.dim(` ⏱ ${elapsed}`)
  )
  lines.push(chalk.gray('─'.repeat(70)))

  for (const task of currentState.tasks.values()) {
    const taskElapsed = task.status === 'pending' ? '—' : formatDuration(Date.now() - task.startTime)

    const statusIcon =
      task.status === 'completed'
        ? chalk.green('✓')
        : task.status === 'failed'
          ? chalk.red('✗')
          : task.status === 'running'
            ? chalk.yellow('●')
            : chalk.gray('○')

    const taskTitle = truncate(task.taskTitle, 45)
    const metrics = chalk.dim(`⏱${taskElapsed} 🔧${task.toolCount}`)

    lines.push(`${statusIcon} ${chalk.bold(`Task ${task.taskId}`)}: ${taskTitle} ${metrics}`)

    if (task.status === 'running' && task.lastAction) {
      lines.push(chalk.gray(`   └─ ${task.lastAction}`))
    }
  }

  lines.push(chalk.gray('─'.repeat(70)))

  clearProgressDisplay()
  process.stdout.write(lines.join('\n'))
}

function clearProgressDisplay(): void {
  if (!currentState) return

  const lineCount = currentState.tasks.size * 2 + 4

  for (let i = 0; i < lineCount; i++) {
    process.stdout.write('\x1b[2K')
    process.stdout.write('\x1b[1A')
  }
  process.stdout.write('\x1b[2K')
  process.stdout.write('\r')
}

function renderFinalSummary(): void {
  if (!currentState) return

  const totalDuration = Date.now() - currentState.startTime
  const completed = Array.from(currentState.tasks.values()).filter(
    (t) => t.status === 'completed'
  ).length
  const failed = Array.from(currentState.tasks.values()).filter((t) => t.status === 'failed').length
  const totalTools = Array.from(currentState.tasks.values()).reduce((sum, t) => sum + t.toolCount, 0)
  const totalCost = Array.from(currentState.tasks.values()).reduce((sum, t) => sum + t.cost, 0)

  console.log()
  console.log(
    chalk.cyan.bold(`Wave ${currentState.waveIndex}/${currentState.totalWaves}`) +
      chalk.gray(` completed in ${formatDuration(totalDuration)}`)
  )
  console.log(chalk.gray('─'.repeat(70)))

  for (const task of currentState.tasks.values()) {
    const statusIcon = task.status === 'completed' ? chalk.green('✓') : chalk.red('✗')
    const taskElapsed = formatDuration(Date.now() - task.startTime)
    const costStr = task.cost > 0 ? chalk.dim(` $${task.cost.toFixed(4)}`) : ''

    console.log(
      `${statusIcon} ${chalk.bold(`Task ${task.taskId}`)}: ${truncate(task.taskTitle, 40)}` +
        chalk.gray(` (${taskElapsed}, ${task.toolCount} tools${costStr})`)
    )
  }

  console.log(chalk.gray('─'.repeat(70)))

  const successRate = currentState.tasks.size > 0 ? (completed / currentState.tasks.size) * 100 : 0
  const statusColor = failed === 0 ? chalk.green : chalk.yellow

  console.log(
    statusColor(`${completed}/${currentState.tasks.size} tasks completed`) +
      chalk.gray(` │ ${totalTools} tools │ $${totalCost.toFixed(4)} │ ${successRate.toFixed(0)}%`)
  )
  console.log()
}

export function createTaskEventHandler(
  taskId: string
): (event: StreamEvent) => void {
  return (event: StreamEvent) => {
    updateTaskProgress(taskId, event)
  }
}
