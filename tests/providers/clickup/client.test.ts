import { ClickUpApiError, ClickUpClient } from '../../../src/providers/clickup/client.js'
import type {
  ClickUpList,
  ClickUpSpace,
  ClickUpTask,
  ClickUpTeam,
} from '../../../src/providers/clickup/types.js'

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('ClickUpClient', () => {
  const testToken = 'pk_test_token_12345'
  let client: ClickUpClient

  beforeEach(() => {
    mockFetch.mockClear()
    client = new ClickUpClient(testToken)
  })

  describe('constructor', () => {
    it('should initialize with token', () => {
      expect(client).toBeInstanceOf(ClickUpClient)
    })
  })

  describe('authentication', () => {
    it('should set Authorization header with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: [] }),
        headers: new Headers(),
      })

      await client.getTeams()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: testToken,
          }),
        })
      )
    })

    it('should set Content-Type header to application/json', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: [] }),
        headers: new Headers(),
      })

      await client.getTeams()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })

  describe('getTeams', () => {
    it('should call correct endpoint', async () => {
      const mockTeams: ClickUpTeam[] = [
        { id: 'team1', name: 'Team 1', color: '#fff', avatar: null, members: [] },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: mockTeams }),
        headers: new Headers(),
      })

      const result = await client.getTeams()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/team',
        expect.any(Object)
      )
      expect(result).toEqual(mockTeams)
    })
  })

  describe('getSpaces', () => {
    it('should call correct endpoint with team id', async () => {
      const mockSpaces: ClickUpSpace[] = [
        {
          id: 'space1',
          name: 'Space 1',
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spaces: mockSpaces }),
        headers: new Headers(),
      })

      const result = await client.getSpaces('team123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/team/team123/space',
        expect.any(Object)
      )
      expect(result).toEqual(mockSpaces)
    })
  })

  describe('getLists', () => {
    it('should call correct endpoint with space id', async () => {
      const mockLists: ClickUpList[] = [
        {
          id: 'list1',
          name: 'List 1',
          orderindex: 0,
          content: '',
          status: null,
          priority: null,
          assignee: null,
          task_count: 5,
          due_date: null,
          start_date: null,
          folder: null,
          space: { id: 'space1', name: 'Space 1', access: true },
          archived: false,
          override_statuses: false,
          statuses: [],
          permission_level: 'create',
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: mockLists }),
        headers: new Headers(),
      })

      const result = await client.getLists('space123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/space/space123/list',
        expect.any(Object)
      )
      expect(result).toEqual(mockLists)
    })
  })

  describe('createTask', () => {
    it('should call correct endpoint with list id and payload', async () => {
      const mockTask: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'New Task',
        url: 'https://app.clickup.com/t/task123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
        headers: new Headers(),
      })

      const payload = { name: 'New Task', description: 'Task description' }
      const result = await client.createTask('list123', payload)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/list/list123/task',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      )
      expect(result.id).toBe('task123')
    })
  })

  describe('updateTask', () => {
    it('should call correct endpoint with task id and updates', async () => {
      const mockTask: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'Updated Task',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
        headers: new Headers(),
      })

      const updates = { name: 'Updated Task', status: 'in progress' }
      const result = await client.updateTask('task123', updates)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/task/task123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      )
      expect(result.name).toBe('Updated Task')
    })
  })

  describe('getTask', () => {
    it('should call correct endpoint with task id', async () => {
      const mockTask: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'Test Task',
        description: 'Description',
        url: 'https://app.clickup.com/t/task123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
        headers: new Headers(),
      })

      const result = await client.getTask('task123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/task/task123',
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result.id).toBe('task123')
    })
  })

  describe('deleteTask', () => {
    it('should call correct endpoint with task id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      })

      await client.deleteTask('task123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/task/task123',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('error handling', () => {
    it('should throw ClickUpApiError on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ err: 'Token invalid', ECODE: 'OAUTH_017' }),
        headers: new Headers(),
      })

      try {
        await client.getTeams()
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ClickUpApiError)
        expect((error as ClickUpApiError).statusCode).toBe(401)
        expect((error as ClickUpApiError).message).toContain('401')
      }
    })

    it('should throw ClickUpApiError on 429 Rate Limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ err: 'Rate limit exceeded', ECODE: 'RATE_001' }),
        headers: new Headers({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1234567890',
        }),
      })

      try {
        await client.getTeams()
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ClickUpApiError)
        expect((error as ClickUpApiError).statusCode).toBe(429)
        expect((error as ClickUpApiError).message).toContain('429')
      }
    })

    it('should throw ClickUpApiError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.getTeams()).rejects.toThrow()
    })

    it('should include status code in error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ err: 'Not found', ECODE: 'NOT_FOUND' }),
        headers: new Headers(),
      })

      try {
        await client.getTask('nonexistent')
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ClickUpApiError)
        expect((error as ClickUpApiError).statusCode).toBe(404)
      }
    })
  })

  describe('rate limit tracking', () => {
    it('should update rate limit info from response headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: [] }),
        headers: new Headers({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '95',
          'X-RateLimit-Reset': '1234567890',
        }),
      })

      await client.getTeams()

      const rateLimitInfo = client.getRateLimitInfo()
      expect(rateLimitInfo?.limit).toBe(100)
      expect(rateLimitInfo?.remaining).toBe(95)
    })

    it('should detect when rate limited', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: [] }),
        headers: new Headers({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
        }),
      })

      await client.getTeams()

      expect(client.isRateLimited()).toBe(true)
    })
  })

  describe('setCustomFieldValue', () => {
    it('should call correct endpoint to set custom field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      })

      await client.setCustomFieldValue('task123', 'field456', 75)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/task/task123/field/field456',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ value: 75 }),
        })
      )
    })
  })

  describe('getTasks', () => {
    it('should call correct endpoint without options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
        headers: new Headers(),
      })

      const result = await client.getTasks('list123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/list/list123/task',
        expect.any(Object)
      )
      expect(result).toEqual([])
    })

    it('should include archived param when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
        headers: new Headers(),
      })

      await client.getTasks('list123', { archived: true })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/list/list123/task?archived=true',
        expect.any(Object)
      )
    })

    it('should include page param when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
        headers: new Headers(),
      })

      await client.getTasks('list123', { page: 2 })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/list/list123/task?page=2',
        expect.any(Object)
      )
    })

    it('should include subtasks param when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
        headers: new Headers(),
      })

      await client.getTasks('list123', { subtasks: true })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/list/list123/task?subtasks=true',
        expect.any(Object)
      )
    })

    it('should combine multiple params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
        headers: new Headers(),
      })

      await client.getTasks('list123', { archived: false, page: 1, subtasks: true })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('archived=false'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.any(Object))
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('subtasks=true'),
        expect.any(Object)
      )
    })
  })

  describe('getFolderlessLists', () => {
    it('should call correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] }),
        headers: new Headers(),
      })

      await client.getFolderlessLists('space123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clickup.com/api/v2/space/space123/list',
        expect.any(Object)
      )
    })
  })

  describe('isRateLimited', () => {
    it('should return false when no rate limit info yet', () => {
      expect(client.isRateLimited()).toBe(false)
    })

    it('should return false when remaining > 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: [] }),
        headers: new Headers({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '50',
          'X-RateLimit-Reset': '1234567890',
        }),
      })

      await client.getTeams()
      expect(client.isRateLimited()).toBe(false)
    })
  })

  describe('error handling edge cases', () => {
    it('should handle error response with no JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON')
        },
        headers: new Headers(),
      })

      try {
        await client.getTeams()
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ClickUpApiError)
        expect((error as ClickUpApiError).statusCode).toBe(500)
      }
    })
  })
})

describe('createClickUpClient', () => {
  it('should create a new ClickUpClient instance', async () => {
    const { createClickUpClient } = await import('../../../src/providers/clickup/client.js')
    const newClient = createClickUpClient('test-token')
    expect(newClient).toBeInstanceOf(ClickUpClient)
  })
})
