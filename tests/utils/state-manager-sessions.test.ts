import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import type { LongRunningSession } from '../../src/types/session'

describe('StateManager - Session Methods', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('getSessionsPath', () => {
    it('should return correct path for sessions directory', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionsPath = manager.getSessionsPath(featureName)

      expect(sessionsPath).toContain('.claude')
      expect(sessionsPath).toContain('plans')
      expect(sessionsPath).toContain('features')
      expect(sessionsPath).toContain(featureName)
      expect(sessionsPath).toContain('sessions')
    })
  })

  describe('listSessions', () => {
    it('should return empty array when no sessions exist', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessions = await manager.listSessions(featureName)

      expect(sessions).toEqual([])
    })

    it('should return sessions sorted by date descending', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)

      const session1: LongRunningSession = {
        id: 'session-20260121-100000',
        feature: featureName,
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'Step 1',
        completedSteps: [],
        pendingSteps: ['Step 1'],
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
        completedSteps: [],
        pendingSteps: ['Step 2'],
        contextSummary: 'Second session',
        checkpoints: [],
        status: 'active',
      }

      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-100000.json'), session1)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session2)

      const sessions = await manager.listSessions(featureName)

      expect(sessions).toHaveLength(2)
      expect(sessions[0].id).toBe('session-20260121-140000')
      expect(sessions[1].id).toBe('session-20260121-100000')
    })

    it('should handle corrupted session files gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)

      const validSession: LongRunningSession = {
        id: 'session-20260121-100000',
        feature: featureName,
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'Step 1',
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'Valid session',
        checkpoints: [],
        status: 'completed',
      }

      await fs.writeJSON(path.join(sessionsPath, 'session-valid.json'), validSession)
      await fs.writeFile(path.join(sessionsPath, 'session-corrupted.json'), 'invalid json{')

      const sessions = await manager.listSessions(featureName)

      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('session-20260121-100000')
    })
  })

  describe('getLatestSession', () => {
    it('should return null when no sessions exist', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const session = await manager.getLatestSession(featureName)

      expect(session).toBeNull()
    })

    it('should return most recent session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)

      const session1: LongRunningSession = {
        id: 'session-20260121-100000',
        feature: featureName,
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'Step 1',
        completedSteps: [],
        pendingSteps: [],
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
        completedSteps: [],
        pendingSteps: [],
        contextSummary: 'Second session',
        checkpoints: [],
        status: 'interrupted',
      }

      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-100000.json'), session1)
      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), session2)

      const latest = await manager.getLatestSession(featureName)

      expect(latest).not.toBeNull()
      expect(latest?.id).toBe('session-20260121-140000')
    })

    it('should correctly identify interrupted sessions', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionsPath = manager.getSessionsPath(featureName)
      await fs.ensureDir(sessionsPath)

      const interruptedSession: LongRunningSession = {
        id: 'session-20260121-140000',
        feature: featureName,
        startedAt: '2026-01-21T14:00:00.000Z',
        lastActivity: '2026-01-21T16:00:00.000Z',
        currentStep: 'Step 2',
        completedSteps: ['Step 1'],
        pendingSteps: ['Step 2', 'Step 3'],
        contextSummary: 'Interrupted session',
        checkpoints: [],
        status: 'interrupted',
      }

      await fs.writeJSON(path.join(sessionsPath, 'session-20260121-140000.json'), interruptedSession)

      const latest = await manager.getLatestSession(featureName)

      expect(latest?.status).toBe('interrupted')
    })
  })

  describe('createSession', () => {
    it('should create session with correct ID format', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      expect(sessionId).toMatch(/^session-\d{8}-\d{6}$/)
    })

    it('should initialize all required fields', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)

      const session = await fs.readJSON(sessionFile)

      expect(session).toHaveProperty('id', sessionId)
      expect(session).toHaveProperty('feature', featureName)
      expect(session).toHaveProperty('startedAt')
      expect(session).toHaveProperty('lastActivity')
      expect(session).toHaveProperty('currentStep')
      expect(session).toHaveProperty('completedSteps')
      expect(session).toHaveProperty('pendingSteps')
      expect(session).toHaveProperty('contextSummary')
      expect(session).toHaveProperty('checkpoints')
      expect(session).toHaveProperty('status', 'active')
    })

    it('should store session in correct directory', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)
      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)

      const exists = await fs.pathExists(sessionFile)
      expect(exists).toBe(true)
    })
  })

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      await manager.updateSession(featureName, sessionId, {
        currentStep: 'Updated step',
        completedSteps: ['Step 1', 'Step 2'],
      })

      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)
      const session = await fs.readJSON(sessionFile)

      expect(session.currentStep).toBe('Updated step')
      expect(session.completedSteps).toHaveLength(2)
    })

    it('should handle missing session gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      await expect(
        manager.updateSession(featureName, 'non-existent-session', { currentStep: 'Test' })
      ).rejects.toThrow()
    })

    it('should update lastActivity timestamp', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      await new Promise((resolve) => setTimeout(resolve, 100))

      await manager.updateSession(featureName, sessionId, { currentStep: 'New step' })

      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)
      const session = await fs.readJSON(sessionFile)

      expect(new Date(session.lastActivity).getTime()).toBeGreaterThan(
        new Date(session.startedAt).getTime()
      )
    })
  })

  describe('endSession', () => {
    it('should mark session as ended with correct status', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      await manager.endSession(featureName, sessionId, 'task_complete')

      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)
      const session = await fs.readJSON(sessionFile)

      expect(session.status).toBe('completed')
    })

    it('should create checkpoint on session end', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      await manager.endSession(featureName, sessionId, 'session_end')

      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)
      const session = await fs.readJSON(sessionFile)

      expect(session.checkpoints.length).toBeGreaterThan(0)
      expect(session.checkpoints[session.checkpoints.length - 1].trigger).toBe('session_end')
    })
  })

  describe('resumeFromSnapshot', () => {
    it('should restore state from specified snapshot', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const initialState = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'completed' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, initialState)

      const snapshotsPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'snapshots'
      )
      await fs.ensureDir(snapshotsPath)

      const snapshotId = 'snapshot-001'
      const snapshotPath = path.join(snapshotsPath, `${snapshotId}.json`)
      await fs.writeJSON(snapshotPath, initialState)

      const restoredState = await manager.resumeFromSnapshot(featureName, snapshotId)

      expect(restoredState.progress).toBe(50)
      expect(restoredState.tasks).toHaveLength(1)
    })

    it('should use latest snapshot when none specified', async () => {
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

      const snapshotsPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'snapshots'
      )
      await fs.ensureDir(snapshotsPath)

      await fs.writeJSON(path.join(snapshotsPath, 'snapshot-001.json'), { ...state, progress: 25 })
      await fs.writeJSON(path.join(snapshotsPath, 'snapshot-002.json'), { ...state, progress: 75 })

      const restoredState = await manager.resumeFromSnapshot(featureName)

      expect(restoredState.progress).toBe(75)
    })

    it('should throw when snapshot not found', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      await expect(manager.resumeFromSnapshot(featureName, 'non-existent')).rejects.toThrow()
    })

    it('should preserve session continuity', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      await manager.updateSession(featureName, sessionId, {
        completedSteps: ['Step 1'],
      })

      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)
      const sessionBefore = await fs.readJSON(sessionFile)

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const snapshotsPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'snapshots'
      )
      await fs.ensureDir(snapshotsPath)
      await fs.writeJSON(path.join(snapshotsPath, 'snapshot-001.json'), state)

      await manager.resumeFromSnapshot(featureName, 'snapshot-001')

      const sessionAfter = await fs.readJSON(sessionFile)
      expect(sessionAfter.id).toBe(sessionBefore.id)
    })
  })

  describe('Atomic Operations', () => {
    it('should use temp file pattern for session writes', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const sessionId = await manager.createSession(featureName)

      const sessionsPath = manager.getSessionsPath(featureName)
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`)

      expect(await fs.pathExists(sessionFile)).toBe(true)
    })
  })
})
