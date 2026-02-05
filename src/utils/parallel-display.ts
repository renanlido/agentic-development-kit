import chalk from 'chalk'
import type { StreamEvent } from '../types/stream-events'

export interface AgentState {
  taskId: string
  taskTitle: string
  agentId: string
  currentAction: string
  status: 'running' | 'validating' | 'completed' | 'failed'
  toolCount: number
  tokenCount: number
  startTime: number
  lastActivityTime: number
}

export interface ParallelDisplayOptions {
  showTokens?: boolean
  maxActionLength?: number
  throttleMs?: number
}

export class ParallelDisplayManager {
  private agents: Map<string, AgentState> = new Map()
  private lineCount = 0
  private options: ParallelDisplayOptions
  private isTerminalSupported: boolean
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private frameIndex = 0
  private lastRenderTime = 0
  private pendingRender = false
  private renderLock = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: ParallelDisplayOptions = {}) {
    this.options = {
      showTokens: true,
      maxActionLength: 40,
      throttleMs: 100,
      ...options,
    }
    this.isTerminalSupported = this.checkTerminalSupport()
  }

  private getSpinnerFrame(): string {
    const frame = this.spinnerFrames[this.frameIndex]
    this.frameIndex = (this.frameIndex + 1) % this.spinnerFrames.length
    return frame
  }

  private checkTerminalSupport(): boolean {
    return process.stdout.isTTY === true && process.env.TERM !== 'dumb' && !process.env.CI
  }

  registerAgent(taskId: string, taskTitle: string): string {
    const agentId = `agent-${this.agents.size + 1}`
    const truncatedTitle = taskTitle.length > 45 ? taskTitle.slice(0, 42) + '...' : taskTitle
    const now = Date.now()
    this.agents.set(agentId, {
      taskId,
      taskTitle: truncatedTitle,
      agentId,
      currentAction: 'Starting...',
      status: 'running',
      toolCount: 0,
      tokenCount: 0,
      startTime: now,
      lastActivityTime: now,
    })
    return agentId
  }

  updateAction(agentId: string, action: string): void {
    const agent = this.agents.get(agentId)
    if (agent && agent.status === 'running') {
      agent.currentAction = this.truncateAction(action)
      agent.lastActivityTime = Date.now()
      this.scheduleRender()
    }
  }

  incrementToolCount(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.toolCount++
    }
  }

  updateTokenCount(agentId: string, tokens: number): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.tokenCount = tokens
    }
  }

  markCompleted(agentId: string, toolCount?: number, tokenCount?: number): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = 'completed'
      agent.currentAction = 'Done'
      if (toolCount !== undefined) agent.toolCount = toolCount
      if (tokenCount !== undefined) agent.tokenCount = tokenCount
      this.renderNow()
    }
  }

  markValidating(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = 'validating'
      agent.currentAction = 'Validating...'
      this.renderNow()
    }
  }

  markFailed(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = 'failed'
      agent.currentAction = 'Failed'
      this.renderNow()
    }
  }

  private truncateAction(action: string): string {
    const maxLen = this.options.maxActionLength || 40
    const cleaned = action.replace(/[\n\r]/g, ' ').trim()
    if (cleaned.length <= maxLen) return cleaned
    return cleaned.slice(0, maxLen - 3) + '...'
  }

  private formatTokens(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return `${count}`
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) {
      return `${minutes}m${seconds}s`
    }
    return `${seconds}s`
  }

  private getActivityIndicator(lastActivityTime: number): string {
    const timeSinceActivity = Date.now() - lastActivityTime
    if (timeSinceActivity < 2000) {
      return chalk.green('●')
    }
    if (timeSinceActivity < 10000) {
      return chalk.yellow('●')
    }
    return chalk.red('●')
  }

  private scheduleRender(): void {
    const now = Date.now()
    const throttleMs = this.options.throttleMs || 100

    if (now - this.lastRenderTime >= throttleMs) {
      this.renderNow()
    } else if (!this.pendingRender) {
      this.pendingRender = true
      setTimeout(
        () => {
          this.pendingRender = false
          this.renderNow()
        },
        throttleMs - (now - this.lastRenderTime)
      )
    }
  }

  private renderNow(): void {
    if (this.renderLock) return
    this.renderLock = true
    this.lastRenderTime = Date.now()

    try {
      this.doRender()
    } finally {
      this.renderLock = false
    }
  }

  private doRender(): void {
    if (!this.isTerminalSupported) return

    const agentArray = Array.from(this.agents.values())
    if (agentArray.length === 0) return

    const completed = agentArray.filter(
      (a) => a.status !== 'running' && a.status !== 'validating'
    ).length
    const validating = agentArray.filter((a) => a.status === 'validating').length
    const total = agentArray.length
    const expectedLineCount = 1 + agentArray.length * 2

    process.stdout.write('\x1B[?25l')

    if (this.lineCount > 0) {
      process.stdout.write(`\x1B[${this.lineCount}A`)
      process.stdout.write('\x1B[0J')
    }

    const totalTools = agentArray.reduce((sum, a) => sum + a.toolCount, 0)
    const runningAgents = agentArray.filter(
      (a) => a.status === 'running' || a.status === 'validating'
    )
    const oldestRunning =
      runningAgents.length > 0 ? Math.max(...runningAgents.map((a) => Date.now() - a.startTime)) : 0
    const elapsedStr = oldestRunning > 0 ? this.formatDuration(oldestRunning) : ''

    let header: string
    if (completed + validating === total && validating > 0) {
      header = chalk.yellow(
        `⏳ Validating ${validating} task${validating > 1 ? 's' : ''} │ ${totalTools} total tools`
      )
    } else if (completed === total) {
      header = chalk.green(`✔ ${total} subagents finished │ ${totalTools} total tools`)
    } else {
      header =
        chalk.cyan(`⏳ ${total - completed - validating} running · ${completed}/${total} done`) +
        chalk.gray(` │ ${totalTools} tools`) +
        (elapsedStr ? chalk.dim(` │ ${elapsedStr}`) : '')
    }

    process.stdout.write(`   ${header}\n`)

    agentArray.forEach((agent, index) => {
      const isLast = index === agentArray.length - 1
      const prefix = isLast ? '└─' : '├─'
      const vertLine = isLast ? '   ' : '│  '

      let statusIcon: string
      let statusColor: (s: string) => string

      if (agent.status === 'running') {
        statusIcon = this.getSpinnerFrame()
        statusColor = chalk.cyan
      } else if (agent.status === 'validating') {
        statusIcon = this.getSpinnerFrame()
        statusColor = chalk.yellow
      } else if (agent.status === 'completed') {
        statusIcon = '✓'
        statusColor = chalk.green
      } else {
        statusIcon = '✗'
        statusColor = chalk.red
      }

      const elapsed = this.formatDuration(Date.now() - agent.startTime)

      let metricsStr: string
      if (agent.status === 'running') {
        const activityIndicator = this.getActivityIndicator(agent.lastActivityTime)
        metricsStr = chalk.gray(` ${activityIndicator} ${elapsed} │ ${agent.toolCount} tools`)
      } else if (agent.status === 'validating') {
        metricsStr = chalk.gray(` ${elapsed} │ ${agent.toolCount} tools`)
      } else if (this.options.showTokens) {
        metricsStr = chalk.gray(
          ` ${elapsed} │ ${agent.toolCount} tools │ ${this.formatTokens(agent.tokenCount)} tok`
        )
      } else {
        metricsStr = chalk.gray(` ${elapsed}`)
      }

      const taskLine = `   ${chalk.gray(prefix)} ${statusColor(statusIcon)} Task ${agent.taskId}: ${agent.taskTitle}${metricsStr}`
      process.stdout.write(`${taskLine}\n`)

      if (agent.status === 'running' || agent.status === 'validating') {
        const actionLine = `   ${chalk.gray(vertLine)}   ${chalk.dim('└─')} ${chalk.gray(agent.currentAction)}`
        process.stdout.write(`${actionLine}\n`)
      } else {
        process.stdout.write(`   ${chalk.gray(vertLine)}\n`)
      }
    })

    process.stdout.write('\x1B[?25h')
    this.lineCount = expectedLineCount
  }

  renderInitial(): void {
    if (!this.isTerminalSupported) {
      console.log(`   ${chalk.cyan(`⏳ ${this.agents.size} subagents starting...`)}`)
      this.agents.forEach((agent, _, map) => {
        const agentArray = Array.from(map.values())
        const index = agentArray.indexOf(agent)
        const isLast = index === agentArray.length - 1
        const prefix = isLast ? '└─' : '├─'
        console.log(`   ${chalk.gray(prefix)} Task ${agent.taskId}: ${agent.taskTitle}`)
      })
      return
    }

    this.renderNow()

    this.heartbeatInterval = setInterval(() => {
      const hasRunning = Array.from(this.agents.values()).some((a) => a.status === 'running')
      if (hasRunning) {
        this.renderNow()
      }
    }, 1000)
  }

  extractActionFromEvent(event: StreamEvent): string | null {
    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'tool_use' && block.name) {
          return this.formatToolAction(block.name, block.input)
        }
      }
    }
    return null
  }

  isToolUseEvent(event: StreamEvent): boolean {
    if (event.type === 'assistant' && event.message?.content) {
      return event.message.content.some((block) => block.type === 'tool_use')
    }
    return false
  }

  private formatToolAction(toolName: string, input?: Record<string, unknown>): string {
    switch (toolName) {
      case 'Read': {
        const filePath = input?.file_path as string
        if (filePath) {
          const parts = filePath.split('/')
          const fileName =
            parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : parts.pop() || filePath
          return `📖 ${fileName}`
        }
        return '📖 Reading file'
      }
      case 'Write': {
        const filePath = input?.file_path as string
        if (filePath) {
          const parts = filePath.split('/')
          const fileName =
            parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : parts.pop() || filePath
          return `✏️ ${fileName}`
        }
        return '✏️ Writing file'
      }
      case 'Edit': {
        const filePath = input?.file_path as string
        if (filePath) {
          const parts = filePath.split('/')
          const fileName =
            parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : parts.pop() || filePath
          return `📝 ${fileName}`
        }
        return '📝 Editing file'
      }
      case 'Bash': {
        const command = input?.command as string
        if (command) {
          const trimmed = command.trim()
          const firstLine = trimmed.split('\n')[0]
          const shortCmd = firstLine.length > 35 ? firstLine.slice(0, 32) + '...' : firstLine
          return `⚡ ${shortCmd}`
        }
        return '⚡ Running command'
      }
      case 'Grep': {
        const pattern = input?.pattern as string
        if (pattern) {
          const shortPattern = pattern.length > 20 ? pattern.slice(0, 17) + '...' : pattern
          return `🔎 grep "${shortPattern}"`
        }
        return '🔎 Searching code'
      }
      case 'Glob': {
        const pattern = input?.pattern as string
        if (pattern) {
          return `🔍 ${pattern}`
        }
        return '🔍 Finding files'
      }
      case 'Task': {
        const desc = input?.description as string
        if (desc) {
          const shortDesc = desc.length > 25 ? desc.slice(0, 22) + '...' : desc
          return `🤖 ${shortDesc}`
        }
        return '🤖 Spawning agent'
      }
      case 'WebFetch':
        return '🌐 Fetching URL'
      case 'WebSearch':
        return '🔍 Web search'
      case 'TodoWrite':
      case 'TaskCreate':
        return '📋 Creating task'
      case 'TaskUpdate':
        return '📋 Updating task'
      case 'AskUserQuestion':
        return '❓ Awaiting input'
      default:
        return `🔧 ${toolName}`
    }
  }

  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    process.stdout.write('\x1B[?25h')
  }
}
