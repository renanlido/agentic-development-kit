export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

export interface TaskState {
  name: string
  status: TaskStatus
  priority?: number
  phase?: string
  notes?: string
  startedAt?: string
  completedAt?: string
}

export interface TransitionEntry {
  timestamp: string
  fromPhase: string
  toPhase: string
  trigger: string
  duration?: number
}

export interface UnifiedFeatureState {
  feature: string
  currentPhase: string
  progress: number
  tasks: TaskState[]
  transitions: TransitionEntry[]
  lastUpdated: string
  lastSynced: string
}

export interface SnapshotData {
  id: string
  trigger: string
  createdAt: string
  state: UnifiedFeatureState
  files: Record<string, string>
}

export interface PhaseMetrics {
  phase: string
  startedAt: string
  completedAt?: string
  duration?: number
  tasksCompleted: number
  tasksTotal: number
  filesModified: string[]
}

export type InconsistencyType =
  | 'phase_mismatch'
  | 'task_status_mismatch'
  | 'orphan_task'
  | 'missing_required'

export type InconsistencySeverity = 'warning' | 'error'

export interface Inconsistency {
  type: InconsistencyType
  severity: InconsistencySeverity
  description: string
  field: string
  progressValue?: unknown
  tasksValue?: unknown
}

export interface Change {
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface ProgressSyncResult {
  success: boolean
  changesApplied: Change[]
  inconsistenciesResolved: number
  snapshotCreated?: string
  duration: number
}

export type ProgressConflictStrategy = 'progress-wins' | 'tasks-wins' | 'merge' | 'manual'

export interface ResolutionResult {
  applied: boolean
  changes: Change[]
  requiresManual: boolean
}

export interface TasksDocument {
  tasks: TaskState[]
  acceptanceCriteria: Array<{
    description: string
    met: boolean
  }>
}

export interface SyncPreview {
  changes: Change[]
  inconsistencies: Inconsistency[]
}

export interface AggregatedMetrics {
  totalDuration: number
  phasesDuration: Record<string, number>
  filesModified: number
  testsAdded: number
}

export interface SnapshotMeta {
  id: string
  trigger: string
  createdAt: string
  files: string[]
}

// Simple validators for testing
function validateTaskState(data: any): TaskState {
  if (!data.name || !data.status) {
    throw new Error('Invalid TaskState')
  }
  if (data.priority !== undefined && typeof data.priority !== 'number') {
    throw new Error('Invalid TaskState: priority must be a number')
  }
  const validStatuses = ['pending', 'in_progress', 'completed', 'blocked']
  if (!validStatuses.includes(data.status)) {
    throw new Error('Invalid task status')
  }
  return data as TaskState
}

function validateUnifiedState(data: any): UnifiedFeatureState {
  if (!data.feature || !data.currentPhase || typeof data.progress !== 'number' || !Array.isArray(data.tasks)) {
    throw new Error('Invalid UnifiedFeatureState')
  }
  return data as UnifiedFeatureState
}

// For backward compatibility with tests that import schemas
export const UnifiedFeatureStateSchema = { parse: validateUnifiedState }
export const TaskStateSchema = { parse: validateTaskState }
export const TransitionEntrySchema = { parse: (data: unknown) => data as TransitionEntry }
export const SnapshotDataSchema = { parse: (data: unknown) => data as SnapshotData }
export const PhaseMetricsSchema = { parse: (data: unknown) => data as PhaseMetrics }
export const InconsistencySchema = { parse: (data: unknown) => data as Inconsistency }
export const ProgressSyncResultSchema = { parse: (data: unknown) => data as ProgressSyncResult }
