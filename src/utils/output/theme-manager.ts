import chalk from 'chalk'
import type {
  BoxChars,
  BoxStyle,
  OutputTheme,
  ThemeColors,
  ThemeIcons,
  ToolIcons,
} from '../../types/output-theme'
import { defaultTheme } from './default-theme'

class ThemeManager {
  private theme: OutputTheme = defaultTheme
  private _noColor = false

  constructor() {
    this._noColor = Boolean(process.env.NO_COLOR) || !chalk.level
  }

  get noColor(): boolean {
    return this._noColor
  }

  setNoColor(value: boolean): void {
    this._noColor = value
  }

  setTheme(theme: Partial<OutputTheme>): void {
    this.theme = { ...this.theme, ...theme }
  }

  getColors(): ThemeColors {
    if (this._noColor) {
      return {
        success: (t: string) => t,
        error: (t: string) => t,
        warning: (t: string) => t,
        info: (t: string) => t,
        muted: (t: string) => t,
        highlight: (t: string) => t,
        accent: (t: string) => t,
        primary: (t: string) => t,
      }
    }
    return this.theme.colors
  }

  getIcons(): ThemeIcons {
    return this._noColor ? this.theme.noColorIcons : this.theme.icons
  }

  getToolIcons(): ToolIcons {
    return this._noColor ? this.theme.noColorToolIcons : this.theme.toolIcons
  }

  getToolIcon(toolName: string): string {
    const icons = this.getToolIcons()
    return icons[toolName as keyof ToolIcons] || icons.default
  }

  getBoxChars(style?: BoxStyle): BoxChars {
    const boxStyle = style || this.theme.defaultBoxStyle
    return this.theme.boxStyles[boxStyle]
  }

  getSpinnerStyle(): string {
    return this.theme.spinnerStyle
  }

  getTerminalWidth(): number {
    return process.stdout.columns || 80
  }

  formatBold(text: string): string {
    return this._noColor ? text : chalk.bold(text)
  }

  formatDim(text: string): string {
    return this._noColor ? text : chalk.dim(text)
  }

  formatUnderline(text: string): string {
    return this._noColor ? text : chalk.underline(text)
  }

  formatInverse(text: string): string {
    return this._noColor ? `[${text}]` : chalk.inverse(text)
  }

  formatBgSuccess(text: string): string {
    return this._noColor ? `[${text}]` : chalk.bgGreen.black(text)
  }

  formatBgError(text: string): string {
    return this._noColor ? `[${text}]` : chalk.bgRed.white(text)
  }

  formatBgInfo(text: string): string {
    return this._noColor ? `[${text}]` : chalk.bgBlue.white(text)
  }

  formatBgWarning(text: string): string {
    return this._noColor ? `[${text}]` : chalk.bgYellow.black(text)
  }

  formatBgHighlight(text: string): string {
    return this._noColor ? `[${text}]` : chalk.bgCyan.black(text)
  }
}

export const themeManager = new ThemeManager()
