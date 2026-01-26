export interface SessionInfoV3 {
  id: string
  claudeSessionId: string | null
  feature: string
  startedAt: string
  lastActivity: string
  status: 'active' | 'completed' | 'interrupted'
  resumable: boolean
  metadata?: {
    model?: string
    exitCode?: number
    duration?: number
  }
}

export interface ClaudeV3Options {
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string
  printSessionId?: boolean
  timeout?: number
  onOutput?: (chunk: string) => void
}

export interface ClaudeV3Result {
  output: string
  sessionId: string | null
  exitCode: number
  duration: number
}
