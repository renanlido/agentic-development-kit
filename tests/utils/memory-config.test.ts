import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import * as path from 'node:path'

const pathExists = jest.fn<(path: string) => Promise<boolean>>()
const readJson = jest.fn<(path: string) => Promise<unknown>>()
const ensureDir = jest.fn<(path: string) => Promise<void>>()
const writeJson = jest.fn<(path: string, data: unknown, options?: { spaces?: number }) => Promise<void>>()

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => pathExists(...(args as [string])),
  readJson: (...args: unknown[]) => readJson(...(args as [string])),
  ensureDir: (...args: unknown[]) => ensureDir(...(args as [string])),
  writeJson: (...args: unknown[]) => writeJson(...(args as [string, unknown, { spaces?: number } | undefined])),
}))

import { loadMemoryConfig, saveMemoryConfig, getMemoryConfigPath } from '../../src/utils/memory-config'
import type { MemoryConfig } from '../../src/types/mcp-memory'

const mockedFs = {
  pathExists,
  readJson,
  ensureDir,
  writeJson,
}

describe('memory-config', () => {
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
    indexPatterns: ['.claude/**/*.md', '.claude/**/*.txt'],
    ignorePatterns: ['**/.env*', '**/credentials*', '**/*.key', '**/*.pem', '**/secrets*'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getMemoryConfigPath', () => {
    it('should return .adk/memory.json path', () => {
      const configPath = getMemoryConfigPath()
      expect(configPath).toContain('.adk')
      expect(configPath).toContain('memory.json')
      expect(path.isAbsolute(configPath)).toBe(true)
    })

    it('should use process.cwd() as base', () => {
      const configPath = getMemoryConfigPath()
      const cwd = process.cwd()
      expect(configPath).toBe(path.join(cwd, '.adk', 'memory.json'))
    })
  })

  describe('loadMemoryConfig', () => {
    it('should load existing config file', async () => {
      mockedFs.pathExists.mockResolvedValue(true)
      mockedFs.readJson.mockResolvedValue(mockConfig)

      const config = await loadMemoryConfig()

      expect(config).toEqual(mockConfig)
      expect(mockedFs.pathExists).toHaveBeenCalledWith(expect.stringContaining('memory.json'))
      expect(mockedFs.readJson).toHaveBeenCalledWith(expect.stringContaining('memory.json'))
    })

    it('should return default config when file does not exist', async () => {
      mockedFs.pathExists.mockResolvedValue(false)

      const config = await loadMemoryConfig()

      expect(config.provider).toBe('mcp-memory')
      expect(config.version).toBe('1.0.0')
      expect(config.storage.path).toBe('.adk/memory.db')
      expect(config.embedding.model).toBe('nomic-embed-text-v1.5')
      expect(mockedFs.pathExists).toHaveBeenCalled()
      expect(mockedFs.readJson).not.toHaveBeenCalled()
    })

    it('should merge partial config with defaults', async () => {
      const partialConfig = {
        provider: 'mcp-local-rag' as const,
        storage: {
          path: '.custom/memory.db',
        },
      }

      mockedFs.pathExists.mockResolvedValue(true)
      mockedFs.readJson.mockResolvedValue(partialConfig)

      const config = await loadMemoryConfig()

      expect(config.provider).toBe('mcp-local-rag')
      expect(config.storage.path).toBe('.custom/memory.db')
      expect(config.storage.maxSize).toBe('500MB')
      expect(config.embedding.model).toBe('nomic-embed-text-v1.5')
      expect(config.retrieval.topK).toBe(10)
    })

    it('should throw error on invalid config', async () => {
      const invalidConfig = {
        provider: 'invalid-provider',
      }

      mockedFs.pathExists.mockResolvedValue(true)
      mockedFs.readJson.mockResolvedValue(invalidConfig)

      await expect(loadMemoryConfig()).rejects.toThrow('Invalid MemoryConfig')
    })

    it('should throw error when file read fails', async () => {
      mockedFs.pathExists.mockResolvedValue(true)
      mockedFs.readJson.mockRejectedValue(new Error('File read error'))

      await expect(loadMemoryConfig()).rejects.toThrow('File read error')
    })

    it('should validate numeric ranges in loaded config', async () => {
      const invalidConfig = {
        provider: 'mcp-memory' as const,
        retrieval: {
          threshold: 1.5,
        },
      }

      mockedFs.pathExists.mockResolvedValue(true)
      mockedFs.readJson.mockResolvedValue(invalidConfig)

      await expect(loadMemoryConfig()).rejects.toThrow('Invalid MemoryConfig')
    })
  })

  describe('saveMemoryConfig', () => {
    it('should save config to file', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined)
      mockedFs.writeJson.mockResolvedValue(undefined)

      await saveMemoryConfig(mockConfig)

      expect(mockedFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('.adk'))
      expect(mockedFs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('memory.json'),
        mockConfig,
        { spaces: 2 },
      )
    })

    it('should create .adk directory if it does not exist', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined)
      mockedFs.writeJson.mockResolvedValue(undefined)

      await saveMemoryConfig(mockConfig)

      const configPath = getMemoryConfigPath()
      const adkDir = path.dirname(configPath)

      expect(mockedFs.ensureDir).toHaveBeenCalledWith(adkDir)
    })

    it('should format JSON with 2 spaces', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined)
      mockedFs.writeJson.mockResolvedValue(undefined)

      await saveMemoryConfig(mockConfig)

      expect(mockedFs.writeJson).toHaveBeenCalledWith(expect.any(String), mockConfig, { spaces: 2 })
    })

    it('should throw error when directory creation fails', async () => {
      mockedFs.ensureDir.mockRejectedValue(new Error('Permission denied'))
      mockedFs.writeJson.mockResolvedValue(undefined)

      await expect(saveMemoryConfig(mockConfig)).rejects.toThrow('Permission denied')
      expect(mockedFs.writeJson).not.toHaveBeenCalled()
    })

    it('should throw error when file write fails', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined)
      mockedFs.writeJson.mockRejectedValue(new Error('Disk full'))

      await expect(saveMemoryConfig(mockConfig)).rejects.toThrow('Disk full')
    })

    it('should save config with custom values', async () => {
      const customConfig: MemoryConfig = {
        ...mockConfig,
        provider: 'mcp-local-rag',
        storage: {
          path: '/custom/path/memory.db',
          maxSize: '1GB',
        },
        embedding: {
          model: 'custom-model',
          chunkSize: 1024,
          overlap: 200,
        },
      }

      mockedFs.ensureDir.mockResolvedValue(undefined)
      mockedFs.writeJson.mockResolvedValue(undefined)

      await saveMemoryConfig(customConfig)

      expect(mockedFs.writeJson).toHaveBeenCalledWith(expect.any(String), customConfig, { spaces: 2 })
    })
  })

  describe('round-trip', () => {
    it('should preserve config after save and load', async () => {
      let savedConfig: MemoryConfig | null = null

      mockedFs.ensureDir.mockResolvedValue(undefined)
      mockedFs.writeJson.mockImplementation(async (_path: string, data: unknown) => {
        savedConfig = data as MemoryConfig
      })

      await saveMemoryConfig(mockConfig)

      mockedFs.pathExists.mockResolvedValue(true)
      mockedFs.readJson.mockImplementation(async () => savedConfig)

      const loadedConfig = await loadMemoryConfig()

      expect(loadedConfig).toEqual(mockConfig)
    })
  })
})
