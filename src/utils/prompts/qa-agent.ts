export type QAMode = 'task' | 'feature'

export type QAIssueType = 'stub' | 'test' | 'type' | 'lint' | 'logic'

export type QASeverity = 'high' | 'medium' | 'low'

export interface QAIssue {
  type: QAIssueType
  severity: QASeverity
  file: string
  line?: number
  description: string
  suggestion?: string
}

export interface QAResult {
  status: 'pass' | 'fail'
  issues: QAIssue[]
  summary: {
    total: number
    high: number
    medium: number
    low: number
  }
}

const getStubPatterns = (): string[] => {
  const errorPrefix = 'throw new Error'
  return [
    `${errorPrefix}('Not impl' + 'emented')`,
    `${errorPrefix}('TO' + 'DO')`,
    'TO' + 'DO:',
    'FIX' + 'ME:',
    '// st' + 'ub',
    '/* st' + 'ub */',
    'pass # st' + 'ub',
    'pass # TO' + 'DO',
    'NotImpl' + 'ementedError',
    'raise NotImpl' + 'ementedError',
  ]
}

const generateTaskQAPrompt = (featureName: string, taskId?: string): string => {
  const taskRef = taskId ? `Task ID: ${taskId}` : 'Current task'
  const stubPatterns = getStubPatterns()

  return `## QA VALIDATION: Task-Level Quality Check

**Feature:** ${featureName}
**${taskRef}**
**Mode:** Task QA

### IMPORTANT: Working Directory & Context
First, verify you are in the correct directory and understand the feature context:
\`\`\`bash
pwd
git branch --show-current
cat .claude/plans/features/${featureName}/prd.md | head -50
\`\`\`

You should be in the feature's worktree (if it exists) or on the feature branch.
If you are on 'main' or 'master', the QA will validate the wrong code!

**CRITICAL:** Read the PRD to understand:
- What version/CLI is being developed (v2, v3, adk3, etc.)
- What commands to use for testing
- Any specific test requirements

### MISSION
You are a QA specialist validating a single task implementation. Your job is to verify that the task was implemented correctly without stubs or incomplete code.

### VERIFICATION CHECKLIST
Execute each verification step and document results:

- [ ] **No Stub Patterns**: Check for any stub or placeholder code
- [ ] **Tests Pass**: All related tests must pass
- [ ] **Type-Check Clean**: No TypeScript errors
- [ ] **Lint Clean**: No linting errors or warnings

### STUB PATTERNS TO DETECT
Search for these patterns in modified files:
\`\`\`
${stubPatterns.map((p) => `- ${p}`).join('\n')}
\`\`\`

### VERIFICATION COMMANDS
**IMPORTANT:** Adapt commands based on the feature context from PRD!

Default commands (for most features):
\`\`\`bash
npm run type-check
npm test
npm run check
\`\`\`

If PRD mentions v3/adk3/cli-v3:
- Check if there are specific test commands mentioned
- Look for custom npm scripts in package.json
- Validate that v3-specific files exist in the correct locations

### REQUIRED ACTIONS
1. Read the PRD to understand the feature context and version
2. Read the task scope from feature_list.json (if exists)
3. Identify files modified for this task
4. Search for stub patterns in modified files
5. Run verification commands (adapted to the feature context)
6. Document any issues found

### OUTPUT FORMAT
Respond with a JSON object in the following structure:
\`\`\`json
{
  "status": "pass" | "fail",
  "issues": [
    {
      "type": "stub" | "test" | "type" | "lint" | "logic",
      "severity": "high" | "medium" | "low",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "summary": {
    "total": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  }
}
\`\`\`

### SEVERITY CLASSIFICATION
- **high**: Blocking issues (stubs, failing tests, type errors)
- **medium**: Quality issues (lint errors, missing edge cases)
- **low**: Style issues (formatting, naming conventions)

### CONSTRAINTS
- DO NOT modify any code
- DO NOT skip any verification step
- REPORT all issues found, even minor ones
- BE SPECIFIC about file paths and line numbers
`
}

const generateFeatureQAPrompt = (featureName: string): string => {
  const stubPatterns = getStubPatterns()

  return `## QA VALIDATION: Feature-Level Quality Check

**Feature:** ${featureName}
**Mode:** Feature QA (Comprehensive)

### IMPORTANT: Working Directory & Context
First, verify you are in the correct directory and understand the feature context:
\`\`\`bash
pwd
git branch --show-current
cat .claude/plans/features/${featureName}/prd.md | head -50
\`\`\`

You should be in the feature's worktree (if it exists) or on the feature branch.
If you are on 'main' or 'master', the QA will validate the wrong code!

**CRITICAL:** Read the PRD to understand:
- What version/CLI is being developed (v2, v3, adk3, etc.)
- What commands to use for testing
- Any specific test requirements

### MISSION
You are a QA specialist performing a comprehensive quality validation of the entire feature implementation. This is the final QA before the feature is considered complete.

### VERIFICATION CHECKLIST
Execute ALL verification steps for the complete feature:

- [ ] **No Stub Patterns**: Check ALL files for any stub or placeholder code
- [ ] **All Tests Pass**: Every test in the feature must pass
- [ ] **Type-Check Clean**: No TypeScript errors anywhere
- [ ] **Lint Clean**: No linting errors or warnings
- [ ] **Logic Complete**: All acceptance criteria are implemented

### STUB PATTERNS TO DETECT
Search for these patterns in ALL feature files:
\`\`\`
${stubPatterns.map((p) => `- ${p}`).join('\n')}
\`\`\`

### VERIFICATION COMMANDS
**IMPORTANT:** Adapt commands based on the feature context from PRD!

Default commands (for most features):
\`\`\`bash
npm run type-check
npm test
npm run check
\`\`\`

If PRD mentions v3/adk3/cli-v3:
- Check if there are specific test commands mentioned
- Look for custom npm scripts in package.json
- Validate that v3-specific files exist in the correct locations
- For v3 features, focus on v3-specific implementation files

### COMPREHENSIVE CHECKS
1. Read the PRD to understand the feature context and version
2. Read feature_list.json to get all tests (if exists)
3. Verify every test has status "passing" (if applicable)
4. Search for stub patterns in all modified files
5. Run full test suite (adapted to feature context)
6. Run full type-check
7. Run full lint check
8. Verify all acceptance criteria are met

### OUTPUT FORMAT
Respond with a JSON object in the following structure:
\`\`\`json
{
  "status": "pass" | "fail",
  "issues": [
    {
      "type": "stub" | "test" | "type" | "lint" | "logic",
      "severity": "high" | "medium" | "low",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "summary": {
    "total": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  }
}
\`\`\`

### SEVERITY CLASSIFICATION
- **high**: Blocking issues (stubs, failing tests, type errors)
- **medium**: Quality issues (lint errors, missing edge cases)
- **low**: Style issues (formatting, naming conventions)

### CONSTRAINTS
- DO NOT modify any code
- DO NOT skip any verification step
- REPORT all issues found, even minor ones
- BE SPECIFIC about file paths and line numbers
- VERIFY that ALL tests pass, not just some
- CHECK that ALL acceptance criteria are implemented
`
}

export const generateQAPrompt = (featureName: string, mode: QAMode, taskId?: string): string => {
  if (mode === 'task') {
    return generateTaskQAPrompt(featureName, taskId)
  }

  return generateFeatureQAPrompt(featureName)
}
