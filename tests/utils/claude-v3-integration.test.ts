import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import fs from 'fs-extra'

describe('Claude V3 Integration', () => {
  let tempDir: string
  let mockExecuteClaudeCommandV3: jest.MockedFunction<any>

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-v3-integration-test-'))
    process.env.TEST_FEATURE_PATH = tempDir

    jest.resetModules()

    mockExecuteClaudeCommandV3 = jest.fn()

    jest.doMock('../../src/utils/claude-v3', () => ({
      executeClaudeCommandV3: mockExecuteClaudeCommandV3
    }))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
    jest.clearAllMocks()
  })

  describe('executeWithSessionTracking', () => {
    it('should save session after execution', async () => {
      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'Success',
        sessionId: 'claude-session-123',
        exitCode: 0,
        duration: 5000
      })

      const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')

      await executeWithSessionTracking('test-feature', 'test prompt')

      const { sessionStore } = await import('../../src/utils/session-store')
      const session = await sessionStore.get('test-feature')

      expect(session).not.toBeNull()
      expect(session?.claudeSessionId).toBe('claude-session-123')
      expect(session?.feature).toBe('test-feature')
    })

    it('should resume session automatically if resumable', async () => {
      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'First execution',
        sessionId: 'claude-session-abc',
        exitCode: 0,
        duration: 3000
      })

      const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')
      const { sessionStore } = await import('../../src/utils/session-store')

      await executeWithSessionTracking('resumable-test', 'first prompt')

      mockExecuteClaudeCommandV3.mockClear()
      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'Second execution',
        sessionId: 'claude-session-abc',
        exitCode: 0,
        duration: 2000
      })

      await executeWithSessionTracking('resumable-test', 'second prompt')

      expect(mockExecuteClaudeCommandV3).toHaveBeenCalledWith(
        'second prompt',
        expect.objectContaining({
          resume: 'claude-session-abc'
        })
      )
    })

    it('should not resume if session is not resumable', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      await sessionStore.save('not-resumable', {
        id: 'session-1',
        claudeSessionId: 'claude-old',
        feature: 'not-resumable',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: false
      })

      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'New execution',
        sessionId: 'claude-new',
        exitCode: 0,
        duration: 1000
      })

      const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')

      await executeWithSessionTracking('not-resumable', 'new prompt')

      expect(mockExecuteClaudeCommandV3).toHaveBeenCalledWith(
        'new prompt',
        expect.not.objectContaining({
          resume: expect.anything()
        })
      )
    })

    it('should update lastActivity after execution', async () => {
      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'Success',
        sessionId: 'claude-activity',
        exitCode: 0,
        duration: 2000
      })

      const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')

      const startTime = new Date()

      await new Promise(resolve => setTimeout(resolve, 100))

      await executeWithSessionTracking('activity-test', 'test prompt')

      const { sessionStore } = await import('../../src/utils/session-store')
      const session = await sessionStore.get('activity-test')

      const lastActivity = new Date(session?.lastActivity || '')

      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(startTime.getTime())
    })

    it('should mark as interrupted if exitCode is not 0', async () => {
      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'Error occurred',
        sessionId: 'claude-error',
        exitCode: 1,
        duration: 1000
      })

      const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')

      await executeWithSessionTracking('error-test', 'failing prompt')

      const { sessionStore } = await import('../../src/utils/session-store')
      const session = await sessionStore.get('error-test')

      expect(session?.status).toBe('interrupted')
    })

    it('should preserve startedAt in continuous sessions', async () => {
      const initialStartTime = '2026-01-20T10:00:00Z'

      const { sessionStore } = await import('../../src/utils/session-store')

      await sessionStore.save('continuous-test', {
        id: 'session-initial',
        claudeSessionId: 'claude-continuous',
        feature: 'continuous-test',
        startedAt: initialStartTime,
        lastActivity: initialStartTime,
        status: 'active',
        resumable: true
      })

      mockExecuteClaudeCommandV3.mockResolvedValue({
        output: 'Continued execution',
        sessionId: 'claude-continuous',
        exitCode: 0,
        duration: 3000
      })

      const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')

      await executeWithSessionTracking('continuous-test', 'continue prompt')

      const updated = await sessionStore.get('continuous-test')

      expect(updated?.startedAt).toBe(initialStartTime)
    })
  })
})
