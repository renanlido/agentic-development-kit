import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { executeWithSessionTracking } from '../../src/utils/claude-v3.js'
import { sessionStore } from '../../src/utils/session-store.js'

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn(() => ({ status: 0 }))
}))

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

describe('Session Integration Tests', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-integration-test-'))
    process.env.TEST_FEATURE_PATH = tempDir

    const mockProcess: any = {
      stdin: { write: jest.fn(), end: jest.fn() },
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, callback: (code: number) => void): any => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10)
        }
        return mockProcess
      }),
      kill: jest.fn()
    }

    mockProcess.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void): any => {
      if (event === 'data') {
        setTimeout(() => {
          callback(Buffer.from('Session ID: abc-123-def\n'))
          callback(Buffer.from('Test output\n'))
        }, 5)
      }
      return mockProcess.stdout
    })

    mockProcess.stderr.on.mockImplementation(() => mockProcess.stderr)

    mockSpawn.mockReturnValue(mockProcess as any)
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
    jest.clearAllMocks()
  })

  describe('executeWithSessionTracking', () => {
    it('should save session after execution', async () => {
      const result = await executeWithSessionTracking(
        'test-feature',
        'Test prompt'
      )

      expect(result.sessionId).toBe('abc-123-def')
      expect(result.exitCode).toBe(0)

      const savedSession = await sessionStore.get('test-feature')
      expect(savedSession).toBeDefined()
      expect(savedSession?.claudeSessionId).toBe('abc-123-def')
      expect(savedSession?.feature).toBe('test-feature')
      expect(savedSession?.status).toBe('active')
      expect(savedSession?.resumable).toBe(true)
    })

    it('should resume session automatically when resumable', async () => {
      await executeWithSessionTracking('test-feature', 'First prompt')

      await executeWithSessionTracking('test-feature', 'Second prompt')

      expect(mockSpawn).toHaveBeenCalledTimes(2)
      const secondCall = mockSpawn.mock.calls[1]
      expect(secondCall[1]).toContain('--resume')
      expect(secondCall[1]).toContain('abc-123-def')
    })

    it('should not resume if session is not resumable', async () => {
      await executeWithSessionTracking(
        'test-feature',
        'First prompt'
      )

      const session = await sessionStore.get('test-feature')
      if (session) {
        await sessionStore.update('test-feature', session.id, {
          resumable: false
        })
      }

      await executeWithSessionTracking('test-feature', 'Second prompt')

      expect(mockSpawn).toHaveBeenCalledTimes(2)
      const secondCall = mockSpawn.mock.calls[1]
      expect(secondCall[1]).not.toContain('--resume')
    })

    it('should update lastActivity on subsequent executions', async () => {
      await executeWithSessionTracking('test-feature', 'First prompt')
      const firstSession = await sessionStore.get('test-feature')
      const firstActivity = firstSession?.lastActivity

      await new Promise(resolve => setTimeout(resolve, 100))

      await executeWithSessionTracking('test-feature', 'Second prompt')
      const secondSession = await sessionStore.get('test-feature')
      const secondActivity = secondSession?.lastActivity

      expect(secondActivity).toBeDefined()
      expect(firstActivity).toBeDefined()
      expect(new Date(secondActivity!).getTime()).toBeGreaterThan(
        new Date(firstActivity!).getTime()
      )
    })

    it('should mark session as interrupted on non-zero exit code', async () => {
      const mockProcessWithError: any = {
        stdin: { write: jest.fn(), end: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event: string, callback: (code: number) => void): any => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10)
          }
          return mockProcessWithError
        }),
        kill: jest.fn()
      }

      mockProcessWithError.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void): any => {
        if (event === 'data') {
          setTimeout(() => {
            callback(Buffer.from('Session ID: error-session\n'))
          }, 5)
        }
        return mockProcessWithError.stdout
      })

      mockProcessWithError.stderr.on.mockImplementation(() => mockProcessWithError.stderr)

      mockSpawn.mockReturnValue(mockProcessWithError as any)

      const result = await executeWithSessionTracking(
        'test-feature-error',
        'Test prompt'
      )

      expect(result.exitCode).toBe(1)

      const savedSession = await sessionStore.get('test-feature-error')
      expect(savedSession?.status).toBe('interrupted')
    })

    it('should preserve startedAt across multiple executions', async () => {
      await executeWithSessionTracking('test-feature', 'First prompt')
      const firstSession = await sessionStore.get('test-feature')
      const originalStartedAt = firstSession?.startedAt

      await new Promise(resolve => setTimeout(resolve, 100))

      await executeWithSessionTracking('test-feature', 'Second prompt')
      const secondSession = await sessionStore.get('test-feature')

      expect(secondSession?.startedAt).toBe(originalStartedAt)
    })

    it('should preserve session ID across multiple executions', async () => {
      await executeWithSessionTracking('test-feature', 'First prompt')
      const firstSession = await sessionStore.get('test-feature')
      const originalSessionId = firstSession?.id

      await new Promise(resolve => setTimeout(resolve, 100))

      await executeWithSessionTracking('test-feature', 'Second prompt')
      const secondSession = await sessionStore.get('test-feature')

      expect(secondSession?.id).toBe(originalSessionId)
      expect(secondSession?.id).toBeDefined()
      expect(secondSession?.id).not.toBeNull()
    })

    it('should store execution metadata', async () => {
      await executeWithSessionTracking('test-feature', 'Test prompt', {
        model: 'opus'
      })

      const savedSession = await sessionStore.get('test-feature')
      expect(savedSession?.metadata).toBeDefined()
      expect(savedSession?.metadata?.model).toBe('opus')
      expect(savedSession?.metadata?.exitCode).toBe(0)
      expect(savedSession?.metadata?.duration).toBeGreaterThan(0)
    })
  })

  describe('Session recovery after interruption', () => {
    it('should be able to resume after process interruption', async () => {
      const firstResult = await executeWithSessionTracking(
        'test-feature',
        'First prompt'
      )

      expect(firstResult.sessionId).toBe('abc-123-def')

      const savedSession = await sessionStore.get('test-feature')
      expect(savedSession?.resumable).toBe(true)

      const secondResult = await executeWithSessionTracking(
        'test-feature',
        'Resume prompt'
      )

      expect(secondResult.sessionId).toBe('abc-123-def')

      const spawnCalls = mockSpawn.mock.calls
      expect(spawnCalls.length).toBe(2)
      expect(spawnCalls[1][1]).toContain('--resume')
      expect(spawnCalls[1][1]).toContain('abc-123-def')
    })

    it('should not resume if session is older than 24 hours', async () => {
      await executeWithSessionTracking('test-feature', 'First prompt')

      const session = await sessionStore.get('test-feature')
      if (session) {
        const oldDate = new Date()
        oldDate.setHours(oldDate.getHours() - 25)

        const oldSession = {
          ...session,
          lastActivity: oldDate.toISOString()
        }
        await sessionStore.save('test-feature', oldSession)
      }

      const isResumable = await sessionStore.isResumable('test-feature')
      expect(isResumable).toBe(false)

      await executeWithSessionTracking('test-feature', 'New prompt')

      const secondCall = mockSpawn.mock.calls[1]
      expect(secondCall[1]).not.toContain('--resume')
    })
  })
})
