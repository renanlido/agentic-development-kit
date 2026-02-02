import type { ResultDisplayOptions, ResultSummary } from '../../types/result-summary'
import { renderBox } from './box-renderer'
import { formatErrorResult } from './error-handler'
import { themeManager } from './theme-manager'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function formatTokens(count: number): string {
  if (count < 1000) return `${count}`
  return `${(count / 1000).toFixed(1)}k`
}

export function formatResultSummary(
  result: ResultSummary,
  options: ResultDisplayOptions = {}
): string[] {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const {
    showTokens = true,
    showCost = true,
    showTools = true,
    showTurns = true,
    showDuration = true,
    compact = false,
  } = options

  if (!result.success) {
    return formatErrorResult(result.subtype, result.durationMs, result.turns)
  }

  const lines: string[] = []

  const successIcon = themeManager.noColor ? '[OK]' : '✨'
  lines.push(`${successIcon} ${colors.success('Completed Successfully')}`)

  if (compact) {
    const parts: string[] = []
    if (showDuration && result.durationMs) {
      parts.push(formatDuration(result.durationMs))
    }
    if (showTurns && result.turns) {
      parts.push(`${result.turns} turns`)
    }
    if (showTools && result.toolCount) {
      parts.push(`${result.toolCount} tools`)
    }
    if (showCost && result.costUsd) {
      parts.push(formatCost(result.costUsd))
    }
    if (parts.length > 0) {
      lines.push(colors.muted(parts.join(' · ')))
    }
    return lines
  }

  const metrics: string[] = []

  if (showDuration && result.durationMs) {
    metrics.push(`${icons.clock} Duration   │  ${formatDuration(result.durationMs)}`)
  }

  if (showTurns && result.turns) {
    metrics.push(`${icons.turns} Turns     │  ${result.turns}`)
  }

  if (showTools && result.toolCount) {
    metrics.push(`${icons.tools} Tools     │  ${result.toolCount} executions`)
  }

  if (showCost && result.costUsd) {
    metrics.push(`${icons.cost} Cost      │  ${formatCost(result.costUsd)}`)
  }

  if (showTokens && (result.inputTokens || result.outputTokens)) {
    const input = result.inputTokens ? formatTokens(result.inputTokens) : '0'
    const output = result.outputTokens ? formatTokens(result.outputTokens) : '0'
    metrics.push(`${icons.tokens} Tokens    │  ${input} in / ${output} out`)
  }

  for (const metric of metrics) {
    lines.push(colors.muted(`  ${metric}`))
  }

  return lines
}

export function printResultSummary(
  result: ResultSummary,
  options: ResultDisplayOptions = {},
  useBox = true
): void {
  const colors = themeManager.getColors()
  const lines = formatResultSummary(result, options)

  console.log()

  if (useBox && !options.compact) {
    const borderColor = result.success ? colors.success : colors.error
    const style = result.success ? 'double' : 'rounded'

    const boxLines = renderBox(lines, {
      style,
      borderColor,
      padding: 1,
    })
    for (const line of boxLines) {
      console.log(line)
    }
  } else {
    console.log(colors.muted('─'.repeat(70)))
    for (const line of lines) {
      console.log(line)
    }
  }

  console.log()
}

export function printCompactResult(
  durationMs?: number,
  turns?: number,
  toolCount?: number,
  costUsd?: number
): void {
  const colors = themeManager.getColors()
  const parts: string[] = []

  if (durationMs) {
    parts.push(formatDuration(durationMs))
  }
  if (turns) {
    parts.push(`${turns} turns`)
  }
  if (toolCount) {
    parts.push(`${toolCount} tools`)
  }
  if (costUsd) {
    parts.push(formatCost(costUsd))
  }

  const successIcon = themeManager.noColor ? '[OK]' : '✨'
  console.log(colors.muted('─'.repeat(70)))
  console.log(`${colors.success(successIcon + ' Completed')} ${colors.muted(parts.join(' · '))}`)
}
