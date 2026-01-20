import { ClickUpApiError, ClickUpClient } from '../../../src/providers/clickup/client.js'
import { ClickUpProvider } from '../../../src/providers/clickup/index.js'
import type {
  ClickUpList,
  ClickUpSpace,
  ClickUpTask,
  ClickUpTeam,
} from '../../../src/providers/clickup/types.js'
import type { LocalFeature, ProviderCredentials } from '../../../src/types/provider.js'

jest.mock('../../../src/providers/clickup/client.js', () => {
  const actual = jest.requireActual('../../../src/providers/clickup/client.js')
  return {
    ...actual,
    ClickUpClient: jest.fn(),
  }
})

describe('ClickUpProvider', () => {
  let provider: ClickUpProvider
  let mockClient: jest.Mocked<ClickUpClient>

  const mockCredentials: ProviderCredentials = {
    token: 'pk_test_token_12345',
    workspaceId: 'workspace123',
    spaceId: 'space456',
    listId: 'list789',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new ClickUpProvider()

    mockClient = {
      getTeams: jest.fn(),
      getSpaces: jest.fn(),
      getLists: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      getTask: jest.fn(),
      deleteTask: jest.fn(),
      setCustomFieldValue: jest.fn(),
      getTasks: jest.fn(),
      getRateLimitInfo: jest.fn(),
      isRateLimited: jest.fn(),
    } as unknown as jest.Mocked<ClickUpClient>

    ;(ClickUpClient as jest.MockedClass<typeof ClickUpClient>).mockImplementation(() => mockClient)
  })

  describe('interface compliance', () => {
    it('should have name as "clickup"', () => {
      expect(provider.name).toBe('clickup')
    })

    it('should have displayName as "ClickUp"', () => {
      expect(provider.displayName).toBe('ClickUp')
    })
  })

  describe('isConfigured', () => {
    it('should return false when not connected', async () => {
      const result = await provider.isConfigured()
      expect(result).toBe(false)
    })

    it('should return true when connected', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValueOnce(mockTeams)

      await provider.connect(mockCredentials)

      const result = await provider.isConfigured()
      expect(result).toBe(true)
    })
  })

  describe('testConnection', () => {
    it('should return success when API responds', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValueOnce(mockTeams)

      await provider.connect(mockCredentials)
      const result = await provider.testConnection()

      expect(result.success).toBe(true)
    })

    it('should return failure when not connected', async () => {
      const result = await provider.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toContain('not connected')
    })

    it('should return failure when API fails', async () => {
      mockClient.getTeams.mockRejectedValueOnce(new ClickUpApiError('Unauthorized', 401))

      await provider.connect(mockCredentials)
      const result = await provider.testConnection()

      expect(result.success).toBe(false)
    })
  })

  describe('connect', () => {
    it('should validate token with API call', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValueOnce(mockTeams)

      const result = await provider.connect(mockCredentials)

      expect(ClickUpClient).toHaveBeenCalledWith(mockCredentials.token)
      expect(mockClient.getTeams).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should store workspace info on success', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'My Workspace', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValueOnce(mockTeams)

      const result = await provider.connect(mockCredentials)

      expect(result.workspaces).toHaveLength(1)
      expect(result.workspaces?.[0].name).toBe('My Workspace')
    })

    it('should return failure on invalid token', async () => {
      mockClient.getTeams.mockRejectedValueOnce(new Error('Invalid token'))

      const result = await provider.connect({ token: 'invalid' })

      expect(result.success).toBe(false)
      expect(result.message).toContain('failed')
    })
  })

  describe('disconnect', () => {
    it('should clear stored state', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValueOnce(mockTeams)

      await provider.connect(mockCredentials)
      expect(await provider.isConfigured()).toBe(true)

      await provider.disconnect()
      expect(await provider.isConfigured()).toBe(false)
    })
  })

  describe('getWorkspaces', () => {
    it('should return workspaces from API', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Workspace 1', color: '#fff', avatar: null, members: [] },
        { id: 'team2', name: 'Workspace 2', color: '#000', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)

      await provider.connect(mockCredentials)
      const workspaces = await provider.getWorkspaces()

      expect(workspaces).toHaveLength(2)
      expect(workspaces[0].id).toBe('team1')
      expect(workspaces[1].name).toBe('Workspace 2')
    })
  })

  describe('getSpaces', () => {
    it('should return spaces from API', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockSpaces: ClickUpSpace[] = [
        {
          id: 'space1',
          name: 'Development',
          private: false,
          statuses: [],
          multiple_assignees: false,
          features: {
            due_dates: { enabled: true },
            time_tracking: { enabled: false },
            tags: { enabled: true },
            time_estimates: { enabled: false },
            checklists: { enabled: true },
            custom_fields: { enabled: true },
            priorities: { enabled: true },
          },
        },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getSpaces.mockResolvedValue(mockSpaces)

      await provider.connect(mockCredentials)
      const spaces = await provider.getSpaces('team1')

      expect(mockClient.getSpaces).toHaveBeenCalledWith('team1')
      expect(spaces).toHaveLength(1)
      expect(spaces[0].name).toBe('Development')
    })
  })

  describe('getLists', () => {
    it('should return lists from API', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockLists: ClickUpList[] = [
        {
          id: 'list1',
          name: 'Features',
          orderindex: 0,
          content: '',
          status: null,
          priority: null,
          assignee: null,
          task_count: 5,
          due_date: null,
          start_date: null,
          folder: null,
          space: { id: 'space1', name: 'Space', access: true },
          archived: false,
          override_statuses: false,
          statuses: [],
          permission_level: 'create',
        },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getLists.mockResolvedValue(mockLists)

      await provider.connect(mockCredentials)
      const lists = await provider.getLists('space1')

      expect(mockClient.getLists).toHaveBeenCalledWith('space1')
      expect(lists).toHaveLength(1)
      expect(lists[0].taskCount).toBe(5)
    })
  })

  describe('syncFeature', () => {
    const mockFeature: LocalFeature = {
      name: 'test-feature',
      phase: 'implement',
      progress: 50,
      lastUpdated: '2026-01-16T10:00:00Z',
    }

    it('should create new task when remote does not exist', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockTask: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'test-feature',
        url: 'https://app.clickup.com/t/task123',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.createTask.mockResolvedValue(mockTask as ClickUpTask)

      await provider.connect(mockCredentials)
      const result = await provider.syncFeature(mockFeature)

      expect(mockClient.createTask).toHaveBeenCalledWith('list789', expect.any(Object))
      expect(result.status).toBe('synced')
      expect(result.remoteId).toBe('task123')
      expect(result.remoteUrl).toBe('https://app.clickup.com/t/task123')
    })

    it('should update existing task when remote id provided', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockTask: Partial<ClickUpTask> = {
        id: 'existingTask',
        name: 'test-feature',
        url: 'https://app.clickup.com/t/existingTask',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.updateTask.mockResolvedValue(mockTask as ClickUpTask)

      await provider.connect(mockCredentials)
      const result = await provider.syncFeature(mockFeature, 'existingTask')

      expect(mockClient.updateTask).toHaveBeenCalledWith('existingTask', expect.any(Object))
      expect(result.status).toBe('synced')
    })

    it('should handle API errors gracefully', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.createTask.mockRejectedValue(new Error('Rate limited'))

      await provider.connect(mockCredentials)
      const result = await provider.syncFeature(mockFeature)

      expect(result.status).toBe('error')
      expect(result.message).toContain('failed')
    })
  })

  describe('getFeature', () => {
    it('should return null when not connected', async () => {
      const result = await provider.getFeature('task123')
      expect(result).toBeNull()
    })

    it('should return mapped feature from API', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockTask: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'my-feature',
        description: 'Feature desc',
        url: 'https://app.clickup.com/t/task123',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        date_created: '1234567890000',
        date_updated: '1234567890000',
        custom_fields: [],
        list: { id: 'list1', name: 'List', access: true },
        space: { id: 'space1' },
      }
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getTask.mockResolvedValue(mockTask as ClickUpTask)

      await provider.connect(mockCredentials)
      const result = await provider.getFeature('task123')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('my-feature')
    })
  })

  describe('createFeature', () => {
    it('should create task and return remote feature', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockTask: Partial<ClickUpTask> = {
        id: 'newTask123',
        name: 'new-feature',
        url: 'https://app.clickup.com/t/newTask123',
        status: { status: 'to do', color: '#fff', type: 'open', orderindex: 0 },
        date_created: '1234567890000',
        date_updated: '1234567890000',
        custom_fields: [],
        list: { id: 'list789', name: 'List', access: true },
        space: { id: 'space456' },
      }
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.createTask.mockResolvedValue(mockTask as ClickUpTask)

      await provider.connect(mockCredentials)

      const feature: LocalFeature = {
        name: 'new-feature',
        phase: 'prd',
        progress: 0,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = await provider.createFeature(feature)

      expect(result.id).toBe('newTask123')
      expect(result.url).toBe('https://app.clickup.com/t/newTask123')
    })

    it('should throw when not connected', async () => {
      const feature: LocalFeature = {
        name: 'new-feature',
        phase: 'prd',
        progress: 0,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      await expect(provider.createFeature(feature)).rejects.toThrow('not configured')
    })
  })

  describe('updateFeature', () => {
    it('should throw when not connected', async () => {
      await expect(provider.updateFeature('task123', { phase: 'plan' })).rejects.toThrow(
        'not connected'
      )
    })

    it('should update task when connected', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockTask: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'updated-feature',
        url: 'https://app.clickup.com/t/task123',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.updateTask.mockResolvedValue(mockTask as ClickUpTask)

      await provider.connect(mockCredentials)
      const result = await provider.updateFeature('task123', { phase: 'plan' })

      expect(result.id).toBe('task123')
    })
  })

  describe('deleteFeature', () => {
    it('should do nothing when not connected', async () => {
      await expect(provider.deleteFeature('task123')).resolves.toBeUndefined()
      expect(mockClient.deleteTask).not.toHaveBeenCalled()
    })

    it('should delete task when connected', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.deleteTask.mockResolvedValue()

      await provider.connect(mockCredentials)
      await provider.deleteFeature('task123')

      expect(mockClient.deleteTask).toHaveBeenCalledWith('task123')
    })
  })

  describe('getRemoteChanges', () => {
    it('should return empty array when not connected', async () => {
      const result = await provider.getRemoteChanges(new Date())
      expect(result).toEqual([])
    })

    it('should return changed tasks since given date', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const now = Date.now()
      const mockTasks: Partial<ClickUpTask>[] = [
        {
          id: 'task1',
          name: 'feature-1',
          url: 'https://app.clickup.com/t/task1',
          status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
          date_created: String(now - 10000),
          date_updated: String(now),
        },
        {
          id: 'task2',
          name: 'feature-2',
          url: 'https://app.clickup.com/t/task2',
          status: { status: 'done', color: '#fff', type: 'closed', orderindex: 2 },
          date_created: String(now - 20000),
          date_updated: String(now - 15000),
        },
      ]

      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getTasks.mockResolvedValue(mockTasks as ClickUpTask[])

      await provider.connect(mockCredentials)
      const since = new Date(now - 12000)
      const result = await provider.getRemoteChanges(since)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('feature-1')
    })

    it('should return empty array on API error', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getTasks.mockRejectedValue(new Error('API Error'))

      await provider.connect(mockCredentials)
      const result = await provider.getRemoteChanges(new Date())

      expect(result).toEqual([])
    })
  })

  describe('getWorkspaces when not connected', () => {
    it('should return empty array', async () => {
      const result = await provider.getWorkspaces()
      expect(result).toEqual([])
    })
  })

  describe('getSpaces when not connected', () => {
    it('should return empty array', async () => {
      const result = await provider.getSpaces('workspace1')
      expect(result).toEqual([])
    })
  })

  describe('getLists when not connected', () => {
    it('should return empty array', async () => {
      const result = await provider.getLists('space1')
      expect(result).toEqual([])
    })
  })

  describe('testConnection edge cases', () => {
    it('should handle non-ClickUpApiError exceptions', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValueOnce(mockTeams)
      await provider.connect(mockCredentials)

      mockClient.getTeams.mockRejectedValueOnce(new Error('Network failure'))
      const result = await provider.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toContain('Unknown error')
    })
  })

  describe('connect edge cases', () => {
    it('should return failure when no token provided', async () => {
      const result = await provider.connect({})

      expect(result.success).toBe(false)
      expect(result.message).toContain('Token is required')
    })

    it('should handle ClickUpApiError during connect', async () => {
      mockClient.getTeams.mockRejectedValueOnce(
        new ClickUpApiError('Invalid token', 401, 'AUTH_001')
      )

      const result = await provider.connect({ token: 'invalid-token' })

      expect(result.success).toBe(false)
      expect(result.message).toContain('401')
    })
  })

  describe('syncFeature edge cases', () => {
    it('should return error when not connected', async () => {
      const feature: LocalFeature = {
        name: 'test-feature',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = await provider.syncFeature(feature)

      expect(result.status).toBe('error')
      expect(result.message).toContain('not configured')
    })

    it('should handle ClickUpApiError during sync', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.createTask.mockRejectedValue(new ClickUpApiError('Rate limited', 429, 'RATE_001'))

      await provider.connect(mockCredentials)

      const feature: LocalFeature = {
        name: 'test-feature',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = await provider.syncFeature(feature)

      expect(result.status).toBe('error')
      expect(result.message).toContain('429')
    })
  })

  describe('getFeature edge cases', () => {
    it('should return null on 404 error', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getTask.mockRejectedValue(new ClickUpApiError('Not found', 404, 'NOT_FOUND'))

      await provider.connect(mockCredentials)
      const result = await provider.getFeature('nonexistent')

      expect(result).toBeNull()
    })

    it('should rethrow non-404 errors', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getTask.mockRejectedValue(new ClickUpApiError('Server error', 500, 'SERVER_ERR'))

      await provider.connect(mockCredentials)

      await expect(provider.getFeature('task123')).rejects.toThrow('500')
    })
  })

  describe('getLists with undefined task_count', () => {
    it('should handle lists without task_count', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team', color: '#fff', avatar: null, members: [] },
      ]
      const mockLists: Partial<ClickUpList>[] = [
        {
          id: 'list1',
          name: 'Features',
          orderindex: 0,
        },
      ]
      mockClient.getTeams.mockResolvedValue(mockTeams)
      mockClient.getLists.mockResolvedValue(mockLists as ClickUpList[])

      await provider.connect(mockCredentials)
      const lists = await provider.getLists('space1')

      expect(lists[0].taskCount).toBeUndefined()
    })
  })
})

describe('createClickUpProvider', () => {
  it('should create a new ClickUpProvider instance', async () => {
    const { createClickUpProvider } = await import('../../../src/providers/clickup/index.js')
    const newProvider = createClickUpProvider()
    expect(newProvider.name).toBe('clickup')
    expect(newProvider.displayName).toBe('ClickUp')
  })
})
