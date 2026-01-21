import Fuse from 'fuse.js'
import { loadMemoryConfig } from './memory-config'
import { logger } from './logger'
import type { MemoryConfig, MemoryQueryOptions, MemoryResult, MemoryResultDocument } from '../types/mcp-memory'

export interface IndexResult {
  success: boolean
  documentId?: string
  error?: string
}

export interface MemoryMetrics {
  indexOperations: number
  recallOperations: number
  averageIndexTime: number
  averageRecallTime: number
  failures: number
}

interface InternalDocument {
  id: string
  content: string
  metadata: Record<string, unknown>
  indexedAt: string
}

export class MemoryMCP {
  private config: MemoryConfig | null = null
  private connected = false
  private documents: InternalDocument[] = []
  private metrics = {
    indexOperations: 0,
    recallOperations: 0,
    totalIndexTime: 0,
    totalRecallTime: 0,
    failures: 0,
  }

  private readonly MAX_RETRIES = 3
  private readonly TIMEOUT_MS = 5000
  private readonly RETRY_DELAYS = [1000, 2000, 4000]

  constructor(config?: MemoryConfig) {
    this.config = config ?? null
  }

  async connect(): Promise<boolean> {
    if (this.connected) {
      return true
    }

    try {
      if (!this.config) {
        this.config = await loadMemoryConfig()
      }

      await this.withRetry(async () => {
        await this.simulateConnection()
      })

      this.connected = true
      return true
    } catch (error) {
      logger.error(`Failed to connect to MCP: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async index(content: string, metadata: Record<string, unknown>): Promise<IndexResult> {
    const startTime = Date.now()

    try {
      if (!this.connected) {
        await this.connect()
      }

      const result = await this.withTimeout(
        this.withRetry(async () => {
          const documentId = this.generateDocumentId()

          this.documents.push({
            id: documentId,
            content,
            metadata,
            indexedAt: new Date().toISOString(),
          })

          return { success: true, documentId }
        }),
      )

      this.metrics.indexOperations++
      this.metrics.totalIndexTime += Date.now() - startTime

      return result
    } catch (error) {
      this.metrics.failures++
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async recall(query: string, options?: MemoryQueryOptions): Promise<MemoryResult> {
    const startTime = Date.now()

    try {
      if (!this.connected) {
        const connected = await this.connect()
        if (!connected) {
          throw new Error('MCP unavailable')
        }
      }

      const result = await this.mcpRecall(query, options)

      this.metrics.recallOperations++
      this.metrics.totalRecallTime += Date.now() - startTime

      return result
    } catch (error) {
      logger.warn(`MCP recall failed, falling back to keyword search: ${error instanceof Error ? error.message : String(error)}`)

      const fallbackResult = await this.keywordFallback(query, options)

      this.metrics.recallOperations++
      this.metrics.totalRecallTime += Date.now() - startTime

      return fallbackResult
    }
  }

  getMetrics(): MemoryMetrics {
    return {
      indexOperations: this.metrics.indexOperations,
      recallOperations: this.metrics.recallOperations,
      averageIndexTime:
        this.metrics.indexOperations > 0 ? this.metrics.totalIndexTime / this.metrics.indexOperations : 0,
      averageRecallTime:
        this.metrics.recallOperations > 0 ? this.metrics.totalRecallTime / this.metrics.recallOperations : 0,
      failures: this.metrics.failures,
    }
  }

  private async mcpRecall(query: string, options?: MemoryQueryOptions): Promise<MemoryResult> {
    const startTime = Date.now()
    const embeddingStart = Date.now()

    if (this.documents.length === 0) {
      return this.emptyResult(query, options?.hybrid === false ? 'semantic' : 'hybrid', Date.now() - startTime)
    }

    const embeddingTime = Date.now() - embeddingStart
    const searchStart = Date.now()

    const limit = options?.limit ?? 5
    const threshold = options?.threshold ?? 0.65
    const hybrid = options?.hybrid ?? true

    const fuse = new Fuse(this.documents, {
      keys: ['content', 'metadata.source'],
      threshold: 1 - threshold,
      includeScore: true,
    })

    const results = fuse.search(query)
    const searchTime = Date.now() - searchStart

    const documents: MemoryResultDocument[] = results.slice(0, limit).map((result) => ({
      id: result.item.id,
      content: result.item.content,
      score: result.score !== undefined ? 1 - result.score : 0.5,
      metadata: {
        source: (result.item.metadata.source as string) || 'unknown',
        createdAt: (result.item.metadata.createdAt as string) || result.item.indexedAt,
        updatedAt: (result.item.metadata.updatedAt as string) || result.item.indexedAt,
        title: result.item.metadata.title as string | undefined,
        tags: result.item.metadata.tags as string[] | undefined,
        feature: result.item.metadata.feature as string | undefined,
      },
    }))

    const mode = hybrid ? 'hybrid' : 'semantic'

    return {
      documents,
      timings: {
        total: Date.now() - startTime,
        embedding: embeddingTime,
        search: searchTime,
      },
      meta: {
        provider: 'mcp-memory',
        query,
        mode,
      },
    }
  }

  private async keywordFallback(query: string, options?: MemoryQueryOptions): Promise<MemoryResult> {
    const startTime = Date.now()

    if (this.documents.length === 0) {
      return this.emptyResult(query, 'keyword', Date.now() - startTime)
    }

    const limit = options?.limit ?? 5
    const threshold = options?.threshold ?? 0.65

    const fuse = new Fuse(this.documents, {
      keys: ['content', 'metadata.source'],
      threshold: 1 - threshold,
      includeScore: true,
    })

    const results = fuse.search(query)

    const documents: MemoryResultDocument[] = results.slice(0, limit).map((result) => ({
      id: result.item.id,
      content: result.item.content,
      score: result.score !== undefined ? 1 - result.score : 0.5,
      metadata: {
        source: (result.item.metadata.source as string) || 'unknown',
        createdAt: (result.item.metadata.createdAt as string) || result.item.indexedAt,
        updatedAt: (result.item.metadata.updatedAt as string) || result.item.indexedAt,
        title: result.item.metadata.title as string | undefined,
        tags: result.item.metadata.tags as string[] | undefined,
        feature: result.item.metadata.feature as string | undefined,
      },
    }))

    return {
      documents,
      timings: {
        total: Date.now() - startTime,
      },
      meta: {
        provider: 'keyword-fallback',
        query,
        mode: 'keyword',
      },
    }
  }

  private emptyResult(query: string, mode: 'semantic' | 'keyword' | 'hybrid', totalTime: number): MemoryResult {
    return {
      documents: [],
      timings: {
        total: totalTime,
      },
      meta: {
        provider: mode === 'keyword' ? 'keyword-fallback' : 'mcp-memory',
        query,
        mode,
      },
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.MAX_RETRIES - 1) {
          await this.sleep(this.RETRY_DELAYS[attempt])
        }
      }
    }

    throw lastError ?? new Error('Max retries exceeded')
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout after 5s')), this.TIMEOUT_MS),
      ),
    ])
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private simulateConnection(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
  }

  private generateDocumentId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
}
