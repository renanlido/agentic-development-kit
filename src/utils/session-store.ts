import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import type { SessionInfoV3 } from '../types/session-v3.js'

/**
 * Stores and retrieves Claude session information for features.
 * Provides atomic writes and 24-hour session resumability window.
 */
export class SessionStore {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  private validateFeatureName(feature: string): void {
    if (/[/\\]|\.\./.test(feature)) {
      throw new Error(`Invalid feature name: ${feature}`)
    }
  }

  getSessionsPath(feature: string): string {
    this.validateFeatureName(feature)
    return path.join(this.getBasePath(), '.claude', 'plans', 'features', feature, 'sessions')
  }

  /**
   * Saves session using atomic write pattern (temp file + move).
   * Also saves copy to history directory.
   */
  async save(feature: string, session: SessionInfoV3): Promise<void> {
    const sessionsPath = this.getSessionsPath(feature)
    await fs.ensureDir(sessionsPath)

    const currentPath = path.join(sessionsPath, 'current.json')
    const randomId = Math.random().toString(36).substring(2, 15)
    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}-${randomId}.json`)

    await fs.writeJSON(tempPath, session, { spaces: 2 })

    const historyDir = path.join(sessionsPath, 'history')
    await fs.ensureDir(historyDir)
    const historyPath = path.join(historyDir, `${session.id}.json`)
    await fs.copy(tempPath, historyPath)

    await fs.move(tempPath, currentPath, { overwrite: true })
  }

  async get(feature: string): Promise<SessionInfoV3 | null> {
    const currentPath = path.join(this.getSessionsPath(feature), 'current.json')

    if (!(await fs.pathExists(currentPath))) {
      return null
    }

    try {
      return await fs.readJSON(currentPath)
    } catch {
      return null
    }
  }

  async getLatest(feature: string): Promise<SessionInfoV3 | null> {
    return this.get(feature)
  }

  /**
   * Lists all sessions from history, ordered by startedAt (most recent first).
   * Ignores corrupted files.
   */
  async list(feature: string): Promise<SessionInfoV3[]> {
    const historyDir = path.join(this.getSessionsPath(feature), 'history')

    if (!(await fs.pathExists(historyDir))) {
      return []
    }

    const files = await fs.readdir(historyDir)
    const sessions: SessionInfoV3[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const session = await fs.readJSON(path.join(historyDir, file))
        sessions.push(session)
      } catch {
        // Ignore corrupted files
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  }

  /**
   * Updates existing session. Preserves id and startedAt, always updates lastActivity.
   * Throws if session not found or sessionId doesn't match current session.
   */
  async update(feature: string, sessionId: string, updates: Partial<SessionInfoV3>): Promise<void> {
    const current = await this.get(feature)

    if (!current || current.id !== sessionId) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const updated: SessionInfoV3 = {
      ...current,
      ...updates,
      id: current.id,
      startedAt: current.startedAt,
      lastActivity: new Date().toISOString(),
    }

    await this.save(feature, updated)
  }

  async clear(feature: string): Promise<void> {
    const currentPath = path.join(this.getSessionsPath(feature), 'current.json')

    if (await fs.pathExists(currentPath)) {
      await fs.remove(currentPath)
    }
  }

  /**
   * Checks if session is resumable based on:
   * 1. Session exists and resumable flag is true
   * 2. Last activity was less than 24 hours ago
   */
  async isResumable(feature: string): Promise<boolean> {
    const session = await this.get(feature)

    if (!session || !session.resumable) {
      return false
    }

    const lastActivity = new Date(session.lastActivity)
    const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)

    return hoursSinceActivity < 24
  }
}

export const sessionStore = new SessionStore()
