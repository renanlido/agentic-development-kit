export interface ThemeColors {
  success: (text: string) => string
  error: (text: string) => string
  warning: (text: string) => string
  info: (text: string) => string
  muted: (text: string) => string
  highlight: (text: string) => string
  accent: (text: string) => string
  primary: (text: string) => string
}

export interface ThemeIcons {
  success: string
  error: string
  warning: string
  info: string
  pending: string
  running: string
  completed: string
  session: string
  clock: string
  cost: string
  model: string
  tokens: string
  tools: string
  turns: string
  arrow: string
  bullet: string
  branch: string
  corner: string
  line: string
}

export interface ToolIcons {
  Read: string
  Write: string
  Edit: string
  Bash: string
  Grep: string
  Glob: string
  Task: string
  WebFetch: string
  WebSearch: string
  AskUserQuestion: string
  default: string
}

export interface BoxChars {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
  horizontal: string
  vertical: string
  leftT: string
  rightT: string
  topT: string
  bottomT: string
  cross: string
}

export type BoxStyle = 'single' | 'rounded' | 'double'

export interface BoxStyles {
  single: BoxChars
  rounded: BoxChars
  double: BoxChars
}

export interface OutputTheme {
  colors: ThemeColors
  icons: ThemeIcons
  toolIcons: ToolIcons
  boxStyles: BoxStyles
  defaultBoxStyle: BoxStyle
  spinnerStyle: string
  noColorIcons: ThemeIcons
  noColorToolIcons: ToolIcons
}

export interface BoxOptions {
  title?: string
  titleAlign?: 'left' | 'center' | 'right'
  padding?: number
  width?: number
  style?: BoxStyle
  borderColor?: (text: string) => string
  titleColor?: (text: string) => string
}

export interface StatusType {
  icon: string
  color: (text: string) => string
  label: string
}

export interface MetricItem {
  icon: string
  label: string
  value: string
  color?: (text: string) => string
}

export interface TreeItem {
  label: string
  children?: TreeItem[]
  icon?: string
  color?: (text: string) => string
}
