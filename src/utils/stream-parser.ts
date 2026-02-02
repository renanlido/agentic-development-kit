import ora, { type Ora } from 'ora'
import type { CollectedMetrics } from '../types/parallel'
import type { ResultSummary, SessionInfo } from '../types/result-summary'
import type { ToolInput } from '../types/tool-formatter'
import {
  formatToolDetail,
  formatToolHeader,
  formatToolResultLine,
  formatToolStart,
  parseToolResult,
  printResultSummary,
  printSessionHeader,
  printSessionInit,
  themeManager,
} from './output'

interface StreamEventContent {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
  content?: string
  tool_use_id?: string
}

interface StreamEventDelta {
  type: 'content_block_delta' | 'text_delta'
  delta?: {
    type: 'text_delta'
    text: string
  }
  text?: string
}

interface StreamEvent {
  type: 'system' | 'assistant' | 'user' | 'result' | 'stream_event'
  subtype?: string
  message?: {
    content: StreamEventContent[]
  }
  event?: StreamEventDelta
  session_id?: string
  model?: string
  tools?: string[]
  claude_code_version?: string
  duration_ms?: number
  num_turns?: number
  total_cost_usd?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

interface PendingTool {
  name: string
  input?: ToolInput
  startTime: number
}

let totalToolCount = 0
let lastPrintedText = ''
let spinner: Ora | null = null
let pendingTool: PendingTool | null = null
let sessionInfo: SessionInfo | null = null
let streamingText = ''
let isStreaming = false

let metricsCollector: CollectedMetrics | null = null

export function enableMetricsCollection(): void {
  metricsCollector = { toolCount: 0, tokenCount: 0, durationMs: 0 }
}

export function disableMetricsCollection(): void {
  metricsCollector = null
}

export function getCollectedMetrics(): CollectedMetrics | null {
  return metricsCollector ? { ...metricsCollector } : null
}

export function resetCollectedMetrics(): void {
  if (metricsCollector) {
    metricsCollector = { toolCount: 0, tokenCount: 0, durationMs: 0 }
  }
}

export function resetStreamCounters(): void {
  totalToolCount = 0
  lastPrintedText = ''
  pendingTool = null
  sessionInfo = null
  streamingText = ''
  isStreaming = false
  if (spinner) {
    spinner.stop()
    spinner = null
  }
}

export function printStreamHeader(phase: string, feature?: string): void {
  resetStreamCounters()
  printSessionHeader(phase, feature, undefined, true)
}

export function parseAndDisplayStream(line: string): void {
  try {
    const event: StreamEvent = JSON.parse(line)
    displayEvent(event)
  } catch {}
}

function displayEvent(event: StreamEvent): void {
  switch (event.type) {
    case 'system':
      if (event.subtype === 'init') {
        sessionInfo = {
          sessionId: event.session_id,
          model: event.model,
          toolCount: event.tools?.length,
          version: event.claude_code_version,
        }
        printSessionInit(sessionInfo)
      }
      break

    case 'stream_event':
      handleStreamEvent(event)
      break

    case 'assistant':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            stopSpinner()
            flushStreamingText()
            printAssistantText(block.text)
          }
          if (block.type === 'tool_use' && block.name) {
            stopSpinner()
            flushStreamingText()
            totalToolCount++
            if (metricsCollector) {
              metricsCollector.toolCount++
            }
            pendingTool = {
              name: block.name,
              input: block.input as ToolInput,
              startTime: Date.now(),
            }
            startToolSpinner(block.name, block.input as ToolInput)
          }
        }
      }
      break

    case 'user':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result' && pendingTool) {
            const isError = block.content && /error|fail|exception/i.test(block.content)
            const duration = Date.now() - pendingTool.startTime
            stopSpinner()
            printToolResult(pendingTool, block.content, !!isError, duration)
            pendingTool = null
          }
        }
      }
      break

    case 'result': {
      stopSpinner()
      flushStreamingText()

      if (metricsCollector) {
        metricsCollector.durationMs = event.duration_ms || 0
        metricsCollector.costUsd = event.total_cost_usd
        if (event.usage) {
          metricsCollector.tokenCount =
            (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0)
        }
      }

      const isError = event.subtype?.startsWith('error_') || false

      const result: ResultSummary = {
        success: !isError,
        subtype: event.subtype,
        durationMs: event.duration_ms,
        turns: event.num_turns,
        toolCount: totalToolCount,
        costUsd: event.total_cost_usd,
        inputTokens: event.usage?.input_tokens,
        outputTokens: event.usage?.output_tokens,
      }

      printResultSummary(result, {
        showTokens: true,
        showCost: true,
        showTools: true,
        showTurns: true,
        showDuration: true,
        compact: false,
      })
      break
    }
  }
}

function handleStreamEvent(event: StreamEvent): void {
  if (!event.event) return

  const delta = event.event
  let text = ''

  if (delta.type === 'content_block_delta' && delta.delta?.type === 'text_delta') {
    text = delta.delta.text
  } else if (delta.type === 'text_delta' && delta.text) {
    text = delta.text
  }

  if (text) {
    if (!isStreaming) {
      isStreaming = true
      stopSpinner()
      const colors = themeManager.getColors()
      process.stdout.write(colors.muted('💭 '))
    }
    streamingText += text
    process.stdout.write(text)
  }
}

