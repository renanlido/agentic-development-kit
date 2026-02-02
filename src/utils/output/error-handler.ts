import type { ErrorInfo, ErrorSubtype } from '../../types/stream-events'
import { renderBox } from './box-renderer'
import { themeManager } from './theme-manager'

const errorInfoMap: Record<ErrorSubtype, { icon: string; suggestion: string }> = {
  api_error: {
    icon: '🔌',
    suggestion: 'Check API status and try again',
  },
  rate_limit: {
    icon: '⏳',
    suggestion: 'Wait a moment and retry',
  },
  context_overflow: {
    icon: '📦',
    suggestion: 'Run `adk feature compact <name>` to reduce context',
  },
  authentication: {
    icon: '🔐',
    suggestion: 'Check your API key configuration',
  },
  permission_denied: {
    icon: '🚫',
    suggestion: 'Verify file/directory permissions',
  },
  tool_execution: {
    icon: '🔧',
    suggestion: 'Check tool input and try again',
  },
  timeout: {
    icon: '⏰',
    suggestion: 'Increase timeout or simplify operation',
  },
  network: {
    icon: '🌐',
    suggestion: 'Check internet connection',
  },
  error_max_turns: {
    icon: '🔄',
    suggestion: 'Increase --max-turns or simplify the task',
  },
  error_during_execution: {
    icon: '💥',
    suggestion: 'Check error details and retry',
  },
  error_max_budget_usd: {
    icon: '💸',
    suggestion: 'Increase budget limit or reduce task scope',
  },
}

export function getErrorInfo(subtype: ErrorSubtype): ErrorInfo {
  const colors = themeManager.getColors()
  const info = errorInfoMap[subtype] || errorInfoMap.tool_execution
  return {
    subtype,
    icon: themeManager.noColor ? '[!]' : info.icon,
    suggestion: info.suggestion,
    color: colors.error,
  }
}

export function detectErrorSubtype(content: string): ErrorSubtype | null {
  const lowerContent = content.toLowerCase()

  if (lowerContent.includes('rate limit') || lowerContent.includes('rate_limit')) {
    return 'rate_limit'
  }
  if (
    lowerContent.includes('context') &&
    (lowerContent.includes('overflow') || lowerContent.includes('too long'))
  ) {
    return 'context_overflow'
  }
  if (
    lowerContent.includes('authentication') ||
    lowerContent.includes('unauthorized') ||
    lowerContent.includes('api key')
  ) {
    return 'authentication'
  }
  if (
    lowerContent.includes('permission') ||
    lowerContent.includes('access denied') ||
    lowerContent.includes('eacces')
  ) {
    return 'permission_denied'
  }
  if (lowerContent.includes('timeout') || lowerContent.includes('timed out')) {
    return 'timeout'
  }
  if (
    lowerContent.includes('network') ||
    lowerContent.includes('enotfound') ||
    lowerContent.includes('econnrefused')
  ) {
    return 'network'
  }
  if (lowerContent.includes('max turns') || lowerContent.includes('max_turns')) {
    return 'error_max_turns'
  }
  if (lowerContent.includes('budget') || lowerContent.includes('cost limit')) {
    return 'error_max_budget_usd'
  }
  if (lowerContent.includes('api') && lowerContent.includes('error')) {
    return 'api_error'
  }

  return null
}

export function formatError(subtype: ErrorSubtype | null, message?: string): string[] {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()
  const errorInfo = subtype ? getErrorInfo(subtype) : null

  const lines: string[] = []

  if (errorInfo) {
    lines.push(`${errorInfo.icon} ${colors.error('Error')}`)
    if (message) {
      lines.push(colors.muted(`${icons.line}  ${message}`))
    }
    lines.push(
      colors.muted(`${icons.corner}  ${colors.warning('Suggestion:')} ${errorInfo.suggestion}`)
    )
  } else {
    lines.push(`${icons.error} ${colors.error('Error')}`)
    if (message) {
      lines.push(colors.muted(`${icons.corner}  ${message}`))
    }
  }

  return lines
}

export function printError(subtype: ErrorSubtype | null, message?: string, useBox = false): void {
  const lines = formatError(subtype, message)

  if (useBox) {
    const colors = themeManager.getColors()
    const boxLines = renderBox(lines.join('\n'), {
      style: 'rounded',
      borderColor: colors.error,
      padding: 1,
    })
    for (const line of boxLines) {
      console.log(line)
    }
  } else {
    console.log()
    for (const line of lines) {
      console.log(line)
    }
    console.log()
  }
}

export function formatErrorResult(subtype?: string, durationMs?: number, turns?: number): string[] {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const errorSubtype = subtype as ErrorSubtype | undefined
  const errorInfo = errorSubtype ? getErrorInfo(errorSubtype) : null

  const lines: string[] = []
  lines.push(`${colors.error(icons.error)} ${colors.error('Failed')}`)

  if (errorInfo) {
    lines.push(
      `${colors.muted(icons.line)}  ${errorInfo.icon} ${errorInfo.subtype.replace(/_/g, ' ')}`
    )
    lines.push(
      `${colors.muted(icons.line)}  ${colors.warning('Suggestion:')} ${errorInfo.suggestion}`
    )
  }

  const stats: string[] = []
  if (durationMs) {
    stats.push(`${icons.clock} ${(durationMs / 1000).toFixed(1)}s`)
  }
  if (turns) {
    stats.push(`${icons.turns} ${turns} turns`)
  }

  if (stats.length > 0) {
    lines.push(`${colors.muted(icons.corner)}  ${colors.muted(stats.join(' │ '))}`)
  }

  return lines
}
