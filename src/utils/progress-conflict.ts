import type {
  UnifiedFeatureState,
  Inconsistency,
  Change,
  ResolutionResult,
  ProgressConflictStrategy,
} from '../types/progress-sync'

const PHASE_ORDER = [
  'not_started',
  'prd',
  'research',
  'tasks',
  'plan',
  'implement',
  'qa',
  'docs',
  'finish',
  'completed',
  'done',
]

const VALID_PHASES = new Set(PHASE_ORDER)

const LATE_PHASES = new Set(['qa', 'docs', 'finish', 'completed', 'done'])

export function detectInconsistencies(state: UnifiedFeatureState): Inconsistency[] {
  const inconsistencies: Inconsistency[] = []

  if (state.tasks.length === 0) {
    return inconsistencies
  }

  const isCompleted = state.currentPhase === 'completed' || state.currentPhase === 'done'
  const isLatePhase = LATE_PHASES.has(state.currentPhase)
  const currentPhaseIndex = PHASE_ORDER.indexOf(state.currentPhase)

  for (const task of state.tasks) {
    if (isCompleted && task.status === 'pending') {
      inconsistencies.push({
        type: 'phase_mismatch',
        severity: 'error',
        description: `Task "${task.name}" is still pending but feature is marked as ${state.currentPhase}`,
        field: 'currentPhase',
        progressValue: state.currentPhase,
        tasksValue: task.status,
      })
    }

    if (isCompleted && task.status === 'pending' && task.priority === 0) {
      inconsistencies.push({
        type: 'missing_required',
        severity: 'error',
        description: `P0 task "${task.name}" is pending but phase is marked as completed`,
        field: 'tasks',
        progressValue: state.currentPhase,
        tasksValue: task.status,
      })
    }

    if (isLatePhase && !isCompleted && task.status === 'pending' && task.priority === 0) {
      inconsistencies.push({
        type: 'missing_required',
        severity: 'error',
        description: `P0 task "${task.name}" is still pending at ${state.currentPhase} phase`,
        field: 'tasks',
        progressValue: state.currentPhase,
        tasksValue: task.status,
      })
    }

    if (task.phase && !VALID_PHASES.has(task.phase)) {
      inconsistencies.push({
        type: 'orphan_task',
        severity: 'warning',
        description: `Task "${task.name}" references unknown phase "${task.phase}"`,
        field: 'tasks',
        progressValue: undefined,
        tasksValue: task.phase,
      })
    }

    const taskPhaseIndex = task.phase ? PHASE_ORDER.indexOf(task.phase) : -1

    if (
      task.status === 'in_progress' &&
      taskPhaseIndex >= 0 &&
      taskPhaseIndex < currentPhaseIndex
    ) {
      inconsistencies.push({
        type: 'task_status_mismatch',
        severity: 'warning',
        description: `Task "${task.name}" from phase "${task.phase}" is still in_progress but current phase is "${state.currentPhase}"`,
        field: 'tasks',
        progressValue: state.currentPhase,
        tasksValue: task.status,
      })
    }
  }

  const uniqueInconsistencies = inconsistencies.filter((item, index, self) =>
    index === self.findIndex(t => t.description === item.description)
  )

  return uniqueInconsistencies
}

export function resolveInconsistencies(
  state: UnifiedFeatureState,
  _inconsistencies: Inconsistency[],
  strategy: ProgressConflictStrategy
): ResolutionResult {
  if (strategy === 'manual') {
    return {
      applied: false,
      changes: [],
      requiresManual: true,
    }
  }

  const changes: Change[] = []

  switch (strategy) {
    case 'progress-wins':
      for (const task of state.tasks) {
        if (task.status !== 'completed') {
          changes.push({
            field: `tasks.${task.name}.status`,
            oldValue: task.status,
            newValue: 'completed',
          })
          task.status = 'completed'
        }
      }
      break

    case 'tasks-wins': {
      const hasIncomplete = state.tasks.some(t => t.status !== 'completed')
      if (hasIncomplete) {
        const inProgress = state.tasks.some(t => t.status === 'in_progress')
        const newPhase = inProgress ? 'implement' : 'prd'
        if (state.currentPhase !== newPhase) {
          changes.push({
            field: 'currentPhase',
            oldValue: state.currentPhase,
            newValue: newPhase,
          })
          state.currentPhase = newPhase
        }
      }
      break
    }

    case 'merge':
      break
  }

  return {
    applied: true,
    changes,
    requiresManual: false,
  }
}
