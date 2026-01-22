import type { RetryConfig, RetryResult } from '../types/cdr.js'
import { DEFAULT_RETRY_CONFIG } from '../types/cdr.js'

export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const backoff = config.baseBackoffMs * 2 ** (attempt - 1)
  return Math.min(backoff, config.maxBackoffMs)
}

export function isRetryableError(error: Error, retryableErrors?: string[]): boolean {
  if (!retryableErrors) {
    return true
  }

  const errorMessage = error.message.toLowerCase()

  for (const pattern of retryableErrors) {
    if (errorMessage.includes(pattern.toLowerCase())) {
      return true
    }
  }

  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<RetryResult<T>> {
  const startTime = Date.now()
  let lastError: Error | undefined
  let attempts = 0

  while (attempts <= config.maxRetries) {
    attempts++

    try {
      const result = await fn()
      return {
        success: true,
        result,
        attempts,
        totalDurationMs: Date.now() - startTime,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempts > config.maxRetries) {
        break
      }

      if (!isRetryableError(lastError, config.retryableErrors)) {
        break
      }

      const backoff = calculateBackoff(attempts, config)
      await delay(backoff)
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
    totalDurationMs: Date.now() - startTime,
  }
}
