import fs from 'fs-extra'
import { MemoryMCP } from './memory-mcp.js'
import { logger } from './logger.js'

interface QueueItem {
  path: string
  metadata?: Record<string, unknown>
}

interface QueueOptions {
  debounceMs?: number
}

/**
 * Queue system for async indexation with debouncing
 *
 * Prevents excessive indexing by grouping multiple writes to the same file
 * within a debounce window. Processes queue automatically after debounce delay.
 *
 * Features:
 * - Debounce (default 2s) to batch rapid changes
 * - Automatic deduplication by file path
 * - Non-blocking async processing
 * - Graceful error handling with logging
 *
 * @example
 * ```typescript
 * const queue = new MemoryIndexQueue()
 *
 * // Enqueue files - will auto-process after 2s
 * queue.enqueue('.claude/research.md')
 * queue.enqueue('.claude/plan.md')
 *
 * // Or process immediately
 * await queue.processQueue()
 * ```
 */
export class MemoryIndexQueue {
  private queue: Map<string, QueueItem> = new Map()
  private debounceTimer: NodeJS.Timeout | null = null
  private processing = false
  private readonly debounceMs: number

  constructor(options: QueueOptions = {}) {
    this.debounceMs = options.debounceMs ?? 2000
  }

  /**
   * Adds a file to the indexation queue with debouncing
   * Multiple calls for the same path within debounce window are deduplicated
   * @param {string} path - File path to index
   * @param {Record<string, unknown>} [metadata] - Optional metadata
   */
  enqueue(path: string, metadata?: Record<string, unknown>): void {
    this.queue.set(path, { path, metadata })

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.processQueue()
    }, this.debounceMs)
  }

  /**
   * Processes all pending files in the queue
   * Connects to MCP, reads files, and indexes them
   * Logs success/failure counts
   * @returns {Promise<void>}
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }

    if (this.queue.size === 0) {
      return
    }

    this.processing = true

    try {
      const items = Array.from(this.queue.values())
      this.queue.clear()

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }

      const mcp = new MemoryMCP()

      const connected = await mcp.connect()
      if (!connected) {
        logger.error('Falha ao conectar ao MCP para processar fila')
        this.processing = false
        return
      }

      let indexed = 0
      let failed = 0

      for (const item of items) {
        if (!(await fs.pathExists(item.path))) {
          logger.warn(`Arquivo nao encontrado na fila: ${item.path}`)
          failed++
          continue
        }

        try {
          const content = await fs.readFile(item.path, 'utf-8')
          const stat = await fs.stat(item.path)

          const metadata: Record<string, unknown> = {
            source: item.path,
            createdAt: stat.mtime.toISOString(),
            updatedAt: stat.mtime.toISOString(),
            ...item.metadata,
          }

          const result = await mcp.index(content, metadata)

          if (!result.success) {
            logger.warn(`Falha ao indexar ${item.path}: ${result.error}`)
            failed++
          } else {
            indexed++
          }
        } catch (error) {
          logger.warn(
            `Erro ao processar ${item.path}: ${error instanceof Error ? error.message : String(error)}`
          )
          failed++
        }
      }

      await mcp.disconnect()

      if (indexed > 0) {
        logger.success(`${indexed} arquivos indexados da fila`)
      }

      if (failed > 0) {
        logger.warn(`${failed} arquivos falharam`)
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Clears all pending items from the queue
   */
  clear(): void {
    this.queue.clear()

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * Returns the number of pending items in queue
   * @returns {number} Queue size
   */
  getSize(): number {
    return this.queue.size
  }

  /**
   * Returns list of pending file paths
   * @returns {string[]} Array of file paths
   */
  getPending(): string[] {
    return Array.from(this.queue.keys())
  }
}
