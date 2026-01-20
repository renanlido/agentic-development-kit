import path from 'node:path'
import fs from 'fs-extra'
import type { AdkConfig, HooksConfig } from '../providers/types.js'
import { getAdkDir, loadConfig, saveConfig } from './config.js'
import { getClaudePath } from './git-paths.js'

export interface MigrationResult {
  success: boolean
  message: string
  migratedHooks?: HooksConfig
  error?: string
  backupPath?: string
}

interface ClaudeSettings {
  hooks?: HooksConfig
  [key: string]: unknown
}

export async function migrateHooksConfig(): Promise<MigrationResult> {
  const settingsPath = getClaudePath('settings.json')

  if (!(await fs.pathExists(settingsPath))) {
    return {
      success: true,
      message: 'settings.json not found - nothing to migrate',
    }
  }

  let settings: ClaudeSettings

  try {
    settings = await fs.readJson(settingsPath)
  } catch (error) {
    return {
      success: false,
      message: 'Failed to read settings.json',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  if (!settings.hooks || Object.keys(settings.hooks).length === 0) {
    return {
      success: true,
      message: 'No hooks found in settings.json - nothing to migrate',
    }
  }

  const backupPath = path.join(
    path.dirname(settingsPath),
    `settings.backup-${Date.now()}.json`
  )

  try {
    await fs.copy(settingsPath, backupPath)
  } catch (error) {
    return {
      success: false,
      message: 'Failed to create backup',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    await migrateHooksToAdkConfig(settings.hooks)

    return {
      success: true,
      message: 'Hooks migrated successfully',
      migratedHooks: settings.hooks,
      backupPath,
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to migrate hooks',
      error: error instanceof Error ? error.message : String(error),
      backupPath,
    }
  }
}

export async function migrateHooksToAdkConfig(hooks: HooksConfig): Promise<void> {
  const adkDir = getAdkDir()
  const configPath = path.join(adkDir, 'config.json')

  await fs.ensureDir(adkDir)

  let config: AdkConfig

  if (await fs.pathExists(configPath)) {
    config = await loadConfig()
  } else {
    config = {
      version: '1.0.0',
      integration: {
        provider: null,
        enabled: false,
        autoSync: false,
        syncOnPhaseChange: true,
        conflictStrategy: 'local-wins',
      },
      providers: {},
    }
  }

  config.hooks = hooks

  await saveConfig(config)
}
