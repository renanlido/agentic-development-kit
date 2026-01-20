import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { createClickUpProvider } from '../providers/clickup/index.js'
import type { ProviderSpecificConfig } from '../providers/types.js'
import {
  getIntegrationConfig,
  loadConfig,
  setProviderConfig,
  updateIntegrationConfig,
} from '../utils/config.js'
import { getMainRepoPath } from '../utils/paths.js'

interface ConfigOptions {
  disable?: boolean
  show?: boolean
}

const SUPPORTED_PROVIDERS = ['clickup'] as const
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]

export class ConfigCommand {
  private getEnvPath(): string {
    return path.join(getMainRepoPath(), '.env')
  }

  private async readEnvFile(): Promise<Map<string, string>> {
    const envPath = this.getEnvPath()
    const env = new Map<string, string>()

    if (await fs.pathExists(envPath)) {
      const content = await fs.readFile(envPath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=')
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex)
            const value = trimmed.slice(eqIndex + 1)
            env.set(key, value)
          }
        }
      }
    }

    return env
  }

  private async writeEnvFile(env: Map<string, string>): Promise<void> {
    const envPath = this.getEnvPath()
    const lines: string[] = []

    for (const [key, value] of env) {
      lines.push(`${key}=${value}`)
    }

    await fs.writeFile(envPath, `${lines.join('\n')}\n`)
  }

  private async saveTokenToEnv(provider: string, token: string): Promise<void> {
    const env = await this.readEnvFile()
    const key = `${provider.toUpperCase()}_API_TOKEN`
    env.set(key, token)
    await this.writeEnvFile(env)
  }

  private async getTokenFromEnv(provider: string): Promise<string | null> {
    const env = await this.readEnvFile()
    const key = `${provider.toUpperCase()}_API_TOKEN`
    return env.get(key) || null
  }

  private maskToken(token: string): string {
    if (!token || token.length < 10) {
      return 'pk_****'
    }
    return `${token.slice(0, 3)}${'*'.repeat(Math.min(token.length - 3, 20))}`
  }

  private validateTokenFormat(token: string, provider: string): boolean {
    if (provider === 'clickup') {
      return token.startsWith('pk_')
    }
    return true
  }

  private isSupportedProvider(provider: string): provider is SupportedProvider {
    return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)
  }

  async integration(provider: string | undefined, options: ConfigOptions): Promise<void> {
    if (options.show) {
      await this.showConfig()
      return
    }

    if (options.disable) {
      await this.disableIntegration()
      return
    }

    if (!provider) {
      throw new Error('Provider name is required. Example: adk config integration clickup')
    }

    if (!this.isSupportedProvider(provider)) {
      throw new Error(
        `Provider "${provider}" is not supported. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`
      )
    }

    await this.configureProvider(provider)
  }

  private async configureProvider(provider: SupportedProvider): Promise<void> {
    const spinner = ora('Configuring integration...').start()

    try {
      spinner.stop()

      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: `Enter your ${provider} API token:`,
          mask: '*',
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Token is required'
            }
            return true
          },
        },
      ])

      if (!this.validateTokenFormat(token, provider)) {
        throw new Error(
          `Invalid token format for ${provider}. Token must start with "pk_" (Personal Token)`
        )
      }

      spinner.start('Validating credentials...')

      const providerInstance = this.createProviderInstance(provider)
      const connectionResult = await providerInstance.connect({ token })

      if (!connectionResult.success) {
        throw new Error(`Connection failed: ${connectionResult.message}`)
      }

      spinner.succeed('Credentials validated')

      const workspaces = connectionResult.workspaces || []
      if (workspaces.length === 0) {
        throw new Error('No workspaces found. Please check your token permissions.')
      }

      spinner.stop()

      const { workspaceId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'workspaceId',
          message: 'Select a workspace:',
          choices: workspaces.map((ws) => ({
            name: ws.name,
            value: ws.id,
          })),
        },
      ])

      spinner.start('Loading spaces...')
      const spaces = await providerInstance.getSpaces(workspaceId)
      spinner.stop()

      if (spaces.length === 0) {
        throw new Error('No spaces found in this workspace.')
      }

      const { spaceId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'spaceId',
          message: 'Select a space:',
          choices: spaces.map((sp) => ({
            name: sp.name,
            value: sp.id,
          })),
        },
      ])

      spinner.start('Loading lists...')
      const lists = await providerInstance.getLists(spaceId)
      spinner.stop()

      if (lists.length === 0) {
        throw new Error('No lists found in this space.')
      }

      const { listId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'listId',
          message: 'Select a default list for features:',
          choices: lists.map((l) => ({
            name: l.taskCount ? `${l.name} (${l.taskCount} tasks)` : l.name,
            value: l.id,
          })),
        },
      ])

      const { autoSync } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'autoSync',
          message: 'Enable automatic sync when creating/updating features?',
          default: false,
        },
      ])

      spinner.start('Saving configuration...')

      await this.saveTokenToEnv(provider, token)

      const providerConfig: ProviderSpecificConfig = {
        workspaceId,
        spaceId,
        listId,
      }

      await setProviderConfig(provider, providerConfig)

      await updateIntegrationConfig({
        provider,
        enabled: true,
        autoSync,
      })

      spinner.succeed('Configuration saved')

      console.log()
      console.log(chalk.green('✅ Integration configured successfully!'))
      console.log()
      console.log(chalk.cyan('Next steps:'))
      console.log(chalk.gray(`  1. Run: adk feature new <name>`))
      console.log(chalk.gray(`     Your features will be synced to ${provider}`))
      console.log()
      console.log(chalk.gray(`To disable: adk config integration --disable`))
      console.log(chalk.gray(`To view config: adk config integration --show`))
    } catch (error) {
      spinner.fail('Configuration failed')
      throw error
    }
  }

  private createProviderInstance(provider: SupportedProvider) {
    switch (provider) {
      case 'clickup':
        return createClickUpProvider()
      default:
        throw new Error(`No provider implementation for ${provider}`)
    }
  }

  private async showConfig(): Promise<void> {
    const config = await loadConfig()
    const integration = await getIntegrationConfig()

    if (!integration.provider) {
      console.log(chalk.yellow('No integration configured.'))
      console.log()
      console.log(chalk.gray('To configure: adk config integration <provider>'))
      console.log(chalk.gray(`Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`))
      return
    }

    const token = await this.getTokenFromEnv(integration.provider)
    const providerConfig = config.providers[integration.provider]

    console.log()
    console.log(chalk.bold.cyan('Current Integration Configuration'))
    console.log(chalk.gray('─'.repeat(40)))
    console.log()
    console.log(`  ${chalk.white('Provider:')}     ${integration.provider}`)
    console.log(
      `  ${chalk.white('Status:')}       ${integration.enabled ? chalk.green('enabled') : chalk.red('disabled')}`
    )
    console.log(`  ${chalk.white('Auto Sync:')}    ${integration.autoSync ? 'Yes' : 'No'}`)
    console.log(
      `  ${chalk.white('Sync on Phase:')} ${integration.syncOnPhaseChange ? 'Yes' : 'No'}`
    )
    console.log(`  ${chalk.white('Conflict:')}     ${integration.conflictStrategy}`)
    console.log()

    if (providerConfig) {
      console.log(chalk.bold('Provider Settings:'))
      console.log(`  ${chalk.white('Workspace ID:')} ${providerConfig.workspaceId || 'Not set'}`)
      console.log(`  ${chalk.white('Space ID:')}     ${providerConfig.spaceId || 'Not set'}`)
      console.log(`  ${chalk.white('List ID:')}      ${providerConfig.listId || 'Not set'}`)
      console.log()
    }

    if (token) {
      console.log(`  ${chalk.white('Token:')}        ${this.maskToken(token)}`)
    }

    console.log()
  }

  private async disableIntegration(): Promise<void> {
    const integration = await getIntegrationConfig()

    if (!integration.provider) {
      console.log(chalk.yellow('No integration configured.'))
      return
    }

    await updateIntegrationConfig({ enabled: false })

    console.log(chalk.green('✅ Integration disabled.'))
    console.log()
    console.log(chalk.gray('Your configuration is preserved. Re-enable with:'))
    console.log(chalk.gray(`  adk config integration ${integration.provider}`))
  }
}

export const configCommand = new ConfigCommand()
