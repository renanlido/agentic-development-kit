import path from 'node:path'
import fs from 'fs-extra'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

import {
  createSyncQueue,
  type QueuedOperation,
  type SyncQueue,
} from '../../src/utils/sync-queue.js'

describe('SyncQueue', () => {
  const testDir = path.join(process.cwd(), '.test-sync-queue')
  const adkDir = path.join(testDir, '.adk')
  const queuePath = path.join(adkDir, 'sync-queue.json')

  let queue: SyncQueue

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
    queue = createSyncQueue()
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  describe('enqueue', () => {
    it('should add operation to the queue', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'create',
        feature: 'test-feature',
        data: { name: 'test-feature', phase: 'prd' },
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(operation)

      const pending = await queue.getPendingCount()
      expect(pending).toBe(1)
    })

    it('should persist queue to disk', async () => {
      const operation: QueuedOperation = {
        id: 'op-persist',
        type: 'update',
        feature: 'persist-feature',
        data: { phase: 'research' },
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(operation)

      expect(await fs.pathExists(queuePath)).toBe(true)

      const savedQueue = await fs.readJson(queuePath)
      expect(savedQueue.operations).toHaveLength(1)
      expect(savedQueue.operations[0].id).toBe('op-persist')
    })

    it('should maintain order of operations', async () => {
      const op1: QueuedOperation = {
        id: 'op-1',
        type: 'create',
        feature: 'feature-1',
        data: {},
        createdAt: '2026-01-16T10:00:00Z',
        retries: 0,
      }

      const op2: QueuedOperation = {
        id: 'op-2',
        type: 'update',
        feature: 'feature-2',
        data: {},
        createdAt: '2026-01-16T10:01:00Z',
        retries: 0,
      }

      await queue.enqueue(op1)
      await queue.enqueue(op2)

      const operations = await queue.getAll()
      expect(operations[0].id).toBe('op-1')
      expect(operations[1].id).toBe('op-2')
    })

    it('should generate unique id if not provided', async () => {
      const operation: Omit<QueuedOperation, 'id'> = {
        type: 'create',
        feature: 'auto-id-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      const queued = await queue.enqueue(operation as QueuedOperation)

      expect(queued.id).toBeDefined()
      expect(queued.id.length).toBeGreaterThan(0)
    })
  })

  describe('dequeue', () => {
    it('should return null when queue is empty', async () => {
      const operation = await queue.dequeue()
      expect(operation).toBeNull()
    })

    it('should return and remove first operation', async () => {
      const op1: QueuedOperation = {
        id: 'op-dequeue-1',
        type: 'create',
        feature: 'feature-1',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      const op2: QueuedOperation = {
        id: 'op-dequeue-2',
        type: 'update',
        feature: 'feature-2',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(op1)
      await queue.enqueue(op2)

      const dequeued = await queue.dequeue()
      expect(dequeued?.id).toBe('op-dequeue-1')

      const pending = await queue.getPendingCount()
      expect(pending).toBe(1)
    })

    it('should persist changes after dequeue', async () => {
      const operation: QueuedOperation = {
        id: 'op-persist-dequeue',
        type: 'delete',
        feature: 'delete-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(operation)
      await queue.dequeue()

      const savedQueue = await fs.readJson(queuePath)
      expect(savedQueue.operations).toHaveLength(0)
    })
  })

  describe('peek', () => {
    it('should return first operation without removing it', async () => {
      const operation: QueuedOperation = {
        id: 'op-peek',
        type: 'create',
        feature: 'peek-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(operation)

      const peeked = await queue.peek()
      expect(peeked?.id).toBe('op-peek')

      const pending = await queue.getPendingCount()
      expect(pending).toBe(1)
    })

    it('should return null when queue is empty', async () => {
      const peeked = await queue.peek()
      expect(peeked).toBeNull()
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 for empty queue', async () => {
      const count = await queue.getPendingCount()
      expect(count).toBe(0)
    })

    it('should return correct count', async () => {
      await queue.enqueue({
        id: 'op-count-1',
        type: 'create',
        feature: 'f1',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.enqueue({
        id: 'op-count-2',
        type: 'create',
        feature: 'f2',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      const count = await queue.getPendingCount()
      expect(count).toBe(2)
    })
  })

  describe('getAll', () => {
    it('should return empty array for empty queue', async () => {
      const operations = await queue.getAll()
      expect(operations).toEqual([])
    })

    it('should return all operations', async () => {
      await queue.enqueue({
        id: 'op-all-1',
        type: 'create',
        feature: 'f1',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.enqueue({
        id: 'op-all-2',
        type: 'update',
        feature: 'f2',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      const operations = await queue.getAll()
      expect(operations).toHaveLength(2)
    })
  })

  describe('clear', () => {
    it('should remove all operations', async () => {
      await queue.enqueue({
        id: 'op-clear-1',
        type: 'create',
        feature: 'f1',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.enqueue({
        id: 'op-clear-2',
        type: 'create',
        feature: 'f2',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.clear()

      const count = await queue.getPendingCount()
      expect(count).toBe(0)
    })

    it('should persist empty queue to disk', async () => {
      await queue.enqueue({
        id: 'op-clear-persist',
        type: 'create',
        feature: 'f1',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.clear()

      const savedQueue = await fs.readJson(queuePath)
      expect(savedQueue.operations).toHaveLength(0)
    })
  })

  describe('remove', () => {
    it('should remove specific operation by id', async () => {
      await queue.enqueue({
        id: 'op-remove-1',
        type: 'create',
        feature: 'f1',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.enqueue({
        id: 'op-remove-2',
        type: 'update',
        feature: 'f2',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      const removed = await queue.remove('op-remove-1')
      expect(removed).toBe(true)

      const operations = await queue.getAll()
      expect(operations).toHaveLength(1)
      expect(operations[0].id).toBe('op-remove-2')
    })

    it('should return false when operation not found', async () => {
      const removed = await queue.remove('non-existent')
      expect(removed).toBe(false)
    })
  })

  describe('getByFeature', () => {
    it('should return operations for specific feature', async () => {
      await queue.enqueue({
        id: 'op-feature-1',
        type: 'create',
        feature: 'feature-a',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.enqueue({
        id: 'op-feature-2',
        type: 'update',
        feature: 'feature-a',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.enqueue({
        id: 'op-feature-3',
        type: 'create',
        feature: 'feature-b',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      const operations = await queue.getByFeature('feature-a')
      expect(operations).toHaveLength(2)
      expect(operations.every((op) => op.feature === 'feature-a')).toBe(true)
    })

    it('should return empty array when no operations for feature', async () => {
      const operations = await queue.getByFeature('non-existent')
      expect(operations).toEqual([])
    })
  })

  describe('updateRetries', () => {
    it('should increment retry count for operation', async () => {
      await queue.enqueue({
        id: 'op-retry',
        type: 'create',
        feature: 'retry-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.updateRetries('op-retry', 1, 'Network error')

      const operations = await queue.getAll()
      expect(operations[0].retries).toBe(1)
      expect(operations[0].lastError).toBe('Network error')
    })

    it('should persist retry updates', async () => {
      await queue.enqueue({
        id: 'op-retry-persist',
        type: 'update',
        feature: 'retry-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      await queue.updateRetries('op-retry-persist', 2, 'Rate limited')

      const savedQueue = await fs.readJson(queuePath)
      expect(savedQueue.operations[0].retries).toBe(2)
      expect(savedQueue.operations[0].lastError).toBe('Rate limited')
    })
  })

  describe('hasFeaturePending', () => {
    it('should return true when feature has pending operations', async () => {
      await queue.enqueue({
        id: 'op-pending',
        type: 'create',
        feature: 'pending-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      const hasPending = await queue.hasFeaturePending('pending-feature')
      expect(hasPending).toBe(true)
    })

    it('should return false when feature has no pending operations', async () => {
      const hasPending = await queue.hasFeaturePending('no-pending-feature')
      expect(hasPending).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should load existing queue from disk on init', async () => {
      const existingQueue = {
        version: '1.0.0',
        operations: [
          {
            id: 'existing-op',
            type: 'create',
            feature: 'existing-feature',
            data: { phase: 'prd' },
            createdAt: '2026-01-16T10:00:00Z',
            retries: 0,
          },
        ],
      }

      await fs.writeJson(queuePath, existingQueue, { spaces: 2 })

      const newQueue = createSyncQueue()
      await newQueue.load()

      const operations = await newQueue.getAll()
      expect(operations).toHaveLength(1)
      expect(operations[0].id).toBe('existing-op')
    })

    it('should handle corrupted queue file gracefully', async () => {
      await fs.writeFile(queuePath, 'not valid json {{{')

      const newQueue = createSyncQueue()
      await newQueue.load()

      const count = await newQueue.getPendingCount()
      expect(count).toBe(0)
    })

    it('should create .adk directory if it does not exist', async () => {
      await fs.remove(adkDir)

      const newQueue = createSyncQueue()
      await newQueue.enqueue({
        id: 'op-create-dir',
        type: 'create',
        feature: 'create-dir-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      })

      expect(await fs.pathExists(queuePath)).toBe(true)
    })
  })

  describe('operation types', () => {
    it('should handle create operation', async () => {
      const op: QueuedOperation = {
        id: 'op-type-create',
        type: 'create',
        feature: 'new-feature',
        data: { name: 'new-feature', phase: 'prd', progress: 0 },
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(op)

      const operations = await queue.getAll()
      expect(operations[0].type).toBe('create')
    })

    it('should handle update operation', async () => {
      const op: QueuedOperation = {
        id: 'op-type-update',
        type: 'update',
        feature: 'existing-feature',
        data: { phase: 'research', progress: 25 },
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(op)

      const operations = await queue.getAll()
      expect(operations[0].type).toBe('update')
    })

    it('should handle delete operation', async () => {
      const op: QueuedOperation = {
        id: 'op-type-delete',
        type: 'delete',
        feature: 'delete-feature',
        data: {},
        createdAt: new Date().toISOString(),
        retries: 0,
      }

      await queue.enqueue(op)

      const operations = await queue.getAll()
      expect(operations[0].type).toBe('delete')
    })
  })

  describe('concurrent access', () => {
    it('should handle multiple enqueue operations', async () => {
      const enqueuePromises = Array.from({ length: 5 }, (_, i) =>
        queue.enqueue({
          id: `op-concurrent-${i}`,
          type: 'create',
          feature: `feature-${i}`,
          data: {},
          createdAt: new Date().toISOString(),
          retries: 0,
        })
      )

      await Promise.all(enqueuePromises)

      const count = await queue.getPendingCount()
      expect(count).toBe(5)
    })
  })
})
