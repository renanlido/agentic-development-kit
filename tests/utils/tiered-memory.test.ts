import path from 'node:path'
import fs from 'fs-extra'

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}))

import {
  loadMemoryHierarchy,
  flattenHierarchy,
  calculateFreshnessScore,
  SessionMemoryCache,
} from '../../src/utils/tiered-memory.js'
import type { MemoryTier, TieredMemory, MemoryHierarchy } from '../../src/types/context.js'

describe('Tiered Memory System', () => {
  const testDir = path.join(process.cwd(), '.test-tiered-memory')
  const claudeDir = path.join(testDir, '.claude')
  const memoryDir = path.join(claudeDir, 'memory')
  const featuresDir = path.join(claudeDir, 'plans/features')

  beforeEach(async () => {
    await fs.ensureDir(memoryDir)
    await fs.ensureDir(featuresDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  describe('loadMemoryHierarchy', () => {
    describe('when all levels exist', () => {
      beforeEach(async () => {
        await fs.writeFile(
          path.join(memoryDir, 'project-context.md'),
          '# Project Memory\n\nProject level context'
        )

        const featureDir = path.join(featuresDir, 'test-feature')
        await fs.ensureDir(featureDir)
        await fs.writeFile(
          path.join(featureDir, 'memory.md'),
          '# Feature Memory\n\nFeature level context'
        )

        const phaseDir = path.join(featureDir, 'implement')
        await fs.ensureDir(phaseDir)
        await fs.writeFile(path.join(phaseDir, 'memory.md'), '# Phase Memory\n\nPhase level context')
      })

      it('should load project memory', async () => {
        const hierarchy = await loadMemoryHierarchy()

        expect(hierarchy.project).toBeDefined()
        expect(hierarchy.project!.tier).toBe('project')
        expect(hierarchy.project!.content).toContain('Project level context')
      })

      it('should load feature memory when feature specified', async () => {
        const hierarchy = await loadMemoryHierarchy('test-feature')

        expect(hierarchy.feature).toBeDefined()
        expect(hierarchy.feature?.tier).toBe('feature')
        expect(hierarchy.feature?.content).toContain('Feature level context')
      })

      it('should load phase memory when feature and phase specified', async () => {
        const hierarchy = await loadMemoryHierarchy('test-feature', 'implement')

        expect(hierarchy.phase).toBeDefined()
        expect(hierarchy.phase?.tier).toBe('phase')
        expect(hierarchy.phase?.content).toContain('Phase level context')
      })

      it('should include metadata for each level', async () => {
        const hierarchy = await loadMemoryHierarchy('test-feature')

        expect(hierarchy.project).toBeDefined()
        expect(hierarchy.project!.metadata).toBeDefined()
        expect(hierarchy.project!.metadata.lineCount).toBeGreaterThan(0)
        expect(hierarchy.project!.metadata.updatedAt).toBeDefined()
        expect(hierarchy.project!.metadata.freshnessScore).toBeGreaterThanOrEqual(0)
        expect(hierarchy.project!.metadata.freshnessScore).toBeLessThanOrEqual(100)
      })
    })

    describe('when some levels are missing', () => {
      beforeEach(async () => {
        await fs.writeFile(
          path.join(memoryDir, 'project-context.md'),
          '# Project Memory\n\nProject only'
        )
      })

      it('should load available levels only', async () => {
        const hierarchy = await loadMemoryHierarchy('nonexistent-feature')

        expect(hierarchy.project).toBeDefined()
        expect(hierarchy.feature).toBeUndefined()
        expect(hierarchy.phase).toBeUndefined()
      })

      it('should work without feature memory', async () => {
        const featureDir = path.join(featuresDir, 'test-feature')
        await fs.ensureDir(featureDir)

        const hierarchy = await loadMemoryHierarchy('test-feature')

        expect(hierarchy.project).toBeDefined()
        expect(hierarchy.feature).toBeUndefined()
      })

      it('should load feature but not phase when phase memory does not exist', async () => {
        const featureDir = path.join(featuresDir, 'test-feature')
        await fs.ensureDir(featureDir)
        await fs.writeFile(
          path.join(featureDir, 'memory.md'),
          '# Feature Memory\n\nFeature content'
        )

        const phaseDir = path.join(featureDir, 'implement')
        await fs.ensureDir(phaseDir)

        const hierarchy = await loadMemoryHierarchy('test-feature', 'implement')

        expect(hierarchy.feature).toBeDefined()
        expect(hierarchy.phase).toBeUndefined()
      })
    })

    describe('when no project memory exists', () => {
      it('should return empty hierarchy with session only', async () => {
        const hierarchy = await loadMemoryHierarchy()

        expect(hierarchy.project).toBeUndefined()
        expect(hierarchy.session).toBeDefined()
      })
    })
  })

  describe('flattenHierarchy', () => {
    it('should combine all levels into single context', () => {
      const hierarchy: MemoryHierarchy = {
        project: createTieredMemory('project', 'Project content'),
        feature: createTieredMemory('feature', 'Feature content'),
        phase: createTieredMemory('phase', 'Phase content'),
        session: { entries: [], lastUpdated: new Date().toISOString() },
      }

      const flattened = flattenHierarchy(hierarchy)

      expect(flattened).toContain('Project content')
      expect(flattened).toContain('Feature content')
      expect(flattened).toContain('Phase content')
    })

    it('should prioritize session over phase over feature over project', () => {
      const hierarchy: MemoryHierarchy = {
        project: createTieredMemory('project', 'KEY: project-value'),
        feature: createTieredMemory('feature', 'KEY: feature-value'),
        session: { entries: [], lastUpdated: new Date().toISOString() },
      }

      const flattened = flattenHierarchy(hierarchy)

      expect(flattened.indexOf('feature-value')).toBeLessThan(flattened.indexOf('project-value'))
    })

    it('should handle hierarchy with only project level', () => {
      const hierarchy: MemoryHierarchy = {
        project: createTieredMemory('project', 'Only project'),
        session: { entries: [], lastUpdated: new Date().toISOString() },
      }

      const flattened = flattenHierarchy(hierarchy)

      expect(flattened).toContain('Only project')
    })

    it('should deduplicate identical content', () => {
      const hierarchy: MemoryHierarchy = {
        project: createTieredMemory('project', 'Same content\nUnique project'),
        feature: createTieredMemory('feature', 'Same content\nUnique feature'),
        session: { entries: [], lastUpdated: new Date().toISOString() },
      }

      const flattened = flattenHierarchy(hierarchy)
      const sameContentCount = (flattened.match(/Same content/g) || []).length

      expect(sameContentCount).toBe(1)
    })

    it('should include session entries when present', () => {
      const hierarchy: MemoryHierarchy = {
        project: createTieredMemory('project', 'Project content'),
        session: {
          entries: [
            { key: 'session-key', content: 'Session content here', timestamp: new Date().toISOString(), usageCount: 1 },
          ],
          lastUpdated: new Date().toISOString(),
        },
      }

      const flattened = flattenHierarchy(hierarchy)

      expect(flattened).toContain('Session content here')
    })

    it('should handle empty lines in content', () => {
      const hierarchy: MemoryHierarchy = {
        project: createTieredMemory('project', 'Line one\n\nLine three'),
        session: { entries: [], lastUpdated: new Date().toISOString() },
      }

      const flattened = flattenHierarchy(hierarchy)

      expect(flattened).toContain('Line one')
      expect(flattened).toContain('Line three')
    })

    it('should handle hierarchy with only session', () => {
      const hierarchy: MemoryHierarchy = {
        session: {
          entries: [
            { key: 'only-session', content: 'Only session content', timestamp: new Date().toISOString(), usageCount: 0 },
          ],
          lastUpdated: new Date().toISOString(),
        },
      }

      const flattened = flattenHierarchy(hierarchy)

      expect(flattened).toContain('Only session content')
    })
  })

  describe('calculateFreshnessScore', () => {
    it('should return 100 for just updated content', () => {
      const now = new Date().toISOString()
      const score = calculateFreshnessScore(now)

      expect(score).toBeGreaterThanOrEqual(95)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should decay score over time', () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const score = calculateFreshnessScore(oneWeekAgo)

      expect(score).toBeLessThan(100)
      expect(score).toBeGreaterThan(0)
    })

    it('should return minimum score for very old content', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      const score = calculateFreshnessScore(oneYearAgo)

      expect(score).toBeLessThanOrEqual(10)
    })
  })

  describe('SessionMemoryCache', () => {
    let cache: SessionMemoryCache

    beforeEach(() => {
      cache = new SessionMemoryCache()
    })

    it('should store and retrieve entries', () => {
      cache.add('key1', 'Test content')

      const entry = cache.get('key1')

      expect(entry).toBeDefined()
      expect(entry?.content).toBe('Test content')
    })

    it('should return undefined for missing keys', () => {
      const entry = cache.get('nonexistent')

      expect(entry).toBeUndefined()
    })

    it('should track usage count on access', () => {
      cache.add('key1', 'Content')

      cache.get('key1')
      cache.get('key1')
      cache.get('key1')

      const entry = cache.get('key1')

      expect(entry?.usageCount).toBe(4)
    })

    it('should list all entries', () => {
      cache.add('key1', 'Content 1')
      cache.add('key2', 'Content 2')

      const entries = cache.listEntries()

      expect(entries).toHaveLength(2)
    })

    it('should clear all entries', () => {
      cache.add('key1', 'Content 1')
      cache.add('key2', 'Content 2')

      cache.clear()

      expect(cache.listEntries()).toHaveLength(0)
    })

    it('should flush to file path', async () => {
      cache.add('key1', 'Content to persist')

      const flushPath = path.join(testDir, 'session-flush.md')
      await cache.flush(flushPath)

      const exists = await fs.pathExists(flushPath)
      expect(exists).toBe(true)

      const content = await fs.readFile(flushPath, 'utf-8')
      expect(content).toContain('Content to persist')
    })

    it('should not write file when flushing empty cache', async () => {
      const flushPath = path.join(testDir, 'empty-flush.md')

      await cache.flush(flushPath)

      const exists = await fs.pathExists(flushPath)
      expect(exists).toBe(false)
    })
  })
})

function createTieredMemory(tier: MemoryTier, content: string): TieredMemory {
  return {
    tier,
    content,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lineCount: content.split('\n').length,
      freshnessScore: 100,
      relevanceScore: 50,
      usageCount: 0,
    },
  }
}
