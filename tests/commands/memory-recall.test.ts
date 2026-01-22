import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { MemoryResult } from '../../src/types/mcp-memory'

const mockMemoryMCP = {
  connect: jest.fn<() => Promise<boolean>>(),
  disconnect: jest.fn<() => Promise<void>>(),
  recall: jest.fn<(query: string, options?: unknown) => Promise<MemoryResult>>(),
  isConnected: jest.fn<() => boolean>(),
}

const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  warn: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  text: '',
}

const mockConsoleLog = jest.fn()

jest.mock('ora', () => jest.fn(() => mockSpinner))

const mockChalk = {
  cyan: (str: string) => str,
  gray: (str: string) => str,
  yellow: (str: string) => str,
  green: (str: string) => str,
  bold: {
    cyan: (str: string) => str,
  },
}

jest.mock('chalk', () => ({
  default: mockChalk,
  ...mockChalk,
}))

jest.mock('../../src/utils/memory-mcp', () => ({
  MemoryMCP: jest.fn().mockImplementation(() => mockMemoryMCP),
}))

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger,
}))

// Import after mocks
import { memoryCommand } from '../../src/commands/memory'

describe('MemoryCommand - recall', () => {
  let processExitSpy: jest.SpiedFunction<typeof process.exit>

  beforeEach(() => {
    jest.clearAllMocks()
    mockMemoryMCP.connect.mockResolvedValue(true)
    mockMemoryMCP.disconnect.mockResolvedValue(undefined)
    mockMemoryMCP.isConnected.mockReturnValue(false)
    mockMemoryMCP.recall.mockResolvedValue({
      documents: [],
      timings: { total: 10 },
      meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
    })
    global.console.log = mockConsoleLog

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    processExitSpy.mockRestore()
  })

  describe('semantic search', () => {
    it('should perform semantic search successfully', async () => {
      const mockResult: MemoryResult = {
        documents: [
          {
            id: 'doc-1',
            content: 'Authentication using JWT tokens',
            score: 0.95,
            metadata: {
              source: 'auth.md',
              createdAt: '2026-01-21T10:00:00Z',
              updatedAt: '2026-01-21T10:00:00Z',
            },
          },
        ],
        timings: {
          total: 50,
          embedding: 20,
          search: 30,
        },
        meta: {
          provider: 'mcp-memory',
          query: 'authentication',
          mode: 'hybrid',
        },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('authentication')

      expect(mockMemoryMCP.connect).toHaveBeenCalled()
      expect(mockMemoryMCP.recall).toHaveBeenCalledWith(
        'authentication',
        expect.objectContaining({
          limit: 5,
        })
      )
      expect(mockMemoryMCP.disconnect).toHaveBeenCalled()
      expect(mockSpinner.stop).toHaveBeenCalled()
      expect(mockConsoleLog).toHaveBeenCalled()
    })

    it('should respect limit option', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test', { limit: '10' })

      expect(mockMemoryMCP.recall).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 10,
        })
      )
    })

    it('should use default limit of 5', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test')

      expect(mockMemoryMCP.recall).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 5,
        })
      )
    })

    it('should support threshold option', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test', { threshold: '0.8' })

      expect(mockMemoryMCP.recall).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          threshold: 0.8,
        })
      )
    })

    it('should support hybrid option', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'semantic' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test', { hybrid: 'false' })

      expect(mockMemoryMCP.recall).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          hybrid: false,
        })
      )
    })
  })

  describe('result formatting', () => {
    it('should display results with scores', async () => {
      const mockResult: MemoryResult = {
        documents: [
          {
            id: 'doc-1',
            content: 'Test content 1',
            score: 0.95,
            metadata: {
              source: 'test1.md',
              createdAt: '2026-01-21T10:00:00Z',
              updatedAt: '2026-01-21T10:00:00Z',
            },
          },
          {
            id: 'doc-2',
            content: 'Test content 2',
            score: 0.85,
            metadata: {
              source: 'test2.md',
              createdAt: '2026-01-21T10:00:00Z',
              updatedAt: '2026-01-21T10:00:00Z',
            },
          },
        ],
        timings: {
          total: 50,
        },
        meta: {
          provider: 'mcp-memory',
          query: 'test',
          mode: 'hybrid',
        },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test')

      expect(mockConsoleLog).toHaveBeenCalled()
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('test1.md')
      expect(output).toContain('test2.md')
    })

    it('should show empty results message', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'nonexistent', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('nonexistent')

      expect(mockSpinner.warn).toHaveBeenCalledWith(expect.stringContaining('Nenhum resultado'))
    })

    it('should display search metadata', async () => {
      const mockResult: MemoryResult = {
        documents: [
          {
            id: 'doc-1',
            content: 'Content',
            score: 0.9,
            metadata: {
              source: 'test.md',
              createdAt: '2026-01-21T10:00:00Z',
              updatedAt: '2026-01-21T10:00:00Z',
            },
          },
        ],
        timings: {
          total: 100,
          embedding: 40,
          search: 60,
        },
        meta: {
          provider: 'mcp-memory',
          query: 'test',
          mode: 'hybrid',
        },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test')

      expect(mockConsoleLog).toHaveBeenCalled()
      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('100ms')
    })
  })

  describe('connection handling', () => {
    it('should connect before recall', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test')

      expect(mockMemoryMCP.connect).toHaveBeenCalled()
      expect(mockMemoryMCP.recall).toHaveBeenCalled()
    })

    it('should disconnect after recall', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test')

      expect(mockMemoryMCP.disconnect).toHaveBeenCalled()
    })

    it('should handle connection failure', async () => {
      mockMemoryMCP.connect.mockResolvedValue(false)

      await expect(memoryCommand.recall('test')).rejects.toThrow('process.exit called')

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('MCP'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('error handling', () => {
    it('should handle recall errors', async () => {
      mockMemoryMCP.recall.mockRejectedValue(new Error('Recall failed'))

      await expect(memoryCommand.recall('test')).rejects.toThrow('process.exit called')

      expect(mockSpinner.fail).toHaveBeenCalledWith('Erro na busca')
      expect(mockLogger.error).toHaveBeenCalledWith('Recall failed')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle unexpected errors', async () => {
      mockMemoryMCP.connect.mockRejectedValue(new Error('Unexpected error'))

      await expect(memoryCommand.recall('test')).rejects.toThrow('process.exit called')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('backward compatibility', () => {
    it('should maintain category option for legacy use', async () => {
      const mockResult: MemoryResult = {
        documents: [],
        timings: { total: 10 },
        meta: { provider: 'mcp-memory', query: 'test', mode: 'hybrid' },
      }

      mockMemoryMCP.recall.mockResolvedValue(mockResult)

      await memoryCommand.recall('test', { category: 'architecture' })

      expect(mockMemoryMCP.recall).toHaveBeenCalled()
    })
  })
})
