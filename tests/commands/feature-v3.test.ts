import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'

describe('FeatureV3Command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feature-v3-test-'))
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('status command', () => {
    it('should have feature-v3.ts file', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const exists = await fs.pathExists(featurePath)

      expect(exists).toBe(true)
    })

    it('should export featureV3Command', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('export const featureV3Command')
      expect(content).toContain('class FeatureV3Command')
    })

    it('should have status method', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('async status(name: string)')
    })

    it('should import sessionStore', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('sessionStore')
      expect(content).toContain('from \'../utils/session-store.js\'')
    })

    it('should display session information', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('Session Info:')
      expect(content).toContain('Session History:')
      expect(content).toContain('Resumable:')
    })

    it('should format session status with colors', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('formatStatus')
      expect(content).toContain('active')
      expect(content).toContain('completed')
      expect(content).toContain('interrupted')
    })
  })

  describe('Session display integration', () => {
    it('should be able to save and retrieve session data', async () => {
      const { sessionStore } = await import('../../src/utils/session-store')

      const featurePath = path.join(
        tempDir,
        '.claude', 'plans', 'features', 'display-test'
      )

      await fs.ensureDir(featurePath)

      await sessionStore.save('display-test', {
        id: 'session-display',
        claudeSessionId: 'claude-display-123',
        feature: 'display-test',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
        resumable: true,
        metadata: {
          model: 'sonnet',
          exitCode: 0,
          duration: 5000
        }
      })

      const session = await sessionStore.get('display-test')

      expect(session).not.toBeNull()
      expect(session?.claudeSessionId).toBe('claude-display-123')
      expect(session?.metadata?.model).toBe('sonnet')
    })
  })

  describe('path traversal protection', () => {
    it('should validate feature names via sessionStore', async () => {
      const { SessionStore } = await import('../../src/utils/session-store')
      const store = new SessionStore()

      const maliciousNames = ['../../../etc', '..\\..\\..\\windows', 'test/feature', 'test\\feature']

      for (const name of maliciousNames) {
        expect(() => store.getSessionsPath(name)).toThrow('Invalid feature name')
      }
    })

    it('should allow valid feature names', async () => {
      const { SessionStore } = await import('../../src/utils/session-store')
      const store = new SessionStore()

      const validNames = ['test-feature', 'test_feature', 'test123']

      for (const name of validNames) {
        expect(() => store.getSessionsPath(name)).not.toThrow()
      }
    })
  })
})
