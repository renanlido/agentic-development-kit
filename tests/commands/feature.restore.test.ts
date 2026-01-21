import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

const mockOraStart = jest.fn()
const mockOraSucceed = jest.fn()
const mockOraFail = jest.fn()
const mockOraInfo = jest.fn()
const mockOraInstance = {
  start: mockOraStart.mockReturnThis(),
  succeed: mockOraSucceed.mockReturnThis(),
  fail: mockOraFail.mockReturnThis(),
  info: mockOraInfo.mockReturnThis(),
  text: '',
}

jest.mock('ora', () => jest.fn(() => mockOraInstance))

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    gray: (s: string) => s,
  },
}))

const mockLoggerError = jest.fn()
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}))

const mockInquirerPrompt = jest.fn() as any
jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: mockInquirerPrompt,
  },
}))

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
  return undefined as never
})

const mockListSnapshots = jest.fn() as any
const mockRestoreSnapshot = jest.fn() as any
const mockCreateSnapshot = jest.fn() as any
jest.mock('../../src/utils/snapshot-manager', () => ({
  SnapshotManager: jest.fn().mockImplementation(() => ({
    listSnapshots: mockListSnapshots,
    restoreSnapshot: mockRestoreSnapshot,
    createSnapshot: mockCreateSnapshot,
  })),
}))

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

describe('FeatureCommand - restore()', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-restore-test-'))
    mockTempDir = tempDir
    featureName = 'test-feature'

    mockOraStart.mockClear()
    mockOraSucceed.mockClear()
    mockOraFail.mockClear()
    mockOraInfo.mockClear()
    mockLoggerError.mockClear()
    mockProcessExit.mockClear()
    mockInquirerPrompt.mockClear()
    mockListSnapshots.mockClear()
    mockRestoreSnapshot.mockClear()
    mockCreateSnapshot.mockClear()

    mockListSnapshots.mockResolvedValue([])
    mockRestoreSnapshot.mockResolvedValue(undefined)
    mockCreateSnapshot.mockResolvedValue({ id: 'pre-restore-snapshot' })
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    mockTempDir = ''
  })

  describe('when listing snapshots', () => {
    it('should list available snapshots with metadata', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const snapshotId = 'pre-sync-2026-01-20-12345'
      mockListSnapshots.mockResolvedValue([
        {
          id: snapshotId,
          trigger: 'pre-sync',
          createdAt: '2026-01-20T10:00:00Z',
          files: ['progress.md', 'tasks.md'],
        },
      ])

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.restore(featureName, { list: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toContain(snapshotId)

      consoleSpy.mockRestore()
    })

    it('should show message when no snapshots available', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockListSnapshots.mockResolvedValue([])

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.restore(featureName, { list: true })

      expect(mockOraSucceed).toHaveBeenCalled()

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toMatch(/nenhum|no snapshot/i)

      consoleSpy.mockRestore()
    })
  })

  describe('when restoring snapshot', () => {
    it('should restore specific snapshot with confirmation', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const snapshotId = 'pre-sync-2026-01-20-12345'
      mockRestoreSnapshot.mockResolvedValue(undefined)

      mockInquirerPrompt.mockResolvedValue({ confirm: true })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.restore(featureName, { to: snapshotId })

      expect(mockInquirerPrompt).toHaveBeenCalled()
      expect(mockRestoreSnapshot).toHaveBeenCalledWith(featureName, snapshotId)
      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should cancel restore when user declines confirmation', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const snapshotId = 'pre-sync-2026-01-20-12345'

      mockInquirerPrompt.mockResolvedValue({ confirm: false })

      await featureCommand.restore(featureName, { to: snapshotId })

      expect(mockInquirerPrompt).toHaveBeenCalled()
      expect(mockOraInfo).toHaveBeenCalled()
      expect(mockRestoreSnapshot).not.toHaveBeenCalled()
    })

    it('should create pre-restore backup', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const snapshotId = 'pre-sync-2026-01-20-12345'
      mockRestoreSnapshot.mockResolvedValue(undefined)

      mockInquirerPrompt.mockResolvedValue({ confirm: true })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.restore(featureName, { to: snapshotId })

      expect(mockRestoreSnapshot).toHaveBeenCalledWith(featureName, snapshotId)

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toMatch(/backup|pré-restauração/i)

      consoleSpy.mockRestore()
    })
  })

  describe('when feature does not exist', () => {
    it('should fail with error message', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      await featureCommand.restore('non-existent-feature', { list: true })

      expect(mockOraFail).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })
  })

  describe('when invalid snapshot ID provided', () => {
    it('should fail with error message', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      mockRestoreSnapshot.mockRejectedValue(new Error('Snapshot não encontrado'))
      mockInquirerPrompt.mockResolvedValue({ confirm: true })

      await featureCommand.restore(featureName, { to: 'invalid-snapshot-id' })

      expect(mockOraFail).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })
  })

  describe('when neither --list nor --to is provided', () => {
    it('should fail with usage error', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      await featureCommand.restore(featureName, {})

      expect(mockOraFail).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })
  })
})
