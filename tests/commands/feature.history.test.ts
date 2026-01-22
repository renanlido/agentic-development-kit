import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import fs from 'fs-extra'

const mockOraStart = jest.fn()
const mockOraSucceed = jest.fn()
const mockOraFail = jest.fn()
const mockOraInstance = {
  start: mockOraStart.mockReturnThis(),
  succeed: mockOraSucceed.mockReturnThis(),
  fail: mockOraFail.mockReturnThis(),
  text: '',
}

jest.mock('ora', () => jest.fn(() => mockOraInstance))

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    bold: (s: string) => s,
    gray: (s: string) => s,
  },
}))

const mockLoggerError = jest.fn()
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}))

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn(),
  },
}))

const mockProcessExit = jest
  .spyOn(process, 'exit')
  .mockImplementation((_code?: string | number | null | undefined) => {
    return undefined as never
  })

let mockTempDir = ''
jest.mock('../../src/utils/git-paths', () => ({
  getMainRepoPath: () => mockTempDir,
  isInWorktree: () => false,
  getCurrentWorktreePath: () => null,
  getClaudePath: (...segments: string[]) => path.join(mockTempDir, '.claude', ...segments),
  getFeaturesBasePath: () => path.join(mockTempDir, '.claude/plans/features'),
  getFeaturePath: (featureName: string, ...segments: string[]) =>
    path.join(mockTempDir, '.claude/plans/features', featureName, ...segments),
  getAgentsPath: () => path.join(mockTempDir, '.claude/agents'),
}))

const mockHistoryGetHistory = jest.fn() as any
jest.mock('../../src/utils/history-tracker', () => ({
  HistoryTracker: jest.fn().mockImplementation(() => ({
    getHistory: mockHistoryGetHistory,
    recordTransition: jest.fn(),
  })),
}))

describe('FeatureCommand - history()', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-history-test-'))
    mockTempDir = tempDir
    featureName = 'test-feature'

    mockOraStart.mockClear()
    mockOraSucceed.mockClear()
    mockOraFail.mockClear()
    mockLoggerError.mockClear()
    mockProcessExit.mockClear()
    mockHistoryGetHistory.mockClear()

    mockHistoryGetHistory.mockResolvedValue([])
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    mockTempDir = ''
  })

  describe('when history exists', () => {
    it('should display all transitions', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const history = [
        {
          timestamp: '2026-01-19T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'feature research',
          duration: 5000,
        },
        {
          timestamp: '2026-01-19T11:00:00Z',
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'feature plan',
          duration: 10000,
        },
      ]

      mockHistoryGetHistory.mockResolvedValue(history)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.history(featureName, {})

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toContain('prd')
      expect(allLogs).toContain('research')

      consoleSpy.mockRestore()
    })

    it('should respect limit option', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const limitedHistory = [
        {
          timestamp: '2026-01-19T09:00:00Z',
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'feature plan',
        },
        {
          timestamp: '2026-01-19T10:00:00Z',
          fromPhase: 'plan',
          toPhase: 'implement',
          trigger: 'feature implement',
        },
      ]

      mockHistoryGetHistory.mockResolvedValue(limitedHistory)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.history(featureName, { limit: 2 })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')

      expect(allLogs).toContain('research')
      expect(allLogs).toContain('plan')

      consoleSpy.mockRestore()
    })

    it('should display duration when available', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const history = [
        {
          timestamp: '2026-01-19T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'feature research',
          duration: 15000,
        },
      ]

      mockHistoryGetHistory.mockResolvedValue(history)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.history(featureName, {})

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toMatch(/\d+s/)

      consoleSpy.mockRestore()
    })
  })

  describe('when history is empty', () => {
    it('should show message', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.history(featureName, {})

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toMatch(/nenhuma|no.*transition/i)

      consoleSpy.mockRestore()
    })
  })

  describe('when feature does not exist', () => {
    it('should fail with error message', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      await featureCommand.history('non-existent-feature', {})

      expect(mockOraFail).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })
  })
})
