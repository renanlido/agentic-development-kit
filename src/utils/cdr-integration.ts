import type { CDRConfig, HealthProbe, RetryResult } from '../types/cdr'
import { DEFAULT_CDR_CONFIG } from '../types/cdr'
import type { PhaseType } from '../types/model'
import { loadFallbackTemplate, validateFallbackTemplate } from './fallback-templates'
import {
  checkTokenPressure,
  startHealthProbe,
  stopHealthProbe,
  updateHealthMetrics,
} from './health-probes'
import { logger } from './logger'
import { createCheckpoint, restoreCheckpoint, retryWithBackoff } from './recovery'

export interface CDRPhaseOptions {
  feature: string
  phase: PhaseType
  config?: Partial<CDRConfig>
  onProgress?: (metrics: { durationMs: number; tokenEstimate: number }) => void
  onHealthWarning?: (probe: HealthProbe) => void
}

export interface CDRPhaseResult<T> {
  success: boolean
  result?: T
  usedFallback: boolean
  attempts: number
  checkpointId?: string
  error?: Error
}

export async function executeWithCDR<T>(
  fn: () => Promise<T>,
  options: CDRPhaseOptions
): Promise<CDRPhaseResult<T>> {
  const config: CDRConfig = {
    ...DEFAULT_CDR_CONFIG,
    ...options.config,
  }

  const startTime = Date.now()
  let probe: HealthProbe | undefined

  try {
    probe = startHealthProbe(options.phase, (p) => {
      if (p.status === 'warning' || p.status === 'critical') {
        logger.warn(`[CDR] Health ${p.status}: ${options.phase}`)
        options.onHealthWarning?.(p)
      }
    })

    createCheckpoint(options.feature, options.phase, {
      progress: 0,
      lastCompletedStep: 'start',
      artifacts: [],
    })

    const monitorInterval = setInterval(() => {
      const durationMs = Date.now() - startTime
      const tokenEstimate = estimateTokenUsage(durationMs)

      if (probe?.id) {
        updateHealthMetrics(probe.id, { durationMs, tokenEstimate })
        if (checkTokenPressure(probe.id)) {
          logger.warn('[CDR] Token pressure high, consider breaking task')
        }
      }
      options.onProgress?.({ durationMs, tokenEstimate })
    }, 10000)

    const retryResult: RetryResult<T> = await retryWithBackoff(fn, config.retry)

    clearInterval(monitorInterval)

    if (retryResult.success) {
      const checkpoint = createCheckpoint(options.feature, options.phase, {
        progress: 100,
        lastCompletedStep: 'completed',
        artifacts: [],
      })

      return {
        success: true,
        result: retryResult.result,
        usedFallback: false,
        attempts: retryResult.attempts,
        checkpointId: checkpoint.id,
      }
    }

    if (config.fallbackEnabled) {
      logger.warn(`[CDR] Using fallback for ${options.phase}`)
      const fallback = loadFallbackTemplate(options.phase)

      if (fallback && validateFallbackTemplate(fallback)) {
        return {
          success: true,
          result: fallback.content as unknown as T,
          usedFallback: true,
          attempts: retryResult.attempts,
          error: retryResult.error,
        }
      }
    }

    return {
      success: false,
      usedFallback: false,
      attempts: retryResult.attempts,
      error: retryResult.error,
    }
  } finally {
    if (probe) {
      stopHealthProbe(probe.id)
    }
  }
}

export async function recoverPhase<T>(
  feature: string,
  phase: PhaseType,
  resumeFn: (checkpoint: { progress: number; lastCompletedStep?: string }) => Promise<T>
): Promise<T | undefined> {
  const checkpoint = restoreCheckpoint(feature, phase)

  if (!checkpoint) {
    logger.info(`[CDR] No checkpoint found for ${phase}`)
    return undefined
  }

  logger.info(`[CDR] Restoring from checkpoint: ${checkpoint.id}`)
  logger.info(`[CDR] Progress: ${checkpoint.state.progress}%`)

  return resumeFn(checkpoint.state)
}

function estimateTokenUsage(durationMs: number): number {
  const tokensPerSecond = 50
  return Math.floor((durationMs / 1000) * tokensPerSecond)
}

export function createCDRWrapper(defaultConfig?: Partial<CDRConfig>) {
  return async function withCDR<T>(
    fn: () => Promise<T>,
    options: Omit<CDRPhaseOptions, 'config'>
  ): Promise<CDRPhaseResult<T>> {
    return executeWithCDR(fn, {
      ...options,
      config: defaultConfig,
    })
  }
}

export async function validatePhaseHealth(
  feature: string,
  phase: PhaseType
): Promise<{ healthy: boolean; issues: string[] }> {
  const issues: string[] = []

  const checkpoint = restoreCheckpoint(feature, phase)
  if (checkpoint && checkpoint.state.progress < 100) {
    issues.push(`Incomplete checkpoint found (${checkpoint.state.progress}%)`)
  }

  return {
    healthy: issues.length === 0,
    issues,
  }
}
