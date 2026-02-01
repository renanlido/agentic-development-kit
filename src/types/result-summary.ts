export interface SessionInfo {
  sessionId?: string
  model?: string
  toolCount?: number
  version?: string
}

export interface ResultSummary {
  success: boolean
  subtype?: string
  durationMs?: number
  turns?: number
  toolCount?: number
  costUsd?: number
  inputTokens?: number
  outputTokens?: number
  errorMessage?: string
}

export interface ResultDisplayOptions {
  showTokens?: boolean
  showCost?: boolean
  showTools?: boolean
  showTurns?: boolean
  showDuration?: boolean
  compact?: boolean
}
