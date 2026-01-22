import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'

describe('SnapshotManager', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('createSnapshot', () => {
    it('should create snapshot with semantic name', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const snapshotId = await manager.createSnapshot(featureName, 'pre-implement')

      expect(snapshotId).toContain('pre-implement')
      expect(snapshotId).toMatch(/\d{4}-\d{2}-\d{2}/)
    })

    it('should include progress.md in snapshot', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const progressPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'progress.md'
      )
      await fs.ensureDir(path.dirname(progressPath))
      await fs.writeFile(progressPath, '# Progress content')

      await manager.createSnapshot(featureName, 'test')

      const snapshots = await manager.listSnapshots(featureName)
      expect(snapshots[0].files).toContain('progress.md')
    })

    it('should include tasks.md in snapshot', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const tasksPath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'tasks.md')
      await fs.ensureDir(path.dirname(tasksPath))
      await fs.writeFile(tasksPath, '# Tasks content')

      await manager.createSnapshot(featureName, 'test')

      const snapshots = await manager.listSnapshots(featureName)
      expect(snapshots[0].files).toContain('tasks.md')
    })

    it('should include state.json in snapshot', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const statePath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'state.json'
      )
      await fs.ensureDir(path.dirname(statePath))
      await fs.writeJSON(statePath, { feature: featureName })

      await manager.createSnapshot(featureName, 'test')

      const snapshots = await manager.listSnapshots(featureName)
      expect(snapshots[0].files).toContain('state.json')
    })

    it('should save snapshot metadata correctly', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const snapshotId = await manager.createSnapshot(featureName, 'pre-qa')

      const snapshots = await manager.listSnapshots(featureName)
      expect(snapshots[0].id).toBe(snapshotId)
      expect(snapshots[0].trigger).toBe('pre-qa')
      expect(snapshots[0].createdAt).toBeTruthy()
    })

    it('should not include secrets in snapshots', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const envPath = path.join(tempDir, '.env')
      await fs.writeFile(envPath, 'API_KEY=secret123')

      await manager.createSnapshot(featureName, 'test')

      const snapshots = await manager.listSnapshots(featureName)

      expect(snapshots[0].files).not.toContain('.env')
    })
  })

  describe('listSnapshots', () => {
    it('should return all available snapshots', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      await manager.createSnapshot(featureName, 'snapshot1')
      await manager.createSnapshot(featureName, 'snapshot2')
      await manager.createSnapshot(featureName, 'snapshot3')

      const snapshots = await manager.listSnapshots(featureName)

      expect(snapshots).toHaveLength(3)
    })

    it('should return empty array when no snapshots exist', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const snapshots = await manager.listSnapshots('nonexistent')

      expect(snapshots).toEqual([])
    })
  })

  describe('restoreSnapshot', () => {
    it('should restore snapshot and overwrite current files', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const progressPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'progress.md'
      )
      await fs.ensureDir(path.dirname(progressPath))
      await fs.writeFile(progressPath, 'Original content')

      const snapshotId = await manager.createSnapshot(featureName, 'backup')

      await fs.writeFile(progressPath, 'Modified content')

      await manager.restoreSnapshot(featureName, snapshotId)

      const restored = await fs.readFile(progressPath, 'utf-8')
      expect(restored).toBe('Original content')
    })

    it('should create backup of current state before restore', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const progressPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'progress.md'
      )
      await fs.ensureDir(path.dirname(progressPath))
      await fs.writeFile(progressPath, 'Content to backup')

      const snapshotId = await manager.createSnapshot(featureName, 'old')

      await fs.writeFile(progressPath, 'Current content')

      await manager.restoreSnapshot(featureName, snapshotId)

      const snapshots = await manager.listSnapshots(featureName)
      const backupSnapshot = snapshots.find((s) => s.trigger.includes('pre-restore'))

      expect(backupSnapshot).toBeDefined()
    })

    it('should throw error for invalid snapshot ID', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      await expect(manager.restoreSnapshot(featureName, 'invalid-snapshot-id')).rejects.toThrow()
    })

    it('should restore all files atomically (all-or-nothing)', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), 'Progress 1')
      await fs.writeFile(path.join(featurePath, 'tasks.md'), 'Tasks 1')

      const snapshotId = await manager.createSnapshot(featureName, 'backup')

      await fs.writeFile(path.join(featurePath, 'progress.md'), 'Progress 2')
      await fs.writeFile(path.join(featurePath, 'tasks.md'), 'Tasks 2')

      await manager.restoreSnapshot(featureName, snapshotId)

      const progress = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      const tasks = await fs.readFile(path.join(featurePath, 'tasks.md'), 'utf-8')

      expect(progress).toBe('Progress 1')
      expect(tasks).toBe('Tasks 1')
    })
  })

  describe('cleanupOldSnapshots', () => {
    it('should keep only N most recent snapshots', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      for (let i = 0; i < 15; i++) {
        await manager.createSnapshot(featureName, `snapshot-${i}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const deleted = await manager.cleanupOldSnapshots(featureName, 10)

      expect(deleted).toBe(5)

      const remaining = await manager.listSnapshots(featureName)
      expect(remaining).toHaveLength(10)
    })

    it('should keep most recent snapshots after cleanup', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      for (let i = 0; i < 20; i++) {
        await manager.createSnapshot(featureName, `snapshot-${i}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      await manager.cleanupOldSnapshots(featureName, 5)

      const snapshots = await manager.listSnapshots(featureName)
      expect(snapshots[4].trigger).toContain('snapshot-19')
    })

    it('should return count of deleted snapshots', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      for (let i = 0; i < 12; i++) {
        await manager.createSnapshot(featureName, `snapshot-${i}`)
      }

      const deleted = await manager.cleanupOldSnapshots(featureName, 10)

      expect(deleted).toBe(2)
    })

    it('should return 0 when nothing to cleanup', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      await manager.createSnapshot(featureName, 'only-one')

      const deleted = await manager.cleanupOldSnapshots(featureName, 10)

      expect(deleted).toBe(0)
    })
  })

  describe('getSnapshotPath', () => {
    it('should return correct .snapshots directory path', async () => {
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')
      const manager = new SnapshotManager()

      const snapshotPath = manager.getSnapshotPath(featureName)

      expect(snapshotPath).toContain('.claude')
      expect(snapshotPath).toContain('plans')
      expect(snapshotPath).toContain('features')
      expect(snapshotPath).toContain(featureName)
      expect(snapshotPath).toContain('.snapshots')
    })
  })
})
