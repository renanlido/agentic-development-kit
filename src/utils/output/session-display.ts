import type { SessionInfo } from '../../types/result-summary'
import { renderBox } from './box-renderer'
import { themeManager } from './theme-manager'

function truncateSessionId(sessionId: string, maxLen = 12): string {
  if (sessionId.length <= maxLen) return sessionId
  return sessionId.slice(0, maxLen) + '...'
}

function formatModelName(model?: string): string {
  if (!model) return 'unknown'
  if (model.includes('opus')) return 'opus'
  if (model.includes('sonnet')) return 'sonnet'
  if (model.includes('haiku')) return 'haiku'
  return model.split('-')[0] || model
}

export function formatSessionHeader(
  phase: string,
  feature?: string,
  sessionInfo?: SessionInfo
): string[] {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const lines: string[] = []

  const phaseText = phase.toUpperCase()
  const headerLine = `  ${themeManager.formatBgHighlight(' 🚀 ADK ')}${' '.repeat(35)}${colors.muted(phaseText)}`
  lines.push(headerLine)

  if (feature) {
    lines.push(`  ${colors.muted('Feature:')} ${colors.primary(feature)}`)
  }

  if (sessionInfo) {
    const infoParts: string[] = []

    if (sessionInfo.model) {
      const modelName = formatModelName(sessionInfo.model)
      infoParts.push(`${icons.model} Model: ${modelName}`)
    }

    if (sessionInfo.toolCount !== undefined) {
      infoParts.push(`${icons.tools} Tools: ${sessionInfo.toolCount}`)
    }

    if (sessionInfo.sessionId) {
      infoParts.push(`${icons.session} Session: ${truncateSessionId(sessionInfo.sessionId)}`)
    }

    if (infoParts.length > 0) {
      lines.push(`  ${colors.muted(infoParts.join('  │  '))}`)
    }
  }

  return lines
}

export function printSessionHeader(
  phase: string,
  feature?: string,
  sessionInfo?: SessionInfo,
  useBox = true
): void {
  const colors = themeManager.getColors()

  console.log()

  if (useBox) {
    const lines = formatSessionHeader(phase, feature, sessionInfo)
    const boxLines = renderBox(lines, {
      style: 'rounded',
      borderColor: colors.muted,
      padding: 0,
    })
    for (const line of boxLines) {
      console.log(line)
    }
  } else {
    const lines = formatSessionHeader(phase, feature, sessionInfo)
    for (const line of lines) {
      console.log(line)
    }
  }

  console.log()
}

export function printSessionInit(sessionInfo: SessionInfo): void {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()

  const parts: string[] = []

  if (sessionInfo.model) {
    const modelName = formatModelName(sessionInfo.model)
    parts.push(`${icons.model} ${modelName}`)
  }

  if (sessionInfo.toolCount !== undefined) {
    parts.push(`${icons.tools} ${sessionInfo.toolCount} tools`)
  }

  if (sessionInfo.sessionId) {
    parts.push(`${icons.session} ${truncateSessionId(sessionInfo.sessionId)}`)
  }

  if (sessionInfo.version) {
    parts.push(`v${sessionInfo.version}`)
  }

  if (parts.length > 0) {
    console.log(colors.muted(`${icons.session} Session started: ${parts.join(' │ ')}`))
    console.log()
  }
}

export function printThinkingIndicator(message?: string): void {
  const colors = themeManager.getColors()
  const text = message || 'Analyzing...'
  console.log(colors.muted(`💭 ${text}`))
}
