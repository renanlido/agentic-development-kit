import path from 'node:path'
import fs from 'fs-extra'
import type { AdkConfig, IntegrationConfig } from '../providers/types.js'
import { DEFAULT_ADK_CONFIG, DEFAULT_INTEGRATION_CONFIG } from '../providers/types.js'
import { getMainRepoPath } from './paths.js'

export function getConfigPath(): string {
  return path.join(getMainRepoPath(), '.adk', 'config.json')
}

export function getAdkDir(): string {
  return path.join(getMainRepoPath(), '.adk')
}

function mergeWithDefaults(config: Partial<AdkConfig>): AdkConfig {
  return {
    version: config.version ?? DEFAULT_ADK_CONFIG.version,
    integration: {
      ...DEFAULT_INTEGRATION_CONFIG,
      ...config.integration,
    },
    providers: config.providers ?? {},
  }
}

export async function loadConfig(): Promise<AdkConfig> {
  const configPath = getConfigPath()

  try {
    if (await fs.pathExists(configPath)) {
      const content = await fs.readJson(configPath)
      return mergeWithDefaults(content)
    }
  } catch {
    return { ...DEFAULT_ADK_CONFIG }
  }

  return { ...DEFAULT_ADK_CONFIG }
}

export async function saveConfig(config: AdkConfig): Promise<void> {
  const configPath = getConfigPath()
  const adkDir = getAdkDir()

  await fs.ensureDir(adkDir)

  const sanitizedConfig: AdkConfig = {
    version: config.version,
    integration: {
      provider: config.integration.provider,
      enabled: config.integration.enabled,
      autoSync: config.integration.autoSync,
      syncOnPhaseChange: config.integration.syncOnPhaseChange,
      conflictStrategy: config.integration.conflictStrategy,
    },
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([key, value]) => {
        const { ...rest } = value
        const filtered = Object.fromEntries(
          Object.entries(rest).filter(
            ([k]) => !k.toLowerCase().includes('token') && !k.toLowerCase().includes('secret')
          )
        )
        return [key, filtered]
      })
    ),
  }

  await fs.writeJson(configPath, sanitizedConfig, { spaces: 2 })
}

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const config = await loadConfig()
  return config.integration
}

export async function updateIntegrationConfig(updates: Partial<IntegrationConfig>): Promise<void> {
  const config = await loadConfig()

  config.integration = {
    ...config.integration,
    ...updates,
  }

  await saveConfig(config)
}

export async function getProviderConfig<T extends Record<string, unknown>>(
  provider: string
): Promise<T | null> {
  const config = await loadConfig()
  const providerConfig = config.providers[provider]

  if (!providerConfig) {
    return null
  }

  return providerConfig as T
}

export async function setProviderConfig<T extends Record<string, unknown>>(
  provider: string,
  providerConfig: T
): Promise<void> {
  const config = await loadConfig()

  config.providers[provider] = providerConfig

  await saveConfig(config)
}

export async function isIntegrationEnabled(): Promise<boolean> {
  const integration = await getIntegrationConfig()
  return integration.enabled && integration.provider !== null
}
