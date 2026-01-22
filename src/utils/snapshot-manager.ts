import path from 'node:path'
import fs from 'fs-extra'
import type { SnapshotMeta } from '../types/progress-sync'

const SNAPSHOT_FILES = ['progress.md', 'tasks.md', 'state.json']

/**
 * Creates and manages state snapshots at critical workflow points.
 *
 * Snapshots are stored in .snapshots/ with semantic naming (trigger-date.json).
 * Auto-cleanup keeps 10 most recent snapshots. Enables rollback to previous states.
 */
export class SnapshotManager {
  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  getSnapshotPath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature, '.snapshots')
  }

  private getFeaturePath(feature: string): string {
    const basePath = this.getBasePath()
    return path.join(basePath, '.claude', 'plans', 'features', feature)
  }

  private generateSnapshotId(trigger: string): string {
    const date = new Date().toISOString().split('T')[0]
    const time = Date.now()
    return `${trigger}-${date}-${time}`
  }

  async createSnapshot(feature: string, trigger: string): Promise<string> {
    const snapshotPath = this.getSnapshotPath(feature)
    const featurePath = this.getFeaturePath(feature)
    const snapshotId = this.generateSnapshotId(trigger)
    const snapshotDir = path.join(snapshotPath, snapshotId)

    await fs.ensureDir(snapshotDir)

    const files: string[] = []

    for (const fileName of SNAPSHOT_FILES) {
      const sourcePath = path.join(featurePath, fileName)
      if (await fs.pathExists(sourcePath)) {
        const destPath = path.join(snapshotDir, fileName)
        await fs.copy(sourcePath, destPath)
        files.push(fileName)
      }
    }

    const meta: SnapshotMeta = {
      id: snapshotId,
      trigger,
      createdAt: new Date().toISOString(),
      files,
    }

    await fs.writeJSON(path.join(snapshotDir, 'meta.json'), meta, { spaces: 2 })

    return snapshotId
  }

  async listSnapshots(feature: string): Promise<SnapshotMeta[]> {
    const snapshotPath = this.getSnapshotPath(feature)

    if (!(await fs.pathExists(snapshotPath))) {
      return []
    }

    const entries = await fs.readdir(snapshotPath, { withFileTypes: true })
    const snapshots: SnapshotMeta[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(snapshotPath, entry.name, 'meta.json')
        if (await fs.pathExists(metaPath)) {
          try {
            const meta = await fs.readJSON(metaPath)
            snapshots.push(meta)
          } catch {}
        }
      }
    }

    snapshots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return snapshots
  }

  async restoreSnapshot(feature: string, snapshotId: string): Promise<void> {
    const snapshotPath = this.getSnapshotPath(feature)
    const featurePath = this.getFeaturePath(feature)
    const snapshotDir = path.join(snapshotPath, snapshotId)

    if (!(await fs.pathExists(snapshotDir))) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    await this.createSnapshot(feature, 'pre-restore')

    const metaPath = path.join(snapshotDir, 'meta.json')
    const meta: SnapshotMeta = await fs.readJSON(metaPath)

    for (const fileName of meta.files) {
      const sourcePath = path.join(snapshotDir, fileName)
      const destPath = path.join(featurePath, fileName)
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath, { overwrite: true })
      }
    }
  }

  async cleanupOldSnapshots(feature: string, keepCount: number): Promise<number> {
    const snapshots = await this.listSnapshots(feature)

    if (snapshots.length <= keepCount) {
      return 0
    }

    const toDelete = snapshots.slice(0, snapshots.length - keepCount)
    const snapshotPath = this.getSnapshotPath(feature)

    for (const snapshot of toDelete) {
      const snapshotDir = path.join(snapshotPath, snapshot.id)
      await fs.remove(snapshotDir)
    }

    return toDelete.length
  }
}
