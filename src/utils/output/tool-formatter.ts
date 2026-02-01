import type { ToolFormatResult, ToolInput, ToolResultFormat } from '../../types/tool-formatter'
import { themeManager } from './theme-manager'

function shortenPath(filePath: string, maxLen = 50): string {
  if (filePath.length <= maxLen) return filePath
  const parts = filePath.split('/')
  if (parts.length <= 3) return filePath
  return '.../' + parts.slice(-2).join('/')
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function formatToolStart(toolName: string, input?: ToolInput): ToolFormatResult {
  const colors = themeManager.getColors()
  const icon = themeManager.getToolIcon(toolName)

  switch (toolName) {
    case 'Read': {
      const path = input?.file_path ? shortenPath(String(input.file_path)) : ''
      return { icon, label: 'Read', detail: path, color: colors.highlight }
    }

    case 'Write': {
      const path = input?.file_path ? shortenPath(String(input.file_path)) : ''
      return { icon, label: 'Write', detail: path, color: colors.success }
    }

    case 'Edit': {
      const path = input?.file_path ? shortenPath(String(input.file_path)) : ''
      return { icon, label: 'Edit', detail: path, color: colors.warning }
    }

    case 'Bash': {
      const cmd = input?.command ? truncate(String(input.command), 50) : ''
      return { icon, label: 'Bash', detail: cmd, color: colors.accent }
    }

    case 'Grep': {
      const pattern = input?.pattern ? `"${truncate(String(input.pattern), 30)}"` : ''
      return { icon, label: 'Grep', detail: pattern, color: colors.info }
    }

    case 'Glob': {
      const pattern = input?.pattern ? String(input.pattern) : ''
      return { icon, label: 'Glob', detail: pattern, color: colors.highlight }
    }

    case 'Task': {
      const agentType = input?.subagent_type ? `[${input.subagent_type}]` : ''
      const desc = input?.description ? truncate(String(input.description), 40) : ''
      return { icon, label: 'Task', detail: `${agentType} ${desc}`.trim(), color: colors.info }
    }

    case 'WebFetch': {
      let domain = ''
      if (input?.url) {
        try {
          domain = new URL(String(input.url)).hostname
        } catch {
          domain = truncate(String(input.url), 30)
        }
      }
      return { icon, label: 'WebFetch', detail: domain, color: colors.info }
    }

    case 'WebSearch': {
      const query = input?.query ? `"${truncate(String(input.query), 40)}"` : ''
      return { icon, label: 'WebSearch', detail: query, color: colors.info }
    }

    case 'AskUserQuestion': {
      return { icon, label: 'AskUserQuestion', detail: '', color: colors.warning }
    }

    default: {
      return { icon, label: toolName, detail: '', color: colors.muted }
    }
  }
}

export function parseToolResult(toolName: string, content?: string): ToolResultFormat {
  if (!content) {
    return { isError: false }
  }

  const isError = /error|fail|exception/i.test(content)
  const result: ToolResultFormat = { isError }

  if (toolName === 'Read') {
    const lines = content.split('\n').filter((l) => l.trim())
    result.lineCount = lines.length
  }

  if (toolName === 'Write') {
    result.byteCount = content.length
  }

  if (toolName === 'Edit') {
    const addMatch = content.match(/\+(\d+)/)
    const removeMatch = content.match(/-(\d+)/)
    if (addMatch || removeMatch) {
      result.linesChanged = {
        added: addMatch ? parseInt(addMatch[1], 10) : 0,
        removed: removeMatch ? parseInt(removeMatch[1], 10) : 0,
      }
    }
  }

  if (toolName === 'Bash') {
    const exitMatch = content.match(/exit(?:ed)?\s*(?:code)?[:\s]*(\d+)/i)
    if (exitMatch) {
      result.exitCode = parseInt(exitMatch[1], 10)
    }
    if (content.includes('Exit code: 0') || content.includes('exit code 0')) {
      result.exitCode = 0
    }
  }

  if (toolName === 'Grep') {
    const matchCountMatch = content.match(/(\d+)\s*(?:matches?|results?|files?)/i)
    if (matchCountMatch) {
      result.matchCount = parseInt(matchCountMatch[1], 10)
    } else {
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('Searching'))
      result.matchCount = lines.length
    }
  }

  if (toolName === 'Glob') {
    const files = content.split('\n').filter((l) => l.trim() && l.includes('/'))
    result.fileCount = files.length
  }

  return result
}

export function formatToolResultLine(_toolName: string, resultInfo: ToolResultFormat): string {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()
  const parts: string[] = []

  if (resultInfo.lineCount !== undefined) {
    parts.push(colors.muted(`${resultInfo.lineCount} lines`))
  }

  if (resultInfo.byteCount !== undefined) {
    const kb = (resultInfo.byteCount / 1024).toFixed(1)
    parts.push(colors.muted(`${kb}KB`))
  }

  if (resultInfo.linesChanged) {
    const { added, removed } = resultInfo.linesChanged
    if (added > 0) parts.push(colors.success(`+${added}`))
    if (removed > 0) parts.push(colors.error(`-${removed}`))
  }

  if (resultInfo.exitCode !== undefined) {
    const exitColor = resultInfo.exitCode === 0 ? colors.success : colors.error
    parts.push(exitColor(`exit: ${resultInfo.exitCode}`))
  }

  if (resultInfo.matchCount !== undefined) {
    parts.push(colors.muted(`${resultInfo.matchCount} matches`))
  }

  if (resultInfo.fileCount !== undefined) {
    parts.push(colors.muted(`${resultInfo.fileCount} files`))
  }

  if (resultInfo.duration !== undefined) {
    parts.push(colors.muted(`${resultInfo.duration}ms`))
  }

  const statusIcon = resultInfo.isError ? colors.error(icons.error) : colors.success(icons.success)

  return parts.length > 0 ? `${statusIcon} ${parts.join(colors.muted(' │ '))}` : statusIcon
}

export function formatToolHeader(toolName: string, input?: ToolInput, width?: number): string {
  const colors = themeManager.getColors()
  const formatted = formatToolStart(toolName, input)
  const termWidth = width || Math.min(themeManager.getTerminalWidth() - 2, 70)

  const headerText = formatted.detail
    ? `${formatted.icon} ${formatted.label}`
    : `${formatted.icon} ${formatted.label}`

  const remainingWidth = termWidth - headerText.length - (formatted.detail?.length || 0) - 4
  const line = colors.muted('─'.repeat(Math.max(0, remainingWidth)))

  if (formatted.detail) {
    return `${formatted.icon} ${formatted.color(formatted.label)} ${line}`
  }
  return `${formatted.icon} ${formatted.color(formatted.label)} ${line}`
}

export function formatToolDetail(input?: ToolInput, toolName?: string): string | null {
  if (!input) return null
  const colors = themeManager.getColors()

  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
    if (input.file_path) {
      return colors.primary(shortenPath(String(input.file_path)))
    }
  }

  if (toolName === 'Bash' && input.command) {
    return colors.muted(truncate(String(input.command), 60))
  }

  if (toolName === 'Grep' && input.pattern) {
    return colors.highlight(`"${String(input.pattern)}"`)
  }

  if (toolName === 'Glob' && input.pattern) {
    return colors.highlight(String(input.pattern))
  }

  return null
}
