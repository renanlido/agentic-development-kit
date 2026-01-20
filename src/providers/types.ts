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

export interface HookConfig {
  type: 'command' | 'script'
  command: string
  timeout?: number
}

export interface HookMatcher {
  matcher?: string
  hooks: HookConfig[]
}

export interface HooksConfig {
  UserPromptSubmit?: HookMatcher[]
  PreToolUse?: HookMatcher[]
  PostToolUse?: HookMatcher[]
  Stop?: HookMatcher[]
}

export interface ModelRoutingPhaseConfig {
  research?: string
  planning?: string
  prd?: string
  implement?: string
  qa?: string
  validation?: string
  docs?: string
  default?: string
}

export interface ModelRoutingConfig {
  enabled: boolean
  mapping?: ModelRoutingPhaseConfig
}

export interface AdkConfig {
  version: string
  integration: IntegrationConfig
  providers: Record<string, ProviderSpecificConfig>
  hooks?: HooksConfig
  modelRouting?: ModelRoutingConfig
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

export const DEFAULT_MODEL_ROUTING_CONFIG: ModelRoutingConfig = {
  enabled: true,
  mapping: {
    research: 'opus',
    planning: 'opus',
    prd: 'opus',
    implement: 'sonnet',
    qa: 'haiku',
    validation: 'haiku',
    docs: 'sonnet',
    default: 'sonnet',
  },
}

export const DEFAULT_ADK_CONFIG: AdkConfig = {
  version: '1.0.0',
  integration: DEFAULT_INTEGRATION_CONFIG,
  providers: {},
  modelRouting: DEFAULT_MODEL_ROUTING_CONFIG,
}
