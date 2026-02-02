import type { BoxOptions, BoxStyle } from '../../types/output-theme'
import { themeManager } from './theme-manager'

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

function getVisibleLength(str: string): number {
  return stripAnsi(str).length
}

function padEnd(str: string, length: number): string {
  const visibleLen = getVisibleLength(str)
  if (visibleLen >= length) return str
  return str + ' '.repeat(length - visibleLen)
}

export function renderBox(content: string | string[], options: BoxOptions = {}): string[] {
  const {
    title,
    titleAlign = 'left',
    padding = 1,
    width,
    style = 'rounded',
    borderColor,
    titleColor,
  } = options

  const colors = themeManager.getColors()
  const chars = themeManager.getBoxChars(style)
  const termWidth = themeManager.getTerminalWidth()
  const colorFn = borderColor || colors.muted
  const titleColorFn = titleColor || colors.highlight

  const lines = Array.isArray(content) ? content : content.split('\n')
  const contentWidth = lines.reduce((max, line) => Math.max(max, getVisibleLength(line)), 0)
  const boxWidth = width || Math.min(Math.max(contentWidth + padding * 2 + 2, 40), termWidth - 2)
  const innerWidth = boxWidth - 2

  const result: string[] = []

  let topLine = chars.topLeft + chars.horizontal.repeat(innerWidth) + chars.topRight
  if (title) {
    const formattedTitle = ` ${titleColorFn(title)} `
    const titleLen = getVisibleLength(formattedTitle)
    const availableWidth = innerWidth - 2

    if (titleLen <= availableWidth) {
      let titlePart: string
      if (titleAlign === 'center') {
        const leftPad = Math.floor((availableWidth - titleLen) / 2)
        titlePart =
          chars.horizontal.repeat(leftPad) +
          formattedTitle +
          chars.horizontal.repeat(availableWidth - leftPad - titleLen)
      } else if (titleAlign === 'right') {
        titlePart = chars.horizontal.repeat(availableWidth - titleLen) + formattedTitle
      } else {
        titlePart = formattedTitle + chars.horizontal.repeat(availableWidth - titleLen)
      }
      topLine = chars.topLeft + chars.horizontal + titlePart + chars.horizontal + chars.topRight
    }
  }
  result.push(colorFn(topLine))

  for (let i = 0; i < padding; i++) {
    result.push(colorFn(chars.vertical) + ' '.repeat(innerWidth) + colorFn(chars.vertical))
  }

  for (const line of lines) {
    const paddedLine = ' '.repeat(padding) + line
    const finalLine = padEnd(paddedLine, innerWidth)
    result.push(colorFn(chars.vertical) + finalLine + colorFn(chars.vertical))
  }

  for (let i = 0; i < padding; i++) {
    result.push(colorFn(chars.vertical) + ' '.repeat(innerWidth) + colorFn(chars.vertical))
  }

  const bottomLine = chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight
  result.push(colorFn(bottomLine))

  return result
}

export function renderDivider(style: BoxStyle = 'rounded', char?: string, width?: number): string {
  const chars = themeManager.getBoxChars(style)
  const colors = themeManager.getColors()
  const termWidth = width || themeManager.getTerminalWidth()
  const divChar = char || chars.horizontal
  return colors.muted(divChar.repeat(Math.min(termWidth - 2, 70)))
}

export function renderHorizontalLine(width?: number): string {
  const colors = themeManager.getColors()
  const w = width || Math.min(themeManager.getTerminalWidth() - 2, 70)
  return colors.muted('─'.repeat(w))
}

export function renderTitleLine(
  title: string,
  style: BoxStyle = 'rounded',
  width?: number
): string {
  const chars = themeManager.getBoxChars(style)
  const colors = themeManager.getColors()
  const termWidth = width || Math.min(themeManager.getTerminalWidth() - 2, 70)
  const titleWithSpace = ` ${title} `
  const titleLen = getVisibleLength(titleWithSpace)
  const remainingWidth = termWidth - titleLen
  return (
    colors.highlight(title) +
    ' ' +
    colors.muted(chars.horizontal.repeat(Math.max(0, remainingWidth)))
  )
}

export function renderStatusLine(
  icon: string,
  label: string,
  value: string,
  colorFn?: (text: string) => string
): string {
  const colors = themeManager.getColors()
  const valueFn = colorFn || colors.primary
  return `${icon} ${colors.muted(label)} ${valueFn(value)}`
}

export function renderKeyValue(
  key: string,
  value: string,
  separator = ':',
  keyWidth?: number
): string {
  const colors = themeManager.getColors()
  const formattedKey = keyWidth ? padEnd(key, keyWidth) : key
  return `${colors.muted(formattedKey + separator)} ${colors.primary(value)}`
}

export function renderTreeItem(label: string, isLast: boolean, depth = 0, icon?: string): string {
  const colors = themeManager.getColors()
  const icons = themeManager.getIcons()
  const prefix = isLast ? icons.corner : icons.branch
  const indent = '  '.repeat(depth)
  const iconPart = icon ? `${icon} ` : ''
  return `${indent}${colors.muted(prefix)} ${iconPart}${label}`
}

export function renderProgressBar(
  current: number,
  total: number,
  width = 20,
  showPercent = true
): string {
  const colors = themeManager.getColors()
  const percent = Math.min(100, Math.round((current / total) * 100))
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  const bar = colors.success('█'.repeat(filled)) + colors.muted('░'.repeat(empty))
  return showPercent ? `${bar} ${colors.muted(percent + '%')}` : bar
}

export function printBox(content: string | string[], options: BoxOptions = {}): void {
  const lines = renderBox(content, options)
  for (const line of lines) {
    console.log(line)
  }
}

export function printDivider(style?: BoxStyle, char?: string, width?: number): void {
  console.log(renderDivider(style, char, width))
}

export function printTitleLine(title: string, style?: BoxStyle, width?: number): void {
  console.log(renderTitleLine(title, style, width))
}
