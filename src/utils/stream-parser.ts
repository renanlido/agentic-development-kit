import chalk from 'chalk'
import ora, { type Ora } from 'ora'

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

interface PendingTool {
  name: string
  input?: Record<string, unknown>
}

let totalToolCount = 0
let lastPrintedText = ''
let spinner: Ora | null = null
let pendingTool: PendingTool | null = null

export function resetStreamCounters(): void {
  totalToolCount = 0
  lastPrintedText = ''
  pendingTool = null
  if (spinner) {
    spinner.stop()
    spinner = null
  }
}

export function printStreamHeader(phase: string, feature?: string): void {
  resetStreamCounters()
  console.log()
  console.log(
    chalk.bgCyan.black.bold(` ADK `) + chalk.bgGray.white.bold(` ${phase.toUpperCase()} `)
  )
  if (feature) {
    console.log(chalk.gray(`Feature: ${feature}`))
  }
  console.log(chalk.gray('─'.repeat(70)))
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
        console.log(chalk.gray('⚡ Sessão iniciada\n'))
      }
      break

    case 'assistant':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            stopSpinner()
            printAssistantText(block.text)
          }
          if (block.type === 'tool_use' && block.name) {
            stopSpinner()
            totalToolCount++
            pendingTool = { name: block.name, input: block.input }
            startToolSpinner(block.name, block.input)
          }
        }
      }
      break

    case 'user':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result' && pendingTool) {
            const isError = block.content && /error|fail|exception/i.test(block.content)
            stopSpinner()
            printToolResult(pendingTool, block.content, !!isError)
            pendingTool = null
          }
        }
      }
      break

    case 'result': {
      stopSpinner()
      console.log(chalk.gray('─'.repeat(70)))
      const parts: string[] = []
      if (event.duration_ms) {
        parts.push(`${(event.duration_ms / 1000).toFixed(1)}s`)
      }
      if (event.num_turns) {
        parts.push(`${event.num_turns} turns`)
      }
      if (totalToolCount > 0) {
        parts.push(`${totalToolCount} tools`)
      }
      if (event.total_cost_usd) {
        parts.push(`$${event.total_cost_usd.toFixed(4)}`)
      }
      console.log(chalk.green('✨ Concluído ') + chalk.gray(parts.join(' · ')))
      break
    }
  }
}

function startToolSpinner(toolName: string, input?: Record<string, unknown>): void {
  let label = toolName

  if (input) {
    if (toolName === 'Read' && input.file_path) {
      label = `Read(${shortenPath(String(input.file_path))})`
    } else if (toolName === 'Edit' && input.file_path) {
      label = `Edit(${shortenPath(String(input.file_path))})`
    } else if (toolName === 'Write' && input.file_path) {
      label = `Write(${shortenPath(String(input.file_path))})`
    } else if (toolName === 'Bash' && input.command) {
      const cmd = String(input.command).slice(0, 40)
      label = `Bash(${cmd}${String(input.command).length > 40 ? '...' : ''})`
    } else if (toolName === 'Grep' && input.pattern) {
      label = `Grep("${String(input.pattern).slice(0, 20)}")`
    } else if (toolName === 'Glob' && input.pattern) {
      label = `Glob(${String(input.pattern)})`
    }
  }

  spinner = ora({
    text: chalk.yellow(label),
    spinner: 'dots',
    color: 'yellow',
  }).start()
}

function stopSpinner(): void {
  if (spinner) {
    spinner.stop()
    spinner = null
  }
}

function printToolResult(tool: PendingTool, content: string | undefined, isError: boolean): void {
  const icon = isError ? chalk.red('✗') : chalk.green('✓')
  let label = tool.name

  if (tool.input) {
    if (tool.name === 'Read' && tool.input.file_path) {
      label = `Read(${shortenPath(String(tool.input.file_path))})`
    } else if (tool.name === 'Edit' && tool.input.file_path) {
      label = `Edit(${shortenPath(String(tool.input.file_path))})`
    } else if (tool.name === 'Write' && tool.input.file_path) {
      label = `Write(${shortenPath(String(tool.input.file_path))})`
    } else if (tool.name === 'Bash') {
      label = 'Bash'
    } else if (tool.name === 'Grep' && tool.input.pattern) {
      label = `Grep("${String(tool.input.pattern).slice(0, 20)}")`
    } else if (tool.name === 'Glob' && tool.input.pattern) {
      label = `Glob(${String(tool.input.pattern)})`
    }
  }

  console.log(chalk.yellow(`🔧 ${label} `) + icon)

  if (content && content.trim()) {
    printToolContent(tool.name, content, isError)
  }
}

