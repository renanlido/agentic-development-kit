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
  dynamicContextRetrieval,
  ContextCache,
  extractKeywords,
  calculateRelevanceScore,
} from '../../src/utils/dynamic-context.js'
import type { RetrievalResult, RetrievalOptions } from '../../src/utils/dynamic-context.js'

describe('Dynamic Context Retrieval', () => {
  const testDir = path.join(process.cwd(), '.test-dynamic-context')
  const claudeDir = path.join(testDir, '.claude')
  const memoryDir = path.join(claudeDir, 'memory')
  const featuresDir = path.join(claudeDir, 'plans/features')
  const decisionsDir = path.join(memoryDir, 'decisions')

  beforeEach(async () => {
    await fs.ensureDir(memoryDir)
    await fs.ensureDir(featuresDir)
    await fs.ensureDir(decisionsDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  })

  describe('dynamicContextRetrieval', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(memoryDir, 'project-context.md'),
        `# Project Context

Architecture: Clean Architecture with layers
Tech Stack: Node.js, TypeScript, Jest
Patterns: Repository pattern, CQRS`
      )

      const authFeatureDir = path.join(featuresDir, 'auth')
      await fs.ensureDir(authFeatureDir)
      await fs.writeFile(
        path.join(authFeatureDir, 'memory.md'),
        `# Auth Feature Memory

Using JWT tokens for authentication
Session management with Redis
OAuth2 integration planned`
      )

      await fs.writeFile(
        path.join(decisionsDir, 'adr-001.md'),
        `# ADR-001: Use JWT for Authentication

## Context
Need stateless authentication

## Decision
Use JWT tokens with refresh tokens

## Rationale
Scalability and statelessness`
      )
    })

    it('should find relevant context for task', async () => {
      const result = await dynamicContextRetrieval('implement authentication middleware')

      expect(result.contexts.length).toBeGreaterThan(0)
    })

    it('should return contexts sorted by score', async () => {
      const result = await dynamicContextRetrieval('implement JWT authentication')

      if (result.contexts.length > 1) {
        for (let i = 1; i < result.contexts.length; i++) {
          expect(result.contexts[i - 1].score).toBeGreaterThanOrEqual(result.contexts[i].score)
        }
      }
    })

    it('should include source information', async () => {
      const result = await dynamicContextRetrieval('authentication')

      for (const ctx of result.contexts) {
        expect(ctx.source).toBeDefined()
        expect(ctx.tier).toBeDefined()
      }
    })

    it('should respect limit option', async () => {
      const options: RetrievalOptions = { limit: 2 }

      const result = await dynamicContextRetrieval('authentication', options)

      expect(result.contexts.length).toBeLessThanOrEqual(2)
    })

    it('should include total score', async () => {
      const result = await dynamicContextRetrieval('authentication')

      expect(result.totalScore).toBeGreaterThanOrEqual(0)
    })

    it('should list used sources', async () => {
      const result = await dynamicContextRetrieval('authentication')

      expect(result.usedSources).toBeDefined()
      expect(Array.isArray(result.usedSources)).toBe(true)
    })

    it('should return empty contexts when no project memory exists', async () => {
      await fs.remove(path.join(memoryDir, 'project-context.md'))
      await fs.remove(featuresDir)
      await fs.remove(decisionsDir)
      await fs.ensureDir(featuresDir)

      const result = await dynamicContextRetrieval('authentication', {
        includeTiers: ['project'],
        includeDecisions: false,
      })

      expect(result.contexts).toHaveLength(0)
    })

    it('should return empty contexts when features directory does not exist', async () => {
      await fs.remove(featuresDir)
      await fs.remove(path.join(memoryDir, 'project-context.md'))
      await fs.remove(decisionsDir)

      const result = await dynamicContextRetrieval('authentication', {
        includeTiers: ['feature'],
        includeDecisions: false,
      })

      expect(result.contexts).toHaveLength(0)
    })

    it('should return empty contexts when decisions directory does not exist', async () => {
      await fs.remove(decisionsDir)
      await fs.remove(path.join(memoryDir, 'project-context.md'))
      await fs.remove(featuresDir)
      await fs.ensureDir(featuresDir)

      const result = await dynamicContextRetrieval('authentication', {
        includeTiers: [],
        includeDecisions: true,
      })

      expect(result.contexts).toHaveLength(0)
    })

    it('should exclude project tier if not in includeTiers', async () => {
      const result = await dynamicContextRetrieval('authentication', {
        includeTiers: ['feature'],
        includeDecisions: false,
      })

      const projectContext = result.contexts.find((c) => c.tier === 'project')
      expect(projectContext).toBeUndefined()
    })

    it('should exclude decisions if includeDecisions is false', async () => {
      const result = await dynamicContextRetrieval('authentication', {
        includeTiers: ['project', 'feature'],
        includeDecisions: false,
      })

      const decisionContext = result.contexts.find((c) => c.tier === 'decision')
      expect(decisionContext).toBeUndefined()
    })

    it('should skip non-md files in decisions directory', async () => {
      await fs.writeFile(path.join(decisionsDir, 'notes.txt'), 'Some text notes')

      const result = await dynamicContextRetrieval('authentication', {
        includeTiers: [],
        includeDecisions: true,
      })

      const txtContext = result.contexts.find((c) => c.source.includes('notes.txt'))
      expect(txtContext).toBeUndefined()
    })
  })

  describe('extractKeywords', () => {
    it('should extract meaningful keywords from task', () => {
      const keywords = extractKeywords('implement user authentication with JWT tokens')

      expect(keywords).toContain('authentication')
      expect(keywords).toContain('jwt')
      expect(keywords).toContain('tokens')
    })

    it('should filter out stop words', () => {
      const keywords = extractKeywords('add the new feature to the system')

      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('to')
      expect(keywords).not.toContain('a')
    })

    it('should handle empty input', () => {
      const keywords = extractKeywords('')

      expect(keywords).toHaveLength(0)
    })

    it('should lowercase keywords', () => {
      const keywords = extractKeywords('Create NEW Feature')

      const allLowercase =
        keywords.length === 0 || keywords.every((k: string) => k === k.toLowerCase())
      expect(allLowercase).toBe(true)
    })
  })

  describe('calculateRelevanceScore', () => {
    it('should return high score for exact keyword matches', () => {
      const score = calculateRelevanceScore('authentication jwt tokens', ['authentication', 'jwt'])

      expect(score).toBeGreaterThan(50)
    })

    it('should return low score for no matches', () => {
      const score = calculateRelevanceScore('unrelated content here', ['authentication', 'jwt'])

      expect(score).toBe(0)
    })

    it('should handle partial matches', () => {
      const score = calculateRelevanceScore('auth module implementation', ['authentication'])

      expect(score).toBeGreaterThan(0)
    })

    it('should return 0 for empty keywords array', () => {
      const score = calculateRelevanceScore('some content', [])

      expect(score).toBe(0)
    })

    it('should handle whitespace-only input in extractKeywords', () => {
      const keywords = extractKeywords('   ')

      expect(keywords).toHaveLength(0)
    })
  })

  describe('ContextCache', () => {
    let cache: ContextCache

    beforeEach(() => {
      cache = new ContextCache()
    })

    it('should cache retrieval results', () => {
      const result: RetrievalResult = {
        contexts: [],
        totalScore: 50,
        usedSources: ['test.md'],
      }

      cache.set('test-task', result)
      const cached = cache.get('test-task')

      expect(cached).toMatchObject(result)
    })

    it('should return undefined for missing entries', () => {
      const cached = cache.get('nonexistent')

      expect(cached).toBeUndefined()
    })

    it('should expire entries after TTL', async () => {
      const shortCache = new ContextCache(100)
      const result: RetrievalResult = {
        contexts: [],
        totalScore: 50,
        usedSources: [],
      }

      shortCache.set('test', result)

      await new Promise((resolve) => setTimeout(resolve, 150))

      const cached = shortCache.get('test')
      expect(cached).toBeUndefined()
    })

    it('should invalidate specific patterns', () => {
      const result: RetrievalResult = {
        contexts: [],
        totalScore: 50,
        usedSources: [],
      }

      cache.set('auth-feature', result)
      cache.set('user-feature', result)

      cache.invalidate('auth')

      expect(cache.get('auth-feature')).toBeUndefined()
      expect(cache.get('user-feature')).toBeDefined()
    })

    it('should clear all entries', () => {
      const result: RetrievalResult = {
        contexts: [],
        totalScore: 50,
        usedSources: [],
      }

      cache.set('task1', result)
      cache.set('task2', result)

      cache.clear()

      expect(cache.get('task1')).toBeUndefined()
      expect(cache.get('task2')).toBeUndefined()
    })

    it('should invalidate all entries when no pattern provided', () => {
      const result: RetrievalResult = {
        contexts: [],
        totalScore: 50,
        usedSources: [],
      }

      cache.set('task1', result)
      cache.set('task2', result)

      cache.invalidate()

      expect(cache.get('task1')).toBeUndefined()
      expect(cache.get('task2')).toBeUndefined()
    })
  })
})
