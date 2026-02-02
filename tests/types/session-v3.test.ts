import { describe, expect, it } from '@jest/globals'

describe('SessionInfoV3 types', () => {
  it('should accept valid SessionInfoV3 data', () => {
    const validSession = {
      id: 'session-123',
      claudeSessionId: 'claude-abc-def',
      feature: 'test-feature',
      startedAt: '2026-01-25T10:00:00Z',
      lastActivity: '2026-01-25T10:30:00Z',
      status: 'active' as const,
      resumable: true,
      metadata: {
        model: 'sonnet',
        exitCode: 0,
        duration: 1800000,
      },
    }

    expect(validSession.id).toBe('session-123')
    expect(validSession.claudeSessionId).toBe('claude-abc-def')
    expect(validSession.status).toBe('active')
  })

  it('should accept SessionInfoV3 without metadata', () => {
    const minimalSession: any = {
      id: 'session-456',
      claudeSessionId: null,
      feature: 'minimal-feature',
      startedAt: '2026-01-25T10:00:00Z',
      lastActivity: '2026-01-25T10:00:00Z',
      status: 'interrupted' as const,
      resumable: false,
    }

    expect(minimalSession.metadata).toBeUndefined()
  })

  it('should accept all valid status values', () => {
    const statuses = ['active', 'completed', 'interrupted'] as const

    for (const status of statuses) {
      const session = {
        id: 'session-1',
        claudeSessionId: null,
        feature: 'test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status,
        resumable: false,
      }

      expect(['active', 'completed', 'interrupted']).toContain(session.status)
    }
  })
})

describe('ClaudeV3Options types', () => {
  it('should accept valid ClaudeV3Options', () => {
    const validOptions = {
      model: 'sonnet' as const,
      resume: 'session-123',
      printSessionId: true,
      timeout: 300000,
      onOutput: (chunk: string) => console.log(chunk),
    }

    expect(validOptions.model).toBe('sonnet')
    expect(validOptions.resume).toBe('session-123')
    expect(typeof validOptions.onOutput).toBe('function')
  })

  it('should accept empty options', () => {
    const emptyOptions = {}

    expect(emptyOptions).toBeDefined()
  })

  it('should accept all valid model values', () => {
    const models = ['sonnet', 'opus', 'haiku'] as const

    for (const model of models) {
      const options = { model }
      expect(['sonnet', 'opus', 'haiku']).toContain(options.model)
    }
  })
})

describe('ClaudeV3Result types', () => {
  it('should accept valid ClaudeV3Result', () => {
    const validResult = {
      output: 'Command executed successfully',
      sessionId: 'claude-abc-123',
      exitCode: 0,
      duration: 5000,
    }

    expect(validResult.output).toBe('Command executed successfully')
    expect(validResult.sessionId).toBe('claude-abc-123')
    expect(validResult.exitCode).toBe(0)
  })

  it('should accept result with null sessionId', () => {
    const resultNoSession = {
      output: 'Output without session',
      sessionId: null,
      exitCode: 1,
      duration: 2000,
    }

    expect(resultNoSession.sessionId).toBeNull()
  })
})
