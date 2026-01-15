import fs from 'node:fs/promises'
import type { Spec, SpecValidationResult } from '../../src/types/spec.js'
import {
  formatValidationResult,
  generateSpecMarkdown,
  generateSpecTemplate,
  getSpecPath,
  parseSpecFromMarkdown,
  specExists,
} from '../../src/utils/spec-utils.js'

jest.mock('node:fs/promises')

describe('spec-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getSpecPath', () => {
    it('should return correct path for feature', async () => {
      const path = await getSpecPath('my-feature')
      expect(path).toBe('.claude/specs/my-feature.md')
    })

    it('should handle feature names with special characters', async () => {
      const path = await getSpecPath('feature-123')
      expect(path).toBe('.claude/specs/feature-123.md')
    })
  })

  describe('specExists', () => {
    it('should return true if spec file exists', async () => {
      const mockAccess = fs.access as jest.MockedFunction<typeof fs.access>
      mockAccess.mockResolvedValue(undefined)

      const exists = await specExists('my-feature')
      expect(exists).toBe(true)
    })

    it('should return false if spec file does not exist', async () => {
      const mockAccess = fs.access as jest.MockedFunction<typeof fs.access>
      mockAccess.mockRejectedValue(new Error('ENOENT'))

      const exists = await specExists('nonexistent')
      expect(exists).toBe(false)
    })
  })

  describe('parseSpecFromMarkdown', () => {
    it('should parse feature name', () => {
      const content = '# Spec: My Feature\n\nversion: 1.0.0'
      const spec = parseSpecFromMarkdown(content)
      expect(spec.feature).toBe('My Feature')
    })

    it('should parse version', () => {
      const content = '# Spec: Test\n\nversion: 2.0.0'
      const spec = parseSpecFromMarkdown(content)
      expect(spec.version).toBe('2.0.0')
    })

    it('should parse description', () => {
      const content = `# Spec: Test

version: 1.0.0

## Description

This is the description of the feature.
It can span multiple lines.

## Inputs
`
      const spec = parseSpecFromMarkdown(content)
      expect(spec.description).toContain('This is the description')
    })

    it('should parse inputs', () => {
      const content = `# Spec: Test

## Inputs

- **userId** (string): The user identifier
- **email** (string): User email address (optional)
`
      const spec = parseSpecFromMarkdown(content)
      expect(spec.inputs).toHaveLength(2)
      expect(spec.inputs?.[0].name).toBe('userId')
      expect(spec.inputs?.[0].type).toBe('string')
      expect(spec.inputs?.[0].required).toBe(true)
      expect(spec.inputs?.[1].required).toBe(false)
    })

    it('should parse outputs', () => {
      const content = `# Spec: Test

## Outputs

- **result** (object): The operation result
`
      const spec = parseSpecFromMarkdown(content)
      expect(spec.outputs).toHaveLength(1)
      expect(spec.outputs?.[0].name).toBe('result')
      expect(spec.outputs?.[0].type).toBe('object')
    })

    it('should parse behaviors', () => {
      const content = `# Spec: Test

## Behaviors

- Validates input before processing
- Returns error on invalid data
`
      const spec = parseSpecFromMarkdown(content)
      expect(spec.behaviors).toHaveLength(2)
      expect(spec.behaviors?.[0]).toContain('Validates')
    })

    it('should parse edge cases', () => {
      const content = `# Spec: Test

## Edge Cases

### Empty input
- Priority: high
- Expected: Return validation error
`
      const spec = parseSpecFromMarkdown(content)
      expect(spec.edgeCases).toHaveLength(1)
      expect(spec.edgeCases?.[0].scenario).toBe('Empty input')
      expect(spec.edgeCases?.[0].priority).toBe('high')
    })

    it('should parse acceptance criteria', () => {
      const content = `# Spec: Test

## Acceptance Criteria

### User login
- Given a valid user
- When they enter credentials
- Then they should be authenticated
`
      const spec = parseSpecFromMarkdown(content)
      expect(spec.acceptanceCriteria).toHaveLength(1)
      expect(spec.acceptanceCriteria?.[0].name).toBe('User login')
      expect(spec.acceptanceCriteria?.[0].given).toContain('valid user')
    })

    it('should handle empty content', () => {
      const spec = parseSpecFromMarkdown('')
      expect(spec.feature).toBeUndefined()
      expect(spec.inputs).toEqual([])
    })
  })

  describe('generateSpecMarkdown', () => {
    it('should generate markdown with feature name', () => {
      const spec: Spec = {
        feature: 'Test Feature',
        version: '1.0.0',
        description: 'Test description',
        inputs: [],
        outputs: [],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('# Spec: Test Feature')
      expect(markdown).toContain('version: 1.0.0')
    })

    it('should generate inputs section', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [
          {
            name: 'userId',
            type: 'string',
            description: 'User ID',
            required: true,
            example: '123',
          },
        ],
        outputs: [],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Inputs')
      expect(markdown).toContain('**userId** (string)')
      expect(markdown).toContain('Example: 123')
    })

    it('should mark optional inputs', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [
          { name: 'optional', type: 'string', description: 'Optional field', required: false },
        ],
        outputs: [],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('(optional)')
    })

    it('should generate outputs section', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [],
        outputs: [{ name: 'result', type: 'object', description: 'Result object' }],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Outputs')
      expect(markdown).toContain('**result** (object)')
    })

    it('should generate behaviors section', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [],
        outputs: [],
        behaviors: ['Behavior 1', 'Behavior 2'],
        edgeCases: [],
        acceptanceCriteria: [],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Behaviors')
      expect(markdown).toContain('- Behavior 1')
      expect(markdown).toContain('- Behavior 2')
    })

    it('should generate edge cases section', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [],
        outputs: [],
        behaviors: [],
        edgeCases: [
          { scenario: 'Empty input', expectedBehavior: 'Return error', priority: 'high' },
        ],
        acceptanceCriteria: [],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Edge Cases')
      expect(markdown).toContain('### Empty input')
      expect(markdown).toContain('Priority: high')
    })

    it('should generate acceptance criteria section', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [],
        outputs: [],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [
          {
            name: 'Happy path',
            given: 'valid input',
            when: 'process is called',
            expected: 'success result',
          },
        ],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Acceptance Criteria')
      expect(markdown).toContain('### Happy path')
      expect(markdown).toContain('Given valid input')
      expect(markdown).toContain('When process is called')
    })

    it('should include non-functional requirements when present', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [],
        outputs: [],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [],
        nonFunctional: {
          performance: 'p99 < 100ms',
          security: 'OAuth2 required',
        },
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Non-Functional Requirements')
      expect(markdown).toContain('Performance: p99 < 100ms')
      expect(markdown).toContain('Security: OAuth2 required')
    })

    it('should include dependencies when present', () => {
      const spec: Spec = {
        feature: 'Test',
        version: '1.0.0',
        description: '',
        inputs: [],
        outputs: [],
        behaviors: [],
        edgeCases: [],
        acceptanceCriteria: [],
        dependencies: ['auth-service', 'database'],
      }

      const markdown = generateSpecMarkdown(spec)
      expect(markdown).toContain('## Dependencies')
      expect(markdown).toContain('- auth-service')
    })
  })

  describe('generateSpecTemplate', () => {
    it('should generate template with feature name', () => {
      const template = generateSpecTemplate('my-feature')
      expect(template).toContain('# Spec: my-feature')
    })

    it('should include placeholder inputs', () => {
      const template = generateSpecTemplate('test')
      expect(template).toContain('## Inputs')
      expect(template).toContain('exampleInput')
    })

    it('should include placeholder behaviors', () => {
      const template = generateSpecTemplate('test')
      expect(template).toContain('## Behaviors')
      expect(template).toContain('Describe expected behavior')
    })

    it('should include placeholder edge cases', () => {
      const template = generateSpecTemplate('test')
      expect(template).toContain('## Edge Cases')
      expect(template).toContain('Empty input')
      expect(template).toContain('Invalid input')
    })

    it('should include placeholder acceptance criteria', () => {
      const template = generateSpecTemplate('test')
      expect(template).toContain('## Acceptance Criteria')
      expect(template).toContain('Basic functionality')
    })
  })

  describe('formatValidationResult', () => {
    it('should format valid result', () => {
      const result: SpecValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      }

      const formatted = formatValidationResult(result)
      expect(formatted).toContain('Spec is valid!')
    })

    it('should format invalid result with errors', () => {
      const result: SpecValidationResult = {
        valid: false,
        errors: [{ field: 'feature', message: 'Feature name is required', path: [] }],
        warnings: [],
      }

      const formatted = formatValidationResult(result)
      expect(formatted).toContain('Spec validation failed')
      expect(formatted).toContain('Errors:')
      expect(formatted).toContain('feature: Feature name is required')
    })

    it('should format warnings', () => {
      const result: SpecValidationResult = {
        valid: true,
        errors: [],
        warnings: ['Consider adding more edge cases'],
      }

      const formatted = formatValidationResult(result)
      expect(formatted).toContain('Warnings:')
      expect(formatted).toContain('Consider adding more edge cases')
    })

    it('should format multiple errors', () => {
      const result: SpecValidationResult = {
        valid: false,
        errors: [
          { field: 'feature', message: 'Required', path: [] },
          { field: 'description', message: 'Too short', path: [] },
        ],
        warnings: [],
      }

      const formatted = formatValidationResult(result)
      expect(formatted).toContain('feature: Required')
      expect(formatted).toContain('description: Too short')
    })
  })

  describe('Round-trip parsing', () => {
    it('should preserve spec data through generate and parse cycle', () => {
      const originalSpec: Spec = {
        feature: 'Round Trip Test',
        version: '1.0.0',
        description: 'Testing round trip parsing',
        inputs: [{ name: 'input1', type: 'string', description: 'Test input', required: true }],
        outputs: [{ name: 'output1', type: 'object', description: 'Test output' }],
        behaviors: ['Behavior 1'],
        edgeCases: [{ scenario: 'Edge 1', expectedBehavior: 'Handle it', priority: 'high' }],
        acceptanceCriteria: [{ name: 'AC 1', given: 'given', when: 'when', expected: 'expected' }],
      }

      const markdown = generateSpecMarkdown(originalSpec)
      const parsedSpec = parseSpecFromMarkdown(markdown)

      expect(parsedSpec.feature).toBe(originalSpec.feature)
      expect(parsedSpec.version).toBe(originalSpec.version)
      expect(parsedSpec.inputs?.length).toBe(originalSpec.inputs.length)
      expect(parsedSpec.outputs?.length).toBe(originalSpec.outputs.length)
      expect(parsedSpec.behaviors?.length).toBe(originalSpec.behaviors.length)
    })
  })
})
