# ADK Code Conventions

**Last Updated**: 2026-01-13

## File Organization

### Directory Structure

```
src/
├── cli.ts              # Entry point - keep minimal
├── commands/           # Command implementations
│   ├── feature.ts      # Feature lifecycle
│   ├── workflow.ts     # Automated workflows
│   ├── agent.ts        # Agent management
│   ├── deploy.ts       # Deployment
│   └── init.ts         # Project initialization
└── utils/              # Shared utilities
    ├── claude.ts       # Claude Code integration
    ├── logger.ts       # Logging
    └── templates.ts    # Template system
```

### File Naming

- **Commands**: Singular noun (e.g., `feature.ts`, not `features.ts`)
- **Utilities**: Descriptive name (e.g., `claude.ts`, `templates.ts`)
- **Tests**: Same name + `.test.ts` (e.g., `feature.test.ts`)
- **Templates**: Kebab-case with suffix (e.g., `prd-template.md`)

### When to Create New Files

**Create new command file when**:
- Command has 3+ subcommands
- Logic exceeds 200 lines
- Command is conceptually distinct

**Create new utility when**:
- Logic is reused across 2+ commands
- Utility is conceptually cohesive
- Utility can be tested in isolation

**Don't create new files for**:
- One-off helper functions (keep in same file)
- Single-use constants
- Type definitions used in one file only

## Code Style

### Import Organization

Group imports in this order:
```typescript
// 1. Node.js built-ins (with node: protocol)
import path from 'node:path'
import { execSync } from 'node:child_process'

// 2. External dependencies (alphabetical)
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'

// 3. Internal modules (relative imports)
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'

// 4. Types (if separate from implementation)
import type { FeatureOptions } from '../types'
```

### Node.js Imports

Always use `node:` protocol for built-in modules:
```typescript
// ✅ Good
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

// ❌ Bad
import path from 'path'
import fs from 'fs'
```

**Rationale**: Makes it clear which imports are built-in vs external packages.

### TypeScript Conventions

#### Type Annotations

```typescript
// ✅ Good - Let TypeScript infer simple types
const name = 'auth'
const count = 42

// ✅ Good - Annotate function parameters and returns
async function create(name: string, options: FeatureOptions): Promise<void> {
  // ...
}

// ❌ Bad - Unnecessary annotations
const name: string = 'auth'
const count: number = 42
```

#### Interfaces vs Types

```typescript
// ✅ Use interfaces for object shapes
interface FeatureOptions {
  priority?: string
  phase?: string
}

// ✅ Use types for unions and complex types
type CommandStatus = 'pending' | 'running' | 'completed'

// ✅ Use types for function signatures
type CommandHandler = (name: string) => Promise<void>
```

#### Async/Await

```typescript
// ✅ Good - Use async/await
async function loadTemplate(name: string): Promise<string> {
  const content = await fs.readFile(path, 'utf-8')
  return content
}

// ❌ Bad - Don't use .then/.catch in new code
function loadTemplate(name: string): Promise<string> {
  return fs.readFile(path, 'utf-8').then(content => content)
}
```

#### Error Handling

```typescript
// ✅ Good - Specific error handling
try {
  await fs.writeFile(path, content)
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

// ❌ Bad - Silent failures
try {
  await fs.writeFile(path, content)
} catch {
  // Silent
}

// ❌ Bad - Generic error messages
try {
  await fs.writeFile(path, content)
} catch (error) {
  console.error('Error')
}
```

### Naming Conventions

#### Variables and Functions

```typescript
// ✅ camelCase for variables and functions
const featureName = 'auth'
const isValid = true

async function executeClaudeCommand(prompt: string) { }
function loadTemplate(name: string) { }

// ❌ Bad
const feature_name = 'auth'
const IsValid = true
```

#### Classes

```typescript
// ✅ PascalCase for classes
class FeatureCommand { }
class TemplateManager { }

// ❌ Bad
class featureCommand { }
```

#### Constants

```typescript
// ✅ UPPER_SNAKE_CASE for true constants
const TEMPLATES_DIR = path.join(__dirname, '../templates')
const DEFAULT_PRIORITY = 'P1'

// ✅ camelCase for config objects
const defaultOptions = {
  priority: 'P1',
  phase: 'all'
}

// ❌ Bad
const templates_dir = path.join(__dirname, '../templates')
```

#### File Paths

```typescript
// ✅ Good - Descriptive variable names
const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
const researchPath = path.join(featurePath, 'research.md')

// ❌ Bad - Generic names
const path1 = path.join(process.cwd(), '.claude/plans/features', name)
const file = path.join(path1, 'research.md')
```

## Formatting (Biome)

### Quotes

```typescript
// ✅ Single quotes for strings
const message = 'Hello, world!'

// ✅ Double quotes for JSX (if ever used)
const element = <div className="container">

// ✅ Backticks for template literals
const greeting = `Hello, ${name}!`
```

### Indentation

- **2 spaces** (not tabs)
- Consistent across all files
- Enforced by Biome

### Line Length

- **100 characters maximum**
- Break long lines intelligently
- Break after operators, not before

