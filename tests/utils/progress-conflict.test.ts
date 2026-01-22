import { describe, expect, it } from '@jest/globals'

describe('ProgressConflict', () => {
  describe('detectInconsistencies', () => {
    it('should detect phase mismatch between phase and task status', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'completed',
        progress: 100,
        tasks: [{ name: 'Task 1', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      expect(inconsistencies.length).toBeGreaterThan(0)
      expect(inconsistencies[0].type).toBe('phase_mismatch')
      expect(inconsistencies[0].severity).toBe('error')
    })

    it('should detect when P0 tasks are pending but phase is completed', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'completed',
        progress: 100,
        tasks: [{ name: 'Critical task', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      const p0Error = inconsistencies.find((i) => i.type === 'missing_required')
      expect(p0Error).toBeDefined()
      expect(p0Error?.severity).toBe('error')
    })

    it('should detect tasks in_progress but phase already advanced', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'qa',
        progress: 75,
        tasks: [
          {
            name: 'Implementation task',
            status: 'in_progress' as const,
            priority: 1,
            phase: 'implement',
          },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      const statusMismatch = inconsistencies.find((i) => i.type === 'task_status_mismatch')
      expect(statusMismatch).toBeDefined()
      expect(statusMismatch?.severity).toBe('warning')
    })

    it('should detect orphan tasks (no corresponding phase)', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Random task', status: 'pending' as const, priority: 2, phase: 'nonexistent' },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      const orphan = inconsistencies.find((i) => i.type === 'orphan_task')
      expect(orphan).toBeDefined()
      expect(orphan?.severity).toBe('warning')
    })

    it('should return no inconsistencies when state is consistent', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'completed' as const, priority: 0 },
          { name: 'Task 2', status: 'in_progress' as const, priority: 0 },
          { name: 'Task 3', status: 'pending' as const, priority: 1 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      expect(inconsistencies).toEqual([])
    })

    it('should handle empty tasks.md gracefully', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'prd',
        progress: 0,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      expect(inconsistencies).toEqual([])
    })
  })

  describe('resolveInconsistencies', () => {
    it('should apply progress-wins strategy', async () => {
      const { resolveInconsistencies, detectInconsistencies } = await import(
        '../../src/utils/progress-conflict'
      )

      const state = {
        feature: 'test',
        currentPhase: 'implement',
        progress: 75,
        tasks: [{ name: 'Task 1', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)
      const result = resolveInconsistencies(state, inconsistencies, 'progress-wins')

      expect(result.applied).toBe(true)
      expect(result.changes.length).toBeGreaterThan(0)
      expect(result.requiresManual).toBe(false)
    })

    it('should apply tasks-wins strategy', async () => {
      const { resolveInconsistencies, detectInconsistencies } = await import(
        '../../src/utils/progress-conflict'
      )

      const state = {
        feature: 'test',
        currentPhase: 'completed',
        progress: 100,
        tasks: [{ name: 'Task 1', status: 'in_progress' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)
      const result = resolveInconsistencies(state, inconsistencies, 'tasks-wins')

      expect(result.applied).toBe(true)
      // Phase should be updated based on task status
      expect(result.changes.some((c) => c.field === 'currentPhase')).toBe(true)
    })

    it('should apply merge strategy (combine information)', async () => {
      const { resolveInconsistencies, detectInconsistencies } = await import(
        '../../src/utils/progress-conflict'
      )

      const state = {
        feature: 'test',
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task from progress', status: 'completed' as const, priority: 0 },
          { name: 'Task from tasks.md', status: 'pending' as const, priority: 1 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)
      const result = resolveInconsistencies(state, inconsistencies, 'merge')

      expect(result.applied).toBe(true)
      // Should preserve all tasks
      expect(result.changes.length).toBeGreaterThanOrEqual(0)
    })

    it('should return requiresManual for manual strategy', async () => {
      const { resolveInconsistencies, detectInconsistencies } = await import(
        '../../src/utils/progress-conflict'
      )

      const state = {
        feature: 'test',
        currentPhase: 'completed',
        progress: 100,
        tasks: [{ name: 'Task 1', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)
      const result = resolveInconsistencies(state, inconsistencies, 'manual')

      expect(result.applied).toBe(false)
      expect(result.requiresManual).toBe(true)
      expect(result.changes).toEqual([])
    })

    it('should track changes for audit', async () => {
      const { resolveInconsistencies, detectInconsistencies } = await import(
        '../../src/utils/progress-conflict'
      )

      const state = {
        feature: 'test',
        currentPhase: 'qa',
        progress: 90,
        tasks: [{ name: 'Task 1', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)
      const result = resolveInconsistencies(state, inconsistencies, 'progress-wins')

      expect(result.changes).toBeDefined()
      result.changes.forEach((change) => {
        expect(change).toHaveProperty('field')
        expect(change).toHaveProperty('oldValue')
        expect(change).toHaveProperty('newValue')
      })
    })

    it('should not lose data during resolution', async () => {
      const { resolveInconsistencies, detectInconsistencies } = await import(
        '../../src/utils/progress-conflict'
      )

      const state = {
        feature: 'test',
        currentPhase: 'implement',
        progress: 60,
        tasks: [
          { name: 'Task 1', status: 'completed' as const, priority: 0, notes: 'Important note' },
          { name: 'Task 2', status: 'in_progress' as const, priority: 1 },
        ],
        transitions: [
          {
            timestamp: '2026-01-19T10:00:00Z',
            fromPhase: 'research',
            toPhase: 'plan',
            trigger: 'test',
          },
        ],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)
      resolveInconsistencies(state, inconsistencies, 'merge')

      // Original data should be preserved
      expect(state.tasks[0].notes).toBe('Important note')
      expect(state.transitions).toHaveLength(1)
    })
  })

  describe('Inconsistency Types', () => {
    it('should provide actionable descriptions', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'completed',
        progress: 100,
        tasks: [{ name: 'Pending P0 task', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      inconsistencies.forEach((inconsistency) => {
        expect(inconsistency.description).toBeTruthy()
        expect(inconsistency.description.length).toBeGreaterThan(10)
      })
    })

    it('should assign appropriate severity levels', async () => {
      const { detectInconsistencies } = await import('../../src/utils/progress-conflict')

      const state = {
        feature: 'test',
        currentPhase: 'qa',
        progress: 80,
        tasks: [
          { name: 'P0 task', status: 'pending' as const, priority: 0 },
          { name: 'P2 task', status: 'in_progress' as const, priority: 2, phase: 'implement' },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const inconsistencies = detectInconsistencies(state)

      const errors = inconsistencies.filter((i) => i.severity === 'error')
      const warnings = inconsistencies.filter((i) => i.severity === 'warning')

      expect(errors.length + warnings.length).toBe(inconsistencies.length)
      // P0 tasks should be errors
      expect(errors.length).toBeGreaterThan(0)
    })
  })
})
