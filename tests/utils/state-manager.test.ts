import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

describe('StateManager', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-manager-test-'))
    featureName = 'test-feature'

    // Mock getFeaturePath to use temp directory
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('loadUnifiedState', () => {
    it('should load state from existing state.json', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const existingState = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'completed', priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const statePath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'state.json')
      await fs.ensureDir(path.dirname(statePath))
      await fs.writeJSON(statePath, existingState)

      const result = await manager.loadUnifiedState(featureName)

      expect(result.feature).toBe(featureName)
      expect(result.currentPhase).toBe('implement')
      expect(result.progress).toBe(50)
      expect(result.tasks).toHaveLength(1)
    })

    it('should create default state when file does not exist', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const result = await manager.loadUnifiedState(featureName)

      expect(result.feature).toBe(featureName)
      expect(result.currentPhase).toBe('not_started')
      expect(result.progress).toBe(0)
      expect(result.tasks).toEqual([])
      expect(result.transitions).toEqual([])
    })

    it('should validate state schema on load', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const invalidState = {
        feature: featureName,
        // Missing required fields
      }

      const statePath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'state.json')
      await fs.ensureDir(path.dirname(statePath))
      await fs.writeJSON(statePath, invalidState)

      // Should return default state instead of throwing
      const result = await manager.loadUnifiedState(featureName)
      expect(result.feature).toBe(featureName)
      expect(result).toHaveProperty('currentPhase')
    })

    it('should merge progress.md data when available', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const progressContent = `
# Progress: ${featureName}

> Last updated: 2026-01-20T10:00:00Z

## Current State
- **Phase**: implement

## Steps
- [x] **prd**
- [~] **research**
- [ ] **plan**
`

      const progressPath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'progress.md')
      await fs.ensureDir(path.dirname(progressPath))
      await fs.writeFile(progressPath, progressContent)

      const result = await manager.loadUnifiedState(featureName)

      expect(result.currentPhase).toBe('implement')
      expect(result.tasks.some(t => t.name === 'prd' && t.status === 'completed')).toBe(true)
    })

    it('should merge tasks.md data when available', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const tasksContent = `
# Tasks: ${featureName}

## Phase 1
- [x] P0: Task 1
- [ ] P1: Task 2
`

      const tasksPath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'tasks.md')
      await fs.ensureDir(path.dirname(tasksPath))
      await fs.writeFile(tasksPath, tasksContent)

      const result = await manager.loadUnifiedState(featureName)

      expect(result.tasks).toHaveLength(2)
      expect(result.tasks[0].priority).toBe(0)
      expect(result.tasks[1].priority).toBe(1)
    })
  })

  describe('saveUnifiedState', () => {
    it('should save state with atomic write (temp + rename)', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 75,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const statePath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'state.json')
      const exists = await fs.pathExists(statePath)
      expect(exists).toBe(true)

      const saved = await fs.readJSON(statePath)
      expect(saved.progress).toBe(75)
    })

    it('should update lastUpdated timestamp on save', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const oldTimestamp = '2026-01-01T00:00:00Z'
      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: oldTimestamp,
        lastSynced: oldTimestamp,
      }

      await manager.saveUnifiedState(featureName, state)

      const statePath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'state.json')
      const saved = await fs.readJSON(statePath)

      expect(saved.lastUpdated).not.toBe(oldTimestamp)
    })

    it('should create directory if it does not exist', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: 'new-feature',
        currentPhase: 'prd',
        progress: 0,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState('new-feature', state)

      const statePath = path.join(tempDir, '.claude', 'plans', 'features', 'new-feature', 'state.json')
      const exists = await fs.pathExists(statePath)
      expect(exists).toBe(true)
    })
  })

  describe('calculateProgress', () => {
    it('should return 0% when no tasks', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const progress = manager.calculateProgress([])
      expect(progress).toBe(0)
    })

    it('should return 50% when half completed', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const tasks = [
        { name: 'Task 1', status: 'completed' as const, priority: 0 },
        { name: 'Task 2', status: 'completed' as const, priority: 0 },
        { name: 'Task 3', status: 'pending' as const, priority: 0 },
        { name: 'Task 4', status: 'pending' as const, priority: 0 },
      ]

      const progress = manager.calculateProgress(tasks)
      expect(progress).toBe(50)
    })

    it('should return 100% when all completed', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const tasks = [
        { name: 'Task 1', status: 'completed' as const, priority: 0 },
        { name: 'Task 2', status: 'completed' as const, priority: 0 },
      ]

      const progress = manager.calculateProgress(tasks)
      expect(progress).toBe(100)
    })

    it('should count in_progress as partial completion', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const tasks = [
        { name: 'Task 1', status: 'completed' as const, priority: 0 },
        { name: 'Task 2', status: 'in_progress' as const, priority: 0 },
      ]

      const progress = manager.calculateProgress(tasks)
      expect(progress).toBeGreaterThan(50)
      expect(progress).toBeLessThan(100)
    })

    it('should handle blocked tasks appropriately', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const tasks = [
        { name: 'Task 1', status: 'completed' as const, priority: 0 },
        { name: 'Task 2', status: 'blocked' as const, priority: 0 },
      ]

      const progress = manager.calculateProgress(tasks)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(100)
    })
  })

  describe('getStatePath', () => {
    it('should return correct path for feature', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const statePath = manager.getStatePath(featureName)

      expect(statePath).toContain('.claude')
      expect(statePath).toContain('plans')
      expect(statePath).toContain('features')
      expect(statePath).toContain(featureName)
      expect(statePath).toContain('state.json')
    })
  })

  describe('mergeProgressAndTasks', () => {
    it('should merge progress.md and tasks.md data', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const progressData = {
        currentPhase: 'implement',
        steps: [
          { name: 'prd', status: 'completed' as const },
          { name: 'research', status: 'in_progress' as const },
        ],
      }

      const tasksData = {
        tasks: [
          { name: 'P0: Task 1', status: 'completed' as const, priority: 0 },
          { name: 'P1: Task 2', status: 'pending' as const, priority: 1 },
        ],
      }

      const result = manager.mergeProgressAndTasks(progressData, tasksData)

      expect(result.currentPhase).toBe('implement')
      expect(result.tasks?.length).toBeGreaterThan(0)
    })

    it('should preserve task details from tasks.md', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const progressData = {
        currentPhase: 'research',
        steps: [],
      }

      const tasksData = {
        tasks: [
          {
            name: 'Complex task',
            status: 'in_progress' as const,
            priority: 0,
            notes: 'Important notes',
          },
        ],
      }

      const result = manager.mergeProgressAndTasks(progressData, tasksData)

      expect(result.tasks?.[0].notes).toBe('Important notes')
    })

    it('should handle missing tasks.md gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const progressData = {
        currentPhase: 'prd',
        steps: [{ name: 'prd', status: 'in_progress' as const }],
      }

      const tasksData = {
        tasks: [],
      }

      const result = manager.mergeProgressAndTasks(progressData, tasksData)

      expect(result.currentPhase).toBe('prd')
      expect(result.tasks?.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Backward Compatibility', () => {
    it('should work with features that have no state.json', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const result = await manager.loadUnifiedState('legacy-feature')

      expect(result).toBeDefined()
      expect(result.feature).toBe('legacy-feature')
    })

    it('should migrate from progress.md-only features', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const progressContent = `
# Progress: legacy-feature

## Steps
- [x] **prd**
- [ ] **research**
`

      const progressPath = path.join(tempDir, '.claude', 'plans', 'features', 'legacy-feature', 'progress.md')
      await fs.ensureDir(path.dirname(progressPath))
      await fs.writeFile(progressPath, progressContent)

      const result = await manager.loadUnifiedState('legacy-feature')

      expect(result.tasks.some(t => t.name === 'prd')).toBe(true)
    })
  })
})
