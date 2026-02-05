/**
 * Anti-Stub System for ADK v3.
 * Prevents "Lazy Coding" by detecting and blocking common stub patterns.
 */

export const STUB_PATTERNS = [
  /\/\/ TODO/i,
  /\/\/ FIXME/i,
  /\/\* TODO/i,
  /throw new Error\(["']Not implemented["']\)/i,
  /return null;?\s*\/\/ Placeholder/i,
  /function\s+\w+\s*\(.*\)\s*{\s*\.\.\.\s*}/,
  /function\s+\w+\s*\(.*\)\s*{\s*pass\s*}/,
  /\/\* \.\.\. \*\//,
  /\/\/ \.\.\./,
]

export interface ValidationResult {
  valid: boolean
  error?: string
  matches?: string[]
}

/**
 * Validates output against known stub patterns.
 */
export function validateOutput(content: string): ValidationResult {
  const matches: string[] = []

  for (const pattern of STUB_PATTERNS) {
    const match = content.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }

  if (matches.length > 0) {
    return {
      valid: false,
      error: `Stub patterns detected: ${matches.join(', ')}. Please provide full implementation.`,
      matches,
    }
  }

  return { valid: true }
}

/**
 * Returns the anti-stub system prompt module.
 */
export function getAntiStubPrompt(): string {
  return `
<anti-stub-protocol>
ACTIVE. You are strictly forbidden from using placeholders, TODOs, or incomplete implementations.
Always provide the full, functional code. If you cannot complete a task, explain why instead of leaving a stub.
Forbidden patterns include: // TODO, // FIXME, // ..., throw new Error("Not implemented"), and empty function bodies.

READ-BEFORE-WRITE: You are forbidden from modifying a file unless you have read it in the current session.
Check <core-state> to see which files you have already accessed.
</anti-stub-protocol>
`.trim()
}
