export interface AgentExecutionMetrics {
  taskId: string
  taskTitle: string
  toolCount: number
  tokenCount: number
  durationMs: number
  costUsd?: number
  status: 'success' | 'error'
}

export interface WaveCompletionSummary {
  waveNumber: number
  agents: AgentExecutionMetrics[]
  totalDurationMs: number
  parallelized: boolean
}

export interface CollectedMetrics {
  toolCount: number
  tokenCount: number
  durationMs: number
  costUsd?: number
}
