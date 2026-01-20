import path from 'node:path'
import fs from 'fs-extra'
import { LocalProvider } from '../../src/providers/local.js'
import type { LocalFeature, ProjectProvider } from '../../src/types/provider.js'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

describe('LocalProvider', () => {
  const testDir = path.join(process.cwd(), '.test-local-provider')
  const claudeDir = path.join(testDir, '.claude')
  const featuresDir = path.join(claudeDir, 'plans', 'features')

  let provider: LocalProvider

  beforeEach(async () => {
    await fs.ensureDir(featuresDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
    provider = new LocalProvider()
  }, 10000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 10000)

  describe('interface compliance', () => {
    it('should implement ProjectProvider interface', () => {
      const asProvider: ProjectProvider = provider
      expect(asProvider.name).toBeDefined()
      expect(asProvider.displayName).toBeDefined()
      expect(typeof asProvider.isConfigured).toBe('function')
      expect(typeof asProvider.testConnection).toBe('function')
      expect(typeof asProvider.connect).toBe('function')
      expect(typeof asProvider.disconnect).toBe('function')
      expect(typeof asProvider.syncFeature).toBe('function')
    })

    it('should have name as "local"', () => {
      expect(provider.name).toBe('local')
    })

    it('should have displayName as "Local Files"', () => {
      expect(provider.displayName).toBe('Local Files')
    })
  })

  describe('isConfigured', () => {
    it('should always return true for local provider', async () => {
      const result = await provider.isConfigured()
      expect(result).toBe(true)
    })
  })

  describe('testConnection', () => {
    it('should always succeed for local provider', async () => {
      const result = await provider.testConnection()
      expect(result.success).toBe(true)
      expect(result.message).toContain('Local')
    })
  })

  describe('connect', () => {
    it('should always succeed without credentials', async () => {
      const result = await provider.connect({})
      expect(result.success).toBe(true)
    })

    it('should return success with any credentials', async () => {
      const result = await provider.connect({ token: 'any-token' })
      expect(result.success).toBe(true)
    })
  })

  describe('disconnect', () => {
    it('should complete without error', async () => {
      await expect(provider.disconnect()).resolves.not.toThrow()
    })
  })

  describe('getWorkspaces', () => {
    it('should return single local workspace', async () => {
      const workspaces = await provider.getWorkspaces()
      expect(workspaces).toHaveLength(1)
      expect(workspaces[0].id).toBe('local')
      expect(workspaces[0].name).toBe('Local')
    })
  })

  describe('getSpaces', () => {
    it('should return single local space', async () => {
      const spaces = await provider.getSpaces('local')
      expect(spaces).toHaveLength(1)
      expect(spaces[0].id).toBe('local')
    })
  })

  describe('getLists', () => {
    it('should return single local list', async () => {
      const lists = await provider.getLists('local')
      expect(lists).toHaveLength(1)
      expect(lists[0].id).toBe('local')
    })
  })

  describe('createFeature', () => {
    it('should create feature and return local representation', async () => {
      const feature: LocalFeature = {
        name: 'test-feature',
        phase: 'prd',
        progress: 0,
        lastUpdated: new Date().toISOString(),
      }

      const result = await provider.createFeature(feature)

      expect(result.id).toBe('local:test-feature')
      expect(result.name).toBe('test-feature')
      expect(result.status).toBe('prd')
      expect(result.url).toContain('test-feature')
    })
  })

  describe('updateFeature', () => {
    it('should update and return feature', async () => {
      const feature: LocalFeature = {
        name: 'test-feature',
        phase: 'prd',
        progress: 0,
        lastUpdated: new Date().toISOString(),
      }

      await provider.createFeature(feature)

      const result = await provider.updateFeature('local:test-feature', { phase: 'research' })

      expect(result.status).toBe('research')
    })
  })

  describe('getFeature', () => {
    it('should return null for non-existent feature', async () => {
      const result = await provider.getFeature('local:non-existent')
      expect(result).toBeNull()
    })

    it('should return feature when it exists', async () => {
      const featureDir = path.join(featuresDir, 'existing-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: existing-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: research
- **Next Step**: tasks

## Steps
- [x] **prd** (completed: 2026-01-15)
- [~] **research** (started: 2026-01-16)
- [ ] **tasks**
`
      )

      const result = await provider.getFeature('local:existing-feature')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('existing-feature')
    })
  })

  describe('deleteFeature', () => {
    it('should complete without error', async () => {
      await expect(provider.deleteFeature('local:test')).resolves.not.toThrow()
    })
  })

  describe('syncFeature', () => {
    it('should return synced status for local provider', async () => {
      const feature: LocalFeature = {
        name: 'sync-test',
        phase: 'prd',
        progress: 25,
        lastUpdated: new Date().toISOString(),
      }

      const result = await provider.syncFeature(feature)

      expect(result.status).toBe('synced')
      expect(result.remoteId).toBe('local:sync-test')
      expect(result.lastSynced).toBeDefined()
    })

    it('should return synced even with existing remote id', async () => {
      const feature: LocalFeature = {
        name: 'sync-test',
        phase: 'research',
        progress: 50,
        lastUpdated: new Date().toISOString(),
      }

      const result = await provider.syncFeature(feature, 'local:sync-test')

      expect(result.status).toBe('synced')
    })
  })

  describe('getRemoteChanges', () => {
    it('should return empty array for local provider', async () => {
      const changes = await provider.getRemoteChanges(new Date())
      expect(changes).toEqual([])
    })
  })

  describe('updateFeature with progress', () => {
    it('should use updates.phase when provided', async () => {
      const result = await provider.updateFeature('local:non-existent-feature', {
        phase: 'implement',
      })

      expect(result.id).toBe('local:non-existent-feature')
      expect(result.name).toBe('non-existent-feature')
      expect(result.status).toBe('implement')
    })

    it('should prefer updates.phase over existing progress', async () => {
      const featureDir = path.join(featuresDir, 'progress-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: progress-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: research

## Steps
- [x] **prd** (completed: 2026-01-15)
- [~] **research** (started: 2026-01-16)
`
      )

      const result = await provider.updateFeature('local:progress-feature', { phase: 'qa' })

      expect(result.status).toBe('qa')
      expect(result.phase).toBe('qa')
    })

    it('should use current phase from progress when no updates.phase provided', async () => {
      const featureDir = path.join(featuresDir, 'current-phase-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: current-phase-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: implement

## Steps
- [x] **prd**
- [x] **research**
- [~] **implement**
`
      )

      const result = await provider.updateFeature('local:current-phase-feature', {
        progress: 50,
      })

      expect(result.status).toBe('implement')
      expect(result.phase).toBe('implement')
    })

    it('should use not_started phase when progress file is empty', async () => {
      const featureDir = path.join(featuresDir, 'empty-progress-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(path.join(featureDir, 'progress.md'), '')

      const result = await provider.updateFeature('local:empty-progress-feature', {})

      expect(result.status).toBe('not_started')
    })
  })

  describe('getFeature with progress', () => {
    it('should return feature with phase from progress file', async () => {
      const featureDir = path.join(featuresDir, 'progress-get-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(
        path.join(featureDir, 'progress.md'),
        `# Progress: progress-get-feature

> Last updated: 2026-01-16T00:00:00.000Z

## Current State
- **Phase**: qa

## Steps
- [x] **prd** (completed: 2026-01-15)
- [x] **research**
- [x] **implement**
- [~] **qa**
`
      )

      const result = await provider.getFeature('local:progress-get-feature')

      expect(result).not.toBeNull()
      expect(result?.phase).toBe('qa')
      expect(result?.progress).toBeDefined()
    })

    it('should return feature with not_started phase for empty progress', async () => {
      const featureDir = path.join(featuresDir, 'no-progress-feature')
      await fs.ensureDir(featureDir)
      await fs.writeFile(path.join(featureDir, 'progress.md'), 'invalid content')

      const result = await provider.getFeature('local:no-progress-feature')

      expect(result).not.toBeNull()
      expect(result?.phase).toBe('not_started')
    })
  })

  describe('createLocalProvider factory', () => {
    it('should create a new LocalProvider instance', () => {
      const { createLocalProvider } = require('../../src/providers/local.js')
      const newProvider = createLocalProvider()

      expect(newProvider).toBeInstanceOf(LocalProvider)
      expect(newProvider.name).toBe('local')
      expect(newProvider.displayName).toBe('Local Files')
    })
  })
})
