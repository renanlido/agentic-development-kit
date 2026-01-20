import path from 'node:path'
import fs from 'fs-extra'
import type { AdkConfig } from '../../src/providers/types.js'

const mockPrompt = jest.fn()

jest.mock('inquirer', () => {
  return {
    __esModule: true,
    default: {
      prompt: (...args: unknown[]) => mockPrompt(...args),
    },
  }
})

const mockOraStart = jest.fn()
const mockOraStop = jest.fn()
const mockOraSucceed = jest.fn()
const mockOraFail = jest.fn()
const mockOraInstance = {
  start: mockOraStart.mockReturnThis(),
  stop: mockOraStop.mockReturnThis(),
  succeed: mockOraSucceed.mockReturnThis(),
  fail: mockOraFail.mockReturnThis(),
  text: '',
}

jest.mock('ora', () => {
  return jest.fn(() => mockOraInstance)
})

jest.mock('chalk', () => {
  const bold = Object.assign((s: string) => s, { cyan: (s: string) => s })
  return {
    __esModule: true,
    default: {
      cyan: (s: string) => s,
      green: (s: string) => s,
      yellow: (s: string) => s,
      red: (s: string) => s,
      gray: (s: string) => s,
      white: (s: string) => s,
      bold,
    },
  }
})

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

const mockConnect = jest.fn()
const mockTestConnection = jest.fn()
const mockGetWorkspaces = jest.fn()
const mockGetSpaces = jest.fn()
const mockGetLists = jest.fn()
const mockDisconnect = jest.fn()

jest.mock('../../src/providers/clickup/index.js', () => ({
  ClickUpProvider: jest.fn().mockImplementation(() => ({
    name: 'clickup',
    displayName: 'ClickUp',
    connect: mockConnect,
    testConnection: mockTestConnection,
    getWorkspaces: mockGetWorkspaces,
    getSpaces: mockGetSpaces,
    getLists: mockGetLists,
    disconnect: mockDisconnect,
  })),
  createClickUpProvider: jest.fn(() => ({
    name: 'clickup',
    displayName: 'ClickUp',
    connect: mockConnect,
    testConnection: mockTestConnection,
    getWorkspaces: mockGetWorkspaces,
    getSpaces: mockGetSpaces,
    getLists: mockGetLists,
    disconnect: mockDisconnect,
  })),
}))

import { ConfigCommand } from '../../src/commands/config.js'

