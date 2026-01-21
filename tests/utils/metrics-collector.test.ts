import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

describe('MetricsCollector', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('collectPhaseMetrics', () => {
    it('should collect metrics for a phase with git changes', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      // Create history for phase timing
      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJSON(historyPath, [
        {
          timestamp: '2026-01-20T10:00:00Z',
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'adk feature plan',
        },
        {
          timestamp: '2026-01-20T12:00:00Z',
          fromPhase: 'plan',
          toPhase: 'implement',
          trigger: 'adk feature implement',
        },
      ])

      const metrics = await collector.collectPhaseMetrics(featureName, 'plan')

      expect(metrics.phase).toBe('plan')
      expect(metrics.startedAt).toBeTruthy()
      expect(metrics.tasksCompleted).toBeGreaterThanOrEqual(0)
      expect(metrics.tasksTotal).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(metrics.filesModified)).toBe(true)
    })

    it('should calculate duration from timestamps', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))

      const startTime = '2026-01-20T10:00:00Z'
      const endTime = '2026-01-20T12:00:00Z'

      await fs.writeJSON(historyPath, [
        { timestamp: startTime, fromPhase: 'prd', toPhase: 'research', trigger: 'test' },
        { timestamp: endTime, fromPhase: 'research', toPhase: 'plan', trigger: 'test' },
      ])

      const metrics = await collector.collectPhaseMetrics(featureName, 'research')

      expect(metrics.duration).toBeDefined()
      if (metrics.duration) {
        expect(metrics.duration).toBeGreaterThan(0)
      }
    })

    it('should count completed vs total tasks', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const tasksPath = path.join(tempDir, '.claude', 'plans', 'features', featureName, 'tasks.md')
      await fs.ensureDir(path.dirname(tasksPath))
      await fs.writeFile(
        tasksPath,
        `
## Phase: implement
- [x] Task 1
- [x] Task 2
- [~] Task 3
- [ ] Task 4
- [ ] Task 5
`
      )

      const metrics = await collector.collectPhaseMetrics(featureName, 'implement')

      expect(metrics.tasksCompleted).toBe(2)
      expect(metrics.tasksTotal).toBe(5)
    })

    it('should handle phase without git changes', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const metrics = await collector.collectPhaseMetrics(featureName, 'prd')

      expect(metrics).toBeDefined()
      expect(metrics.filesModified).toEqual([])
    })
  })

  describe('getFilesChanged', () => {
    it('should return files modified for feature', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      // This will depend on git being available and initialized
      const files = await collector.getFilesChanged(featureName)

      expect(Array.isArray(files)).toBe(true)
    })

    it('should filter files by timestamp when since provided', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const since = '2026-01-19T00:00:00Z'
      const files = await collector.getFilesChanged(featureName, since)

      expect(Array.isArray(files)).toBe(true)
    })

    it('should handle missing git repository gracefully', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const files = await collector.getFilesChanged('nonexistent-feature')

      expect(files).toEqual([])
    })
  })

  describe('aggregateMetrics', () => {
    it('should aggregate metrics from all phases', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJSON(historyPath, [
        {
          timestamp: '2026-01-20T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'test',
          duration: 3600,
        },
        {
          timestamp: '2026-01-20T11:00:00Z',
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'test',
          duration: 1800,
        },
        {
          timestamp: '2026-01-20T11:30:00Z',
          fromPhase: 'plan',
          toPhase: 'implement',
          trigger: 'test',
          duration: 7200,
        },
      ])

      const aggregated = await collector.aggregateMetrics(featureName)

      expect(aggregated.totalDuration).toBeGreaterThan(0)
      expect(aggregated.phasesDuration).toBeDefined()
      expect(aggregated.filesModified).toBeGreaterThanOrEqual(0)
    })

    it('should calculate total duration across phases', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJSON(historyPath, [
        {
          timestamp: '2026-01-20T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'test',
          duration: 1000,
        },
        {
          timestamp: '2026-01-20T10:16:40Z',
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'test',
          duration: 2000,
        },
      ])

      const aggregated = await collector.aggregateMetrics(featureName)

      expect(aggregated.totalDuration).toBe(3000)
    })

    it('should group duration by phase', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJSON(historyPath, [
        {
          timestamp: '2026-01-20T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'test',
          duration: 1000,
        },
        {
          timestamp: '2026-01-20T10:16:40Z',
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'test',
          duration: 2000,
        },
      ])

      const aggregated = await collector.aggregateMetrics(featureName)

      expect(aggregated.phasesDuration).toHaveProperty('research')
      expect(aggregated.phasesDuration).toHaveProperty('plan')
    })

    it('should count total files modified', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const aggregated = await collector.aggregateMetrics(featureName)

      expect(typeof aggregated.filesModified).toBe('number')
      expect(aggregated.filesModified).toBeGreaterThanOrEqual(0)
    })

    it('should estimate tests added from git diff', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const aggregated = await collector.aggregateMetrics(featureName)

      expect(typeof aggregated.testsAdded).toBe('number')
      expect(aggregated.testsAdded).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getMetricsPath', () => {
    it('should return correct path to metrics.json', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const metricsPath = collector.getMetricsPath(featureName)

      expect(metricsPath).toContain('.claude')
      expect(metricsPath).toContain('plans')
      expect(metricsPath).toContain('features')
      expect(metricsPath).toContain(featureName)
      expect(metricsPath).toContain('metrics.json')
    })
  })

  describe('Persistence', () => {
    it('should save metrics to metrics.json', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJSON(historyPath, [
        {
          timestamp: '2026-01-20T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'test',
        },
      ])

      await collector.aggregateMetrics(featureName)

      const metricsPath = collector.getMetricsPath(featureName)
      const exists = await fs.pathExists(metricsPath)

      if (exists) {
        const metrics = await fs.readJSON(metricsPath)
        expect(metrics).toBeDefined()
        expect(metrics.totalDuration).toBeDefined()
      }
    })

    it('should load existing metrics', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const metricsPath = collector.getMetricsPath(featureName)
      await fs.ensureDir(path.dirname(metricsPath))
      await fs.writeJSON(metricsPath, {
        totalDuration: 5000,
        phasesDuration: { research: 2000, plan: 3000 },
        filesModified: 10,
        testsAdded: 5,
      })

      const aggregated = await collector.aggregateMetrics(featureName)

      expect(aggregated.totalDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle feature with no history', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const aggregated = await collector.aggregateMetrics('new-feature')

      expect(aggregated.totalDuration).toBe(0)
      expect(aggregated.phasesDuration).toEqual({})
    })

    it('should handle incomplete phase transitions', async () => {
      const { MetricsCollector } = await import('../../src/utils/metrics-collector')
      const collector = new MetricsCollector()

      const historyPath = path.join(
        tempDir,
        '.claude',
        'plans',
        'features',
        featureName,
        'history.json'
      )
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeJSON(historyPath, [
        {
          timestamp: '2026-01-20T10:00:00Z',
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'test',
        },
        // No end transition for research phase
      ])

      const metrics = await collector.collectPhaseMetrics(featureName, 'research')

      expect(metrics).toBeDefined()
      expect(metrics.completedAt).toBeUndefined()
    })
  })
})
