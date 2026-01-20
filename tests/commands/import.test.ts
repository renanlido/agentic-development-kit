import path from 'node:path'
import fs from 'fs-extra'
import type { AdkConfig, RemoteFeature } from '../../src/providers/types.js'

const mockOraInstance = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  warn: jest.fn().mockReturnThis(),
  text: '',
}

jest.mock('ora', () => jest.fn(() => mockOraInstance))

jest.mock('chalk', () => {
  const bold = Object.assign((s: string) => s, { cyan: (s: string) => s })
  return {
    __esModule: true,
    default: {
      cyan: (s: string) => s,
      green: (s: string) => s,
      yellow: (s: string) => s,
      red: (s: string) => s,
      gray: (s: string) => s,
      white: (s: string) => s,
      bold,
    },
  }
})

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

const mockGetTasks = jest.fn()
const mockConnect = jest.fn()
const mockGetFeature = jest.fn()

jest.mock('../../src/providers/clickup/index.js', () => ({
  ClickUpProvider: jest.fn().mockImplementation(() => ({
    name: 'clickup',
    displayName: 'ClickUp',
    connect: mockConnect,
    getTasks: mockGetTasks,
    getFeature: mockGetFeature,
  })),
  createClickUpProvider: jest.fn(() => ({
    name: 'clickup',
    displayName: 'ClickUp',
    connect: mockConnect,
    getTasks: mockGetTasks,
    getFeature: mockGetFeature,
  })),
}))

import { ImportCommand } from '../../src/commands/import.js'

