import {
  featureToTask,
  phaseToStatus,
  progressToCustomField,
  statusToPhase,
  taskToFeature,
} from '../../../src/providers/clickup/mapper.js'
import type { ClickUpTask } from '../../../src/providers/clickup/types.js'
import type { LocalFeature } from '../../../src/types/provider.js'

describe('ClickUp Mapper', () => {
  describe('featureToTask', () => {
    it('should map ADK feature to ClickUp task payload', () => {
      const feature: LocalFeature = {
        name: 'user-authentication',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.name).toBe('user-authentication')
      expect(result.description).toContain('user-authentication')
      expect(result.status).toBeDefined()
    })

    it('should include progress in description', () => {
      const feature: LocalFeature = {
        name: 'feature-x',
        phase: 'qa',
        progress: 75,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.description).toContain('75%')
    })

    it('should map phase to status', () => {
      const feature: LocalFeature = {
        name: 'feature-y',
        phase: 'prd',
        progress: 0,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.status).toBe('to do')
    })

    it('should handle feature with prdPath', () => {
      const feature: LocalFeature = {
        name: 'feature-z',
        phase: 'research',
        progress: 25,
        prdPath: '.claude/plans/features/feature-z/prd.md',
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.description).toContain('PRD')
    })
  })

  describe('taskToFeature', () => {
    it('should map ClickUp task to ADK feature', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task123',
        name: 'my-feature',
        description: 'Feature description',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        url: 'https://app.clickup.com/t/task123',
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.id).toBe('task123')
      expect(result.name).toBe('my-feature')
      expect(result.status).toBe('in progress')
      expect(result.url).toBe('https://app.clickup.com/t/task123')
    })

    it('should extract phase from task status', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task456',
        name: 'another-feature',
        status: { status: 'review', color: '#fff', type: 'custom', orderindex: 2 },
        url: 'https://app.clickup.com/t/task456',
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.phase).toBe('qa')
    })

    it('should handle null description', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task789',
        name: 'no-desc-feature',
        description: null,
        status: { status: 'to do', color: '#fff', type: 'open', orderindex: 0 },
        url: 'https://app.clickup.com/t/task789',
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.description).toBeUndefined()
    })

    it('should preserve IDs correctly', () => {
      const task: Partial<ClickUpTask> = {
        id: 'abc123xyz',
        custom_id: 'FEAT-001',
        name: 'custom-id-feature',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        url: 'https://app.clickup.com/t/abc123xyz',
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.id).toBe('abc123xyz')
    })
  })

  describe('phaseToStatus', () => {
    it('should map prd to "to do"', () => {
      expect(phaseToStatus('prd')).toBe('to do')
    })

    it('should map research to "in progress"', () => {
      expect(phaseToStatus('research')).toBe('in progress')
    })

    it('should map tasks to "in progress"', () => {
      expect(phaseToStatus('tasks')).toBe('in progress')
    })

    it('should map plan to "in progress"', () => {
      expect(phaseToStatus('plan')).toBe('in progress')
    })

    it('should map implement to "in progress"', () => {
      expect(phaseToStatus('implement')).toBe('in progress')
    })

    it('should map qa to "review"', () => {
      expect(phaseToStatus('qa')).toBe('review')
    })

    it('should map docs to "review"', () => {
      expect(phaseToStatus('docs')).toBe('review')
    })

    it('should map deploy to "complete"', () => {
      expect(phaseToStatus('deploy')).toBe('complete')
    })

    it('should map done to "complete"', () => {
      expect(phaseToStatus('done')).toBe('complete')
    })

    it('should return "to do" for unknown phases', () => {
      expect(phaseToStatus('unknown')).toBe('to do')
    })
  })

  describe('statusToPhase', () => {
    it('should map "to do" to prd', () => {
      expect(statusToPhase('to do')).toBe('prd')
    })

    it('should map "in progress" to implement', () => {
      expect(statusToPhase('in progress')).toBe('implement')
    })

    it('should map "review" to qa', () => {
      expect(statusToPhase('review')).toBe('qa')
    })

    it('should map "complete" to done', () => {
      expect(statusToPhase('complete')).toBe('done')
    })

    it('should map "closed" to done', () => {
      expect(statusToPhase('closed')).toBe('done')
    })

    it('should be case insensitive', () => {
      expect(statusToPhase('TO DO')).toBe('prd')
      expect(statusToPhase('In Progress')).toBe('implement')
    })

    it('should return "prd" for unknown statuses', () => {
      expect(statusToPhase('unknown')).toBe('prd')
    })
  })

  describe('progressToCustomField', () => {
    it('should map progress percentage to custom field value', () => {
      expect(progressToCustomField(50)).toEqual({ value: 50 })
    })

    it('should handle 0 progress', () => {
      expect(progressToCustomField(0)).toEqual({ value: 0 })
    })

    it('should handle 100 progress', () => {
      expect(progressToCustomField(100)).toEqual({ value: 100 })
    })

    it('should clamp negative values to 0', () => {
      expect(progressToCustomField(-10)).toEqual({ value: 0 })
    })

    it('should clamp values over 100 to 100', () => {
      expect(progressToCustomField(150)).toEqual({ value: 100 })
    })
  })

  describe('featureToTask with all optional paths', () => {
    it('should include tasksPath when provided', () => {
      const feature: LocalFeature = {
        name: 'full-feature',
        phase: 'implement',
        progress: 50,
        tasksPath: '.claude/plans/features/full-feature/tasks.md',
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.description).toContain('Tasks:')
      expect(result.description).toContain('tasks.md')
    })

    it('should include researchPath when provided', () => {
      const feature: LocalFeature = {
        name: 'research-feature',
        phase: 'research',
        progress: 25,
        researchPath: '.claude/plans/features/research-feature/research.md',
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.description).toContain('Research:')
      expect(result.description).toContain('research.md')
    })

    it('should include planPath when provided', () => {
      const feature: LocalFeature = {
        name: 'plan-feature',
        phase: 'plan',
        progress: 30,
        planPath: '.claude/plans/features/plan-feature/plan.md',
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.description).toContain('Plan:')
      expect(result.description).toContain('plan.md')
    })

    it('should include all paths when all are provided', () => {
      const feature: LocalFeature = {
        name: 'complete-feature',
        phase: 'implement',
        progress: 60,
        prdPath: '.claude/plans/features/complete-feature/prd.md',
        tasksPath: '.claude/plans/features/complete-feature/tasks.md',
        researchPath: '.claude/plans/features/complete-feature/research.md',
        planPath: '.claude/plans/features/complete-feature/plan.md',
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = featureToTask(feature)

      expect(result.description).toContain('PRD:')
      expect(result.description).toContain('Tasks:')
      expect(result.description).toContain('Research:')
      expect(result.description).toContain('Plan:')
    })
  })

  describe('taskToFeature with progress extraction', () => {
    const createMockCustomField = (type: string, value?: unknown) =>
      ({
        id: `field-${type}`,
        name: `${type} field`,
        type,
        type_config: {},
        date_created: '1234567890000',
        hide_from_guests: false,
        required: false,
        value,
      }) as ClickUpTask['custom_fields'][0]

    it('should extract progress from manual_progress custom field', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task-progress',
        name: 'progress-feature',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        url: 'https://app.clickup.com/t/task-progress',
        date_created: '1234567890000',
        date_updated: '1234567890000',
        custom_fields: [createMockCustomField('manual_progress', 75)],
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.progress).toBe(75)
    })

    it('should extract progress from automatic_progress custom field', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task-auto-progress',
        name: 'auto-progress-feature',
        status: { status: 'in progress', color: '#fff', type: 'custom', orderindex: 1 },
        url: 'https://app.clickup.com/t/task-auto-progress',
        date_created: '1234567890000',
        date_updated: '1234567890000',
        custom_fields: [createMockCustomField('automatic_progress', 60)],
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.progress).toBe(60)
    })

    it('should return undefined progress when no progress field exists', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task-no-progress',
        name: 'no-progress-feature',
        status: { status: 'to do', color: '#fff', type: 'open', orderindex: 0 },
        url: 'https://app.clickup.com/t/task-no-progress',
        date_created: '1234567890000',
        date_updated: '1234567890000',
        custom_fields: [createMockCustomField('text', 'some value')],
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.progress).toBeUndefined()
    })

    it('should return undefined progress when custom_fields is undefined', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task-no-fields',
        name: 'no-fields-feature',
        status: { status: 'to do', color: '#fff', type: 'open', orderindex: 0 },
        url: 'https://app.clickup.com/t/task-no-fields',
        date_created: '1234567890000',
        date_updated: '1234567890000',
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.progress).toBeUndefined()
    })

    it('should return undefined progress when progress field value is undefined', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task-undefined-value',
        name: 'undefined-value-feature',
        status: { status: 'to do', color: '#fff', type: 'open', orderindex: 0 },
        url: 'https://app.clickup.com/t/task-undefined-value',
        date_created: '1234567890000',
        date_updated: '1234567890000',
        custom_fields: [createMockCustomField('manual_progress', undefined)],
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.progress).toBeUndefined()
    })

    it('should handle non-numeric timestamp by returning original string', () => {
      const task: Partial<ClickUpTask> = {
        id: 'task-iso',
        name: 'iso-date-feature',
        status: { status: 'to do', color: '#fff', type: 'open', orderindex: 0 },
        url: 'https://app.clickup.com/t/task-iso',
        date_created: 'invalid-timestamp',
        date_updated: 'not-a-number',
      }

      const result = taskToFeature(task as ClickUpTask)

      expect(result.createdAt).toBe('invalid-timestamp')
      expect(result.updatedAt).toBe('not-a-number')
    })
  })

  describe('featureToUpdatePayload', () => {
    it('should include name when provided', () => {
      const { featureToUpdatePayload } = require('../../../src/providers/clickup/mapper.js')
      const result = featureToUpdatePayload({ name: 'new-name' })
      expect(result.name).toBe('new-name')
    })

    it('should include status when phase is provided', () => {
      const { featureToUpdatePayload } = require('../../../src/providers/clickup/mapper.js')
      const result = featureToUpdatePayload({ phase: 'qa' })
      expect(result.status).toBe('review')
    })

    it('should return empty object when no name or phase', () => {
      const { featureToUpdatePayload } = require('../../../src/providers/clickup/mapper.js')
      const result = featureToUpdatePayload({})
      expect(result).toEqual({})
    })
  })

  describe('createTaskFromFeature', () => {
    it('should create task with priority option', () => {
      const { createTaskFromFeature } = require('../../../src/providers/clickup/mapper.js')
      const feature: LocalFeature = {
        name: 'priority-feature',
        phase: 'prd',
        progress: 0,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = createTaskFromFeature(feature, { priority: 2 })

      expect(result.name).toBe('priority-feature')
      expect(result.priority).toBe(2)
    })

    it('should create task with tags option', () => {
      const { createTaskFromFeature } = require('../../../src/providers/clickup/mapper.js')
      const feature: LocalFeature = {
        name: 'tagged-feature',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = createTaskFromFeature(feature, { tags: ['adk', 'feature'] })

      expect(result.name).toBe('tagged-feature')
      expect(result.tags).toEqual(['adk', 'feature'])
    })

    it('should create task with both priority and tags', () => {
      const { createTaskFromFeature } = require('../../../src/providers/clickup/mapper.js')
      const feature: LocalFeature = {
        name: 'full-options-feature',
        phase: 'qa',
        progress: 80,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = createTaskFromFeature(feature, { priority: 1, tags: ['urgent', 'release'] })

      expect(result.priority).toBe(1)
      expect(result.tags).toEqual(['urgent', 'release'])
    })

    it('should create task without options', () => {
      const { createTaskFromFeature } = require('../../../src/providers/clickup/mapper.js')
      const feature: LocalFeature = {
        name: 'no-options-feature',
        phase: 'prd',
        progress: 0,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const result = createTaskFromFeature(feature)

      expect(result.name).toBe('no-options-feature')
      expect(result.priority).toBeUndefined()
      expect(result.tags).toBeUndefined()
    })
  })
})
