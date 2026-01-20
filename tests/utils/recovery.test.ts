import path from 'node:path'
import fs from 'fs-extra'
import {
  retryWithBackoff,
  calculateBackoff,
  isRetryableError,
  createCheckpoint,
  restoreCheckpoint,
  getCheckpoints,
  clearCheckpoints,
  getLatestCheckpoint,
} from '../../src/utils/recovery'
import { DEFAULT_RETRY_CONFIG } from '../../src/types/cdr'

describe('recovery', () => {
  const testDir = path.join(process.cwd(), '.test-recovery')
  const claudeDir = path.join(testDir, '.claude', 'plans', 'features')

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    await fs.ensureDir(claudeDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    await fs.remove(testDir)
  })

  describe('retryWithBackoff', () => {
    it('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      const resultPromise = retryWithBackoff(fn)
      await jest.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure up to maxRetries', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success')

      const resultPromise = retryWithBackoff(fn)
      await jest.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
      expect(result.error?.message).toBe('ECONNRESET')
    })

    it('should succeed on Nth attempt within maxRetries', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success')

      const resultPromise = retryWithBackoff(fn)
      await jest.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(3)
    })

    it('should apply exponential backoff between retries', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success')

      const resultPromise = retryWithBackoff(fn)

      expect(fn).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(DEFAULT_RETRY_CONFIG.baseBackoffMs)
      expect(fn).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(DEFAULT_RETRY_CONFIG.baseBackoffMs * 2)
      expect(fn).toHaveBeenCalledTimes(3)

      await resultPromise
    })

    it('should respect maxBackoffMs cap', () => {
      const config = {
        maxRetries: 5,
        baseBackoffMs: 1000,
        maxBackoffMs: 4000,
      }

      const backoff3 = calculateBackoff(3, config)
      const backoff4 = calculateBackoff(4, config)
      const backoff5 = calculateBackoff(5, config)

      expect(backoff3).toBeLessThanOrEqual(config.maxBackoffMs)
      expect(backoff4).toBeLessThanOrEqual(config.maxBackoffMs)
      expect(backoff5).toBeLessThanOrEqual(config.maxBackoffMs)
    })

    it('should use custom config when provided', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
      const config = { maxRetries: 5, baseBackoffMs: 500, maxBackoffMs: 2000 }

      const resultPromise = retryWithBackoff(fn, config)
      await jest.runAllTimersAsync()
      const result = await resultPromise

      expect(result.attempts).toBe(5)
      expect(fn).toHaveBeenCalledTimes(5)
    })

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('INVALID_INPUT'))

      const resultPromise = retryWithBackoff(fn)
      await jest.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should track total duration', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      const resultPromise = retryWithBackoff(fn)
      await jest.runAllTimersAsync()
      const result = await resultPromise

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      const config = {
        maxRetries: 3,
        baseBackoffMs: 1000,
        maxBackoffMs: 8000,
      }

      expect(calculateBackoff(1, config)).toBe(1000)
      expect(calculateBackoff(2, config)).toBe(2000)
      expect(calculateBackoff(3, config)).toBe(4000)
    })

    it('should cap at maxBackoffMs', () => {
      const config = {
        maxRetries: 5,
        baseBackoffMs: 1000,
        maxBackoffMs: 3000,
      }

      expect(calculateBackoff(4, config)).toBe(3000)
      expect(calculateBackoff(5, config)).toBe(3000)
    })

    it('should handle zero attempt', () => {
      const config = {
        maxRetries: 3,
        baseBackoffMs: 1000,
        maxBackoffMs: 8000,
      }

      expect(calculateBackoff(0, config)).toBe(1000)
    })
  })

  describe('isRetryableError', () => {
    it('should return true for ECONNRESET', () => {
      const error = new Error('ECONNRESET')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for ETIMEDOUT', () => {
      const error = new Error('ETIMEDOUT')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for ENOTFOUND', () => {
      const error = new Error('ENOTFOUND')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for rate_limit', () => {
      const error = new Error('rate_limit exceeded')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for overloaded', () => {
      const error = new Error('API overloaded')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = new Error('INVALID_INPUT')
      expect(isRetryableError(error)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isRetryableError(null as unknown as Error)).toBe(false)
    })

    it('should use custom retryable errors list', () => {
      const error = new Error('CUSTOM_ERROR')
      expect(isRetryableError(error, ['CUSTOM_ERROR'])).toBe(true)
    })
  })

  describe('createCheckpoint', () => {
    it('should create a checkpoint with state', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      const checkpoint = createCheckpoint('my-feature', 'implement', {
        progress: 50,
        lastCompletedStep: 'step-2',
        artifacts: [],
      })

      expect(checkpoint.id).toBeDefined()
      expect(checkpoint.feature).toBe('my-feature')
      expect(checkpoint.phase).toBe('implement')
      expect(checkpoint.state.progress).toBe(50)
      expect(checkpoint.createdAt).toBeDefined()
    })

    it('should include metadata when provided', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      const checkpoint = createCheckpoint(
        'my-feature',
        'implement',
        { progress: 50, artifacts: [] },
        { customField: 'value' }
      )

      expect(checkpoint.metadata).toEqual({ customField: 'value' })
    })

    it('should persist checkpoint to filesystem', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      const checkpoint = createCheckpoint('my-feature', 'implement', {
        progress: 50,
        artifacts: [],
      })

      const checkpointPath = path.join(
        featureDir,
        'checkpoints',
        `${checkpoint.id}.json`
      )
      expect(await fs.pathExists(checkpointPath)).toBe(true)
    })

    it('should create checkpoints directory if not exists', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      createCheckpoint('my-feature', 'implement', {
        progress: 50,
        artifacts: [],
      })

      const checkpointsDir = path.join(featureDir, 'checkpoints')
      expect(await fs.pathExists(checkpointsDir)).toBe(true)
    })

    it('should enforce max 5 checkpoints limit', async () => {
      jest.useRealTimers()

      const featureDir = path.join(claudeDir, 'my-feature')
      const checkpointsDir = path.join(featureDir, 'checkpoints')
      await fs.ensureDir(checkpointsDir)

      for (let i = 0; i < 6; i++) {
        createCheckpoint('my-feature', 'implement', {
          progress: i * 10,
          artifacts: [],
        })
        await new Promise((r) => setTimeout(r, 10))
      }

      const files = await fs.readdir(checkpointsDir)
      expect(files.length).toBeLessThanOrEqual(5)

      jest.useFakeTimers()
    })
  })

  describe('restoreCheckpoint', () => {
    it('should restore checkpoint from filesystem', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      const created = createCheckpoint('my-feature', 'implement', {
        progress: 50,
        artifacts: [],
      })

      const restored = restoreCheckpoint('my-feature', 'implement')

      expect(restored).toBeDefined()
      expect(restored?.id).toBe(created.id)
      expect(restored?.state.progress).toBe(50)
    })

    it('should return undefined if no checkpoint exists', () => {
      const checkpoint = restoreCheckpoint('non-existent', 'implement')
      expect(checkpoint).toBeUndefined()
    })

    it('should return the most recent checkpoint for phase', async () => {
      jest.useRealTimers()

      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      createCheckpoint('my-feature', 'implement', {
        progress: 30,
        artifacts: [],
      })

      await new Promise((r) => setTimeout(r, 50))

      const newerCheckpoint = createCheckpoint('my-feature', 'implement', {
        progress: 50,
        artifacts: [],
      })

      const restored = restoreCheckpoint('my-feature', 'implement')

      expect(restored?.id).toBe(newerCheckpoint.id)
      expect(restored?.state.progress).toBe(50)

      jest.useFakeTimers()
    })
  })

  describe('getCheckpoints', () => {
    it('should return all checkpoints for a feature', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      createCheckpoint('my-feature', 'implement', { progress: 30, artifacts: [] })
      createCheckpoint('my-feature', 'qa', { progress: 10, artifacts: [] })

      const checkpoints = getCheckpoints('my-feature')

      expect(checkpoints).toHaveLength(2)
    })

    it('should return empty array if no checkpoints directory', () => {
      const checkpoints = getCheckpoints('non-existent')
      expect(checkpoints).toEqual([])
    })
  })

  describe('getLatestCheckpoint', () => {
    it('should return the most recent checkpoint', async () => {
      jest.useRealTimers()

      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      createCheckpoint('my-feature', 'implement', { progress: 30, artifacts: [] })

      await new Promise((r) => setTimeout(r, 50))

      const latest = createCheckpoint('my-feature', 'qa', {
        progress: 10,
        artifacts: [],
      })

      const checkpoint = getLatestCheckpoint('my-feature')

      expect(checkpoint?.id).toBe(latest.id)

      jest.useFakeTimers()
    })

    it('should return undefined if no checkpoints', () => {
      const checkpoint = getLatestCheckpoint('non-existent')
      expect(checkpoint).toBeUndefined()
    })
  })

  describe('clearCheckpoints', () => {
    it('should remove all checkpoints for a feature', async () => {
      const featureDir = path.join(claudeDir, 'my-feature')
      await fs.ensureDir(featureDir)

      createCheckpoint('my-feature', 'implement', { progress: 30, artifacts: [] })
      createCheckpoint('my-feature', 'qa', { progress: 10, artifacts: [] })

      clearCheckpoints('my-feature')

      const checkpoints = getCheckpoints('my-feature')
      expect(checkpoints).toEqual([])
    })

    it('should do nothing if no checkpoints directory', () => {
      expect(() => clearCheckpoints('non-existent')).not.toThrow()
    })
  })
})
