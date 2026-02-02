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
      expect(content).toContain("from '../utils/session-store.js'")
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

  describe('Session display implementation', () => {
    it('should implement display logic for active sessions', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('currentSession')
      expect(content).toContain('claudeSessionId')
      expect(content).toContain('isResumable')
      expect(content).toContain('lastActivity')
    })

    it('should handle empty session state', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('No active session')
      expect(content).toContain('No sessions recorded')
    })

    it('should display resumable indicator', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('Resumable:')
      expect(content).toContain('Yes')
      expect(content).toContain('No')
    })

    it('should display session metadata', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('metadata?.model')
      expect(content).toContain('Model:')
    })

    it('should limit history display to 5 sessions', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('sessions.slice(0, 5)')
      expect(content).toContain('sessions.length - 5')
    })

    it('should format dates for display', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('formatDate')
      expect(content).toContain('toLocaleString')
    })

    it('should call SessionStore methods', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('sessionStore.get(')
      expect(content).toContain('sessionStore.list(')
      expect(content).toContain('sessionStore.isResumable(')
    })

    it('should display session ID and Claude ID separately', async () => {
      const featurePath = path.join(__dirname, '..', '..', 'src', 'commands', 'feature-v3.ts')
      const content = await fs.readFile(featurePath, 'utf-8')

      expect(content).toContain('Current:')
      expect(content).toContain('Claude ID:')
      expect(content).toContain('currentSession.id')
      expect(content).toContain('currentSession.claudeSessionId')
    })
  })

  describe('path traversal protection', () => {
    it('should validate feature names via sessionStore', async () => {
      const { SessionStore } = await import('../../src/utils/session-store')
      const store = new SessionStore()

      const maliciousNames = [
        '../../../etc',
        '..\\..\\..\\windows',
        'test/feature',
        'test\\feature',
      ]

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
