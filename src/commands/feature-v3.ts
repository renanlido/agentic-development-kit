import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { logger } from '../utils/logger.js'
import { sessionStore } from '../utils/session-store.js'

class FeatureV3Command {
  private validateFeatureName(name: string): void {
    if (/[/\\]|\.\./.test(name)) {
      throw new Error(`Invalid feature name: ${name}`)
    }
  }

  async status(name: string): Promise<void> {
    const spinner = ora(`Loading status for ${name}...`).start()

    try {
      this.validateFeatureName(name)

      const featurePath = path.join(process.cwd(), '.claude', 'plans', 'features', name)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${name}" not found`)
        process.exit(1)
      }

      spinner.succeed(`Feature: ${chalk.cyan(name)}`)

      const currentSession = await sessionStore.get(name)
      const sessions = await sessionStore.list(name)
      const isResumable = await sessionStore.isResumable(name)

      console.log()
      console.log(chalk.bold('Session Info:'))

      if (currentSession) {
        console.log(`  Current: ${chalk.green(currentSession.id)}`)
        console.log(`  Claude ID: ${currentSession.claudeSessionId || chalk.gray('N/A')}`)
        console.log(`  Status: ${this.formatStatus(currentSession.status)}`)
        console.log(`  Resumable: ${isResumable ? chalk.green('Yes') : chalk.red('No')}`)
        console.log(`  Last Activity: ${this.formatDate(currentSession.lastActivity)}`)

        if (currentSession.metadata?.model) {
          console.log(`  Model: ${currentSession.metadata.model}`)
        }
      } else {
        console.log(chalk.gray('  No active session'))
      }

      console.log()
      console.log(chalk.bold('Session History:'))

      if (sessions.length === 0) {
        console.log(chalk.gray('  No sessions recorded'))
      } else {
        const recent = sessions.slice(0, 5)
        for (const session of recent) {
          const status = this.formatStatus(session.status)
          const date = this.formatDate(session.startedAt)
          console.log(`  ${session.id} | ${status} | ${date}`)
        }

        if (sessions.length > 5) {
          console.log(chalk.gray(`  ... and ${sessions.length - 5} more`))
        }
      }
    } catch (error) {
      spinner.fail('Error loading status')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'active':
        return chalk.green('active')
      case 'completed':
        return chalk.blue('completed')
      case 'interrupted':
        return chalk.yellow('interrupted')
      default:
        return chalk.gray(status)
    }
  }

  private formatDate(isoDate: string): string {
    const date = new Date(isoDate)
    return date.toLocaleString()
  }
}

export const featureV3Command = new FeatureV3Command()
