import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { createClickUpProvider } from '../providers/clickup/index.js'
import type {
  ConflictStrategy,
  LocalFeature,
  ProjectProvider,
  ProviderSpecificConfig,
  RemoteFeature,
  SyncConflict,
  SyncResult,
} from '../providers/types.js'
import { getIntegrationConfig, getProviderConfig } from '../utils/config.js'
import { getMainRepoPath } from '../utils/git-paths.js'
import {
  type ConflictResolution,
  createConflictReport,
  detectConflicts,
  resolveConflicts,
} from '../utils/sync-conflict.js'
import { createSyncQueue, type QueuedOperation, type SyncQueue } from '../utils/sync-queue.js'

interface SyncOptions {
  force?: boolean
}

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

interface SyncSummary {
  synced: number
  failed: number
  skipped: number
}

interface ProcessQueueResult {
  processed: number
  succeeded: number
  failed: number
  remaining: number
}

interface SyncWithConflictResult {
  success: boolean
  conflicts: SyncConflict[]
  resolution?: ConflictResolution
  requiresManualResolution: boolean
  syncResult?: SyncResult
}

const MAX_RETRIES = 3

export class SyncCommand {
  private queue: SyncQueue

  constructor() {
    this.queue = createSyncQueue()
  }

  private getFeaturesDir(): string {
    return path.join(getMainRepoPath(), '.claude', 'plans', 'features')
  }

  private async getTokenFromEnv(provider: string): Promise<string | null> {
    const envPath = path.join(getMainRepoPath(), '.env')

    if (await fs.pathExists(envPath)) {
      const content = await fs.readFile(envPath, 'utf-8')
      const key = `${provider.toUpperCase()}_API_TOKEN`
      const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
      return match ? match[1].trim() : null
    }

    return null
  }

  private async loadFeatureProgress(featureName: string): Promise<SyncableProgress | null> {
    const progressPath = path.join(this.getFeaturesDir(), featureName, 'progress.json')

    if (await fs.pathExists(progressPath)) {
      try {
        return await fs.readJson(progressPath)
      } catch {
        return null
      }
    }

    return null
  }

  private async saveFeatureProgress(
    featureName: string,
    progress: SyncableProgress
  ): Promise<void> {
    const progressPath = path.join(this.getFeaturesDir(), featureName, 'progress.json')
    await fs.writeJson(progressPath, progress, { spaces: 2 })
  }

