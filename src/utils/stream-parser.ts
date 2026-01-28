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
            const lines = formatTextBlock(block.text)
            for (const line of lines) {
              if (line.trim()) {
                console.log(chalk.cyan(`  💭 ${line}`))
              }
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
          if (block.type === 'tool_result' && block.content) {
            const preview = formatToolResult(block.content)
            if (preview) {
              console.log(chalk.green(`  ✅ ${preview}`))
            }
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

function formatTextBlock(text: string, maxLines = 5, maxLineLength = 200): string[] {
  const lines = text.split('\n').filter((line) => line.trim())
  const result: string[] = []

  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    const line = lines[i].trim()
    if (line.length <= maxLineLength) {
      result.push(line)
    } else {
      result.push(`${line.slice(0, maxLineLength - 3)}...`)
    }
  }

  if (lines.length > maxLines) {
    result.push(`... (+${lines.length - maxLines} linhas)`)
  }

  return result
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
    case 'Edit': {
      const path = truncatePath(input.file_path as string)
      const oldStr = input.old_string as string
      if (oldStr) {
        const preview = oldStr.split('\n')[0].slice(0, 40)
        return `${path} (${preview}${oldStr.length > 40 ? '...' : ''})`
      }
      return path
    }
    case 'Bash': {
      const cmd = (input.command as string) || ''
      return cmd.length > 100 ? `${cmd.slice(0, 97)}...` : cmd
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
    case 'WebFetch':
      return (input.url as string) || ''
    case 'WebSearch':
      return (input.query as string) || ''
    default:
      return ''
  }
}

function truncatePath(filePath?: string): string {
  if (!filePath) {
    return ''
  }
  if (filePath.length <= 80) {
    return filePath
  }
  const parts = filePath.split('/')
  if (parts.length <= 3) {
    return filePath
  }
  return `.../${parts.slice(-3).join('/')}`
}

function formatToolResult(content: string): string {
  if (!content || content.length === 0) {
    return 'OK'
  }

  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length === 0) {
    return 'OK'
  }

  if (content.includes('error') || content.includes('Error') || content.includes('ERROR')) {
    const errorLine = lines.find((l) => /error/i.test(l)) || lines[0]
    return errorLine.slice(0, 100) + (errorLine.length > 100 ? '...' : '')
  }

  if (lines.length === 1) {
    return lines[0].slice(0, 80) + (lines[0].length > 80 ? '...' : '')
  }

  return `${lines.length} linhas`
}
