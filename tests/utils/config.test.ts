import path from 'node:path'
import fs from 'fs-extra'
import type { AdkConfig, IntegrationConfig } from '../../src/providers/types.js'
import {
  getConfigPath,
  getIntegrationConfig,
  loadConfig,
  saveConfig,
  updateIntegrationConfig,
} from '../../src/utils/config.js'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

describe('config utils', () => {
  const testDir = path.join(process.cwd(), '.test-config')
  const adkDir = path.join(testDir, '.adk')
  const configPath = path.join(adkDir, 'config.json')

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  }, 10000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 10000)

  describe('getConfigPath', () => {
    it('should return path to .adk/config.json', () => {
      const result = getConfigPath()
      expect(result).toContain('.adk')
      expect(result).toContain('config.json')
    })
  })

  describe('loadConfig', () => {
    it('should return default config when no config file exists', async () => {
      const config = await loadConfig()

      expect(config).toBeDefined()
      expect(config.version).toBe('1.0.0')
      expect(config.integration).toBeDefined()
      expect(config.integration.enabled).toBe(false)
      expect(config.integration.provider).toBeNull()
    })

    it('should load existing config from file', async () => {
      const existingConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: true,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {
          clickup: {
            workspaceId: 'ws-123',
            spaceId: 'sp-456',
            listId: 'list-789',
          },
        },
      }

      await fs.writeJson(configPath, existingConfig, { spaces: 2 })

      const config = await loadConfig()

      expect(config.integration.provider).toBe('clickup')
      expect(config.integration.enabled).toBe(true)
      expect(config.providers.clickup?.workspaceId).toBe('ws-123')
    })

    it('should handle malformed config file gracefully', async () => {
      await fs.writeFile(configPath, 'not valid json {{{')

      const config = await loadConfig()

      expect(config.version).toBe('1.0.0')
      expect(config.integration.enabled).toBe(false)
    })

    it('should merge partial config with defaults', async () => {
      const partialConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
        },
      }

      await fs.writeJson(configPath, partialConfig, { spaces: 2 })

      const config = await loadConfig()

      expect(config.integration.provider).toBe('clickup')
      expect(config.integration.enabled).toBe(true)
      expect(config.integration.autoSync).toBe(false)
      expect(config.integration.syncOnPhaseChange).toBe(true)
      expect(config.integration.conflictStrategy).toBe('local-wins')
    })
  })

  describe('saveConfig', () => {
    it('should persist configuration to file', async () => {
      const config: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'remote-wins',
        },
        providers: {
          clickup: {
            workspaceId: 'ws-test',
          },
        },
      }

      await saveConfig(config)

      const savedContent = await fs.readJson(configPath)
      expect(savedContent.integration.provider).toBe('clickup')
      expect(savedContent.integration.conflictStrategy).toBe('remote-wins')
    })

    it('should create .adk directory if it does not exist', async () => {
      await fs.remove(adkDir)

      const config: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: null,
          enabled: false,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }

      await saveConfig(config)

      expect(await fs.pathExists(configPath)).toBe(true)
    })

    it('should not include sensitive data (tokens) in config file', async () => {
      const config: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {
          clickup: {
            workspaceId: 'ws-123',
          },
        },
      }

      await saveConfig(config)

      const savedContent = await fs.readFile(configPath, 'utf-8')
      expect(savedContent).not.toContain('token')
      expect(savedContent).not.toContain('pk_')
      expect(savedContent).not.toContain('secret')
    })
  })

  describe('getIntegrationConfig', () => {
    it('should extract integration section from config', async () => {
      const config: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: true,
          syncOnPhaseChange: false,
          conflictStrategy: 'newest-wins',
        },
        providers: {},
      }

      await saveConfig(config)

      const integration = await getIntegrationConfig()

      expect(integration.provider).toBe('clickup')
      expect(integration.enabled).toBe(true)
      expect(integration.autoSync).toBe(true)
      expect(integration.syncOnPhaseChange).toBe(false)
      expect(integration.conflictStrategy).toBe('newest-wins')
    })

    it('should return default integration when no config exists', async () => {
      const integration = await getIntegrationConfig()

      expect(integration.provider).toBeNull()
      expect(integration.enabled).toBe(false)
    })
  })

  describe('updateIntegrationConfig', () => {
    it('should merge partial updates into existing config', async () => {
      const initialConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }

      await saveConfig(initialConfig)

      const partialUpdate: Partial<IntegrationConfig> = {
        autoSync: true,
        conflictStrategy: 'remote-wins',
      }

      await updateIntegrationConfig(partialUpdate)

      const updated = await loadConfig()
      expect(updated.integration.provider).toBe('clickup')
      expect(updated.integration.enabled).toBe(true)
      expect(updated.integration.autoSync).toBe(true)
      expect(updated.integration.conflictStrategy).toBe('remote-wins')
    })

    it('should preserve other config sections when updating integration', async () => {
      const initialConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {
          clickup: {
            workspaceId: 'ws-preserve',
            spaceId: 'sp-preserve',
          },
        },
      }

      await saveConfig(initialConfig)

      await updateIntegrationConfig({ autoSync: true })

      const updated = await loadConfig()
      expect(updated.providers.clickup?.workspaceId).toBe('ws-preserve')
      expect(updated.providers.clickup?.spaceId).toBe('sp-preserve')
      expect(updated.version).toBe('1.0.0')
    })

    it('should handle updating when no config exists', async () => {
      await updateIntegrationConfig({ enabled: true, provider: 'clickup' })

      const config = await loadConfig()
      expect(config.integration.enabled).toBe(true)
      expect(config.integration.provider).toBe('clickup')
      expect(config.integration.autoSync).toBe(false)
    })
  })

  describe('config file location', () => {
    it('should create config file in .adk directory', async () => {
      const config: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: null,
          enabled: false,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {},
      }

      await saveConfig(config)

      const expectedPath = path.join(testDir, '.adk', 'config.json')
      expect(await fs.pathExists(expectedPath)).toBe(true)
    })
  })

  describe('getProviderConfig', () => {
    it('should return provider config when it exists', async () => {
      const { getProviderConfig, setProviderConfig } = await import('../../src/utils/config.js')

      await setProviderConfig('clickup', {
        workspaceId: 'ws-test',
        spaceId: 'sp-test',
      })

      const providerConfig = await getProviderConfig<{ workspaceId: string }>('clickup')
      expect(providerConfig).not.toBeNull()
      expect(providerConfig?.workspaceId).toBe('ws-test')
    })

    it('should return null when provider config does not exist', async () => {
      const { getProviderConfig } = await import('../../src/utils/config.js')

      const providerConfig = await getProviderConfig('nonexistent')
      expect(providerConfig).toBeNull()
    })
  })

  describe('setProviderConfig', () => {
    it('should save provider config', async () => {
      const { setProviderConfig, getProviderConfig } = await import('../../src/utils/config.js')

      await setProviderConfig('clickup', {
        workspaceId: 'ws-new',
        spaceId: 'sp-new',
        listId: 'list-new',
      })

      const config = await getProviderConfig<{ workspaceId: string }>('clickup')
      expect(config?.workspaceId).toBe('ws-new')
    })
  })

  describe('isIntegrationEnabled', () => {
    it('should return true when enabled and provider is set', async () => {
      const { isIntegrationEnabled } = await import('../../src/utils/config.js')

      await updateIntegrationConfig({
        provider: 'clickup',
        enabled: true,
      })

      const result = await isIntegrationEnabled()
      expect(result).toBe(true)
    })

    it('should return false when enabled but provider is null', async () => {
      const { isIntegrationEnabled } = await import('../../src/utils/config.js')

      await updateIntegrationConfig({
        provider: null,
        enabled: true,
      })

      const result = await isIntegrationEnabled()
      expect(result).toBe(false)
    })

    it('should return false when not enabled but provider is set', async () => {
      const { isIntegrationEnabled } = await import('../../src/utils/config.js')

      await updateIntegrationConfig({
        provider: 'clickup',
        enabled: false,
      })

      const result = await isIntegrationEnabled()
      expect(result).toBe(false)
    })

    it('should return false when neither enabled nor provider is set', async () => {
      const { isIntegrationEnabled } = await import('../../src/utils/config.js')

      await updateIntegrationConfig({
        provider: null,
        enabled: false,
      })

      const result = await isIntegrationEnabled()
      expect(result).toBe(false)
    })
  })
})
