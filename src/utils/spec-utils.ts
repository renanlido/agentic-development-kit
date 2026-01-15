import fs from 'node:fs/promises'
import path from 'node:path'
import type { Spec, SpecValidationResult } from '../types/spec.js'
import { createEmptySpec, validateSpec as validateSpecData } from '../types/spec.js'

const SPECS_DIR = '.claude/specs'

async function ensureSpecsDir(): Promise<void> {
  await fs.mkdir(SPECS_DIR, { recursive: true })
}

export async function getSpecPath(featureName: string): Promise<string> {
  return path.join(SPECS_DIR, `${featureName}.md`)
}

export async function specExists(featureName: string): Promise<boolean> {
  try {
    const specPath = await getSpecPath(featureName)
    await fs.access(specPath)
    return true
  } catch {
    return false
  }
}

export function parseSpecFromMarkdown(content: string): Partial<Spec> {
  const spec: Partial<Spec> = {}

  const featureMatch = content.match(/^#\s+Spec:\s*(.+)/m)
  if (featureMatch) {
    spec.feature = featureMatch[1].trim()
  }

  const versionMatch = content.match(/version:\s*(\S+)/i)
  if (versionMatch) {
    spec.version = versionMatch[1]
  }

  const descMatch = content.match(/## Description\s*\n\n?([\s\S]*?)(?=\n##|$)/i)
  if (descMatch) {
    spec.description = descMatch[1].trim()
  }

  spec.inputs = []
  const inputsMatch = content.match(/## Inputs\s*\n\n?([\s\S]*?)(?=\n##|$)/i)
  if (inputsMatch) {
    const inputLines = inputsMatch[1].split('\n').filter((l) => l.startsWith('- '))
    for (const line of inputLines) {
      const match = line.match(/-\s+\*\*(\w+)\*\*\s*\((\w+)\):\s*(.+)/)
      if (match) {
        spec.inputs.push({
          name: match[1],
          type: match[2],
          description: match[3],
          required: !line.includes('optional'),
        })
      }
    }
  }

  spec.outputs = []
  const outputsMatch = content.match(/## Outputs\s*\n\n?([\s\S]*?)(?=\n##|$)/i)
  if (outputsMatch) {
    const outputLines = outputsMatch[1].split('\n').filter((l) => l.startsWith('- '))
    for (const line of outputLines) {
      const match = line.match(/-\s+\*\*(\w+)\*\*\s*\((\w+)\):\s*(.+)/)
      if (match) {
        spec.outputs.push({
          name: match[1],
          type: match[2],
          description: match[3],
        })
      }
    }
  }

  spec.behaviors = []
  const behaviorsMatch = content.match(/## Behaviors\s*\n\n?([\s\S]*?)(?=\n##|$)/i)
  if (behaviorsMatch) {
    spec.behaviors = behaviorsMatch[1]
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim())
  }

  spec.edgeCases = []
  const edgeCasesMatch = content.match(/## Edge Cases\s*\n\n?([\s\S]*?)(?=\n##|$)/i)
  if (edgeCasesMatch) {
    const caseBlocks = edgeCasesMatch[1].split(/\n(?=###)/)
    for (const block of caseBlocks) {
      const titleMatch = block.match(/###\s+(.+)/)
      const behaviorMatch = block.match(/Expected:\s*(.+)/i)
      const priorityMatch = block.match(/Priority:\s*(high|medium|low)/i)
      if (titleMatch) {
        spec.edgeCases.push({
          scenario: titleMatch[1].trim(),
          expectedBehavior: behaviorMatch ? behaviorMatch[1].trim() : '',
          priority: (priorityMatch ? priorityMatch[1].toLowerCase() : 'medium') as
            | 'high'
            | 'medium'
            | 'low',
        })
      }
    }
  }

  spec.acceptanceCriteria = []
  const criteriaMatch = content.match(/## Acceptance Criteria\s*\n\n?([\s\S]*?)(?=\n##|$)/i)
  if (criteriaMatch) {
    const scenarios = criteriaMatch[1].split(/\n(?=###)/)
    for (const scenario of scenarios) {
      const nameMatch = scenario.match(/###\s+(.+)/)
      const givenMatch = scenario.match(/Given\s+(.+)/i)
      const whenMatch = scenario.match(/When\s+(.+)/i)
      const thenMatch = scenario.match(/Then\s+(.+)/i)
      if (nameMatch && givenMatch && whenMatch && thenMatch) {
        spec.acceptanceCriteria.push({
          name: nameMatch[1].trim(),
          given: givenMatch[1].trim(),
          when: whenMatch[1].trim(),
          expected: thenMatch[1].trim(),
        })
      }
    }
  }

  return spec
}

export async function loadSpec(featureName: string): Promise<Spec | null> {
  try {
    const specPath = await getSpecPath(featureName)
    const content = await fs.readFile(specPath, 'utf-8')
    const parsed = parseSpecFromMarkdown(content)
    return { ...createEmptySpec(featureName), ...parsed } as Spec
  } catch {
    return null
  }
}

export async function saveSpec(featureName: string, spec: Spec): Promise<void> {
  await ensureSpecsDir()
  const specPath = await getSpecPath(featureName)
  const content = generateSpecMarkdown(spec)
  await fs.writeFile(specPath, content, 'utf-8')
}

export function generateSpecMarkdown(spec: Spec): string {
  const lines: string[] = []

  lines.push(`# Spec: ${spec.feature}`)
  lines.push('')
  lines.push(`version: ${spec.version}`)
  lines.push('')
  lines.push('## Description')
  lines.push('')
  lines.push(spec.description)
  lines.push('')

  lines.push('## Inputs')
  lines.push('')
  for (const input of spec.inputs) {
    const required = input.required ? '' : ' (optional)'
    lines.push(`- **${input.name}** (${input.type}): ${input.description}${required}`)
    if (input.validation) {
      lines.push(`  - Validation: ${input.validation}`)
    }
    if (input.example) {
      lines.push(`  - Example: ${input.example}`)
    }
  }
  lines.push('')

  lines.push('## Outputs')
  lines.push('')
  for (const output of spec.outputs) {
    lines.push(`- **${output.name}** (${output.type}): ${output.description}`)
    if (output.example) {
      lines.push(`  - Example: ${output.example}`)
    }
  }
  lines.push('')

  lines.push('## Behaviors')
  lines.push('')
  for (const behavior of spec.behaviors) {
    lines.push(`- ${behavior}`)
  }
  lines.push('')

  lines.push('## Edge Cases')
  lines.push('')
  for (const edge of spec.edgeCases) {
    lines.push(`### ${edge.scenario}`)
    lines.push(`- Priority: ${edge.priority}`)
    lines.push(`- Expected: ${edge.expectedBehavior}`)
    lines.push('')
  }

  lines.push('## Acceptance Criteria')
  lines.push('')
  for (const criteria of spec.acceptanceCriteria) {
    lines.push(`### ${criteria.name}`)
    lines.push(`- Given ${criteria.given}`)
    lines.push(`- When ${criteria.when}`)
    lines.push(`- Then ${criteria.expected}`)
    if (criteria.and && criteria.and.length > 0) {
      for (const andClause of criteria.and) {
        lines.push(`- And ${andClause}`)
      }
    }
    lines.push('')
  }

  if (spec.nonFunctional) {
    lines.push('## Non-Functional Requirements')
    lines.push('')
    if (spec.nonFunctional.performance) {
      lines.push(`- Performance: ${spec.nonFunctional.performance}`)
    }
    if (spec.nonFunctional.security) {
      lines.push(`- Security: ${spec.nonFunctional.security}`)
    }
    if (spec.nonFunctional.scalability) {
      lines.push(`- Scalability: ${spec.nonFunctional.scalability}`)
    }
    if (spec.nonFunctional.reliability) {
      lines.push(`- Reliability: ${spec.nonFunctional.reliability}`)
    }
    if (spec.nonFunctional.maintainability) {
      lines.push(`- Maintainability: ${spec.nonFunctional.maintainability}`)
    }
    lines.push('')
  }

  if (spec.dependencies && spec.dependencies.length > 0) {
    lines.push('## Dependencies')
    lines.push('')
    for (const dep of spec.dependencies) {
      lines.push(`- ${dep}`)
    }
    lines.push('')
  }

  if (spec.assumptions && spec.assumptions.length > 0) {
    lines.push('## Assumptions')
    lines.push('')
    for (const assumption of spec.assumptions) {
      lines.push(`- ${assumption}`)
    }
    lines.push('')
  }

  if (spec.outOfScope && spec.outOfScope.length > 0) {
    lines.push('## Out of Scope')
    lines.push('')
    for (const item of spec.outOfScope) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function generateSpecTemplate(featureName: string): string {
  const template = createEmptySpec(featureName)

  template.description = '[Describe what this feature does and its purpose]'
  template.inputs = [
    {
      name: 'exampleInput',
      type: 'string',
      description: '[Describe the input]',
      required: true,
      example: '[Provide example]',
    },
  ]
  template.outputs = [
    {
      name: 'exampleOutput',
      type: 'object',
      description: '[Describe the output]',
      example: '[Provide example]',
    },
  ]
  template.behaviors = ['[Describe expected behavior 1]', '[Describe expected behavior 2]']
  template.edgeCases = [
    {
      scenario: 'Empty input',
      expectedBehavior: '[What should happen]',
      priority: 'high',
    },
    {
      scenario: 'Invalid input',
      expectedBehavior: '[What should happen]',
      priority: 'high',
    },
  ]
  template.acceptanceCriteria = [
    {
      name: 'Basic functionality',
      given: '[Initial state]',
      when: '[Action taken]',
      expected: '[Expected result]',
    },
  ]

  return generateSpecMarkdown(template)
}

export { validateSpecData as validateSpec }

export async function validateSpecFile(featureName: string): Promise<SpecValidationResult> {
  const spec = await loadSpec(featureName)

  if (!spec) {
    return {
      valid: false,
      errors: [{ field: 'spec', message: 'Spec file not found', path: [] }],
      warnings: [],
    }
  }

  return validateSpecData(spec)
}

export function formatValidationResult(result: SpecValidationResult): string {
  const lines: string[] = []

  if (result.valid) {
    lines.push('Spec is valid!')
  } else {
    lines.push('Spec validation failed:')
  }

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    for (const error of result.errors) {
      lines.push(`  - ${error.field}: ${error.message}`)
    }
  }

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`)
    }
  }

  return lines.join('\n')
}
