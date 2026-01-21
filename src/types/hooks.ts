export interface HookContext {
  activeFeature?: string
  featurePath?: string
  constraintsPath?: string
  progressPath?: string
}

export interface SessionBootstrapResult {
  context: string
  loaded: string[]
  warnings: string[]
}

export interface SessionCheckpointResult {
  snapshotCreated: boolean
  snapshotPath?: string
  progressUpdated: boolean
  duration: number
}

export interface TDDValidationResult {
  isValid: boolean
  warnings: string[]
  testFile?: string
}

export interface StateSyncResult {
  synced: boolean
  filesUpdated: string[]
  errors: string[]
}
