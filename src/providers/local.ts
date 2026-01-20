import fs from 'fs-extra'
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
} from '../types/provider.js'
import { getFeaturePath } from '../utils/paths.js'
import { loadProgress } from '../utils/progress.js'

export class LocalProvider implements ProjectProvider {
  readonly name = 'local'
  readonly displayName = 'Local Files'

  async isConfigured(): Promise<boolean> {
    return true
  }

  async testConnection(): Promise<ProviderConnectionResult> {
    return {
      success: true,
      message: 'Local provider is always available',
    }
  }

  async connect(_credentials: ProviderCredentials): Promise<ProviderConnectionResult> {
    return {
      success: true,
      message: 'Connected to local file system',
    }
  }

  async disconnect(): Promise<void> {
    return
  }

  async getWorkspaces(): Promise<ProviderWorkspace[]> {
    return [{ id: 'local', name: 'Local' }]
  }

  async getSpaces(_workspaceId: string): Promise<ProviderSpace[]> {
    return [{ id: 'local', name: 'Local' }]
  }

  async getLists(_spaceId: string): Promise<ProviderList[]> {
    return [{ id: 'local', name: 'Features', taskCount: 0 }]
  }

  async createFeature(feature: LocalFeature): Promise<RemoteFeature> {
    const featurePath = getFeaturePath(feature.name)
    const now = new Date().toISOString()

    return {
      id: `local:${feature.name}`,
      name: feature.name,
      status: feature.phase,
      phase: feature.phase,
      progress: feature.progress,
      url: `file://${featurePath}`,
      createdAt: now,
      updatedAt: now,
    }
  }

  async updateFeature(remoteId: string, updates: Partial<LocalFeature>): Promise<RemoteFeature> {
    const featureName = remoteId.replace('local:', '')
    const featurePath = getFeaturePath(featureName)
    const now = new Date().toISOString()

    let progress: Awaited<ReturnType<typeof loadProgress>> | null = null
    try {
      progress = await loadProgress(featureName)
    } catch {
      progress = null
    }

    return {
      id: remoteId,
      name: featureName,
      status: updates.phase || progress?.currentPhase || 'unknown',
      phase: updates.phase || progress?.currentPhase,
      progress: updates.progress,
      url: `file://${featurePath}`,
      createdAt: now,
      updatedAt: now,
    }
  }

  async getFeature(remoteId: string): Promise<RemoteFeature | null> {
    const featureName = remoteId.replace('local:', '')
    const featurePath = getFeaturePath(featureName)

    if (!(await fs.pathExists(featurePath))) {
      return null
    }

    try {
      const progress = await loadProgress(featureName)

      const completedSteps = progress.steps.filter((s) => s.status === 'completed').length
      const totalSteps = progress.steps.length
      const progressPercent = Math.round((completedSteps / totalSteps) * 100)

      return {
        id: remoteId,
        name: featureName,
        status: progress.currentPhase,
        phase: progress.currentPhase,
        progress: progressPercent,
        url: `file://${featurePath}`,
        createdAt: progress.lastUpdated,
        updatedAt: progress.lastUpdated,
      }
    } catch {
      return null
    }
  }

  async deleteFeature(_remoteId: string): Promise<void> {
    return
  }

  async syncFeature(feature: LocalFeature, _remoteId?: string): Promise<SyncResult> {
    const featurePath = getFeaturePath(feature.name)

    return {
      status: 'synced',
      remoteId: `local:${feature.name}`,
      remoteUrl: `file://${featurePath}`,
      lastSynced: new Date().toISOString(),
      message: 'Local provider - no sync required',
    }
  }

  async getRemoteChanges(_since: Date): Promise<RemoteFeature[]> {
    return []
  }
}

export function createLocalProvider(): LocalProvider {
  return new LocalProvider()
}
