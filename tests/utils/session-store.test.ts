import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'

describe('SessionStore', () => {
  let tempDir: string
  let SessionStore: any

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-store-test-'))
    process.env.TEST_FEATURE_PATH = tempDir

    jest.resetModules()
    const module = await import('../../src/utils/session-store')
    SessionStore = module.SessionStore
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('save', () => {
    it('should persist session to current.json', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-1',
        claudeSessionId: 'claude-123',
        feature: 'test-feature',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('test-feature', session)

      const savedPath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'test-feature', 'sessions', 'current.json'
      )

      expect(await fs.pathExists(savedPath)).toBe(true)

      const saved = await fs.readJSON(savedPath)
      expect(saved).toEqual(session)
    })

    it('should use atomic write pattern', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-2',
        claudeSessionId: 'claude-456',
        feature: 'atomic-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('atomic-test', session)

      const currentPath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'atomic-test', 'sessions', 'current.json'
      )

      expect(await fs.pathExists(currentPath)).toBe(true)
    })

    it('should copy to history directory', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-3',
        claudeSessionId: 'claude-789',
        feature: 'history-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('history-test', session)

      const historyPath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'history-test', 'sessions', 'history', 'session-3.json'
      )

      expect(await fs.pathExists(historyPath)).toBe(true)
    })
  })

  describe('get', () => {
    it('should return existing session', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-4',
        claudeSessionId: 'claude-get-test',
        feature: 'get-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('get-test', session)
      const retrieved = await store.get('get-test')

      expect(retrieved).toEqual(session)
    })

    it('should return null when session does not exist', async () => {
      const store = new SessionStore()
      const result = await store.get('non-existent')

      expect(result).toBeNull()
    })

    it('should return null for corrupted session file', async () => {
      const store = new SessionStore()
      const sessionsPath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'corrupted', 'sessions'
      )

      await fs.ensureDir(sessionsPath)
      await fs.writeFile(
        path.join(sessionsPath, 'current.json'),
        'invalid json {'
      )

      const result = await store.get('corrupted')
      expect(result).toBeNull()
    })
  })

  describe('getLatest', () => {
    it('should return current session', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-5',
        claudeSessionId: 'claude-latest',
        feature: 'latest-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('latest-test', session)
      const latest = await store.getLatest('latest-test')

      expect(latest).toEqual(session)
    })
  })

  describe('list', () => {
    it('should return history ordered by date descending', async () => {
      const store = new SessionStore()

      const session1 = {
        id: 'session-old',
        claudeSessionId: 'claude-old',
        feature: 'list-test',
        startedAt: '2026-01-20T10:00:00Z',
        lastActivity: '2026-01-20T10:00:00Z',
        status: 'completed' as const,
        resumable: false
      }

      const session2 = {
        id: 'session-new',
        claudeSessionId: 'claude-new',
        feature: 'list-test',
        startedAt: '2026-01-25T10:00:00Z',
        lastActivity: '2026-01-25T10:00:00Z',
        status: 'active' as const,
        resumable: true
      }

      await store.save('list-test', session1)
      await new Promise(resolve => setTimeout(resolve, 10))
      await store.save('list-test', session2)

      const sessions = await store.list('list-test')

      expect(sessions.length).toBeGreaterThan(0)
      expect(sessions[0].id).toBe('session-new')
    })

    it('should ignore corrupted files in history', async () => {
      const store = new SessionStore()
      const historyDir = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'corrupted-list', 'sessions', 'history'
      )

      await fs.ensureDir(historyDir)
      await fs.writeFile(path.join(historyDir, 'corrupted.json'), 'invalid json')

      const validSession = {
        id: 'session-valid',
        claudeSessionId: 'claude-valid',
        feature: 'corrupted-list',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await fs.writeJSON(path.join(historyDir, 'valid.json'), validSession)

      const sessions = await store.list('corrupted-list')

      expect(sessions.length).toBe(1)
      expect(sessions[0].id).toBe('session-valid')
    })

    it('should return empty array when no history', async () => {
      const store = new SessionStore()
      const sessions = await store.list('no-history')

      expect(sessions).toEqual([])
    })
  })

  describe('update', () => {
    it('should update existing session', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-update',
        claudeSessionId: 'claude-update',
        feature: 'update-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('update-test', session)
      await store.update('update-test', 'session-update', {
        status: 'completed'
      })

      const updated = await store.get('update-test')
      expect(updated?.status).toBe('completed')
    })

    it('should throw error if session not found', async () => {
      const store = new SessionStore()

      await expect(
        store.update('non-existent', 'session-x', { status: 'completed' })
      ).rejects.toThrow('Session session-x not found')
    })

    it('should throw error if session ID does not match', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-mismatch',
        claudeSessionId: 'claude-mismatch',
        feature: 'mismatch-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('mismatch-test', session)

      await expect(
        store.update('mismatch-test', 'wrong-id', { status: 'completed' })
      ).rejects.toThrow('Session wrong-id not found')
    })

    it('should update lastActivity timestamp', async () => {
      const store = new SessionStore()
      const oldTimestamp = '2026-01-20T10:00:00Z'
      const session = {
        id: 'session-timestamp',
        claudeSessionId: 'claude-timestamp',
        feature: 'timestamp-test',
        startedAt: oldTimestamp,
        lastActivity: oldTimestamp,
        status: 'active' as const,
        resumable: true
      }

      await store.save('timestamp-test', session)
      await new Promise(resolve => setTimeout(resolve, 10))
      await store.update('timestamp-test', 'session-timestamp', {})

      const updated = await store.get('timestamp-test')
      expect(updated?.lastActivity).not.toBe(oldTimestamp)
    })
  })

  describe('clear', () => {
    it('should remove current session', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-clear',
        claudeSessionId: 'claude-clear',
        feature: 'clear-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('clear-test', session)
      await store.clear('clear-test')

      const result = await store.get('clear-test')
      expect(result).toBeNull()
    })

    it('should not throw if session does not exist', async () => {
      const store = new SessionStore()

      await expect(store.clear('non-existent')).resolves.not.toThrow()
    })
  })

  describe('isResumable', () => {
    it('should return true if session is resumable and < 24h old', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-resumable',
        claudeSessionId: 'claude-resumable',
        feature: 'resumable-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('resumable-test', session)
      const result = await store.isResumable('resumable-test')

      expect(result).toBe(true)
    })

    it('should return false if session is > 24h old', async () => {
      const store = new SessionStore()
      const oldDate = new Date()
      oldDate.setHours(oldDate.getHours() - 25)

      const session = {
        id: 'session-old',
        claudeSessionId: 'claude-old',
        feature: 'old-test',
        startedAt: oldDate.toISOString(),
        lastActivity: oldDate.toISOString(),
        status: 'active' as const,
        resumable: true
      }

      await store.save('old-test', session)
      const result = await store.isResumable('old-test')

      expect(result).toBe(false)
    })

    it('should return false if session is not resumable', async () => {
      const store = new SessionStore()
      const session = {
        id: 'session-not-resumable',
        claudeSessionId: null,
        feature: 'not-resumable-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'interrupted' as const,
        resumable: false
      }

      await store.save('not-resumable-test', session)
      const result = await store.isResumable('not-resumable-test')

      expect(result).toBe(false)
    })

    it('should return false if no session exists', async () => {
      const store = new SessionStore()
      const result = await store.isResumable('no-session')

      expect(result).toBe(false)
    })
  })
})
