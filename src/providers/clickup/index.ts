import type {
  LocalFeature,
  ProjectProvider,
  ProviderConnectionResult,
  ProviderCredentials,
  ProviderList,
  ProviderSpace,
  ProviderWorkspace,
  RemoteFeature,
  SyncResult,
} from '../../types/provider.js'
import { ClickUpApiError, ClickUpClient } from './client.js'
import { featureToTask, featureToUpdatePayload, taskToFeature } from './mapper.js'

export class ClickUpProvider implements ProjectProvider {
  readonly name = 'clickup'
  readonly displayName = 'ClickUp'

  private client: ClickUpClient | null = null
  private credentials: ProviderCredentials | null = null
  private connected = false

  async isConfigured(): Promise<boolean> {
    return this.connected
  }

  async testConnection(): Promise<ProviderConnectionResult> {
    if (!this.client) {
      return {
        success: false,
        message: 'ClickUp provider not connected. Call connect() first.',
      }
    }

    try {
      await this.client.getTeams()
      return {
        success: true,
        message: 'Successfully connected to ClickUp',
      }
    } catch (error) {
      const message =
        error instanceof ClickUpApiError
          ? `Connection failed: ${error.message}`
          : 'Connection failed: Unknown error'
      return {
        success: false,
        message,
      }
    }
  }

  async connect(credentials: ProviderCredentials): Promise<ProviderConnectionResult> {
    if (!credentials.token) {
      return {
        success: false,
        message: 'Token is required to connect to ClickUp',
      }
    }

    this.client = new ClickUpClient(credentials.token)

    try {
      const teams = await this.client.getTeams()

      this.credentials = credentials
      this.connected = true

      return {
        success: true,
        message: 'Successfully connected to ClickUp',
        workspaces: teams.map((team) => ({
          id: team.id,
          name: team.name,
        })),
      }
    } catch (error) {
      this.client = null

      const message =
        error instanceof ClickUpApiError
          ? `Connection failed (${error.statusCode}): ${error.message}`
          : 'Connection failed: Unknown error'

      return {
        success: false,
        message,
      }
    }
  }

  async disconnect(): Promise<void> {
    this.client = null
    this.credentials = null
    this.connected = false
  }

  async getWorkspaces(): Promise<ProviderWorkspace[]> {
    if (!this.client) {
      return []
    }

    const teams = await this.client.getTeams()
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
    }))
  }

  async getSpaces(workspaceId: string): Promise<ProviderSpace[]> {
    if (!this.client) {
      return []
    }

    const spaces = await this.client.getSpaces(workspaceId)
    return spaces.map((space) => ({
      id: space.id,
      name: space.name,
    }))
  }

  async getLists(spaceId: string): Promise<ProviderList[]> {
    if (!this.client) {
      return []
    }

    const lists = await this.client.getLists(spaceId)
    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      taskCount: list.task_count ?? undefined,
    }))
  }

  async createFeature(feature: LocalFeature): Promise<RemoteFeature> {
    if (!this.client || !this.credentials?.listId) {
      throw new Error('ClickUp provider not configured. Call connect() first.')
    }

    const payload = featureToTask(feature)
    const task = await this.client.createTask(this.credentials.listId, payload)
    return taskToFeature(task)
  }

  async updateFeature(remoteId: string, feature: Partial<LocalFeature>): Promise<RemoteFeature> {
    if (!this.client) {
      throw new Error('ClickUp provider not connected. Call connect() first.')
    }

    const payload = featureToUpdatePayload(feature)
    const task = await this.client.updateTask(remoteId, payload)
    return taskToFeature(task)
  }

  async getFeature(remoteId: string): Promise<RemoteFeature | null> {
    if (!this.client) {
      return null
    }

    try {
      const task = await this.client.getTask(remoteId)
      return taskToFeature(task)
    } catch (error) {
      if (error instanceof ClickUpApiError && error.statusCode === 404) {
        return null
      }
      throw error
    }
  }

  async deleteFeature(remoteId: string): Promise<void> {
    if (!this.client) {
      return
    }

    await this.client.deleteTask(remoteId)
  }

  async syncFeature(feature: LocalFeature, remoteId?: string): Promise<SyncResult> {
    if (!this.client || !this.credentials?.listId) {
      return {
        status: 'error',
        lastSynced: new Date().toISOString(),
        message: 'ClickUp provider not configured',
      }
    }

    try {
      let task: Awaited<ReturnType<ClickUpClient['createTask']>>

      if (remoteId) {
        const payload = featureToUpdatePayload(feature)
        task = await this.client.updateTask(remoteId, payload)
      } else {
        const payload = featureToTask(feature)
        task = await this.client.createTask(this.credentials.listId, payload)
      }

      return {
        status: 'synced',
        remoteId: task.id,
        remoteUrl: task.url,
        lastSynced: new Date().toISOString(),
        message: 'Successfully synced to ClickUp',
      }
    } catch (error) {
      const message =
        error instanceof ClickUpApiError
          ? `Sync failed (${error.statusCode}): ${error.message}`
          : 'Sync failed: Unknown error'

      return {
        status: 'error',
        lastSynced: new Date().toISOString(),
        message,
      }
    }
  }

  async getRemoteChanges(since: Date): Promise<RemoteFeature[]> {
    if (!this.client || !this.credentials?.listId) {
      return []
    }

    try {
      const tasks = await this.client.getTasks(this.credentials.listId)

      const changedTasks = tasks.filter((task) => {
        const updatedAt = new Date(Number.parseInt(task.date_updated, 10))
        return updatedAt > since
      })

      return changedTasks.map(taskToFeature)
    } catch {
      return []
    }
  }

  async getTasks(listId: string): Promise<RemoteFeature[]> {
    if (!this.client) {
      return []
    }

    try {
      const tasks = await this.client.getTasks(listId)
      return tasks.map(taskToFeature)
    } catch {
      return []
    }
  }
}

export function createClickUpProvider(): ClickUpProvider {
  return new ClickUpProvider()
}
