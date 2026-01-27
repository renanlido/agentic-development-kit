import { describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'

describe('V3 Isolation', () => {
  const projectRoot = path.join(__dirname, '..')

  describe('cli.ts should not be modified', () => {
    it('should verify cli.ts exists', async () => {
      const cliPath = path.join(projectRoot, 'src', 'cli.ts')
      const exists = await fs.pathExists(cliPath)

      expect(exists).toBe(true)
    })

    it('should not import v3 modules in cli.ts', async () => {
      const cliPath = path.join(projectRoot, 'src', 'cli.ts')
      const content = await fs.readFile(cliPath, 'utf-8')

      expect(content).not.toContain('cli-v3')
      expect(content).not.toContain('feature-v3')
      expect(content).not.toContain('session-store')
      expect(content).not.toContain('claude-v3')
    })
  })

  describe('feature.ts should not be modified', () => {
    it('should verify feature.ts exists', async () => {
      const featurePath = path.join(projectRoot, 'src', 'commands', 'feature.ts')
      const exists = await fs.pathExists(featurePath)

      expect(exists).toBe(true)
    })

    it('should not import v3 modules in feature.ts', async () => {
      const featurePath = path.join(projectRoot, 'src', 'commands', 'feature.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).not.toContain('feature-v3')
      expect(content).not.toContain('session-store')
      expect(content).not.toContain('claude-v3')
    })
  })

  describe('v2 and v3 can coexist', () => {
    it('should have separate CLI entry points', async () => {
      const v2Cli = path.join(projectRoot, 'src', 'cli.ts')
      const v3Cli = path.join(projectRoot, 'src', 'cli-v3.ts')

      const v2Exists = await fs.pathExists(v2Cli)
      const v3Exists = await fs.pathExists(v3Cli)

      expect(v2Exists).toBe(true)
      expect(v3Exists).toBe(true)
    })

    it('should have separate feature commands', async () => {
      const v2Feature = path.join(projectRoot, 'src', 'commands', 'feature.ts')
      const v3Feature = path.join(projectRoot, 'src', 'commands', 'feature-v3.ts')

      const v2Exists = await fs.pathExists(v2Feature)
      const v3Exists = await fs.pathExists(v3Feature)

      expect(v2Exists).toBe(true)
      expect(v3Exists).toBe(true)
    })
  })
})
