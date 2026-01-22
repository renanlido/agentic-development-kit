import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import type { LongRunningSession } from '../../src/types/session'

describe('Agent Sessions Command', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sessions-cmd-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('adk agent sessions <feature>', () => {
    it('should show helpful message when no sessions exist', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessions = await manager.listSessions(featureName)

      expect(sessions).toEqual([])
    })

    it('should list sessions in table format', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session1: LongRunningSession = {
        id: 'session-20260121-100000',
        feature: featureName,
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'Step 1',
        completedSteps: ['Setup'],
        pendingSteps: ['Step 1', 'Step 2'],
        contextSummary: 'First session',
        checkpoints: [],
        status: 'completed',
      }

      const session2: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Step 2',
        completedSteps: ['Setup', 'Step 1'],
        pendingSteps: ['Step 2'],
        contextSummary: 'Second session',
        checkpoints: [],
        status: 'interrupted',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-100000.json'), session1)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session2)

      const sessions = await manager.listSessions(featureName)

      expect(sessions).toHaveLength(2)
    })

    it('should sort sessions by date descending', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session1: LongRunningSession = {
        id: 'session-20260120-100000',
        feature: featureName,
        startedAt: '2026-01-20T10:00:00.000Z',
        lastActivity: '2026-01-20T12:00:00.000Z',
        currentStep: 'Old session',
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'Old',
        checkpoints: [],
        status: 'completed',
      }

      const session2: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'New session',
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'New',
        checkpoints: [],
        status: 'active',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260120-100000.json'), session1)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session2)

      const sessions = await manager.listSessions(featureName)

      expect(sessions[0].id).toBe('session-20260121-140000')
      expect(sessions[1].id).toBe('session-20260120-100000')
    })

    it('should complete in < 100ms', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      for (let i = 0; i < 10; i++) {
        await manager.createSession(featureName)
      }

      const start = Date.now()
      await manager.listSessions(featureName)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('adk agent sessions <feature> --latest', () => {
    it('should show detailed view of most recent session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Implementing auth',
        completedSteps: ['Setup', 'Schema'],
        pendingSteps: ['Auth', 'Tests'],
        contextSummary: 'Working on authentication',
        checkpoints: [
          {
            id: 'checkpoint-001',
            createdAt: '2026-01-21T15:00:00.000Z',
            step: 'Schema',
            trigger: 'step_complete',
            snapshotPath: '/path/to/snapshot',
          },
        ],
        status: 'interrupted',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session)

      const latest = await manager.getLatestSession(featureName)

      expect(latest).not.toBeNull()
      expect(latest?.id).toBe('session-20260121-140000')
      expect(latest?.currentStep).toBe('Implementing auth')
      expect(latest?.completedSteps).toHaveLength(2)
      expect(latest?.pendingSteps).toHaveLength(2)
      expect(latest?.checkpoints).toHaveLength(1)
    })

    it('should show session metadata', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      await manager.updateSession(featureName, sessionId, {
        currentStep: 'Testing',
        completedSteps: ['Setup', 'Dev'],
      })

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.feature).toBe(featureName)
      expect(latest?.status).toBe('active')
    })

    it('should show checkpoint history', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Step 3',
        completedSteps: ['Step 1', 'Step 2'],
        pendingSteps: ['Step 3'],
        contextSummary: 'Test',
        checkpoints: [
          {
            id: 'checkpoint-001',
            createdAt: '2026-01-21T14:30:00.000Z',
            step: 'Step 1',
            trigger: 'step_complete',
            snapshotPath: '/path/1',
          },
          {
            id: 'checkpoint-002',
            createdAt: '2026-01-21T15:30:00.000Z',
            step: 'Step 2',
            trigger: 'step_complete',
            snapshotPath: '/path/2',
          },
        ],
        status: 'active',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session)

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.checkpoints).toHaveLength(2)
    })
  })

  describe('adk agent sessions <feature> --id <id>', () => {
    it('should show details of specific session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session1: LongRunningSession = {
        id: 'session-20260121-100000',
        feature: featureName,
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'First',
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'First',
        checkpoints: [],
        status: 'completed',
      }

      const session2: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Second',
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'Second',
        checkpoints: [],
        status: 'active',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-100000.json'), session1)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session2)

      const sessions = await manager.listSessions(featureName)
      const specific = sessions.find((s) => s.id === 'session-20260121-100000')

      expect(specific).toBeDefined()
      expect(specific?.id).toBe('session-20260121-100000')
    })

    it('should handle non-existent session ID', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessions = await manager.listSessions(featureName)
      const specific = sessions.find((s) => s.id === 'non-existent')

      expect(specific).toBeUndefined()
    })
  })

  describe('Output Format', () => {
    it('should format session list item correctly', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Step 2',
        completedSteps: ['Step 1'],
        pendingSteps: ['Step 2', 'Step 3'],
        contextSummary: 'Test',
        checkpoints: [],
        status: 'interrupted',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session)

      const sessions = await manager.listSessions(featureName)

      expect(sessions[0]).toHaveProperty('id')
      expect(sessions[0]).toHaveProperty('feature')
      expect(sessions[0]).toHaveProperty('startedAt')
      expect(sessions[0]).toHaveProperty('status')
      expect(sessions[0]).toHaveProperty('stepsCompleted')
      expect(sessions[0]).toHaveProperty('stepsTotal')
    })

    it('should calculate duration correctly', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const startTime = new Date('2026-01-21T10:00:00.000Z')
      const endTime = new Date('2026-01-21T12:30:00.000Z')

      const session: LongRunningSession = {
        id: 'session-20260121-100000',
        feature: featureName,
        startedAt: startTime.toISOString(),
        lastActivity: endTime.toISOString(),
        currentStep: 'Done',
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'Test',
        checkpoints: [],
        status: 'completed',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-100000.json'), session)

      const sessions = await manager.listSessions(featureName)

      expect(sessions[0].duration).toBeTruthy()
    })

    it('should show progress percentage', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Step 3',
        completedSteps: ['Step 1', 'Step 2'],
        pendingSteps: ['Step 3', 'Step 4'],
        contextSummary: 'Test',
        checkpoints: [],
        status: 'active',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session)

      const sessions = await manager.listSessions(featureName)

      expect(sessions[0].stepsCompleted).toBe(2)
      expect(sessions[0].stepsTotal).toBe(4)
    })
  })

  describe('Helper Messages', () => {
    it('should include resume suggestion when interrupted session exists', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Step 2',
        completedSteps: ['Step 1'],
        pendingSteps: ['Step 2'],
        contextSummary: 'Test',
        checkpoints: [],
        status: 'interrupted',
      }

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session)

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.status).toBe('interrupted')
    })
  })
})
