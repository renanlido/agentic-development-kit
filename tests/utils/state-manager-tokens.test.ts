import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import fs from 'fs-extra'
import type { ContextStatus } from '../../src/types/compaction'

jest.mock('../../src/utils/context-compactor')

describe('StateManager - Token Integration', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-manager-tokens-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
    jest.clearAllMocks()
  })

  describe('getContextStatus', () => {
    it('should return current token usage', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 50000,
        maxTokens: 80000,
        usagePercentage: 62.5,
        level: 'raw',
        recommendation: 'Continue normally',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const status = await manager.getContextStatus(featureName)

      expect(status.currentTokens).toBe(50000)
      expect(status.maxTokens).toBe(80000)
    })

    it('should calculate correct percentage', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 70000,
        maxTokens: 80000,
        usagePercentage: 87.5,
        level: 'summarize',
        recommendation: 'Summarization recommended',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const status = await manager.getContextStatus(featureName)

      expect(status.usagePercentage).toBe((70000 / 80000) * 100)
    })
  })

  describe('beforeToolUse', () => {
    it('should return null when context is safe', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 40000,
        maxTokens: 80000,
        usagePercentage: 50,
        level: 'raw',
        recommendation: 'Continue normally',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const warning = await manager.beforeToolUse(featureName)

      expect(warning).toBeNull()
    })

    it('should return warning at 70%', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 56000,
        maxTokens: 80000,
        usagePercentage: 70,
        level: 'compact',
        recommendation: 'Consider compaction',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const warning = await manager.beforeToolUse(featureName)

      expect(warning).not.toBeNull()
      expect(warning?.severity).toBe('warning')
      expect(warning?.action).toBe('compact')
    })

    it('should return critical at 85%', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 68000,
        maxTokens: 80000,
        usagePercentage: 85,
        level: 'summarize',
        recommendation: 'Summarization recommended',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const warning = await manager.beforeToolUse(featureName)

      expect(warning).not.toBeNull()
      expect(warning?.severity).toBe('critical')
      expect(warning?.action).toBe('summarize')
    })

    it('should return emergency at 95%', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 76000,
        maxTokens: 80000,
        usagePercentage: 95,
        level: 'handoff',
        recommendation: 'Handoff required',
        canContinue: false,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const warning = await manager.beforeToolUse(featureName)

      expect(warning).not.toBeNull()
      expect(warning?.severity).toBe('emergency')
      expect(warning?.action).toBe('handoff')
    })
  })

  describe('handleContextWarning', () => {
    it('should trigger compaction at warning level', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 56000,
        maxTokens: 80000,
        usagePercentage: 70,
        level: 'compact',
        recommendation: 'Consider compaction',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.compact = jest.fn().mockResolvedValue({
        originalTokens: 56000,
        compactedTokens: 40000,
        savedTokens: 16000,
        itemsCompacted: 10,
        level: 'compact',
        timestamp: new Date().toISOString(),
        canRevert: true,
        historyId: 'test-id',
      })

      const manager = new StateManager()
      await manager.handleContextWarning(featureName, mockStatus)

      expect(mockCompactor.prototype.compact).toHaveBeenCalledWith(featureName, undefined)
    })

    it('should trigger summarization at critical level', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 68000,
        maxTokens: 80000,
        usagePercentage: 85,
        level: 'summarize',
        recommendation: 'Summarization recommended',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.summarize = jest.fn().mockResolvedValue({
        summary: 'Summarized content',
        preservedDecisions: ['Decision 1'],
        preservedFiles: ['file1.ts'],
        informationLoss: true,
        tokensBefore: 68000,
        tokensAfter: 30000,
      })

      const manager = new StateManager()
      await manager.handleContextWarning(featureName, mockStatus)

      expect(mockCompactor.prototype.summarize).toHaveBeenCalledWith(featureName)
    })

    it('should create handoff at emergency level', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 76000,
        maxTokens: 80000,
        usagePercentage: 95,
        level: 'handoff',
        recommendation: 'Handoff required',
        canContinue: false,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.createHandoffDocument = jest.fn().mockResolvedValue({
        feature: featureName,
        currentTask: 'Current task',
        completed: [],
        inProgress: [],
        nextSteps: [],
        filesModified: [],
        issues: [],
        decisions: [],
        context: 'Context',
        createdAt: new Date().toISOString(),
        sessionId: 'session-123',
        checkpointId: 'checkpoint-123',
      })

      const manager = new StateManager()
      await manager.handleContextWarning(featureName, mockStatus)

      expect(mockCompactor.prototype.createHandoffDocument).toHaveBeenCalledWith(featureName)
    })
  })

  describe('triggerCompaction', () => {
    it('should call ContextCompactor.compact', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockResult = {
        originalTokens: 60000,
        compactedTokens: 42000,
        savedTokens: 18000,
        itemsCompacted: 12,
        level: 'compact' as const,
        timestamp: new Date().toISOString(),
        canRevert: true,
        historyId: 'compact-123',
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.compact = jest.fn().mockResolvedValue(mockResult)

      const manager = new StateManager()
      const result = await manager.triggerCompaction(featureName)

      expect(mockCompactor.prototype.compact).toHaveBeenCalledWith(featureName, undefined)
      expect(result.savedTokens).toBe(18000)
    })

    it('should update state after compaction', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockResult = {
        originalTokens: 60000,
        compactedTokens: 42000,
        savedTokens: 18000,
        itemsCompacted: 12,
        level: 'compact' as const,
        timestamp: new Date().toISOString(),
        canRevert: true,
        historyId: 'compact-123',
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.compact = jest.fn().mockResolvedValue(mockResult)

      const manager = new StateManager()
      await manager.triggerCompaction(featureName)

      const state = await manager.loadUnifiedState(featureName)
      expect(state.lastCompaction).toBeDefined()
      expect(state.lastCompaction?.timestamp).toBeDefined()
    })

    it('should log metrics', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')
      const { logger } = await import('../../src/utils/logger')

      const mockResult = {
        originalTokens: 60000,
        compactedTokens: 42000,
        savedTokens: 18000,
        itemsCompacted: 12,
        level: 'compact' as const,
        timestamp: new Date().toISOString(),
        canRevert: true,
        historyId: 'compact-123',
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.compact = jest.fn().mockResolvedValue(mockResult)

      const logSpy = jest.spyOn(logger, 'info')

      const manager = new StateManager()
      await manager.triggerCompaction(featureName)

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('18000'))
    })
  })

  describe('Integration with existing methods', () => {
    it('should include token count in loadUnifiedState', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 45000,
        maxTokens: 80000,
        usagePercentage: 56.25,
        level: 'raw',
        recommendation: 'Continue normally',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const state = await manager.loadUnifiedState(featureName)

      expect(state.tokenUsage).toBeDefined()
      expect(state.tokenUsage?.currentTokens).toBe(45000)
    })

    it('should check threshold after saveUnifiedState', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const mockStatus: ContextStatus = {
        currentTokens: 68000,
        maxTokens: 80000,
        usagePercentage: 85,
        level: 'summarize',
        recommendation: 'Summarization recommended',
        canContinue: true,
      }

      const mockCompactor = ContextCompactor as jest.MockedClass<typeof ContextCompactor>
      mockCompactor.prototype.getContextStatus = jest.fn().mockResolvedValue(mockStatus)

      const manager = new StateManager()
      const state = {
        feature: featureName,
        currentPhase: 'implement' as const,
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      expect(mockCompactor.prototype.getContextStatus).toHaveBeenCalled()
    })

    it('should include context_overflow in checkpoint reasons', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')

      const manager = new StateManager()
      const checkpoint = await manager.createCheckpoint(featureName, {
        reason: 'context_overflow',
        metadata: { tokenUsage: 76000 },
      })

      expect(checkpoint.reason).toBe('context_overflow')
      expect(checkpoint.metadata?.tokenUsage).toBe(76000)
    })
  })
})
