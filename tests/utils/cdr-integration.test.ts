jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}))

import path from 'node:path'
import fs from 'fs-extra'
import {
  executeWithCDR,
  recoverPhase,
  createCDRWrapper,
  validatePhaseHealth,
} from '../../src/utils/cdr-integration'
import { clearHealthProbes } from '../../src/utils/health-probes'
import { initializeFallbackTemplates } from '../../src/utils/fallback-templates'

describe('cdr-integration', () => {
  const testDir = path.join(process.cwd(), '.test-cdr-integration')
  const claudeDir = path.join(testDir, '.claude', 'plans', 'features')
  const templatesDir = path.join(testDir, 'templates', 'fallback')

  beforeEach(async () => {
    jest.clearAllMocks()
    await fs.ensureDir(claudeDir)
    await fs.ensureDir(templatesDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
    clearHealthProbes()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    clearHealthProbes()
    await fs.remove(testDir)
  })

  describe('executeWithCDR', () => {
    it('should execute function successfully on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      const result = await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.usedFallback).toBe(false)
      expect(result.attempts).toBe(1)
    })

    it('should retry on retryable errors', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success')

      const result = await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
        config: { retry: { maxRetries: 3, baseBackoffMs: 10, maxBackoffMs: 50 } },
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(2)
    })

    it('should use fallback after max retries', async () => {
      await initializeFallbackTemplates()

      const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))

      const result = await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'prd',
        config: {
          retry: { maxRetries: 2, baseBackoffMs: 10, maxBackoffMs: 50 },
          fallbackEnabled: true,
        },
      })

      expect(result.success).toBe(true)
      expect(result.usedFallback).toBe(true)
      expect(result.attempts).toBe(2)
    })

    it('should create checkpoint after successful execution', async () => {
      const featureDir = path.join(claudeDir, 'test-feature')
      await fs.ensureDir(featureDir)

      const fn = jest.fn().mockResolvedValue('success')

      const result = await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
      })

      expect(result.checkpointId).toBeDefined()
    })

    it('should call onProgress callback', async () => {
      const onProgress = jest.fn()
      const fn = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('done'), 50)))

      await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
        onProgress,
      })
    })

    it('should call onHealthWarning on status change', async () => {
      const onHealthWarning = jest.fn()
      const fn = jest.fn().mockResolvedValue('success')

      await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
        onHealthWarning,
      })
    })

    it('should return error when fallback is disabled and retries exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))

      const result = await executeWithCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
        config: {
          retry: { maxRetries: 2, baseBackoffMs: 10, maxBackoffMs: 50 },
          fallbackEnabled: false,
        },
      })

      expect(result.success).toBe(false)
      expect(result.usedFallback).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('recoverPhase', () => {
    it('should return undefined when no checkpoint exists', async () => {
      const resumeFn = jest.fn()

      const result = await recoverPhase('non-existent', 'implement', resumeFn)

      expect(result).toBeUndefined()
      expect(resumeFn).not.toHaveBeenCalled()
    })

    it('should call resumeFn with checkpoint state', async () => {
      const featureDir = path.join(claudeDir, 'test-feature', 'checkpoints')
      await fs.ensureDir(featureDir)

      const checkpoint = {
        id: 'test-checkpoint',
        feature: 'test-feature',
        phase: 'implement',
        state: { progress: 50, lastCompletedStep: 'step-2', artifacts: [] },
        createdAt: new Date().toISOString(),
      }
      await fs.writeJson(path.join(featureDir, 'test-checkpoint.json'), checkpoint)

      const resumeFn = jest.fn().mockResolvedValue('resumed')

      const result = await recoverPhase('test-feature', 'implement', resumeFn)

      expect(result).toBe('resumed')
      expect(resumeFn).toHaveBeenCalledWith({
        progress: 50,
        lastCompletedStep: 'step-2',
        artifacts: [],
      })
    })
  })

  describe('createCDRWrapper', () => {
    it('should create wrapper with default config', async () => {
      const withCDR = createCDRWrapper({
        retry: { maxRetries: 2, baseBackoffMs: 10, maxBackoffMs: 50 },
      })

      const fn = jest.fn().mockResolvedValue('success')

      const result = await withCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
      })

      expect(result.success).toBe(true)
    })

    it('should use wrapper config for retries', async () => {
      const withCDR = createCDRWrapper({
        retry: { maxRetries: 5, baseBackoffMs: 10, maxBackoffMs: 50 },
      })

      const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))

      const result = await withCDR(fn, {
        feature: 'test-feature',
        phase: 'implement',
      })

      expect(result.attempts).toBe(5)
    })
  })

  describe('validatePhaseHealth', () => {
    it('should return healthy when no issues', async () => {
      const result = await validatePhaseHealth('test-feature', 'implement')

      expect(result.healthy).toBe(true)
      expect(result.issues).toEqual([])
    })

    it('should detect incomplete checkpoint', async () => {
      const featureDir = path.join(claudeDir, 'test-feature', 'checkpoints')
      await fs.ensureDir(featureDir)

      const checkpoint = {
        id: 'incomplete-checkpoint',
        feature: 'test-feature',
        phase: 'implement',
        state: { progress: 50, artifacts: [] },
        createdAt: new Date().toISOString(),
      }
      await fs.writeJson(path.join(featureDir, 'incomplete-checkpoint.json'), checkpoint)

      const result = await validatePhaseHealth('test-feature', 'implement')

      expect(result.healthy).toBe(false)
      expect(result.issues).toContain('Incomplete checkpoint found (50%)')
    })
  })
})