```typescript
// ✅ Good
const longMessage =
  'This is a very long message that exceeds the line length limit ' +
  'so we break it into multiple lines'

// ❌ Bad
const longMessage = 'This is a very long message that exceeds the line length limit so we break it'
```

### Semicolons

- **As needed** (not enforced everywhere)
- Biome adds them where required
- Consistent within each file

### Object and Array Formatting

```typescript
// ✅ Good - Short objects on one line
const options = { priority: 'P1', phase: 'all' }

// ✅ Good - Long objects on multiple lines
const config = {
  priority: 'P1',
  phase: 'all',
  verbose: true,
  interactive: false,
}

// ✅ Good - Trailing commas for multi-line
const phases = [
  'research',
  'planning',
  'implementation',
]
```

## Command Implementation Pattern

### Standard Command Structure

```typescript
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'

interface CommandOptions {
  // Define options
}

class MyCommand {
  async action(name: string, options: CommandOptions): Promise<void> {
    const spinner = ora('Starting action...').start()

    try {
      // 1. Validation
      if (!(await fs.pathExists(somePath))) {
        spinner.fail('Validation failed')
        process.exit(1)
      }

      // 2. Main logic
      spinner.text = 'Processing...'
      // ... work ...

      // 3. Success
      spinner.succeed('Action completed')

      // 4. Next steps (optional)
      console.log()
      logger.success('✨ Done!')
      console.log()
      console.log(chalk.yellow('Next steps:'))
      console.log(chalk.gray('  adk next-command'))
    } catch (error) {
      spinner.fail('Action failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const myCommand = new MyCommand()
```

### Validation Pattern

```typescript
// ✅ Good - Fail fast with helpful messages
if (!(await fs.pathExists(featurePath))) {
  spinner.fail(`Feature ${name} not found`)
  logger.info('Create it first: adk feature new <name>')
  process.exit(1)
}

// ✅ Good - Check prerequisites
const researchPath = path.join(featurePath, 'research.md')
if (!(await fs.pathExists(researchPath))) {
  spinner.fail('Research required')
  logger.info(`Run: adk feature research ${name}`)
  process.exit(1)
}
```

### Spinner Pattern

```typescript
// ✅ Good - Update spinner text as you progress
const spinner = ora('Creating feature...').start()

spinner.text = 'Creating directory structure...'
await fs.ensureDir(featurePath)

spinner.text = 'Copying templates...'
await fs.writeFile(prdPath, prdContent)

spinner.text = 'Creating git branch...'
execSync(`git checkout -b feature/${name}`, { stdio: 'ignore' })

spinner.succeed('Feature created')
```

### User Communication

```typescript
// ✅ Good - Use logger for semantic messages
logger.success('Feature created successfully')
logger.error('Failed to create feature')
logger.warn('Git not available, skipping branch creation')
logger.info('Next step: adk feature research <name>')

// ✅ Good - Use chalk for formatting
console.log(chalk.cyan('Next steps:'))
console.log(chalk.gray('  1. Edit PRD'))
console.log(chalk.gray('  2. Run research'))

// ❌ Bad - Plain console.log for everything
console.log('Feature created')
console.log('Error: Failed')
```

## Prompt Engineering

### Structured Prompt Pattern

```typescript
const prompt = `
PHASE N: DESCRIPTIVE_NAME

Input: <file paths to read>
Output: <file path to create>

Context:
- Key context point 1
- Key context point 2

Tasks:
1. Specific task with clear deliverable
2. Another specific task
3. Final task

Requirements:
- Requirement 1
- Requirement 2

IMPORTANT: Critical constraint or reminder
`
```

### Prompt Guidelines

1. **Be Explicit**: State exactly what Claude should do
2. **Provide Context**: Include relevant file paths
3. **Define Output**: Specify where to write results
4. **Number Tasks**: Make sequence clear
5. **Add Constraints**: Use IMPORTANT for critical points

```typescript
// ✅ Good - Clear structure and deliverable
const prompt = `
PHASE 1: RESEARCH

Feature: ${name}
PRD: .claude/plans/features/${name}/prd.md

Tasks:
1. Read PRD completely
2. Analyze codebase for similar components
3. List files to create and modify
4. Identify risks and dependencies

Output: .claude/plans/features/${name}/research.md

IMPORTANT: This is analysis only - do not implement yet.
`

// ❌ Bad - Vague and unstructured
const prompt = `Research the ${name} feature and write a report.`
```

## Template Conventions

### Placeholder Format

```markdown
# [Feature Name]

**Created**: YYYY-MM-DD
**Feature**: [feature-x]
```

### Replacement Pattern

```typescript
// ✅ Good - Replace all occurrences with regex
const content = template
  .replace(/\[Feature Name\]/g, name)
  .replace(/\[feature-x\]/g, kebabCase(name))
  .replace(/YYYY-MM-DD/g, new Date().toISOString().split('T')[0])

// ❌ Bad - Non-global replace (misses duplicates)
const content = template
  .replace('[Feature Name]', name)
  .replace('[feature-x]', kebabCase(name))
```

## Git Conventions

### Branch Naming

