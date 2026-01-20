import type { ProjectProvider, ProviderRegistry } from '../types/provider.js'
import { getIntegrationConfig } from '../utils/config.js'
import { ClickUpProvider } from './clickup/index.js'
import { LocalProvider } from './local.js'

class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<string, ProjectProvider>()

  register(provider: ProjectProvider): void {
    this.providers.set(provider.name, provider)
  }

  get(name: string): ProjectProvider | undefined {
    return this.providers.get(name)
  }

  getAll(): ProjectProvider[] {
    return Array.from(this.providers.values())
  }

  async getConfigured(): Promise<ProjectProvider | undefined> {
    const config = await getIntegrationConfig()

    if (!config.enabled || !config.provider) {
      return this.get('local')
    }

    const provider = this.get(config.provider)
    return provider ?? this.get('local')
  }
}

export const providerRegistry = new ProviderRegistryImpl()

providerRegistry.register(new LocalProvider())
providerRegistry.register(new ClickUpProvider())

export function registerProvider(provider: ProjectProvider): void {
  providerRegistry.register(provider)
}

export function getProvider(name: string): ProjectProvider {
  const provider = providerRegistry.get(name)

  if (!provider) {
    throw new Error(
      `Provider "${name}" not found. Available providers: ${providerRegistry
        .getAll()
        .map((p) => p.name)
        .join(', ')}`
    )
  }

  return provider
}

export async function getConfiguredProvider(): Promise<ProjectProvider> {
  const provider = await providerRegistry.getConfigured()
  return provider ?? new LocalProvider()
}

export async function isProviderConfigured(): Promise<boolean> {
  const config = await getIntegrationConfig()
  return config.enabled && config.provider !== null
}

export { ClickUpProvider } from './clickup/index.js'
export { LocalProvider } from './local.js'
