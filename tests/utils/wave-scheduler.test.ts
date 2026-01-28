import {
  createSchedulePlan,
  formatSchedulePlan,
  validateDependencies,
  type SchedulerConfig,
} from '../../src/utils/wave-scheduler'
import type { ParallelTasksDocument, ParsedTaskForParallel } from '../../src/utils/task-parser'

describe('wave-scheduler', () => {
  const defaultConfig: SchedulerConfig = {
    maxParallelTasks: 3,
    forceSequential: ['migration', 'config'],
    prioritizeByEstimate: true,
  }

  function createTask(
    id: string,
    title: string,
    deps: string[] = [],
    files: string[] = []
  ): ParsedTaskForParallel {
    return {
      id,
      title,
      type: 'Feature',
      status: 'pending',
      dependencies: deps,
      files,
      estimate: 'M',
    }
  }

  function createDoc(tasks: ParsedTaskForParallel[]): ParallelTasksDocument {
    return {
      featureName: 'test-feature',
      tasks,
      totalTasks: tasks.length,
      completedTasks: 0,
      pendingTasks: tasks.length,
    }
  }

  describe('createSchedulePlan', () => {
    it('should create single wave for independent tasks', () => {
      const doc = createDoc([
        createTask('1', 'Task A'),
        createTask('2', 'Task B'),
        createTask('3', 'Task C'),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)

      expect(plan.totalWaves).toBe(1)
      expect(plan.waves[0].tasks).toHaveLength(3)
      expect(plan.waves[0].parallelizable).toBe(true)
    })

    it('should create multiple waves for dependent tasks', () => {
      const doc = createDoc([
        createTask('1', 'Task A'),
        createTask('2', 'Task B', ['1']),
        createTask('3', 'Task C', ['2']),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)

      expect(plan.totalWaves).toBe(3)
      expect(plan.waves[0].tasks[0].id).toBe('1')
      expect(plan.waves[1].tasks[0].id).toBe('2')
      expect(plan.waves[2].tasks[0].id).toBe('3')
    })

    it('should group parallel tasks in same wave', () => {
      const doc = createDoc([
        createTask('1', 'Task A'),
        createTask('2', 'Task B'),
        createTask('3', 'Task C', ['1', '2']),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)

      expect(plan.totalWaves).toBe(2)
      expect(plan.waves[0].tasks).toHaveLength(2)
      expect(plan.waves[1].tasks).toHaveLength(1)
    })

    it('should detect file conflicts and mark wave as non-parallelizable', () => {
      const doc = createDoc([
        createTask('1', 'Task A', [], ['src/file.ts']),
        createTask('2', 'Task B', [], ['src/file.ts']),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)

      expect(plan.waves[0].parallelizable).toBe(false)
      expect(plan.waves[0].conflicts).toHaveLength(1)
    })

    it('should force sequential execution for migration tasks', () => {
      const doc = createDoc([
        createTask('1', 'Run migration'),
        createTask('2', 'Task B'),
        createTask('3', 'Task C'),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)

      const migrationTask = plan.waves.flatMap(w => w.tasks).find(t => t.title.includes('migration'))
      expect(migrationTask).toBeDefined()

      const migrationWave = plan.waves.find(w => w.tasks.some(t => t.title.includes('migration')))
      expect(migrationWave?.tasks).toHaveLength(1)
    })

    it('should respect maxParallelTasks limit', () => {
      const doc = createDoc([
        createTask('1', 'Task A'),
        createTask('2', 'Task B'),
        createTask('3', 'Task C'),
        createTask('4', 'Task D'),
        createTask('5', 'Task E'),
      ])

      const config: SchedulerConfig = {
        ...defaultConfig,
        maxParallelTasks: 2,
      }

      const plan = createSchedulePlan(doc, config)

      expect(plan.waves[0].tasks.length).toBeLessThanOrEqual(2)
    })

    it('should skip completed tasks', () => {
      const doc = createDoc([
        { ...createTask('1', 'Task A'), status: 'completed' },
        createTask('2', 'Task B', ['1']),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)

      expect(plan.totalTasks).toBe(1)
      expect(plan.waves[0].tasks[0].id).toBe('2')
    })
  })

  describe('validateDependencies', () => {
    it('should return empty array for valid dependencies', () => {
      const doc = createDoc([
        createTask('1', 'Task A'),
        createTask('2', 'Task B', ['1']),
      ])

      const errors = validateDependencies(doc)

      expect(errors).toHaveLength(0)
    })

    it('should detect non-existent dependencies', () => {
      const doc = createDoc([
        createTask('1', 'Task A', ['999']),
      ])

      const errors = validateDependencies(doc)

      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('non-existent')
    })

    it('should detect circular dependencies', () => {
      const doc = createDoc([
        createTask('1', 'Task A', ['2']),
        createTask('2', 'Task B', ['1']),
      ])

      const errors = validateDependencies(doc)

      expect(errors.some(e => e.includes('Circular'))).toBe(true)
    })
  })

  describe('formatSchedulePlan', () => {
    it('should format plan as readable string', () => {
      const doc = createDoc([
        createTask('1', 'Task A'),
        createTask('2', 'Task B'),
      ])

      const plan = createSchedulePlan(doc, defaultConfig)
      const formatted = formatSchedulePlan(plan)

      expect(formatted).toContain('Parallel Execution Plan')
      expect(formatted).toContain('Wave 1')
      expect(formatted).toContain('Task 1')
      expect(formatted).toContain('Task 2')
    })
  })
})
