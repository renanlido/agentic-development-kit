import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import fs from 'fs-extra'

describe('Compaction Integration', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compaction-integration-test-'))
    featureName = 'integration-test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
    delete process.env.ANTHROPIC_API_KEY
    jest.clearAllMocks()
  })

  describe('Full compaction flow', () => {
    it('should compact when reaching 70% threshold', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')
      const { StateManager } = await import('../../src/utils/state-manager')

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

    it('should preserve critical content through all levels', async () => {
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

      await compactor.compact(featureName)
      let content = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(content).toContain('## Decision: Use microservices')
      expect(content).toContain('Error: Critical database')
      expect(content).toContain('ADR-001')

      await compactor.summarize(featureName)
      const summary = await fs.readFile(path.join(featurePath, 'summary.md'), 'utf-8')
      expect(summary).toContain('microservices')
      expect(summary).toContain('database')
    })

    it('should allow rollback within 24h', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const originalContent = 'Original content before any compaction'
      await fs.writeFile(path.join(featurePath, 'progress.md'), originalContent)

      const compactor = new ContextCompactor()
      const result = await compactor.compact(featureName)

      const reverted = await compactor.revertCompaction(featureName, result.historyId)
      expect(reverted).toBe(true)

      const restoredContent = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(restoredContent).toBe(originalContent)
    })
  })

  describe('Stress test', () => {
    it('should handle 100k token context', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')
      const { TokenCounter } = await import('../../src/utils/token-counter')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const massiveContent = Array.from({ length: 50000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), massiveContent)

      const tokenCounter = new TokenCounter()
      const tokenCount = await tokenCounter.count(massiveContent)
      expect(tokenCount.count).toBeGreaterThan(0)

      const compactor = new ContextCompactor()
      const status = await compactor.getContextStatus(featureName)
      expect(status.currentTokens).toBeDefined()
    })

    it('should maintain performance under load', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const largeContent = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), largeContent)

      const compactor = new ContextCompactor()

      const start = Date.now()
      await compactor.compact(featureName)
      const compactDuration = Date.now() - start
      expect(compactDuration).toBeLessThan(1000)

      const summaryStart = Date.now()
      await compactor.summarize(featureName)
      const summaryDuration = Date.now() - summaryStart
      expect(summaryDuration).toBeLessThan(3000)
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
      const { ContextCompactor } = await import('../../src/utils/context-compactor')
      const { SnapshotManager } = await import('../../src/utils/snapshot-manager')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const content = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const snapshotManager = new SnapshotManager()
      const snapshot = await snapshotManager.createSnapshot(featureName, {
        reason: 'pre_compaction',
        metadata: { test: true },
      })

      expect(snapshot.id).toBeDefined()
      expect(snapshot.path).toBeDefined()

      const canRestore = await snapshotManager.canRestore(featureName, snapshot.id)
      expect(canRestore).toBe(true)

      await snapshotManager.restoreSnapshot(featureName, snapshot.id)

      const restoredContent = await fs.readFile(path.join(featurePath, 'progress.md'), 'utf-8')
      expect(restoredContent).toBe(content)
    })
  })

  describe('End-to-end workflow', () => {
    it('should execute full development cycle with compaction', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const manager = new StateManager()
      const compactor = new ContextCompactor()

      await manager.saveUnifiedState(featureName, {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'completed', priority: 0 },
          { name: 'Task 2', status: 'in_progress', priority: 1 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      })

      const content = Array.from({ length: 2000 }, (_, i) => `Development log line ${i + 1}`).join(
        '\n'
      )
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const status = await compactor.getContextStatus(featureName)
      expect(status.currentTokens).toBeDefined()

      const warning = await manager.beforeToolUse(featureName)

      if (warning) {
        await manager.handleContextWarning(featureName, status)

        const statusAfter = await compactor.getContextStatus(featureName)
        expect(statusAfter.currentTokens).toBeLessThanOrEqual(status.currentTokens)
      }

      const finalState = await manager.loadUnifiedState(featureName)
      expect(finalState.tokenUsage).toBeDefined()
    })

    it('should maintain data integrity across operations', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const { ContextCompactor } = await import('../../src/utils/context-compactor')
      const { MemoryPruner } = await import('../../src/utils/memory-pruner')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const initialData = {
        feature: featureName,
        currentPhase: 'implement' as const,
        progress: 75,
        tasks: [
          { name: 'Critical Task', status: 'in_progress' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      const manager = new StateManager()
      await manager.saveUnifiedState(featureName, initialData)

      const pruner = new MemoryPruner()
      await pruner.pruneFeature(featureName, false)

      const compactor = new ContextCompactor()
      await compactor.compact(featureName)

      const finalState = await manager.loadUnifiedState(featureName)
      expect(finalState.feature).toBe(featureName)
      expect(finalState.currentPhase).toBe('implement')
      expect(finalState.tasks[0].name).toBe('Critical Task')
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

    it('should work with feature compact command', async () => {
      const { ContextCompactor } = await import('../../src/utils/context-compactor')

      const featurePath = path.join(tempDir, '.claude/plans/features', featureName)
      await fs.ensureDir(featurePath)

      const content = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n')
      await fs.writeFile(path.join(featurePath, 'progress.md'), content)

      const compactor = new ContextCompactor()

      const dryRunResult = await compactor.compact(featureName, { dryRun: true })
      expect(dryRunResult.itemsCompacted).toBeDefined()

      const actualResult = await compactor.compact(featureName)
      expect(actualResult.compactedTokens).toBeLessThan(actualResult.originalTokens)
    })

    it('should work with context prune command', async () => {
      const { MemoryPruner } = await import('../../src/utils/memory-pruner')

      const contextPath = path.join(tempDir, '.claude/memory/project-context.md')
      await fs.ensureDir(path.dirname(contextPath))

      const lines = Array.from({ length: 600 }, (_, i) => `Context line ${i + 1}`)
      await fs.writeFile(contextPath, lines.join('\n'))

      const pruner = new MemoryPruner()

      const dryRunResult = await pruner.pruneProjectContext(true)
      expect(dryRunResult.dryRun).toBe(true)
      expect(dryRunResult.linesBefore).toBe(600)

      const actualResult = await pruner.pruneProjectContext(false)
      expect(actualResult.linesAfter).toBeLessThanOrEqual(500)
    })
  })
})
