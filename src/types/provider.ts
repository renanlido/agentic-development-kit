export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error' | 'offline'

export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual'

export interface SyncResult {
  status: SyncStatus
  remoteId?: string
  remoteUrl?: string
  lastSynced: string
  message?: string
  conflicts?: SyncConflict[]
}

export interface SyncConflict {
  field: string
  localValue: unknown
  remoteValue: unknown
  localTimestamp: string
  remoteTimestamp: string
}

export interface RemoteFeature {
  id: string
  name: string
  description?: string
  status: string
  phase?: string
  progress?: number
  url: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface RemoteTask {
  id: string
  name: string
  description?: string
  status: string
  priority?: number
  assignee?: string
  dueDate?: string
  parentId?: string
  url: string
}

export interface LocalFeature {
  name: string
  phase: string
  progress: number
  prdPath?: string
  tasksPath?: string
  researchPath?: string
  planPath?: string
  lastUpdated: string
}

export interface ProviderConfig {
  name: string
  enabled: boolean
  autoSync: boolean
  syncOnPhaseChange: boolean
  conflictStrategy: ConflictStrategy
  credentials?: ProviderCredentials
  settings?: Record<string, unknown>
}

export interface ProviderCredentials {
  token?: string
  workspaceId?: string
  spaceId?: string
  listId?: string
  [key: string]: string | undefined
}

export interface ProviderConnectionResult {
  success: boolean
  message: string
  workspaces?: ProviderWorkspace[]
}

export interface ProviderWorkspace {
  id: string
  name: string
}

export interface ProviderSpace {
  id: string
  name: string
}

export interface ProviderList {
  id: string
  name: string
  taskCount?: number
}

export interface SyncMetadata {
  provider: string
  remoteId: string
  remoteUrl: string
  lastSynced: string
  status: SyncStatus
  pendingChanges: string[]
}

export interface ProjectProvider {
  readonly name: string
  readonly displayName: string

  isConfigured(): Promise<boolean>
  testConnection(): Promise<ProviderConnectionResult>

  connect(credentials: ProviderCredentials): Promise<ProviderConnectionResult>
  disconnect(): Promise<void>

  getWorkspaces(): Promise<ProviderWorkspace[]>
  getSpaces(workspaceId: string): Promise<ProviderSpace[]>
  getLists(spaceId: string): Promise<ProviderList[]>

  createFeature(feature: LocalFeature): Promise<RemoteFeature>
  updateFeature(remoteId: string, feature: Partial<LocalFeature>): Promise<RemoteFeature>
  getFeature(remoteId: string): Promise<RemoteFeature | null>
  deleteFeature(remoteId: string): Promise<void>

  syncFeature(feature: LocalFeature, remoteId?: string): Promise<SyncResult>
  getRemoteChanges(since: Date): Promise<RemoteFeature[]>
}

export interface ProviderRegistry {
  register(provider: ProjectProvider): void
  get(name: string): ProjectProvider | undefined
  getAll(): ProjectProvider[]
  getConfigured(): Promise<ProjectProvider | undefined>
}
