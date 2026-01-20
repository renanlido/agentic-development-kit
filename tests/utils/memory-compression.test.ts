import path from 'node:path'
import fs from 'fs-extra'

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}))

jest.mock('../../src/utils/claude.js', () => ({
  executeClaudeCommand: jest.fn().mockResolvedValue('Compressed content'),
}))

import {
  shouldCompress,
  getCompressionConfig,
  archiveMemory,
  isNearLimit,
  compressMemoryContent,
} from '../../src/utils/memory-compression.js'
import type { TieredMemory } from '../../src/types/context.js'

describe('Memory Compression', () => {
  const testDir = path.join(process.cwd(), '.test-compression')
  const claudeDir = path.join(testDir, '.claude')

  beforeEach(async () => {
    await fs.ensureDir(claudeDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  describe('getCompressionConfig', () => {
    it('should return default compression thresholds', () => {
      const config = getCompressionConfig()

      expect(config.warningThreshold).toBe(800)
      expect(config.compressionThreshold).toBe(1000)
      expect(config.targetAfterCompression).toBe(600)
    })
  })

  describe('shouldCompress', () => {
    it('should return true when lineCount exceeds compression threshold', () => {
      const memory = createMemoryWithLines(1100)

      const result = shouldCompress(memory)

      expect(result).toBe(true)
    })

    it('should return false when lineCount is below threshold', () => {
      const memory = createMemoryWithLines(500)

      const result = shouldCompress(memory)

      expect(result).toBe(false)
    })

    it('should return false when exactly at threshold', () => {
      const memory = createMemoryWithLines(1000)

      const result = shouldCompress(memory)

      expect(result).toBe(false)
    })
  })

  describe('isNearLimit', () => {
    it('should return true when lineCount exceeds warning threshold', () => {
      const memory = createMemoryWithLines(850)

      const result = isNearLimit(memory)

      expect(result).toBe(true)
    })

    it('should return false when lineCount is below warning threshold', () => {
      const memory = createMemoryWithLines(500)

      const result = isNearLimit(memory)

      expect(result).toBe(false)
    })

    it('should return true exactly at warning threshold', () => {
      const memory = createMemoryWithLines(800)

      const result = isNearLimit(memory)

      expect(result).toBe(true)
    })
  })

  describe('archiveMemory', () => {
    const featureName = 'test-feature'

    beforeEach(async () => {
      const featureDir = path.join(claudeDir, 'plans/features', featureName)
      await fs.ensureDir(featureDir)
      await fs.writeFile(path.join(featureDir, 'memory.md'), 'Original memory content')
    })

    it('should create archive file with timestamp', async () => {
      const memoryPath = path.join(claudeDir, 'plans/features', featureName, 'memory.md')

      const archivePath = await archiveMemory(memoryPath)

      expect(archivePath).toContain('.archive-')
      expect(archivePath).toMatch(/\.archive-\d{4}-\d{2}-\d{2}\.md$/)
    })

    it('should preserve original content in archive', async () => {
      const memoryPath = path.join(claudeDir, 'plans/features', featureName, 'memory.md')

      const archivePath = await archiveMemory(memoryPath)

      const archiveContent = await fs.readFile(archivePath, 'utf-8')
      expect(archiveContent).toBe('Original memory content')
    })

    it('should create archive in same directory', async () => {
      const memoryPath = path.join(claudeDir, 'plans/features', featureName, 'memory.md')

      const archivePath = await archiveMemory(memoryPath)

      expect(path.dirname(archivePath)).toBe(path.dirname(memoryPath))
    })
  })

  describe('compressMemoryContent', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return original content when below compression threshold', async () => {
      const content = Array(500).fill('Test line').join('\n')
      const memoryPath = path.join(claudeDir, 'plans/features/test/memory.md')

      const result = await compressMemoryContent(content, memoryPath)

      expect(result).toBe(content)
    })

    it('should call Claude and return compressed content when above threshold', async () => {
      const { executeClaudeCommand } = require('../../src/utils/claude.js')
      const featureName = 'compress-test'
      const featureDir = path.join(claudeDir, 'plans/features', featureName)
      await fs.ensureDir(featureDir)

      const memoryPath = path.join(featureDir, 'memory.md')
      const originalContent = Array(1100).fill('Test line content for compression').join('\n')
      await fs.writeFile(memoryPath, originalContent)

      const result = await compressMemoryContent(originalContent, memoryPath)

      expect(executeClaudeCommand).toHaveBeenCalled()
      expect(result).toBe('Compressed content')
    })

    it('should archive original file before compression', async () => {
      const featureName = 'archive-compress-test'
      const featureDir = path.join(claudeDir, 'plans/features', featureName)
      await fs.ensureDir(featureDir)

      const memoryPath = path.join(featureDir, 'memory.md')
      const originalContent = Array(1100).fill('Test line').join('\n')
      await fs.writeFile(memoryPath, originalContent)

      await compressMemoryContent(originalContent, memoryPath)

      const files = await fs.readdir(featureDir)
      const archiveFile = files.find((f: string) => f.includes('.archive-'))
      expect(archiveFile).toBeDefined()
    })

    it('should return original content when Claude returns empty string', async () => {
      const { executeClaudeCommand } = require('../../src/utils/claude.js')
      executeClaudeCommand.mockResolvedValueOnce('')

      const featureName = 'empty-response-test'
      const featureDir = path.join(claudeDir, 'plans/features', featureName)
      await fs.ensureDir(featureDir)

      const memoryPath = path.join(featureDir, 'memory.md')
      const originalContent = Array(1100).fill('Test line').join('\n')
      await fs.writeFile(memoryPath, originalContent)

      const result = await compressMemoryContent(originalContent, memoryPath)

      expect(result).toBe(originalContent)
    })

    it('should return original content when Claude returns null', async () => {
      const { executeClaudeCommand } = require('../../src/utils/claude.js')
      executeClaudeCommand.mockResolvedValueOnce(null)

      const featureName = 'null-response-test'
      const featureDir = path.join(claudeDir, 'plans/features', featureName)
      await fs.ensureDir(featureDir)

      const memoryPath = path.join(featureDir, 'memory.md')
      const originalContent = Array(1100).fill('Test line').join('\n')
      await fs.writeFile(memoryPath, originalContent)

      const result = await compressMemoryContent(originalContent, memoryPath)

      expect(result).toBe(originalContent)
    })

    it('should exactly at threshold not trigger compression', async () => {
      const content = Array(1000).fill('Test line').join('\n')
      const memoryPath = path.join(claudeDir, 'plans/features/test/memory.md')

      const result = await compressMemoryContent(content, memoryPath)

      expect(result).toBe(content)
    })
  })
})

function createMemoryWithLines(lineCount: number): TieredMemory {
  const lines = Array(lineCount).fill('Test line content').join('\n')

  return {
    tier: 'feature',
    content: lines,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lineCount,
      freshnessScore: 100,
      relevanceScore: 50,
      usageCount: 0,
    },
  }
}
