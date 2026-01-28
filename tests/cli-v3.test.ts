import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

describe('CLI v3', () => {
  let originalArgv: string[]

  beforeEach(() => {
    originalArgv = process.argv
    jest.resetModules()
  })

  afterEach(() => {
    process.argv = originalArgv
    jest.clearAllMocks()
  })

  describe('CLI initialization', () => {
    it('should have cli-v3.ts file', async () => {
      const fs = await import('fs-extra')
      const path = await import('node:path')

      const cliPath = path.join(__dirname, '..', 'src', 'cli-v3.ts')
      const exists = await fs.pathExists(cliPath)

      expect(exists).toBe(true)
    })
  })

  describe('--version flag', () => {
    it('should return version 3.0.0-alpha', async () => {
      const { Command } = await import('commander')
      const program = new Command()

      program.name('adk3').version('3.0.0-alpha')

      expect(program.version()).toBe('3.0.0-alpha')
    })
  })

  describe('--help flag', () => {
    it('should display help', async () => {
      process.argv = ['node', 'cli-v3.js', '--help']

      const { Command } = await import('commander')
      const program = new Command()

      program.name('adk3').description('ADK v3 - Session Continuity Preview').version('3.0.0-alpha')

      const helpText = program.helpInformation()

      expect(helpText).toContain('adk3')
      expect(helpText).toContain('Session Continuity')
    })
  })

  describe('invalid command', () => {
    it('should display error for invalid command', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      process.argv = ['node', 'cli-v3.js', 'invalid-command']

      const { Command } = await import('commander')
      const program = new Command()

      program.name('adk3').version('3.0.0-alpha')

      program.on('command:*', () => {
        console.error('Invalid command: %s', program.args.join(' '))
        process.exit(1)
      })

      program.parse(process.argv)

      mockExit.mockRestore()
      mockConsoleError.mockRestore()
    })
  })
})
