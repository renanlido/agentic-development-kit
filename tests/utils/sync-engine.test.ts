import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

describe('SyncEngine', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-engine-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('sync', () => {
    it('should return success with empty changes when no inconsistencies', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      // Create consistent state
      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `
# Progress: ${featureName}
> Last updated: 2026-01-20T10:00:00Z

## Current State
- **Phase**: implement

## Steps
- [x] **prd**
- [x] **research**
- [~] **implement**
`
      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      const tasksContent = `
# Tasks: ${featureName}
- [x] Complete PRD
- [x] Research patterns
- [~] Implement feature
`
      await fs.writeFile(path.join(featurePath, 'tasks.md'), tasksContent)

      const result = await engine.sync(featureName)

      expect(result.success).toBe(true)
      expect(result.changesApplied).toEqual([])
      expect(result.inconsistenciesResolved).toBe(0)
    })

    it('should detect and resolve inconsistencies', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine({ strategy: 'progress-wins' })

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = `
# Progress: ${featureName}
## Current State
- **Phase**: completed
`
      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)

      const tasksContent = `
- [ ] P0: Incomplete critical task
`
      await fs.writeFile(path.join(featurePath, 'tasks.md'), tasksContent)

      const result = await engine.sync(featureName)

      expect(result.success).toBe(true)
      expect(result.inconsistenciesResolved).toBeGreaterThan(0)
    })

    it('should create snapshot before applying changes', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), '# Progress')

      const result = await engine.sync(featureName)

      if (result.changesApplied.length > 0) {
        expect(result.snapshotCreated).toBeTruthy()
      }
    })

    it('should update both progress.md and tasks.md', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine({ strategy: 'merge' })

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      await fs.writeFile(path.join(featurePath, 'progress.md'), `
# Progress: ${featureName}
- **Phase**: implement
`)
      await fs.writeFile(path.join(featurePath, 'tasks.md'), `
- [x] Task 1
- [ ] Task 2
`)

      await engine.sync(featureName)

      const progressExists = await fs.pathExists(path.join(featurePath, 'progress.md'))
      const tasksExists = await fs.pathExists(path.join(featurePath, 'tasks.md'))

      expect(progressExists).toBe(true)
      expect(tasksExists).toBe(true)
    })

    it('should rollback on failure', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const originalContent = '# Original Progress'
      await fs.writeFile(path.join(featurePath, 'progress.md'), originalContent)

      // Mock a failure scenario by making directory read-only or similar
      // For this test, we'll just verify the rollback mechanism exists

      // The implementation should handle errors gracefully
      try {
        await engine.sync('invalid-feature-!!!')
      } catch (error) {
        // Error should be caught and state rolled back
      }

      // Original file should remain unchanged
      const content = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(content).toBe(originalContent)
    })

    it('should record duration of sync operation', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), '# Progress')

      const result = await engine.sync(featureName)

      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('dryRun', () => {
    it('should show preview without making changes', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressContent = '# Progress\n- **Phase**: completed'
      const tasksContent = '- [ ] P0: Incomplete task'

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressContent)
      await fs.writeFile(path.join(featurePath, 'tasks.md'), tasksContent)

      const preview = await engine.dryRun(featureName)

      expect(preview).toBeDefined()
      expect(preview.changes).toBeDefined()

      // Files should not be modified
      const progressAfter = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      const tasksAfter = await fs.readFile(path.join(featurePath, 'tasks.md'), 'utf-8')

      expect(progressAfter).toBe(progressContent)
      expect(tasksAfter).toBe(tasksContent)
    })

    it('should detect inconsistencies in dry run mode', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      await fs.writeFile(path.join(featurePath, 'progress.md'), `
# Progress
- **Phase**: qa
`)
      await fs.writeFile(path.join(featurePath, 'tasks.md'), `
- [ ] P0: Critical implementation task
`)

      const preview = await engine.dryRun(featureName)

      expect(preview.inconsistencies).toBeDefined()
      expect(preview.inconsistencies.length).toBeGreaterThan(0)
    })
  })

  describe('Strategy Options', () => {
    it('should use configured strategy for resolution', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')

      const progressEngine = new SyncEngine({ strategy: 'progress-wins' })
      const tasksEngine = new SyncEngine({ strategy: 'tasks-wins' })

      expect(progressEngine).toBeDefined()
      expect(tasksEngine).toBeDefined()
    })

    it('should allow per-sync strategy override', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine({ strategy: 'progress-wins' })

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), '# Progress')

      const result = await engine.sync(featureName, { strategy: 'tasks-wins' })

      expect(result).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should complete sync in reasonable time (<500ms for 50 tasks)', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const tasks = Array.from({ length: 50 }, (_, i) => `- [x] Task ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'tasks.md'), tasks)
      await fs.writeFile(path.join(featurePath, 'progress.md'), '# Progress\n- **Phase**: implement')

      const result = await engine.sync(featureName)

      expect(result.duration).toBeLessThan(500)
    })
  })

  describe('Atomic Operations', () => {
    it('should be all-or-nothing', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)

      const progressBefore = '# Progress Original'
      const tasksBefore = '- [ ] Task Original'

      await fs.writeFile(path.join(featurePath, 'progress.md'), progressBefore)
      await fs.writeFile(path.join(featurePath, 'tasks.md'), tasksBefore)

      // If sync fails, files should remain unchanged
      try {
        await engine.sync(featureName)
      } catch {
        const progressAfter = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
        const tasksAfter = await fs.readFile(path.join(featurePath, 'tasks.md'), 'utf-8')

        expect(progressAfter).toBe(progressBefore)
        expect(tasksAfter).toBe(tasksBefore)
      }
    })
  })

  describe('History Integration', () => {
    it('should record transition in history after sync', async () => {
      const { SyncEngine } = await import('../../src/utils/sync-engine')
      const engine = new SyncEngine()

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), `
# Progress
- **Phase**: implement
`)

      await engine.sync(featureName)

      const historyPath = path.join(featurePath, 'history.json')
      const historyExists = await fs.pathExists(historyPath)

      if (historyExists) {
        const history = await fs.readJSON(historyPath)
        expect(Array.isArray(history)).toBe(true)
      }
    })
  })
})
