import type { PhaseType } from './model'

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

export interface HealthMetrics {
  durationMs: number
  tokenEstimate: number
  errorCount: number
  lastChecked: string
}

export interface HealthProbe {
  id: string
  phase: PhaseType
  status: HealthStatus
  metrics: HealthMetrics
  startedAt: string
  stoppedAt?: string
}

export interface HealthProbeConfig {
  intervalMs: number
  tokenWarningThreshold: number
  maxDurationMs: number
}

export interface RecoveryCheckpoint {
  id: string
  feature: string
  phase: PhaseType
  state: CheckpointState
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface CheckpointState {
  progress: number
  lastCompletedStep?: string
  artifacts: CheckpointArtifact[]
  context?: string
}

export interface CheckpointArtifact {
  type: 'file' | 'memory' | 'state'
  path: string
  hash: string
}

export interface RetryConfig {
  maxRetries: number
  baseBackoffMs: number
  maxBackoffMs: number
  retryableErrors?: string[]
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
  totalDurationMs: number
}

export interface FallbackTemplate {
  phase: PhaseType
  content: string
  isReadOnly: boolean
  lastValidated?: string
}

export interface CDRConfig {
  healthProbe: HealthProbeConfig
  retry: RetryConfig
  maxCheckpoints: number
  fallbackEnabled: boolean
}

export const DEFAULT_HEALTH_PROBE_CONFIG: HealthProbeConfig = {
  intervalMs: 30000,
  tokenWarningThreshold: 0.8,
  maxDurationMs: 300000,
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 8000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'rate_limit',
    'overloaded',
  ],
}

export const DEFAULT_CDR_CONFIG: CDRConfig = {
  healthProbe: DEFAULT_HEALTH_PROBE_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  maxCheckpoints: 5,
  fallbackEnabled: true,
}
