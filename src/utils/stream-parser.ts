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

let totalToolCount = 0
let batchToolSuccess = 0
let batchToolFailed = 0
let batchTools: string[] = []
let lastPrintedText = ''

export function resetStreamCounters(): void {
  totalToolCount = 0
  batchToolSuccess = 0
  batchToolFailed = 0
  batchTools = []
  lastPrintedText = ''
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
            flushToolBatch()
            printAssistantText(block.text)
          }
          if (block.type === 'tool_use' && block.name) {
            totalToolCount++
            batchTools.push(block.name)
          }
        }
      }
      break

    case 'user':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result') {
            const isError = block.content && /error|fail|exception/i.test(block.content)
            if (isError) {
              batchToolFailed++
            } else {
              batchToolSuccess++
            }
          }
        }
      }
      break

    case 'result': {
      flushToolBatch()
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

function flushToolBatch(): void {
  if (batchTools.length === 0) return

  const uniqueTools = [...new Set(batchTools)]
  const toolList = uniqueTools.slice(0, 5).join(', ')
  const extra = uniqueTools.length > 5 ? ` +${uniqueTools.length - 5}` : ''

  let statusBadge = ''
  if (batchToolSuccess > 0) {
    statusBadge += chalk.green(` ✓${batchToolSuccess}`)
  }
  if (batchToolFailed > 0) {
    statusBadge += chalk.red(` ✗${batchToolFailed}`)
  }

  console.log(chalk.yellow(`🔧 ${toolList}${extra}`) + statusBadge)

  batchTools = []
  batchToolSuccess = 0
  batchToolFailed = 0
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
