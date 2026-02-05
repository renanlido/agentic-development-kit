import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

// Mock everything at the top level to be safer with ESM
jest.mock('node:child_process')
jest.mock('fs-extra')
jest.mock('../../src/utils/session-store')
jest.mock('../../src/utils/memory/core-state')
jest.mock('../../src/utils/logger')

function createMockProcess() {
  const mockProcess = new EventEmitter() as any
  mockProcess.stdout = new EventEmitter()
  mockProcess.stderr = new EventEmitter()
  mockProcess.stdin = { write: jest.fn(), end: jest.fn() }
  mockProcess.kill = jest.fn()
  return mockProcess
}

describe('V3 Logic Integration', () => {
  let mockSpawn: any
  let sessionStore: any
  let coreStateManager: any
  
  beforeEach(() => {
    mockSpawn = require('node:child_process').spawn
    sessionStore = require('../../src/utils/session-store').sessionStore
    coreStateManager = require('../../src/utils/memory/core-state').coreStateManager
    
    // Default mocks
    sessionStore.get.mockResolvedValue(null)
    sessionStore.isResumable.mockResolvedValue(false)
    sessionStore.save.mockResolvedValue(undefined)
    coreStateManager.get.mockResolvedValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('should inject system prompt with anti-stub and core-state', async () => {
    const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')
    const mockProcess = createMockProcess()
    mockSpawn.mockReturnValue(mockProcess)
    
    coreStateManager.get.mockResolvedValue({
      currentTask: { id: 'task-1', status: 'in_progress', startedAt: '...' },
      sessionFiles: [],
      recentDecisions: [],
      constraints: ['NO_MOCKS'],
    })

    const promise = executeWithSessionTracking('feature-x', 'hello')
    
    // Wait for the async chain to reach spawn
    await new Promise(resolve => setTimeout(resolve, 10))
    
    mockProcess.stdout.emit('data', Buffer.from('Session ID: 123-456\nResponse here'))
    mockProcess.emit('close', 0)
    
    await promise
    
    expect(mockSpawn).toHaveBeenCalled()
    const args = mockSpawn.mock.calls[0][1]
    expect(args).toContain('--system-prompt')
    const systemPrompt = args[args.indexOf('--system-prompt') + 1]
    expect(systemPrompt).toContain('<anti-stub-protocol>')
    expect(systemPrompt).toContain('<core-state>')
    expect(systemPrompt).toContain('NO_MOCKS')
  })

  it('should retry if anti-stub validation fails', async () => {
    const { executeWithSessionTracking } = await import('../../src/utils/claude-v3')
    const mockProcess1 = createMockProcess()
    const mockProcess2 = createMockProcess()
    
    mockSpawn.mockReturnValueOnce(mockProcess1).mockReturnValueOnce(mockProcess2)

    const promise = executeWithSessionTracking('feature-x', 'hello')
    
    // First call
    await new Promise(resolve => setTimeout(resolve, 10))
    mockProcess1.stdout.emit('data', Buffer.from('Session ID: 123\n// TODO: implement this'))
    mockProcess1.emit('close', 0)
    
    // Second call
    await new Promise(resolve => setTimeout(resolve, 10))
    mockProcess2.stdout.emit('data', Buffer.from('Session ID: 123\nDone!'))
    mockProcess2.emit('close', 0)
    
    const result = await promise
    
    expect(mockSpawn).toHaveBeenCalledTimes(2)
    expect(result.output).toContain('Done!')
    
        const retryArgs = mockSpawn.mock.calls[1][1]
    
        expect(retryArgs).toContain('--resume')
    
        expect(retryArgs).toContain('123')
    
        
    
        // Check if the retry prompt was written to stdin
    
        expect(mockProcess2.stdin.write).toHaveBeenCalledWith(
    
          expect.stringContaining('Your previous response contained stub patterns')
    
        )
    
      })
    
    })
    
    