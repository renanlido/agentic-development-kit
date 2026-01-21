import { describe, it, expect } from '@jest/globals'
import {
  type MemoryDocument,
  type MemoryDocumentMetadata,
  type MemoryQuery,
  type MemoryQueryOptions,
  type MemoryResult,
  type MemoryResultDocument,
  type MemoryConfig,
  type MemoryConfigInput,
  MemoryConfigSchema,
  isMemoryDocument,
  isMemoryResult,
} from '../../src/types/mcp-memory'

describe('MCP Memory Types', () => {
  describe('MemoryDocument', () => {
    it('should accept valid document without embedding', () => {
      const doc: MemoryDocument = {
        id: 'doc-123',
        content: 'Test content',
        metadata: {
          source: '.claude/test.md',
          createdAt: '2026-01-21T10:00:00Z',
          updatedAt: '2026-01-21T10:00:00Z',
        },
      }

      expect(doc.id).toBe('doc-123')
      expect(doc.content).toBe('Test content')
      expect(doc.embedding).toBeUndefined()
    })

    it('should accept valid document with embedding', () => {
      const doc: MemoryDocument = {
        id: 'doc-456',
        content: 'Test content with embedding',
        metadata: {
          source: '.claude/test.md',
          title: 'Test Document',
          createdAt: '2026-01-21T10:00:00Z',
          updatedAt: '2026-01-21T10:00:00Z',
          tags: ['test', 'memory'],
          feature: 'adk-v2-fase1',
        },
        embedding: [0.1, 0.2, 0.3],
      }

      expect(doc.embedding).toHaveLength(3)
      expect(doc.metadata.tags).toContain('test')
      expect(doc.metadata.feature).toBe('adk-v2-fase1')
    })

    it('should accept metadata with optional fields', () => {
      const metadata: MemoryDocumentMetadata = {
        source: '.claude/memory/test.md',
        createdAt: '2026-01-21T10:00:00Z',
        updatedAt: '2026-01-21T10:00:00Z',
      }

      expect(metadata.title).toBeUndefined()
      expect(metadata.tags).toBeUndefined()
      expect(metadata.feature).toBeUndefined()
    })
  })

  describe('MemoryQuery', () => {
    it('should accept query without options', () => {
      const query: MemoryQuery = {
        query: 'test query',
      }

      expect(query.query).toBe('test query')
      expect(query.options).toBeUndefined()
    })

    it('should accept query with full options', () => {
      const query: MemoryQuery = {
        query: 'authentication',
        options: {
          limit: 10,
          threshold: 0.8,
          hybrid: true,
          hybridWeights: {
            semantic: 0.6,
            keyword: 0.4,
          },
        },
      }

      expect(query.options?.limit).toBe(10)
      expect(query.options?.threshold).toBe(0.8)
      expect(query.options?.hybrid).toBe(true)
      expect(query.options?.hybridWeights?.semantic).toBe(0.6)
    })

    it('should accept query with partial options', () => {
      const query: MemoryQuery = {
        query: 'hooks',
        options: {
          limit: 5,
        },
      }

      expect(query.options?.limit).toBe(5)
      expect(query.options?.threshold).toBeUndefined()
    })
  })

  describe('MemoryQueryOptions defaults', () => {
    it('should have correct default values in schema', () => {
      const options: MemoryQueryOptions = {
        limit: 5,
        threshold: 0.65,
        hybrid: true,
        hybridWeights: {
          semantic: 0.7,
          keyword: 0.3,
        },
      }

      expect(options.limit).toBe(5)
      expect(options.threshold).toBe(0.65)
      expect(options.hybridWeights?.semantic).toBe(0.7)
    })
  })

  describe('MemoryResult', () => {
    it('should accept valid result with documents', () => {
      const result: MemoryResult = {
        documents: [
          {
            id: 'doc-1',
            content: 'Result content',
            score: 0.95,
            metadata: {
              source: '.claude/test.md',
              createdAt: '2026-01-21T10:00:00Z',
              updatedAt: '2026-01-21T10:00:00Z',
            },
          },
        ],
        timings: {
          total: 85,
          embedding: 15,
          search: 50,
          rerank: 20,
        },
        meta: {
          provider: 'mcp-memory',
          query: 'test',
          mode: 'hybrid',
        },
      }

      expect(result.documents).toHaveLength(1)
      expect(result.documents[0].score).toBe(0.95)
      expect(result.timings.total).toBe(85)
      expect(result.meta.mode).toBe('hybrid')
    })

    it('should accept result with empty documents', () => {
      const result: MemoryResult = {
        documents: [],
        timings: {
          total: 42,
        },
        meta: {
          provider: 'keyword-fallback',
          query: 'nonexistent',
          mode: 'keyword',
        },
      }

      expect(result.documents).toHaveLength(0)
      expect(result.meta.mode).toBe('keyword')
    })

    it('should accept result with semantic mode', () => {
      const result: MemoryResult = {
        documents: [],
        timings: { total: 100 },
        meta: {
          provider: 'mcp-memory',
          query: 'auth',
          mode: 'semantic',
        },
      }

      expect(result.meta.mode).toBe('semantic')
    })
  })

  describe('MemoryResultDocument', () => {
    it('should include score between 0 and 1', () => {
      const doc: MemoryResultDocument = {
        id: 'result-123',
        content: 'Search result',
        score: 0.87,
        metadata: {
          source: '.claude/plans/test.md',
          createdAt: '2026-01-21T10:00:00Z',
          updatedAt: '2026-01-21T10:00:00Z',
        },
      }

      expect(doc.score).toBeGreaterThanOrEqual(0)
      expect(doc.score).toBeLessThanOrEqual(1)
    })
  })

  describe('MemoryConfigSchema (Manual)', () => {
    it('should validate correct config', () => {
      const config = {
        version: '1.0.0',
        provider: 'mcp-memory' as const,
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

      const result = MemoryConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('should throw error on parse with invalid config', () => {
      expect(() => MemoryConfigSchema.parse({ provider: 'invalid' } as unknown as MemoryConfigInput)).toThrow('Invalid MemoryConfig')
    })

    it('should reject non-object input', () => {
      const result = MemoryConfigSchema.safeParse('not an object')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('Input must be an object')
      }
    })

    it('should reject invalid storage type', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        storage: 'invalid',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('storage must be an object')
      }
    })

    it('should reject invalid embedding type', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        embedding: 'invalid',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('embedding must be an object')
      }
    })

    it('should reject negative overlap', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        embedding: { overlap: -1 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('embedding.overlap must be a non-negative number')
      }
    })

    it('should reject non-positive topK', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        retrieval: { topK: 0 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('retrieval.topK must be a positive number')
      }
    })

    it('should reject non-positive finalK', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        retrieval: { finalK: -1 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('retrieval.finalK must be a positive number')
      }
    })

    it('should reject threshold out of range', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        retrieval: { threshold: 1.5 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('retrieval.threshold must be a number between 0 and 1')
      }
    })

    it('should reject semantic weight out of range', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        hybridSearch: { weights: { semantic: 2.0 } },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('hybridSearch.weights.semantic must be a number between 0 and 1')
      }
    })

    it('should reject keyword weight out of range', () => {
      const result = MemoryConfigSchema.safeParse({
        provider: 'mcp-memory',
        hybridSearch: { weights: { keyword: -0.1 } },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toContain('hybridSearch.weights.keyword must be a number between 0 and 1')
      }
    })

    it('should apply default values', () => {
      const minimalConfig = {
        provider: 'mcp-memory' as const,
      }

      const result = MemoryConfigSchema.parse(minimalConfig)

      expect(result.version).toBe('1.0.0')
      expect(result.storage.path).toBe('.adk/memory.db')
      expect(result.storage.maxSize).toBe('500MB')
      expect(result.embedding.model).toBe('nomic-embed-text-v1.5')
      expect(result.embedding.chunkSize).toBe(512)
      expect(result.embedding.overlap).toBe(100)
      expect(result.retrieval.topK).toBe(10)
      expect(result.retrieval.finalK).toBe(5)
      expect(result.retrieval.threshold).toBe(0.65)
      expect(result.hybridSearch.enabled).toBe(true)
      expect(result.hybridSearch.weights.semantic).toBe(0.7)
      expect(result.hybridSearch.weights.keyword).toBe(0.3)
      expect(result.indexPatterns).toContain('.claude/**/*.md')
      expect(result.ignorePatterns).toContain('**/.env*')
    })

    it('should reject invalid provider', () => {
      const invalidConfig = {
        provider: 'invalid-provider',
      }

      const result = MemoryConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should accept mcp-local-rag provider', () => {
      const config = {
        provider: 'mcp-local-rag' as const,
      }

      const result = MemoryConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('mcp-local-rag')
      }
    })

    it('should validate custom patterns', () => {
      const config = {
        provider: 'mcp-memory' as const,
        indexPatterns: ['src/**/*.ts', 'docs/**/*.md'],
        ignorePatterns: ['**/secrets.json', '**/credentials.key'],
      }

      const result = MemoryConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.indexPatterns).toHaveLength(2)
        expect(result.data.ignorePatterns).toHaveLength(2)
      }
    })

    it('should reject negative numbers', () => {
      const invalidConfig = {
        provider: 'mcp-memory' as const,
        embedding: {
          chunkSize: -100,
        },
      }

      const result = MemoryConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should validate hybrid search weights', () => {
      const config = {
        provider: 'mcp-memory' as const,
        hybridSearch: {
          enabled: true,
          weights: {
            semantic: 0.6,
            keyword: 0.4,
          },
        },
      }

      const result = MemoryConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hybridSearch.weights.semantic).toBe(0.6)
        expect(result.data.hybridSearch.weights.keyword).toBe(0.4)
      }
    })
  })

  describe('Type Guards', () => {
    describe('isMemoryDocument', () => {
      it('should return true for valid document', () => {
        const doc = {
          id: 'doc-123',
          content: 'Test content',
          metadata: {
            source: '.claude/test.md',
            createdAt: '2026-01-21T10:00:00Z',
            updatedAt: '2026-01-21T10:00:00Z',
          },
        }

        expect(isMemoryDocument(doc)).toBe(true)
      })

      it('should return false for missing id', () => {
        const invalid = {
          content: 'Test content',
          metadata: {
            source: '.claude/test.md',
            createdAt: '2026-01-21T10:00:00Z',
            updatedAt: '2026-01-21T10:00:00Z',
          },
        }

        expect(isMemoryDocument(invalid)).toBe(false)
      })

      it('should return false for missing content', () => {
        const invalid = {
          id: 'doc-123',
          metadata: {
            source: '.claude/test.md',
            createdAt: '2026-01-21T10:00:00Z',
            updatedAt: '2026-01-21T10:00:00Z',
          },
        }

        expect(isMemoryDocument(invalid)).toBe(false)
      })

      it('should return false for missing metadata', () => {
        const invalid = {
          id: 'doc-123',
          content: 'Test content',
        }

        expect(isMemoryDocument(invalid)).toBe(false)
      })

      it('should return false for invalid metadata', () => {
        const invalid = {
          id: 'doc-123',
          content: 'Test content',
          metadata: {
            source: '.claude/test.md',
          },
        }

        expect(isMemoryDocument(invalid)).toBe(false)
      })

      it('should return true for document with embedding', () => {
        const doc = {
          id: 'doc-123',
          content: 'Test content',
          metadata: {
            source: '.claude/test.md',
            createdAt: '2026-01-21T10:00:00Z',
            updatedAt: '2026-01-21T10:00:00Z',
          },
          embedding: [0.1, 0.2, 0.3],
        }

        expect(isMemoryDocument(doc)).toBe(true)
      })

      it('should return false for null', () => {
        expect(isMemoryDocument(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isMemoryDocument(undefined)).toBe(false)
      })

      it('should return false for primitive types', () => {
        expect(isMemoryDocument('string')).toBe(false)
        expect(isMemoryDocument(123)).toBe(false)
        expect(isMemoryDocument(true)).toBe(false)
      })

      it('should return false for invalid tags array', () => {
        const invalid = {
          id: 'doc-123',
          content: 'Test content',
          metadata: {
            source: '.claude/test.md',
            createdAt: '2026-01-21T10:00:00Z',
            updatedAt: '2026-01-21T10:00:00Z',
            tags: ['valid', 123, 'another'], // Mixed types in array
          },
        }

        expect(isMemoryDocument(invalid)).toBe(false)
      })
    })

    describe('isMemoryResult', () => {
      it('should return true for valid result', () => {
        const result = {
          documents: [
            {
              id: 'doc-1',
              content: 'Result',
              score: 0.95,
              metadata: {
                source: '.claude/test.md',
                createdAt: '2026-01-21T10:00:00Z',
                updatedAt: '2026-01-21T10:00:00Z',
              },
            },
          ],
          timings: {
            total: 85,
          },
          meta: {
            provider: 'mcp-memory',
            query: 'test',
            mode: 'semantic' as const,
          },
        }

        expect(isMemoryResult(result)).toBe(true)
      })

      it('should return true for empty documents', () => {
        const result = {
          documents: [],
          timings: { total: 42 },
          meta: {
            provider: 'keyword',
            query: 'test',
            mode: 'keyword' as const,
          },
        }

        expect(isMemoryResult(result)).toBe(true)
      })

      it('should return false for missing documents', () => {
        const invalid = {
          timings: { total: 42 },
          meta: {
            provider: 'mcp-memory',
            query: 'test',
            mode: 'semantic' as const,
          },
        }

        expect(isMemoryResult(invalid)).toBe(false)
      })

      it('should return false for missing timings', () => {
        const invalid = {
          documents: [],
          meta: {
            provider: 'mcp-memory',
            query: 'test',
            mode: 'semantic' as const,
          },
        }

        expect(isMemoryResult(invalid)).toBe(false)
      })

      it('should return false for missing meta', () => {
        const invalid = {
          documents: [],
          timings: { total: 42 },
        }

        expect(isMemoryResult(invalid)).toBe(false)
      })

      it('should return false for invalid meta', () => {
        const invalid = {
          documents: [],
          timings: { total: 42 },
          meta: {
            provider: 'mcp-memory',
            query: 'test',
          },
        }

        expect(isMemoryResult(invalid)).toBe(false)
      })

      it('should return false for null', () => {
        expect(isMemoryResult(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isMemoryResult(undefined)).toBe(false)
      })
    })
  })

  describe('MemoryConfig type inference', () => {
    it('should infer type correctly from schema', () => {
      const config: MemoryConfig = {
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

      expect(config.provider).toBe('mcp-memory')
    })
  })
})
