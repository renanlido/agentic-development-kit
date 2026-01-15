export interface SpecInput {
  name: string
  type: string
  description: string
  required: boolean
  validation?: string
  example?: string
}

export interface SpecOutput {
  name: string
  type: string
  description: string
  example?: string
}

export interface EdgeCase {
  scenario: string
  expectedBehavior: string
  priority: 'high' | 'medium' | 'low'
}

export interface GherkinScenario {
  name: string
  given: string
  when: string
  expected: string
  and?: string[]
}

export interface NonFunctional {
  performance?: string
  security?: string
  scalability?: string
  reliability?: string
  maintainability?: string
}

export interface Spec {
  feature: string
  version: string
  description: string
  inputs: SpecInput[]
  outputs: SpecOutput[]
  behaviors: string[]
  edgeCases: EdgeCase[]
  acceptanceCriteria: GherkinScenario[]
  nonFunctional?: NonFunctional
  dependencies?: string[]
  assumptions?: string[]
  outOfScope?: string[]
}

export interface SpecValidationError {
  field: string
  message: string
  path: (string | number)[]
}

export interface SpecValidationResult {
  valid: boolean
  errors: SpecValidationError[]
  warnings: string[]
}

function validateRequired(value: unknown, field: string): SpecValidationError | null {
  if (value === undefined || value === null || value === '') {
    return { field, message: `${field} is required`, path: [field] }
  }
  return null
}

function validateMinLength(value: string, min: number, field: string): SpecValidationError | null {
  if (value.length < min) {
    return { field, message: `${field} must be at least ${min} characters`, path: [field] }
  }
  return null
}

function validateArrayMin(arr: unknown[], min: number, field: string): SpecValidationError | null {
  if (arr.length < min) {
    return { field, message: `At least ${min} ${field} required`, path: [field] }
  }
  return null
}

export function validateSpec(data: unknown): SpecValidationResult {
  const errors: SpecValidationError[] = []
  const warnings: string[] = []

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'spec', message: 'Invalid spec data', path: [] }],
      warnings: [],
    }
  }

  const spec = data as Partial<Spec>

  const featureError = validateRequired(spec.feature, 'feature')
  if (featureError) {
    errors.push(featureError)
  }

  const descError = validateRequired(spec.description, 'description')
  if (descError) {
    errors.push(descError)
  } else if (spec.description && spec.description.length < 10) {
    const minError = validateMinLength(spec.description, 10, 'description')
    if (minError) {
      errors.push(minError)
    }
  }

  if (!spec.inputs || !Array.isArray(spec.inputs)) {
    errors.push({ field: 'inputs', message: 'inputs is required', path: ['inputs'] })
  } else {
    const inputsError = validateArrayMin(spec.inputs, 1, 'inputs')
    if (inputsError) {
      errors.push(inputsError)
    }

    spec.inputs.forEach((input, i) => {
      if (!input.name) {
        errors.push({
          field: `inputs[${i}].name`,
          message: 'Input name is required',
          path: ['inputs', i, 'name'],
        })
      }
      if (!input.type) {
        errors.push({
          field: `inputs[${i}].type`,
          message: 'Input type is required',
          path: ['inputs', i, 'type'],
        })
      }
      if (!input.description) {
        errors.push({
          field: `inputs[${i}].description`,
          message: 'Input description is required',
          path: ['inputs', i, 'description'],
        })
      }
    })
  }

  if (!spec.outputs || !Array.isArray(spec.outputs)) {
    errors.push({ field: 'outputs', message: 'outputs is required', path: ['outputs'] })
  } else {
    const outputsError = validateArrayMin(spec.outputs, 1, 'outputs')
    if (outputsError) {
      errors.push(outputsError)
    }
  }

  if (!spec.behaviors || !Array.isArray(spec.behaviors)) {
    errors.push({ field: 'behaviors', message: 'behaviors is required', path: ['behaviors'] })
  } else {
    const behaviorsError = validateArrayMin(spec.behaviors, 1, 'behaviors')
    if (behaviorsError) {
      errors.push(behaviorsError)
    }
  }

  if (!spec.edgeCases || !Array.isArray(spec.edgeCases)) {
    errors.push({ field: 'edgeCases', message: 'edgeCases is required', path: ['edgeCases'] })
  } else {
    const edgeCasesError = validateArrayMin(spec.edgeCases, 1, 'edgeCases')
    if (edgeCasesError) {
      errors.push(edgeCasesError)
    }
  }

  if (!spec.acceptanceCriteria || !Array.isArray(spec.acceptanceCriteria)) {
    errors.push({
      field: 'acceptanceCriteria',
      message: 'acceptanceCriteria is required',
      path: ['acceptanceCriteria'],
    })
  } else {
    const criteriaError = validateArrayMin(spec.acceptanceCriteria, 1, 'acceptanceCriteria')
    if (criteriaError) {
      errors.push(criteriaError)
    }
  }

  if (errors.length === 0) {
    if (!spec.nonFunctional?.security) {
      warnings.push('Consider adding security requirements')
    }
    if (!spec.nonFunctional?.performance) {
      warnings.push('Consider adding performance requirements')
    }
    if (spec.edgeCases && spec.edgeCases.length < 3) {
      warnings.push('Consider adding more edge cases for better coverage')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function createEmptySpec(featureName: string): Spec {
  return {
    feature: featureName,
    version: '1.0.0',
    description: '',
    inputs: [],
    outputs: [],
    behaviors: [],
    edgeCases: [],
    acceptanceCriteria: [],
    nonFunctional: {},
    dependencies: [],
    assumptions: [],
    outOfScope: [],
  }
}
