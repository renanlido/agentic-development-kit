import path from 'node:path'
import fs from 'fs-extra'
import type { AdkConfig, RemoteFeature } from '../../src/providers/types.js'

interface SyncableProgress {
  feature: string
  currentPhase: string
  steps: Array<{
    name: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    startedAt?: string
    completedAt?: string
    notes?: string
  }>
  lastUpdated: string
  nextStep?: string
  syncStatus?: 'pending' | 'synced' | 'error'
  remoteId?: string
  lastSynced?: string
}

const DEFAULT_STEPS = [
  { name: 'prd', status: 'completed' as const },
  { name: 'research', status: 'pending' as const },
  { name: 'tasks', status: 'pending' as const },
  { name: 'arquitetura', status: 'pending' as const },
  { name: 'implementacao', status: 'pending' as const },
  { name: 'qa', status: 'pending' as const },
  { name: 'docs', status: 'pending' as const },
]

const mockOraStart = jest.fn()
const mockOraStop = jest.fn()
const mockOraSucceed = jest.fn()
const mockOraFail = jest.fn()
const mockOraWarn = jest.fn()
const mockOraInstance = {
  start: mockOraStart.mockReturnThis(),
  stop: mockOraStop.mockReturnThis(),
  succeed: mockOraSucceed.mockReturnThis(),
  fail: mockOraFail.mockReturnThis(),
  warn: mockOraWarn.mockReturnThis(),
  text: '',
}

jest.mock('ora', () => {
  return jest.fn(() => mockOraInstance)
})

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

const mockSyncFeature = jest.fn()
const mockConnect = jest.fn()
const mockGetFeature = jest.fn()

jest.mock('../../src/providers/clickup/index.js', () => ({
  ClickUpProvider: jest.fn().mockImplementation(() => ({
    name: 'clickup',
    displayName: 'ClickUp',
    connect: mockConnect,
    syncFeature: mockSyncFeature,
    getFeature: mockGetFeature,
  })),
  createClickUpProvider: jest.fn(() => ({
    name: 'clickup',
    displayName: 'ClickUp',
    connect: mockConnect,
    syncFeature: mockSyncFeature,
    getFeature: mockGetFeature,
  })),
}))

import { SyncCommand } from '../../src/commands/sync.js'

