import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import type { UnifiedFeatureState, TaskState } from '../types/progress-sync'
import { parseTasksFile } from './task-parser'

/**
 * Manages unified feature state by consolidating data from progress.md and tasks.md.
 *
 * Provides state loading, caching, progress calculation, and synchronization between
 * the two source files. State is cached in state.json for performance.
 *
 * @example
 * ```typescript
 * const manager = new StateManager()
 * const state = await manager.loadUnifiedState('my-feature')
 * console.log(`Progress: ${state.progress}%`)
 * ```
 */
export class StateManager {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  getStatePath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature, 'state.json')
  }

  private getProgressPath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature, 'progress.md')
  }

  private getTasksPath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature, 'tasks.md')
  }

  async loadUnifiedState(feature: string): Promise<UnifiedFeatureState> {
    const statePath = this.getStatePath(feature)

    let state = this.createDefaultState(feature)

    if (await fs.pathExists(statePath)) {
      try {
        const loaded = await fs.readJSON(statePath)
        if (this.isValidState(loaded)) {
          state = loaded
        }
      } catch {
      }
    }

    const progressPath = this.getProgressPath(feature)
    if (await fs.pathExists(progressPath)) {
      const progressContent = await fs.readFile(progressPath, 'utf-8')
      const progressData = this.parseProgressMd(progressContent)
      state = this.mergeProgressIntoState(state, progressData)
    }

    const tasksPath = this.getTasksPath(feature)
    if (await fs.pathExists(tasksPath)) {
      const tasksContent = await fs.readFile(tasksPath, 'utf-8')
      const tasksData = parseTasksFile(tasksContent)
      state = this.mergeTasksIntoState(state, tasksData)
    }

    return state
  }

  async saveUnifiedState(feature: string, state: UnifiedFeatureState): Promise<void> {
    const statePath = this.getStatePath(feature)
    const dir = path.dirname(statePath)

    await fs.ensureDir(dir)

    const updatedState = {
      ...state,
      lastUpdated: new Date().toISOString(),
    }

    const tempPath = path.join(os.tmpdir(), `state-${Date.now()}.json`)
    await fs.writeJSON(tempPath, updatedState, { spaces: 2 })
    await fs.move(tempPath, statePath, { overwrite: true })
  }

  calculateProgress(tasks: TaskState[]): number {
    if (tasks.length === 0) return 0

    let totalWeight = 0
    let completedWeight = 0

    for (const task of tasks) {
      totalWeight += 1
      if (task.status === 'completed') {
        completedWeight += 1
      } else if (task.status === 'in_progress') {
        completedWeight += 0.5
      }
    }

    return Math.round((completedWeight / totalWeight) * 100)
  }

  mergeProgressAndTasks(
    progressData: { currentPhase: string; steps: Array<{ name: string; status: TaskState['status'] }> },
    tasksData: { tasks: TaskState[] }
  ): Partial<UnifiedFeatureState> {
    const tasks: TaskState[] = []

    for (const step of progressData.steps) {
      tasks.push({
        name: step.name,
        status: step.status,
      })
    }

    for (const task of tasksData.tasks) {
      const existing = tasks.find(t => t.name === task.name)
      if (existing) {
        Object.assign(existing, task)
      } else {
        tasks.push(task)
      }
    }

    return {
      currentPhase: progressData.currentPhase,
      tasks,
    }
  }

  private createDefaultState(feature: string): UnifiedFeatureState {
    return {
      feature,
      currentPhase: 'not_started',
      progress: 0,
      tasks: [],
      transitions: [],
      lastUpdated: new Date().toISOString(),
      lastSynced: new Date().toISOString(),
    }
  }

  private isValidState(data: unknown): data is UnifiedFeatureState {
    if (!data || typeof data !== 'object') return false
    const obj = data as Record<string, unknown>
    return (
      typeof obj.feature === 'string' &&
      typeof obj.currentPhase === 'string' &&
      typeof obj.progress === 'number' &&
      Array.isArray(obj.tasks)
    )
  }

  private parseProgressMd(content: string): { currentPhase: string; steps: Array<{ name: string; status: TaskState['status'] }> } {
    const steps: Array<{ name: string; status: TaskState['status'] }> = []
    let currentPhase = 'not_started'

    const phaseMatch = content.match(/\*\*Phase\*\*:\s*(\w+)/i)
    if (phaseMatch) {
      currentPhase = phaseMatch[1]
    }

    const stepRegex = /- \[([x~! ])\]\s+\*\*(\w+)\*\*/gi
    let match
    while ((match = stepRegex.exec(content)) !== null) {
      const [, checkbox, name] = match
      let status: TaskState['status'] = 'pending'
      switch (checkbox.toLowerCase()) {
        case 'x':
          status = 'completed'
          break
        case '~':
          status = 'in_progress'
          break
        case '!':
          status = 'blocked'
          break
      }
      steps.push({ name, status })
    }

    return { currentPhase, steps }
  }

  private mergeProgressIntoState(
    state: UnifiedFeatureState,
    progressData: { currentPhase: string; steps: Array<{ name: string; status: TaskState['status'] }> }
  ): UnifiedFeatureState {
    const tasks = [...state.tasks]

    for (const step of progressData.steps) {
      const existing = tasks.find(t => t.name === step.name)
      if (existing) {
        existing.status = step.status
      } else {
        tasks.push({
          name: step.name,
          status: step.status,
        })
      }
    }

    return {
      ...state,
      currentPhase: progressData.currentPhase,
      tasks,
    }
  }

  private mergeTasksIntoState(
    state: UnifiedFeatureState,
    tasksData: { tasks: TaskState[]; acceptanceCriteria: Array<{ description: string; met: boolean }> }
  ): UnifiedFeatureState {
    const tasks = [...state.tasks]

    for (const task of tasksData.tasks) {
      const existing = tasks.find(t => t.name === task.name)
      if (existing) {
        Object.assign(existing, task)
      } else {
        tasks.push(task)
      }
    }

    return {
      ...state,
      tasks,
      progress: this.calculateProgress(tasks),
    }
  }
}