function flushStreamingText(): void {
  if (isStreaming && streamingText) {
    process.stdout.write('\n')
    isStreaming = false
    streamingText = ''
  }
}

function startToolSpinner(toolName: string, input?: ToolInput): void {
  const formatted = formatToolStart(toolName, input)
  const label = formatted.detail
    ? `${formatted.icon} ${formatted.label} ${formatted.detail}`
    : `${formatted.icon} ${formatted.label}`

  spinner = ora({
    text: formatted.color(label),
    spinner: themeManager.getSpinnerStyle() as any,
    color: 'yellow',
  }).start()
}

function stopSpinner(): void {
  if (spinner) {
    spinner.stop()
    spinner = null
  }
}

function printToolResult(
  tool: PendingTool,
  content: string | undefined,
  isError: boolean,
  duration?: number
): void {
  const icons = themeManager.getIcons()

  if (isTaskOutputContent(content || '')) {
    printTaskOutput(content || '', isError)
    return
  }

  const header = formatToolHeader(tool.name, tool.input)
  console.log(header)

  const detail = formatToolDetail(tool.input, tool.name)
  if (detail) {
    console.log(`   ${detail}`)
  }

  const resultInfo = parseToolResult(tool.name, content)
  if (duration) {
    resultInfo.duration = duration
  }
  const resultLine = formatToolResultLine(tool.name, resultInfo)
  console.log(`   ${icons.corner} ${resultLine}`)

  if (content && content.trim() && shouldShowContent(tool.name, content)) {
    printToolContent(tool.name, content, isError)
  }

  console.log()
}

function shouldShowContent(toolName: string, content: string): boolean {
  if (toolName === 'Read') return false
  if (toolName === 'Glob') return false
  if (toolName === 'Grep' && content.split('\n').length > 50) return false
  return true
}

function printToolContent(toolName: string, content: string, isError: boolean): void {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const lines = content.split('\n')
  const maxLines = 8
  const displayLines = lines.slice(0, maxLines)
  const prefix = `   ${colors.muted(icons.line)}  `

  for (const line of displayLines) {
    if (!line.trim()) continue

    let formattedLine = line.slice(0, 90)

    if (toolName === 'Read' || toolName === 'Edit') {
      const lineNumMatch = formattedLine.match(/^(\s*\d+[→│|:])(.*)$/)
      if (lineNumMatch) {
        formattedLine = colors.muted(lineNumMatch[1]) + colors.primary(lineNumMatch[2])
      }
    }

    if (toolName === 'Bash') {
      if (line.includes('PASS') || line.includes('✓')) {
        formattedLine = colors.success(formattedLine)
      } else if (line.includes('FAIL') || line.includes('ERROR') || line.includes('✗')) {
        formattedLine = colors.error(formattedLine)
      }
    }

    if (isError) {
      formattedLine = colors.error(line.slice(0, 90))
    }

    console.log(prefix + formattedLine)
  }

  if (lines.length > maxLines) {
    console.log(prefix + colors.muted(`... +${lines.length - maxLines} lines`))
  }
}

function isTaskOutputContent(content: string): boolean {
  return (
    content.includes('<task_id>') ||
    content.includes('<retrieval_status>') ||
    content.includes('<task_type>') ||
    content.includes('<status>')
  )
}

function extractXmlValue(content: string, tag: string): string | null {
  const match = content.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return match ? match[1] : null
}

function printTaskOutput(content: string, isError: boolean): void {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const taskId = extractXmlValue(content, 'task_id')
  const status = extractXmlValue(content, 'status')
  const taskType = extractXmlValue(content, 'task_type')
  const exitCode = extractXmlValue(content, 'exit_code')
  const retrievalStatus = extractXmlValue(content, 'retrieval_status')

  const statusIcon =
    status === 'completed' && exitCode === '0'
      ? colors.success(icons.completed)
      : status === 'completed'
        ? colors.error(icons.completed)
        : status === 'running'
          ? colors.warning(icons.running)
          : colors.muted(icons.pending)

  const statusColor =
    status === 'completed' && exitCode === '0'
      ? colors.success
      : status === 'completed'
        ? colors.error
        : colors.warning

  console.log()
  console.log(
    `   ${colors.muted('╭─')} ${colors.highlight('Task')} ${colors.muted(taskId || 'unknown')} ${colors.muted('─'.repeat(Math.max(1, 30 - (taskId?.length || 7))))}`
  )

  if (taskType) {
    console.log(
      `   ${colors.muted(icons.line)}  ${colors.muted('Type:')} ${colors.primary(taskType)}`
    )
  }

  console.log(
    `   ${colors.muted(icons.line)}  ${colors.muted('Status:')} ${statusIcon} ${statusColor(status || 'unknown')}` +
      (exitCode !== null ? colors.muted(` (exit: ${exitCode})`) : '')
  )

  if (retrievalStatus && retrievalStatus !== 'success') {
    console.log(
      `   ${colors.muted(icons.line)}  ${colors.warning(icons.warning)} ${colors.warning('Retrieval:')} ${colors.warning(retrievalStatus)}`
    )
  }

  const outputMatch = content.match(/<output>([\s\S]*?)<\/output>/)
  if (outputMatch) {
    const output = outputMatch[1].trim()
    if (output) {
      console.log(`   ${colors.muted(icons.line)}`)
      console.log(`   ${colors.muted(icons.line)}  ${colors.muted('Output:')}`)
      printFormattedOutput(output, isError)
    }
  }

  console.log(`   ${colors.muted(icons.corner)}${colors.muted('─'.repeat(40))}`)
}

