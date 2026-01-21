import fs from 'fs-extra'
import path from 'node:path'
import type { PhaseMetrics, AggregatedMetrics, TransitionEntry } from '../types/progress-sync'
import { parseTasksFile } from './task-parser'

export class MetricsCollector {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  private getFeaturePath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature)
  }

  getMetricsPath(feature: string): string {
    return path.join(this.getFeaturePath(feature), 'metrics.json')
  }

  private getHistoryPath(feature: string): string {
    return path.join(this.getFeaturePath(feature), 'history.json')
  }

  private getTasksPath(feature: string): string {
    return path.join(this.getFeaturePath(feature), 'tasks.md')
  }

  async collectPhaseMetrics(feature: string, phase: string): Promise<PhaseMetrics> {
    const history = await this.loadHistory(feature)
    const tasks = await this.loadTasks(feature)
    const files = await this.getFilesChanged(feature)

    const phaseStart = history.find((h) => h.toPhase === phase)
    const phaseEnd = history.find((h) => h.fromPhase === phase)

    const phaseTasks = tasks.filter(
      (t) => t.phase?.toLowerCase() === phase.toLowerCase() || !t.phase
    )
    const completedTasks = phaseTasks.filter((t) => t.status === 'completed')

    let duration: number | undefined
    if (phaseStart && phaseEnd) {
      const start = new Date(phaseStart.timestamp).getTime()
      const end = new Date(phaseEnd.timestamp).getTime()
      duration = Math.floor((end - start) / 1000)
    } else if (phaseEnd?.duration) {
      duration = phaseEnd.duration
    }

    return {
      phase,
      startedAt: phaseStart?.timestamp || new Date().toISOString(),
      completedAt: phaseEnd?.timestamp,
      duration,
      tasksCompleted: completedTasks.length,
      tasksTotal: phaseTasks.length,
      filesModified: files,
    }
  }

  async getFilesChanged(feature: string, _since?: string): Promise<string[]> {
    try {
      const featurePath = this.getFeaturePath(feature)
      if (!(await fs.pathExists(featurePath))) {
        return []
      }
      return []
    } catch {
      return []
    }
  }

  async aggregateMetrics(feature: string): Promise<AggregatedMetrics> {
    const history = await this.loadHistory(feature)
    const files = await this.getFilesChanged(feature)

    let totalDuration = 0
    const phasesDuration: Record<string, number> = {}

    for (const entry of history) {
      if (entry.duration) {
        totalDuration += entry.duration
        if (entry.toPhase) {
          phasesDuration[entry.toPhase] = (phasesDuration[entry.toPhase] || 0) + entry.duration
        }
      }
    }

    const aggregated: AggregatedMetrics = {
      totalDuration,
      phasesDuration,
      filesModified: files.length,
      testsAdded: 0,
    }

    try {
      const metricsPath = this.getMetricsPath(feature)
      await fs.ensureDir(path.dirname(metricsPath))
      await fs.writeJSON(metricsPath, aggregated, { spaces: 2 })
    } catch {}

    return aggregated
  }

  private async loadHistory(feature: string): Promise<TransitionEntry[]> {
    const historyPath = this.getHistoryPath(feature)

    if (!(await fs.pathExists(historyPath))) {
      return []
    }

    try {
      return await fs.readJSON(historyPath)
    } catch {
      return []
    }
  }

  private async loadTasks(
    feature: string
  ): Promise<Array<{ name: string; status: string; phase?: string }>> {
    const tasksPath = this.getTasksPath(feature)

    if (!(await fs.pathExists(tasksPath))) {
      return []
    }

    try {
      const content = await fs.readFile(tasksPath, 'utf-8')
      const doc = parseTasksFile(content)
      return doc.tasks.map((t) => ({
        name: t.name,
        status: t.status,
        phase: t.phase,
      }))
    } catch {
      return []
    }
  }
}
