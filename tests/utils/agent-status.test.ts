jest.mock('chalk', () => ({
  default: {
    cyan: { bold: (s: string) => s },
    gray: (s: string) => s,
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
  },
  cyan: { bold: (s: string) => s },
  gray: (s: string) => s,
  red: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
}))

import fs from 'node:fs/promises'
import {
  type AgentStatus,
  type AgentStatusState,
  clearAllStatuses,
  clearOldStatuses,
  clearStatusCache,
  completeAgent,
  createAgentStatus,
  displayAgentStatuses,
  failAgent,
  formatAgentStatus,
  generateAgentId,
  getAgentStatus,
  getAgentStatusesByFeature,
  getAllAgentStatuses,
  getPendingAgents,
  getRunningAgents,
  startAgent,
  updateAgentStatus,
} from '../../src/utils/agent-status'

jest.mock('node:fs/promises')

const mockFs = fs as jest.Mocked<typeof fs>

describe('AgentStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearStatusCache()
    mockFs.mkdir.mockResolvedValue(undefined)
  })

  describe('generateAgentId', () => {
    it('should generate unique id with feature and agent', () => {
      const id = generateAgentId('auth', 'analyzer')
      expect(id).toContain('auth')
      expect(id).toContain('analyzer')
    })

    it('should generate different ids for same inputs', () => {
      const id1 = generateAgentId('auth', 'analyzer')
      const id2 = generateAgentId('auth', 'analyzer')
      expect(id1).not.toBe(id2)
    })

    it('should include timestamp component', () => {
      const id = generateAgentId('test', 'agent')
      const parts = id.split('-')
      expect(parts.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('formatAgentStatus', () => {
    it('should format pending status with clock icon', () => {
      const status: AgentStatus = {
        id: 'test-id',
        agent: 'analyzer',
        feature: 'auth',
        status: 'pending',
      }

      const formatted = formatAgentStatus(status)
      expect(formatted).toContain('⏳')
      expect(formatted).toContain('analyzer')
      expect(formatted).toContain('auth')
    })

    it('should format running status with spinner icon', () => {
      const status: AgentStatus = {
        id: 'test-id',
        agent: 'implementer',
        feature: 'login',
        status: 'running',
        startedAt: new Date(Date.now() - 5000).toISOString(),
      }

      const formatted = formatAgentStatus(status)
      expect(formatted).toContain('🔄')
      expect(formatted).toContain('implementer')
    })

    it('should format completed status with check icon', () => {
      const status: AgentStatus = {
        id: 'test-id',
        agent: 'tester',
        feature: 'auth',
        status: 'completed',
        duration: 10000,
      }

      const formatted = formatAgentStatus(status)
      expect(formatted).toContain('✅')
      expect(formatted).toContain('10.0s')
    })

    it('should format failed status with x icon', () => {
      const status: AgentStatus = {
        id: 'test-id',
        agent: 'documenter',
        feature: 'api',
        status: 'failed',
        error: 'Timeout',
      }

      const formatted = formatAgentStatus(status)
      expect(formatted).toContain('❌')
    })

    it('should show elapsed time for running status', () => {
      const startedAt = new Date(Date.now() - 3000).toISOString()
      const status: AgentStatus = {
        id: 'test-id',
        agent: 'analyzer',
        feature: 'test',
        status: 'running',
        startedAt,
      }

      const formatted = formatAgentStatus(status)
      expect(formatted).toMatch(/\(\d+\.\d+s\)/)
    })
  })

  describe('AgentStatusState', () => {
    it('should accept valid status states', () => {
      const states: AgentStatusState[] = ['pending', 'running', 'completed', 'failed']
      expect(states.length).toBe(4)
    })
  })

  describe('AgentStatus interface', () => {
    it('should create valid status with all fields', () => {
      const status: AgentStatus = {
        id: 'feature-agent-123-abc',
        agent: 'analyzer',
        feature: 'authentication',
        status: 'completed',
        startedAt: '2026-01-14T10:00:00.000Z',
        completedAt: '2026-01-14T10:05:00.000Z',
        duration: 300000,
        worktree: '.worktrees/auth-analyzer-0',
        changedFiles: ['src/auth.ts', 'tests/auth.test.ts'],
      }

      expect(status.agent).toBe('analyzer')
      expect(status.feature).toBe('authentication')
      expect(status.duration).toBe(300000)
      expect(status.changedFiles).toHaveLength(2)
    })

    it('should create valid status with error', () => {
      const status: AgentStatus = {
        id: 'feature-agent-123-abc',
        agent: 'implementer',
        feature: 'login',
        status: 'failed',
        startedAt: '2026-01-14T10:00:00.000Z',
        completedAt: '2026-01-14T10:01:00.000Z',
        duration: 60000,
        error: 'Tests failed: 3 failing',
      }

      expect(status.status).toBe('failed')
      expect(status.error).toContain('Tests failed')
    })

    it('should allow minimal status', () => {
      const status: AgentStatus = {
        id: 'test-id',
        agent: 'reviewer',
        feature: 'code-review',
        status: 'pending',
      }

      expect(status.startedAt).toBeUndefined()
      expect(status.completedAt).toBeUndefined()
      expect(status.duration).toBeUndefined()
      expect(status.worktree).toBeUndefined()
      expect(status.error).toBeUndefined()
      expect(status.changedFiles).toBeUndefined()
    })
  })

  describe('Status transitions', () => {
    it('should represent pending -> running transition', () => {
      const pending: AgentStatus = {
        id: 'test-id',
        agent: 'analyzer',
        feature: 'test',
        status: 'pending',
      }

      const running: AgentStatus = {
        ...pending,
        status: 'running',
        startedAt: new Date().toISOString(),
      }

      expect(pending.status).toBe('pending')
      expect(running.status).toBe('running')
      expect(running.startedAt).toBeDefined()
    })

    it('should represent running -> completed transition', () => {
      const startTime = new Date(Date.now() - 5000)
      const endTime = new Date()

      const running: AgentStatus = {
        id: 'test-id',
        agent: 'implementer',
        feature: 'test',
        status: 'running',
        startedAt: startTime.toISOString(),
      }

      const completed: AgentStatus = {
        ...running,
        status: 'completed',
        completedAt: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        changedFiles: ['src/index.ts'],
      }

      expect(completed.status).toBe('completed')
      expect(completed.duration).toBeGreaterThan(0)
      expect(completed.changedFiles).toHaveLength(1)
    })

    it('should represent running -> failed transition', () => {
      const running: AgentStatus = {
        id: 'test-id',
        agent: 'tester',
        feature: 'test',
        status: 'running',
        startedAt: new Date().toISOString(),
      }

      const failed: AgentStatus = {
        ...running,
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Test suite failed with 3 errors',
      }

      expect(failed.status).toBe('failed')
      expect(failed.error).toContain('3 errors')
    })
  })

  describe('createAgentStatus', () => {
    it('should create new status and save to store', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'))
      mockFs.writeFile.mockResolvedValue(undefined)

      const status = await createAgentStatus('auth', 'analyzer', '.worktrees/auth-0')

      expect(status.agent).toBe('analyzer')
      expect(status.feature).toBe('auth')
      expect(status.status).toBe('pending')
      expect(status.worktree).toBe('.worktrees/auth-0')
      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should append to existing store', async () => {
      const existingStore = {
        statuses: [{ id: 'existing-id', agent: 'tester', feature: 'login', status: 'completed' }],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const status = await createAgentStatus('auth', 'analyzer')

      expect(status.agent).toBe('analyzer')
      const writeCall = mockFs.writeFile.mock.calls[0]
      const savedStore = JSON.parse(writeCall[1] as string)
      expect(savedStore.statuses).toHaveLength(2)
    })
  })

  describe('updateAgentStatus', () => {
    it('should update existing status', async () => {
      const existingStore = {
        statuses: [{ id: 'test-id', agent: 'analyzer', feature: 'auth', status: 'pending' }],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const updated = await updateAgentStatus('test-id', { status: 'running' })

      expect(updated?.status).toBe('running')
    })

    it('should return null if status not found', async () => {
      const existingStore = {
        statuses: [{ id: 'other-id', agent: 'analyzer', feature: 'auth', status: 'pending' }],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const updated = await updateAgentStatus('nonexistent-id', { status: 'running' })

      expect(updated).toBeNull()
    })
  })

  describe('startAgent', () => {
    it('should update status to running with startedAt', async () => {
      const existingStore = {
        statuses: [{ id: 'test-id', agent: 'analyzer', feature: 'auth', status: 'pending' }],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const started = await startAgent('test-id')

      expect(started?.status).toBe('running')
      expect(started?.startedAt).toBeDefined()
    })
  })

  describe('completeAgent', () => {
    it('should update status to completed with duration', async () => {
      const startTime = new Date(Date.now() - 5000).toISOString()
      const existingStore = {
        statuses: [
          {
            id: 'test-id',
            agent: 'analyzer',
            feature: 'auth',
            status: 'running',
            startedAt: startTime,
          },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const completed = await completeAgent('test-id', ['src/auth.ts'])

      expect(completed?.status).toBe('completed')
      expect(completed?.completedAt).toBeDefined()
      expect(completed?.duration).toBeGreaterThan(0)
      expect(completed?.changedFiles).toEqual(['src/auth.ts'])
    })

    it('should return null if status not found', async () => {
      const existingStore = {
        statuses: [],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const completed = await completeAgent('nonexistent-id')

      expect(completed).toBeNull()
    })

    it('should handle completion without startedAt', async () => {
      const existingStore = {
        statuses: [{ id: 'test-id', agent: 'analyzer', feature: 'auth', status: 'running' }],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const completed = await completeAgent('test-id')

      expect(completed?.duration).toBe(0)
    })
  })

  describe('failAgent', () => {
    it('should update status to failed with error', async () => {
      const startTime = new Date(Date.now() - 3000).toISOString()
      const existingStore = {
        statuses: [
          {
            id: 'test-id',
            agent: 'implementer',
            feature: 'login',
            status: 'running',
            startedAt: startTime,
          },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const failed = await failAgent('test-id', 'Test suite failed')

      expect(failed?.status).toBe('failed')
      expect(failed?.error).toBe('Test suite failed')
      expect(failed?.duration).toBeGreaterThan(0)
    })

    it('should return null if status not found', async () => {
      const existingStore = {
        statuses: [],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const failed = await failAgent('nonexistent-id', 'Error')

      expect(failed).toBeNull()
    })

    it('should handle failure without startedAt', async () => {
      const existingStore = {
        statuses: [{ id: 'test-id', agent: 'tester', feature: 'auth', status: 'running' }],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const failed = await failAgent('test-id', 'Timeout')

      expect(failed?.duration).toBe(0)
    })
  })

  describe('getAgentStatus', () => {
    it('should return status by id', async () => {
      const existingStore = {
        statuses: [
          { id: 'test-id', agent: 'analyzer', feature: 'auth', status: 'completed' },
          { id: 'other-id', agent: 'tester', feature: 'login', status: 'pending' },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const status = await getAgentStatus('test-id')

      expect(status?.agent).toBe('analyzer')
    })

    it('should return null if not found', async () => {
      const existingStore = {
        statuses: [],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const status = await getAgentStatus('nonexistent')

      expect(status).toBeNull()
    })
  })

  describe('getAllAgentStatuses', () => {
    it('should return all statuses', async () => {
      const existingStore = {
        statuses: [
          { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'completed' },
          { id: 'id-2', agent: 'tester', feature: 'auth', status: 'running' },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const statuses = await getAllAgentStatuses()

      expect(statuses).toHaveLength(2)
    })
  })

  describe('getAgentStatusesByFeature', () => {
    it('should filter statuses by feature', async () => {
      const existingStore = {
        statuses: [
          { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'completed' },
          { id: 'id-2', agent: 'tester', feature: 'login', status: 'running' },
          { id: 'id-3', agent: 'implementer', feature: 'auth', status: 'pending' },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const statuses = await getAgentStatusesByFeature('auth')

      expect(statuses).toHaveLength(2)
      expect(statuses.every((s) => s.feature === 'auth')).toBe(true)
    })
  })

  describe('getRunningAgents', () => {
    it('should return only running agents', async () => {
      const existingStore = {
        statuses: [
          { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'completed' },
          { id: 'id-2', agent: 'tester', feature: 'login', status: 'running' },
          { id: 'id-3', agent: 'implementer', feature: 'auth', status: 'running' },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const running = await getRunningAgents()

      expect(running).toHaveLength(2)
      expect(running.every((s) => s.status === 'running')).toBe(true)
    })
  })

  describe('getPendingAgents', () => {
    it('should return only pending agents', async () => {
      const existingStore = {
        statuses: [
          { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'pending' },
          { id: 'id-2', agent: 'tester', feature: 'login', status: 'running' },
          { id: 'id-3', agent: 'implementer', feature: 'auth', status: 'pending' },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))

      const pending = await getPendingAgents()

      expect(pending).toHaveLength(2)
      expect(pending.every((s) => s.status === 'pending')).toBe(true)
    })
  })

  describe('clearOldStatuses', () => {
    it('should remove old completed/failed statuses', async () => {
      const oldTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const recentTime = new Date(Date.now() - 1000).toISOString()
      const existingStore = {
        statuses: [
          {
            id: 'id-1',
            agent: 'analyzer',
            feature: 'auth',
            status: 'completed',
            completedAt: oldTime,
          },
          { id: 'id-2', agent: 'tester', feature: 'login', status: 'running' },
          {
            id: 'id-3',
            agent: 'implementer',
            feature: 'auth',
            status: 'completed',
            completedAt: recentTime,
          },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const removed = await clearOldStatuses()

      expect(removed).toBe(1)
    })

    it('should keep running and pending statuses regardless of age', async () => {
      const oldTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const existingStore = {
        statuses: [
          { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'running' },
          { id: 'id-2', agent: 'tester', feature: 'login', status: 'pending' },
        ],
        lastUpdated: oldTime,
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      const removed = await clearOldStatuses()

      expect(removed).toBe(0)
    })
  })

  describe('clearAllStatuses', () => {
    it('should remove all statuses', async () => {
      const existingStore = {
        statuses: [
          { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'completed' },
          { id: 'id-2', agent: 'tester', feature: 'login', status: 'running' },
        ],
        lastUpdated: '2026-01-14T00:00:00.000Z',
        version: '1.0.0',
      }
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingStore))
      mockFs.writeFile.mockResolvedValue(undefined)

      await clearAllStatuses()

      const writeCall = mockFs.writeFile.mock.calls[0]
      const savedStore = JSON.parse(writeCall[1] as string)
      expect(savedStore.statuses).toHaveLength(0)
    })
  })

  describe('displayAgentStatuses', () => {
    let consoleSpy: jest.SpyInstance

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('should display empty message for no statuses', () => {
      displayAgentStatuses([])

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Agent Status'))
    })

    it('should display statuses grouped by feature', () => {
      const statuses: AgentStatus[] = [
        { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'completed', duration: 5000 },
        {
          id: 'id-2',
          agent: 'tester',
          feature: 'auth',
          status: 'running',
          startedAt: new Date().toISOString(),
        },
        { id: 'id-3', agent: 'implementer', feature: 'login', status: 'pending' },
      ]

      displayAgentStatuses(statuses)

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should display error messages', () => {
      const statuses: AgentStatus[] = [
        { id: 'id-1', agent: 'analyzer', feature: 'auth', status: 'failed', error: 'Test failed' },
      ]

      displayAgentStatuses(statuses)

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should display changed files', () => {
      const statuses: AgentStatus[] = [
        {
          id: 'id-1',
          agent: 'analyzer',
          feature: 'auth',
          status: 'completed',
          changedFiles: ['src/auth.ts', 'tests/auth.test.ts'],
        },
      ]

      displayAgentStatuses(statuses)

      expect(consoleSpy).toHaveBeenCalled()
    })
  })
})
