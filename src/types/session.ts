export interface LongRunningSession {
  id: string
  feature: string
  startedAt: string
  lastActivity: string
  currentStep: string
  completedSteps: string[]
  pendingSteps: string[]
  contextSummary: string
  checkpoints: CheckpointRef[]
  status: SessionStatus
}

export type SessionStatus = 'active' | 'completed' | 'interrupted' | 'error'

export interface CheckpointRef {
  id: string
  createdAt: string
  step: string
  trigger: CheckpointReason
  commitHash?: string
  snapshotPath: string
}

export type CheckpointReason =
  | 'manual'
  | 'step_complete'
  | 'context_warning'
  | 'context_overflow'
  | 'error_recovery'
  | 'time_limit'
  | 'task_complete'
  | 'session_end'
  | 'pre_compaction'

export interface SessionListItem {
  id: string
  feature: string
  startedAt: string
  endedAt: string | null
  duration: string
  status: SessionStatus
  stepsCompleted: number
  stepsTotal: number
}

export interface HandoffDocument {
  feature: string
  createdAt: string
  sessionId: string
  checkpointId: string
  currentTask: string
  completed: string[]
  inProgress: string[]
  nextSteps: string[]
  filesModified: string[]
  issues: string[]
  decisions: string[]
  context: string
  current?: string
  done?: string[]
  next?: string[]
  files?: string[]
}