  private async listFeatures(): Promise<string[]> {
    const featuresDir = this.getFeaturesDir()

    if (!(await fs.pathExists(featuresDir))) {
      return []
    }

    const entries = await fs.readdir(featuresDir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  }

  private progressToLocalFeature(progress: SyncableProgress): LocalFeature {
    const completedSteps = progress.steps.filter((s) => s.status === 'completed').length
    const totalSteps = progress.steps.length

    return {
      name: progress.feature,
      phase: progress.currentPhase,
      progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      lastUpdated: progress.lastUpdated,
    }
  }

  private createProvider(providerName: string): ProjectProvider | null {
    switch (providerName) {
      case 'clickup':
        return createClickUpProvider()
      default:
        return null
    }
  }

  async run(featureName: string | undefined, options: SyncOptions): Promise<void> {
    const integration = await getIntegrationConfig()

    if (!integration.provider) {
      console.log(chalk.yellow('No integration configured.'))
      console.log()
      console.log(chalk.gray('To configure: adk config integration <provider>'))
      return
    }

    if (!integration.enabled) {
      console.log(chalk.yellow('Integration is disabled.'))
      console.log()
      console.log(chalk.gray(`To enable: adk config integration ${integration.provider}`))
      return
    }

    const provider = this.createProvider(integration.provider)
    if (!provider) {
      console.log(chalk.red(`Unknown provider: ${integration.provider}`))
      return
    }

    const token = await this.getTokenFromEnv(integration.provider)
    if (!token) {
      console.log(chalk.red(`No token found for ${integration.provider}`))
      console.log()
      console.log(chalk.gray(`Please reconfigure: adk config integration ${integration.provider}`))
      return
    }

    const providerConfig = await getProviderConfig<ProviderSpecificConfig>(integration.provider)
    const connectionResult = await provider.connect({
      token,
      workspaceId: providerConfig?.workspaceId as string | undefined,
      spaceId: providerConfig?.spaceId as string | undefined,
      listId: providerConfig?.listId as string | undefined,
    })

    if (!connectionResult.success) {
      console.log(chalk.red(`Failed to connect: ${connectionResult.message}`))
      return
    }

    if (featureName) {
      await this.syncSingleFeature(featureName, provider, options)
    } else {
      await this.syncAllFeatures(provider, options)
    }
  }

  private async syncSingleFeature(
    featureName: string,
    provider: ProjectProvider,
    _options: SyncOptions
  ): Promise<void> {
    const featurePath = path.join(this.getFeaturesDir(), featureName)

    if (!(await fs.pathExists(featurePath))) {
      console.log(chalk.red(`Feature "${featureName}" not found.`))
      return
    }

    const progress = await this.loadFeatureProgress(featureName)
    if (!progress) {
      console.log(chalk.red(`No progress file found for "${featureName}".`))
      return
    }

    const spinner = ora(`Syncing ${featureName}...`).start()

    const localFeature = this.progressToLocalFeature(progress)

    try {
      const result = await provider.syncFeature(localFeature, progress.remoteId)
      await this.handleSyncResult(featureName, progress, result, spinner)
    } catch (error) {
      await this.queueFailedOperation(featureName, localFeature, progress.remoteId, error)
      progress.syncStatus = 'error'
      await this.saveFeatureProgress(featureName, progress)
      spinner.fail(
        `${featureName}: queued for retry - ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async queueFailedOperation(
    featureName: string,
    localFeature: LocalFeature,
    remoteId: string | undefined,
    error: unknown
  ): Promise<void> {
    const operation: QueuedOperation = {
      id: '',
      type: remoteId ? 'update' : 'create',
      feature: featureName,
      data: {
        phase: localFeature.phase,
        progress: localFeature.progress,
        remoteId,
      },
      createdAt: new Date().toISOString(),
      retries: 0,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    }

    await this.queue.enqueue(operation)
  }

  private async syncAllFeatures(provider: ProjectProvider, options: SyncOptions): Promise<void> {
    const features = await this.listFeatures()

    if (features.length === 0) {
      console.log(chalk.yellow('No features found.'))
      return
    }

    const summary: SyncSummary = { synced: 0, failed: 0, skipped: 0 }
    const spinner = ora('Syncing features...').start()

    for (const featureName of features) {
      const progress = await this.loadFeatureProgress(featureName)
      if (!progress) {
        summary.skipped++
        continue
      }

      if (!options.force && progress.syncStatus === 'synced') {
        summary.skipped++
        continue
      }

      spinner.text = `Syncing ${featureName}...`
      spinner.start()

      const localFeature = this.progressToLocalFeature(progress)
      const result = await provider.syncFeature(localFeature, progress.remoteId)

      if (result.status === 'synced') {
        progress.syncStatus = 'synced'
        progress.remoteId = result.remoteId
        progress.lastSynced = result.lastSynced
        await this.saveFeatureProgress(featureName, progress)
        summary.synced++
        spinner.succeed(`${featureName}: synced`)
      } else {
        progress.syncStatus = 'error'
        await this.saveFeatureProgress(featureName, progress)
        summary.failed++
        spinner.fail(`${featureName}: ${result.message}`)
      }

      spinner.start()
    }

    spinner.stop()

    console.log()
    console.log(chalk.bold('Sync Summary:'))
    console.log(`  ${chalk.green(`${summary.synced} synced`)}`)
    console.log(`  ${chalk.red(`${summary.failed} failed`)}`)
    console.log(`  ${chalk.gray(`${summary.skipped} skipped`)}`)
  }

  private async handleSyncResult(
    featureName: string,
    progress: SyncableProgress,
    result: SyncResult,
    spinner: ReturnType<typeof ora>
  ): Promise<void> {
    if (result.status === 'synced') {
      progress.syncStatus = 'synced'
      progress.remoteId = result.remoteId
      progress.lastSynced = result.lastSynced
      await this.saveFeatureProgress(featureName, progress)

      spinner.succeed(`${featureName}: synced to ${result.remoteUrl || result.remoteId}`)
    } else {
      progress.syncStatus = 'error'
      await this.saveFeatureProgress(featureName, progress)

      spinner.fail(`${featureName}: ${result.message}`)
    }
  }

  async processQueue(): Promise<ProcessQueueResult> {
    const integration = await getIntegrationConfig()
    const result: ProcessQueueResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
    }

    if (!integration.provider || !integration.enabled) {
      return result
    }

    const provider = this.createProvider(integration.provider)
    if (!provider) {
      return result
    }

    const token = await this.getTokenFromEnv(integration.provider)
    if (!token) {
      return result
    }

    const providerConfig = await getProviderConfig<ProviderSpecificConfig>(integration.provider)
    const connectionResult = await provider.connect({
      token,
      workspaceId: providerConfig?.workspaceId as string | undefined,
      spaceId: providerConfig?.spaceId as string | undefined,
      listId: providerConfig?.listId as string | undefined,
    })

    if (!connectionResult.success) {
      return result
    }

    await this.queue.load()
    const operations = await this.queue.getAll()

    for (const operation of operations) {
      result.processed++

      const progress = await this.loadFeatureProgress(operation.feature)
      if (!progress) {
        await this.queue.remove(operation.id)
        continue
      }

      const localFeature = this.progressToLocalFeature(progress)
      const remoteId = (operation.data as { remoteId?: string })?.remoteId

      try {
        const syncResult = await provider.syncFeature(localFeature, remoteId)

        if (syncResult.status === 'synced') {
          progress.syncStatus = 'synced'
          progress.remoteId = syncResult.remoteId
          progress.lastSynced = syncResult.lastSynced
          await this.saveFeatureProgress(operation.feature, progress)
          await this.queue.remove(operation.id)
          result.succeeded++
        } else {
          result.failed++
          if (operation.retries >= MAX_RETRIES) {
            await this.queue.remove(operation.id)
          } else {
            await this.queue.updateRetries(operation.id, operation.retries + 1, syncResult.message)
          }
        }
      } catch (error) {
        result.failed++
        if (operation.retries >= MAX_RETRIES) {
          await this.queue.remove(operation.id)
        } else {
          await this.queue.updateRetries(
            operation.id,
            operation.retries + 1,
            error instanceof Error ? error.message : 'Unknown error'
          )
        }
      }
    }

    result.remaining = await this.queue.getPendingCount()
    return result
  }

  async syncWithConflictCheck(
    featureName: string,
    _options: SyncOptions
  ): Promise<SyncWithConflictResult> {
    const featurePath = path.join(this.getFeaturesDir(), featureName)
    const result: SyncWithConflictResult = {
      success: false,
      conflicts: [],
      requiresManualResolution: false,
    }

    if (!(await fs.pathExists(featurePath))) {
      return result
    }

    const progress = await this.loadFeatureProgress(featureName)
    if (!progress) {
      return result
    }

    const integration = await getIntegrationConfig()
    if (!integration.provider || !integration.enabled) {
      return result
    }

    const provider = this.createProvider(integration.provider)
    if (!provider) {
      return result
    }

    const token = await this.getTokenFromEnv(integration.provider)
    if (!token) {
      return result
    }

    const providerConfig = await getProviderConfig<ProviderSpecificConfig>(integration.provider)
    const connectionResult = await provider.connect({
      token,
      workspaceId: providerConfig?.workspaceId as string | undefined,
      spaceId: providerConfig?.spaceId as string | undefined,
      listId: providerConfig?.listId as string | undefined,
    })

    if (!connectionResult.success) {
      return result
    }

    const localFeature = this.progressToLocalFeature(progress)

    if (!progress.remoteId) {
      const syncResult = await provider.syncFeature(localFeature, undefined)
      if (syncResult.status === 'synced') {
        progress.syncStatus = 'synced'
        progress.remoteId = syncResult.remoteId
        progress.lastSynced = syncResult.lastSynced
        await this.saveFeatureProgress(featureName, progress)
        result.success = true
        result.syncResult = syncResult
      }
      return result
    }

    const getFeature = (
      provider as ProjectProvider & { getFeature?: (id: string) => Promise<RemoteFeature | null> }
    ).getFeature
    if (!getFeature) {
      return result
    }

    const remoteFeature = await getFeature.call(provider, progress.remoteId)
    if (!remoteFeature) {
      const syncResult = await provider.syncFeature(localFeature, progress.remoteId)
      result.success = syncResult.status === 'synced'
      result.syncResult = syncResult
      return result
    }

    const conflicts = await detectConflicts(localFeature, remoteFeature)
    result.conflicts = conflicts

    if (conflicts.length === 0) {
      const syncResult = await provider.syncFeature(localFeature, progress.remoteId)
      result.success = syncResult.status === 'synced'
      result.syncResult = syncResult
      if (result.success) {
        progress.syncStatus = 'synced'
        progress.remoteId = syncResult.remoteId
        progress.lastSynced = syncResult.lastSynced
        await this.saveFeatureProgress(featureName, progress)
      }
      return result
    }

    const conflictStrategy = (integration.conflictStrategy || 'local-wins') as ConflictStrategy
    const resolution = await resolveConflicts(conflicts, conflictStrategy)
    result.resolution = resolution

    if (resolution.requiresManualResolution) {
      result.requiresManualResolution = true
      const report = createConflictReport(conflicts, resolution)
      const reportPath = path.join(featurePath, 'conflict-report.md')
      await fs.writeFile(reportPath, report)
      return result
    }

    if (conflictStrategy === 'remote-wins') {
      for (const resolved of resolution.resolvedConflicts) {
        if (resolved.winner === 'remote') {
          if (resolved.field === 'phase') {
            progress.currentPhase = resolved.value as string
          }
        }
      }
      await this.saveFeatureProgress(featureName, progress)
    }

    const featureToSync =
      conflictStrategy === 'remote-wins' ? this.progressToLocalFeature(progress) : localFeature

    const syncResult = await provider.syncFeature(featureToSync, progress.remoteId)
    result.success = syncResult.status === 'synced'
    result.syncResult = syncResult

    if (result.success) {
      progress.syncStatus = 'synced'
      progress.remoteId = syncResult.remoteId
      progress.lastSynced = syncResult.lastSynced
      await this.saveFeatureProgress(featureName, progress)
    }

    return result
  }
}

export const syncCommand = new SyncCommand()
