import fs from 'fs-extra'
import path from 'node:path'
import type {
  ProgressSyncResult,
  SyncPreview,
  ProgressConflictStrategy,
  Change,
} from '../types/progress-sync'
import { StateManager } from './state-manager'
import { HistoryTracker } from './history-tracker'
import { SnapshotManager } from './snapshot-manager'
import { detectInconsistencies, resolveInconsistencies } from './progress-conflict'

export interface SyncEngineOptions {
  strategy?: ProgressConflictStrategy
}

export interface SyncOptions {
  strategy?: ProgressConflictStrategy
}

export class SyncEngine {
  private stateManager: StateManager
  private historyTracker: HistoryTracker
  private snapshotManager: SnapshotManager
  private defaultStrategy: ProgressConflictStrategy

  constructor(options: SyncEngineOptions = {}) {
    this.stateManager = new StateManager()
    this.historyTracker = new HistoryTracker()
    this.snapshotManager = new SnapshotManager()
    this.defaultStrategy = options.strategy || 'merge'
  }

  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  private getFeaturePath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature)
  }

  async sync(feature: string, options: SyncOptions = {}): Promise<ProgressSyncResult> {
    const startTime = Date.now()
    const strategy = options.strategy || this.defaultStrategy
    const changesApplied: Change[] = []
    let snapshotCreated: string | undefined

    try {
      const state = await this.stateManager.loadUnifiedState(feature)
      const inconsistencies = detectInconsistencies(state)

      if (inconsistencies.length > 0 || strategy !== 'merge') {
        snapshotCreated = await this.snapshotManager.createSnapshot(feature, 'pre-sync')
      }

      const resolution = resolveInconsistencies(state, inconsistencies, strategy)
      changesApplied.push(...resolution.changes)

      if (resolution.applied && resolution.changes.length > 0) {
        await this.stateManager.saveUnifiedState(feature, state)
      }

      const featurePath = this.getFeaturePath(feature)

      if (await fs.pathExists(featurePath)) {
        await this.historyTracker.recordTransition(feature, {
          timestamp: new Date().toISOString(),
          fromPhase: state.currentPhase,
          toPhase: state.currentPhase,
          trigger: 'sync',
        })
      }

      const duration = Date.now() - startTime

      return {
        success: true,
        changesApplied,
        inconsistenciesResolved: inconsistencies.length,
        snapshotCreated,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        changesApplied: [],
        inconsistenciesResolved: 0,
        duration,
      }
    }
  }

  async dryRun(feature: string): Promise<SyncPreview> {
    const state = await this.stateManager.loadUnifiedState(feature)
    const inconsistencies = detectInconsistencies(state)

    const resolution = resolveInconsistencies(
      { ...state, tasks: state.tasks.map(t => ({ ...t })) },
      inconsistencies,
      this.defaultStrategy
    )

    return {
      changes: resolution.changes,
      inconsistencies,
    }
  }
}
