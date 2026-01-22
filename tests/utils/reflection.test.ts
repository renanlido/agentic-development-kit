jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}))

import type { ActionContext, ActionResult, TaskValidation } from '../../src/utils/reflection.js'
import {
  ReflectionHistory,
  reflectOnResult,
  suggestCorrections,
  validateAction,
} from '../../src/utils/reflection.js'

describe('Reflection Pattern', () => {
  describe('validateAction', () => {
    it('should return valid when action matches constraints', () => {
      const context: ActionContext = {
        currentPhase: 'implement',
        allowedFiles: ['src/commands/', 'src/utils/'],
        constraints: ['Must follow TDD', 'No external dependencies'],
      }

      const validation = validateAction('Write to src/commands/feature.ts', context)

      expect(validation.isValid).toBe(true)
      expect(validation.warnings).toHaveLength(0)
      expect(validation.errors).toHaveLength(0)
    })

    it('should return warnings for suspicious actions', () => {
      const context: ActionContext = {
        currentPhase: 'implement',
        allowedFiles: ['src/'],
        constraints: [],
      }

      const validation = validateAction('Delete node_modules', context)

      expect(validation.warnings.length).toBeGreaterThan(0)
    })

    it('should return errors for forbidden actions', () => {
      const context: ActionContext = {
        currentPhase: 'research',
        allowedFiles: ['.claude/plans/'],
        constraints: ['No code modifications in research phase'],
      }

      const validation = validateAction('Write to src/index.ts', context)

      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should check file scope constraints', () => {
      const context: ActionContext = {
        currentPhase: 'implement',
        allowedFiles: ['src/commands/auth/'],
        constraints: [],
      }

      const validation = validateAction('Edit src/commands/payment/index.ts', context)

      expect(validation.isValid).toBe(false)
    })

    it('should allow actions without file paths', () => {
      const context: ActionContext = {
        currentPhase: 'implement',
        allowedFiles: ['src/'],
        constraints: [],
      }

      const validation = validateAction('Run npm test', context)

      expect(validation.isValid).toBe(true)
    })
  })

  describe('reflectOnResult', () => {
    it('should identify success when result matches expected', () => {
      const result: ActionResult = {
        success: true,
        output: 'All tests passed',
        filesModified: ['src/index.ts'],
      }
      const expected = {
        shouldSucceed: true,
        expectedFiles: ['src/index.ts'],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.matchesExpected).toBe(true)
      expect(reflection.discrepancies).toHaveLength(0)
    })

    it('should identify discrepancies when result differs', () => {
      const result: ActionResult = {
        success: true,
        output: 'Completed',
        filesModified: ['src/index.ts', 'src/utils.ts'],
      }
      const expected = {
        shouldSucceed: true,
        expectedFiles: ['src/index.ts'],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.matchesExpected).toBe(false)
      expect(reflection.discrepancies.length).toBeGreaterThan(0)
    })

    it('should detect failure when success was expected', () => {
      const result: ActionResult = {
        success: false,
        output: 'Error: Test failed',
        filesModified: [],
      }
      const expected = {
        shouldSucceed: true,
        expectedFiles: [],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.matchesExpected).toBe(false)
      expect(reflection.discrepancies).toContain('Action failed when success was expected')
    })

    it('should include confidence score', () => {
      const result: ActionResult = {
        success: true,
        output: 'Done',
        filesModified: [],
      }
      const expected = {
        shouldSucceed: true,
        expectedFiles: [],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.confidence).toBeGreaterThanOrEqual(0)
      expect(reflection.confidence).toBeLessThanOrEqual(100)
    })

    it('should detect success when failure was expected', () => {
      const result: ActionResult = {
        success: true,
        output: 'Unexpectedly succeeded',
        filesModified: [],
      }
      const expected = {
        shouldSucceed: false,
        expectedFiles: [],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.matchesExpected).toBe(false)
      expect(reflection.discrepancies).toContain('Action succeeded when failure was expected')
      expect(reflection.confidence).toBeLessThan(100)
    })

    it('should detect missing expected files', () => {
      const result: ActionResult = {
        success: true,
        output: 'Completed',
        filesModified: [],
      }
      const expected = {
        shouldSucceed: true,
        expectedFiles: ['src/index.ts', 'src/utils.ts'],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.matchesExpected).toBe(false)
      expect(reflection.discrepancies.some((d) => d.includes('Expected files not modified'))).toBe(
        true
      )
    })

    it('should clamp confidence score between 0 and 100', () => {
      const result: ActionResult = {
        success: false,
        output: 'Multiple failures',
        filesModified: [
          'a.ts',
          'b.ts',
          'c.ts',
          'd.ts',
          'e.ts',
          'f.ts',
          'g.ts',
          'h.ts',
          'i.ts',
          'j.ts',
        ],
      }
      const expected = {
        shouldSucceed: true,
        expectedFiles: [
          'x.ts',
          'y.ts',
          'z.ts',
          'w.ts',
          'v.ts',
          'u.ts',
          't.ts',
          's.ts',
          'r.ts',
          'q.ts',
        ],
      }

      const reflection = reflectOnResult(result, expected)

      expect(reflection.confidence).toBeGreaterThanOrEqual(0)
      expect(reflection.confidence).toBeLessThanOrEqual(100)
    })
  })

  describe('suggestCorrections', () => {
    it('should suggest corrections for validation errors', () => {
      const validation: TaskValidation = {
        isValid: false,
        warnings: [],
        errors: ['File outside allowed scope: src/payment/'],
        suggestions: [],
      }

      const corrections = suggestCorrections(validation)

      expect(corrections.length).toBeGreaterThan(0)
    })

    it('should suggest improvements for warnings', () => {
      const validation: TaskValidation = {
        isValid: true,
        warnings: ['Dangerous command detected'],
        errors: [],
        suggestions: [],
      }

      const corrections = suggestCorrections(validation)

      expect(corrections.length).toBeGreaterThan(0)
    })

    it('should return empty for valid actions', () => {
      const validation: TaskValidation = {
        isValid: true,
        warnings: [],
        errors: [],
        suggestions: [],
      }

      const corrections = suggestCorrections(validation)

      expect(corrections).toHaveLength(0)
    })

    it('should suggest corrections for research phase errors', () => {
      const validation: TaskValidation = {
        isValid: false,
        warnings: [],
        errors: ['No code modifications in research phase'],
        suggestions: [],
      }

      const corrections = suggestCorrections(validation)

      expect(corrections.length).toBeGreaterThan(0)
      expect(corrections.some((c) => c.includes('research phase'))).toBe(true)
    })
  })

  describe('ReflectionHistory', () => {
    let history: ReflectionHistory

    beforeEach(() => {
      history = new ReflectionHistory()
    })

    it('should record reflections', () => {
      history.record({
        action: 'Write file',
        validation: { isValid: true, warnings: [], errors: [], suggestions: [] },
        result: { success: true, output: '', filesModified: [] },
        timestamp: new Date().toISOString(),
      })

      expect(history.getAll()).toHaveLength(1)
    })

    it('should track success rate', () => {
      history.record({
        action: 'Action 1',
        validation: { isValid: true, warnings: [], errors: [], suggestions: [] },
        result: { success: true, output: '', filesModified: [] },
        timestamp: new Date().toISOString(),
      })
      history.record({
        action: 'Action 2',
        validation: { isValid: true, warnings: [], errors: [], suggestions: [] },
        result: { success: false, output: '', filesModified: [] },
        timestamp: new Date().toISOString(),
      })

      expect(history.getSuccessRate()).toBe(50)
    })

    it('should retrieve recent entries', () => {
      for (let i = 0; i < 10; i++) {
        history.record({
          action: `Action ${i}`,
          validation: { isValid: true, warnings: [], errors: [], suggestions: [] },
          result: { success: true, output: '', filesModified: [] },
          timestamp: new Date().toISOString(),
        })
      }

      const recent = history.getRecent(5)

      expect(recent).toHaveLength(5)
    })

    it('should clear history', () => {
      history.record({
        action: 'Test',
        validation: { isValid: true, warnings: [], errors: [], suggestions: [] },
        result: { success: true, output: '', filesModified: [] },
        timestamp: new Date().toISOString(),
      })

      history.clear()

      expect(history.getAll()).toHaveLength(0)
    })

    it('should return 0 success rate for empty history', () => {
      expect(history.getSuccessRate()).toBe(0)
    })
  })
})
