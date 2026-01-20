import type {
  ClickUpList,
  ClickUpRateLimitInfo,
  ClickUpSpace,
  ClickUpTask,
  ClickUpTeam,
  CreateTaskPayload,
  UpdateTaskPayload,
} from './types.js'
import { CLICKUP_API_BASE_URL } from './types.js'

export class ClickUpApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string
  ) {
    super(`ClickUp API Error (${statusCode}): ${message}`)
    this.name = 'ClickUpApiError'
  }
}

export class ClickUpClient {
  private readonly baseUrl = CLICKUP_API_BASE_URL
  private readonly token: string
  private rateLimitInfo: ClickUpRateLimitInfo | null = null

  constructor(token: string) {
    this.token = token
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: this.token,
      'Content-Type': 'application/json',
    }
  }

  private updateRateLimitInfo(headers: Headers): void {
    const limit = headers.get('X-RateLimit-Limit')
    const remaining = headers.get('X-RateLimit-Remaining')
    const reset = headers.get('X-RateLimit-Reset')

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: Number.parseInt(limit, 10),
        remaining: Number.parseInt(remaining, 10),
        reset: Number.parseInt(reset, 10),
      }
    }
  }

  getRateLimitInfo(): ClickUpRateLimitInfo | null {
    return this.rateLimitInfo
  }

  isRateLimited(): boolean {
    if (!this.rateLimitInfo) {
      return false
    }
    return this.rateLimitInfo.remaining === 0
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    })

    this.updateRateLimitInfo(response.headers)

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`
      let errorCode: string | undefined

      try {
        const errorData = (await response.json()) as { err?: string; ECODE?: string }
        errorMessage = errorData.err || errorMessage
        errorCode = errorData.ECODE
      } catch {
        // Ignore JSON parse errors
      }

      throw new ClickUpApiError(errorMessage, response.status, errorCode)
    }

    return (await response.json()) as T
  }

  async getTeams(): Promise<ClickUpTeam[]> {
    const response = await this.request<{ teams: ClickUpTeam[] }>('/team')
    return response.teams
  }

  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const response = await this.request<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`)
    return response.spaces
  }

  async getLists(spaceId: string): Promise<ClickUpList[]> {
    const response = await this.request<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`)
    return response.lists
  }

  async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
    const response = await this.request<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`)
    return response.lists
  }

  async createTask(listId: string, payload: CreateTaskPayload): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTask(taskId: string, updates: UpdateTaskPayload): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: 'GET',
    })
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request<Record<string, unknown>>(`/task/${taskId}`, {
      method: 'DELETE',
    })
  }

  async setCustomFieldValue(taskId: string, fieldId: string, value: unknown): Promise<void> {
    await this.request<Record<string, unknown>>(`/task/${taskId}/field/${fieldId}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    })
  }

  async getTasks(
    listId: string,
    options?: { archived?: boolean; page?: number; subtasks?: boolean }
  ): Promise<ClickUpTask[]> {
    const params = new URLSearchParams()
    if (options?.archived !== undefined) {
      params.set('archived', String(options.archived))
    }
    if (options?.page !== undefined) {
      params.set('page', String(options.page))
    }
    if (options?.subtasks !== undefined) {
      params.set('subtasks', String(options.subtasks))
    }

    const queryString = params.toString()
    const endpoint = `/list/${listId}/task${queryString ? `?${queryString}` : ''}`

    const response = await this.request<{ tasks: ClickUpTask[] }>(endpoint)
    return response.tasks
  }
}

export function createClickUpClient(token: string): ClickUpClient {
  return new ClickUpClient(token)
}
