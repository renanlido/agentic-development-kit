import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { CheckpointState, RecoveryCheckpoint, RetryConfig, RetryResult } from '../types/cdr'
import { DEFAULT_RETRY_CONFIG } from '../types/cdr'
import type { PhaseType } from '../types/model'

const MAX_CHECKPOINTS = 5

export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const effectiveAttempt = Math.max(0, attempt - 1)
  const backoff = config.baseBackoffMs * 2 ** effectiveAttempt
  return Math.min(backoff, config.maxBackoffMs)
}

export function isRetryableError(error: Error | null, retryableErrors?: string[]): boolean {
  if (!error) {
    return false
  }

  const patterns = retryableErrors ?? DEFAULT_RETRY_CONFIG.retryableErrors ?? []
  const errorMessage = error.message || ''

  return patterns.some((pattern) => errorMessage.toLowerCase().includes(pattern.toLowerCase()))
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const effectiveConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }

  const startTime = Date.now()
  let lastError: Error | undefined
  let attempts = 0

  while (attempts < effectiveConfig.maxRetries) {
    attempts++

    try {
      const result = await fn()
      return {
        success: true,
        result,
        attempts,
        totalDurationMs: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryableError(lastError, effectiveConfig.retryableErrors)) {
        return {
          success: false,
          error: lastError,
          attempts,
          totalDurationMs: Date.now() - startTime,
        }
      }

      if (attempts < effectiveConfig.maxRetries) {
        const backoff = calculateBackoff(attempts, effectiveConfig)
        await new Promise((resolve) => setTimeout(resolve, backoff))
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
    totalDurationMs: Date.now() - startTime,
  }
}

function getCheckpointsDir(feature: string): string {
  return path.join(process.cwd(), '.claude', 'plans', 'features', feature, 'checkpoints')
}

export function createCheckpoint(
  feature: string,
  phase: PhaseType,
  state: CheckpointState,
  metadata?: Record<string, unknown>
): RecoveryCheckpoint {
  const checkpointsDir = getCheckpointsDir(feature)

  if (!fs.existsSync(checkpointsDir)) {
    fs.mkdirSync(checkpointsDir, { recursive: true })
  }

  enforceCheckpointLimit(checkpointsDir)

  const checkpoint: RecoveryCheckpoint = {
    id: randomUUID(),
    feature,
    phase,
    state,
    createdAt: new Date().toISOString(),
    metadata,
  }

  const checkpointPath = path.join(checkpointsDir, `${checkpoint.id}.json`)
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))

  return checkpoint
}

function enforceCheckpointLimit(checkpointsDir: string): void {
  if (!fs.existsSync(checkpointsDir)) {
    return
  }

  const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'))

  if (files.length >= MAX_CHECKPOINTS) {
    const filesWithStats = files
      .map((file) => {
        const filePath = path.join(checkpointsDir, file)
        const stats = fs.statSync(filePath)
        return { file, mtime: stats.mtime.getTime() }
      })
      .sort((a, b) => a.mtime - b.mtime)

    const toDelete = filesWithStats.slice(0, files.length - MAX_CHECKPOINTS + 1)
    for (const { file } of toDelete) {
      fs.unlinkSync(path.join(checkpointsDir, file))
    }
  }
}

export function restoreCheckpoint(
  feature: string,
  phase: PhaseType
): RecoveryCheckpoint | undefined {
  const checkpointsDir = getCheckpointsDir(feature)

  if (!fs.existsSync(checkpointsDir)) {
    return undefined
  }

  const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'))

  if (files.length === 0) {
    return undefined
  }

  const checkpointsForPhase: Array<{ checkpoint: RecoveryCheckpoint; mtime: number }> = []

  for (const file of files) {
    const filePath = path.join(checkpointsDir, file)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const checkpoint = JSON.parse(content) as RecoveryCheckpoint
      if (checkpoint.phase === phase) {
        const stats = fs.statSync(filePath)
        checkpointsForPhase.push({ checkpoint, mtime: stats.mtime.getTime() })
      }
    } catch {}
  }

  if (checkpointsForPhase.length === 0) {
    return undefined
  }

  checkpointsForPhase.sort((a, b) => b.mtime - a.mtime)
  return checkpointsForPhase[0].checkpoint
}

export function getCheckpoints(feature: string): RecoveryCheckpoint[] {
  const checkpointsDir = getCheckpointsDir(feature)

  if (!fs.existsSync(checkpointsDir)) {
    return []
  }

  const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'))
  const checkpoints: RecoveryCheckpoint[] = []

  for (const file of files) {
    const filePath = path.join(checkpointsDir, file)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      checkpoints.push(JSON.parse(content) as RecoveryCheckpoint)
    } catch {}
  }

  return checkpoints
}

export function getLatestCheckpoint(feature: string): RecoveryCheckpoint | undefined {
  const checkpointsDir = getCheckpointsDir(feature)

  if (!fs.existsSync(checkpointsDir)) {
    return undefined
  }

  const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'))

  if (files.length === 0) {
    return undefined
  }

  const filesWithStats = files.map((file) => {
    const filePath = path.join(checkpointsDir, file)
    const stats = fs.statSync(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    return {
      checkpoint: JSON.parse(content) as RecoveryCheckpoint,
      mtime: stats.mtime.getTime(),
    }
  })

  filesWithStats.sort((a, b) => b.mtime - a.mtime)
  return filesWithStats[0].checkpoint
}

export function clearCheckpoints(feature?: string): void {
  if (!feature) {
    return
  }

  const checkpointsDir = getCheckpointsDir(feature)

  if (!fs.existsSync(checkpointsDir)) {
    return
  }

  const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    fs.unlinkSync(path.join(checkpointsDir, file))
  }
}
