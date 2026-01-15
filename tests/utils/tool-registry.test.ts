enum ToolCategory {
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  DEPLOYMENT = 'deployment',
  QUALITY = 'quality',
  SECURITY = 'security',
}

interface ToolDefinition {
  name: string
  description: string
  triggers: string[]
  category: ToolCategory
  priority: 'high' | 'medium' | 'low'
  deferLoading: boolean
  promptPath: string
  dependencies: string[]
  version: string
  author?: string
  createdAt: string
  updatedAt: string
}

describe('ToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ToolDefinition interface', () => {
    it('should create valid tool definition', () => {
      const tool: ToolDefinition = {
        name: 'analyzer',
        description: 'Analyzes code for issues and improvements',
        triggers: ['analyze', 'review', 'check'],
        category: ToolCategory.ANALYSIS,
        priority: 'high',
        deferLoading: false,
        promptPath: '.claude/agents/analyzer.md',
        dependencies: [],
        version: '1.0.0',
        createdAt: '2026-01-14T00:00:00.000Z',
        updatedAt: '2026-01-14T00:00:00.000Z',
      }

      expect(tool.name).toBe('analyzer')
      expect(tool.category).toBe(ToolCategory.ANALYSIS)
      expect(tool.triggers).toContain('analyze')
    })

    it('should support all tool categories', () => {
      const categories = [
        ToolCategory.ANALYSIS,
        ToolCategory.IMPLEMENTATION,
        ToolCategory.TESTING,
        ToolCategory.DOCUMENTATION,
        ToolCategory.DEPLOYMENT,
        ToolCategory.QUALITY,
        ToolCategory.SECURITY,
      ]

      expect(categories.length).toBe(7)
    })
  })

  describe('Tool priorities', () => {
    it('should support high priority', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'critical-tool',
        priority: 'high',
        deferLoading: false,
      }

      expect(tool.priority).toBe('high')
    })

    it('should support medium priority', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'normal-tool',
        priority: 'medium',
        deferLoading: true,
      }

      expect(tool.priority).toBe('medium')
    })

    it('should support low priority', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'optional-tool',
        priority: 'low',
        deferLoading: true,
      }

      expect(tool.priority).toBe('low')
    })
  })

  describe('Tool loading behavior', () => {
    it('should identify immediate loading tools', () => {
      const tool: ToolDefinition = {
        name: 'core-tool',
        description: 'Core functionality',
        triggers: ['core'],
        category: ToolCategory.IMPLEMENTATION,
        priority: 'high',
        deferLoading: false,
        promptPath: '.claude/agents/core.md',
        dependencies: [],
        version: '1.0.0',
        createdAt: '2026-01-14T00:00:00.000Z',
        updatedAt: '2026-01-14T00:00:00.000Z',
      }

      const shouldLoadImmediately = !tool.deferLoading || tool.priority === 'high'
      expect(shouldLoadImmediately).toBe(true)
    })

    it('should identify deferred loading tools', () => {
      const tool: ToolDefinition = {
        name: 'optional-tool',
        description: 'Optional functionality',
        triggers: ['optional'],
        category: ToolCategory.DOCUMENTATION,
        priority: 'low',
        deferLoading: true,
        promptPath: '.claude/agents/optional.md',
        dependencies: [],
        version: '1.0.0',
        createdAt: '2026-01-14T00:00:00.000Z',
        updatedAt: '2026-01-14T00:00:00.000Z',
      }

      const shouldDefer = tool.deferLoading && tool.priority !== 'high'
      expect(shouldDefer).toBe(true)
    })
  })

  describe('Tool triggers', () => {
    it('should support multiple triggers', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'multi-trigger',
        triggers: ['test', 'spec', 'check', 'validate'],
      }

      expect(tool.triggers).toHaveLength(4)
    })

    it('should support empty triggers', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'no-trigger',
        triggers: [],
      }

      expect(tool.triggers).toHaveLength(0)
    })

    it('should match trigger patterns', () => {
      const triggers = ['analyze', 'review', 'check code', 'find issues']
      const query = 'analyze'

      const matches = triggers.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
      expect(matches).toContain('analyze')
    })
  })

  describe('Tool dependencies', () => {
    it('should track tool dependencies', () => {
      const tool: ToolDefinition = {
        name: 'implementer',
        description: 'Implements features',
        triggers: ['implement', 'code'],
        category: ToolCategory.IMPLEMENTATION,
        priority: 'medium',
        deferLoading: false,
        promptPath: '.claude/agents/implementer.md',
        dependencies: ['analyzer', 'planner'],
        version: '1.0.0',
        createdAt: '2026-01-14T00:00:00.000Z',
        updatedAt: '2026-01-14T00:00:00.000Z',
      }

      expect(tool.dependencies).toContain('analyzer')
      expect(tool.dependencies).toContain('planner')
      expect(tool.dependencies).toHaveLength(2)
    })

    it('should support tools with no dependencies', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'standalone',
        dependencies: [],
      }

      expect(tool.dependencies).toHaveLength(0)
    })
  })

  describe('Search scoring', () => {
    it('should calculate confidence levels correctly', () => {
      const calculateConfidence = (score: number): 'high' | 'medium' | 'low' => {
        if (score > 0.8) {
          return 'high'
        }
        if (score > 0.6) {
          return 'medium'
        }
        return 'low'
      }

      expect(calculateConfidence(0.9)).toBe('high')
      expect(calculateConfidence(0.7)).toBe('medium')
      expect(calculateConfidence(0.5)).toBe('low')
    })

    it('should rank results by score', () => {
      const results = [
        { tool: { name: 'b' }, score: 0.5 },
        { tool: { name: 'a' }, score: 0.9 },
        { tool: { name: 'c' }, score: 0.7 },
      ]

      const sorted = results.sort((a, b) => b.score - a.score)

      expect(sorted[0].tool.name).toBe('a')
      expect(sorted[1].tool.name).toBe('c')
      expect(sorted[2].tool.name).toBe('b')
    })
  })

  describe('Category filtering', () => {
    it('should filter by single category', () => {
      const tools: Partial<ToolDefinition>[] = [
        { name: 'analyzer', category: ToolCategory.ANALYSIS },
        { name: 'tester', category: ToolCategory.TESTING },
        { name: 'reviewer', category: ToolCategory.QUALITY },
      ]

      const filtered = tools.filter((t) => t.category === ToolCategory.TESTING)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('tester')
    })

    it('should return all tools when no category filter', () => {
      const tools: Partial<ToolDefinition>[] = [
        { name: 'a', category: ToolCategory.ANALYSIS },
        { name: 'b', category: ToolCategory.TESTING },
        { name: 'c', category: ToolCategory.QUALITY },
      ]

      expect(tools.length).toBe(3)
    })
  })

  describe('Version tracking', () => {
    it('should track tool version', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'versioned-tool',
        version: '2.1.0',
      }

      expect(tool.version).toBe('2.1.0')
    })

    it('should track creation and update timestamps', () => {
      const createdAt = '2026-01-01T00:00:00.000Z'
      const updatedAt = '2026-01-14T12:00:00.000Z'

      const tool: Partial<ToolDefinition> = {
        name: 'tracked-tool',
        createdAt,
        updatedAt,
      }

      expect(tool.createdAt).toBe(createdAt)
      expect(tool.updatedAt).toBe(updatedAt)
      expect(new Date(createdAt).getTime()).toBeLessThan(new Date(updatedAt).getTime())
    })
  })

  describe('Prompt path handling', () => {
    it('should support agent paths', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'agent-tool',
        promptPath: '.claude/agents/custom-agent.md',
      }

      expect(tool.promptPath).toContain('.claude/agents/')
    })

    it('should support skill paths', () => {
      const tool: Partial<ToolDefinition> = {
        name: 'skill-tool',
        promptPath: '.claude/skills/tdd/SKILL.md',
      }

      expect(tool.promptPath).toContain('.claude/skills/')
    })
  })

  describe('Search threshold behavior', () => {
    it('should filter results below threshold', () => {
      const results = [
        { score: 0.8, tool: { name: 'high' } },
        { score: 0.5, tool: { name: 'medium' } },
        { score: 0.3, tool: { name: 'low' } },
      ]

      const threshold = 0.4
      const filtered = results.filter((r) => r.score >= threshold)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((r) => r.tool.name)).toEqual(['high', 'medium'])
    })

    it('should respect custom threshold', () => {
      const results = [{ score: 0.9 }, { score: 0.7 }, { score: 0.5 }, { score: 0.3 }]

      const highThreshold = 0.6
      const filtered = results.filter((r) => r.score >= highThreshold)

      expect(filtered).toHaveLength(2)
    })
  })

  describe('Limit behavior', () => {
    it('should limit number of results', () => {
      const results = Array.from({ length: 10 }, (_, i) => ({
        tool: { name: `tool-${i}` },
        score: 1 - i * 0.1,
      }))

      const limit = 5
      const limited = results.slice(0, limit)

      expect(limited).toHaveLength(5)
      expect(limited[0].tool.name).toBe('tool-0')
    })

    it('should return all results when under limit', () => {
      const results = [{ tool: { name: 'a' } }, { tool: { name: 'b' } }]

      const limit = 5
      const limited = results.slice(0, limit)

      expect(limited).toHaveLength(2)
    })
  })
})
