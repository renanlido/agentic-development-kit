import { ParallelDisplayManager } from '../../src/utils/parallel-display'
import type { StreamEvent } from '../../src/types/stream-events'

describe('ParallelDisplayManager', () => {
  let originalStdout: typeof process.stdout.write
  let originalIsTTY: boolean | undefined
  let outputBuffer: string[]

  beforeEach(() => {
    outputBuffer = []
    originalStdout = process.stdout.write
    originalIsTTY = process.stdout.isTTY
    process.stdout.write = ((chunk: string) => {
      outputBuffer.push(chunk)
      return true
    }) as typeof process.stdout.write
  })

  afterEach(() => {
    process.stdout.write = originalStdout
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    })
  })

  describe('registerAgent', () => {
    it('should register agents with incremental IDs', () => {
      const display = new ParallelDisplayManager()

      const id1 = display.registerAgent('1.1', 'First task')
      const id2 = display.registerAgent('1.2', 'Second task')
      const id3 = display.registerAgent('1.3', 'Third task')

      expect(id1).toBe('agent-1')
      expect(id2).toBe('agent-2')
      expect(id3).toBe('agent-3')
    })
  })

  describe('extractActionFromEvent', () => {
    it('should extract Read tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/file.ts' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('📖 .../to/file.ts')
    })

    it('should extract Write tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Write',
              input: { file_path: '/path/to/output.ts' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('✏️ .../to/output.ts')
    })

    it('should extract Edit tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: { file_path: '/src/component.tsx' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('📝 .../src/component.tsx')
    })

    it('should extract Bash tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npm run test' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('⚡ npm run test')
    })

    it('should extract Grep tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Grep',
              input: { pattern: 'function\\s+render' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('🔎 grep "function\\s+render"')
    })

    it('should extract Glob tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Glob',
              input: { pattern: '**/*.test.ts' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('🔍 **/*.test.ts')
    })

    it('should extract Task tool action', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Task',
              input: { description: 'Analyze codebase structure' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('🤖 Analyze codebase struc...')
    })

    it('should return null for stream text_delta events', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'stream_event',
        event: {
          type: 'text_delta',
          text: 'Analyzing the file structure',
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBeNull()
    })

    it('should return null for stream content_block_delta events', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: {
            type: 'text_delta',
            text: 'Processing dependencies',
          },
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBeNull()
    })

    it('should return null for empty text', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'stream_event',
        event: {
          type: 'text_delta',
          text: '   ',
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBeNull()
    })

    it('should return null for non-tool assistant messages', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: 'I will analyze the code',
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBeNull()
    })

    it('should handle unknown tool names', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'UnknownTool',
              input: {},
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('🔧 UnknownTool')
    })
  })

  describe('isToolUseEvent', () => {
    it('should return true for tool_use events', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/test.ts' },
            },
          ],
        },
      }

      expect(display.isToolUseEvent(event)).toBe(true)
    })

    it('should return false for text events', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: 'Some text',
            },
          ],
        },
      }

      expect(display.isToolUseEvent(event)).toBe(false)
    })

    it('should return false for stream events', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'stream_event',
        event: {
          type: 'text_delta',
          text: 'Some text',
        },
      }

      expect(display.isToolUseEvent(event)).toBe(false)
    })

    it('should return false for result events', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'result',
        subtype: 'success',
        duration_ms: 1000,
      }

      expect(display.isToolUseEvent(event)).toBe(false)
    })
  })

  describe('agent state management', () => {
    it('should update action for running agent', () => {
      const display = new ParallelDisplayManager()
      const agentId = display.registerAgent('1.1', 'Test task')

      display.updateAction(agentId, 'New action')
    })

    it('should increment tool count', () => {
      const display = new ParallelDisplayManager()
      const agentId = display.registerAgent('1.1', 'Test task')

      display.incrementToolCount(agentId)
      display.incrementToolCount(agentId)
    })

    it('should update token count', () => {
      const display = new ParallelDisplayManager()
      const agentId = display.registerAgent('1.1', 'Test task')

      display.updateTokenCount(agentId, 5000)
    })

    it('should mark agent as completed', () => {
      const display = new ParallelDisplayManager()
      const agentId = display.registerAgent('1.1', 'Test task')

      display.markCompleted(agentId, 10, 5000)
    })

    it('should mark agent as failed', () => {
      const display = new ParallelDisplayManager()
      const agentId = display.registerAgent('1.1', 'Test task')

      display.markFailed(agentId)
    })
  })

  describe('options', () => {
    it('should use default options', () => {
      const display = new ParallelDisplayManager()
      display.registerAgent('1.1', 'Test')
    })

    it('should accept custom options', () => {
      const display = new ParallelDisplayManager({
        showTokens: false,
        maxActionLength: 30,
      })
      display.registerAgent('1.1', 'Test')
    })
  })

  describe('terminal detection', () => {
    it('should not render in non-TTY environment', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
      })

      const display = new ParallelDisplayManager()
      display.registerAgent('1.1', 'Test')
      display.renderInitial()

      const hasAnsiCodes = outputBuffer.some((chunk) => chunk.includes('\x1B['))
      expect(hasAnsiCodes).toBe(false)
    })

    it('should not render in CI environment', () => {
      const originalCI = process.env.CI
      process.env.CI = 'true'

      const display = new ParallelDisplayManager()
      display.registerAgent('1.1', 'Test')
      display.renderInitial()
      display.cleanup()

      process.env.CI = originalCI
    })
  })

  describe('cleanup', () => {
    it('should restore cursor on cleanup', () => {
      const display = new ParallelDisplayManager()
      display.cleanup()

      expect(outputBuffer).toContain('\x1B[?25h')
    })
  })

  describe('action truncation', () => {
    it('should truncate long task descriptions (25 char limit)', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Task',
              input: { description: 'This is a very long description that should be truncated' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('🤖 This is a very long de...')
    })

    it('should not truncate short task descriptions', () => {
      const display = new ParallelDisplayManager()
      const event: StreamEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Task',
              input: { description: 'Short' },
            },
          ],
        },
      }

      const action = display.extractActionFromEvent(event)

      expect(action).toBe('🤖 Short')
    })
  })
})