function printFormattedOutput(output: string, isError: boolean): void {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const lines = output.split('\n').filter((l) => l.trim())
  const maxLines = 8
  const displayLines = lines.slice(0, maxLines)
  const prefix = `   ${colors.muted(icons.line)}    `

  for (const line of displayLines) {
    let formattedLine = line.slice(0, 85)

    if (line.includes('PASS') || line.includes('✓') || line.includes('success')) {
      formattedLine = colors.success(formattedLine)
    } else if (
      line.includes('FAIL') ||
      line.includes('ERROR') ||
      line.includes('Error') ||
      line.includes('✗') ||
      isError
    ) {
      formattedLine = colors.error(formattedLine)
    } else if (line.includes('WARN') || line.includes('warning')) {
      formattedLine = colors.warning(formattedLine)
    } else if (line.match(/^\s*at\s+/)) {
      formattedLine = colors.muted(formattedLine)
    } else {
      formattedLine = colors.primary(formattedLine)
    }

    console.log(prefix + formattedLine)
  }

  if (lines.length > maxLines) {
    console.log(prefix + colors.muted(`... +${lines.length - maxLines} lines`))
  }
}

function printAssistantText(text: string): void {
  const colors = themeManager.getColors()
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

    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0
    const indent = '  '.repeat(Math.floor(leadingSpaces / 2))

    const h1Match = trimmed.match(/^#\s+(.+)$/)
    if (h1Match) {
      console.log()
      console.log(themeManager.formatBold(themeManager.formatUnderline(h1Match[1])))
      console.log()
      lastPrintedText = trimmed
      continue
    }

    const h2Match = trimmed.match(/^##\s+(.+)$/)
    if (h2Match) {
      console.log()
      console.log(colors.highlight(themeManager.formatBold(h2Match[1])))
      lastPrintedText = trimmed
      continue
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/)
    if (h3Match) {
      console.log(colors.highlight(h3Match[1]))
      lastPrintedText = trimmed
      continue
    }

    const h4Match = trimmed.match(/^####\s+(.+)$/)
    if (h4Match) {
      console.log(themeManager.formatBold(h4Match[1]))
      lastPrintedText = trimmed
      continue
    }

    const emojiHeaderMatch = trimmed.match(/^([✅❌⚠️🔴🟢🟡📋🎯💡🚀✨🔧📦🔒⭐])\s*(.+)$/)
    if (emojiHeaderMatch && !trimmed.startsWith('•') && !trimmed.startsWith('-')) {
      console.log()
      console.log(
        emojiHeaderMatch[1] + ' ' + themeManager.formatBold(formatInlineCode(emojiHeaderMatch[2]))
      )
      lastPrintedText = trimmed
      continue
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/)
    if (bulletMatch) {
      console.log(indent + colors.muted('• ') + formatInlineCode(bulletMatch[1]))
      lastPrintedText = trimmed
      continue
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      console.log(
        indent + colors.muted(`${numberedMatch[1]}. `) + formatInlineCode(numberedMatch[2])
      )
      lastPrintedText = trimmed
      continue
    }

    const tableRowMatch = trimmed.match(/^\|(.+)\|$/)
    if (tableRowMatch) {
      const cells = tableRowMatch[1].split('|').map((c) => c.trim())
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        console.log(colors.muted('─'.repeat(70)))
      } else {
        const formatted = cells.map((c) => formatInlineCode(c)).join(colors.muted(' │ '))
        console.log(colors.muted('│ ') + formatted + colors.muted(' │'))
      }
      lastPrintedText = trimmed
      continue
    }

    console.log(indent + formatInlineCode(trimmed))
    lastPrintedText = trimmed
  }
}

function printInsightBlock(text: string): void {
  const colors = themeManager.getColors()
  const lines = text.split('\n')
  const content: string[] = []
  let inBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.includes('★ Insight') || trimmed.match(/Insight\s*[─-]/i)) {
      inBlock = true
      continue
    }

    if (inBlock && trimmed.match(/^[─-]+$/)) {
      break
    }

    if (inBlock && trimmed) {
      content.push(trimmed)
    }
  }

  console.log()
  console.log(colors.muted(`★ Insight ${'─'.repeat(60)}`))
  console.log(formatInlineCode(content.join(' ')))
  console.log(colors.muted('─'.repeat(70)))
}

function formatInlineCode(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, content) => themeManager.formatBold(content))
    .replace(/`([^`]+)`/g, (_, code) => themeManager.formatInverse(` ${code} `))
}
