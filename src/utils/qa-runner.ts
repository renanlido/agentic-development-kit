import path from 'node:path'
import fs from 'fs-extra'
import type { FeatureList } from '../types/feature-list.js'
import { executeHeadlessWithMetrics } from './claude.js'
import { generateQAPrompt } from './prompts/qa-agent.js'

export type QAIssueType = 'test' | 'lint' | 'type-check' | 'stub'

export interface QAIssue {
  type: QAIssueType
  message: string
  file?: string
  line?: number
}

export interface QAResult {
  passed: boolean
  issues: QAIssue[]
  attempts: number
  correctionsMade: string[]
}

export interface QARunnerOptions {
  maxAttempts?: number
  dryRun?: boolean
}

const DEFAULT_MAX_ATTEMPTS = 3

export class QARunner {
  private featureName: string
  private maxAttempts: number
  private dryRun: boolean

  constructor(featureName: string, options: QARunnerOptions = {}) {
    this.validateFeatureName(featureName)
    this.featureName = featureName
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.dryRun = options.dryRun ?? false
  }

  private validateFeatureName(name: string): void {
    if (/[/\\]|\.\./.test(name)) {
      const errorMsg = `Invalid feature name: ${name}`
      throw new Error(errorMsg)
    }
  }

  private getBasePath(): string {
    if (process.env.TEST_FEATURE_PATH) {
      return process.env.TEST_FEATURE_PATH
    }
    return process.cwd()
  }

  private getFeatureWorkingDirectory(): string {
    const mainRepoPath = process.cwd()
    const worktreePath = path.join(mainRepoPath, '.worktrees', this.featureName)

    if (fs.pathExistsSync(worktreePath)) {
      return worktreePath
    }

    return mainRepoPath
  }

  private getFeaturePath(): string {
    return path.join(this.getBasePath(), '.claude', 'plans', 'features', this.featureName)
  }

  private getFeatureListPath(): string {
    return path.join(this.getFeaturePath(), 'feature_list.json')
  }

  private async loadFeatureList(): Promise<FeatureList | null> {
    const listPath = this.getFeatureListPath()

    if (!(await fs.pathExists(listPath))) {
      return null
    }

    const data = await fs.readJSON(listPath)
    return data as FeatureList
  }

  private async runQAValidation(taskId?: string): Promise<QAIssue[]> {
    if (this.dryRun) {
      return []
    }

    const mode = taskId ? 'task' : 'feature'
    const prompt = generateQAPrompt(this.featureName, mode, taskId)
    const workingDir = this.getFeatureWorkingDirectory()

    try {
      const result = await executeHeadlessWithMetrics(prompt, {
        headless: true,
        showProgress: true,
        cwd: workingDir,
      })

      if (!result.success) {
        return [
          {
            type: 'test',
            message: 'QA validation failed to execute',
          },
        ]
      }

      if (!result.output) {
        return [
          {
            type: 'test',
            message: 'QA validation returned no output',
          },
        ]
      }

      return this.parseQAOutput(result.output)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return [
        {
          type: 'test',
          message: `QA execution error: ${errorMessage}`,
        },
      ]
    }
  }