describe('ImportCommand', () => {
  const testDir = path.join(process.cwd(), '.test-import-cmd')
  const adkDir = path.join(testDir, '.adk')
  const configPath = path.join(adkDir, 'config.json')
  const envPath = path.join(testDir, '.env')
  const claudeDir = path.join(testDir, '.claude')
  const featuresDir = path.join(claudeDir, 'plans', 'features')

  let importCommand: ImportCommand

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    await fs.ensureDir(featuresDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    mockOraInstance.start.mockClear()
    mockOraInstance.succeed.mockClear()
    mockOraInstance.fail.mockClear()
    mockOraInstance.warn.mockClear()
    mockGetTasks.mockReset()
    mockConnect.mockReset()
    mockGetFeature.mockReset()

    mockConnect.mockResolvedValue({ success: true })

    importCommand = new ImportCommand()
  }, 15000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 15000)

  describe('run()', () => {
    describe('when no integration is configured', () => {
      it('should show message and exit', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+integration|not.+configured/i)
        consoleSpy.mockRestore()
      })
    })

    describe('when integration is configured', () => {
      beforeEach(async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-1',
              spaceId: 'sp-1',
              listId: 'list-1',
            },
          },
        }
        await fs.writeJson(configPath, config, { spaces: 2 })
        await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_test_token')
      })

      it('should import tasks from remote provider', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-1',
            name: 'feature-from-clickup',
            status: 'in progress',
            phase: 'implement',
            progress: 50,
            url: 'https://app.clickup.com/t/task-1',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        expect(mockGetTasks).toHaveBeenCalled()
        expect(mockOraInstance.succeed).toHaveBeenCalled()
      })

      it('should create local feature directories for imported tasks', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-import-1',
            name: 'imported-feature',
            status: 'to do',
            phase: 'prd',
            progress: 0,
            url: 'https://app.clickup.com/t/task-import-1',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        const featurePath = path.join(featuresDir, 'imported-feature')
        expect(await fs.pathExists(featurePath)).toBe(true)
      })

      it('should create progress.json with correct initial state', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-progress',
            name: 'progress-feature',
            status: 'in progress',
            phase: 'implement',
            progress: 60,
            url: 'https://app.clickup.com/t/task-progress',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        const progressPath = path.join(featuresDir, 'progress-feature', 'progress.json')
        const progress = await fs.readJson(progressPath)

        expect(progress.feature).toBe('progress-feature')
        expect(progress.currentPhase).toBe('implement')
        expect(progress.remoteId).toBe('task-progress')
        expect(progress.syncStatus).toBe('synced')
      })

      it('should skip already existing features', async () => {
        const existingFeaturePath = path.join(featuresDir, 'existing-feature')
        await fs.ensureDir(existingFeaturePath)
        await fs.writeJson(path.join(existingFeaturePath, 'progress.json'), {
          feature: 'existing-feature',
          currentPhase: 'prd',
        })

        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-existing',
            name: 'existing-feature',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-existing',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
          {
            id: 'task-new',
            name: 'new-feature',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-new',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const newFeaturePath = path.join(featuresDir, 'new-feature')
        expect(await fs.pathExists(newFeaturePath)).toBe(true)
        consoleSpy.mockRestore()
      })

      it('should handle --force flag to overwrite existing features', async () => {
        const existingFeaturePath = path.join(featuresDir, 'force-feature')
        await fs.ensureDir(existingFeaturePath)
        await fs.writeJson(path.join(existingFeaturePath, 'progress.json'), {
          feature: 'force-feature',
          currentPhase: 'prd',
        })

        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-force',
            name: 'force-feature',
            status: 'in progress',
            phase: 'implement',
            progress: 75,
            url: 'https://app.clickup.com/t/task-force',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({ force: true })

        const progressPath = path.join(existingFeaturePath, 'progress.json')
        const progress = await fs.readJson(progressPath)

        expect(progress.currentPhase).toBe('implement')
      })

      it('should filter by task id when --id is specified', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-specific',
            name: 'specific-feature',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-specific',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetFeature.mockResolvedValue(remoteTasks[0])

        await importCommand.run({ id: 'task-specific' })

        expect(mockGetFeature).toHaveBeenCalledWith('task-specific')
        const featurePath = path.join(featuresDir, 'specific-feature')
        expect(await fs.pathExists(featurePath)).toBe(true)
      })

      it('should show error when specified task id not found', async () => {
        mockGetFeature.mockResolvedValue(null)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({ id: 'nonexistent-task' })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/not.+found|doesn.*t.+exist/i)
        consoleSpy.mockRestore()
      })

      it('should show summary of imported features', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-a',
            name: 'feature-a',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-a',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
          {
            id: 'task-b',
            name: 'feature-b',
            status: 'in progress',
            phase: 'implement',
            url: 'https://app.clickup.com/t/task-b',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls).toMatch(/2.*import|import.*2/i)
        consoleSpy.mockRestore()
      })

      it('should map ClickUp status to ADK phase correctly', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-review',
            name: 'review-feature',
            status: 'review',
            url: 'https://app.clickup.com/t/task-review',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        const progressPath = path.join(featuresDir, 'review-feature', 'progress.json')
        const progress = await fs.readJson(progressPath)

        expect(progress.currentPhase).toBe('qa')
      })

      it('should handle empty task list gracefully', async () => {
        mockGetTasks.mockResolvedValue([])

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+tasks|nothing.+import/i)
        consoleSpy.mockRestore()
      })

      it('should sanitize feature names for filesystem', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-special',
            name: 'Feature with Spaces & Special/Chars!',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-special',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({})

        const entries = await fs.readdir(featuresDir)
        const sanitizedName = entries.find((e) => e.includes('feature'))
        expect(sanitizedName).toBeDefined()
        expect(sanitizedName).not.toContain('/')
        expect(sanitizedName).not.toContain('!')
      })
    })

    describe('error handling', () => {
      beforeEach(async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-1',
              spaceId: 'sp-1',
              listId: 'list-1',
            },
          },
        }
        await fs.writeJson(configPath, config, { spaces: 2 })
        await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_test_token')
      })

      it('should handle API errors gracefully', async () => {
        mockGetTasks.mockRejectedValue(new Error('API rate limit exceeded'))

        await importCommand.run({})

        expect(mockOraInstance.fail).toHaveBeenCalled()
      })

      it('should handle connection failures', async () => {
        mockConnect.mockResolvedValue({
          success: false,
          message: 'Invalid credentials',
        })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/failed.+connect|connection.+failed/i)
        consoleSpy.mockRestore()
      })

      it('should handle missing API token', async () => {
        await fs.remove(envPath)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+token|token.+missing/i)
        consoleSpy.mockRestore()
      })
    })

    describe('list features from remote', () => {
      beforeEach(async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-1',
              spaceId: 'sp-1',
              listId: 'list-1',
            },
          },
        }
        await fs.writeJson(configPath, config, { spaces: 2 })
        await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_test_token')
      })

      it('should list available tasks with --list flag', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-list-1',
            name: 'list-feature-1',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-list-1',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
          {
            id: 'task-list-2',
            name: 'list-feature-2',
            status: 'in progress',
            phase: 'implement',
            url: 'https://app.clickup.com/t/task-list-2',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({ list: true })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls).toContain('list-feature-1')
        expect(allCalls).toContain('list-feature-2')
        consoleSpy.mockRestore()
      })

      it('should not create files when --list flag is used', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-no-create',
            name: 'no-create-feature',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-no-create',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({ list: true })

        const featurePath = path.join(featuresDir, 'no-create-feature')
        expect(await fs.pathExists(featurePath)).toBe(false)
      })
    })

    describe('dry-run mode', () => {
      beforeEach(async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-1',
              spaceId: 'sp-1',
              listId: 'list-1',
            },
          },
        }
        await fs.writeJson(configPath, config, { spaces: 2 })
        await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_test_token')
      })

      it('should show what would be imported with --dry-run', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-dry',
            name: 'dry-run-feature',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-dry',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await importCommand.run({ dryRun: true })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/dry.+run|would.+import/i)
        consoleSpy.mockRestore()
      })

      it('should not create files in dry-run mode', async () => {
        const remoteTasks: RemoteFeature[] = [
          {
            id: 'task-dry-no-create',
            name: 'dry-no-create-feature',
            status: 'to do',
            phase: 'prd',
            url: 'https://app.clickup.com/t/task-dry-no-create',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-16T10:00:00Z',
          },
        ]

        mockGetTasks.mockResolvedValue(remoteTasks)

        await importCommand.run({ dryRun: true })

        const featurePath = path.join(featuresDir, 'dry-no-create-feature')
        expect(await fs.pathExists(featurePath)).toBe(false)
      })
    })
  })
})
