import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

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
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    bold: (s: string) => s,
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

const mockSyncEngineDryRun = jest.fn() as any
const mockSyncEngineSync = jest.fn() as any
jest.mock('../../src/utils/sync-engine', () => ({
  SyncEngine: jest.fn().mockImplementation(() => ({
    dryRun: mockSyncEngineDryRun,
    sync: mockSyncEngineSync,
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

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
  return undefined as never
})

describe('FeatureCommand - sync()', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-sync-test-'))
    mockTempDir = tempDir
    featureName = 'test-feature'

    mockOraStart.mockClear()
    mockOraSucceed.mockClear()
    mockOraFail.mockClear()
    mockLoggerError.mockClear()
    mockProcessExit.mockClear()
    mockSyncEngineDryRun.mockClear()
    mockSyncEngineSync.mockClear()

    mockSyncEngineDryRun.mockResolvedValue({
      changes: [],
      inconsistencies: [],
    })

    mockSyncEngineSync.mockResolvedValue({
      duration: 100,
      inconsistenciesResolved: 0,
      changesApplied: [],
      snapshotCreated: false,
    })
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    mockTempDir = ''
  })

  describe('when feature exists', () => {
    it('should sync with merge strategy by default', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `# Progress: ${featureName}
**Phase**: implement
- [x] **prd**
- [~] **research**
- [ ] **plan**`

      const tasksContent = `# Tasks: ${featureName}
- [x] P0: PRD
- [ ] P1: Research`

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)
      await fs.writeFile(path.join(featurePath, 'tasks.md'), tasksContent)

      await featureCommand.sync(featureName, {})

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(mockOraFail).not.toHaveBeenCalled()
    })

    it('should sync with tasks-wins strategy', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `# Progress: ${featureName}
**Phase**: implement`

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      await featureCommand.sync(featureName, { strategy: 'tasks-wins' })

      expect(mockOraSucceed).toHaveBeenCalled()
    })

    it('should sync with progress-wins strategy', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `# Progress: ${featureName}
**Phase**: implement`

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      await featureCommand.sync(featureName, { strategy: 'progress-wins' })

      expect(mockOraSucceed).toHaveBeenCalled()
    })

    it('should show preview without applying changes in dry-run mode', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `# Progress: ${featureName}
**Phase**: implement
- [x] **prd**`

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.sync(featureName, { dryRun: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should show detailed output in verbose mode', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `# Progress: ${featureName}
**Phase**: implement`

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.sync(featureName, { verbose: true })

      expect(mockOraSucceed).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle no changes scenario', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `# Progress: ${featureName}
**Phase**: implement`

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await featureCommand.sync(featureName, { dryRun: true })

      const allLogs = consoleSpy.mock.calls.flat().join(' ')
      expect(allLogs).toMatch(/nenhuma|no changes/i)

      consoleSpy.mockRestore()
    })
  })

  describe('when feature does not exist', () => {
    it('should fail with error message', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      await featureCommand.sync('non-existent-feature', {})

      expect(mockOraFail).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })
  })

  describe('error handling', () => {
    it('should handle sync engine errors gracefully', async () => {
      const { featureCommand } = await import('../../src/commands/feature')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      await fs.writeFile(path.join(featurePath, 'progress.md'), 'invalid content')

      await featureCommand.sync(featureName, {})

      expect(mockOraSucceed).toHaveBeenCalled()
    })
  })
})
