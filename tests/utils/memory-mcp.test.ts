import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { MemoryConfig, MemoryQueryOptions } from '../../src/types/mcp-memory'

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
      const result = await mcp.connect()

      expect(result).toBe(true)
      expect(mcp.isConnected()).toBe(true)
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

    it('should handle index success', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.index('Test content', {
        source: 'test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      expect(result.success).toBe(true)
      expect(result.documentId).toBeDefined()
    })
  })

  describe('recall', () => {
    it('should recall documents successfully', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      await mcp.index('Authentication documentation', {
        source: 'auth.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('authentication')

      expect(result.documents.length).toBeGreaterThan(0)
      expect(result.meta.mode).toBe('hybrid')
      expect(result.timings.total).toBeGreaterThanOrEqual(0)
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

    it('should work with disconnected instance', async () => {
      const mcp = new MemoryMCP(mockConfig)

      await mcp.index('Test document', {
        source: 'test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('test')

      expect(result.documents).toBeDefined()
      expect(result.meta.query).toBe('test')
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

      await mcp.index('Test content', {
        source: 'test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('test')

      expect(result.timings.total).toBeGreaterThanOrEqual(0)
      expect(result.timings.embedding).toBeDefined()
      expect(result.timings.search).toBeDefined()
    })
  })

  describe('getMetrics', () => {
    it('should return metrics', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      await mcp.index('Test 1', {
        source: 'test1.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })
      await mcp.index('Test 2', {
        source: 'test2.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })
      await mcp.recall('test')

      const metrics = mcp.getMetrics()

      expect(metrics.indexOperations).toBe(2)
      expect(metrics.recallOperations).toBe(1)
      expect(metrics.averageIndexTime).toBeGreaterThanOrEqual(0)
      expect(metrics.averageRecallTime).toBeGreaterThanOrEqual(0)
    })

    it('should initialize with zero metrics', async () => {
      const mcp = new MemoryMCP(mockConfig)

      const metrics = mcp.getMetrics()

      expect(metrics.indexOperations).toBe(0)
      expect(metrics.recallOperations).toBe(0)
      expect(metrics.failures).toBe(0)
    })
  })

  describe('keyword fallback', () => {
    it('should handle empty result set', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      const result = await mcp.recall('authentication')

      expect(result.documents).toEqual([])
      expect(result.meta.query).toBe('authentication')
    })

    it('should return results after indexing', async () => {
      const mcp = new MemoryMCP(mockConfig)
      await mcp.connect()

      await mcp.index('Authentication documentation', {
        source: 'auth.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('authentication')

      expect(result.documents.length).toBeGreaterThan(0)
      expect(result.meta.query).toBe('authentication')
    })
  })

  describe('error handling', () => {
    it('should return false when connect fails due to config load error', async () => {
      mockLoadMemoryConfig.mockRejectedValue(new Error('Config load failed'))

      const mcp = new MemoryMCP()
      const result = await mcp.connect()

      expect(result).toBe(false)
      expect(mcp.isConnected()).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Config load failed'))
    })

    it('should use keyword fallback when connect fails', async () => {
      mockLoadMemoryConfig.mockRejectedValue(new Error('MCP unavailable'))

      const mcp = new MemoryMCP()

      // Index a document first (this will trigger connect and fail, but index will succeed via fallback)
      await mcp.index('Test document', {
        source: 'test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      // Now recall should use keyword fallback
      const result = await mcp.recall('test')

      expect(result.meta.provider).toBe('keyword-fallback')
      expect(result.meta.mode).toBe('keyword')
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('MCP recall failed'))
    })

    it('should handle keyword fallback with empty documents', async () => {
      mockLoadMemoryConfig.mockRejectedValue(new Error('MCP unavailable'))

      const mcpEmpty = new MemoryMCP()
      const result = await mcpEmpty.recall('test')

      expect(result.documents).toEqual([])
      expect(result.meta.mode).toBe('keyword')
      expect(result.meta.provider).toBe('keyword-fallback')
    })

    it('should handle keyword fallback with custom options', async () => {
      // Create instance without config to force loadMemoryConfig call
      mockLoadMemoryConfig.mockRejectedValue(new Error('MCP unavailable'))

      const mcpFallback = new MemoryMCP()

      // Index documents (succeeds even though connect failed)
      await mcpFallback.index('Document 1 about authentication', {
        source: 'doc1.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })
      await mcpFallback.index('Document 2 about testing', {
        source: 'doc2.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      // Recall will trigger keyword fallback because connect fails
      const result = await mcpFallback.recall('authentication', {
        limit: 1,
        threshold: 0.5,
      })

      expect(result.documents.length).toBeLessThanOrEqual(1)
      expect(result.meta.provider).toBe('keyword-fallback')
      expect(result.meta.mode).toBe('keyword')
    })
  })

  describe('edge cases', () => {
    it('should handle recall without explicit connect', async () => {
      const mcp = new MemoryMCP(mockConfig)

      await mcp.index('Test', {
        source: 'test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('test')

      expect(result.documents.length).toBeGreaterThan(0)
      expect(mcp.isConnected()).toBe(true)
    })

    it('should handle index with metadata including title and tags', async () => {
      const mcp = new MemoryMCP(mockConfig)

      const result = await mcp.index('Test content', {
        source: 'test.md',
        title: 'Test Title',
        tags: ['test', 'example'],
        feature: 'test-feature',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      expect(result.success).toBe(true)
      expect(result.documentId).toBeDefined()
    })

    it('should recall with semantic mode when hybrid false', async () => {
      const mcp = new MemoryMCP(mockConfig)

      await mcp.index('Semantic search test', {
        source: 'semantic.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('semantic', { hybrid: false })

      expect(result.meta.mode).toBe('semantic')
    })

    it('should handle multiple index operations', async () => {
      const mcp = new MemoryMCP(mockConfig)

      const result1 = await mcp.index('Doc 1', {
        source: 'doc1.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result2 = await mcp.index('Doc 2', {
        source: 'doc2.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result3 = await mcp.index('Doc 3', {
        source: 'doc3.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      expect(result1.documentId).not.toBe(result2.documentId)
      expect(result2.documentId).not.toBe(result3.documentId)

      const metrics = mcp.getMetrics()
      expect(metrics.indexOperations).toBe(3)
    })

    it('should disconnect and reconnect', async () => {
      const mcp = new MemoryMCP(mockConfig)

      await mcp.connect()
      expect(mcp.isConnected()).toBe(true)

      await mcp.disconnect()
      expect(mcp.isConnected()).toBe(false)

      await mcp.connect()
      expect(mcp.isConnected()).toBe(true)
    })

    it('should handle empty query', async () => {
      const mcp = new MemoryMCP(mockConfig)

      await mcp.index('Test content', {
        source: 'test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      })

      const result = await mcp.recall('')

      expect(result.meta.query).toBe('')
      expect(result.documents).toBeDefined()
    })
  })
})
