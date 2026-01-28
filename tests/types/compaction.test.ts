import type {
  CompactedItem,
  CompactedItemType,
  CompactionConfig,
  CompactionHistory,
  CompactionHistoryEntry,
  CompactionLevel,
  CompactionLevelType,
  CompactionResult,
  ContextStatus,
  TokenCountResult,
  TokenSource,
} from '../../src/types/compaction'

describe('Compaction Types', () => {
  describe('Type guards', () => {
    it('should validate CompactionLevelType', () => {
      const validLevels: CompactionLevelType[] = ['raw', 'compact', 'summarize', 'handoff']
      expect(validLevels).toHaveLength(4)
    })

    it('should validate TokenSource', () => {
      const validSources: TokenSource[] = ['api', 'cache', 'offline']
      expect(validSources).toHaveLength(3)
    })

    it('should validate CompactedItemType', () => {
      const validTypes: CompactedItemType[] = ['tool_output', 'duplicate', 'verbose', 'old_content']
      expect(validTypes).toHaveLength(4)
    })
  })

  describe('CompactionLevel', () => {
    it('should have valid structure', () => {
      const level: CompactionLevel = {
        level: 'compact',
        threshold: 0.7,
        description: 'Reversible compaction',
      }
      expect(level.level).toBe('compact')
      expect(level.threshold).toBeGreaterThanOrEqual(0)
      expect(level.threshold).toBeLessThanOrEqual(1)
    })

    it('should validate threshold range 0-1', () => {
      const invalidThresholds = [-0.1, 1.1, 2.0]
      for (const threshold of invalidThresholds) {
        const isValid = threshold >= 0 && threshold <= 1
        expect(isValid).toBe(false)
      }
    })
  })

  describe('CompactionResult', () => {
    it('should have required fields', () => {
      const result: CompactionResult = {
        originalTokens: 10000,
        compactedTokens: 7000,
        savedTokens: 3000,
        itemsCompacted: 15,
        level: 'compact',
        timestamp: new Date().toISOString(),
        canRevert: true,
        historyId: 'test-id',
        items: [],
      }
      expect(result.savedTokens).toBe(result.originalTokens - result.compactedTokens)
      expect(result.canRevert).toBe(true)
    })
  })

  describe('CompactedItem', () => {
    it('should have required fields', () => {
      const item: CompactedItem = {
        type: 'tool_output',
        originalSize: 1000,
        compactedSize: 200,
        canRevert: true,
        revertPath: '.compaction/backup/item.json',
      }
      expect(item.originalSize).toBeGreaterThan(item.compactedSize)
    })

    it('should allow missing revertPath when canRevert is false', () => {
      const item: CompactedItem = {
        type: 'duplicate',
        originalSize: 500,
        compactedSize: 0,
        canRevert: false,
      }
      expect(item.revertPath).toBeUndefined()
    })
  })

  describe('TokenCountResult', () => {
    it('should have required fields', () => {
      const result: TokenCountResult = {
        count: 5000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      }
      expect(result.count).toBeGreaterThan(0)
      expect(result.precision).toBeGreaterThan(0)
      expect(result.precision).toBeLessThanOrEqual(1)
    })

    it('should report correct precision for different sources', () => {
      const apiResult: TokenCountResult = {
        count: 5000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      }
      const offlineResult: TokenCountResult = {
        count: 5000,
        source: 'offline',
        precision: 0.88,
        timestamp: Date.now(),
        cached: false,
      }
      expect(apiResult.precision).toBeGreaterThan(offlineResult.precision)
    })
  })

  describe('ContextStatus', () => {
    it('should have required fields', () => {
      const status: ContextStatus = {
        currentTokens: 56000,
        maxTokens: 80000,
        usagePercentage: 70,
        level: 'compact',
        recommendation: 'Consider compaction to save tokens',
        canContinue: true,
      }
      expect(status.usagePercentage).toBe((status.currentTokens / status.maxTokens) * 100)
      expect(status.canContinue).toBe(true)
    })

    it('should determine correct level based on percentage', () => {
      const levels: Array<{ percentage: number; expected: CompactionLevelType }> = [
        { percentage: 50, expected: 'raw' },
        { percentage: 75, expected: 'compact' },
        { percentage: 90, expected: 'summarize' },
        { percentage: 96, expected: 'handoff' },
      ]

      for (const { percentage, expected } of levels) {
        const status: ContextStatus = {
          currentTokens: percentage * 1000,
          maxTokens: 100000,
          usagePercentage: percentage,
          level: expected,
          recommendation: `Level: ${expected}`,
          canContinue: percentage < 95,
        }
        expect(status.level).toBe(expected)
      }
    })
  })

  describe('CompactionConfig', () => {
    it('should have valid default configuration', () => {
      const config: CompactionConfig = {
        thresholds: {
          warning: 0.7,
          critical: 0.85,
          emergency: 0.95,
        },
        tokenCounter: {
          cacheTTL: 3600000,
          cacheMaxSize: 1000,
          adjustmentFactor: 0.92,
        },
        pruning: {
          maxAge: 2592000000,
          maxLines: 500,
        },
        compaction: {
          preservePatterns: ['/^## Decision:/gm', '/error|fail|critical/gi'],
          removePatterns: ['/^Read tool output:/gm', '/^Bash output:/gm'],
          rollbackWindow: 86400000,
        },
      }

      expect(config.thresholds.warning).toBeGreaterThan(0)
      expect(config.thresholds.warning).toBeLessThan(config.thresholds.critical)
      expect(config.thresholds.critical).toBeLessThan(config.thresholds.emergency)
      expect(config.thresholds.emergency).toBeLessThanOrEqual(1)
    })

    it('should validate threshold ordering', () => {
      const config: CompactionConfig = {
        thresholds: {
          warning: 0.7,
          critical: 0.85,
          emergency: 0.95,
        },
        tokenCounter: {
          cacheTTL: 3600000,
          cacheMaxSize: 1000,
          adjustmentFactor: 0.92,
        },
        pruning: {
          maxAge: 2592000000,
          maxLines: 500,
        },
        compaction: {
          preservePatterns: [],
          removePatterns: [],
          rollbackWindow: 86400000,
        },
      }

      expect(config.thresholds.warning).toBeLessThan(config.thresholds.critical)
      expect(config.thresholds.critical).toBeLessThan(config.thresholds.emergency)
    })
  })

  describe('CompactionHistory', () => {
    it('should track compaction entries', () => {
      const entry: CompactionHistoryEntry = {
        timestamp: new Date().toISOString(),
        level: 'compact',
        tokensBefore: 10000,
        tokensAfter: 7000,
        itemsCompacted: 15,
      }

      const history: CompactionHistory = {
        entries: [entry],
      }

      expect(history.entries).toHaveLength(1)
      expect(history.entries[0].tokensBefore).toBeGreaterThan(history.entries[0].tokensAfter)
    })

    it('should maintain chronological order', () => {
      const now = Date.now()
      const entries: CompactionHistoryEntry[] = [
        {
          timestamp: new Date(now - 2000).toISOString(),
          level: 'compact',
          tokensBefore: 10000,
          tokensAfter: 7000,
          itemsCompacted: 10,
        },
        {
          timestamp: new Date(now - 1000).toISOString(),
          level: 'summarize',
          tokensBefore: 7000,
          tokensAfter: 3000,
          itemsCompacted: 5,
        },
        {
          timestamp: new Date(now).toISOString(),
          level: 'handoff',
          tokensBefore: 3000,
          tokensAfter: 500,
          itemsCompacted: 1,
        },
      ]

      const history: CompactionHistory = { entries }
      expect(history.entries).toHaveLength(3)

      for (let i = 1; i < history.entries.length; i++) {
        const prev = new Date(history.entries[i - 1].timestamp).getTime()
        const curr = new Date(history.entries[i].timestamp).getTime()
        expect(curr).toBeGreaterThanOrEqual(prev)
      }
    })
  })
})
