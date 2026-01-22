import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'

describe('Agent Resume Functionality', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-resume-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('adk agent run --resume', () => {
    it('should load context from interrupted session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        currentStep: 'Implementing auth',
        completedSteps: ['Setup project'],
        pendingSteps: ['Implementing auth', 'Add tests'],
        status: 'interrupted',
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest).not.toBeNull()
      expect(latest?.status).toBe('interrupted')
      expect(latest?.completedSteps).toContain('Setup project')
    })

    it('should inject handoff document into context', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 60,
        tasks: [
          { name: 'Setup project', status: 'completed' as const, priority: 0 },
          { name: 'Implement auth', status: 'in_progress' as const, priority: 0 },
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

      expect(await fs.pathExists(handoffPath)).toBe(true)

      const handoffContent = await fs.readFile(handoffPath, 'utf-8')
      expect(handoffContent).toContain('CURRENT:')
      expect(handoffContent).toContain('Setup project')
    })

    it('should warn when no session exists', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const latest = await manager.getLatestSession('non-existent-feature')

      expect(latest).toBeNull()
    })

    it('should handle graceful fallback to fresh start', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const latest = await manager.getLatestSession(featureName)

      expect(latest).toBeNull()
    })
  })

  describe('Session Detection', () => {
    it('should detect pending session when running without --resume', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        status: 'interrupted',
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest).not.toBeNull()
      expect(latest?.status).toBe('interrupted')
    })

    it('should show last activity time when session exists', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        status: 'interrupted',
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.lastActivity).toBeDefined()
      expect(latest?.status).toBe('interrupted')
    })

    it('should show progress when session exists', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        completedSteps: ['Step 1', 'Step 2'],
        pendingSteps: ['Step 3'],
        status: 'interrupted',
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.completedSteps).toHaveLength(2)
      expect(latest?.pendingSteps).toHaveLength(1)
    })
  })

  describe('buildResumeContext', () => {
    it('should include session data in context', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        currentStep: 'Implementing auth',
        completedSteps: ['Setup', 'Schema'],
        pendingSteps: ['Auth', 'Tests'],
        contextSummary: 'Working on authentication',
      })

      const session = await manager.getLatestSession(featureName)

      expect(session?.currentStep).toBe('Implementing auth')
      expect(session?.contextSummary).toBe('Working on authentication')
    })

    it('should include handoff document in context', async () => {
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
  })

  describe('Context Injection', () => {
    it('should format resume context correctly', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 60,
        tasks: [
          { name: 'Setup', status: 'completed' as const, priority: 0 },
          { name: 'Auth', status: 'in_progress' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const summary = await manager.createContextSummary(featureName)

      expect(summary).toBeTruthy()
      expect(summary).toContain('60')
    })

    it('should preserve task context across resume', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        completedSteps: ['Task A', 'Task B'],
        pendingSteps: ['Task C'],
      })

      const session = await manager.getLatestSession(featureName)

      expect(session?.completedSteps).toEqual(['Task A', 'Task B'])
      expect(session?.pendingSteps).toEqual(['Task C'])
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted session gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeFile(path.join(sessionsPath, 'corrupted.json'), 'invalid json{')

      const latest = await manager.getLatestSession(featureName)

      expect(latest).toBeNull()
    })

    it('should handle missing handoff document', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      const session = await manager.getLatestSession(featureName)

      expect(session).not.toBeNull()
      expect(session?.id).toBe(sessionId)
    })
  })
})
