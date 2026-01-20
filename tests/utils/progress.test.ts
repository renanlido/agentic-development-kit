import path from 'node:path'
import fs from 'fs-extra'
import {
  type FeatureProgress,
  getCompletedSteps,
  getNextStep,
  isStepCompleted,
  loadProgress,
  type StepProgress,
  saveProgress,
  updateStepStatus,
} from '../../src/utils/progress.js'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

describe('progress', () => {
  const testDir = path.join(process.cwd(), '.test-progress-utils')
  const featuresDir = path.join(testDir, '.claude', 'plans', 'features')

  beforeEach(async () => {
    await fs.ensureDir(featuresDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  }, 10000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 10000)
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

  describe('loadProgress', () => {
    it('should return default progress when file does not exist', async () => {
      const progress = await loadProgress('nonexistent-feature')

      expect(progress.feature).toBe('nonexistent-feature')
      expect(progress.currentPhase).toBe('not_started')
      expect(progress.steps).toBeDefined()
      expect(progress.steps.length).toBeGreaterThan(0)
    })

    it('should parse existing progress file', async () => {
      const featureDir = path.join(featuresDir, 'existing-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: existing-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: research
- **Next Step**: tasks

## Steps
- [x] **prd** (completed: 2026-01-15)
- [~] **research** (started: 2026-01-16)
- [ ] **tasks**
`
      )

      const progress = await loadProgress('existing-feature')

      expect(progress.feature).toBe('existing-feature')
      expect(progress.currentPhase).toBe('research')
      expect(progress.nextStep).toBe('tasks')
    })

    it('should return default when file has invalid format', async () => {
      const featureDir = path.join(featuresDir, 'invalid-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        'invalid content without progress header'
      )

      const progress = await loadProgress('invalid-feature')

      expect(progress.feature).toBe('invalid-feature')
      expect(progress.currentPhase).toBe('not_started')
    })

    it('should parse failed step status', async () => {
      const featureDir = path.join(featuresDir, 'failed-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: failed-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: implement

## Steps
- [x] **prd** (completed: 2026-01-15)
- [!] **implement** (failed: tests are broken)
- [ ] **qa**
`
      )

      const progress = await loadProgress('failed-feature')

      expect(progress.feature).toBe('failed-feature')
      const failedStep = progress.steps.find((s) => s.name === 'implement')
      expect(failedStep?.status).toBe('failed')
      expect(failedStep?.notes).toBe('tests are broken')
    })

    it('should use default steps when no steps in file', async () => {
      const featureDir = path.join(featuresDir, 'no-steps-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: no-steps-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: prd
`
      )

      const progress = await loadProgress('no-steps-feature')

      expect(progress.feature).toBe('no-steps-feature')
      expect(progress.steps.length).toBeGreaterThan(0)
      expect(progress.steps[0].name).toBe('prd')
    })
  })

  describe('saveProgress', () => {
    it('should save progress to file', async () => {
      const progress: FeatureProgress = {
        feature: 'save-test',
        currentPhase: 'research',
        steps: [
          { name: 'prd', status: 'completed', completedAt: '2026-01-15' },
          { name: 'research', status: 'in_progress', startedAt: '2026-01-16' },
          { name: 'tasks', status: 'pending' },
        ],
        lastUpdated: '2026-01-16T00:00:00.000Z',
        nextStep: 'tasks',
      }

      await saveProgress('save-test', progress)

      const progressPath = path.join(featuresDir, 'save-test', 'progress.md')
      expect(await fs.pathExists(progressPath)).toBe(true)

      const content = await fs.readFile(progressPath, 'utf-8')
      expect(content).toContain('# Progress: save-test')
      expect(content).toContain('**Phase**: research')
      expect(content).toContain('**Next Step**: tasks')
      expect(content).toContain('[x] **prd**')
      expect(content).toContain('[~] **research**')
      expect(content).toContain('[ ] **tasks**')
    })

    it('should create directory if not exists', async () => {
      const progress: FeatureProgress = {
        feature: 'new-feature',
        currentPhase: 'prd',
        steps: [{ name: 'prd', status: 'in_progress' }],
        lastUpdated: '2026-01-16T00:00:00.000Z',
      }

      await saveProgress('new-feature', progress)

      const featureDir = path.join(featuresDir, 'new-feature')
      expect(await fs.pathExists(featureDir)).toBe(true)
    })

    it('should save failed step with notes', async () => {
      const progress: FeatureProgress = {
        feature: 'failed-save-test',
        currentPhase: 'implement',
        steps: [
          { name: 'prd', status: 'completed' },
          { name: 'implement', status: 'failed', notes: 'Build error' },
        ],
        lastUpdated: '2026-01-16T00:00:00.000Z',
      }

      await saveProgress('failed-save-test', progress)

      const progressPath = path.join(featuresDir, 'failed-save-test', 'progress.md')
      const content = await fs.readFile(progressPath, 'utf-8')
      expect(content).toContain('[!] **implement**')
      expect(content).toContain('failed: Build error')
    })

    it('should save failed step without notes', async () => {
      const progress: FeatureProgress = {
        feature: 'failed-no-notes-test',
        currentPhase: 'implement',
        steps: [{ name: 'implement', status: 'failed' }],
        lastUpdated: '2026-01-16T00:00:00.000Z',
      }

      await saveProgress('failed-no-notes-test', progress)

      const progressPath = path.join(featuresDir, 'failed-no-notes-test', 'progress.md')
      const content = await fs.readFile(progressPath, 'utf-8')
      expect(content).toContain('[!] **implement**')
      expect(content).toContain('(failed)')
    })
  })
})
