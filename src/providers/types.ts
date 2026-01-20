export {
  ConflictStrategy,
  LocalFeature,
  ProjectProvider,
  ProviderConfig,
  ProviderConnectionResult,
  ProviderCredentials,
  ProviderList,
  ProviderRegistry,
  ProviderSpace,
  ProviderWorkspace,
  RemoteFeature,
  RemoteTask,
  SyncConflict,
  SyncMetadata,
  SyncResult,
  SyncStatus,
} from '../types/provider.js'

export interface IntegrationConfig {
  provider: string | null
  enabled: boolean
  autoSync: boolean
  syncOnPhaseChange: boolean
  conflictStrategy: import('../types/provider.js').ConflictStrategy
}

export interface AdkConfig {
  version: string
  integration: IntegrationConfig
  providers: Record<string, ProviderSpecificConfig>
}

export interface ProviderSpecificConfig {
  workspaceId?: string
  spaceId?: string
  listId?: string
  customFields?: Record<string, string>
  statusMapping?: Record<string, string>
  [key: string]: unknown
}

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  provider: null,
  enabled: false,
  autoSync: false,
  syncOnPhaseChange: true,
  conflictStrategy: 'local-wins',
}

export const DEFAULT_ADK_CONFIG: AdkConfig = {
  version: '1.0.0',
  integration: DEFAULT_INTEGRATION_CONFIG,
  providers: {},
}
