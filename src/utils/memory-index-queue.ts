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

export class MemoryIndexQueue {
  private queue: Map<string, QueueItem> = new Map()
  private debounceTimer: NodeJS.Timeout | null = null
  private processing = false
  private readonly debounceMs: number

  constructor(options: QueueOptions = {}) {
    this.debounceMs = options.debounceMs ?? 2000
  }

  enqueue(path: string, metadata?: Record<string, unknown>): void {
    this.queue.set(path, { path, metadata })

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.processQueue()
    }, this.debounceMs)
  }

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

  clear(): void {
    this.queue.clear()

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  getSize(): number {
    return this.queue.size
  }

  getPending(): string[] {
    return Array.from(this.queue.keys())
  }
}