  private parseQAOutput(output: string): QAIssue[] {
    try {
      const jsonMatch = output.match(/\{[\s\S]*"status"[\s\S]*"issues"[\s\S]*\}/)
      if (!jsonMatch) {
        return [
          {
            type: 'test',
            message: 'QA output did not contain valid JSON format',
          },
        ]
      }

      const qaResult = JSON.parse(jsonMatch[0]) as {
        status: 'pass' | 'fail'
        issues: Array<{
          type: string
          severity: string
          file: string
          line?: number
          description: string
          suggestion?: string
        }>
      }

      if (qaResult.status === 'pass') {
        return []
      }

      return qaResult.issues.map((issue) => ({
        type: this.mapIssueType(issue.type),
        message: `${issue.description}${issue.suggestion ? ` | Fix: ${issue.suggestion}` : ''}`,
        file: issue.file,
        line: issue.line,
      }))
    } catch (error) {
      return [
        {
          type: 'test',
          message: `Failed to parse QA output: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]
    }
  }

  private mapIssueType(type: string): QAIssueType {
    switch (type) {
      case 'stub':
        return 'stub'
      case 'test':
        return 'test'
      case 'type':
        return 'type-check'
      case 'lint':
        return 'lint'
      default:
        return 'test'
    }
  }

  private generateFixPrompt(issues: QAIssue[]): string {
    const issueDescriptions = issues
      .map((issue) => {
        let description = `- [${issue.type}] ${issue.message}`
        if (issue.file) {
          description += ` (${issue.file}`
          if (issue.line) {
            description += `:${issue.line}`
          }
          description += ')'
        }
        return description
      })
      .join('\n')

    return `## AUTO-FIX: Resolve QA Issues

**Feature:** ${this.featureName}

### Issues to Fix
${issueDescriptions}

### Instructions
1. Analyze each issue
2. Apply the minimal fix required
3. Verify the fix works
4. Do NOT introduce new issues

### Constraints
- Fix only the issues listed above
- Do NOT refactor unrelated code
- Ensure all tests pass after fix
`
  }

  private async tryFix(issues: QAIssue[]): Promise<boolean> {
    if (this.dryRun || issues.length === 0) {
      return true
    }

    const fixPrompt = this.generateFixPrompt(issues)
    const workingDir = this.getFeatureWorkingDirectory()

    try {
      const result = await executeHeadlessWithMetrics(fixPrompt, {
        headless: true,
        showProgress: true,
        cwd: workingDir,
      })

      return result.success
    } catch {
      return false
    }
  }

  private summarizeIssues(issues: QAIssue[]): string {
    if (issues.length === 0) {
      return 'no issues'
    }

    const typeCounts = new Map<string, number>()
    for (const issue of issues) {
      const count = typeCounts.get(issue.type) ?? 0
      typeCounts.set(issue.type, count + 1)
    }

    const parts: string[] = []
    for (const [type, count] of typeCounts) {
      parts.push(`${count} ${type}`)
    }

    return parts.join(', ')
  }

  async runTaskQA(taskId: string): Promise<QAResult> {
    const featureList = await this.loadFeatureList()

    if (!featureList) {
      return {
        passed: true,
        issues: [],
        attempts: 1,
        correctionsMade: ['Feature list not found, skipping task QA'],
      }
    }

    const task = featureList.tests.find((t) => t.id === taskId)
    if (!task) {
      return {
        passed: true,
        issues: [],
        attempts: 1,
        correctionsMade: [`Task not found: ${taskId}, skipping QA`],
      }
    }

    let attempts = 0
    let issues: QAIssue[] = []
    const correctionsMade: string[] = []

    while (attempts < this.maxAttempts) {
      attempts++

      issues = await this.runQAValidation(taskId)

      if (issues.length === 0) {
        return {
          passed: true,
          issues: [],
          attempts,
          correctionsMade,
        }
      }

      if (attempts < this.maxAttempts) {
        const issuesSummary = this.summarizeIssues(issues)
        const fixed = await this.tryFix(issues)
        if (fixed) {
          correctionsMade.push(`Attempt ${attempts}: Fixed issues - ${issuesSummary}`)
        } else {
          correctionsMade.push(`Attempt ${attempts}: Failed to fix issues - ${issuesSummary}`)
          break
        }

        await this.delay(2000)
      }
    }

    return {
      passed: false,
      issues,
      attempts,
      correctionsMade,
    }
  }

  async attemptAutoCorrection(issues: QAIssue[]): Promise<boolean> {
    return this.tryFix(issues)
  }

  async runFeatureQA(): Promise<QAResult> {
    let attempts = 0
    let issues: QAIssue[] = []
    const correctionsMade: string[] = []

    while (attempts < this.maxAttempts) {
      attempts++

      issues = await this.runQAValidation()

      if (issues.length === 0) {
        return {
          passed: true,
          issues: [],
          attempts,
          correctionsMade,
        }
      }

      if (attempts < this.maxAttempts) {
        const issuesSummary = this.summarizeIssues(issues)
        const fixed = await this.tryFix(issues)
        if (fixed) {
          correctionsMade.push(`Attempt ${attempts}: Fixed issues - ${issuesSummary}`)
        } else {
          correctionsMade.push(`Attempt ${attempts}: Failed to fix issues - ${issuesSummary}`)
          break
        }

        await this.delay(2000)
      }
    }

    return {
      passed: false,
      issues,
      attempts,
      correctionsMade,
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const createQARunner = (featureName: string, options?: QARunnerOptions): QARunner => {
  return new QARunner(featureName, options)
}

export const attemptAutoCorrection = async (
  featureName: string,
  issues: QAIssue[],
  options?: QARunnerOptions
): Promise<boolean> => {
  const runner = new QARunner(featureName, options)
  return runner.attemptAutoCorrection(issues)
}
