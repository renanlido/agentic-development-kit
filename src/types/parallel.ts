import type { ModelType } from './model'
import type { StreamEvent } from './stream-events'

export type StreamEventCallback = (event: StreamEvent) => void

export type ComplexityLevel = 'high' | 'medium' | 'low'

export interface TaskComplexity {
  level: ComplexityLevel
  score: number
  indicators: string[]
  recommendedModel: ModelType
}

export interface AgentExecutionMetrics {
  taskId: string
  taskTitle: string
  toolCount: number
  tokenCount: number
  durationMs: number
  costUsd?: number
  status: 'success' | 'error'
  model?: ModelType
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

export interface EnhancedTask {
  id: string
  title: string
  description?: string
  type: 'Feature' | 'Refactor' | 'Bugfix' | 'Config' | 'Docs' | 'Test'
  status: 'pending' | 'in_progress' | 'completed'
  dependencies: string[]
  files: string[]
  estimate: 'P' | 'M' | 'G'
  complexity: TaskComplexity
  model: ModelType
  modelOverride?: ModelType
  agentType: string
  worktree?: string
  retryCount?: number
}

export interface WaveExecutionResult {
  waveIndex: number
  tasks: TaskExecutionResult[]
  duration: number
  conflicts: ConflictInfo[]
  success: boolean
}

export interface TaskExecutionResult {
  taskId: string
  taskTitle: string
  success: boolean
  agentId?: string
  agentType: string
  model: ModelType
  duration: number
  tokensUsed: number
  cost: number
  output?: string
  error?: string
  filesModified: string[]
}

export interface ConflictInfo {
  type: 'file_overlap' | 'dependency' | 'merge_conflict'
  tasks: string[]
  files: string[]
  resolution?: 'auto' | 'manual' | 'retry'
  resolved?: boolean
}

export interface WaveExecutionOptions {
  useWorktrees: boolean
  timeout: number
  retryOnFailure: boolean
  maxRetries?: number
  stopOnError?: boolean
  verbose?: boolean
  maxConcurrentAgents?: number
}

export interface OrchestratorOptions {
  maxParallel: number
  isolate: boolean
  timeout: number
  retryFailed: boolean
  modelOptimize: boolean
  stopOnError: boolean
  verbose?: boolean
  maxConcurrentAgents?: number
}

export interface OrchestratorResult {
  success: boolean
  waves: WaveExecutionResult[]
  totalDuration: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  totalCost: number
  totalTokens: number
  modelUsage: Record<ModelType, number>
}

export const COMPLEXITY_KEYWORDS = {
  high: [
    'refactor',
    'redesign',
    'architecture',
    'security',
    'performance',
    'optimization',
    'complex',
    'critical',
    'database schema',
    'api design',
    'authentication',
    'authorization',
    'migration',
  ],
  medium: [
    'implement',
    'create',
    'add',
    'update',
    'fix',
    'integrate',
    'configure',
    'setup',
    'modify',
    'build',
    'develop',
  ],
  low: [
    'validate',
    'verify',
    'check',
    'review',
    'lint',
    'format',
    'rename',
    'move',
    'copy',
    'simple',
    'minor',
  ],
} as const