- `feature/<name>`: Feature development
- `fix/<name>`: Bug fixes
- `refactor/<name>`: Code refactoring
- `docs/<name>`: Documentation updates

### Commit Messages

Follow conventional commits:

```bash
# Format
<type>(<scope>): <description>

# Types
feat      # New feature
fix       # Bug fix
refactor  # Code refactoring (no behavior change)
test      # Add or modify tests
chore     # Maintenance tasks
docs      # Documentation only
style     # Code style (formatting, etc)
perf      # Performance improvement

# Examples
feat(workflow): add QA workflow command
fix(template): correct placeholder replacement
refactor(claude): simplify prompt generation
test(feature): add tests for research phase
chore(deps): update dependencies
docs(readme): update installation instructions
```

### Commit Scope

Use these scopes:
- `workflow`, `feature`, `agent`, `deploy`, `init`: Commands
- `claude`, `template`, `logger`: Utilities
- `cli`: CLI entry point
- `deps`: Dependencies
- `config`: Configuration files

## Testing Conventions

### Test File Structure

```typescript
import { FeatureCommand } from '../commands/feature'

describe('FeatureCommand', () => {
  describe('create', () => {
    it('should create feature directory structure', async () => {
      // Arrange
      const name = 'test-feature'

      // Act
      await featureCommand.create(name, {})

      // Assert
      expect(await fs.pathExists('.claude/plans/features/test-feature')).toBe(true)
    })

    it('should fail if feature already exists', async () => {
      // ...
    })
  })
})
```

### Test Organization

- **Arrange-Act-Assert** pattern
- One assertion per test (when possible)
- Descriptive test names (what, when, expected)
- Setup/teardown in beforeEach/afterEach

### Mocking

```typescript
// ✅ Good - Mock external dependencies
jest.mock('node:child_process', () => ({
  execSync: jest.fn()
}))

// ✅ Good - Mock file system for unit tests
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}))
```

## Documentation

### Code Comments

Use comments sparingly and only when:
- Logic is non-obvious
- Business rule needs explanation
- Complex algorithm needs breakdown

```typescript
// ✅ Good - Explains WHY
// Silently fail if git unavailable (don't block feature creation)
try {
  execSync(`git checkout -b feature/${name}`, { stdio: 'ignore' })
} catch { }

// ❌ Bad - Explains WHAT (code already says this)
// Create feature path
const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
```

### Function Documentation

```typescript
// ✅ Good - Document complex functions
/**
 * Executes a Claude Code command with the given prompt.
 * Creates a temporary file to avoid shell escaping issues.
 */
export async function executeClaudeCommand(prompt: string): Promise<string> {
  // ...
}

// ✅ Good - Simple functions don't need docs
export function getTemplateDir(): string {
  return TEMPLATES_DIR
}
```

## Error Handling

### Exit Codes

- `0`: Success
- `1`: General error (use for all errors currently)

### Error Messages

```typescript
// ✅ Good - Actionable error messages
logger.error('Feature not found')
logger.info(`Create it first: adk feature new ${name}`)

// ❌ Bad - Vague errors
logger.error('Error')
```

### Silent Failures

```typescript
// ✅ Good - Document when failures are expected
// Git not available or already on branch - this is OK
try {
  execSync(`git checkout -b feature/${name}`, { stdio: 'ignore' })
} catch { }

// ❌ Bad - Silent unexpected failures
try {
  await fs.writeFile(path, content)
} catch { }
```

## Performance

### File System Operations

```typescript
// ✅ Good - Check existence before reading
if (await fs.pathExists(path)) {
  const content = await fs.readFile(path, 'utf-8')
}

// ❌ Bad - Try/catch for flow control
try {
  const content = await fs.readFile(path, 'utf-8')
} catch {
  // File doesn't exist
}
```

### Avoid Redundant Operations

```typescript
// ✅ Good - Reuse loaded template
const template = await loadTemplate('prd-template.md')
const prd1 = template.replace(/\[Name\]/g, 'feature1')
const prd2 = template.replace(/\[Name\]/g, 'feature2')

// ❌ Bad - Load same template twice
const prd1 = (await loadTemplate('prd-template.md')).replace(/\[Name\]/g, 'feature1')
const prd2 = (await loadTemplate('prd-template.md')).replace(/\[Name\]/g, 'feature2')
```

## Security

### Path Validation

```typescript
// ✅ Good - Validate user input
const featurePath = path.join(process.cwd(), '.claude/plans/features', name)
if (!featurePath.startsWith(process.cwd())) {
  throw new Error('Invalid feature name (path traversal attempt)')
}
```

### Command Injection Prevention

```typescript
// ✅ Good - Use execSync for trusted, controlled commands
execSync(`git checkout -b feature/${sanitizedName}`, { stdio: 'ignore' })

// ⚠️ Note - Only use with validated/controlled input
// Never use execSync with unsanitized user input
```

## Review Checklist

Before committing, verify:

- [ ] Biome check passes (`npm run check`)
- [ ] Tests pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] No console.log (use logger instead)
- [ ] No secrets or tokens
- [ ] Commit message follows conventions
- [ ] Added tests for new functionality
- [ ] Updated CLAUDE.md if architecture changed
