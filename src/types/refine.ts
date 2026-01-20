import type { TaskState } from './progress-sync'

export type RefineTarget = 'prd' | 'research' | 'tasks' | 'tasks-pending'

export interface RefineOptions {
  prd?: boolean
  research?: boolean
  tasks?: boolean
  all?: boolean
  cascade?: boolean
  context?: string
  model?: string
}

export interface RefinableArtifact {
  type: RefineTarget
  name: string
  canRefine: boolean
  reason?: string
  taskStats?: {
    total: number
    pending: number
    inProgress: number
    completed: number
  }
}

export interface RefineResult {
  target: RefineTarget
  success: boolean
  changes: RefineChange[]
  newTasks?: TaskState[]
  error?: string
}

export interface RefineChange {
  type: 'added' | 'modified' | 'preserved'
  description: string
  section?: string
}

export interface TaskRefineResult {
  updatedTasks: TaskState[]
  newTasks: TaskState[]
  preservedTasks: TaskState[]
  summary: {
    tasksRefined: number
    tasksAdded: number
    tasksPreserved: number
  }
}

export interface RefinementSession {
  feature: string
  startedAt: string
  targets: RefineTarget[]
  context: string
  results: RefineResult[]
  cascaded: boolean
}
