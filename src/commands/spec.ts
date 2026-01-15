import path from 'node:path'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import {
  createEmptySpec,
  type EdgeCase,
  type GherkinScenario,
  type Spec,
  type SpecInput,
  type SpecOutput,
  validateSpec,
} from '../types/spec.js'
import { executeClaudeCommand } from '../utils/claude.js'
import { logger } from '../utils/logger.js'

const FEATURES_DIR = '.claude/plans/features'

function serializeSpecToMarkdown(spec: Spec): string {
  const lines: string[] = []

  lines.push(`# Spec: ${spec.feature}`)
  lines.push('')
  lines.push(`**Version:** ${spec.version}`)
  lines.push(`**Generated:** ${new Date().toISOString()}`)
  lines.push('')

  lines.push('## Description')
  lines.push(spec.description)
  lines.push('')

  lines.push('## Inputs')
  lines.push('')
  for (const input of spec.inputs) {
    lines.push(`### ${input.name}`)
    lines.push(`- **Type:** ${input.type}`)
    lines.push(`- **Required:** ${input.required ? 'Yes' : 'No'}`)
    lines.push(`- **Description:** ${input.description}`)
    if (input.validation) {
      lines.push(`- **Validation:** ${input.validation}`)
    }
    if (input.example) {
      lines.push(`- **Example:** ${input.example}`)
    }
    lines.push('')
  }

  lines.push('## Outputs')
  lines.push('')
  for (const output of spec.outputs) {
    lines.push(`### ${output.name}`)
    lines.push(`- **Type:** ${output.type}`)
    lines.push(`- **Description:** ${output.description}`)
    if (output.example) {
      lines.push(`- **Example:** ${output.example}`)
    }
    lines.push('')
  }

  lines.push('## Behaviors')
  lines.push('')
  for (const behavior of spec.behaviors) {
    lines.push(`- ${behavior}`)
  }
  lines.push('')

  lines.push('## Edge Cases')
  lines.push('')
  for (const edgeCase of spec.edgeCases) {
    lines.push(`### ${edgeCase.scenario}`)
    lines.push(`- **Expected:** ${edgeCase.expectedBehavior}`)
    lines.push(`- **Priority:** ${edgeCase.priority}`)
    lines.push('')
  }

  lines.push('## Acceptance Criteria')
  lines.push('')
  for (const criterion of spec.acceptanceCriteria) {
    lines.push(`### ${criterion.name}`)
    lines.push('```gherkin')
    lines.push(`Given ${criterion.given}`)
    lines.push(`When ${criterion.when}`)
    lines.push(`Then ${criterion.expected}`)
    if (criterion.and && criterion.and.length > 0) {
      for (const andClause of criterion.and) {
        lines.push(`And ${andClause}`)
      }
    }
    lines.push('```')
    lines.push('')
  }

  if (spec.nonFunctional) {
    lines.push('## Non-Functional Requirements')
    lines.push('')
    if (spec.nonFunctional.performance) {
      lines.push(`- **Performance:** ${spec.nonFunctional.performance}`)
    }
    if (spec.nonFunctional.security) {
      lines.push(`- **Security:** ${spec.nonFunctional.security}`)
    }
    if (spec.nonFunctional.scalability) {
      lines.push(`- **Scalability:** ${spec.nonFunctional.scalability}`)
    }
    if (spec.nonFunctional.reliability) {
      lines.push(`- **Reliability:** ${spec.nonFunctional.reliability}`)
    }
    if (spec.nonFunctional.maintainability) {
      lines.push(`- **Maintainability:** ${spec.nonFunctional.maintainability}`)
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

function parseMarkdownToSpec(content: string, featureName: string): Partial<Spec> {
  const spec: Partial<Spec> = createEmptySpec(featureName)

  const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |\n$)/)
  if (descMatch) {
    spec.description = descMatch[1].trim()
  }

  const inputsMatch = content.match(/## Inputs\n\n([\s\S]*?)(?=\n## |\n$)/)
  if (inputsMatch) {
    const inputBlocks = inputsMatch[1].split(/### /).filter(Boolean)
    spec.inputs = inputBlocks.map((block) => {
      const lines = block.split('\n').filter(Boolean)
      const name = lines[0]?.trim() || ''
      const getValue = (key: string) => {
        const line = lines.find((l) => l.includes(`**${key}:**`))
        return line?.split(`**${key}:**`)[1]?.trim() || ''
      }
      return {
        name,
        type: getValue('Type'),
        description: getValue('Description'),
        required: getValue('Required') !== 'No',
        validation: getValue('Validation') || undefined,
        example: getValue('Example') || undefined,
      }
    })
  }

  const outputsMatch = content.match(/## Outputs\n\n([\s\S]*?)(?=\n## |\n$)/)
  if (outputsMatch) {
    const outputBlocks = outputsMatch[1].split(/### /).filter(Boolean)
    spec.outputs = outputBlocks.map((block) => {
      const lines = block.split('\n').filter(Boolean)
      const name = lines[0]?.trim() || ''
      const getValue = (key: string) => {
        const line = lines.find((l) => l.includes(`**${key}:**`))
        return line?.split(`**${key}:**`)[1]?.trim() || ''
      }
      return {
        name,
        type: getValue('Type'),
        description: getValue('Description'),
        example: getValue('Example') || undefined,
      }
    })
  }

  const behaviorsMatch = content.match(/## Behaviors\n\n([\s\S]*?)(?=\n## |\n$)/)
  if (behaviorsMatch) {
    spec.behaviors = behaviorsMatch[1]
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2))
  }

  return spec
}

export class SpecCommand {
  async create(featureName: string, options: { fromPrd?: boolean } = {}): Promise<void> {
    const spinner = ora('Creating spec...').start()

    const featurePath = path.join(FEATURES_DIR, featureName)
    const specPath = path.join(featurePath, 'spec.md')

    if (!(await fs.pathExists(featurePath))) {
      spinner.fail(`Feature "${featureName}" not found`)
      logger.error(`Run "adk feature new ${featureName}" first`)
      process.exit(1)
    }

    spinner.stop()

    let baseDescription = ''
    if (options.fromPrd) {
      const prdPath = path.join(featurePath, 'prd.md')
      if (await fs.pathExists(prdPath)) {
        const prdContent = await fs.readFile(prdPath, 'utf-8')
        const descMatch = prdContent.match(/## .*?Problema[\s\S]*?(?=##|$)/)
        baseDescription = descMatch?.[0] || ''
      }
    }

    const answers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'description',
        message: 'Feature description (min 10 chars):',
        default: baseDescription,
        validate: (input: string) =>
          input.length >= 10 || 'Description must be at least 10 characters',
      },
      {
        type: 'number',
        name: 'inputCount',
        message: 'How many inputs does this feature have?',
        default: 1,
        validate: (input: number) => input >= 1 || 'At least one input required',
      },
    ])

    const inputs: SpecInput[] = []
    for (let i = 0; i < answers.inputCount; i++) {
      const inputAnswers = await inquirer.prompt([
        { type: 'input', name: 'name', message: `Input ${i + 1} name:` },
        { type: 'input', name: 'type', message: `Input ${i + 1} type:` },
        { type: 'input', name: 'description', message: `Input ${i + 1} description:` },
        { type: 'confirm', name: 'required', message: `Input ${i + 1} required?`, default: true },
      ])
      inputs.push(inputAnswers)
    }

    const outputAnswers = await inquirer.prompt([
      {
        type: 'number',
        name: 'outputCount',
        message: 'How many outputs does this feature have?',
        default: 1,
      },
    ])

    const outputs: SpecOutput[] = []
    for (let i = 0; i < outputAnswers.outputCount; i++) {
      const outputAnswer = await inquirer.prompt([
        { type: 'input', name: 'name', message: `Output ${i + 1} name:` },
        { type: 'input', name: 'type', message: `Output ${i + 1} type:` },
        { type: 'input', name: 'description', message: `Output ${i + 1} description:` },
      ])
      outputs.push(outputAnswer)
    }

    const behaviorAnswers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'behaviors',
        message: 'List behaviors (one per line):',
      },
    ])
    const behaviors = behaviorAnswers.behaviors
      .split('\n')
      .map((b: string) => b.trim())
      .filter(Boolean)

    const edgeCaseAnswers = await inquirer.prompt([
      {
        type: 'number',
        name: 'edgeCaseCount',
        message: 'How many edge cases?',
        default: 1,
      },
    ])

    const edgeCases: EdgeCase[] = []
    for (let i = 0; i < edgeCaseAnswers.edgeCaseCount; i++) {
      const ecAnswer = await inquirer.prompt([
        { type: 'input', name: 'scenario', message: `Edge case ${i + 1} scenario:` },
        {
          type: 'input',
          name: 'expectedBehavior',
          message: `Edge case ${i + 1} expected behavior:`,
        },
        {
          type: 'list',
          name: 'priority',
          message: `Edge case ${i + 1} priority:`,
          choices: ['high', 'medium', 'low'],
          default: 'medium',
        },
      ])
      edgeCases.push(ecAnswer)
    }

    const criteriaAnswers = await inquirer.prompt([
      {
        type: 'number',
        name: 'criteriaCount',
        message: 'How many acceptance criteria (Gherkin scenarios)?',
        default: 1,
      },
    ])

    const acceptanceCriteria: GherkinScenario[] = []
    for (let i = 0; i < criteriaAnswers.criteriaCount; i++) {
      const criteriaAnswer = await inquirer.prompt([
        { type: 'input', name: 'name', message: `Scenario ${i + 1} name:` },
        { type: 'input', name: 'given', message: `Scenario ${i + 1} Given:` },
        { type: 'input', name: 'when', message: `Scenario ${i + 1} When:` },
        { type: 'input', name: 'expected', message: `Scenario ${i + 1} Then:` },
      ])
      acceptanceCriteria.push(criteriaAnswer)
    }

    const spec: Spec = {
      feature: featureName,
      version: '1.0.0',
      description: answers.description,
      inputs,
      outputs,
      behaviors,
      edgeCases,
      acceptanceCriteria,
    }

    const markdown = serializeSpecToMarkdown(spec)
    await fs.writeFile(specPath, markdown, 'utf-8')

    logger.success(`Spec created at ${specPath}`)
  }

  async validate(featureName: string, options: { fix?: boolean } = {}): Promise<boolean> {
    const spinner = ora('Validating spec...').start()

    const specPath = path.join(FEATURES_DIR, featureName, 'spec.md')

    if (!(await fs.pathExists(specPath))) {
      spinner.fail('Spec not found')
      logger.error(`Run "adk spec create ${featureName}" first`)
      return false
    }

    const content = await fs.readFile(specPath, 'utf-8')
    const spec = parseMarkdownToSpec(content, featureName)

    const result = validateSpec(spec)

    if (result.valid) {
      spinner.succeed('Spec validation passed')

      if (result.warnings.length > 0) {
        logger.warn('\nWarnings:')
        for (const warning of result.warnings) {
          logger.warn(`  ⚠️  ${warning}`)
        }
      }

      return true
    }

    spinner.fail('Spec validation failed')

    logger.error('\nErrors:')
    for (const error of result.errors) {
      logger.error(`  ❌ ${error.field}: ${error.message}`)
    }

    if (options.fix) {
      logger.info('\nAttempting auto-fix...')
      // Auto-fix could be implemented here
      logger.warn('Auto-fix not fully implemented yet')
    }

    return false
  }

  async generate(featureName: string): Promise<void> {
    const spinner = ora('Generating code from spec...').start()

    const specPath = path.join(FEATURES_DIR, featureName, 'spec.md')

    if (!(await fs.pathExists(specPath))) {
      spinner.fail('Spec not found')
      logger.error(`Run "adk spec create ${featureName}" first`)
      process.exit(1)
    }

    const specContent = await fs.readFile(specPath, 'utf-8')

    const prompt = `
TASK: Generate code scaffolding from specification

SPEC:
${specContent}

REQUIREMENTS:
1. Generate TypeScript interfaces for all inputs/outputs
2. Create function signatures with TODO comments (no implementation)
3. Generate test file with describe blocks for each acceptance criteria
4. Follow project patterns from .claude/memory/project-context.md

OUTPUT FILES:
1. src/types/${featureName}.ts - Interfaces
2. src/${featureName}.ts - Function signatures
3. tests/${featureName}.test.ts - Test scaffolding

IMPORTANT:
- Do NOT implement logic, only scaffolding
- Each function body: throw new Error('TODO: implement')
- Each test: it.todo('scenario description')
`

    spinner.text = 'Generating scaffolding with Claude...'

    try {
      await executeClaudeCommand(prompt)
      spinner.succeed('Code scaffolding generated')
    } catch (error) {
      spinner.fail('Generation failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async view(featureName: string): Promise<void> {
    const specPath = path.join(FEATURES_DIR, featureName, 'spec.md')

    if (!(await fs.pathExists(specPath))) {
      logger.error(`Spec not found for feature "${featureName}"`)
      process.exit(1)
    }

    const content = await fs.readFile(specPath, 'utf-8')
    console.log(content)
  }
}

export const specCommand = new SpecCommand()
