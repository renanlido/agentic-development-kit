import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import type { TransitionEntry } from '../types/progress-sync'

const MAX_HISTORY_ENTRIES = 50

/**
 * Tracks phase transitions for audit trail and historical queries.
 *
 * Records all phase changes in history.json with timestamp, trigger,
 * and duration. Auto-prunes to keep last 50 entries. Thread-safe with
 * mutex for concurrent operations.
 */
export class HistoryTracker {
  private locks: Map<string, Promise<void>> = new Map()

  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  getHistoryPath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature, 'history.json')
  }

  private generateTempPath(): string {
    const uniqueId = crypto.randomBytes(8).toString('hex')
    return path.join(os.tmpdir(), `history-${Date.now()}-${uniqueId}.json`)
  }

  private async withLock<T>(feature: string, fn: () => Promise<T>): Promise<T> {
    const existingLock = this.locks.get(feature)

    let resolve: () => void
    const newLock = new Promise<void>((r) => {
      resolve = r
    })
    this.locks.set(feature, newLock)

    if (existingLock) {
      await existingLock
    }

    try {
      return await fn()
    } finally {
      resolve?.()
      if (this.locks.get(feature) === newLock) {
        this.locks.delete(feature)
      }
    }
  }

  async recordTransition(feature: string, entry: TransitionEntry): Promise<void> {
    return this.withLock(feature, async () => {
      const historyPath = this.getHistoryPath(feature)
      await fs.ensureDir(path.dirname(historyPath))

      const history = await this.getHistory(feature)
      history.push(entry)

      if (history.length > MAX_HISTORY_ENTRIES) {
        history.splice(0, history.length - MAX_HISTORY_ENTRIES)
      }

      const tempPath = this.generateTempPath()
      await fs.writeJSON(tempPath, history, { spaces: 2 })
      await fs.move(tempPath, historyPath, { overwrite: true })
    })
  }

  async getHistory(feature: string, limit?: number): Promise<TransitionEntry[]> {
    const historyPath = this.getHistoryPath(feature)

    if (!(await fs.pathExists(historyPath))) {
      return []
    }

    try {
      const history = await fs.readJSON(historyPath)
      if (!Array.isArray(history)) {
        return []
      }

      if (limit && limit > 0) {
        return history.slice(-limit)
      }

      return history
    } catch {
      return []
    }
  }

  async pruneHistory(feature: string, keepCount: number): Promise<number> {
    return this.withLock(feature, async () => {
      const history = await this.getHistory(feature)

      if (history.length <= keepCount) {
        return 0
      }

      const removed = history.length - keepCount
      const prunedHistory = history.slice(-keepCount)

      const historyPath = this.getHistoryPath(feature)
      const tempPath = this.generateTempPath()
      await fs.writeJSON(tempPath, prunedHistory, { spaces: 2 })
      await fs.move(tempPath, historyPath, { overwrite: true })

      return removed
    })
  }
}
