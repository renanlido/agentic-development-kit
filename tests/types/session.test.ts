import { describe, expect, it } from '@jest/globals'
import type {
  CheckpointReason,
  CheckpointRef,
  HandoffDocument,
  LongRunningSession,
  SessionListItem,
  SessionStatus,
} from '../../src/types/session'

describe('Session Types', () => {
  describe('LongRunningSession', () => {
    it('should accept valid session object', () => {
      const session: LongRunningSession = {
        id: 'session-123',
        feature: 'test-feature',
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'Implementation',
        completedSteps: ['Planning', 'Research'],
        pendingSteps: ['Testing', 'Deployment'],
        contextSummary: 'Working on feature implementation',
        checkpoints: [],
        status: 'active',
      }

      expect(session.id).toBe('session-123')
      expect(session.status).toBe('active')
    })

    it('should accept session with checkpoints', () => {
      const checkpoint: CheckpointRef = {
        id: 'checkpoint-001',
        createdAt: '2026-01-21T11:00:00.000Z',
        step: 'Planning',
        trigger: 'step_complete',
        snapshotPath: '/path/to/snapshot',
      }

      const session: LongRunningSession = {
        id: 'session-123',
        feature: 'test-feature',
        startedAt: '2026-01-21T10:00:00.000Z',
        lastActivity: '2026-01-21T12:00:00.000Z',
        currentStep: 'Implementation',
        completedSteps: ['Planning'],
        pendingSteps: ['Testing'],
        contextSummary: 'Working on feature implementation',
        checkpoints: [checkpoint],
        status: 'active',
      }

      expect(session.checkpoints).toHaveLength(1)
      expect(session.checkpoints[0].trigger).toBe('step_complete')
    })

    it('should accept session with optional commitHash', () => {
      const checkpoint: CheckpointRef = {
        id: 'checkpoint-001',
        createdAt: '2026-01-21T11:00:00.000Z',
        step: 'Planning',
        trigger: 'manual',
        commitHash: 'abc123',
        snapshotPath: '/path/to/snapshot',
      }

      expect(checkpoint.commitHash).toBe('abc123')
    })
  })

  describe('SessionStatus', () => {
    it('should accept all valid status values', () => {
      const statuses: SessionStatus[] = ['active', 'completed', 'interrupted', 'error']

      for (const status of statuses) {
        const session: LongRunningSession = {
          id: 'session-123',
          feature: 'test-feature',
          startedAt: '2026-01-21T10:00:00.000Z',
          lastActivity: '2026-01-21T12:00:00.000Z',
          currentStep: 'Implementation',
          completedSteps: [],
          pendingSteps: [],
          contextSummary: 'Test',
          checkpoints: [],
          status: status,
        }

        expect(session.status).toBe(status)
      }
    })
  })

  describe('CheckpointReason', () => {
    it('should accept all valid checkpoint reasons', () => {
      const reasons: CheckpointReason[] = [
        'manual',
        'step_complete',
        'context_warning',
        'error_recovery',
        'time_limit',
        'task_complete',
        'session_end',
      ]

      for (const reason of reasons) {
        const checkpoint: CheckpointRef = {
          id: 'checkpoint-001',
          createdAt: '2026-01-21T11:00:00.000Z',
          step: 'Planning',
          trigger: reason,
          snapshotPath: '/path/to/snapshot',
        }

        expect(checkpoint.trigger).toBe(reason)
      }
    })
  })

  describe('SessionListItem', () => {
    it('should accept session list item with null endedAt', () => {
      const item: SessionListItem = {
        id: 'session-123',
        feature: 'test-feature',
        startedAt: '2026-01-21T10:00:00.000Z',
        endedAt: null,
        duration: '2h 30m',
        status: 'active',
        stepsCompleted: 3,
        stepsTotal: 5,
      }

      expect(item.endedAt).toBeNull()
    })

    it('should accept session list item with endedAt', () => {
      const item: SessionListItem = {
        id: 'session-123',
        feature: 'test-feature',
        startedAt: '2026-01-21T10:00:00.000Z',
        endedAt: '2026-01-21T14:00:00.000Z',
        duration: '4h',
        status: 'completed',
        stepsCompleted: 5,
        stepsTotal: 5,
      }

      expect(item.endedAt).toBe('2026-01-21T14:00:00.000Z')
    })
  })

  describe('HandoffDocument', () => {
    it('should accept valid handoff document structure', () => {
      const handoff: HandoffDocument = {
        current: 'Implementing authentication (60% complete)',
        done: ['Setup project', 'Create schema'],
        inProgress: ['Auth middleware', 'Password hashing'],
        next: ['Add tests', 'Deploy'],
        files: ['src/auth.ts', 'src/user.ts'],
        issues: 'None blocking',
      }

      expect(handoff.done).toHaveLength(2)
      expect(handoff.inProgress).toHaveLength(2)
      expect(handoff.next).toHaveLength(2)
      expect(handoff.files).toHaveLength(2)
    })

    it('should accept empty arrays in handoff document', () => {
      const handoff: HandoffDocument = {
        current: 'Starting new feature',
        done: [],
        inProgress: [],
        next: ['Task 1', 'Task 2'],
        files: [],
        issues: 'No issues',
      }

      expect(handoff.done).toHaveLength(0)
      expect(handoff.inProgress).toHaveLength(0)
      expect(handoff.files).toHaveLength(0)
    })
  })
})
