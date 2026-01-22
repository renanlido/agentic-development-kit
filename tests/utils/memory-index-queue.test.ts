import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

const mockMemoryMCP = {
  connect: jest.fn<() => Promise<boolean>>(),
  disconnect: jest.fn<() => Promise<void>>(),
  index: jest.fn<
    (content: string, metadata: Record<string, unknown>) => Promise<{
      success: boolean
      documentId?: string
      error?: string
    }>
  >(),
}

const mockFs = {
  pathExists: jest.fn<(path: string) => Promise<boolean>>(),
  readFile: jest.fn<(path: string, encoding: string) => Promise<string>>(),
  stat: jest.fn<(path: string) => Promise<{ mtime: Date; size: number }>>(),
}

const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

jest.mock('../../src/utils/memory-mcp', () => ({
  MemoryMCP: jest.fn().mockImplementation(() => mockMemoryMCP),
}))

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => mockFs.pathExists(...(args as [string])),
  readFile: (...args: unknown[]) => mockFs.readFile(...(args as [string, string])),
  stat: (...args: unknown[]) => mockFs.stat(...(args as [string])),
}))

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger,
}))

// Import after mocks
import { MemoryIndexQueue } from '../../src/utils/memory-index-queue'

describe('MemoryIndexQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockMemoryMCP.connect.mockResolvedValue(true)
    mockMemoryMCP.disconnect.mockResolvedValue(undefined)
    mockFs.pathExists.mockResolvedValue(true)
    mockFs.readFile.mockResolvedValue('Test content')
    mockFs.stat.mockResolvedValue({
      mtime: new Date('2026-01-21T10:00:00Z'),
      size: 100,
    })
    mockMemoryMCP.index.mockResolvedValue({
      success: true,
      documentId: 'doc-123',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with default debounce', () => {
      const queue = new MemoryIndexQueue()
      expect(queue).toBeDefined()
      expect(queue.getSize()).toBe(0)
    })

    it('should create instance with custom debounce', () => {
      const queue = new MemoryIndexQueue({ debounceMs: 5000 })
      expect(queue).toBeDefined()
    })
  })

  describe('enqueue', () => {
    it('should add file to queue', () => {
      const queue = new MemoryIndexQueue()
      queue.enqueue('test.md')

      expect(queue.getSize()).toBe(1)
      expect(queue.getPending()).toContain('test.md')
    })

    it('should deduplicate paths', () => {
      const queue = new MemoryIndexQueue()
      queue.enqueue('test.md')
      queue.enqueue('test.md')
      queue.enqueue('test.md')

      expect(queue.getSize()).toBe(1)
    })

    it('should add multiple different files', () => {
      const queue = new MemoryIndexQueue()
      queue.enqueue('file1.md')
      queue.enqueue('file2.md')
      queue.enqueue('file3.md')

      expect(queue.getSize()).toBe(3)
    })

    it('should support enqueuing with metadata', () => {
      const queue = new MemoryIndexQueue()
      queue.enqueue('test.md', { tags: ['auth'], feature: 'login' })

      expect(queue.getSize()).toBe(1)
    })
  })

  describe('debounce', () => {
    it('should not process immediately', () => {
      const queue = new MemoryIndexQueue({ debounceMs: 1000 })
      const processSpy = jest.spyOn(queue, 'processQueue')

      queue.enqueue('test.md')

      expect(processSpy).not.toHaveBeenCalled()
    })

    it('should process after debounce delay', async () => {
      const queue = new MemoryIndexQueue({ debounceMs: 1000 })
      queue.enqueue('test.md')

      jest.advanceTimersByTime(1000)
      await jest.runAllTimersAsync()

      expect(mockMemoryMCP.index).toHaveBeenCalled()
    })

    it('should reset timer on new enqueue', async () => {
      const queue = new MemoryIndexQueue({ debounceMs: 1000 })
      queue.enqueue('file1.md')

      jest.advanceTimersByTime(500)
      queue.enqueue('file2.md')

      jest.advanceTimersByTime(500)
      expect(mockMemoryMCP.index).not.toHaveBeenCalled()

      jest.advanceTimersByTime(500)
      await jest.runAllTimersAsync()

      expect(mockMemoryMCP.index).toHaveBeenCalled()
    })

    it('should batch multiple enqueues within debounce window', async () => {
      const queue = new MemoryIndexQueue({ debounceMs: 1000 })

      queue.enqueue('file1.md')
      queue.enqueue('file2.md')
      queue.enqueue('file3.md')

      expect(queue.getSize()).toBe(3)

      jest.advanceTimersByTime(1000)
      await jest.runAllTimersAsync()

      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(3)
    })
  })

  describe('processQueue', () => {
    it('should process all pending files', async () => {
      const queue = new MemoryIndexQueue({ debounceMs: 0 })
      queue.enqueue('file1.md')
      queue.enqueue('file2.md')

      await queue.processQueue()

      expect(mockMemoryMCP.connect).toHaveBeenCalled()
      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(2)
      expect(mockMemoryMCP.disconnect).toHaveBeenCalled()
      expect(queue.getSize()).toBe(0)
    })

    it('should handle empty queue', async () => {
      const queue = new MemoryIndexQueue()

      await queue.processQueue()

      expect(mockMemoryMCP.connect).not.toHaveBeenCalled()
      expect(mockMemoryMCP.index).not.toHaveBeenCalled()
    })

    it('should skip non-existent files', async () => {
      mockFs.pathExists.mockImplementation(async (path: string) => {
        return path !== 'missing.md'
      })

      const queue = new MemoryIndexQueue({ debounceMs: 0 })
      queue.enqueue('file1.md')
      queue.enqueue('missing.md')
      queue.enqueue('file2.md')

      await queue.processQueue()

      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('missing.md'))
    })

    it('should handle index failures gracefully', async () => {
      mockMemoryMCP.index
        .mockResolvedValueOnce({ success: true, documentId: 'doc-1' })
        .mockResolvedValueOnce({ success: false, error: 'Index failed' })
        .mockResolvedValueOnce({ success: true, documentId: 'doc-3' })

      const queue = new MemoryIndexQueue({ debounceMs: 0 })
      queue.enqueue('file1.md')
      queue.enqueue('file2.md')
      queue.enqueue('file3.md')

      await queue.processQueue()

      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(3)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('file2.md'))
    })

    it('should use custom metadata when provided', async () => {
      const queue = new MemoryIndexQueue({ debounceMs: 0 })
      queue.enqueue('test.md', { tags: ['auth', 'security'], feature: 'login' })

      await queue.processQueue()

      expect(mockMemoryMCP.index).toHaveBeenCalledWith(
        'Test content',
        expect.objectContaining({
          tags: ['auth', 'security'],
          feature: 'login',
        })
      )
    })
  })

  describe('clear', () => {
    it('should clear all pending items', () => {
      const queue = new MemoryIndexQueue()
      queue.enqueue('file1.md')
      queue.enqueue('file2.md')
      queue.enqueue('file3.md')

      expect(queue.getSize()).toBe(3)

      queue.clear()

      expect(queue.getSize()).toBe(0)
      expect(queue.getPending()).toEqual([])
    })

    it('should cancel pending debounce timer', () => {
      const queue = new MemoryIndexQueue({ debounceMs: 1000 })
      queue.enqueue('test.md')

      queue.clear()

      jest.advanceTimersByTime(1000)

      expect(mockMemoryMCP.index).not.toHaveBeenCalled()
    })
  })

  describe('getSize', () => {
    it('should return correct queue size', () => {
      const queue = new MemoryIndexQueue()

      expect(queue.getSize()).toBe(0)

      queue.enqueue('file1.md')
      expect(queue.getSize()).toBe(1)

      queue.enqueue('file2.md')
      expect(queue.getSize()).toBe(2)

      queue.enqueue('file1.md') // duplicate
      expect(queue.getSize()).toBe(2)
    })
  })

  describe('getPending', () => {
    it('should return list of pending paths', () => {
      const queue = new MemoryIndexQueue()
      queue.enqueue('file1.md')
      queue.enqueue('file2.md')
      queue.enqueue('file3.md')

      const pending = queue.getPending()

      expect(pending).toHaveLength(3)
      expect(pending).toContain('file1.md')
      expect(pending).toContain('file2.md')
      expect(pending).toContain('file3.md')
    })

    it('should return empty array when queue is empty', () => {
      const queue = new MemoryIndexQueue()

      expect(queue.getPending()).toEqual([])
    })
  })

  describe('concurrent processing', () => {
    it('should not allow concurrent processQueue calls', async () => {
      const queue = new MemoryIndexQueue({ debounceMs: 0 })
      queue.enqueue('file1.md')
      queue.enqueue('file2.md')

      const promise1 = queue.processQueue()
      const promise2 = queue.processQueue()

      await Promise.all([promise1, promise2])

      // Should only process once
      expect(mockMemoryMCP.connect).toHaveBeenCalledTimes(1)
      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(2)
    })
  })
})
