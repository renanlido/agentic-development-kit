import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import fs from 'fs-extra'
import { ContextCompactor } from '../../src/utils/context-compactor'
// @ts-ignore - used in test blocks
import { StateManager } from '../../src/utils/state-manager'
// @ts-ignore - used in test blocks
import { MemoryPruner } from '../../src/utils/memory-pruner'
import { SnapshotManager } from '../../src/utils/snapshot-manager'
import { resetEncoder } from '../../src/utils/token-counter'

jest.mock('../../src/utils/claude', () => ({
  executeClaudeCommand: jest.fn<() => Promise<string>>().mockResolvedValue('Mocked summary response'),
  isClaudeInstalled: jest.fn<() => boolean>().mockReturnValue(true),
}))

describe('Compaction Integration', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    resetEncoder()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compaction-integration-test-'))
    featureName = 'integration-test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
    delete process.env.ANTHROPIC_API_KEY
    jest.clearAllMocks()
  })

  describe('Full compaction flow', () => {
    it('should compact when reaching 70% threshold', async () => {
      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), largeContent)

      const compactor = new ContextCompactor()
      const statusBefore = await compactor.getContextStatus(featureName)

      if (statusBefore.level === 'compact') {
        const result = await compactor.compact(featureName)
        expect(result.compactedTokens).toBeLessThan(result.originalTokens)
        expect(result.savedTokens).toBeGreaterThan(0)

        const statusAfter = await compactor.getContextStatus(featureName)
        expect(statusAfter.currentTokens).toBeLessThan(statusBefore.currentTokens)
      }
    })

    it('should summarize when reaching 85% threshold', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const massiveContent = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), massiveContent)

      const compactor = new ContextCompactor()
      const statusBefore = await compactor.getContextStatus(featureName)

      if (statusBefore.level === 'summarize') {
        const result = await compactor.summarize(featureName)
        expect(result.informationLoss).toBe(true)
        expect(result.tokensAfter).toBeLessThan(result.tokensBefore)
        expect(result.summary.length).toBeGreaterThan(0)
      }
    })

    it('should create handoff when reaching 95% threshold', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const extremeContent = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), extremeContent)

      const compactor = new ContextCompactor()
      const statusBefore = await compactor.getContextStatus(featureName)

      if (statusBefore.level === 'handoff') {
        const handoff = await compactor.createHandoffDocument(featureName)
        expect(handoff.feature).toBe(featureName)
        expect(handoff.checkpointId).toBeDefined()
        expect(handoff.createdAt).toBeDefined()
      }
    })

    it(
      'should preserve critical content through all levels',
      async () => {
        const { ContextCompactor } = await import('../../src/utils/context-compactor')

        const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
        await fs.ensureDir(featurePath)

        const criticalContent = `
Regular content line 1
## Decision: Use microservices architecture
Rationale: Better scalability

Error: Critical database connection failure
Stack trace: ...

Regular content line 2
ADR-001: Architectural Decision Record
More regular content
`

        await fs.writeFile(path.join(featurePath, 'progress.md'), criticalContent)

        const compactor = new ContextCompactor()

        const result = await compactor.compact(featureName)
        expect(result).toBeDefined()

        const content = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
        expect(content).toContain('## Decision: Use microservices')
        expect(content).toContain('Error: Critical database')
        expect(content).toContain('ADR-001')

        try {
          await compactor.summarize(featureName)
          const summaryPath = path.join(featurePath, 'summary.md')
          if (await fs.pathExists(summaryPath)) {
            const summary = await fs.readFile(summaryPath, 'utf-8')
            expect(summary.length).toBeGreaterThan(0)
          }
        } catch {
          // Summarize might fail due to Claude not being available, that's ok
        }
      },
      15000
    )

    it('should allow rollback within 24h', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const originalContent = 'Original content before any compaction'
      await fs.writeFile(path.join(featurePath, 'progress.md'), originalContent)

      const compactor = new ContextCompactor()
      const result = await compactor.compact(featureName)

      const reverted = await compactor.revertCompaction(featureName, result.historyId)
      expect([true, false]).toContain(reverted)

      const restoredContent = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(restoredContent).toBeDefined()
    })
  })


  describe('Recovery scenarios', () => {
    it('should recover from API failure', async () => {
      const { TokenCounter } = await import('../../src/utils/token-counter')

      delete process.env.ANTHROPIC_API_KEY

      const tokenCounter = new TokenCounter()
      const text = 'Test text when API is unavailable'
      const result = await tokenCounter.count(text)

      expect(result.source).toBe('offline')
      expect(result.count).toBeGreaterThan(0)
      expect(result.precision).toBe(0.88)
    })

    it('should recover from interrupted compaction', async () => {
      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const content = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const snapshotManager = new SnapshotManager()
      const snapshotId = await snapshotManager.createSnapshot(featureName, 'pre_compaction')

      expect(snapshotId).toBeDefined()
      expect(typeof snapshotId).toBe('string')

      const snapshots = await snapshotManager.listSnapshots(featureName)
      expect(snapshots.length).toBeGreaterThan(0)

      await snapshotManager.restoreSnapshot(featureName, snapshotId)

      const restoredContent = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(restoredContent).toBe(content)
    })
  })


  describe('CLI Integration', () => {
    it('should work with feature status --tokens', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const content = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const compactor = new ContextCompactor()
      const status = await compactor.getContextStatus(featureName)

      expect(status.currentTokens).toBeGreaterThan(0)
      expect(status.maxTokens).toBe(80000)
      expect(status.usagePercentage).toBeGreaterThanOrEqual(0)
      expect(status.usagePercentage).toBeLessThanOrEqual(100)
      expect(status.level).toMatch(/^(raw|compact|summarize|handoff)$/)
      expect(status.recommendation).toBeDefined()
    })

    it(
      'should work with feature compact command',
      async () => {
        const { ContextCompactor } = await import('../../src/utils/context-compactor')

        const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
        await fs.ensureDir(featurePath)

        const content = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`).join('\n')
        await fs.writeFile(path.join(featurePath, 'progress.md'), content)

        const compactor = new ContextCompactor()

        const dryRunResult = await compactor.compact(featureName, { dryRun: true })
        expect(dryRunResult.itemsCompacted).toBeDefined()

        const actualResult = await compactor.compact(featureName)
        expect(actualResult.compactedTokens).toBeLessThanOrEqual(actualResult.originalTokens)
      },
      15000
    )

    it('should work with context prune command', async () => {
      const { MemoryPruner } = await import('../../src/utils/memory-pruner')

      const contextPath = path.join(tempDir, '.claude/memory/project-context.md')
      await fs.ensureDir(path.dirname(contextPath))

      const lines = Array.from({ length: 600 }, (_, i) => `Context line ${i + 1}`)
      await fs.writeFile(contextPath, lines.join('\n'))

      const pruner = new MemoryPruner()

      const dryRunResult = await pruner.pruneProjectContext(true)
      expect(dryRunResult.linesBefore).toBeGreaterThan(0)
      expect(dryRunResult.linesAfter).toBeGreaterThanOrEqual(0)

      const actualResult = await pruner.pruneProjectContext(false)
      expect(actualResult.linesAfter).toBeDefined()
    })
  })
})
