import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import type { TaskState, UnifiedFeatureState } from '../types/progress-sync'
import type {
  CheckpointReason,
  HandoffDocument,
  LongRunningSession,
  SessionListItem,
} from '../types/session'
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
      } catch {}
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
    if (tasks.length === 0) {
      return 0
    }

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
    progressData: {
      currentPhase: string
      steps: Array<{ name: string; status: TaskState['status'] }>
    },
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
      const existing = tasks.find((t) => t.name === task.name)
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
    if (!data || typeof data !== 'object') {
      return false
    }
    const obj = data as Record<string, unknown>
    return (
      typeof obj.feature === 'string' &&
      typeof obj.currentPhase === 'string' &&
      typeof obj.progress === 'number' &&
      Array.isArray(obj.tasks)
    )
  }

  private parseProgressMd(content: string): {
    currentPhase: string
    steps: Array<{ name: string; status: TaskState['status'] }>
  } {
    const steps: Array<{ name: string; status: TaskState['status'] }> = []
    let currentPhase = 'not_started'

    const phaseMatch = content.match(/\*\*Phase\*\*:\s*(\w+)/i)
    if (phaseMatch) {
      currentPhase = phaseMatch[1]
    }

    const stepRegex = /- \[([x~! ])\]\s+\*\*(\w+)\*\*/gi
    let match: RegExpExecArray | null = stepRegex.exec(content)
    while (match !== null) {
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
      match = stepRegex.exec(content)
    }

    return { currentPhase, steps }
  }

  private mergeProgressIntoState(
    state: UnifiedFeatureState,
    progressData: {
      currentPhase: string
      steps: Array<{ name: string; status: TaskState['status'] }>
    }
  ): UnifiedFeatureState {
    const tasks = [...state.tasks]

    for (const step of progressData.steps) {
      const existing = tasks.find((t) => t.name === step.name)
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
    tasksData: {
      tasks: TaskState[]
      acceptanceCriteria: Array<{ description: string; met: boolean }>
    }
  ): UnifiedFeatureState {
    const tasks = [...state.tasks]

    for (const task of tasksData.tasks) {
      const existing = tasks.find((t) => t.name === task.name)
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

  getSessionsPath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature, 'sessions')
  }

  async listSessions(feature: string): Promise<SessionListItem[]> {
    const sessionsPath = this.getSessionsPath(feature)

    if (!(await fs.pathExists(sessionsPath))) {
      return []
    }

    const files = await fs.readdir(sessionsPath)
    const sessions: SessionListItem[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue
      }

      try {
        const sessionPath = path.join(sessionsPath, file)
        const session: LongRunningSession = await fs.readJSON(sessionPath)

        const startTime = new Date(session.startedAt)
        const endTime = new Date(session.lastActivity)
        const durationMs = endTime.getTime() - startTime.getTime()
        const hours = Math.floor(durationMs / (1000 * 60 * 60))
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

        const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

        sessions.push({
          id: session.id,
          feature: session.feature,
          startedAt: session.startedAt,
          endedAt: session.status === 'completed' ? session.lastActivity : null,
          duration,
          status: session.status,
          stepsCompleted: session.completedSteps.length,
          stepsTotal: session.completedSteps.length + session.pendingSteps.length,
        })
      } catch {}
    }

    return sessions.sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    })
  }

  async getLatestSession(feature: string): Promise<LongRunningSession | null> {
    const sessions = await this.listSessions(feature)

    if (sessions.length === 0) {
      return null
    }

    const latestListItem = sessions[0]
    const sessionsPath = this.getSessionsPath(feature)
    const sessionPath = path.join(sessionsPath, `${latestListItem.id}.json`)

    try {
      return await fs.readJSON(sessionPath)
    } catch {
      return null
    }
  }

  async createSession(feature: string): Promise<string> {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    const sessionId = `session-${year}${month}${day}-${hours}${minutes}${seconds}`

    const session: LongRunningSession = {
      id: sessionId,
      feature,
      startedAt: now.toISOString(),
      lastActivity: now.toISOString(),
      currentStep: '',
      completedSteps: [],
      pendingSteps: [],
      contextSummary: '',
      checkpoints: [],
      status: 'active',
    }

    const sessionsPath = this.getSessionsPath(feature)
    await fs.ensureDir(sessionsPath)

    const sessionPath = path.join(sessionsPath, `${sessionId}.json`)
    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)

    await fs.writeJSON(tempPath, session, { spaces: 2 })
    await fs.ensureDir(path.dirname(sessionPath))
    await fs.move(tempPath, sessionPath, { overwrite: true })

    return sessionId
  }

  async updateSession(
    feature: string,
    sessionId: string,
    updates: Partial<LongRunningSession>
  ): Promise<void> {
    const sessionsPath = this.getSessionsPath(feature)
    const sessionPath = path.join(sessionsPath, `${sessionId}.json`)

    if (!(await fs.pathExists(sessionPath))) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const session: LongRunningSession = await fs.readJSON(sessionPath)

    const updatedSession: LongRunningSession = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString(),
    }

    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)
    await fs.writeJSON(tempPath, updatedSession, { spaces: 2 })
    await fs.ensureDir(path.dirname(sessionPath))
    await fs.move(tempPath, sessionPath, { overwrite: true })
  }

  async endSession(feature: string, sessionId: string, reason: CheckpointReason): Promise<void> {
    const sessionsPath = this.getSessionsPath(feature)
    const sessionPath = path.join(sessionsPath, `${sessionId}.json`)

    if (!(await fs.pathExists(sessionPath))) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const session: LongRunningSession = await fs.readJSON(sessionPath)

    const checkpointId = `checkpoint-${Date.now()}`
    const checkpoint = {
      id: checkpointId,
      createdAt: new Date().toISOString(),
      step: session.currentStep || 'Session end',
      trigger: reason,
      snapshotPath: path.join(
        this.getBasePath(),
        '.claude',
        'plans',
        'features',
        feature,
        'snapshots',
        checkpointId
      ),
    }

    session.checkpoints.push(checkpoint)
    session.status =
      reason === 'session_end' || reason === 'task_complete' ? 'completed' : 'interrupted'

    const tempPath = path.join(os.tmpdir(), `session-${Date.now()}.json`)
    await fs.writeJSON(tempPath, session, { spaces: 2 })
    await fs.ensureDir(path.dirname(sessionPath))
    await fs.move(tempPath, sessionPath, { overwrite: true })

    const handoffDocument = await this.createHandoffDocument(feature)
    const handoffPath = path.join(
      this.getBasePath(),
      '.claude',
      'plans',
      'features',
      feature,
      'claude-progress.txt'
    )
    await fs.writeFile(handoffPath, handoffDocument)
  }

  async resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState> {
    const snapshotsPath = path.join(
      this.getBasePath(),
      '.claude',
      'plans',
      'features',
      feature,
      'snapshots'
    )

    if (!(await fs.pathExists(snapshotsPath))) {
      throw new Error(`No snapshots found for feature ${feature}`)
    }

    let snapshotPath: string

    if (snapshotId) {
      snapshotPath = path.join(snapshotsPath, `${snapshotId}.json`)
    } else {
      const files = await fs.readdir(snapshotsPath)
      const jsonFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()

      if (jsonFiles.length === 0) {
        throw new Error(`No snapshots found for feature ${feature}`)
      }

      snapshotPath = path.join(snapshotsPath, jsonFiles[0])
    }

    if (!(await fs.pathExists(snapshotPath))) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    return await fs.readJSON(snapshotPath)
  }

  async createHandoffDocument(feature: string): Promise<string> {
    const state = await this.loadUnifiedState(feature)

    const current = `${state.currentPhase} (${state.progress}% complete)`

    const done = state.tasks
      .filter((t) => t.status === 'completed')
      .map((t) => `- ${t.name}`)
      .join('\n')

    const inProgress = state.tasks
      .filter((t) => t.status === 'in_progress')
      .map((t) => `- ${t.name}`)
      .join('\n')

    const next = state.tasks
      .filter((t) => t.status === 'pending')
      .map((t, i) => `${i + 1}. ${t.name}`)
      .join('\n')

    const blockedTasks = state.tasks.filter((t) => t.status === 'blocked')
    const issues =
      blockedTasks.length > 0 ? blockedTasks.map((t) => t.name).join(', ') : 'None blocking'

    const document = `CURRENT: ${current}

DONE:
${done || '(none)'}

IN PROGRESS:
${inProgress || '(none)'}

NEXT:
${next || '(none)'}

FILES:

ISSUES: ${issues}
`

    return document
  }

  parseHandoffDocument(content: string): HandoffDocument {
    const featureMatch = content.match(/HANDOFF DOCUMENT:\s*(.+)/i) || content.match(/FEATURE:\s*(.+)/i)
    const feature = featureMatch ? featureMatch[1].trim() : 'unknown'

    const generatedMatch = content.match(/Generated:\s*(.+)/i)
    const createdAt = generatedMatch ? generatedMatch[1].trim() : new Date().toISOString()

    const sessionMatch = content.match(/Session:\s*(.+)/i)
    const sessionId = sessionMatch ? sessionMatch[1].trim() : 'unknown'

    const checkpointMatch = content.match(/Checkpoint:\s*(.+)/i)
    const checkpointId = checkpointMatch ? checkpointMatch[1].trim() : 'unknown'

    const currentMatch = content.match(/(?:CURRENT TASK|CURRENT):\s*(.+)/i)
    const currentTask = currentMatch ? currentMatch[1].trim() : ''

    const contextMatch = content.match(/CONTEXT FOR CONTINUATION:\s*(.+)/is)
    const context = contextMatch ? contextMatch[1].trim() : ''

    const done: string[] = []
    const inProgress: string[] = []
    const next: string[] = []
    const files: string[] = []
    const decisions: string[] = []

    const lines = content.split('\n')
    let currentSection: 'none' | 'done' | 'inProgress' | 'next' | 'files' | 'decisions' = 'none'

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.match(/^(?:COMPLETED|DONE):/i)) {
        currentSection = 'done'
        continue
      }
      if (trimmed.match(/^IN PROGRESS:/i)) {
        currentSection = 'inProgress'
        continue
      }
      if (trimmed.match(/^(?:NEXT STEPS|NEXT):/i)) {
        currentSection = 'next'
        continue
      }
      if (trimmed.match(/^FILES MODIFIED:/i)) {
        currentSection = 'files'
        continue
      }
      if (trimmed.match(/^DECISIONS MADE:/i)) {
        currentSection = 'decisions'
        continue
      }
      if (trimmed.match(/^(BLOCKING ISSUES|CONTEXT FOR CONTINUATION|===):/i) || trimmed.startsWith('===')) {
        currentSection = 'none'
        continue
      }

      if (currentSection === 'none' || !trimmed || trimmed === '(none)') {
        continue
      }

      if (currentSection === 'done' && trimmed.startsWith('-')) {
        done.push(trimmed.replace(/^-\s*/, '').trim())
      } else if (currentSection === 'inProgress' && trimmed.startsWith('-')) {
        inProgress.push(trimmed.replace(/^-\s*/, '').trim())
      } else if (currentSection === 'next' && trimmed.match(/^[\d.]+\s/)) {
        next.push(trimmed.replace(/^[\d.]+\s*/, '').trim())
      } else if (currentSection === 'files' && trimmed.startsWith('-')) {
        files.push(trimmed.replace(/^-\s*/, '').trim())
      } else if (currentSection === 'decisions' && trimmed.startsWith('-')) {
        decisions.push(trimmed.replace(/^-\s*/, '').trim())
      }
    }

    const filesInlineMatch = content.match(/FILES:\s*([^\n]+)/i)
    if (filesInlineMatch) {
      const filesText = filesInlineMatch[1].trim()
      if (filesText && !filesText.match(/^ISSUES:/i)) {
        const inlineFiles = filesText
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f)
        files.push(...inlineFiles)
      }
    }

    const issuesMatch = content.match(/(?:BLOCKING )?ISSUES:\s*(.+?)(?=\n\n|##|$)/is)
    let issuesText = issuesMatch ? issuesMatch[1].trim() : ''
    const issuesArray: string[] = []

    if (issuesText && !issuesText.match(/none|None blocking/i)) {
      issuesText.split('\n').forEach(line => {
        const trimmed = line.trim().replace(/^-\s*/, '')
        if (trimmed && !trimmed.match(/^##/)) {
          issuesArray.push(trimmed)
        }
      })
    }

    return {
      feature,
      createdAt,
      sessionId,
      checkpointId,
      currentTask,
      completed: done,
      inProgress,
      nextSteps: next,
      filesModified: files,
      issues: issuesArray,
      decisions,
      context,
      current: currentTask,
      done,
      next,
      files,
    }
  }

  async createContextSummary(feature: string): Promise<string> {
    const state = await this.loadUnifiedState(feature)

    const summary = `Feature: ${feature}
Phase: ${state.currentPhase}
Progress: ${state.progress}%
Completed: ${state.tasks.filter((t) => t.status === 'completed').length}/${state.tasks.length} tasks`

    return summary
  }
}
