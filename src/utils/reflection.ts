export interface ActionContext {
  currentPhase: string
  allowedFiles: string[]
  constraints: string[]
}

export interface ActionResult {
  success: boolean
  output: string
  filesModified: string[]
}

export interface TaskValidation {
  isValid: boolean
  warnings: string[]
  errors: string[]
  suggestions: string[]
}

export interface ReflectionResult {
  matchesExpected: boolean
  discrepancies: string[]
  confidence: number
}

export interface ExpectedResult {
  shouldSucceed: boolean
  expectedFiles: string[]
}

export interface ReflectionEntry {
  action: string
  validation: TaskValidation
  result: ActionResult
  timestamp: string
}

const DANGEROUS_PATTERNS = [
  /\bdelete\b.*\b(node_modules|\.git|dist)\b/i,
  /\brm\s+-rf\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
]

const FILE_ACTION_PATTERNS = [
  /(?:write|edit|modify|update|create)\s+(?:to\s+)?(\S+\.\w+)/i,
  /(?:file|path)[:\s]+(\S+\.\w+)/i,
]

export function validateAction(action: string, context: ActionContext): TaskValidation {
  const validation: TaskValidation = {
    isValid: true,
    warnings: [],
    errors: [],
    suggestions: [],
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(action)) {
      validation.warnings.push(`Dangerous command detected: ${action}`)
    }
  }

  const filePath = extractFilePath(action)

  if (filePath && context.allowedFiles.length > 0) {
    const isAllowed = context.allowedFiles.some((allowed) => filePath.startsWith(allowed))

    if (!isAllowed) {
      validation.isValid = false
      validation.errors.push(`File outside allowed scope: ${filePath}`)
    }
  }

  if (context.currentPhase === 'research' && filePath && !filePath.includes('.claude/plans/')) {
    validation.isValid = false
    validation.errors.push('No code modifications in research phase')
  }

  return validation
}

function extractFilePath(action: string): string | null {
  for (const pattern of FILE_ACTION_PATTERNS) {
    const match = action.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

export function reflectOnResult(result: ActionResult, expected: ExpectedResult): ReflectionResult {
  const discrepancies: string[] = []
  let confidence = 100

  if (expected.shouldSucceed && !result.success) {
    discrepancies.push('Action failed when success was expected')
    confidence -= 50
  }

  if (!expected.shouldSucceed && result.success) {
    discrepancies.push('Action succeeded when failure was expected')
    confidence -= 30
  }

  const unexpectedFiles = result.filesModified.filter((f) => !expected.expectedFiles.includes(f))

  if (unexpectedFiles.length > 0) {
    discrepancies.push(`Unexpected files modified: ${unexpectedFiles.join(', ')}`)
    confidence -= 10 * unexpectedFiles.length
  }

  const missingFiles = expected.expectedFiles.filter((f) => !result.filesModified.includes(f))

  if (missingFiles.length > 0 && expected.expectedFiles.length > 0) {
    discrepancies.push(`Expected files not modified: ${missingFiles.join(', ')}`)
    confidence -= 5 * missingFiles.length
  }

  confidence = Math.max(0, Math.min(100, confidence))

  return {
    matchesExpected: discrepancies.length === 0,
    discrepancies,
    confidence,
  }
}

export function suggestCorrections(validation: TaskValidation): string[] {
  const corrections: string[] = []

  for (const error of validation.errors) {
    if (error.includes('outside allowed scope')) {
      corrections.push('Ensure the file is within the allowed directories for this feature')
    }
    if (error.includes('research phase')) {
      corrections.push('During research phase, only documentation files should be modified')
    }
  }

  for (const warning of validation.warnings) {
    if (warning.includes('Dangerous command')) {
      corrections.push('Consider using safer alternatives or adding confirmation prompts')
    }
  }

  return corrections
}

export class ReflectionHistory {
  private entries: ReflectionEntry[] = []

  record(entry: ReflectionEntry): void {
    this.entries.push(entry)
  }

  getAll(): ReflectionEntry[] {
    return [...this.entries]
  }

  getRecent(count: number): ReflectionEntry[] {
    return this.entries.slice(-count)
  }

  getSuccessRate(): number {
    if (this.entries.length === 0) {
      return 0
    }

    const successful = this.entries.filter((e) => e.result.success).length
    return Math.round((successful / this.entries.length) * 100)
  }

  clear(): void {
    this.entries = []
  }
}
