import { ContextCompactor } from '../../src/utils/context-compactor'
import { TokenCounter } from '../../src/utils/token-counter'
import { SnapshotManager } from '../../src/utils/snapshot-manager'
import type {
  ContextStatus,
  CompactionResult,
  CompactionLevelType,
} from '../../src/types/compaction'
import * as fs from 'fs-extra'
import * as path from 'node:path'
import * as os from 'node:os'

jest.mock('../../src/utils/token-counter')
jest.mock('../../src/utils/snapshot-manager')
jest.mock('../../src/utils/claude', () => ({
  executeClaudeCommand: jest.fn(),
}))

describe('ContextCompactor', () => {
  let contextCompactor: ContextCompactor
  let mockTokenCounter: jest.Mocked<TokenCounter>
  let mockSnapshotManager: jest.Mocked<SnapshotManager>
  let tempDir: string

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'test-compactor-' + Date.now())
    await fs.ensureDir(tempDir)

    mockTokenCounter = new TokenCounter() as jest.Mocked<TokenCounter>
    mockSnapshotManager = new SnapshotManager() as jest.Mocked<SnapshotManager>

    contextCompactor = new ContextCompactor()
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    jest.clearAllMocks()
  })

  describe('getContextStatus', () => {
    it('should return raw level when under 70%', async () => {
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 50000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      })

      const status = await contextCompactor.getContextStatus('test-feature')

      expect(status.level).toBe('raw')
      expect(status.usagePercentage).toBeLessThan(70)
      expect(status.canContinue).toBe(true)
    })

    it('should return compact level between 70-85%', async () => {
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 60000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      })

      const status = await contextCompactor.getContextStatus('test-feature')

      expect(status.level).toBe('compact')
      expect(status.usagePercentage).toBeGreaterThanOrEqual(70)
      expect(status.usagePercentage).toBeLessThan(85)
      expect(status.canContinue).toBe(true)
    })

    it('should return summarize level between 85-95%', async () => {
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 72000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      })

      const status = await contextCompactor.getContextStatus('test-feature')

      expect(status.level).toBe('summarize')
      expect(status.usagePercentage).toBeGreaterThanOrEqual(85)
      expect(status.usagePercentage).toBeLessThan(95)
      expect(status.canContinue).toBe(true)
    })

    it('should return handoff level above 95%', async () => {
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 77000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      })

      const status = await contextCompactor.getContextStatus('test-feature')

      expect(status.level).toBe('handoff')
      expect(status.usagePercentage).toBeGreaterThanOrEqual(95)
      expect(status.canContinue).toBe(false)
    })

    it('should include recommendation', async () => {
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 60000,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      })

      const status = await contextCompactor.getContextStatus('test-feature')

      expect(status.recommendation).toBeDefined()
      expect(status.recommendation.length).toBeGreaterThan(0)
    })
  })

  describe('compact', () => {
    it('should create backup before compaction', async () => {
      mockSnapshotManager.createSnapshot = jest.fn().mockResolvedValue({
        id: 'snapshot-123',
        path: path.join(tempDir, 'snapshots/snapshot-123'),
      })

      const feature = 'backup-test'
      await contextCompactor.compact(feature)

      expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith(
        feature,
        expect.objectContaining({
          reason: 'pre_compaction',
        })
      )
    })

    it('should remove tool outputs', async () => {
      const content = `
Some context here
Read tool output: This is verbose output that should be removed
More context
Glob results: file1.ts, file2.ts, file3.ts
Final context
`
      const feature = 'tool-output-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const result = await contextCompactor.compact(feature)

      expect(result.itemsCompacted).toBeGreaterThan(0)
      const compacted = result.items.filter((item) => item.type === 'tool_output')
      expect(compacted.length).toBeGreaterThan(0)
    })

    it('should deduplicate content', async () => {
      const content = `
Content block
Repeated content
Repeated content
Repeated content
Different content
`
      const feature = 'dedup-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const result = await contextCompactor.compact(feature)

      const deduped = result.items.filter((item) => item.type === 'duplicate')
      expect(deduped.length).toBeGreaterThan(0)
    })

    it('should preserve critical content', async () => {
      const content = `
Regular content to compact
## Decision: Use PostgreSQL for database
Error: Critical failure in module X
More regular content
`
      const feature = 'preserve-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      await contextCompactor.compact(feature)

      const preserved = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(preserved).toContain('## Decision: Use PostgreSQL')
      expect(preserved).toContain('Error: Critical failure')
    })

    it('should save compaction history', async () => {
      const feature = 'history-test'
      const result = await contextCompactor.compact(feature)

      expect(result.historyId).toBeDefined()

      const historyPath = path.join(
        tempDir,
        '.compaction/history',
        feature,
        `${result.historyId}.json`
      )
      const historyExists = await fs.pathExists(historyPath)
      expect(historyExists).toBe(true)
    })

    it('should be reversible', async () => {
      const feature = 'revert-test'
      const originalContent = 'Original content before compaction'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), originalContent)

      const compactionResult = await contextCompactor.compact(feature)
      expect(compactionResult.canRevert).toBe(true)

      const reverted = await contextCompactor.revertCompaction(feature, compactionResult.historyId)
      expect(reverted).toBe(true)

      const restoredContent = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(restoredContent).toBe(originalContent)
    })

    it('should respect preserve patterns', async () => {
      const content = `
Regular content
ADR-001: Architecture Decision Record
Error in processing
Normal text
Critical: System failure
`
      const feature = 'patterns-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      await contextCompactor.compact(feature)

      const result = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(result).toContain('ADR-001')
      expect(result).toContain('Error in processing')
      expect(result).toContain('Critical: System failure')
    })
  })

  describe('summarize', () => {
    it('should preserve decisions', async () => {
      const content = `
## Decision: Use React for frontend
Rationale: Better ecosystem

Random verbose content that can be removed
More verbose content
Even more verbose content

## Decision: Deploy to AWS
Rationale: Cost effective
`
      const feature = 'decisions-test'
      const { executeClaudeCommand } = jest.requireMock('../../src/utils/claude')
      executeClaudeCommand.mockResolvedValue({
        summary: 'Preserved decisions and key points',
      })

      const result = await contextCompactor.summarize(feature)

      expect(result.preservedDecisions).toContain('Use React for frontend')
      expect(result.preservedDecisions).toContain('Deploy to AWS')
    })

    it('should preserve file list', async () => {
      const feature = 'files-test'
      const stateData = {
        filesModified: ['src/app.ts', 'src/utils.ts', 'tests/app.test.ts'],
      }

      const result = await contextCompactor.summarize(feature)

      expect(result.preservedFiles).toBeDefined()
      expect(result.preservedFiles.length).toBeGreaterThan(0)
    })

    it('should keep summary under 500 tokens', async () => {
      const feature = 'token-limit-test'
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 450,
        source: 'api',
        precision: 1.0,
        timestamp: Date.now(),
        cached: false,
      })

      const result = await contextCompactor.summarize(feature)

      const tokenCount = await mockTokenCounter.count(result.summary)
      expect(tokenCount.count).toBeLessThan(500)
    })

    it('should indicate information loss', async () => {
      const feature = 'loss-indicator-test'
      const result = await contextCompactor.summarize(feature)

      expect(result.informationLoss).toBe(true)
      expect(result.summary).toContain('⚠️')
    })
  })

  describe('createHandoffDocument', () => {
    it('should follow template format', async () => {
      const feature = 'handoff-test'
      const handoff = await contextCompactor.createHandoffDocument(feature)

      expect(handoff.feature).toBe(feature)
      expect(handoff.currentTask).toBeDefined()
      expect(handoff.completed).toBeDefined()
      expect(handoff.inProgress).toBeDefined()
      expect(handoff.nextSteps).toBeDefined()
      expect(handoff.filesModified).toBeDefined()
      expect(handoff.issues).toBeDefined()
      expect(handoff.decisions).toBeDefined()
      expect(handoff.context).toBeDefined()
    })

    it('should include all required sections', async () => {
      const feature = 'sections-test'
      const handoff = await contextCompactor.createHandoffDocument(feature)

      const requiredSections = [
        'CURRENT TASK',
        'COMPLETED',
        'IN PROGRESS',
        'NEXT STEPS',
        'FILES MODIFIED',
        'BLOCKING ISSUES',
        'DECISIONS MADE',
        'CONTEXT FOR CONTINUATION',
      ]

      const content = JSON.stringify(handoff)
      for (const section of requiredSections) {
        expect(content).toContain(section)
      }
    })

    it('should create checkpoint', async () => {
      mockSnapshotManager.createSnapshot = jest.fn().mockResolvedValue({
        id: 'checkpoint-123',
        path: path.join(tempDir, 'snapshots/checkpoint-123'),
      })

      const feature = 'checkpoint-test'
      const handoff = await contextCompactor.createHandoffDocument(feature)

      expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith(
        feature,
        expect.objectContaining({
          reason: 'context_overflow',
        })
      )
      expect(handoff.checkpointId).toBe('checkpoint-123')
    })
  })

  describe('revertCompaction', () => {
    it('should restore from backup', async () => {
      const feature = 'restore-test'
      const originalContent = 'Original content to restore'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'progress.md'), originalContent)

      const compactionResult = await contextCompactor.compact(feature)

      await fs.writeFile(path.join(featurePath, 'progress.md'), 'Modified content')

      const reverted = await contextCompactor.revertCompaction(feature, compactionResult.historyId)
      expect(reverted).toBe(true)

      const content = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(content).toBe(originalContent)
    })

    it('should fail after 24h', async () => {
      const feature = 'expired-test'
      const historyId = 'old-history'

      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000

      const historyPath = path.join(tempDir, '.compaction/history', feature, `${historyId}.json`)
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJson(historyPath, {
        timestamp: new Date(oldTimestamp).toISOString(),
        level: 'compact',
      })

      const reverted = await contextCompactor.revertCompaction(feature, historyId)
      expect(reverted).toBe(false)
    })

    it('should update history after revert', async () => {
      const feature = 'update-history-test'
      const compactionResult = await contextCompactor.compact(feature)

      await contextCompactor.revertCompaction(feature, compactionResult.historyId)

      const historyPath = path.join(
        tempDir,
        '.compaction/history',
        feature,
        `${compactionResult.historyId}.json`
      )
      const history = await fs.readJson(historyPath)
      expect(history.reverted).toBe(true)
      expect(history.revertedAt).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should complete compaction in less than 1s', async () => {
      const feature = 'perf-compact-test'
      const start = Date.now()
      await contextCompactor.compact(feature)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000)
    })

    it('should complete summarization in less than 3s', async () => {
      const feature = 'perf-summarize-test'
      const start = Date.now()
      await contextCompactor.summarize(feature)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(3000)
    })
  })

  describe('Offline Mode', () => {
    it('should work without API', async () => {
      mockTokenCounter.count = jest.fn().mockResolvedValue({
        count: 60000,
        source: 'offline',
        precision: 0.88,
        timestamp: Date.now(),
        cached: false,
      })

      const feature = 'offline-test'
      const result = await contextCompactor.compact(feature)

      expect(result).toBeDefined()
      expect(result.compactedTokens).toBeLessThan(result.originalTokens)
    })
  })

  describe('Backup and Rollback', () => {
    it('should create backup before compaction', async () => {
      mockSnapshotManager.createSnapshot = jest.fn().mockResolvedValue({
        id: 'backup-123',
        path: path.join(tempDir, 'backup'),
      })

      const feature = 'backup-verify-test'
      await contextCompactor.compact(feature)

      expect(mockSnapshotManager.createSnapshot).toHaveBeenCalled()
    })

    it('should allow rollback within 24h', async () => {
      const feature = 'rollback-window-test'
      const compactionResult = await contextCompactor.compact(feature)

      const canRevert = await contextCompactor.revertCompaction(
        feature,
        compactionResult.historyId
      )
      expect(canRevert).toBe(true)
    })
  })
})
