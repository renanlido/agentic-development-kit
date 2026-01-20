import path from 'node:path'
import fs from 'fs-extra'
import { getMainRepoPath } from './paths.js'

export interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  feature: string
  data: unknown
  createdAt: string
  retries: number
  lastError?: string
}

interface QueueFile {
  version: string
  operations: QueuedOperation[]
}

const QUEUE_VERSION = '1.0.0'

export interface SyncQueue {
  enqueue(operation: QueuedOperation): Promise<QueuedOperation>
  dequeue(): Promise<QueuedOperation | null>
  peek(): Promise<QueuedOperation | null>
  getPendingCount(): Promise<number>
  getAll(): Promise<QueuedOperation[]>
  clear(): Promise<void>
  remove(id: string): Promise<boolean>
  getByFeature(feature: string): Promise<QueuedOperation[]>
  updateRetries(id: string, retries: number, lastError?: string): Promise<void>
  hasFeaturePending(feature: string): Promise<boolean>
  load(): Promise<void>
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

class SyncQueueImpl implements SyncQueue {
  private operations: QueuedOperation[] = []
  private loaded = false

  private getQueuePath(): string {
    return path.join(getMainRepoPath(), '.adk', 'sync-queue.json')
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }

    const queuePath = this.getQueuePath()

    try {
      if (await fs.pathExists(queuePath)) {
        const data: QueueFile = await fs.readJson(queuePath)
        this.operations = data.operations || []
      }
    } catch {
      this.operations = []
    }

    this.loaded = true
  }

  private async save(): Promise<void> {
    const queuePath = this.getQueuePath()
    const dir = path.dirname(queuePath)

    await fs.ensureDir(dir)

    const data: QueueFile = {
      version: QUEUE_VERSION,
      operations: this.operations,
    }

    await fs.writeJson(queuePath, data, { spaces: 2 })
  }

  async enqueue(operation: QueuedOperation): Promise<QueuedOperation> {
    await this.load()

    const queuedOp: QueuedOperation = {
      ...operation,
      id: operation.id || generateId(),
    }

    this.operations.push(queuedOp)
    await this.save()

    return queuedOp
  }

  async dequeue(): Promise<QueuedOperation | null> {
    await this.load()

    if (this.operations.length === 0) {
      return null
    }

    const operation = this.operations.shift() ?? null
    await this.save()

    return operation
  }

  async peek(): Promise<QueuedOperation | null> {
    await this.load()

    if (this.operations.length === 0) {
      return null
    }

    return this.operations[0]
  }

  async getPendingCount(): Promise<number> {
    await this.load()
    return this.operations.length
  }

  async getAll(): Promise<QueuedOperation[]> {
    await this.load()
    return [...this.operations]
  }

  async clear(): Promise<void> {
    await this.load()
    this.operations = []
    await this.save()
  }

  async remove(id: string): Promise<boolean> {
    await this.load()

    const index = this.operations.findIndex((op) => op.id === id)

    if (index === -1) {
      return false
    }

    this.operations.splice(index, 1)
    await this.save()

    return true
  }

  async getByFeature(feature: string): Promise<QueuedOperation[]> {
    await this.load()
    return this.operations.filter((op) => op.feature === feature)
  }

  async updateRetries(id: string, retries: number, lastError?: string): Promise<void> {
    await this.load()

    const operation = this.operations.find((op) => op.id === id)

    if (operation) {
      operation.retries = retries
      if (lastError !== undefined) {
        operation.lastError = lastError
      }
      await this.save()
    }
  }

  async hasFeaturePending(feature: string): Promise<boolean> {
    await this.load()
    return this.operations.some((op) => op.feature === feature)
  }
}

export function createSyncQueue(): SyncQueue {
  return new SyncQueueImpl()
}
