import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'

describe('Claude V3', () => {
  let mockSpawn: jest.MockedFunction<any>
  let mockSpawnSync: jest.MockedFunction<any>

  beforeEach(() => {
    jest.resetModules()
    mockSpawn = jest.fn()
    mockSpawnSync = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('parseSessionId', () => {
    it('should extract session ID correctly from output', async () => {
      const { parseSessionId } = await import('../../src/utils/claude-v3')

      const output = `
        Some output
        Session ID: abc-123-def-456
        More output
      `

      const sessionId = parseSessionId(output)
      expect(sessionId).toBe('abc-123-def-456')
    })

    it('should extract session ID case-insensitively', async () => {
      const { parseSessionId } = await import('../../src/utils/claude-v3')

      const output = 'session id: xyz-789-abc-012'

      const sessionId = parseSessionId(output)
      expect(sessionId).toBe('xyz-789-abc-012')
    })

    it('should return null if session ID not found', async () => {
      const { parseSessionId } = await import('../../src/utils/claude-v3')

      const output = 'No session ID here'

      const sessionId = parseSessionId(output)
      expect(sessionId).toBeNull()
    })
  })

  describe('executeClaudeCommandV3', () => {
    it('should use spawn asynchronously', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn,
        spawnSync: mockSpawnSync
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt')

      mockProcess.stdout.emit('data', Buffer.from('output'))
      mockProcess.emit('close', 0)

      await promise

      expect(mockSpawn).toHaveBeenCalled()
      expect(mockSpawnSync).not.toHaveBeenCalled()
    })

    it('should capture stdout', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt')

      mockProcess.stdout.emit('data', Buffer.from('test output'))
      mockProcess.emit('close', 0)

      const result = await promise

      expect(result.output).toContain('test output')
    })

    it('should capture stderr', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt')

      mockProcess.stderr.emit('data', Buffer.from('error message'))
      mockProcess.emit('close', 1)

      const result = await promise

      expect(result.exitCode).toBe(1)
    })

    it('should pass --print-session-id by default', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt')

      mockProcess.emit('close', 0)

      await promise

      const args = mockSpawn.mock.calls[0][1]
      expect(args).toContain('--print-session-id')
    })

    it('should pass --model when provided', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt', { model: 'opus' })

      mockProcess.emit('close', 0)

      await promise

      const args = mockSpawn.mock.calls[0][1]
      expect(args).toContain('--model')
      expect(args).toContain('opus')
    })

    it('should pass --resume when provided', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt', { resume: 'session-123' })

      mockProcess.emit('close', 0)

      await promise

      const args = mockSpawn.mock.calls[0][1]
      expect(args).toContain('--resume')
      expect(args).toContain('session-123')
    })

    it('should respect timeout', async () => {
      jest.useFakeTimers()

      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt', { timeout: 1000 })

      jest.advanceTimersByTime(1001)

      await expect(promise).rejects.toThrow('timed out')

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')

      jest.useRealTimers()
    })

    it('should return exitCode', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt')

      mockProcess.emit('close', 42)

      const result = await promise

      expect(result.exitCode).toBe(42)
    })

    it('should return duration', async () => {
      const mockProcess = createMockChildProcess()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt')

      await new Promise(resolve => setTimeout(resolve, 100))
      mockProcess.emit('close', 0)

      const result = await promise

      expect(result.duration).toBeGreaterThan(0)
    })

    it('should call onOutput callback', async () => {
      const mockProcess = createMockChildProcess()
      const onOutput = jest.fn()

      jest.doMock('node:child_process', () => ({
        spawn: mockSpawn
      }))

      mockSpawn.mockReturnValue(mockProcess)

      const { executeClaudeCommandV3 } = await import('../../src/utils/claude-v3')

      const promise = executeClaudeCommandV3('test prompt', { onOutput })

      mockProcess.stdout.emit('data', Buffer.from('chunk1'))
      mockProcess.stdout.emit('data', Buffer.from('chunk2'))
      mockProcess.emit('close', 0)

      await promise

      expect(onOutput).toHaveBeenCalledWith('chunk1')
      expect(onOutput).toHaveBeenCalledWith('chunk2')
    })
  })

  describe('isClaudeInstalledV3', () => {
    it('should detect Claude CLI when installed', async () => {
      jest.doMock('node:child_process', () => ({
        spawnSync: mockSpawnSync
      }))

      mockSpawnSync.mockReturnValue({ status: 0 })

      const { isClaudeInstalledV3 } = await import('../../src/utils/claude-v3')

      const result = isClaudeInstalledV3()

      expect(result).toBe(true)
      expect(mockSpawnSync).toHaveBeenCalledWith('which', ['claude'], { stdio: 'pipe' })
    })

    it('should return false when Claude CLI not installed', async () => {
      jest.doMock('node:child_process', () => ({
        spawnSync: mockSpawnSync
      }))

      mockSpawnSync.mockReturnValue({ status: 1 })

      const { isClaudeInstalledV3 } = await import('../../src/utils/claude-v3')

      const result = isClaudeInstalledV3()

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      jest.doMock('node:child_process', () => ({
        spawnSync: jest.fn(() => {
          throw new Error('Command failed')
        })
      }))

      const { isClaudeInstalledV3 } = await import('../../src/utils/claude-v3')

      const result = isClaudeInstalledV3()

      expect(result).toBe(false)
    })
  })
})

function createMockChildProcess(): ChildProcess & EventEmitter {
  const emitter = new EventEmitter()

  return Object.assign(emitter, {
    stdin: {
      write: jest.fn(),
      end: jest.fn()
    },
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: jest.fn()
  }) as any
}
