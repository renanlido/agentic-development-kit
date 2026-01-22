import * as path from 'node:path'
import * as fs from 'fs-extra'
import type { SessionCheckpointResult } from '../types/hooks'

export async function createSessionCheckpoint(
  featureName: string,
  cwd: string = process.cwd()
): Promise<SessionCheckpointResult> {
  const startTime = Date.now()
  const result: SessionCheckpointResult = {
    snapshotCreated: false,
    progressUpdated: false,
    duration: 0,
  }

  try {
    const featureDir = path.join(cwd, '.claude', 'plans', 'features', featureName)

    if (!(await fs.pathExists(featureDir))) {
      result.duration = Date.now() - startTime
      return result
    }

    const snapshotsDir = path.join(featureDir, '.snapshots')
    await fs.ensureDir(snapshotsDir)

    const statePath = path.join(featureDir, 'state.json')

    const state = (await fs.pathExists(statePath)) ? await fs.readJSON(statePath) : {}

    const timestamp = new Date().toISOString()
    const snapshotId = `session-end-${Date.now()}`
    const snapshotPath = path.join(snapshotsDir, `${snapshotId}.json`)

    const snapshot = {
      id: snapshotId,
      feature: featureName,
      reason: 'session_end',
      timestamp,
      state,
    }

    await fs.writeJSON(snapshotPath, snapshot, { spaces: 2 })
    result.snapshotCreated = true
    result.snapshotPath = snapshotPath

    const progressContent = await generateProgressText(featureName, state)
    const progressFilePath = path.join(featureDir, 'claude-progress.txt')
    await fs.writeFile(progressFilePath, progressContent)
    result.progressUpdated = true

    result.duration = Date.now() - startTime
    return result
  } catch (_error) {
    result.duration = Date.now() - startTime
    return result
  }
}

async function generateProgressText(featureName: string, state: any): Promise<string> {
  const timestamp = new Date().toISOString()
  const phase = state.currentPhase || 'unknown'
  const progress = state.progress || 0

  return `=== FEATURE PROGRESS ===
Feature: ${featureName}
Updated: ${timestamp}

--- CURRENT STATE ---
Phase: ${phase}
Progress: ${progress}%

--- SNAPSHOT ---
Session ended. Checkpoint created for recovery.
`
}
