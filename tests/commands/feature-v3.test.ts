import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import fs from 'fs-extra'

describe('FeatureV3Command', () => {
  let tempDir: string
  let FeatureV3Command: any

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-v3-test-'))
    process.env.TEST_FEATURE_PATH = tempDir

    jest.resetModules()

    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    const module = await import('../../src/commands/feature-v3')
    FeatureV3Command = module.featureV3Command
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  describe('status', () => {
    it('should display current session info', async () => {
      const featurePath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'test-feature'
      )

      await fs.ensureDir(featurePath)

      const { sessionStore } = await import('../../src/utils/session-store')

      await sessionStore.save('test-feature', {
        id: 'session-123',
        claudeSessionId: 'claude-abc-123',
        feature: 'test-feature',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: true,
        metadata: {
          model: 'sonnet',
          exitCode: 0,
          duration: 5000
        }
      })

      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      await FeatureV3Command.status('test-feature')

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n')

      expect(output).toContain('session-123')
      expect(output).toContain('claude-abc-123')
      expect(output).toContain('active')

      mockConsoleLog.mockRestore()
    })

    it('should display session history', async () => {
      const featurePath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'history-feature'
      )

      await fs.ensureDir(featurePath)

      const { sessionStore } = await import('../../src/utils/session-store')

      for (let i = 1; i <= 3; i++) {
        await sessionStore.save('history-feature', {
          id: `session-${i}`,
          claudeSessionId: `claude-${i}`,
          feature: 'history-feature',
          startedAt: new Date(Date.now() - i * 1000000).toISOString(),
          lastActivity: new Date(Date.now() - i * 1000000).toISOString(),
          status: 'completed',
          resumable: false
        })
      }

      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      await FeatureV3Command.status('history-feature')

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n')

      expect(output).toContain('Session History')

      mockConsoleLog.mockRestore()
    })

    it('should indicate if session is resumable', async () => {
      const featurePath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'resumable-feature'
      )

      await fs.ensureDir(featurePath)

      const { sessionStore } = await import('../../src/utils/session-store')

      await sessionStore.save('resumable-feature', {
        id: 'session-resumable',
        claudeSessionId: 'claude-resumable',
        feature: 'resumable-feature',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: true
      })

      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      await FeatureV3Command.status('resumable-feature')

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n')

      expect(output).toContain('Resumable')
      expect(output).toContain('Yes')

      mockConsoleLog.mockRestore()
    })

    it('should work without previous sessions', async () => {
      const featurePath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'empty-feature'
      )

      await fs.ensureDir(featurePath)

      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      await FeatureV3Command.status('empty-feature')

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n')

      expect(output).toContain('No active session')
      expect(output).toContain('No sessions recorded')

      mockConsoleLog.mockRestore()
    })

    it('should fail gracefully if feature does not exist', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any)

      await FeatureV3Command.status('non-existent-feature')

      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it('should display last activity timestamp', async () => {
      const featurePath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'timestamp-feature'
      )

      await fs.ensureDir(featurePath)

      const lastActivity = new Date('2026-01-25T15:30:00Z')

      const { sessionStore } = await import('../../src/utils/session-store')

      await sessionStore.save('timestamp-feature', {
        id: 'session-timestamp',
        claudeSessionId: 'claude-timestamp',
        feature: 'timestamp-feature',
        startedAt: lastActivity.toISOString(),
        lastActivity: lastActivity.toISOString(),
        status: 'active',
        resumable: true
      })

      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      await FeatureV3Command.status('timestamp-feature')

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n')

      expect(output).toContain('Last Activity')

      mockConsoleLog.mockRestore()
    })
  })
})
