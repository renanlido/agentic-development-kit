const createChainableMock = () => {
  const fn = (s: string) => s
  const proxy = new Proxy(fn, {
    get: () => proxy,
    apply: (_target, _thisArg, args) => args[0],
  })
  return proxy
}

jest.mock('chalk', () => {
  const mock = createChainableMock()
  return {
    __esModule: true,
    default: mock,
    blue: mock,
    green: mock,
    yellow: mock,
    red: mock,
    cyan: mock,
    gray: mock,
    bold: mock,
    dim: mock,
  }
})

jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
  }))
})

jest.mock('fs-extra')

import fs from 'fs-extra'
import { memoryCommand } from '../../src/commands/memory'

jest.mock('../../src/utils/claude', () => ({
  executeClaudeCommand: jest.fn().mockResolvedValue(''),
}))

jest.mock('../../src/utils/memory-search', () => ({
  recallMemory: jest.fn().mockResolvedValue([]),
  formatSearchResults: jest.fn().mockReturnValue('No results'),
  getMemoryStats: jest.fn().mockResolvedValue({
    totalDecisions: 0,
    byCategory: {},
    recentDecisions: [],
    mostLinkedDecisions: [],
  }),
}))

jest.mock('../../src/utils/decision-utils', () => ({
  loadDecision: jest.fn().mockResolvedValue(null),
  updateDecisionFeatures: jest.fn().mockResolvedValue(true),
  listDecisions: jest.fn().mockResolvedValue([]),
}))

import { DecisionCategory } from '../../src/types/memory'
import { listDecisions, loadDecision, updateDecisionFeatures } from '../../src/utils/decision-utils'
import { formatSearchResults, getMemoryStats, recallMemory } from '../../src/utils/memory-search'

const mockRecallMemory = recallMemory as jest.MockedFunction<typeof recallMemory>
const mockFormatSearchResults = formatSearchResults as jest.MockedFunction<
  typeof formatSearchResults
>
const mockLoadDecision = loadDecision as jest.MockedFunction<typeof loadDecision>
const mockUpdateDecisionFeatures = updateDecisionFeatures as jest.MockedFunction<
  typeof updateDecisionFeatures
>
const mockListDecisions = listDecisions as jest.MockedFunction<typeof listDecisions>
const mockGetMemoryStats = getMemoryStats as jest.MockedFunction<typeof getMemoryStats>

