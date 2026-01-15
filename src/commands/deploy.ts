import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude'
import { logger } from '../utils/logger'

interface ProductionOptions {
  percentage: string
}

class DeployCommand {
  async staging(feature: string): Promise<void> {
    const spinner = ora('Deploying to staging...').start()

    try {
      const prompt = `
DEPLOYMENT: Staging

Feature: ${feature}

Tasks:

1. Merge to staging branch
2. Trigger CI/CD pipeline
3. Monitor deployment:
   - Build logs
   - Deploy logs
   - Health checks
4. Execute smoke tests:
   - Critical paths working?
   - No errors in logs?
   - Metrics normal?
5. Validation period: Wait 10 minutes

Report status and any issues found.

If issues: Recommend immediate rollback
If success: Clear for production deployment
`

      await executeClaudeCommand(prompt)

      spinner.succeed('Deployed to staging')

      console.log()
      logger.success('✨ Staging deployment concluído')
      console.log()
      console.log(chalk.yellow('Próximo passo:'))
      console.log(chalk.gray(`  adk deploy production ${feature}`))
    } catch (error) {
      spinner.fail('Staging deployment failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async production(feature: string, options: ProductionOptions): Promise<void> {
    const spinner = ora('Preparando production deployment...').start()

    try {
      // Confirm
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Deploy ${feature} para produção?`,
          default: false,
        },
      ])

      if (!answers.confirmed) {
        spinner.stop()
        logger.warn('Deployment cancelado')
        return
      }

      const percentage = Number.parseInt(options.percentage, 10)

      const prompt = `
PHASE 7: PRODUCTION DEPLOYMENT

Feature: ${feature}
Strategy: Feature flag gradual rollout
Initial percentage: ${percentage}%

## Step 1: Deploy code (flag OFF)
- Deploy to production
- Feature flag: enabled=false
- Verify: health checks passing
- Wait: 10 minutes

## Step 2: ${percentage}% rollout
- Feature flag: rollout_percentage=${percentage}
- Monitor metrics:
  * Error rate
  * Latency (p50, p95, p99)
  * Business metrics
- Duration: 1 hour
- Check: every 10 minutes

Report each step status.

## Monitoring Dashboards
- Error rates (target: <0.5%)
- Latencies (target: p95 <100ms)
- Throughput
- Business KPIs

## Rollback Criteria
Immediate rollback if:
- Error rate > 2%
- Latency p95 > 300ms
- Critical bug reported

If any rollback criteria met: STOP and ROLLBACK immediately.
`

      spinner.text = 'Deploying to production...'
      await executeClaudeCommand(prompt)

      spinner.succeed('Production deployment iniciado')

      console.log()
      logger.success(`✨ Deployment ${percentage}% iniciado`)
      console.log()
      console.log(chalk.yellow('Monitorar por 1h antes de aumentar percentage'))
      console.log()
      console.log(chalk.cyan('Para aumentar:'))
      console.log(chalk.gray(`  adk deploy production ${feature} --percentage 50`))
    } catch (error) {
      spinner.fail('Production deployment failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async rollback(feature: string): Promise<void> {
    const spinner = ora('Iniciando rollback...').start()

    try {
      // Confirm
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.red(`ROLLBACK de ${feature}?`),
          default: false,
        },
      ])

      if (!answers.confirmed) {
        spinner.stop()
        logger.warn('Rollback cancelado')
        return
      }

      const prompt = `
🚨 EMERGENCY ROLLBACK

Feature: ${feature}

Immediate actions:
1. Disable feature flag (set enabled=false)
2. Verify traffic returns to normal
3. Check error rates drop
4. Monitor for 15 minutes

Post-rollback:
1. Analyze what went wrong
2. Document incident in .claude/incidents/
3. Create post-mortem
4. List action items

Execute rollback NOW and report status.
`

      spinner.text = 'Rolling back...'
      await executeClaudeCommand(prompt)

      spinner.succeed('Rollback concluído')

      console.log()
      logger.success('✅ Rollback executado')
      console.log()
      console.log(chalk.yellow('Próximos passos:'))
      console.log(chalk.gray('  1. Analisar incident report'))
      console.log(chalk.gray('  2. Fixar issues'))
      console.log(chalk.gray('  3. Redeploy quando pronto'))
    } catch (error) {
      spinner.fail('Rollback failed')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const deployCommand = new DeployCommand()
