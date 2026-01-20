import {
  createEmptySpec,
  type Spec,
  type SpecValidationResult,
  validateSpec,
} from '../../src/types/spec.js'

describe('spec', () => {
  const createValidSpec = (overrides?: Partial<Spec>): Spec => ({
    feature: 'test-feature',
    version: '1.0.0',
    description: 'A test feature with enough description',
    inputs: [{ name: 'input1', type: 'string', description: 'First input', required: true }],
    outputs: [{ name: 'output1', type: 'string', description: 'First output' }],
    behaviors: ['Does something'],
    edgeCases: [{ scenario: 'Edge case 1', expectedBehavior: 'Handle it', priority: 'high' }],
    acceptanceCriteria: [
      { name: 'Scenario 1', given: 'context', when: 'action', expected: 'result' },
    ],
    nonFunctional: { security: 'Secure', performance: 'Fast' },
    dependencies: [],
    assumptions: [],
    outOfScope: [],
    ...overrides,
  })

  describe('validateSpec', () => {
    it('should return valid for complete spec', () => {
      const spec = createValidSpec()
      const result = validateSpec(spec)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return invalid for null data', () => {
      const result = validateSpec(null)

      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toBe('Invalid spec data')
    })

    it('should return invalid for non-object data', () => {
      const result = validateSpec('string')

      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toBe('Invalid spec data')
    })

    it('should require feature field', () => {
      const spec = createValidSpec({ feature: undefined as unknown as string })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'feature')).toBe(true)
    })

    it('should require description field', () => {
      const spec = createValidSpec({ description: undefined as unknown as string })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'description')).toBe(true)
    })

    it('should require description minimum length', () => {
      const spec = createValidSpec({ description: 'short' })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('at least 10 characters'))).toBe(true)
    })

    it('should require inputs array', () => {
      const spec = createValidSpec({ inputs: undefined as unknown as Spec['inputs'] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'inputs')).toBe(true)
    })

    it('should require at least one input', () => {
      const spec = createValidSpec({ inputs: [] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('At least 1 inputs'))).toBe(true)
    })

    it('should validate input name is required', () => {
      const spec = createValidSpec({
        inputs: [{ name: '', type: 'string', description: 'desc', required: true }],
      })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message === 'Input name is required')).toBe(true)
    })

    it('should validate input type is required', () => {
      const spec = createValidSpec({
        inputs: [{ name: 'input', type: '', description: 'desc', required: true }],
      })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message === 'Input type is required')).toBe(true)
    })

    it('should validate input description is required', () => {
      const spec = createValidSpec({
        inputs: [{ name: 'input', type: 'string', description: '', required: true }],
      })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message === 'Input description is required')).toBe(true)
    })

    it('should require outputs array', () => {
      const spec = createValidSpec({ outputs: undefined as unknown as Spec['outputs'] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'outputs')).toBe(true)
    })

    it('should require at least one output', () => {
      const spec = createValidSpec({ outputs: [] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('At least 1 outputs'))).toBe(true)
    })

    it('should require behaviors array', () => {
      const spec = createValidSpec({ behaviors: undefined as unknown as string[] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'behaviors')).toBe(true)
    })

    it('should require at least one behavior', () => {
      const spec = createValidSpec({ behaviors: [] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('At least 1 behaviors'))).toBe(true)
    })

    it('should require edgeCases array', () => {
      const spec = createValidSpec({ edgeCases: undefined as unknown as Spec['edgeCases'] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'edgeCases')).toBe(true)
    })

    it('should require at least one edgeCase', () => {
      const spec = createValidSpec({ edgeCases: [] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('At least 1 edgeCases'))).toBe(true)
    })

    it('should require acceptanceCriteria array', () => {
      const spec = createValidSpec({
        acceptanceCriteria: undefined as unknown as Spec['acceptanceCriteria'],
      })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'acceptanceCriteria')).toBe(true)
    })

    it('should require at least one acceptanceCriteria', () => {
      const spec = createValidSpec({ acceptanceCriteria: [] })
      const result = validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('At least 1 acceptanceCriteria'))).toBe(
        true
      )
    })

    describe('warnings', () => {
      it('should warn when security requirements missing', () => {
        const spec = createValidSpec({ nonFunctional: { performance: 'Fast' } })
        const result = validateSpec(spec)

        expect(result.valid).toBe(true)
        expect(result.warnings.some((w) => w.includes('security'))).toBe(true)
      })

      it('should warn when performance requirements missing', () => {
        const spec = createValidSpec({ nonFunctional: { security: 'Secure' } })
        const result = validateSpec(spec)

        expect(result.valid).toBe(true)
        expect(result.warnings.some((w) => w.includes('performance'))).toBe(true)
      })

      it('should warn when less than 3 edge cases', () => {
        const spec = createValidSpec()
        const result = validateSpec(spec)

        expect(result.valid).toBe(true)
        expect(result.warnings.some((w) => w.includes('edge cases'))).toBe(true)
      })

      it('should not show warnings when all requirements met', () => {
        const spec = createValidSpec({
          nonFunctional: { security: 'Secure', performance: 'Fast' },
          edgeCases: [
            { scenario: 'Edge 1', expectedBehavior: 'Handle 1', priority: 'high' },
            { scenario: 'Edge 2', expectedBehavior: 'Handle 2', priority: 'medium' },
            { scenario: 'Edge 3', expectedBehavior: 'Handle 3', priority: 'low' },
          ],
        })
        const result = validateSpec(spec)

        expect(result.valid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      })

      it('should not show warnings when there are errors', () => {
        const spec = createValidSpec({ feature: '' })
        const result = validateSpec(spec)

        expect(result.valid).toBe(false)
        expect(result.warnings).toHaveLength(0)
      })
    })
  })

  describe('createEmptySpec', () => {
    it('should create spec with feature name', () => {
      const spec = createEmptySpec('my-feature')

      expect(spec.feature).toBe('my-feature')
      expect(spec.version).toBe('1.0.0')
    })

    it('should create spec with empty arrays', () => {
      const spec = createEmptySpec('my-feature')

      expect(spec.inputs).toEqual([])
      expect(spec.outputs).toEqual([])
      expect(spec.behaviors).toEqual([])
      expect(spec.edgeCases).toEqual([])
      expect(spec.acceptanceCriteria).toEqual([])
    })

    it('should create spec with optional fields', () => {
      const spec = createEmptySpec('my-feature')

      expect(spec.nonFunctional).toEqual({})
      expect(spec.dependencies).toEqual([])
      expect(spec.assumptions).toEqual([])
      expect(spec.outOfScope).toEqual([])
    })
  })

  describe('SpecValidationResult interface', () => {
    it('should have correct structure', () => {
      const result: SpecValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      }

      expect(result.valid).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })
  })
})