describe('MemoryCommand', () => {
  const originalCwd = process.cwd
  const mockCwd = '/test/project'
  // biome-ignore lint/suspicious/noExplicitAny: Jest mock requires any type for fs-extra
  const mockFs = fs as any

  beforeEach(() => {
    jest.clearAllMocks()
    process.cwd = jest.fn().mockReturnValue(mockCwd)
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    process.cwd = originalCwd
    jest.restoreAllMocks()
  })

  describe('save', () => {
    it('should create memory file for new feature', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('memory.md')) {
          return false
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should fail if feature directory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.save('nonexistent')).rejects.toThrow('process.exit')
    })

    it('should update existing memory file', async () => {
      const existingContent = `# Memoria: auth

**Ultima Atualizacao**: 2026-01-10
**Fase Atual**: research
**Status**: in_progress

## Resumo Executivo

Test summary
`
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth')) {
          return true
        }
        if (p.includes('memory.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue(existingContent)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })
  })

  describe('load', () => {
    it('should load existing memory for feature', async () => {
      const memoryContent = `# Memoria: auth

**Ultima Atualizacao**: 2026-01-13
**Fase Atual**: implement
**Status**: in_progress

## Resumo Executivo

Authentication feature

## Proximos Passos

1. Complete middleware
`
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue(memoryContent)

      await memoryCommand.load('auth')

      expect(console.log).toHaveBeenCalled()
    })

    it('should fail if memory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.load('nonexistent')).rejects.toThrow('process.exit')
    })
  })

  describe('view', () => {
    it('should display feature memory', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('# Memory content')
      mockFs.stat.mockResolvedValue({ mtime: new Date() })

      await memoryCommand.view('auth')

      expect(console.log).toHaveBeenCalled()
    })

    it('should display global memory with --global flag', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('# Global memory')
      mockFs.readdir.mockResolvedValue([])

      await memoryCommand.view(undefined, { global: true })

      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('search', () => {
    it('should search across all feature memories', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features')) {
          return true
        }
        if (p.includes('memory.md')) {
          return true
        }
        return false
      })
      mockFs.readdir.mockResolvedValue(['auth', 'payments'])
      mockFs.readFile.mockResolvedValue('Line with JWT token\nAnother line')

      await memoryCommand.search('JWT')

      expect(mockFs.readFile).toHaveBeenCalled()
    })

    it('should filter by feature with --feature flag', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue('Content with search term')

      await memoryCommand.search('search', { feature: 'auth' })

      expect(mockFs.readFile).toHaveBeenCalled()
    })
  })

  describe('compact', () => {
    it('should skip if already under limit', async () => {
      const shortContent = Array(100).fill('line').join('\n')
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue(shortContent)

      await memoryCommand.compact('auth')

      expect(mockFs.copy).not.toHaveBeenCalled()
    })

    it('should fail if memory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.compact('nonexistent')).rejects.toThrow('process.exit')
    })

    it('should compact memory over limit', async () => {
      const largeContent = Array(1001).fill('line').join('\n')
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue(largeContent)
      mockFs.ensureDir.mockResolvedValue(undefined)
      mockFs.copy.mockResolvedValue(undefined)

      await memoryCommand.compact('auth')

      expect(mockFs.copy).toHaveBeenCalled()
      expect(mockFs.ensureDir).toHaveBeenCalled()
    })
  })

  describe('save edge cases', () => {
    it('should warn when memory approaches limit', async () => {
      const warningContent = Array(850).fill('line').join('\n')
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('memory.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue(warningContent)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should detect phase from implementation plan', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('implementation-plan.md')) {
          return true
        }
        if (p.includes('memory.md')) {
          return false
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should detect phase from research file', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('research.md')) {
          return true
        }
        if (p.includes('implementation-plan.md')) {
          return false
        }
        if (p.includes('memory.md')) {
          return false
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should detect phase from prd file only', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('prd.md')) {
          return true
        }
        if (p.includes('research.md')) {
          return false
        }
        if (p.includes('implementation-plan.md')) {
          return false
        }
        if (p.includes('memory.md')) {
          return false
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should warn when memory exceeds limit', async () => {
      const overLimitContent = Array(1100).fill('line').join('\n')
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('memory.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue(overLimitContent)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should use provided phase option', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('memory.md')) {
          return false
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth', { phase: 'qa' })

      expect(mockFs.writeFile).toHaveBeenCalled()
    })
  })

  describe('load edge cases', () => {
    it('should display decisions when present', async () => {
      const memoryWithDecisions = `# Memoria: auth

**Ultima Atualizacao**: 2026-01-13
**Fase Atual**: implement
**Status**: in_progress

## Resumo Executivo

Test summary

## Decisoes Arquiteturais

- **[ADR-001]**: Use JWT
  - Razao: Stateless

## Estado Atual

**Em Progresso**:
- [ ] Middleware

## Proximos Passos

1. Complete middleware
`
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue(memoryWithDecisions)

      await memoryCommand.load('auth')

      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('view edge cases', () => {
    it('should fail if feature memory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.view('nonexistent')).rejects.toThrow('process.exit')
    })

    it('should fail if global memory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.view(undefined, { global: true })).rejects.toThrow('process.exit')
    })

    it('should list feature memories when viewing global', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('project-context.md')) {
          return true
        }
        if (p.includes('features')) {
          return true
        }
        if (p.includes('memory.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('# Global memory')
      mockFs.readdir.mockResolvedValue(['auth', 'payments'])

      await memoryCommand.view(undefined, { global: true })

      expect(mockFs.readdir).toHaveBeenCalled()
    })
  })

  describe('search edge cases', () => {
    it('should fail if no features directory exists', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.search('query')).rejects.toThrow('process.exit')
    })

    it('should warn when no results found', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features')) {
          return true
        }
        return false
      })
      mockFs.readdir.mockResolvedValue(['auth'])
      mockFs.readFile.mockResolvedValue('No match here')

      await memoryCommand.search('nonexistent-term')

      expect(mockFs.readdir).toHaveBeenCalled()
    })

    it('should skip features without memory file', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features') && !p.includes('memory.md')) {
          return true
        }
        if (p.includes('memory.md')) {
          return false
        }
        return false
      })
      mockFs.readdir.mockResolvedValue(['auth', 'payments'])

      await memoryCommand.search('query')

      expect(mockFs.readFile).not.toHaveBeenCalled()
    })
  })

  describe('sync', () => {
    it('should sync global memory', async () => {
      mockFs.pathExists.mockResolvedValue(true)

      await memoryCommand.sync()

      expect(mockFs.pathExists).toHaveBeenCalled()
    })

    it('should fail if global memory does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.sync()).rejects.toThrow('process.exit')
    })
  })

  describe('update (deprecated alias)', () => {
    it('should call sync and show deprecation warning', async () => {
      mockFs.pathExists.mockResolvedValue(true)
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await memoryCommand.update()

      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/deprecated|sync/i))
      expect(mockFs.pathExists).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should still work as alias for sync', async () => {
      mockFs.pathExists.mockResolvedValue(true)

      await memoryCommand.update()

      expect(mockFs.pathExists).toHaveBeenCalled()
    })
  })

  describe('save with all phase detection paths', () => {
    it('should detect no phase files exist', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth') && !p.includes('.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('')
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.ensureDir.mockResolvedValue(undefined)

      await memoryCommand.save('auth')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })
  })

  describe('load with all display paths', () => {
    it('should display memory without summary', async () => {
      const memoryNoSummary = `# Memoria: auth

**Ultima Atualizacao**: 2026-01-13
**Fase Atual**: implement
**Status**: in_progress

## Resumo Executivo

## Proximos Passos

1. Complete middleware
`
      mockFs.pathExists.mockResolvedValue(true)
      mockFs.readFile.mockResolvedValue(memoryNoSummary)

      await memoryCommand.load('auth')

      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('recall', () => {
    it('should search decisions and display results', async () => {
      mockRecallMemory.mockResolvedValue([])
      mockFormatSearchResults.mockReturnValue('Found 0 decisions')

      await memoryCommand.recall('jwt authentication')

      expect(mockRecallMemory).toHaveBeenCalledWith('jwt authentication', expect.any(Object))
      expect(console.log).toHaveBeenCalled()
    })

    it('should pass category filter', async () => {
      mockRecallMemory.mockResolvedValue([])

      await memoryCommand.recall('test', { category: 'architecture' })

      expect(mockRecallMemory).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          category: 'architecture',
        })
      )
    })

    it('should pass limit option', async () => {
      mockRecallMemory.mockResolvedValue([])

      await memoryCommand.recall('test', { limit: '10' })

      expect(mockRecallMemory).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 10,
        })
      )
    })

    it('should fail on error', async () => {
      mockRecallMemory.mockRejectedValue(new Error('Search failed'))

      await expect(memoryCommand.recall('test')).rejects.toThrow('process.exit')
    })
  })

  describe('link', () => {
    it('should link decision to feature', async () => {
      mockLoadDecision.mockResolvedValue({
        id: 'test-decision',
        title: 'Test Decision',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.ARCHITECTURE,
        tags: [],
        relatedFeatures: [],
        createdAt: '',
        updatedAt: '',
      })
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth')) {
          return true
        }
        if (p.includes('context.md')) {
          return false
        }
        return false
      })
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.link('auth', 'test-decision')

      expect(mockUpdateDecisionFeatures).toHaveBeenCalledWith('test-decision', 'auth', 'add')
    })

    it('should fail if decision not found', async () => {
      mockLoadDecision.mockResolvedValue(null)

      await expect(memoryCommand.link('auth', 'nonexistent')).rejects.toThrow('process.exit')
    })

    it('should fail if feature not found', async () => {
      mockLoadDecision.mockResolvedValue({
        id: 'test-decision',
        title: 'Test',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.ARCHITECTURE,
        tags: [],
        relatedFeatures: [],
        createdAt: '',
        updatedAt: '',
      })
      mockFs.pathExists.mockResolvedValue(false)

      await expect(memoryCommand.link('nonexistent', 'test-decision')).rejects.toThrow(
        'process.exit'
      )
    })

    it('should append to existing context file', async () => {
      mockLoadDecision.mockResolvedValue({
        id: 'test-decision',
        title: 'Test',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.ARCHITECTURE,
        tags: [],
        relatedFeatures: [],
        createdAt: '',
        updatedAt: '',
      })
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth')) {
          return true
        }
        if (p.includes('context.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('# Existing context')
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.link('auth', 'test-decision')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should not duplicate link in context', async () => {
      mockLoadDecision.mockResolvedValue({
        id: 'test-decision',
        title: 'Test',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.ARCHITECTURE,
        tags: [],
        relatedFeatures: [],
        createdAt: '',
        updatedAt: '',
      })
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('features/auth')) {
          return true
        }
        if (p.includes('context.md')) {
          return true
        }
        return false
      })
      mockFs.readFile.mockResolvedValue('Already has test-decision link')
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.link('auth', 'test-decision')

      expect(mockFs.writeFile).not.toHaveBeenCalled()
    })
  })

  describe('unlink', () => {
    it('should unlink decision from feature', async () => {
      mockLoadDecision.mockResolvedValue({
        id: 'test-decision',
        title: 'Test',
        context: '',
        alternatives: [],
        chosen: '',
        rationale: '',
        category: DecisionCategory.ARCHITECTURE,
        tags: [],
        relatedFeatures: ['auth'],
        createdAt: '',
        updatedAt: '',
      })

      await memoryCommand.unlink('auth', 'test-decision')

      expect(mockUpdateDecisionFeatures).toHaveBeenCalledWith('test-decision', 'auth', 'remove')
    })

    it('should fail if decision not found', async () => {
      mockLoadDecision.mockResolvedValue(null)

      await expect(memoryCommand.unlink('auth', 'nonexistent')).rejects.toThrow('process.exit')
    })
  })

  describe('export', () => {
    it('should export decisions as markdown', async () => {
      mockListDecisions.mockResolvedValue([])
      mockGetMemoryStats.mockResolvedValue({
        totalDecisions: 0,
        byCategory: {},
        recentDecisions: [],
        mostLinkedDecisions: [],
      })
      mockFs.ensureDir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.export()

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.md'),
        expect.stringContaining('Knowledge Base Export'),
        'utf-8'
      )
    })

    it('should export decisions as json', async () => {
      mockListDecisions.mockResolvedValue([])
      mockGetMemoryStats.mockResolvedValue({
        totalDecisions: 0,
        byCategory: {},
        recentDecisions: [],
        mostLinkedDecisions: [],
      })
      mockFs.ensureDir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.export({ format: 'json' })

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"exportedAt"'),
        'utf-8'
      )
    })

    it('should use custom output path', async () => {
      mockListDecisions.mockResolvedValue([])
      mockGetMemoryStats.mockResolvedValue({
        totalDecisions: 0,
        byCategory: {},
        recentDecisions: [],
        mostLinkedDecisions: [],
      })
      mockFs.ensureDir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.export({ output: '/custom/path/export.md' })

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/custom/path/export.md',
        expect.any(String),
        'utf-8'
      )
    })

    it('should include decisions in export', async () => {
      mockListDecisions.mockResolvedValue([
        {
          id: 'test-id',
          title: 'Test Decision',
          context: 'Test context',
          alternatives: [],
          chosen: 'Option A',
          rationale: 'Good choice',
          category: DecisionCategory.ARCHITECTURE,
          tags: ['test'],
          relatedFeatures: ['auth'],
          createdAt: '2026-01-14T10:00:00.000Z',
          updatedAt: '2026-01-14T10:00:00.000Z',
        },
      ])
      mockGetMemoryStats.mockResolvedValue({
        totalDecisions: 1,
        byCategory: { architecture: 1 },
        recentDecisions: [],
        mostLinkedDecisions: [],
      })
      mockFs.ensureDir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      await memoryCommand.export()

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Test Decision'),
        'utf-8'
      )
    })

    it('should fail on error', async () => {
      mockListDecisions.mockRejectedValue(new Error('Failed'))

      await expect(memoryCommand.export()).rejects.toThrow('process.exit')
    })
  })

  describe('status', () => {
    it('should display memory status table', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('project-context.md')) return true
        if (p.includes('features') && !p.includes('memory.md')) return true
        if (p.includes('auth/memory.md')) return true
        return false
      })
      mockFs.readFile.mockResolvedValue('line1\nline2\nline3')
      mockFs.stat.mockResolvedValue({
        mtime: new Date('2026-01-15T10:00:00.000Z'),
      })
      mockFs.readdir.mockResolvedValue(['auth'])

      await memoryCommand.status()

      expect(console.log).toHaveBeenCalled()
    })

    it('should handle no memories found', async () => {
      mockFs.pathExists.mockResolvedValue(false)

      await memoryCommand.status()

      expect(console.log).toHaveBeenCalled()
    })

    it('should highlight memories near limit in output', async () => {
      const nearLimitContent = Array(850).fill('line').join('\n')
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('project-context.md')) return true
        return false
      })
      mockFs.readFile.mockResolvedValue(nearLimitContent)
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
      })

      await memoryCommand.status()

      expect(console.log).toHaveBeenCalled()
    })

    it('should show all memory levels', async () => {
      mockFs.pathExists.mockImplementation(async (p: string) => {
        if (p.includes('project-context.md')) return true
        if (p.includes('features') && !p.includes('/')) return true
        if (p.includes('auth/memory.md')) return true
        return false
      })
      mockFs.readFile.mockResolvedValue('content')
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
      })
      mockFs.readdir.mockResolvedValue(['auth'])

      await memoryCommand.status()

      expect(console.log).toHaveBeenCalled()
    })

    it('should fail on filesystem error', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Filesystem error'))

      await expect(memoryCommand.status()).rejects.toThrow('process.exit')
    })
  })
})
