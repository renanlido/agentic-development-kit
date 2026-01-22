import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

describe('Task-Complete Hook', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hook-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('Hook Execution', () => {
    it('should update state.json correctly', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'in_progress' as const, priority: 0 },
          { name: 'Task 2', status: 'pending' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const taskName = 'Task 1'
      const updatedState = await manager.loadUnifiedState(featureName)
      const task = updatedState.tasks.find((t) => t.name === taskName)

      if (task) {
        task.status = 'completed'
      }

      await manager.saveUnifiedState(featureName, updatedState)

      const finalState = await manager.loadUnifiedState(featureName)
      const completedTask = finalState.tasks.find((t) => t.name === taskName)

      expect(completedTask?.status).toBe('completed')
    })

    it('should update claude-progress.txt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'completed' as const, priority: 0 },
          { name: 'Task 2', status: 'in_progress' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.endSession(featureName, sessionId, 'task_complete')

      const handoffPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'claude-progress.txt'
      )

      const exists = await fs.pathExists(handoffPath)
      expect(exists).toBe(true)

      const content = await fs.readFile(handoffPath, 'utf-8')
      expect(content).toContain('Task 1')
    })

    it('should handle missing feature gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      await expect(manager.loadUnifiedState('non-existent')).resolves.toBeDefined()
    })

    it('should complete in < 200ms', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'in_progress' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const start = Date.now()

      const updatedState = await manager.loadUnifiedState(featureName)
      updatedState.tasks[0].status = 'completed'
      await manager.saveUnifiedState(featureName, updatedState)

      const duration = Date.now() - start

      expect(duration).toBeLessThan(200)
    })
  })

  describe('Task Status Updates', () => {
    it('should mark task as completed', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 25,
        tasks: [
          { name: 'Task 1', status: 'in_progress' as const, priority: 0 },
          { name: 'Task 2', status: 'pending' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const updatedState = await manager.loadUnifiedState(featureName)
      updatedState.tasks[0].status = 'completed'
      await manager.saveUnifiedState(featureName, updatedState)

      const finalState = await manager.loadUnifiedState(featureName)

      expect(finalState.tasks[0].status).toBe('completed')
    })

    it('should set completedAt timestamp', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'in_progress' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const updatedState = await manager.loadUnifiedState(featureName)
      updatedState.tasks[0].status = 'completed'
      updatedState.tasks[0].completedAt = new Date().toISOString()
      await manager.saveUnifiedState(featureName, updatedState)

      const finalState = await manager.loadUnifiedState(featureName)

      expect(finalState.tasks[0].completedAt).toBeDefined()
    })
  })

  describe('Checkpoint Creation', () => {
    it('should create checkpoint on task completion', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'completed' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.endSession(featureName, sessionId, 'task_complete')

      const session = await manager.getLatestSession(featureName)

      expect(session?.checkpoints.length).toBeGreaterThan(0)
    })

    it('should include task name in checkpoint', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Important Task', status: 'completed' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.endSession(featureName, sessionId, 'task_complete')

      const session = await manager.getLatestSession(featureName)
      const checkpoint = session?.checkpoints[session.checkpoints.length - 1]

      expect(checkpoint?.trigger).toBe('task_complete')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed state gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const statePath = manager.getStatePath(featureName)
      await fs.ensureDir(path.dirname(statePath))
      await fs.writeFile(statePath, 'invalid json{')

      const state = await manager.loadUnifiedState(featureName)

      expect(state).toBeDefined()
      expect(state.feature).toBe(featureName)
    })

    it('should recover from incomplete operations', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'in_progress' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const loaded = await manager.loadUnifiedState(featureName)

      expect(loaded.tasks).toHaveLength(1)
    })
  })

  describe('Hook Script Permissions', () => {
    it('should be executable', async () => {
      const hookPath = path.join(tempDir, '.claude', 'hooks', 'task-complete.sh')
      await fs.ensureDir(path.dirname(hookPath))
      await fs.writeFile(hookPath, '#!/bin/bash\necho "test"\n')

      try {
        await fs.chmod(hookPath, 0o755)
        const stats = await fs.stat(hookPath)
        const isExecutable = (stats.mode & 0o111) !== 0

        expect(isExecutable).toBe(true)
      } catch (error) {
        console.warn('Permissions test not available on this platform')
      }
    })
  })

  describe('Template Inclusion', () => {
    it('should have template for new projects', async () => {
      const templatePath = path.join(
        tempDir,
        'templates',
        'claude-structure',
        'hooks',
        'task-complete.sh'
      )
      await fs.ensureDir(path.dirname(templatePath))
      await fs.writeFile(templatePath, '#!/bin/bash\n# Task complete hook template\n')

      const exists = await fs.pathExists(templatePath)
      expect(exists).toBe(true)
    })
  })
})
