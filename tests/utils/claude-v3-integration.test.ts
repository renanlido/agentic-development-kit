import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'
import type { SessionInfoV3 } from '../../src/types/session-v3'

describe('Claude V3 Integration', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-v3-integration-test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('Session lifecycle', () => {
    it('should create and retrieve session', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      const session: SessionInfoV3 = {
        id: 'session-test',
        claudeSessionId: 'claude-123',
        feature: 'test-feature',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: true,
        metadata: {
          model: 'sonnet',
          exitCode: 0,
          duration: 5000,
        },
      }

      await sessionStore.save('test-feature', session)
      const retrieved = await sessionStore.get('test-feature')

      expect(retrieved).toEqual(session)
    })

    it('should detect resumability within 24h', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      const recentSession: SessionInfoV3 = {
        id: 'recent',
        claudeSessionId: 'claude-recent',
        feature: 'recent-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: true,
      }

      await sessionStore.save('recent-test', recentSession)
      const isResumable = await sessionStore.isResumable('recent-test')

      expect(isResumable).toBe(true)
    })

    it('should reject resumability after 24h', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      const oldDate = new Date()
      oldDate.setHours(oldDate.getHours() - 25)

      const oldSession: SessionInfoV3 = {
        id: 'old',
        claudeSessionId: 'claude-old',
        feature: 'old-test',
        startedAt: oldDate.toISOString(),
        lastActivity: oldDate.toISOString(),
        status: 'active',
        resumable: true,
      }

      await sessionStore.save('old-test', oldSession)
      const isResumable = await sessionStore.isResumable('old-test')

      expect(isResumable).toBe(false)
    })

    it('should maintain session history', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      for (let i = 1; i <= 3; i++) {
        await sessionStore.save('history-test', {
          id: `session-${i}`,
          claudeSessionId: `claude-${i}`,
          feature: 'history-test',
          startedAt: new Date(Date.now() - i * 1000).toISOString(),
          lastActivity: new Date(Date.now() - i * 1000).toISOString(),
          status: 'completed',
          resumable: false,
        })
      }

      const sessions = await sessionStore.list('history-test')

      expect(sessions.length).toBeGreaterThanOrEqual(3)
      expect(sessions[0].id).toBe('session-1')
    })

    it('should update lastActivity on session update', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      const oldTime = '2026-01-20T10:00:00Z'
      await sessionStore.save('update-test', {
        id: 'session-update',
        claudeSessionId: 'claude-update',
        feature: 'update-test',
        startedAt: oldTime,
        lastActivity: oldTime,
        status: 'active',
        resumable: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await sessionStore.update('update-test', 'session-update', {
        status: 'completed',
      })

      const updated = await sessionStore.get('update-test')

      expect(updated?.lastActivity).not.toBe(oldTime)
      expect(updated?.status).toBe('completed')
    })

    it('should preserve startedAt across updates', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      const startTime = '2026-01-20T10:00:00Z'
      await sessionStore.save('preserve-test', {
        id: 'session-preserve',
        claudeSessionId: 'claude-preserve',
        feature: 'preserve-test',
        startedAt: startTime,
        lastActivity: startTime,
        status: 'active',
        resumable: true,
      })

      await sessionStore.update('preserve-test', 'session-preserve', {
        status: 'completed',
      })

      const updated = await sessionStore.get('preserve-test')

      expect(updated?.startedAt).toBe(startTime)
    })
  })
})
