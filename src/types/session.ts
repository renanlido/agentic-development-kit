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
  | 'error_recovery'
  | 'time_limit'
  | 'task_complete'
  | 'session_end'

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
  current: string
  done: string[]
  inProgress: string[]
  next: string[]
  files: string[]
  issues: string
}
