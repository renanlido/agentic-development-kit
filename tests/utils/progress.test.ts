import {
  type FeatureProgress,
  getCompletedSteps,
  getNextStep,
  isStepCompleted,
  type StepProgress,
  updateStepStatus,
} from '../../src/utils/progress.js'

describe('progress', () => {
  const createMockProgress = (overrides?: Partial<FeatureProgress>): FeatureProgress => ({
    feature: 'test-feature',
    currentPhase: 'not_started',
    steps: [
      { name: 'entendimento', status: 'pending' },
      { name: 'breakdown', status: 'pending' },
      { name: 'arquitetura', status: 'pending' },
      { name: 'implementacao', status: 'pending' },
      { name: 'revisao', status: 'pending' },
      { name: 'documentacao', status: 'pending' },
    ],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  })

  describe('StepProgress interface', () => {
    it('should represent pending step', () => {
      const step: StepProgress = {
        name: 'entendimento',
        status: 'pending',
      }

      expect(step.status).toBe('pending')
      expect(step.startedAt).toBeUndefined()
      expect(step.completedAt).toBeUndefined()
    })

    it('should represent in_progress step', () => {
      const step: StepProgress = {
        name: 'breakdown',
        status: 'in_progress',
        startedAt: '2024-01-15',
      }

      expect(step.status).toBe('in_progress')
      expect(step.startedAt).toBeDefined()
    })

    it('should represent completed step', () => {
      const step: StepProgress = {
        name: 'arquitetura',
        status: 'completed',
        completedAt: '2024-01-16',
      }

      expect(step.status).toBe('completed')
      expect(step.completedAt).toBeDefined()
    })

    it('should represent failed step', () => {
      const step: StepProgress = {
        name: 'implementacao',
        status: 'failed',
        notes: 'Test failure',
      }

      expect(step.status).toBe('failed')
      expect(step.notes).toBe('Test failure')
    })
  })

  describe('FeatureProgress interface', () => {
    it('should represent feature progress', () => {
      const progress = createMockProgress()

      expect(progress.feature).toBe('test-feature')
      expect(progress.currentPhase).toBe('not_started')
      expect(progress.steps).toHaveLength(6)
    })

    it('should include nextStep when applicable', () => {
      const progress = createMockProgress({
        nextStep: 'breakdown',
      })

      expect(progress.nextStep).toBe('breakdown')
    })
  })

  describe('updateStepStatus', () => {
    it('should update step to in_progress', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'entendimento', 'in_progress')

      const step = updated.steps.find((s) => s.name === 'entendimento')
      expect(step?.status).toBe('in_progress')
      expect(step?.startedAt).toBeDefined()
    })

    it('should update step to completed', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'entendimento', 'completed')

      const step = updated.steps.find((s) => s.name === 'entendimento')
      expect(step?.status).toBe('completed')
      expect(step?.completedAt).toBeDefined()
    })

    it('should update step to failed with notes', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'entendimento', 'failed', 'Build error')

      const step = updated.steps.find((s) => s.name === 'entendimento')
      expect(step?.status).toBe('failed')
      expect(step?.notes).toBe('Build error')
    })

    it('should update currentPhase to in_progress step name', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'breakdown', 'in_progress')

      expect(updated.currentPhase).toBe('breakdown')
    })

    it('should calculate nextStep after completion', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'entendimento', 'completed')

      expect(updated.nextStep).toBe('breakdown')
    })

    it('should not change other steps', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'entendimento', 'completed')

      const otherStep = updated.steps.find((s) => s.name === 'breakdown')
      expect(otherStep?.status).toBe('pending')
    })

    it('should handle nonexistent step gracefully', () => {
      const progress = createMockProgress()
      const updated = updateStepStatus(progress, 'nonexistent', 'in_progress')

      expect(updated.steps.every((s) => s.status === 'pending' || s.status === 'in_progress')).toBe(
        true
      )
    })
  })

  describe('getNextStep', () => {
    it('should return first pending step when none in progress', () => {
      const progress = createMockProgress()
      const next = getNextStep(progress)

      expect(next).toBe('entendimento')
    })

    it('should return in_progress step when present', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'completed' },
          { name: 'breakdown', status: 'in_progress' },
          { name: 'arquitetura', status: 'pending' },
          { name: 'implementacao', status: 'pending' },
          { name: 'revisao', status: 'pending' },
          { name: 'documentacao', status: 'pending' },
        ],
      })

      const next = getNextStep(progress)
      expect(next).toBe('breakdown')
    })

    it('should return null when all steps completed', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'completed' },
          { name: 'breakdown', status: 'completed' },
          { name: 'arquitetura', status: 'completed' },
          { name: 'implementacao', status: 'completed' },
          { name: 'revisao', status: 'completed' },
          { name: 'documentacao', status: 'completed' },
        ],
      })

      const next = getNextStep(progress)
      expect(next).toBeNull()
    })

    it('should return pending step after in_progress', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'completed' },
          { name: 'breakdown', status: 'in_progress' },
          { name: 'arquitetura', status: 'pending' },
          { name: 'implementacao', status: 'pending' },
          { name: 'revisao', status: 'pending' },
          { name: 'documentacao', status: 'pending' },
        ],
      })

      const next = getNextStep(progress)
      expect(next).toBe('breakdown')
    })
  })

  describe('isStepCompleted', () => {
    it('should return true for completed step', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'completed' },
          { name: 'breakdown', status: 'pending' },
          { name: 'arquitetura', status: 'pending' },
          { name: 'implementacao', status: 'pending' },
          { name: 'revisao', status: 'pending' },
          { name: 'documentacao', status: 'pending' },
        ],
      })

      expect(isStepCompleted(progress, 'entendimento')).toBe(true)
    })

    it('should return false for pending step', () => {
      const progress = createMockProgress()

      expect(isStepCompleted(progress, 'entendimento')).toBe(false)
    })

    it('should return false for in_progress step', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'in_progress' },
          { name: 'breakdown', status: 'pending' },
          { name: 'arquitetura', status: 'pending' },
          { name: 'implementacao', status: 'pending' },
          { name: 'revisao', status: 'pending' },
          { name: 'documentacao', status: 'pending' },
        ],
      })

      expect(isStepCompleted(progress, 'entendimento')).toBe(false)
    })

    it('should return false for failed step', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'failed' },
          { name: 'breakdown', status: 'pending' },
          { name: 'arquitetura', status: 'pending' },
          { name: 'implementacao', status: 'pending' },
          { name: 'revisao', status: 'pending' },
          { name: 'documentacao', status: 'pending' },
        ],
      })

      expect(isStepCompleted(progress, 'entendimento')).toBe(false)
    })

    it('should return false for nonexistent step', () => {
      const progress = createMockProgress()

      expect(isStepCompleted(progress, 'nonexistent')).toBe(false)
    })
  })

  describe('getCompletedSteps', () => {
    it('should return empty array when no steps completed', () => {
      const progress = createMockProgress()
      const completed = getCompletedSteps(progress)

      expect(completed).toEqual([])
    })

    it('should return completed step names', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'completed' },
          { name: 'breakdown', status: 'completed' },
          { name: 'arquitetura', status: 'in_progress' },
          { name: 'implementacao', status: 'pending' },
          { name: 'revisao', status: 'pending' },
          { name: 'documentacao', status: 'pending' },
        ],
      })

      const completed = getCompletedSteps(progress)
      expect(completed).toEqual(['entendimento', 'breakdown'])
    })

    it('should return all step names when all completed', () => {
      const progress = createMockProgress({
        steps: [
          { name: 'entendimento', status: 'completed' },
          { name: 'breakdown', status: 'completed' },
          { name: 'arquitetura', status: 'completed' },
          { name: 'implementacao', status: 'completed' },
          { name: 'revisao', status: 'completed' },
          { name: 'documentacao', status: 'completed' },
        ],
      })

      const completed = getCompletedSteps(progress)
      expect(completed).toHaveLength(6)
    })
  })

  describe('Progress workflow scenarios', () => {
    it('should track progress through all phases', () => {
      let progress = createMockProgress()

      progress = updateStepStatus(progress, 'entendimento', 'in_progress')
      expect(progress.currentPhase).toBe('entendimento')

      progress = updateStepStatus(progress, 'entendimento', 'completed')
      expect(getCompletedSteps(progress)).toContain('entendimento')

      progress = updateStepStatus(progress, 'breakdown', 'in_progress')
      expect(progress.currentPhase).toBe('breakdown')

      progress = updateStepStatus(progress, 'breakdown', 'completed')
      expect(getCompletedSteps(progress)).toHaveLength(2)
    })

    it('should handle failure recovery', () => {
      let progress = createMockProgress()

      progress = updateStepStatus(progress, 'implementacao', 'failed', 'Tests failed')
      expect(isStepCompleted(progress, 'implementacao')).toBe(false)

      progress = updateStepStatus(progress, 'implementacao', 'in_progress')
      expect(progress.steps.find((s) => s.name === 'implementacao')?.status).toBe('in_progress')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty steps array', () => {
      const progress: FeatureProgress = {
        feature: 'test',
        currentPhase: 'unknown',
        steps: [],
        lastUpdated: new Date().toISOString(),
      }

      expect(getNextStep(progress)).toBeNull()
      expect(getCompletedSteps(progress)).toEqual([])
    })

    it('should handle single step', () => {
      const progress: FeatureProgress = {
        feature: 'test',
        currentPhase: 'only',
        steps: [{ name: 'only', status: 'pending' }],
        lastUpdated: new Date().toISOString(),
      }

      expect(getNextStep(progress)).toBe('only')
    })
  })
})