function printToolContent(toolName: string, content: string, isError: boolean): void {
  const lines = content.split('\n')
  const maxLines = 12
  const displayLines = lines.slice(0, maxLines)
  const prefix = isError ? chalk.red('  │ ') : chalk.gray('  │ ')

  for (const line of displayLines) {
    if (!line.trim()) continue

    let formattedLine = line.slice(0, 100)

    if (toolName === 'Read' || toolName === 'Edit') {
      const lineNumMatch = formattedLine.match(/^(\s*\d+[→│|:])(.*)$/)
      if (lineNumMatch) {
        formattedLine = chalk.gray(lineNumMatch[1]) + chalk.white(lineNumMatch[2])
      }
    }

    if (toolName === 'Bash') {
      if (line.includes('PASS') || line.includes('✓')) {
        formattedLine = chalk.green(formattedLine)
      } else if (line.includes('FAIL') || line.includes('ERROR') || line.includes('✗')) {
        formattedLine = chalk.red(formattedLine)
      }
    }

    if (isError) {
      formattedLine = chalk.red(line.slice(0, 100))
    }

    console.log(prefix + formattedLine)
  }

  if (lines.length > maxLines) {
    console.log(prefix + chalk.gray(`... (${lines.length - maxLines} more lines)`))
  }
}

function shortenPath(filePath: string): string {
  const parts = filePath.split('/')
  if (parts.length <= 3) return filePath
  return '.../' + parts.slice(-2).join('/')
}

function printAssistantText(text: string): void {
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed === lastPrintedText) continue

    if (trimmed.includes('★ Insight') || trimmed.match(/Insight\s*[─-]/i)) {
      printInsightBlock(text)
      lastPrintedText = trimmed
      return
    }

    const h1Match = trimmed.match(/^#\s+(.+)$/)
    if (h1Match) {
      console.log()
      console.log(chalk.bold.white.underline(h1Match[1]))
      console.log()
      lastPrintedText = trimmed
      continue
    }

    const h2Match = trimmed.match(/^##\s+(.+)$/)
    if (h2Match) {
      console.log()
      console.log(chalk.bold.cyan(h2Match[1]))
      lastPrintedText = trimmed
      continue
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/)
    if (h3Match) {
      console.log(chalk.cyan(h3Match[1]))
      lastPrintedText = trimmed
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      console.log(chalk.gray('  • ') + formatInlineCode(bulletMatch[1]))
      lastPrintedText = trimmed
      continue
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      console.log(chalk.gray(`  ${numberedMatch[1]}. `) + formatInlineCode(numberedMatch[2]))
      lastPrintedText = trimmed
      continue
    }

    console.log(formatInlineCode(trimmed))
    lastPrintedText = trimmed
  }
}

function printInsightBlock(text: string): void {
  const lines = text.split('\n')
  let title = 'Insight'
  const content: string[] = []
  let inBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.includes('★ Insight') || trimmed.match(/Insight\s*[─-]/i)) {
      inBlock = true
      const titleMatch = trimmed.match(/Insight\s*[─-]+\s*(.*)$/i)
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim() || 'Insight'
      }
      continue
    }

    if (inBlock && trimmed.match(/^[─-]+$/)) {
      break
    }

    if (inBlock && trimmed) {
      content.push(trimmed)
    }
  }

  const boxWidth = 66
  console.log()
  console.log(chalk.cyan(`┌─ ★ ${title} ${'─'.repeat(Math.max(0, boxWidth - title.length - 6))}┐`))

  for (const line of content) {
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      console.log(
        chalk.cyan('│ ') + chalk.white(`${numberedMatch[1]}. `) + formatInlineCode(numberedMatch[2])
      )
    } else {
      console.log(chalk.cyan('│ ') + formatInlineCode(line))
    }
  }

  console.log(chalk.cyan(`└${'─'.repeat(boxWidth)}┘`))
}

function formatInlineCode(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, content) => chalk.bold(content))
    .replace(/`([^`]+)`/g, (_, code) => chalk.bgGray.white(` ${code} `))
}
