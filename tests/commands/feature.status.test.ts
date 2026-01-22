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

const mockStateManagerLoad = jest.fn() as any
jest.mock('../../src/utils/state-manager', () => ({
  StateManager: jest.fn().mockImplementation(() => ({
    loadUnifiedState: mockStateManagerLoad,
  })),
}))

const mockLoadProgress = jest.fn() as any
jest.mock('../../src/utils/progress', () => ({
  loadProgress: mockLoadProgress,
  saveProgress: jest.fn(),
  updateStepStatus: jest.fn(),
  isStepCompleted: jest.fn(),
}))

describe('FeatureCommand - status()', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-status-test-'))
    mockTempDir = tempDir
    featureName = 'test-feature'

    mockOraStart.mockClear()
    mockOraSucceed.mockClear()
    mockOraFail.mockClear()
    mockLoggerError.mockClear()
    mockProcessExit.mockClear()
    mockStateManagerLoad.mockClear()
    mockLoadProgress.mockClear()

    mockStateManagerLoad.mockResolvedValue({
      feature: featureName,
      currentPhase: 'not_started',
      progress: 0,
      tasks: [],
      transitions: [],
      lastUpdated: new Date().toISOString(),
      lastSynced: new Date().toISOString(),
    })

    mockLoadProgress.mockResolvedValue({
      feature: featureName,
      currentPhase: 'not_started',
      lastUpdated: new Date().toISOString(),
    })
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    mockTempDir = ''
  })

  describe('basic status (without --unified)', () => {
    it('should display basic feature status', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockLoadProgress.mockResolvedValue({
        feature: featureName,
        currentPhase: 'implement',
        lastUpdated: '2026-01-20T10:00:00Z',
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.status(featureName, {})

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toContain(featureName)
      expect(allLogs).toContain('implement')

      consoleSpy.mockRestore()
    })
  })

  describe('unified status (with --unified)', () => {
    it('should display consolidated state with task breakdown', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockStateManagerLoad.mockResolvedValue({
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'completed' },
          { name: 'Task 2', status: 'in_progress' },
          { name: 'Task 3', status: 'pending' },
          { name: 'Task 4', status: 'blocked' },
        ],
        transitions: [],
        lastUpdated: '2026-01-20T10:00:00Z',
        lastSynced: '2026-01-20T10:00:00Z',
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.status(featureName, { unified: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')

      expect(allLogs).toContain(featureName)
      expect(allLogs).toContain('implement')
      expect(allLogs).toContain('50%')

      expect(allLogs).toMatch(/completed.*1/i)
      expect(allLogs).toMatch(/in progress.*1/i)
      expect(allLogs).toMatch(/pending.*1/i)
      expect(allLogs).toMatch(/blocked.*1/i)

      consoleSpy.mockRestore()
    })

    it('should show recent transitions when available', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockStateManagerLoad.mockResolvedValue({
        feature: featureName,
        currentPhase: 'implement',
        progress: 75,
        tasks: [],
        transitions: [
          {
            timestamp: '2026-01-19T10:00:00Z',
            fromPhase: 'prd',
            toPhase: 'research',
            trigger: 'feature research',
          },
          {
            timestamp: '2026-01-19T11:00:00Z',
            fromPhase: 'research',
            toPhase: 'plan',
            trigger: 'feature plan',
          },
          {
            timestamp: '2026-01-19T12:00:00Z',
            fromPhase: 'plan',
            toPhase: 'implement',
            trigger: 'feature implement',
          },
        ],
        lastUpdated: '2026-01-20T10:00:00Z',
        lastSynced: '2026-01-20T10:00:00Z',
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.status(featureName, { unified: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')

      expect(allLogs).toContain('research')
      expect(allLogs).toContain('plan')
      expect(allLogs).toContain('implement')

      consoleSpy.mockRestore()
    })

    it('should handle zero transitions', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockStateManagerLoad.mockResolvedValue({
        feature: featureName,
        currentPhase: 'prd',
        progress: 0,
        tasks: [],
        transitions: [],
        lastUpdated: '2026-01-20T10:00:00Z',
        lastSynced: '2026-01-20T10:00:00Z',
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.status(featureName, { unified: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should show task breakdown by status', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockStateManagerLoad.mockResolvedValue({
        feature: featureName,
        currentPhase: 'implement',
        progress: 33,
        tasks: [
          { name: 'Task 1', status: 'completed' },
          { name: 'Task 2', status: 'completed' },
          { name: 'Task 3', status: 'in_progress' },
          { name: 'Task 4', status: 'pending' },
          { name: 'Task 5', status: 'pending' },
          { name: 'Task 6', status: 'pending' },
        ],
        transitions: [],
        lastUpdated: '2026-01-20T10:00:00Z',
        lastSynced: '2026-01-20T10:00:00Z',
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.status(featureName, { unified: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')

      expect(allLogs).toMatch(/completed.*2/i)
      expect(allLogs).toMatch(/in progress.*1/i)
      expect(allLogs).toMatch(/pending.*3/i)

      consoleSpy.mockRestore()
    })
  })

  describe('when feature does not exist', () => {
    it('should fail with error message', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      await featureCommand.status('non-existent-feature', {})

      expect(mockOraFail).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })
  })
})
