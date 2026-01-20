import {
  withRetry,
  calculateBackoff,
  isRetryableError,
} from '../../src/utils/retry'
import { DEFAULT_RETRY_CONFIG } from '../../src/types/cdr'
import type { RetryConfig } from '../../src/types/cdr'

describe('retry utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('withRetry', () => {
    describe('successful execution', () => {
      it('should return result on first success', async () => {
        const fn = jest.fn().mockResolvedValue('success')

        const resultPromise = withRetry(fn)
        jest.runAllTimers()
        const result = await resultPromise

        expect(result.success).toBe(true)
        expect(result.result).toBe('success')
        expect(result.attempts).toBe(1)
        expect(fn).toHaveBeenCalledTimes(1)
      })

      it('should track total duration', async () => {
        const fn = jest.fn().mockResolvedValue('success')

        const resultPromise = withRetry(fn)
        jest.runAllTimers()
        const result = await resultPromise

        expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
      })
    })

    describe('retry behavior', () => {
      it('should retry on failure', async () => {
        const fn = jest.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce('success')

        const resultPromise = withRetry(fn)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
        expect(fn).toHaveBeenCalledTimes(2)
      })

      it('should respect maxRetries', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
        const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }

        const resultPromise = withRetry(fn, config)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(false)
        expect(result.attempts).toBe(3)
        expect(fn).toHaveBeenCalledTimes(3)
      })

      it('should include error in result on failure', async () => {
        const error = new Error('ETIMEDOUT')
        const fn = jest.fn().mockRejectedValue(error)
        const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 0 }

        const resultPromise = withRetry(fn, config)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error?.message).toBe('ETIMEDOUT')
      })
    })

    describe('backoff behavior', () => {
      it('should wait between retries with exponential backoff', async () => {
        const fn = jest.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce('success')
        const config: RetryConfig = {
          ...DEFAULT_RETRY_CONFIG,
          baseBackoffMs: 100,
          maxBackoffMs: 10000,
        }

        const resultPromise = withRetry(fn, config)
        
        expect(fn).toHaveBeenCalledTimes(1)
        
        await jest.advanceTimersByTimeAsync(100)
        expect(fn).toHaveBeenCalledTimes(2)
        
        await jest.advanceTimersByTimeAsync(200)
        expect(fn).toHaveBeenCalledTimes(3)

        await jest.runAllTimersAsync()
        const result = await resultPromise
        
        expect(result.success).toBe(true)
        expect(result.attempts).toBe(3)
      })

      it('should cap backoff at maxBackoffMs', async () => {
        const config: RetryConfig = {
          ...DEFAULT_RETRY_CONFIG,
          baseBackoffMs: 1000,
          maxBackoffMs: 2000,
        }

        expect(calculateBackoff(1, config)).toBe(1000)
        expect(calculateBackoff(2, config)).toBe(2000)
        expect(calculateBackoff(3, config)).toBe(2000)
        expect(calculateBackoff(10, config)).toBe(2000)
      })
    })

    describe('retryable error filtering', () => {
      it('should not retry non-retryable errors', async () => {
        const error = new Error('Not retryable')
        const fn = jest.fn().mockRejectedValue(error)
        const config: RetryConfig = {
          ...DEFAULT_RETRY_CONFIG,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
        }

        const resultPromise = withRetry(fn, config)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(false)
        expect(result.attempts).toBe(1)
        expect(fn).toHaveBeenCalledTimes(1)
      })

      it('should retry errors in retryableErrors list', async () => {
        const fn = jest.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce('success')
        const config: RetryConfig = {
          ...DEFAULT_RETRY_CONFIG,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
        }

        const resultPromise = withRetry(fn, config)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
      })

      it('should retry all errors when retryableErrors is undefined', async () => {
        const fn = jest.fn()
          .mockRejectedValueOnce(new Error('random error'))
          .mockResolvedValueOnce('success')
        const config: RetryConfig = {
          ...DEFAULT_RETRY_CONFIG,
          retryableErrors: undefined,
        }

        const resultPromise = withRetry(fn, config)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
      })
    })

    describe('edge cases', () => {
      it('should handle zero maxRetries', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
        const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 0 }

        const resultPromise = withRetry(fn, config)
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.success).toBe(false)
        expect(result.attempts).toBe(1)
      })

      it('should pass arguments to function', async () => {
        const fn = jest.fn().mockImplementation((a: number, b: string) => 
          Promise.resolve(a.toString() + b)
        )

        const resultPromise = withRetry(() => fn(42, 'test'))
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(result.result).toBe('42test')
      })
    })
  })

  describe('calculateBackoff', () => {
    it('should return baseBackoffMs for first retry', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseBackoffMs: 1000,
        maxBackoffMs: 10000,
      }

      expect(calculateBackoff(1, config)).toBe(1000)
    })

    it('should double backoff for each attempt', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseBackoffMs: 1000,
        maxBackoffMs: 10000,
      }

      expect(calculateBackoff(1, config)).toBe(1000)
      expect(calculateBackoff(2, config)).toBe(2000)
      expect(calculateBackoff(3, config)).toBe(4000)
      expect(calculateBackoff(4, config)).toBe(8000)
    })

    it('should cap at maxBackoffMs', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseBackoffMs: 1000,
        maxBackoffMs: 5000,
      }

      expect(calculateBackoff(4, config)).toBe(5000)
      expect(calculateBackoff(10, config)).toBe(5000)
    })
  })

  describe('isRetryableError', () => {
    it('should return true for errors in list', () => {
      const error = new Error('ECONNRESET')
      const retryableErrors = ['ECONNRESET', 'ETIMEDOUT']

      expect(isRetryableError(error, retryableErrors)).toBe(true)
    })

    it('should return false for errors not in list', () => {
      const error = new Error('Unknown error')
      const retryableErrors = ['ECONNRESET', 'ETIMEDOUT']

      expect(isRetryableError(error, retryableErrors)).toBe(false)
    })

    it('should return true when retryableErrors is undefined', () => {
      const error = new Error('Any error')

      expect(isRetryableError(error, undefined)).toBe(true)
    })

    it('should match partial error messages', () => {
      const error = new Error('Connection ECONNRESET during request')
      const retryableErrors = ['ECONNRESET']

      expect(isRetryableError(error, retryableErrors)).toBe(true)
    })

    it('should handle rate_limit errors', () => {
      const error = new Error('rate_limit exceeded')
      const retryableErrors = ['rate_limit', 'ETIMEDOUT']

      expect(isRetryableError(error, retryableErrors)).toBe(true)
    })
  })
})
