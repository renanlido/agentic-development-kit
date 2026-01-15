jest.mock('node:fs/promises')

import fs from 'node:fs/promises'
import { type Decision, DecisionCategory } from '../../src/types/memory'
import {
  createDecision,
  deleteDecision,
  ensureDecisionsDir,
  listDecisions,
  loadDecision,
  saveDecision,
  updateDecisionFeatures,
} from '../../src/utils/decision-utils'

// biome-ignore lint/suspicious/noExplicitAny: Jest mock requires any type for fs module
const mockFs = fs as any

describe('DecisionUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createDecision', () => {
    it('should create decision with all fields', () => {
      const decision = createDecision(
        'Use JWT for Authentication',
        'We need to authenticate users in a stateless manner',
        ['Session tokens', 'OAuth only', 'JWT'],
        'JWT',
        'JWT allows stateless auth and works well with microservices',
        DecisionCategory.ARCHITECTURE,
        ['security', 'auth']
      )

      expect(decision.title).toBe('Use JWT for Authentication')
      expect(decision.context).toBe('We need to authenticate users in a stateless manner')
      expect(decision.alternatives).toEqual(['Session tokens', 'OAuth only', 'JWT'])
      expect(decision.chosen).toBe('JWT')
      expect(decision.rationale).toBe('JWT allows stateless auth and works well with microservices')
      expect(decision.category).toBe(DecisionCategory.ARCHITECTURE)
      expect(decision.tags).toEqual(['security', 'auth'])
      expect(decision.id).toBeDefined()
      expect(decision.createdAt).toBeDefined()
      expect(decision.updatedAt).toBeDefined()
      expect(decision.relatedFeatures).toEqual([])
    })

    it('should create decision with default empty tags', () => {
      const decision = createDecision(
        'Choose Database',
        'Need a database',
        ['PostgreSQL', 'MySQL'],
        'PostgreSQL',
        'Better for complex queries',
        DecisionCategory.LIBRARY
      )

      expect(decision.tags).toEqual([])
    })

    it('should generate id based on title slug', () => {
      const decision = createDecision(
        'Test Title Here',
        '',
        [],
        '',
        '',
        DecisionCategory.ARCHITECTURE
      )

      expect(decision.id).toContain('test-title-here')
      expect(decision.id).toMatch(/^test-title-here-[a-z0-9]+$/)
    })

    it('should handle title with special characters', () => {
      const decision = createDecision(
        'Use @angular/core v15!',
        'context',
        [],
        'chosen',
        'rationale',
        DecisionCategory.LIBRARY
      )

      expect(decision.id).toMatch(/^use-angular-core-v15-[a-z0-9]+$/)
    })
  })

  describe('ensureDecisionsDir', () => {
    it('should create decisions directory', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)

      await ensureDecisionsDir()

      expect(mockFs.mkdir).toHaveBeenCalledWith('.claude/memory/decisions', { recursive: true })
    })
  })

  describe('saveDecision', () => {
    it('should save decision to file', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const decision: Decision = {
        id: 'test-decision-123',
        title: 'Test Decision',
        context: 'Test context',
        alternatives: ['Option A', 'Option B'],
        chosen: 'Option A',
        rationale: 'Better performance',
        category: DecisionCategory.LIBRARY,
        tags: ['test'],
        relatedFeatures: ['auth'],
        createdAt: '2026-01-14T10:00:00.000Z',
        updatedAt: '2026-01-14T10:00:00.000Z',
      }

      await saveDecision(decision)

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-decision-123.md'),
        expect.stringContaining('Test Decision'),
        'utf-8'
      )
    })

    it('should generate id if not provided', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const decision: Decision = {
        id: '',
        title: 'New Decision',
        context: 'context',
        alternatives: [],
        chosen: 'option',
        rationale: 'reason',
        category: DecisionCategory.ARCHITECTURE,
        tags: [],
        relatedFeatures: [],
        createdAt: '',
        updatedAt: '',
      }

      await saveDecision(decision)

      expect(decision.id).toContain('new-decision')
    })

    it('should set createdAt if not provided', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const decision: Decision = {
        id: 'test-id',
        title: 'Test',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.PATTERN,
        tags: [],
        relatedFeatures: [],
        createdAt: '',
        updatedAt: '',
      }

      await saveDecision(decision)

      expect(decision.createdAt).toBeDefined()
      expect(decision.updatedAt).toBeDefined()
    })

    it('should update updatedAt on save', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const decision: Decision = {
        id: 'test-id',
        title: 'Test',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.CONVENTION,
        tags: [],
        relatedFeatures: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }

      await saveDecision(decision)

      expect(new Date(decision.updatedAt).getTime()).toBeGreaterThan(
        new Date('2026-01-01T00:00:00.000Z').getTime()
      )
    })
  })

  describe('loadDecision', () => {
    it('should load decision from file', async () => {
      const fileContent = `---
id: test-id
title: "Test Decision"
category: architecture
tags: ["tag1", "tag2"]
relatedFeatures: ["feature1"]
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Test Decision

## Context
This is the context

## Alternatives Considered
- Option A
- Option B

## Decision
Option A

## Rationale
Better choice
`

      mockFs.readFile.mockResolvedValue(fileContent)

      const decision = await loadDecision('test-id')

      expect(decision).not.toBeNull()
      expect(decision?.id).toBe('test-id')
      expect(decision?.title).toBe('Test Decision')
      expect(decision?.category).toBe('architecture')
      expect(decision?.tags).toEqual(['tag1', 'tag2'])
      expect(decision?.alternatives).toEqual(['Option A', 'Option B'])
    })

    it('should return null if file not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'))

      const decision = await loadDecision('nonexistent')

      expect(decision).toBeNull()
    })

    it('should return null if frontmatter is invalid', async () => {
      mockFs.readFile.mockResolvedValue('No frontmatter here')

      const decision = await loadDecision('invalid')

      expect(decision).toBeNull()
    })
  })

  describe('listDecisions', () => {
    it('should list all decisions', async () => {
      const fileContent = `---
id: decision-1
title: "Decision 1"
category: architecture
tags: []
relatedFeatures: []
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T11:00:00.000Z
---

# Decision 1

## Context
Context

## Alternatives Considered
- A

## Decision
A

## Rationale
Reason
`
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue(['decision-1.md', 'decision-2.md'])
      mockFs.readFile.mockResolvedValue(fileContent)

      const decisions = await listDecisions()

      expect(decisions.length).toBeGreaterThan(0)
    })

    it('should filter by category', async () => {
      const architectureContent = `---
id: arch-1
title: "Architecture Decision"
category: architecture
tags: []
relatedFeatures: []
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Architecture Decision

## Context
Context

## Alternatives Considered
- A

## Decision
A

## Rationale
Reason
`
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue(['arch-1.md'])
      mockFs.readFile.mockResolvedValue(architectureContent)

      const decisions = await listDecisions(DecisionCategory.ARCHITECTURE)

      expect(decisions.length).toBe(1)
      expect(decisions[0].category).toBe(DecisionCategory.ARCHITECTURE)
    })

    it('should skip non-md files', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue(['decision.md', 'readme.txt', '.gitkeep'])
      mockFs.readFile.mockResolvedValue(`---
id: test
title: "Test"
category: architecture
tags: []
relatedFeatures: []
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Test

## Context
Context

## Alternatives Considered

## Decision
D

## Rationale
R
`)

      await listDecisions()

      expect(mockFs.readFile).toHaveBeenCalledTimes(1)
    })

    it('should return empty array on error', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'))

      const decisions = await listDecisions()

      expect(decisions).toEqual([])
    })

    it('should sort by updatedAt descending', async () => {
      const olderContent = `---
id: older
title: "Older"
category: architecture
tags: []
relatedFeatures: []
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Older

## Context
C

## Alternatives Considered

## Decision
D

## Rationale
R
`
      const newerContent = `---
id: newer
title: "Newer"
category: architecture
tags: []
relatedFeatures: []
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-15T10:00:00.000Z
---

# Newer

## Context
C

## Alternatives Considered

## Decision
D

## Rationale
R
`
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.readdir.mockResolvedValue(['older.md', 'newer.md'])
      mockFs.readFile.mockResolvedValueOnce(olderContent).mockResolvedValueOnce(newerContent)

      const decisions = await listDecisions()

      expect(decisions[0].id).toBe('newer')
    })
  })

  describe('deleteDecision', () => {
    it('should delete decision file', async () => {
      mockFs.unlink.mockResolvedValue(undefined)

      const result = await deleteDecision('test-id')

      expect(result).toBe(true)
      expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining('test-id.md'))
    })

    it('should return false if delete fails', async () => {
      mockFs.unlink.mockRejectedValue(new Error('ENOENT'))

      const result = await deleteDecision('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('updateDecisionFeatures', () => {
    it('should add feature to decision', async () => {
      const fileContent = `---
id: test-id
title: "Test"
category: architecture
tags: []
relatedFeatures: []
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Test

## Context
C

## Alternatives Considered

## Decision
D

## Rationale
R
`
      mockFs.readFile.mockResolvedValue(fileContent)
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const result = await updateDecisionFeatures('test-id', 'auth', 'add')

      expect(result).toBe(true)
      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should not add duplicate feature', async () => {
      const fileContent = `---
id: test-id
title: "Test"
category: architecture
tags: []
relatedFeatures: ["auth"]
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Test

## Context
C

## Alternatives Considered

## Decision
D

## Rationale
R
`
      mockFs.readFile.mockResolvedValue(fileContent)
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const result = await updateDecisionFeatures('test-id', 'auth', 'add')

      expect(result).toBe(true)
    })

    it('should remove feature from decision', async () => {
      const fileContent = `---
id: test-id
title: "Test"
category: architecture
tags: []
relatedFeatures: ["auth", "login"]
createdAt: 2026-01-14T10:00:00.000Z
updatedAt: 2026-01-14T10:00:00.000Z
---

# Test

## Context
C

## Alternatives Considered

## Decision
D

## Rationale
R
`
      mockFs.readFile.mockResolvedValue(fileContent)
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const result = await updateDecisionFeatures('test-id', 'auth', 'remove')

      expect(result).toBe(true)
    })

    it('should return false if decision not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'))

      const result = await updateDecisionFeatures('nonexistent', 'auth', 'add')

      expect(result).toBe(false)
    })
  })
})