describe('SyncCommand', () => {
  const testDir = path.join(process.cwd(), '.test-sync-cmd')
  const adkDir = path.join(testDir, '.adk')
  const configPath = path.join(adkDir, 'config.json')
  const envPath = path.join(testDir, '.env')
  const claudeDir = path.join(testDir, '.claude')
  const featuresDir = path.join(claudeDir, 'plans', 'features')

  let syncCommand: SyncCommand

  function createProgress(
    feature: string,
    overrides: Partial<SyncableProgress> = {}
  ): SyncableProgress {
    return {
      feature,
      currentPhase: 'prd',
      steps: [...DEFAULT_STEPS],
      lastUpdated: new Date().toISOString(),
      ...overrides,
    }
  }

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    await fs.ensureDir(featuresDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    mockOraStart.mockClear()
    mockOraSucceed.mockClear()
    mockOraFail.mockClear()
    mockOraWarn.mockClear()
    mockSyncFeature.mockReset()
    mockConnect.mockReset()
    mockGetFeature.mockReset()

    mockConnect.mockResolvedValue({ success: true })

    syncCommand = new SyncCommand()
  }, 15000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 15000)

  describe('run()', () => {
    describe('when no integration is configured', () => {
      it('should show message and exit', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run(undefined, {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+integration|not.+configured/i)
        expect(mockSyncFeature).not.toHaveBeenCalled()
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

      describe('with specific feature name', () => {
        it('should sync the specified feature', async () => {
          const featurePath = path.join(featuresDir, 'test-feature')
          await fs.ensureDir(featurePath)

          const progress = createProgress('test-feature', {
            currentPhase: 'implement',
          })
          await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

          mockSyncFeature.mockResolvedValue({
            status: 'synced',
            remoteId: 'task-123',
            lastSynced: new Date().toISOString(),
            message: 'Success',
          })

          await syncCommand.run('test-feature', {})

          expect(mockSyncFeature).toHaveBeenCalledTimes(1)
          expect(mockSyncFeature).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'test-feature' }),
            undefined
          )
          expect(mockOraSucceed).toHaveBeenCalled()
        })

        it('should show error when feature not found', async () => {
          const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

          await syncCommand.run('non-existent-feature', {})

          const allCalls = consoleSpy.mock.calls.flat().join(' ')
          expect(allCalls.toLowerCase()).toMatch(/not.+found|does.+not.+exist/i)
          expect(mockSyncFeature).not.toHaveBeenCalled()
          consoleSpy.mockRestore()
        })
      })

      describe('without feature name (sync all)', () => {
        it('should sync all features with pending changes', async () => {
          const feature1 = path.join(featuresDir, 'feature-1')
          const feature2 = path.join(featuresDir, 'feature-2')
          await fs.ensureDir(feature1)
          await fs.ensureDir(feature2)

          const progress1 = createProgress('feature-1', {
            currentPhase: 'implement',
            syncStatus: 'pending',
          })

          const progress2 = createProgress('feature-2', {
            currentPhase: 'plan',
            syncStatus: 'pending',
          })

          await fs.writeJson(path.join(feature1, 'progress.json'), progress1)
          await fs.writeJson(path.join(feature2, 'progress.json'), progress2)

          mockSyncFeature.mockResolvedValue({
            status: 'synced',
            remoteId: 'task-123',
            lastSynced: new Date().toISOString(),
            message: 'Success',
          })

          await syncCommand.run(undefined, {})

          expect(mockSyncFeature).toHaveBeenCalledTimes(2)
        })

        it('should skip features that are already synced', async () => {
          const feature1 = path.join(featuresDir, 'feature-1')
          await fs.ensureDir(feature1)

          const progress = createProgress('feature-1', {
            currentPhase: 'implement',
            syncStatus: 'synced',
            lastSynced: new Date().toISOString(),
          })

          await fs.writeJson(path.join(feature1, 'progress.json'), progress)

          await syncCommand.run(undefined, {})

          expect(mockSyncFeature).not.toHaveBeenCalled()
        })
      })

      describe('progress display', () => {
        it('should show progress for each feature', async () => {
          const feature1 = path.join(featuresDir, 'feature-1')
          const feature2 = path.join(featuresDir, 'feature-2')
          await fs.ensureDir(feature1)
          await fs.ensureDir(feature2)

          const progress1 = createProgress('feature-1', {
            currentPhase: 'implement',
            syncStatus: 'pending',
          })

          const progress2 = createProgress('feature-2', {
            currentPhase: 'plan',
            syncStatus: 'pending',
          })

          await fs.writeJson(path.join(feature1, 'progress.json'), progress1)
          await fs.writeJson(path.join(feature2, 'progress.json'), progress2)

          mockSyncFeature.mockResolvedValue({
            status: 'synced',
            remoteId: 'task-123',
            lastSynced: new Date().toISOString(),
            message: 'Success',
          })

          await syncCommand.run(undefined, {})

          expect(mockOraStart).toHaveBeenCalled()
        })
      })

      describe('error handling', () => {
        it('should handle sync failures gracefully', async () => {
          const featurePath = path.join(featuresDir, 'failing-feature')
          await fs.ensureDir(featurePath)

          const progress = createProgress('failing-feature', {
            currentPhase: 'implement',
            syncStatus: 'pending',
          })

          await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

          mockSyncFeature.mockResolvedValue({
            status: 'error',
            lastSynced: new Date().toISOString(),
            message: 'Network error',
          })

          await syncCommand.run('failing-feature', {})

          expect(mockOraFail).toHaveBeenCalled()
        })

        it('should continue with other features when one fails', async () => {
          const feature1 = path.join(featuresDir, 'feature-1')
          const feature2 = path.join(featuresDir, 'feature-2')
          await fs.ensureDir(feature1)
          await fs.ensureDir(feature2)

          const progress1 = createProgress('feature-1', {
            currentPhase: 'implement',
            syncStatus: 'pending',
          })

          const progress2 = createProgress('feature-2', {
            currentPhase: 'plan',
            syncStatus: 'pending',
          })

          await fs.writeJson(path.join(feature1, 'progress.json'), progress1)
          await fs.writeJson(path.join(feature2, 'progress.json'), progress2)

          mockSyncFeature
            .mockResolvedValueOnce({
              status: 'error',
              lastSynced: new Date().toISOString(),
              message: 'Failed',
            })
            .mockResolvedValueOnce({
              status: 'synced',
              remoteId: 'task-123',
              lastSynced: new Date().toISOString(),
              message: 'Success',
            })

          await syncCommand.run(undefined, {})

          expect(mockSyncFeature).toHaveBeenCalledTimes(2)
        })
      })

      describe('summary display', () => {
        it('should show summary of synced/failed/skipped features', async () => {
          const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

          const feature1 = path.join(featuresDir, 'feature-1')
          const feature2 = path.join(featuresDir, 'feature-2')
          const feature3 = path.join(featuresDir, 'feature-3')
          await fs.ensureDir(feature1)
          await fs.ensureDir(feature2)
          await fs.ensureDir(feature3)

          const progress1 = createProgress('feature-1', {
            currentPhase: 'implement',
            syncStatus: 'pending',
          })

          const progress2 = createProgress('feature-2', {
            currentPhase: 'plan',
            syncStatus: 'pending',
          })

          const progress3 = createProgress('feature-3', {
            currentPhase: 'plan',
            syncStatus: 'synced',
            lastSynced: new Date().toISOString(),
          })

          await fs.writeJson(path.join(feature1, 'progress.json'), progress1)
          await fs.writeJson(path.join(feature2, 'progress.json'), progress2)
          await fs.writeJson(path.join(feature3, 'progress.json'), progress3)

          mockSyncFeature
            .mockResolvedValueOnce({
              status: 'synced',
              remoteId: 'task-1',
              lastSynced: new Date().toISOString(),
              message: 'Success',
            })
            .mockResolvedValueOnce({
              status: 'error',
              lastSynced: new Date().toISOString(),
              message: 'Failed',
            })

          await syncCommand.run(undefined, {})

          const allCalls = consoleSpy.mock.calls.flat().join(' ')
          expect(allCalls).toMatch(/1.*synced|synced.*1/i)
          expect(allCalls).toMatch(/1.*failed|failed.*1/i)
          expect(allCalls).toMatch(/1.*skipped|skipped.*1/i)

          consoleSpy.mockRestore()
        })
      })

      describe('with remoteId', () => {
        it('should pass remoteId when feature has been synced before', async () => {
          const featurePath = path.join(featuresDir, 'synced-feature')
          await fs.ensureDir(featurePath)

          const progress = createProgress('synced-feature', {
            currentPhase: 'implement',
            syncStatus: 'pending',
            remoteId: 'existing-task-123',
          })

          await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

          mockSyncFeature.mockResolvedValue({
            status: 'synced',
            remoteId: 'existing-task-123',
            lastSynced: new Date().toISOString(),
            message: 'Updated',
          })

          await syncCommand.run('synced-feature', {})

          expect(mockSyncFeature).toHaveBeenCalledWith(expect.anything(), 'existing-task-123')
        })
      })
    })

    describe('when integration is disabled', () => {
      it('should show message and exit', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: false,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {},
        }
        await fs.writeJson(configPath, config, { spaces: 2 })

        await syncCommand.run(undefined, {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/disabled|not.+enabled/i)
        consoleSpy.mockRestore()
      })
    })

    describe('force flag', () => {
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

      it('should sync already synced features when --force is used', async () => {
        const featurePath = path.join(featuresDir, 'synced-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('synced-feature', {
          currentPhase: 'implement',
          syncStatus: 'synced',
          lastSynced: new Date().toISOString(),
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-123',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        await syncCommand.run(undefined, { force: true })

        expect(mockSyncFeature).toHaveBeenCalled()
      })
    })

    describe('offline queue integration', () => {
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

      it('should queue operation when sync fails with network error', async () => {
        const featurePath = path.join(featuresDir, 'offline-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('offline-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
          remoteId: 'existing-task-123',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        mockSyncFeature.mockRejectedValue(new Error('Network error'))

        await syncCommand.run('offline-feature', {})

        const queuePath = path.join(adkDir, 'sync-queue.json')
        expect(await fs.pathExists(queuePath)).toBe(true)

        const queue = await fs.readJson(queuePath)
        expect(queue.operations).toHaveLength(1)
        expect(queue.operations[0].feature).toBe('offline-feature')
        expect(queue.operations[0].type).toBe('update')
      })

      it('should not queue operation on successful sync', async () => {
        const featurePath = path.join(featuresDir, 'online-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('online-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-123',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        await syncCommand.run('online-feature', {})

        const queuePath = path.join(adkDir, 'sync-queue.json')
        if (await fs.pathExists(queuePath)) {
          const queue = await fs.readJson(queuePath)
          const featureOps = queue.operations.filter(
            (op: { feature: string }) => op.feature === 'online-feature'
          )
          expect(featureOps).toHaveLength(0)
        }
      })
    })

    describe('processQueue', () => {
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

      it('should process pending operations from queue', async () => {
        const featurePath = path.join(featuresDir, 'queued-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('queued-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const queuePath = path.join(adkDir, 'sync-queue.json')
        await fs.writeJson(queuePath, {
          version: '1.0.0',
          operations: [
            {
              id: 'op-1',
              type: 'update',
              feature: 'queued-feature',
              data: { phase: 'implement', progress: 14 },
              createdAt: new Date().toISOString(),
              retries: 0,
            },
          ],
        })

        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-123',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        await syncCommand.processQueue()

        const updatedQueue = await fs.readJson(queuePath)
        expect(updatedQueue.operations).toHaveLength(0)
      })

      it('should increment retry count on failed processing', async () => {
        const featurePath = path.join(featuresDir, 'retry-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('retry-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const queuePath = path.join(adkDir, 'sync-queue.json')
        await fs.writeJson(queuePath, {
          version: '1.0.0',
          operations: [
            {
              id: 'op-retry',
              type: 'update',
              feature: 'retry-feature',
              data: { phase: 'implement', progress: 14 },
              createdAt: new Date().toISOString(),
              retries: 0,
            },
          ],
        })

        mockSyncFeature.mockRejectedValue(new Error('Still offline'))

        await syncCommand.processQueue()

        const updatedQueue = await fs.readJson(queuePath)
        expect(updatedQueue.operations[0].retries).toBe(1)
        expect(updatedQueue.operations[0].lastError).toBe('Still offline')
      })

      it('should remove operation after max retries exceeded', async () => {
        const featurePath = path.join(featuresDir, 'max-retry-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('max-retry-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const queuePath = path.join(adkDir, 'sync-queue.json')
        await fs.writeJson(queuePath, {
          version: '1.0.0',
          operations: [
            {
              id: 'op-max-retry',
              type: 'update',
              feature: 'max-retry-feature',
              data: { phase: 'implement', progress: 14 },
              createdAt: new Date().toISOString(),
              retries: 3,
            },
          ],
        })

        mockSyncFeature.mockRejectedValue(new Error('Still offline'))

        await syncCommand.processQueue()

        const updatedQueue = await fs.readJson(queuePath)
        expect(updatedQueue.operations).toHaveLength(0)
      })

      it('should return summary of processed operations', async () => {
        const feature1Path = path.join(featuresDir, 'queue-feature-1')
        const feature2Path = path.join(featuresDir, 'queue-feature-2')
        await fs.ensureDir(feature1Path)
        await fs.ensureDir(feature2Path)

        await fs.writeJson(
          path.join(feature1Path, 'progress.json'),
          createProgress('queue-feature-1')
        )
        await fs.writeJson(
          path.join(feature2Path, 'progress.json'),
          createProgress('queue-feature-2')
        )

        const queuePath = path.join(adkDir, 'sync-queue.json')
        await fs.writeJson(queuePath, {
          version: '1.0.0',
          operations: [
            {
              id: 'op-q1',
              type: 'update',
              feature: 'queue-feature-1',
              data: {},
              createdAt: new Date().toISOString(),
              retries: 0,
            },
            {
              id: 'op-q2',
              type: 'update',
              feature: 'queue-feature-2',
              data: {},
              createdAt: new Date().toISOString(),
              retries: 0,
            },
          ],
        })

        mockSyncFeature
          .mockResolvedValueOnce({
            status: 'synced',
            remoteId: 'task-1',
            lastSynced: new Date().toISOString(),
            message: 'Success',
          })
          .mockRejectedValueOnce(new Error('Failed'))

        const result = await syncCommand.processQueue()

        expect(result.processed).toBe(2)
        expect(result.succeeded).toBe(1)
        expect(result.failed).toBe(1)
      })
    })

    describe('conflict detection', () => {
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

      it('should detect conflicts when local and remote have different phases', async () => {
        const featurePath = path.join(featuresDir, 'conflict-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('conflict-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
          remoteId: 'task-conflict',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const remoteFeature: RemoteFeature = {
          id: 'task-conflict',
          name: 'conflict-feature',
          status: 'in_progress',
          phase: 'qa',
          progress: 14,
          url: 'https://app.clickup.com/task/task-conflict',
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: new Date().toISOString(),
        }

        mockGetFeature.mockResolvedValue(remoteFeature)
        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-conflict',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const result = await syncCommand.syncWithConflictCheck('conflict-feature', {})

        expect(result.conflicts).toBeDefined()
        expect(result.conflicts.length).toBeGreaterThan(0)
        expect(result.conflicts[0].field).toBe('phase')
      })

      it('should apply local-wins strategy to resolve conflicts', async () => {
        const featurePath = path.join(featuresDir, 'local-wins-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('local-wins-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
          remoteId: 'task-local',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const remoteFeature: RemoteFeature = {
          id: 'task-local',
          name: 'local-wins-feature',
          status: 'in_progress',
          phase: 'qa',
          progress: 50,
          url: 'https://app.clickup.com/task/task-local',
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        }

        mockGetFeature.mockResolvedValue(remoteFeature)
        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-local',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const result = await syncCommand.syncWithConflictCheck('local-wins-feature', {})

        expect(mockSyncFeature).toHaveBeenCalledWith(
          expect.objectContaining({ phase: 'implement' }),
          'task-local'
        )
        expect(result.resolution?.strategy).toBe('local-wins')
      })

      it('should apply remote-wins strategy when configured', async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'remote-wins',
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

        const featurePath = path.join(featuresDir, 'remote-wins-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('remote-wins-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
          remoteId: 'task-remote',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const remoteFeature: RemoteFeature = {
          id: 'task-remote',
          name: 'remote-wins-feature',
          status: 'in_progress',
          phase: 'qa',
          progress: 50,
          url: 'https://app.clickup.com/task/task-remote',
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: '2026-01-18T10:00:00Z',
        }

        mockGetFeature.mockResolvedValue(remoteFeature)
        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-remote',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const result = await syncCommand.syncWithConflictCheck('remote-wins-feature', {})

        const savedProgress = await fs.readJson(path.join(featurePath, 'progress.json'))
        expect(savedProgress.currentPhase).toBe('qa')
        expect(result.resolution?.strategy).toBe('remote-wins')
      })

      it('should skip conflict check for new features without remoteId', async () => {
        const featurePath = path.join(featuresDir, 'new-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('new-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-new',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const result = await syncCommand.syncWithConflictCheck('new-feature', {})

        expect(mockGetFeature).not.toHaveBeenCalled()
        expect(result.conflicts).toHaveLength(0)
      })

      it('should generate conflict report when manual resolution needed', async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'manual',
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

        const featurePath = path.join(featuresDir, 'manual-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('manual-feature', {
          currentPhase: 'implement',
          syncStatus: 'pending',
          remoteId: 'task-manual',
        })

        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const remoteFeature: RemoteFeature = {
          id: 'task-manual',
          name: 'manual-feature',
          status: 'in_progress',
          phase: 'qa',
          progress: 50,
          url: 'https://app.clickup.com/task/task-manual',
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: new Date().toISOString(),
        }

        mockGetFeature.mockResolvedValue(remoteFeature)

        const result = await syncCommand.syncWithConflictCheck('manual-feature', {})

        expect(result.requiresManualResolution).toBe(true)
        expect(mockSyncFeature).not.toHaveBeenCalled()

        const reportPath = path.join(featurePath, 'conflict-report.md')
        expect(await fs.pathExists(reportPath)).toBe(true)
      })
    })

    describe('edge cases', () => {
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

      it('should handle progress.json parse errors gracefully', async () => {
        const featurePath = path.join(featuresDir, 'corrupt-feature')
        await fs.ensureDir(featurePath)
        await fs.writeFile(path.join(featurePath, 'progress.json'), 'invalid json {{{')

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run('corrupt-feature', {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+progress|not.+found/i)
        consoleSpy.mockRestore()
      })

      it('should handle missing .env file', async () => {
        await fs.remove(envPath)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run('some-feature', {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+token/i)
        consoleSpy.mockRestore()
      })

      it('should handle empty features directory', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run(undefined, {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+features/i)
        consoleSpy.mockRestore()
      })

      it('should skip features without progress.json file', async () => {
        const featureWithProgress = path.join(featuresDir, 'has-progress')
        const featureWithoutProgress = path.join(featuresDir, 'no-progress')

        await fs.ensureDir(featureWithProgress)
        await fs.ensureDir(featureWithoutProgress)

        const progress = createProgress('has-progress', { syncStatus: 'pending' })
        await fs.writeJson(path.join(featureWithProgress, 'progress.json'), progress)

        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-123',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run(undefined, {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(mockSyncFeature).toHaveBeenCalledTimes(1)
        expect(allCalls).toMatch(/1.*skipped/i)

        consoleSpy.mockRestore()
      })

      it('should handle features directory that does not exist', async () => {
        await fs.remove(featuresDir)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run(undefined, {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+features/i)
        consoleSpy.mockRestore()
      })

      it('should handle failed connection', async () => {
        mockConnect.mockResolvedValue({
          success: false,
          message: 'Invalid credentials',
        })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run('test-feature', {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/failed.+connect/i)
        consoleSpy.mockRestore()
      })

      it('should handle unknown provider gracefully', async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'unknown',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {},
        }
        await fs.writeJson(configPath, config, { spaces: 2 })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await syncCommand.run('test-feature', {})

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/unknown.+provider/i)
        consoleSpy.mockRestore()
      })
    })

    describe('syncWithConflictCheck edge cases', () => {
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

      it('should return early when feature path does not exist', async () => {
        const result = await syncCommand.syncWithConflictCheck('nonexistent', {})
        expect(result.success).toBe(false)
      })

      it('should return early when no integration provider configured', async () => {
        const config: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: null,
            enabled: false,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {},
        }
        await fs.writeJson(configPath, config, { spaces: 2 })

        const featurePath = path.join(featuresDir, 'no-config-feature')
        await fs.ensureDir(featurePath)
        const progress = createProgress('no-config-feature')
        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const result = await syncCommand.syncWithConflictCheck('no-config-feature', {})
        expect(result.success).toBe(false)
      })

      it('should sync when remote feature returns null', async () => {
        const featurePath = path.join(featuresDir, 'remote-null-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('remote-null-feature', {
          remoteId: 'task-null',
        })
        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        mockGetFeature.mockResolvedValue(null)
        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-null',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const result = await syncCommand.syncWithConflictCheck('remote-null-feature', {})
        expect(result.success).toBe(true)
      })

      it('should sync when no conflicts detected', async () => {
        const featurePath = path.join(featuresDir, 'no-conflict-feature')
        await fs.ensureDir(featurePath)

        const progress = createProgress('no-conflict-feature', {
          currentPhase: 'implement',
          remoteId: 'task-no-conflict',
        })
        await fs.writeJson(path.join(featurePath, 'progress.json'), progress)

        const remoteFeature: RemoteFeature = {
          id: 'task-no-conflict',
          name: 'no-conflict-feature',
          status: 'in_progress',
          phase: 'implement',
          progress: 14,
          url: 'https://app.clickup.com/task/task-no-conflict',
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: new Date().toISOString(),
        }

        mockGetFeature.mockResolvedValue(remoteFeature)
        mockSyncFeature.mockResolvedValue({
          status: 'synced',
          remoteId: 'task-no-conflict',
          lastSynced: new Date().toISOString(),
          message: 'Success',
        })

        const result = await syncCommand.syncWithConflictCheck('no-conflict-feature', {})
        expect(result.success).toBe(true)
        expect(result.conflicts).toHaveLength(0)
      })
    })
  })
})
