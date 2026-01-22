import { describe, expect, it } from '@jest/globals'

describe('ProgressSync Types', () => {
  describe('Type Exports', () => {
    it('should export UnifiedFeatureState type', async () => {
      const module = await import('../../src/types/progress-sync')
      expect(module).toHaveProperty('UnifiedFeatureStateSchema')
    })

    it('should export TaskState type', async () => {
      const module = await import('../../src/types/progress-sync')
      expect(module).toHaveProperty('TaskStateSchema')
    })

    it('should export TransitionEntry type', async () => {
      const module = await import('../../src/types/progress-sync')
      expect(module).toHaveProperty('TransitionEntrySchema')
    })

    it('should export SnapshotData type', async () => {
      const module = await import('../../src/types/progress-sync')
      expect(module).toHaveProperty('SnapshotDataSchema')
    })

    it('should export PhaseMetrics type', async () => {
      const module = await import('../../src/types/progress-sync')
      expect(module).toHaveProperty('PhaseMetricsSchema')
    })
  })

  describe('Zod Schema Validation', () => {
    it('should validate valid UnifiedFeatureState', async () => {
      const { UnifiedFeatureStateSchema } = await import('../../src/types/progress-sync')

      const validState = {
        feature: 'test-feature',
        currentPhase: 'implement',
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      expect(() => UnifiedFeatureStateSchema.parse(validState)).not.toThrow()
    })

    it('should reject invalid UnifiedFeatureState (missing required fields)', async () => {
      const { UnifiedFeatureStateSchema } = await import('../../src/types/progress-sync')

      const invalidState = {
        feature: 'test-feature',
      }

      expect(() => UnifiedFeatureStateSchema.parse(invalidState)).toThrow()
    })

    it('should validate TaskState with all statuses', async () => {
      const { TaskStateSchema } = await import('../../src/types/progress-sync')

      const statuses = ['pending', 'in_progress', 'completed', 'blocked']

      for (const status of statuses) {
        const task = {
          name: 'Test Task',
          status,
          priority: 0,
        }
        expect(() => TaskStateSchema.parse(task)).not.toThrow()
      }
    })

    it('should reject invalid TaskStatus', async () => {
      const { TaskStateSchema } = await import('../../src/types/progress-sync')

      const task = {
        name: 'Test Task',
        status: 'invalid_status',
        priority: 0,
      }

      expect(() => TaskStateSchema.parse(task)).toThrow()
    })

    it('should validate TransitionEntry with all required fields', async () => {
      const { TransitionEntrySchema } = await import('../../src/types/progress-sync')

      const transition = {
        timestamp: new Date().toISOString(),
        fromPhase: 'research',
        toPhase: 'plan',
        trigger: 'adk feature plan',
      }

      expect(() => TransitionEntrySchema.parse(transition)).not.toThrow()
    })

    it('should validate TransitionEntry with optional duration', async () => {
      const { TransitionEntrySchema } = await import('../../src/types/progress-sync')

      const transition = {
        timestamp: new Date().toISOString(),
        fromPhase: 'research',
        toPhase: 'plan',
        trigger: 'adk feature plan',
        duration: 3600,
      }

      expect(() => TransitionEntrySchema.parse(transition)).not.toThrow()
    })

    it('should validate SnapshotData structure', async () => {
      const { SnapshotDataSchema } = await import('../../src/types/progress-sync')

      const snapshot = {
        id: 'pre-implement-2026-01-20',
        trigger: 'pre-implement',
        createdAt: new Date().toISOString(),
        state: {
          feature: 'test',
          currentPhase: 'research',
          progress: 25,
          tasks: [],
          transitions: [],
          lastUpdated: new Date().toISOString(),
          lastSynced: new Date().toISOString(),
        },
        files: {
          'progress.md': '# Progress content',
          'tasks.md': '# Tasks content',
        },
      }

      expect(() => SnapshotDataSchema.parse(snapshot)).not.toThrow()
    })

    it('should validate PhaseMetrics with all fields', async () => {
      const { PhaseMetricsSchema } = await import('../../src/types/progress-sync')

      const metrics = {
        phase: 'implement',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 7200,
        tasksCompleted: 5,
        tasksTotal: 10,
        filesModified: ['src/file1.ts', 'src/file2.ts'],
      }

      expect(() => PhaseMetricsSchema.parse(metrics)).not.toThrow()
    })

    it('should validate PhaseMetrics without optional fields', async () => {
      const { PhaseMetricsSchema } = await import('../../src/types/progress-sync')

      const metrics = {
        phase: 'implement',
        startedAt: new Date().toISOString(),
        tasksCompleted: 0,
        tasksTotal: 10,
        filesModified: [],
      }

      expect(() => PhaseMetricsSchema.parse(metrics)).not.toThrow()
    })
  })

  describe('Type Compatibility', () => {
    it('should be compatible with existing FeatureProgress type', async () => {
      const { UnifiedFeatureStateSchema } = await import('../../src/types/progress-sync')
      type FeatureProgress = import('../../src/utils/progress').FeatureProgress
      type StepProgress = import('../../src/utils/progress').StepProgress

      const legacyProgress: FeatureProgress = {
        feature: 'test',
        currentPhase: 'implement',
        steps: [
          { name: 'prd', status: 'completed' },
          { name: 'research', status: 'in_progress' },
        ],
        lastUpdated: new Date().toISOString(),
      }

      // Should be able to construct UnifiedFeatureState from FeatureProgress
      const unifiedState = {
        feature: legacyProgress.feature,
        currentPhase: legacyProgress.currentPhase,
        progress: 50,
        tasks: legacyProgress.steps.map((step: StepProgress) => ({
          name: step.name,
          status: step.status,
          priority: 0,
        })),
        transitions: [],
        lastUpdated: legacyProgress.lastUpdated,
        lastSynced: legacyProgress.lastUpdated,
      }

      expect(() => UnifiedFeatureStateSchema.parse(unifiedState)).not.toThrow()
    })
  })

  describe('Inconsistency Types', () => {
    it('should validate Inconsistency with all severity levels', async () => {
      const { InconsistencySchema } = await import('../../src/types/progress-sync')

      const warning = {
        type: 'phase_mismatch',
        severity: 'warning',
        description: 'Phase mismatch detected',
        field: 'currentPhase',
      }

      const error = {
        type: 'missing_required',
        severity: 'error',
        description: 'Required task missing',
        field: 'tasks',
      }

      expect(() => InconsistencySchema.parse(warning)).not.toThrow()
      expect(() => InconsistencySchema.parse(error)).not.toThrow()
    })

    it('should validate all inconsistency types', async () => {
      const { InconsistencySchema } = await import('../../src/types/progress-sync')

      const types = ['phase_mismatch', 'task_status_mismatch', 'orphan_task', 'missing_required']

      for (const type of types) {
        const inconsistency = {
          type,
          severity: 'warning',
          description: `Test ${type}`,
          field: 'test',
        }
        expect(() => InconsistencySchema.parse(inconsistency)).not.toThrow()
      }
    })
  })

  describe('ProgressSyncResult Type', () => {
    it('should validate successful ProgressSyncResult', async () => {
      const { ProgressSyncResultSchema } = await import('../../src/types/progress-sync')

      const result = {
        success: true,
        changesApplied: [],
        inconsistenciesResolved: 0,
        duration: 150,
      }

      expect(() => ProgressSyncResultSchema.parse(result)).not.toThrow()
    })

    it('should validate ProgressSyncResult with snapshot', async () => {
      const { ProgressSyncResultSchema } = await import('../../src/types/progress-sync')

      const result = {
        success: true,
        changesApplied: [{ field: 'phase', oldValue: 'research', newValue: 'plan' }],
        inconsistenciesResolved: 1,
        snapshotCreated: 'pre-sync-2026-01-20',
        duration: 200,
      }

      expect(() => ProgressSyncResultSchema.parse(result)).not.toThrow()
    })
  })
})
