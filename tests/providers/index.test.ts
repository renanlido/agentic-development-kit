import path from 'node:path'
import fs from 'fs-extra'
import {
  getConfiguredProvider,
  getProvider,
  isProviderConfigured,
  providerRegistry,
  registerProvider,
} from '../../src/providers/index.js'
import { LocalProvider } from '../../src/providers/local.js'
import type { ProjectProvider } from '../../src/types/provider.js'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

describe('Provider Factory', () => {
  const testDir = path.join(process.cwd(), '.test-provider-factory')
  const adkDir = path.join(testDir, '.adk')
  const configPath = path.join(adkDir, 'config.json')

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  }, 15000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 15000)

  describe('getProvider', () => {
    it('should return LocalProvider for "local"', () => {
      const provider = getProvider('local')
      expect(provider).toBeInstanceOf(LocalProvider)
      expect(provider.name).toBe('local')
    })

    it('should throw error for unknown provider', () => {
      expect(() => getProvider('unknown-provider')).toThrow()
    })

    it('should throw descriptive error message', () => {
      expect(() => getProvider('nonexistent')).toThrow(/nonexistent/)
    })
  })

  describe('providerRegistry', () => {
    it('should have local provider registered by default', () => {
      const providers = providerRegistry.getAll()
      expect(providers.some((p) => p.name === 'local')).toBe(true)
    })

    it('should allow getting provider by name', () => {
      const provider = providerRegistry.get('local')
      expect(provider).toBeDefined()
      expect(provider?.name).toBe('local')
    })

    it('should return undefined for non-registered provider', () => {
      const provider = providerRegistry.get('not-registered')
      expect(provider).toBeUndefined()
    })
  })

  describe('registerProvider', () => {
    it('should register a new provider', () => {
      const mockProvider: ProjectProvider = {
        name: 'mock-provider',
        displayName: 'Mock Provider',
        isConfigured: jest.fn(),
        testConnection: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        getWorkspaces: jest.fn(),
        getSpaces: jest.fn(),
        getLists: jest.fn(),
        createFeature: jest.fn(),
        updateFeature: jest.fn(),
        getFeature: jest.fn(),
        deleteFeature: jest.fn(),
        syncFeature: jest.fn(),
        getRemoteChanges: jest.fn(),
      }

      registerProvider(mockProvider)

      const retrieved = providerRegistry.get('mock-provider')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('mock-provider')
    })
  })

  describe('getConfiguredProvider', () => {
    it('should return LocalProvider when no integration configured', async () => {
      const provider = await getConfiguredProvider()
      expect(provider).toBeInstanceOf(LocalProvider)
    })

    it('should return configured provider when enabled', async () => {
      const config = {
        version: '1.0.0',
        integration: {
          provider: 'local',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }
      await fs.writeJson(configPath, config, { spaces: 2 })

      const provider = await getConfiguredProvider()
      expect(provider).toBeInstanceOf(LocalProvider)
    })

    it('should return LocalProvider when configured provider not found', async () => {
      const config = {
        version: '1.0.0',
        integration: {
          provider: 'nonexistent-provider',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }
      await fs.writeJson(configPath, config, { spaces: 2 })

      const provider = await getConfiguredProvider()
      expect(provider).toBeInstanceOf(LocalProvider)
    })
  })

  describe('isProviderConfigured', () => {
    it('should return false when no config exists', async () => {
      const result = await isProviderConfigured()
      expect(result).toBe(false)
    })

    it('should return false when integration is disabled', async () => {
      const config = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: false,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }
      await fs.writeJson(configPath, config, { spaces: 2 })

      const result = await isProviderConfigured()
      expect(result).toBe(false)
    })

    it('should return false when provider is null', async () => {
      const config = {
        version: '1.0.0',
        integration: {
          provider: null,
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }
      await fs.writeJson(configPath, config, { spaces: 2 })

      const result = await isProviderConfigured()
      expect(result).toBe(false)
    })

    it('should return true when integration is enabled with valid provider', async () => {
      const config = {
        version: '1.0.0',
        integration: {
          provider: 'local',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }
      await fs.writeJson(configPath, config, { spaces: 2 })

      const result = await isProviderConfigured()
      expect(result).toBe(true)
    })
  })
})
