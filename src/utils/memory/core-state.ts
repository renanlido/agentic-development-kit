import path from 'node:path'
import fs from 'fs-extra'
import type { CoreState } from '../../types/session-v3.js'

/**
 * Manages the Core State (Tier 1 Memory) for ADK v3.
 * Core State is a lightweight JSON that tracks the immediate context
 * of a session to prevent context drift.
 */
export class CoreStateManager {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  private getCoreStatePath(feature: string): string {
    return path.join(
      this.getBasePath(),
      '.claude',
      'plans',
      'features',
      feature,
      'memory',
      'core-state.json'
    )
  }

  /**
   * Initializes or loads the core state for a feature.
   */
  async get(feature: string): Promise<CoreState | null> {
    const filePath = this.getCoreStatePath(feature)

    if (!(await fs.pathExists(filePath))) {
      return null
    }

    try {
      return await fs.readJSON(filePath)
    } catch {
      return null
    }
  }

  /**
   * Saves the core state for a feature.
   */
  async save(feature: string, state: CoreState): Promise<void> {
    const filePath = this.getCoreStatePath(feature)
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeJSON(filePath, state, { spaces: 2 })
  }

  /**
   * Updates specific fields in the core state.
   */
  async update(feature: string, updates: Partial<CoreState>): Promise<CoreState> {
    const current = (await this.get(feature)) || this.getDefaultState()
    const updated = { ...current, ...updates }
    await this.save(feature, updated)
    return updated
  }

  /**
   * Logs a new decision, keeping only the last 5.
   */
  async addDecision(feature: string, decision: string): Promise<void> {
    const current = (await this.get(feature)) || this.getDefaultState()
    const decisions = [decision, ...current.recentDecisions].slice(0, 5)
    await this.update(feature, { recentDecisions: decisions })
  }

  /**
   * Tracks a file operation in the session.
   */
  async trackFile(
    feature: string,
    filePath: string,
    operation: CoreState['sessionFiles'][0]['operation']
  ): Promise<void> {
    const current = (await this.get(feature)) || this.getDefaultState()
    const sessionFiles = [
      {
        path: filePath,
        operation,
        lastModified: new Date().toISOString(),
      },
      ...current.sessionFiles.filter((f) => f.path !== filePath),
    ].slice(0, 10) // Keep last 10 files for context

    await this.update(feature, { sessionFiles })
  }

  private getDefaultState(): CoreState {
    return {
      currentTask: {
        id: 'unassigned',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      },
      sessionFiles: [],
      recentDecisions: [],
      constraints: [],
    }
  }
}

export const coreStateManager = new CoreStateManager()
