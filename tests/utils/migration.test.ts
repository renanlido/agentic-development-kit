import path from 'node:path'
import fs from 'fs-extra'

const mockOraInstance = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: '',
}

jest.mock('ora', () => jest.fn(() => mockOraInstance))

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    white: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}))

import { migrateHooksConfig, migrateHooksToAdkConfig } from '../../src/utils/migration.js'

describe('migrateHooksConfig', () => {
  const testDir = path.join(process.cwd(), '.test-migration')
  const claudeDir = path.join(testDir, '.claude')
  const adkDir = path.join(testDir, '.adk')

  beforeEach(async () => {
    await fs.ensureDir(claudeDir)
    await fs.ensureDir(adkDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  describe('when .claude/settings.json has hooks', () => {
    const settingsWithHooks = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '.*',
            hooks: [{ type: 'command', command: 'echo test' }],
          },
        ],
        PreToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [{ type: 'script', command: './validate.sh' }],
          },
        ],
      },
      otherSetting: true,
    }

    beforeEach(async () => {
      await fs.writeJson(path.join(claudeDir, 'settings.json'), settingsWithHooks)
      await fs.writeJson(path.join(adkDir, 'config.json'), {
        version: '1.0.0',
        integration: { enabled: false, provider: null },
        providers: {},
      })
    })

    it('should read hooks from settings.json correctly', async () => {
      const result = await migrateHooksConfig()

      expect(result.success).toBe(true)
      expect(result.migratedHooks).toBeDefined()
      expect(result.migratedHooks?.UserPromptSubmit).toHaveLength(1)
      expect(result.migratedHooks?.PreToolUse).toHaveLength(1)
    })

    it('should copy hooks to .adk/config.json', async () => {
      await migrateHooksConfig()

      const config = await fs.readJson(path.join(adkDir, 'config.json'))

      expect(config.hooks).toBeDefined()
      expect(config.hooks.UserPromptSubmit).toHaveLength(1)
      expect(config.hooks.PreToolUse).toHaveLength(1)
    })

    it('should create backup of settings.json before modifying', async () => {
      await migrateHooksConfig()

      const backupFiles = await fs.readdir(claudeDir)
      const hasBackup = backupFiles.some((f) => f.startsWith('settings.backup'))

      expect(hasBackup).toBe(true)
    })

    it('should be idempotent (can run multiple times)', async () => {
      await migrateHooksConfig()
      const firstResult = await migrateHooksConfig()
      const secondResult = await migrateHooksConfig()

      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(true)

      const config = await fs.readJson(path.join(adkDir, 'config.json'))
      expect(config.hooks.UserPromptSubmit).toHaveLength(1)
    })
  })

  describe('when .claude/settings.json has no hooks', () => {
    beforeEach(async () => {
      await fs.writeJson(path.join(claudeDir, 'settings.json'), {
        otherSetting: true,
      })
    })

    it('should return success with no hooks to migrate', async () => {
      const result = await migrateHooksConfig()

      expect(result.success).toBe(true)
      expect(result.migratedHooks).toBeUndefined()
      expect(result.message).toMatch(/no hooks|nothing to migrate/i)
    })
  })

  describe('when .claude/settings.json does not exist', () => {
    it('should return success with appropriate message', async () => {
      const result = await migrateHooksConfig()

      expect(result.success).toBe(true)
      expect(result.message).toMatch(/settings.json not found|no settings/i)
    })
  })

  describe('when settings.json has invalid format', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(claudeDir, 'settings.json'), 'invalid json')
    })

    it('should handle gracefully and not break migration', async () => {
      const result = await migrateHooksConfig()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})

describe('migrateHooksToAdkConfig', () => {
  const testDir = path.join(process.cwd(), '.test-migrate-hooks')
  const adkDir = path.join(testDir, '.adk')

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  describe('when merging hooks into existing config', () => {
    const existingConfig = {
      version: '1.0.0',
      integration: {
        provider: 'clickup',
        enabled: true,
      },
      providers: {
        clickup: { workspaceId: '123' },
      },
    }

    const hooks = {
      UserPromptSubmit: [
        { matcher: '.*', hooks: [{ type: 'command' as const, command: 'echo test' }] },
      ],
    }

    beforeEach(async () => {
      await fs.writeJson(path.join(adkDir, 'config.json'), existingConfig)
    })

    it('should preserve existing config properties', async () => {
      await migrateHooksToAdkConfig(hooks)

      const config = await fs.readJson(path.join(adkDir, 'config.json'))

      expect(config.version).toBe('1.0.0')
      expect(config.integration.provider).toBe('clickup')
      expect(config.integration.enabled).toBe(true)
      expect(config.providers.clickup.workspaceId).toBe('123')
    })

    it('should add hooks to config', async () => {
      await migrateHooksToAdkConfig(hooks)

      const config = await fs.readJson(path.join(adkDir, 'config.json'))

      expect(config.hooks).toBeDefined()
      expect(config.hooks.UserPromptSubmit).toEqual(hooks.UserPromptSubmit)
    })
  })

  describe('when .adk/config.json does not exist', () => {
    it('should create new config with hooks', async () => {
      await fs.remove(path.join(adkDir, 'config.json'))

      const hooks = {
        PreToolUse: [
          { matcher: 'Write', hooks: [{ type: 'script' as const, command: './test.sh' }] },
        ],
      }

      await migrateHooksToAdkConfig(hooks)

      const exists = await fs.pathExists(path.join(adkDir, 'config.json'))
      expect(exists).toBe(true)

      const config = await fs.readJson(path.join(adkDir, 'config.json'))
      expect(config.hooks.PreToolUse).toEqual(hooks.PreToolUse)
    })
  })
})
