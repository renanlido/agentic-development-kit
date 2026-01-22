import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockMemoryMCP = {
  connect: jest.fn<() => Promise<boolean>>(),
  disconnect: jest.fn<() => Promise<void>>(),
  index:
    jest.fn<
      (
        content: string,
        metadata: Record<string, unknown>
      ) => Promise<{
        success: boolean
        documentId?: string
        error?: string
      }>
    >(),
  isConnected: jest.fn<() => boolean>(),
}

const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

const mockFs = {
  pathExists: jest.fn<(path: string) => Promise<boolean>>(),
  readFile: jest.fn<(path: string, encoding: string) => Promise<string>>(),
  stat: jest.fn<(path: string) => Promise<{ mtime: Date; size: number }>>(),
}

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  warn: jest.fn().mockReturnThis(),
  text: '',
}

jest.mock('ora', () => jest.fn(() => mockSpinner))

jest.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    gray: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    bold: {
      cyan: (str: string) => str,
    },
  },
  cyan: (str: string) => str,
  gray: (str: string) => str,
  yellow: (str: string) => str,
  green: (str: string) => str,
}))

jest.mock('../../src/utils/memory-mcp', () => ({
  MemoryMCP: jest.fn().mockImplementation(() => mockMemoryMCP),
}))

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger,
}))

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => mockFs.pathExists(...(args as [string])),
  readFile: (...args: unknown[]) => mockFs.readFile(...(args as [string, string])),
  stat: (...args: unknown[]) => mockFs.stat(...(args as [string])),
}))

// Import after mocks
import { memoryCommand } from '../../src/commands/memory'

describe('MemoryCommand - index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMemoryMCP.connect.mockResolvedValue(true)
    mockMemoryMCP.disconnect.mockResolvedValue(undefined)
    mockMemoryMCP.isConnected.mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('single file indexing', () => {
    it('should index a single file successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('# Test Content\n\nThis is a test.')
      mockFs.stat.mockResolvedValue({
        mtime: new Date('2026-01-21T10:00:00Z'),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-123',
      })

      await memoryCommand.index('.claude/test.md')

      expect(mockFs.pathExists).toHaveBeenCalledWith('.claude/test.md')
      expect(mockFs.readFile).toHaveBeenCalledWith('.claude/test.md', 'utf-8')
      expect(mockMemoryMCP.connect).toHaveBeenCalled()
      expect(mockMemoryMCP.index).toHaveBeenCalledWith(
        '# Test Content\n\nThis is a test.',
        expect.objectContaining({
          source: '.claude/test.md',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      )
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('adicionado ao indice')
      )
    })

    it('should fail when file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      const consoleErrorSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)

      await expect(memoryCommand.index('nonexistent.md')).rejects.toThrow('process.exit called')

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
    })

    it('should handle index failure gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Test content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: false,
        error: 'Index failed',
      })

      const consoleErrorSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)

      await expect(memoryCommand.index('test.md')).rejects.toThrow('process.exit called')

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Index failed'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
    })

    it('should include file metadata in index call', async () => {
      const testDate = new Date('2026-01-21T12:00:00Z')

      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: testDate,
        size: 50,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-456',
      })

      await memoryCommand.index('file.md')

      expect(mockMemoryMCP.index).toHaveBeenCalledWith(
        'Content',
        expect.objectContaining({
          source: 'file.md',
          updatedAt: testDate.toISOString(),
        })
      )
    })
  })

  describe('multiple file indexing', () => {
    it('should index multiple files successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockImplementation(async (path: string) => {
        if (path === 'file1.md') {
          return 'Content 1'
        }
        if (path === 'file2.md') {
          return 'Content 2'
        }
        return ''
      })
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-multi',
      })

      await memoryCommand.index(['file1.md', 'file2.md'])

      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(2)
      expect(mockMemoryMCP.index).toHaveBeenCalledWith('Content 1', expect.any(Object))
      expect(mockMemoryMCP.index).toHaveBeenCalledWith('Content 2', expect.any(Object))
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('2 arquivos'))
    })

    it('should skip non-existent files and continue', async () => {
      mockFs.pathExists.mockImplementation(async (path: string) => {
        return path !== 'missing.md'
      })
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-skip',
      })

      await memoryCommand.index(['file1.md', 'missing.md', 'file2.md'])

      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('missing.md'))
    })

    it('should track and report failures', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index
        .mockResolvedValueOnce({ success: true, documentId: 'doc-1' })
        .mockResolvedValueOnce({ success: false, error: 'Failed to index' })
        .mockResolvedValueOnce({ success: true, documentId: 'doc-3' })

      await memoryCommand.index(['file1.md', 'file2.md', 'file3.md'])

      expect(mockMemoryMCP.index).toHaveBeenCalledTimes(3)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('file2.md'))
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('1 falhas'))
    })
  })

  describe('connection handling', () => {
    it('should connect to MCP before indexing', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-conn',
      })

      await memoryCommand.index('file.md')

      expect(mockMemoryMCP.connect).toHaveBeenCalled()
      expect(mockMemoryMCP.index).toHaveBeenCalled()
    })

    it('should disconnect after indexing', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-disconn',
      })

      await memoryCommand.index('file.md')

      expect(mockMemoryMCP.disconnect).toHaveBeenCalled()
    })

    it('should handle connection failure', async () => {
      mockMemoryMCP.connect.mockResolvedValue(false)

      const consoleErrorSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)

      await expect(memoryCommand.index('file.md')).rejects.toThrow('process.exit called')

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('MCP'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'))

      const consoleErrorSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)

      await expect(memoryCommand.index('file.md')).rejects.toThrow('process.exit called')

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Permission denied'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
    })

    it('should handle unexpected errors', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Unexpected error'))

      const consoleErrorSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)

      await expect(memoryCommand.index('file.md')).rejects.toThrow('process.exit called')

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('options', () => {
    it('should support tags option', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-tags',
      })

      await memoryCommand.index('file.md', { tags: ['auth', 'security'] })

      expect(mockMemoryMCP.index).toHaveBeenCalledWith(
        'Content',
        expect.objectContaining({
          tags: ['auth', 'security'],
        })
      )
    })

    it('should support feature option', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-feature',
      })

      await memoryCommand.index('file.md', { feature: 'auth-system' })

      expect(mockMemoryMCP.index).toHaveBeenCalledWith(
        'Content',
        expect.objectContaining({
          feature: 'auth-system',
        })
      )
    })

    it('should support title option', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      })

      mockMemoryMCP.index.mockResolvedValue({
        success: true,
        documentId: 'doc-title',
      })

      await memoryCommand.index('file.md', { title: 'Custom Title' })

      expect(mockMemoryMCP.index).toHaveBeenCalledWith(
        'Content',
        expect.objectContaining({
          title: 'Custom Title',
        })
      )
    })
  })
})
