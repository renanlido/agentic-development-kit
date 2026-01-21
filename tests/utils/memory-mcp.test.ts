import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { MemoryConfig, MemoryQueryOptions, MemoryResult } from '../../src/types/mcp-memory'

const mockLoadMemoryConfig = jest.fn<() => Promise<MemoryConfig>>()
const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

jest.mock('../../src/utils/memory-config', () => ({
  loadMemoryConfig: () => mockLoadMemoryConfig(),
}))

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger,
}))

import { MemoryMCP } from '../../src/utils/memory-mcp'

describe('MemoryMCP', () => {
  const mockConfig: MemoryConfig = {
    version: '1.0.0',
    provider: 'mcp-memory',
    storage: {
      path: '.adk/memory.db',
      maxSize: '500MB',
    },
    embedding: {
      model: 'nomic-embed-text-v1.5',
      chunkSize: 512,
      overlap: 100,
    },
    retrieval: {
      topK: 10,
      finalK: 5,
      threshold: 0.65,
    },
    hybridSearch: {
      enabled: true,
      weights: {
        semantic: 0.7,
        keyword: 0.3,
      },
    },
    indexPatterns: ['.claude/**/*.md'],
    ignorePatterns: ['**/.env*'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockLoadMemoryConfig.mockResolvedValue(mockConfig)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with default config', async () => {
      const mcp = new MemoryMCP()
      expect(mcp).toBeDefined()
      expect(mcp.isConnected()).toBe(false)
    })

    it('should create instance with custom config', () => {
      const customConfig: MemoryConfig = {
        ...mockConfig,
        provider: 'mcp-local-rag',
      }

      const mcp = new MemoryMCP(customConfig)
      expect(mcp).toBeDefined()
      expect(mcp.isConnected()).toBe(false)
    })
  })

  describe('connect', () => {
    it('should connect successfully', async () => {
      const mcp = new MemoryMCP(mockConfig)
      const result = await mcp.connect()

      expect(result).toBe(true)
      expect(mcp.isConnected()).toBe(true)
    })

    it('should return true if already connected', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()
      const secondConnect = await mcp.connect()

      expect(secondConnect).toBe(true)
      expect(mcp.isConnected()).toBe(true)
    })

    it('should handle connection failure gracefully', async () => {
      const mcp = new MemoryMCP(mockConfig)

      jest.spyOn(mcp as unknown as { mockConnect: () => Promise<void> }, 'mockConnect' as keyof MemoryMCP).mockRejectedValue(new Error('Connection failed'))

      const result = await mcp.connect()

      expect(result).toBe(false)
      expect(mcp.isConnected()).toBe(false)
    })

    it('should retry connection on failure', async () => {
      const mcp = new MemoryMCP(mockConfig)

      let attemptCount = 0
      jest.spyOn(mcp as unknown as { mockConnect: () => Promise<void> }, 'mockConnect' as keyof MemoryMCP).mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Connection failed')
        }
      })

      const result = await mcp.connect()

      expect(result).toBe(true)
      expect(attemptCount).toBe(3)
    })
  })

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      await mcp.disconnect()

      expect(mcp.isConnected()).toBe(false)
    })

    it('should handle disconnect when not connected', async () => {
      const mcp = new MemoryMCP(mockConfig)

      await expect(mcp.disconnect()).resolves.not.toThrow()
      expect(mcp.isConnected()).toBe(false)
    })
  })

  describe('index', () => {
    it('should index document successfully', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.index('Test content', {
        source: '.claude/test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      expect(result.success).toBe(true)
      expect(result.documentId).toBeDefined()
      expect(typeof result.documentId).toBe('string')
    })

    it('should connect automatically if not connected', async () => {
      const mcp = new MemoryMCP(mockConfig)

      const result = await mcp.index('Test content', {
        source: '.claude/test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      expect(result.success).toBe(true)
      expect(mcp.isConnected()).toBe(true)
    })

    it('should retry on transient failure', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      let attemptCount = 0
      jest.spyOn(mcp as unknown as { mockIndex: () => Promise<unknown> }, 'mockIndex' as keyof MemoryMCP).mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 2) {
          throw new Error('Transient error')
        }
        return { success: true, documentId: 'doc-123' }
      })

      const result = await mcp.index('Test', { source: 'test.md', createdAt: '2026-01-21T10:00:00Z', updatedAt: '2026-01-21T10:00:00Z' })

      expect(result.success).toBe(true)
      expect(attemptCount).toBe(2)
    })

    it('should fail after max retries', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      jest.spyOn(mcp as unknown as { mockIndex: () => Promise<unknown> }, 'mockIndex' as keyof MemoryMCP).mockRejectedValue(new Error('Persistent error'))

      const result = await mcp.index('Test', { source: 'test.md', createdAt: '2026-01-21T10:00:00Z', updatedAt: '2026-01-21T10:00:00Z' })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle timeout', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      jest.spyOn(mcp as unknown as { mockIndex: () => Promise<unknown> }, 'mockIndex' as keyof MemoryMCP).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000)),
      )

      const result = await mcp.index('Test', { source: 'test.md', createdAt: '2026-01-21T10:00:00Z', updatedAt: '2026-01-21T10:00:00Z' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    }, 10000)
  })

  describe('recall', () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        content: 'Authentication documentation',
        score: 0.95,
        metadata: {
          source: '.claude/plans/auth.md',
          createdAt: '2026-01-21T10:00:00Z',
          updatedAt: '2026-01-21T10:00:00Z',
        },
      },
      {
        id: 'doc-2',
        content: 'User login flow',
        score: 0.87,
        metadata: {
          source: '.claude/plans/login.md',
          createdAt: '2026-01-21T10:00:00Z',
          updatedAt: '2026-01-21T10:00:00Z',
        },
      },
    ]

    it('should recall documents successfully', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.recall('authentication')

      expect(result.documents.length).toBeGreaterThan(0)
      expect(result.meta.mode).toBe('semantic')
      expect(result.timings.total).toBeGreaterThan(0)
    })

    it('should use hybrid search when enabled', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const options: MemoryQueryOptions = {
        hybrid: true,
        hybridWeights: {
          semantic: 0.6,
          keyword: 0.4,
        },
      }

      const result = await mcp.recall('auth', options)

      expect(result.meta.mode).toBe('hybrid')
    })

    it('should respect limit option', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.recall('test', { limit: 3 })

      expect(result.documents.length).toBeLessThanOrEqual(3)
    })

    it('should filter by threshold', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.recall('test', { threshold: 0.8 })

      expect(result.documents.every((doc) => doc.score >= 0.8)).toBe(true)
    })

    it('should fallback to keyword search when MCP fails', async () => {
      const mcp = new MemoryMCP(mockConfig)

      jest.spyOn(mcp as unknown as { mcpRecall: () => Promise<unknown> }, 'mcpRecall' as keyof MemoryMCP).mockRejectedValue(new Error('MCP unavailable'))

      const result = await mcp.recall('test')

      expect(result.meta.mode).toBe('keyword')
      expect(result.documents).toBeDefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('MCP recall failed'))
    })

    it('should return empty results when no matches', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.recall('nonexistent-query-12345')

      expect(result.documents).toEqual([])
      expect(result.meta.query).toBe('nonexistent-query-12345')
    })

    it('should measure timings correctly', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.recall('test')

      expect(result.timings.total).toBeGreaterThan(0)
      expect(result.timings.embedding).toBeGreaterThanOrEqual(0)
      expect(result.timings.search).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getMetrics', () => {
    it('should return metrics', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      await mcp.index('Test 1', { source: 'test1.md', createdAt: '2026-01-21T10:00:00Z', updatedAt: '2026-01-21T10:00:00Z' })
      await mcp.index('Test 2', { source: 'test2.md', createdAt: '2026-01-21T10:00:00Z', updatedAt: '2026-01-21T10:00:00Z' })
      await mcp.recall('test')

      const metrics = mcp.getMetrics()

      expect(metrics.indexOperations).toBe(2)
      expect(metrics.recallOperations).toBe(1)
      expect(metrics.averageIndexTime).toBeGreaterThan(0)
      expect(metrics.averageRecallTime).toBeGreaterThan(0)
    })

    it('should track failures', async () => {
      const mcp = new MemoryMCP(mockConfig)

      jest.spyOn(mcp as unknown as { mockIndex: () => Promise<unknown> }, 'mockIndex' as keyof MemoryMCP).mockRejectedValue(new Error('Error'))

      await mcp.index('Test', { source: 'test.md', createdAt: '2026-01-21T10:00:00Z', updatedAt: '2026-01-21T10:00:00Z' })

      const metrics = mcp.getMetrics()

      expect(metrics.failures).toBeGreaterThan(0)
    })
  })

  describe('keyword fallback', () => {
    it('should use keyword search when MCP unavailable', async () => {
      const mcp = new MemoryMCP(mockConfig)

      const result = await mcp.recall('authentication')

      expect(result.meta.mode).toBe('keyword')
      expect(result.meta.provider).toContain('fallback')
    })

    it('should work for cross-language queries in fallback', async () => {
      const mcp = new MemoryMCP(mockConfig)

      const result = await mcp.recall('autenticação')

      expect(result.documents).toBeDefined()
      expect(result.meta.mode).toBe('keyword')
    })
  })
})