describe('ConfigCommand', () => {
  const testDir = path.join(process.cwd(), '.test-config-cmd')
  const adkDir = path.join(testDir, '.adk')
  const configPath = path.join(adkDir, 'config.json')
  const envPath = path.join(testDir, '.env')

  let configCommand: ConfigCommand

  beforeEach(async () => {
    await fs.ensureDir(adkDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    mockPrompt.mockReset()
    mockOraStart.mockClear()
    mockOraSucceed.mockClear()
    mockOraFail.mockClear()
    mockConnect.mockReset()
    mockTestConnection.mockReset()
    mockGetWorkspaces.mockReset()
    mockGetSpaces.mockReset()
    mockGetLists.mockReset()
    mockDisconnect.mockReset()

    configCommand = new ConfigCommand()
  }, 15000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 15000)

  describe('integration()', () => {
    describe('when provider is "clickup"', () => {
      it('should prompt for token and validate connection', async () => {
        const token = 'pk_test_token_12345'

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Workspace 1' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space 1' }])
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List 1', taskCount: 5 }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: true })

        await configCommand.integration('clickup', {})

        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'token',
              type: 'password',
            }),
          ])
        )
        expect(mockConnect).toHaveBeenCalledWith({ token })
      }, 15000)

      it('should validate token format starts with pk_', async () => {
        const invalidToken = 'invalid_token'

        mockPrompt.mockResolvedValueOnce({ token: invalidToken })

        await expect(configCommand.integration('clickup', {})).rejects.toThrow(/invalid/i)

        expect(mockConnect).not.toHaveBeenCalled()
      })

      it('should accept valid token format starting with pk_', async () => {
        const validToken = 'pk_valid_token_abc123'

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Test Workspace' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Test Space' }])
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'Test List' }])

        mockPrompt
          .mockResolvedValueOnce({ token: validToken })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: false })

        await configCommand.integration('clickup', {})

        expect(mockConnect).toHaveBeenCalledWith({ token: validToken })
      })

      it('should prompt for workspace selection', async () => {
        const token = 'pk_test_123'
        const workspaces = [
          { id: 'ws-1', name: 'Workspace 1' },
          { id: 'ws-2', name: 'Workspace 2' },
        ]

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces,
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space 1' }])
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List 1' }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: false })

        await configCommand.integration('clickup', {})

        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'workspaceId',
              type: 'list',
              choices: expect.arrayContaining([
                expect.objectContaining({ value: 'ws-1' }),
                expect.objectContaining({ value: 'ws-2' }),
              ]),
            }),
          ])
        )
      })

      it('should prompt for space selection after workspace', async () => {
        const token = 'pk_test_123'
        const spaces = [
          { id: 'sp-1', name: 'Engineering' },
          { id: 'sp-2', name: 'Marketing' },
        ]

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Workspace' }],
        })
        mockGetSpaces.mockResolvedValue(spaces)
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List 1' }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: false })

        await configCommand.integration('clickup', {})

        expect(mockGetSpaces).toHaveBeenCalledWith('ws-1')
        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'spaceId',
              type: 'list',
            }),
          ])
        )
      })

      it('should prompt for list selection after space', async () => {
        const token = 'pk_test_123'
        const lists = [
          { id: 'list-1', name: 'Features', taskCount: 10 },
          { id: 'list-2', name: 'Bugs', taskCount: 5 },
        ]

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Workspace' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
        mockGetLists.mockResolvedValue(lists)

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: true })

        await configCommand.integration('clickup', {})

        expect(mockGetLists).toHaveBeenCalledWith('sp-1')
        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'listId',
              type: 'list',
            }),
          ])
        )
      })

      it('should save configuration to .adk/config.json', async () => {
        const token = 'pk_test_save_123'

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-save', name: 'Save Workspace' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-save', name: 'Save Space' }])
        mockGetLists.mockResolvedValue([{ id: 'list-save', name: 'Save List' }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-save' })
          .mockResolvedValueOnce({ spaceId: 'sp-save' })
          .mockResolvedValueOnce({ listId: 'list-save' })
          .mockResolvedValueOnce({ autoSync: true })

        await configCommand.integration('clickup', {})

        expect(await fs.pathExists(configPath)).toBe(true)

        const savedConfig: AdkConfig = await fs.readJson(configPath)
        expect(savedConfig.integration.provider).toBe('clickup')
        expect(savedConfig.integration.enabled).toBe(true)
        expect(savedConfig.providers.clickup?.workspaceId).toBe('ws-save')
        expect(savedConfig.providers.clickup?.spaceId).toBe('sp-save')
        expect(savedConfig.providers.clickup?.listId).toBe('list-save')
      })

      it('should save token to .env file', async () => {
        const token = 'pk_test_env_token'

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Workspace' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List' }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: false })

        await configCommand.integration('clickup', {})

        expect(await fs.pathExists(envPath)).toBe(true)

        const envContent = await fs.readFile(envPath, 'utf-8')
        expect(envContent).toContain('CLICKUP_API_TOKEN')
        expect(envContent).toContain(token)
      })

      it('should not save token in config.json', async () => {
        const token = 'pk_secret_token_12345'

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Workspace' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List' }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: false })

        await configCommand.integration('clickup', {})

        const configContent = await fs.readFile(configPath, 'utf-8')
        expect(configContent).not.toContain(token)
        expect(configContent).not.toContain('pk_')
      })

      it('should fail if connection test fails', async () => {
        const token = 'pk_bad_token'

        mockConnect.mockResolvedValue({
          success: false,
          message: 'Invalid token',
        })

        mockPrompt.mockResolvedValueOnce({ token })

        await expect(configCommand.integration('clickup', {})).rejects.toThrow()

        expect(await fs.pathExists(configPath)).toBe(false)
      })

      it('should show success message after configuration', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const token = 'pk_success_token'

        mockConnect.mockResolvedValue({
          success: true,
          message: 'Connected',
          workspaces: [{ id: 'ws-1', name: 'Workspace' }],
        })
        mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
        mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List' }])

        mockPrompt
          .mockResolvedValueOnce({ token })
          .mockResolvedValueOnce({ workspaceId: 'ws-1' })
          .mockResolvedValueOnce({ spaceId: 'sp-1' })
          .mockResolvedValueOnce({ listId: 'list-1' })
          .mockResolvedValueOnce({ autoSync: false })

        await configCommand.integration('clickup', {})

        expect(mockOraSucceed).toHaveBeenCalled()
        consoleSpy.mockRestore()
      })
    })

    describe('when --disable flag is used', () => {
      it('should disable integration', async () => {
        const existingConfig: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: true,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-1',
              spaceId: 'sp-1',
              listId: 'list-1',
            },
          },
        }

        await fs.writeJson(configPath, existingConfig, { spaces: 2 })

        await configCommand.integration(undefined, { disable: true })

        const updatedConfig: AdkConfig = await fs.readJson(configPath)
        expect(updatedConfig.integration.enabled).toBe(false)
      })

      it('should preserve provider configuration when disabling', async () => {
        const existingConfig: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: true,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-preserve',
              spaceId: 'sp-preserve',
              listId: 'list-preserve',
            },
          },
        }

        await fs.writeJson(configPath, existingConfig, { spaces: 2 })

        await configCommand.integration(undefined, { disable: true })

        const updatedConfig: AdkConfig = await fs.readJson(configPath)
        expect(updatedConfig.providers.clickup?.workspaceId).toBe('ws-preserve')
        expect(updatedConfig.integration.provider).toBe('clickup')
      })

      it('should show message when no integration is configured', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await configCommand.integration(undefined, { disable: true })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+integration/i)
        consoleSpy.mockRestore()
      })
    })

    describe('when --show flag is used', () => {
      it('should display current configuration', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        const existingConfig: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: true,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-show',
              spaceId: 'sp-show',
              listId: 'list-show',
            },
          },
        }

        await fs.writeJson(configPath, existingConfig, { spaces: 2 })
        await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_secret_show_token')

        await configCommand.integration(undefined, { show: true })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toContain('clickup')
        expect(allCalls.toLowerCase()).toContain('enabled')
        consoleSpy.mockRestore()
      })

      it('should mask token in output', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        const existingConfig: AdkConfig = {
          version: '1.0.0',
          integration: {
            provider: 'clickup',
            enabled: true,
            autoSync: false,
            syncOnPhaseChange: true,
            conflictStrategy: 'local-wins',
          },
          providers: {
            clickup: {
              workspaceId: 'ws-mask',
            },
          },
        }

        await fs.writeJson(configPath, existingConfig, { spaces: 2 })
        await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_12345678_secrettoken')

        await configCommand.integration(undefined, { show: true })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls).not.toContain('pk_12345678_secrettoken')
        expect(allCalls).toMatch(/pk_\*+/i)

        consoleSpy.mockRestore()
      })

      it('should show message when no integration is configured', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await configCommand.integration(undefined, { show: true })

        const allCalls = consoleSpy.mock.calls.flat().join(' ')
        expect(allCalls.toLowerCase()).toMatch(/no.+integration/i)
        consoleSpy.mockRestore()
      })
    })

    describe('error handling', () => {
      it('should handle network errors gracefully', async () => {
        const token = 'pk_network_error'

        mockPrompt.mockResolvedValueOnce({ token })
        mockConnect.mockRejectedValue(new Error('Network error'))

        await expect(configCommand.integration('clickup', {})).rejects.toThrow(/network/i)
      })

      it('should handle unknown provider', async () => {
        await expect(configCommand.integration('unknown-provider', {})).rejects.toThrow(
          /not supported/i
        )
      })
    })
  })

  describe('edge cases', () => {
    it('should append to existing .env file', async () => {
      await fs.writeFile(envPath, 'EXISTING_VAR=value\n')

      const token = 'pk_append_token'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [{ id: 'ws-1', name: 'Workspace' }],
      })
      mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
      mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List' }])

      mockPrompt
        .mockResolvedValueOnce({ token })
        .mockResolvedValueOnce({ workspaceId: 'ws-1' })
        .mockResolvedValueOnce({ spaceId: 'sp-1' })
        .mockResolvedValueOnce({ listId: 'list-1' })
        .mockResolvedValueOnce({ autoSync: false })

      await configCommand.integration('clickup', {})

      const envContent = await fs.readFile(envPath, 'utf-8')
      expect(envContent).toContain('EXISTING_VAR=value')
      expect(envContent).toContain('CLICKUP_API_TOKEN')
    })

    it('should update existing token in .env file', async () => {
      await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_old_token\nOTHER_VAR=value\n')

      const token = 'pk_new_token'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [{ id: 'ws-1', name: 'Workspace' }],
      })
      mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
      mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List' }])

      mockPrompt
        .mockResolvedValueOnce({ token })
        .mockResolvedValueOnce({ workspaceId: 'ws-1' })
        .mockResolvedValueOnce({ spaceId: 'sp-1' })
        .mockResolvedValueOnce({ listId: 'list-1' })
        .mockResolvedValueOnce({ autoSync: false })

      await configCommand.integration('clickup', {})

      const envContent = await fs.readFile(envPath, 'utf-8')
      expect(envContent).toContain('pk_new_token')
      expect(envContent).not.toContain('pk_old_token')
      expect(envContent).toContain('OTHER_VAR=value')
    })

    it('should prompt for autoSync preference', async () => {
      const token = 'pk_autosync_test'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [{ id: 'ws-1', name: 'Workspace' }],
      })
      mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
      mockGetLists.mockResolvedValue([{ id: 'list-1', name: 'List' }])

      mockPrompt
        .mockResolvedValueOnce({ token })
        .mockResolvedValueOnce({ workspaceId: 'ws-1' })
        .mockResolvedValueOnce({ spaceId: 'sp-1' })
        .mockResolvedValueOnce({ listId: 'list-1' })
        .mockResolvedValueOnce({ autoSync: true })

      await configCommand.integration('clickup', {})

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'autoSync',
            type: 'confirm',
          }),
        ])
      )

      const savedConfig: AdkConfig = await fs.readJson(configPath)
      expect(savedConfig.integration.autoSync).toBe(true)
    })

    it('should throw error when no workspaces found', async () => {
      const token = 'pk_no_workspaces'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [],
      })

      mockPrompt.mockResolvedValueOnce({ token })

      await expect(configCommand.integration('clickup', {})).rejects.toThrow(/no.*workspaces/i)
    })

    it('should throw error when no spaces found', async () => {
      const token = 'pk_no_spaces'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [{ id: 'ws-1', name: 'Workspace' }],
      })
      mockGetSpaces.mockResolvedValue([])

      mockPrompt.mockResolvedValueOnce({ token }).mockResolvedValueOnce({ workspaceId: 'ws-1' })

      await expect(configCommand.integration('clickup', {})).rejects.toThrow(/no.*spaces/i)
    })

    it('should throw error when no lists found', async () => {
      const token = 'pk_no_lists'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [{ id: 'ws-1', name: 'Workspace' }],
      })
      mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
      mockGetLists.mockResolvedValue([])

      mockPrompt
        .mockResolvedValueOnce({ token })
        .mockResolvedValueOnce({ workspaceId: 'ws-1' })
        .mockResolvedValueOnce({ spaceId: 'sp-1' })

      await expect(configCommand.integration('clickup', {})).rejects.toThrow(/no.*lists/i)
    })

    it('should throw error when provider is not provided', async () => {
      await expect(configCommand.integration(undefined, {})).rejects.toThrow(/provider.*required/i)
    })

    it('should display list with taskCount when available', async () => {
      const token = 'pk_list_count'

      mockConnect.mockResolvedValue({
        success: true,
        message: 'Connected',
        workspaces: [{ id: 'ws-1', name: 'Workspace' }],
      })
      mockGetSpaces.mockResolvedValue([{ id: 'sp-1', name: 'Space' }])
      mockGetLists.mockResolvedValue([
        { id: 'list-1', name: 'Features', taskCount: 10 },
        { id: 'list-2', name: 'Empty List', taskCount: 0 },
      ])

      mockPrompt
        .mockResolvedValueOnce({ token })
        .mockResolvedValueOnce({ workspaceId: 'ws-1' })
        .mockResolvedValueOnce({ spaceId: 'sp-1' })
        .mockResolvedValueOnce({ listId: 'list-1' })
        .mockResolvedValueOnce({ autoSync: false })

      await configCommand.integration('clickup', {})

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'listId',
            choices: expect.arrayContaining([
              expect.objectContaining({ name: 'Features (10 tasks)' }),
            ]),
          }),
        ])
      )
    })

    it('should mask short tokens correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const existingConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {
          clickup: { workspaceId: 'ws-1' },
        },
      }

      await fs.writeJson(configPath, existingConfig, { spaces: 2 })
      await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_short')

      await configCommand.integration(undefined, { show: true })

      const allCalls = consoleSpy.mock.calls.flat().join(' ')
      expect(allCalls).toMatch(/pk_\*+/i)

      consoleSpy.mockRestore()
    })

    it('should mask very short tokens with default mask', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const existingConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {
          clickup: { workspaceId: 'ws-1' },
        },
      }

      await fs.writeJson(configPath, existingConfig, { spaces: 2 })
      await fs.writeFile(envPath, 'CLICKUP_API_TOKEN=pk_')

      await configCommand.integration(undefined, { show: true })

      const allCalls = consoleSpy.mock.calls.flat().join(' ')
      expect(allCalls).toContain('pk_****')

      consoleSpy.mockRestore()
    })

    it('should show disabled status in show config', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const existingConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: false,
          autoSync: false,
          syncOnPhaseChange: true,
          conflictStrategy: 'local-wins',
        },
        providers: {
          clickup: { workspaceId: 'ws-1' },
        },
      }

      await fs.writeJson(configPath, existingConfig, { spaces: 2 })

      await configCommand.integration(undefined, { show: true })

      const allCalls = consoleSpy.mock.calls.flat().join(' ')
      expect(allCalls.toLowerCase()).toContain('disabled')

      consoleSpy.mockRestore()
    })

    it('should show provider config details when available', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const existingConfig: AdkConfig = {
        version: '1.0.0',
        integration: {
          provider: 'clickup',
          enabled: true,
          autoSync: true,
          syncOnPhaseChange: false,
          conflictStrategy: 'remote-wins',
        },
        providers: {
          clickup: {
            workspaceId: 'ws-detail',
            spaceId: 'sp-detail',
            listId: 'list-detail',
          },
        },
      }

      await fs.writeJson(configPath, existingConfig, { spaces: 2 })

      await configCommand.integration(undefined, { show: true })

      const allCalls = consoleSpy.mock.calls.flat().join(' ')
      expect(allCalls).toContain('ws-detail')
      expect(allCalls).toContain('sp-detail')
      expect(allCalls).toContain('list-detail')

      consoleSpy.mockRestore()
    })
  })
})
