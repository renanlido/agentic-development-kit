import chalk from 'chalk'

interface StreamEventContent {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
  content?: string
  tool_use_id?: string
}

interface StreamEvent {
  type: 'system' | 'assistant' | 'user' | 'result'
  subtype?: string
  message?: {
    content: StreamEventContent[]
  }
  session_id?: string
  duration_ms?: number
  num_turns?: number
  total_cost_usd?: number
}

export function parseAndDisplayStream(line: string): void {
  try {
    const event: StreamEvent = JSON.parse(line)
    displayEvent(event)
  } catch {
    // Linha não é JSON válido, ignorar
  }
}

function displayEvent(event: StreamEvent): void {
  switch (event.type) {
    case 'system':
      if (event.subtype === 'init') {
        console.log(chalk.gray('  ⚡ Sessão Claude iniciada'))
      }
      break

    case 'assistant':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            const text = truncateText(block.text, 120)
            if (text.trim()) {
              console.log(chalk.cyan(`  💭 ${text}`))
            }
          }
          if (block.type === 'tool_use' && block.name) {
            const input = formatToolInput(block.name, block.input)
            console.log(chalk.yellow(`  🔧 ${block.name}${input ? `: ${input}` : ''}`))
          }
        }
      }
      break

    case 'user':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result') {
            console.log(chalk.green('  ✅ Executado'))
          }
        }
      }
      break

    case 'result': {
      const parts: string[] = []
      if (event.duration_ms) {
        parts.push(`${(event.duration_ms / 1000).toFixed(1)}s`)
      }
      if (event.num_turns) {
        parts.push(`${event.num_turns} turns`)
      }
      if (event.total_cost_usd) {
        parts.push(`$${event.total_cost_usd.toFixed(4)}`)
      }
      const stats = parts.length > 0 ? ` (${parts.join(', ')})` : ''
      console.log(chalk.gray(`  ✨ Sessão finalizada${stats}`))
      break
    }
  }
}

function truncateText(text: string, maxLength: number): string {
  const firstLine = text.split('\n')[0].trim()
  if (firstLine.length <= maxLength) {
    return firstLine
  }
  return `${firstLine.slice(0, maxLength - 3)}...`
}

function formatToolInput(tool: string, input?: Record<string, unknown>): string {
  if (!input) {
    return ''
  }

  switch (tool) {
    case 'Read':
      return truncatePath(input.file_path as string)
    case 'Write':
      return truncatePath(input.file_path as string)
    case 'Edit':
      return truncatePath(input.file_path as string)
    case 'Bash': {
      const cmd = (input.command as string) || ''
      return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd
    }
    case 'Grep':
      return `"${input.pattern}" em ${truncatePath(input.path as string) || '.'}`
    case 'Glob':
      return (input.pattern as string) || ''
    case 'Task':
      return (input.description as string) || ''
    case 'TodoWrite':
    case 'TaskCreate':
      return (input.subject as string) || ''
    case 'TaskUpdate':
      return `#${input.taskId} → ${input.status || 'update'}`
    default:
      return ''
  }
}

function truncatePath(filePath?: string): string {
  if (!filePath) {
    return ''
  }
  if (filePath.length <= 50) {
    return filePath
  }
  const parts = filePath.split('/')
  if (parts.length <= 2) {
    return filePath
  }
  return `.../${parts.slice(-2).join('/')}`
}
