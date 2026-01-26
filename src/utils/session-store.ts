import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import type { SessionInfoV3 } from '../types/session-v3.js'

export class SessionStore {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  getSessionsPath(feature: string): string {
    return path.join(
      this.getBasePath(),
      '.claude', 'plans', 'features', feature, 'sessions'
    )
  }

  async save(feature: string, session: SessionInfoV3): Promise<void> {
    const sessionsPath = this.getSessionsPath(feature)
    await fs.ensureDir(sessionsPath)

    const currentPath = path.join(sessionsPath, 'current.json')
    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)

    await fs.writeJSON(tempPath, session, { spaces: 2 })
    await fs.move(tempPath, currentPath, { overwrite: true })

    const historyDir = path.join(sessionsPath, 'history')
    await fs.ensureDir(historyDir)
    const historyPath = path.join(historyDir, `${session.id}.json`)
    await fs.copy(currentPath, historyPath)
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

    return sessions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  }

  async update(
    feature: string,
    sessionId: string,
    updates: Partial<SessionInfoV3>
  ): Promise<void> {
    const current = await this.get(feature)

    if (!current || current.id !== sessionId) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const updated: SessionInfoV3 = {
      ...current,
      ...updates,
      id: current.id,
      startedAt: current.startedAt,
      lastActivity: new Date().toISOString()
    }

    await this.save(feature, updated)
  }

  async clear(feature: string): Promise<void> {
    const currentPath = path.join(this.getSessionsPath(feature), 'current.json')

    if (await fs.pathExists(currentPath)) {
      await fs.remove(currentPath)
    }
  }

  async isResumable(feature: string): Promise<boolean> {
    const session = await this.get(feature)

    if (!session || !session.resumable) {
      return false
    }

    const lastActivity = new Date(session.lastActivity)
    const hoursSinceActivity =
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)

    return hoursSinceActivity < 24
  }
}

export const sessionStore = new SessionStore()
