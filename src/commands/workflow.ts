import { execSync } from 'node:child_process'
import chalk from 'chalk'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'
import { memoryCommand } from './memory'

class WorkflowCommand {
  async daily(): Promise<void> {
    const spinner = ora('Executando daily workflow...').start()

    try {
      const date = new Date().toISOString().split('T')[0]

      const prompt = `
🌅 Daily Workflow

1. Review git log desde ontem
2. Identifique work in progress
3. Update .claude/memory/project-context.md:
   - Current focus
   - Recent changes
   - Known issues
4. List pending tasks

Output: .claude/daily/${date}.md

Format:
# Daily: ${date}

## Yesterday
[O que foi feito]

## Today
[O que vai ser feito]

## Blockers
[Se houver]

## WIP
[Features em andamento]
`

      await executeClaudeCommand(prompt)

      spinner.succeed('Daily workflow concluído')

      console.log()
      logger.success(`Daily notes: .claude/daily/${date}.md`)
    } catch (error) {
      spinner.fail('Erro no daily workflow')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async preCommit(): Promise<void> {
    const spinner = ora('Executando pre-commit checks...').start()

    try {
      const prompt = `
🔍 Pre-commit Review

Analyze staged files:
\`git diff --cached --name-only\`

Check for:
- console.log/debugger
- TODO/FIXME críticos
- Secrets hardcoded
- Missing tests
- Code smells

If issues found: LIST them and STOP
If clean: Say "✅ Pre-commit checks passed"
`

      spinner.text = 'Analisando staged files...'
      await executeClaudeCommand(prompt)

      // Run tests
      spinner.text = 'Executando testes...'
      try {
        execSync('npm test', { stdio: 'pipe' })
      } catch (_error) {
        spinner.fail('Testes falharam')
        process.exit(1)
      }

      spinner.succeed('Pre-commit checks passed')
    } catch (error) {
      spinner.fail('Pre-commit checks failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async preDeploy(options: { feature?: string }): Promise<void> {
    const spinner = ora('Executando pre-deploy checklist...').start()

    try {
      const feature = options.feature || 'all'

      const prompt = `
PHASE 6: PRE-DEPLOYMENT VALIDATION

Feature: ${feature}

Run complete pre-deployment checklist:

## 1. Tests
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load tests

## 2. Code Quality
- [ ] Lint
- [ ] Format
- [ ] TypeScript
- [ ] No console.logs
- [ ] No TODOs críticos

## 3. Security
- [ ] npm audit
- [ ] No secrets
- [ ] Auth implemented
- [ ] Input validation

## 4. Documentation
- [ ] API docs
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Runbook exists

## 5. Configuration
- [ ] Env vars documented
- [ ] Feature flag configured

## 6. Monitoring
- [ ] Metrics defined
- [ ] Dashboards created
- [ ] Alerts configured

Generate: .claude/plans/features/${feature}/pre-deploy-report.md

Include:
- Checklist status
- Blockers (if any)
- Go/No-go recommendation

If ANY critical item fails: DO NOT PROCEED
`

      await executeClaudeCommand(prompt)

      spinner.succeed('Pre-deploy checklist concluído')

      if (feature !== 'all') {
        try {
          await memoryCommand.save(feature, { phase: 'deploy' })
        } catch {
          logger.warn('Memoria nao salva automaticamente')
        }
      }

      console.log()
      logger.success(
        `Report: ${chalk.cyan(`.claude/plans/features/${feature}/pre-deploy-report.md`)}`
      )
    } catch (error) {
      spinner.fail('Pre-deploy checks failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async qa(feature: string): Promise<void> {
    const spinner = ora('Executando QA completo...').start()

    try {
      const prompt = `
PHASE 4: QUALITY ASSURANCE

Feature: ${feature}

Tasks:

1. Code Quality
   - Run: npm run lint
   - Run: npm run format
   - Fix all issues
   - Commit: 'chore: lint and format'

2. Test Coverage
   - Run: npm test -- --coverage
   - Analyze coverage
   - Target: >= 80% all layers

3. Performance Testing
   - Load test scenarios
   - Validate targets:
     * p95 < 100ms
     * p99 < 200ms
     * Error rate < 0.1%

4. Security Audit
   - Run: npm audit
   - Fix critical vulnerabilities
   - Check injections
   - Verify auth/authz

5. Code Review (Self)
   - Review all modified files
   - Check patterns
   - Remove debug code
   - Check TODOs

Output: .claude/plans/features/${feature}/qa-report.md

Structure:
# QA Report: ${feature}

## Code Quality ✅/❌
[Results]

## Test Coverage ✅/❌
[Results]

## Performance ✅/❌
[Results]

## Security ✅/❌
[Results]

## Ready for Deploy? ✅/❌
`

      await executeClaudeCommand(prompt)

      spinner.succeed('QA concluído')

      try {
        await memoryCommand.save(feature, { phase: 'qa' })
      } catch {
        logger.warn('Memoria nao salva automaticamente')
      }

      console.log()
      logger.success(`QA Report: ${chalk.cyan(`.claude/plans/features/${feature}/qa-report.md`)}`)
    } catch (error) {
      spinner.fail('QA failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const workflowCommand = new WorkflowCommand()
