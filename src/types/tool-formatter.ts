export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch'
  | 'AskUserQuestion'
  | 'NotebookEdit'
  | 'NotebookRead'
  | 'TodoWrite'
  | 'TodoRead'

export interface ToolInput {
  file_path?: string
  command?: string
  pattern?: string
  content?: string
  query?: string
  url?: string
  prompt?: string
  description?: string
  subagent_type?: string
  notebook_path?: string
  todos?: unknown[]
  [key: string]: unknown
}

export interface ToolFormatResult {
  icon: string
  label: string
  detail?: string
  color: (text: string) => string
}

export interface ToolResultFormat {
  lineCount?: number
  byteCount?: number
  linesChanged?: { added: number; removed: number }
  exitCode?: number
  matchCount?: number
  fileCount?: number
  statusCode?: number
  duration?: number
  isError: boolean
}

export type ToolFormatter = (
  toolName: string,
  input?: ToolInput,
  content?: string,
  isError?: boolean
) => ToolFormatResult
