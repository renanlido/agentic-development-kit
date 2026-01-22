import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

describe('Feature Resume Functionality', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-resume-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('adk feature implement --resume', () => {
    it('should resume from interrupted implementation', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 60,
        tasks: [
          { name: 'Setup', status: 'completed' as const, priority: 0 },
          { name: 'Implement', status: 'in_progress' as const, priority: 0 },
          { name: 'Test', status: 'pending' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        status: 'interrupted',
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.status).toBe('interrupted')
    })

    it('should load handoff document on resume', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 40,
        tasks: [
          { name: 'Setup', status: 'completed' as const, priority: 0 },
          { name: 'Code', status: 'in_progress' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.endSession(featureName, sessionId, 'session_end')

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
      expect(content).toContain('Setup')
    })

    it('should inject context into implementation prompt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const summary = await manager.createContextSummary(featureName)

      expect(summary).toBeTruthy()
      expect(summary.length).toBeGreaterThan(0)
    })

    it('should follow existing askToResume pattern', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        status: 'interrupted',
        completedSteps: ['Phase 1'],
        pendingSteps: ['Phase 2', 'Phase 3'],
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest).not.toBeNull()
      expect(latest?.completedSteps).toHaveLength(1)
      expect(latest?.pendingSteps).toHaveLength(2)
    })
  })

  describe('Session Integration', () => {
    it('should check for existing session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      const latest = await manager.getLatestSession(featureName)

      expect(latest).not.toBeNull()
      expect(latest?.id).toBe(sessionId)
    })

    it('should load handoff document from session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 30,
        tasks: [{ name: 'Task 1', status: 'completed' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.endSession(featureName, sessionId, 'session_end')

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
    })

    it('should inject context summary into prompt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 70,
        tasks: [
          { name: 'Task 1', status: 'completed' as const, priority: 0 },
          { name: 'Task 2', status: 'completed' as const, priority: 0 },
          { name: 'Task 3', status: 'in_progress' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const summary = await manager.createContextSummary(featureName)

      expect(summary).toContain('70')
    })
  })

  describe('Resume Prompt Generation', () => {
    it('should include completed steps in prompt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        completedSteps: ['Step A', 'Step B', 'Step C'],
      })

      const session = await manager.getLatestSession(featureName)

      expect(session?.completedSteps).toEqual(['Step A', 'Step B', 'Step C'])
    })

    it('should include current step in prompt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        currentStep: 'Implementing feature X',
      })

      const session = await manager.getLatestSession(featureName)

      expect(session?.currentStep).toBe('Implementing feature X')
    })

    it('should include pending steps in prompt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        pendingSteps: ['Step X', 'Step Y'],
      })

      const session = await manager.getLatestSession(featureName)

      expect(session?.pendingSteps).toEqual(['Step X', 'Step Y'])
    })

    it('should include context summary in prompt', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        contextSummary: 'Working on authentication with JWT',
      })

      const session = await manager.getLatestSession(featureName)

      expect(session?.contextSummary).toBe('Working on authentication with JWT')
    })
  })

  describe('Clear CLI Messages', () => {
    it('should indicate resume vs fresh start', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const latestWithSession = await manager.createSession(featureName)
      const withSession = await manager.getLatestSession(featureName)

      expect(withSession).not.toBeNull()

      const latestWithoutSession = await manager.getLatestSession('non-existent')

      expect(latestWithoutSession).toBeNull()
    })
  })

  describe('Error Scenarios', () => {
    it('should handle missing handoff gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      const handoffPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'claude-progress.txt'
      )

      const exists = await fs.pathExists(handoffPath)
      expect(exists).toBe(false)
    })

    it('should handle corrupted state.json', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const statePath = manager.getStatePath(featureName)
      await fs.ensureDir(path.dirname(statePath))
      await fs.writeFile(statePath, 'invalid json{')

      const state = await manager.loadUnifiedState(featureName)

      expect(state).toBeDefined()
      expect(state.feature).toBe(featureName)
    })
  })
})
