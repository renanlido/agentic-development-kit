jest.mock('../../src/utils/decision-utils')

import { type Decision, DecisionCategory, type MemorySearchResult } from '../../src/types/memory'
import { listDecisions } from '../../src/utils/decision-utils'
import {
  DEFAULT_MEMORY_SEARCH_OPTIONS,
  findRelatedDecisions,
  formatSearchResult,
  formatSearchResults,
  getDecisionsByCategory,
  getMemoryStats,
  recallMemory,
  searchByTags,
} from '../../src/utils/memory-search'

const mockListDecisions = listDecisions as jest.MockedFunction<typeof listDecisions>

describe('MemorySearch', () => {
  const sampleDecisions: Decision[] = [
    {
      id: 'jwt-auth-123',
      title: 'Use JWT for Authentication',
      context: 'We need stateless authentication for our microservices',
      alternatives: ['Session tokens', 'OAuth only'],
      chosen: 'JWT with refresh tokens',
      rationale: 'JWT provides stateless auth that scales well',
      category: DecisionCategory.ARCHITECTURE,
      tags: ['security', 'auth', 'jwt'],
      relatedFeatures: ['auth-service', 'user-management'],
      createdAt: '2026-01-14T10:00:00.000Z',
      updatedAt: '2026-01-14T12:00:00.000Z',
    },
    {
      id: 'database-choice-456',
      title: 'Choose PostgreSQL as Primary Database',
      context: 'Need a robust database for complex queries',
      alternatives: ['MySQL', 'MongoDB'],
      chosen: 'PostgreSQL',
      rationale: 'Better JSON support and query performance',
      category: DecisionCategory.LIBRARY,
      tags: ['database', 'postgres', 'storage'],
      relatedFeatures: ['data-layer'],
      createdAt: '2026-01-13T10:00:00.000Z',
      updatedAt: '2026-01-14T10:00:00.000Z',
    },
    {
      id: 'code-style-789',
      title: 'Use ESLint with Prettier',
      context: 'Need consistent code formatting',
      alternatives: ['TSLint', 'Manual formatting'],
      chosen: 'ESLint with Prettier',
      rationale: 'Industry standard and good IDE support',
      category: DecisionCategory.CONVENTION,
      tags: ['tooling', 'code-quality'],
      relatedFeatures: [],
      createdAt: '2026-01-12T10:00:00.000Z',
      updatedAt: '2026-01-12T10:00:00.000Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockListDecisions.mockResolvedValue(sampleDecisions)
  })

  describe('DEFAULT_MEMORY_SEARCH_OPTIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_MEMORY_SEARCH_OPTIONS.limit).toBe(5)
      expect(DEFAULT_MEMORY_SEARCH_OPTIONS.threshold).toBe(0.3)
      expect(DEFAULT_MEMORY_SEARCH_OPTIONS.includeArchived).toBe(false)
    })
  })

  describe('recallMemory', () => {
    it('should find decisions matching query', async () => {
      const results = await recallMemory('authentication jwt')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].decision.id).toBe('jwt-auth-123')
    })

    it('should return empty array when no decisions exist', async () => {
      mockListDecisions.mockResolvedValue([])

      const results = await recallMemory('anything')

      expect(results).toEqual([])
    })

    it('should filter by threshold', async () => {
      const results = await recallMemory('completely unrelated query xyz', { threshold: 0.9 })

      expect(results.length).toBe(0)
    })

    it('should limit results', async () => {
      const results = await recallMemory('database auth', { limit: 1 })

      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should sort by score descending', async () => {
      const results = await recallMemory('jwt authentication', { threshold: 0 })

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('should match on title with high weight', async () => {
      const results = await recallMemory('JWT Authentication')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].matchedFields).toContain('title')
    })

    it('should match on tags', async () => {
      const results = await recallMemory('security', { threshold: 0.1 })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].matchedFields).toContain('tags')
    })

    it('should filter by category when provided', async () => {
      await recallMemory('test', { category: DecisionCategory.ARCHITECTURE })

      expect(mockListDecisions).toHaveBeenCalledWith(DecisionCategory.ARCHITECTURE)
    })
  })

  describe('findRelatedDecisions', () => {
    it('should find directly related decisions first', async () => {
      const results = await findRelatedDecisions('auth-service')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].score).toBe(1.0)
      expect(results[0].matchedFields).toContain('relatedFeatures')
    })

    it('should fallback to search when no direct relations', async () => {
      await findRelatedDecisions('nonexistent-feature')

      expect(mockListDecisions).toHaveBeenCalled()
    })

    it('should return all directly related decisions', async () => {
      mockListDecisions.mockResolvedValue([
        { ...sampleDecisions[0], relatedFeatures: ['shared-feature'] },
        { ...sampleDecisions[1], relatedFeatures: ['shared-feature'] },
      ])

      const results = await findRelatedDecisions('shared-feature')

      expect(results.length).toBe(2)
    })
  })

  describe('searchByTags', () => {
    it('should find decisions by tags', async () => {
      const results = await searchByTags(['security', 'auth'])

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].decision.tags).toContain('security')
    })

    it('should be case insensitive', async () => {
      const results = await searchByTags(['SECURITY'])

      expect(results.length).toBeGreaterThan(0)
    })

    it('should calculate score based on tag matches', async () => {
      const results = await searchByTags(['security', 'auth', 'jwt'])

      expect(results[0].score).toBeGreaterThan(0)
    })

    it('should limit results', async () => {
      const results = await searchByTags(['tooling', 'database', 'security'], { limit: 2 })

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should return empty for non-existent tags', async () => {
      const results = await searchByTags(['nonexistent-tag'])

      expect(results.length).toBe(0)
    })
  })

  describe('getDecisionsByCategory', () => {
    it('should filter by category', async () => {
      mockListDecisions.mockResolvedValue([sampleDecisions[0]])

      const results = await getDecisionsByCategory(DecisionCategory.ARCHITECTURE)

      expect(mockListDecisions).toHaveBeenCalledWith(DecisionCategory.ARCHITECTURE)
      expect(results.length).toBe(1)
      expect(results[0].matchedFields).toContain('category')
      expect(results[0].score).toBe(1.0)
    })
  })

  describe('getMemoryStats', () => {
    it('should calculate total decisions', async () => {
      const stats = await getMemoryStats()

      expect(stats.totalDecisions).toBe(sampleDecisions.length)
    })

    it('should group by category', async () => {
      const stats = await getMemoryStats()

      expect(stats.byCategory[DecisionCategory.ARCHITECTURE]).toBe(1)
      expect(stats.byCategory[DecisionCategory.LIBRARY]).toBe(1)
      expect(stats.byCategory[DecisionCategory.CONVENTION]).toBe(1)
    })

    it('should return recent decisions sorted by date', async () => {
      const stats = await getMemoryStats()

      expect(stats.recentDecisions[0].id).toBe('jwt-auth-123')
    })

    it('should return most linked decisions', async () => {
      const stats = await getMemoryStats()

      expect(stats.mostLinkedDecisions[0].relatedFeatures.length).toBeGreaterThanOrEqual(
        stats.mostLinkedDecisions[stats.mostLinkedDecisions.length - 1].relatedFeatures.length
      )
    })

    it('should limit recent and most linked to 5', async () => {
      mockListDecisions.mockResolvedValue([
        ...sampleDecisions,
        ...sampleDecisions,
        ...sampleDecisions,
      ])

      const stats = await getMemoryStats()

      expect(stats.recentDecisions.length).toBeLessThanOrEqual(5)
      expect(stats.mostLinkedDecisions.length).toBeLessThanOrEqual(5)
    })
  })

  describe('formatSearchResult', () => {
    it('should format single result', () => {
      const result: MemorySearchResult = {
        decision: sampleDecisions[0],
        score: 0.85,
        matchedFields: ['title', 'tags'],
      }

      const formatted = formatSearchResult(result)

      expect(formatted).toContain('Use JWT for Authentication')
      expect(formatted).toContain('85% match')
      expect(formatted).toContain('Category: architecture')
      expect(formatted).toContain('security, auth, jwt')
      expect(formatted).toContain('title, tags')
    })

    it('should handle empty tags', () => {
      const result: MemorySearchResult = {
        decision: { ...sampleDecisions[0], tags: [] },
        score: 0.5,
        matchedFields: ['title'],
      }

      const formatted = formatSearchResult(result)

      expect(formatted).toContain('Tags: none')
    })
  })

  describe('formatSearchResults', () => {
    it('should format multiple results', () => {
      const results: MemorySearchResult[] = [
        { decision: sampleDecisions[0], score: 0.9, matchedFields: ['title'] },
        { decision: sampleDecisions[1], score: 0.5, matchedFields: ['tags'] },
      ]

      const formatted = formatSearchResults(results)

      expect(formatted).toContain('Found 2 matching decision(s)')
      expect(formatted).toContain('Use JWT')
      expect(formatted).toContain('PostgreSQL')
    })

    it('should handle empty results', () => {
      const formatted = formatSearchResults([])

      expect(formatted).toBe('No matching decisions found.')
    })
  })
})
