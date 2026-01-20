import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

describe('HistoryTracker', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'history-tracker-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('recordTransition', () => {
    it('should create history.json on first transition', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entry = {
        timestamp: new Date().toISOString(),
        fromPhase: 'prd',
        toPhase: 'research',
        trigger: 'adk feature research',
      }

      await tracker.recordTransition(featureName, entry)

      const historyPath = tracker.getHistoryPath(featureName)
      const exists = await fs.pathExists(historyPath)
      expect(exists).toBe(true)
    })

    it('should append transitions to existing history', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entry1 = {
        timestamp: new Date().toISOString(),
        fromPhase: 'prd',
        toPhase: 'research',
        trigger: 'adk feature research',
      }

      const entry2 = {
        timestamp: new Date().toISOString(),
        fromPhase: 'research',
        toPhase: 'plan',
        trigger: 'adk feature plan',
      }

      await tracker.recordTransition(featureName, entry1)
      await tracker.recordTransition(featureName, entry2)

      const history = await tracker.getHistory(featureName)
      expect(history).toHaveLength(2)
    })

    it('should record transition with optional duration', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entry = {
        timestamp: new Date().toISOString(),
        fromPhase: 'research',
        toPhase: 'plan',
        trigger: 'adk feature plan',
        duration: 3600,
      }

      await tracker.recordTransition(featureName, entry)

      const history = await tracker.getHistory(featureName)
      expect(history[0].duration).toBe(3600)
    })

    it('should use atomic writes to prevent corruption', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entries = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        fromPhase: `phase${i}`,
        toPhase: `phase${i + 1}`,
        trigger: 'test',
      }))

      // Rapid concurrent writes
      await Promise.all(entries.map(e => tracker.recordTransition(featureName, e)))

      const history = await tracker.getHistory(featureName)
      expect(history.length).toBe(10)
    })
  })

  describe('getHistory', () => {
    it('should return history in chronological order', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const baseTime = Date.now()
      const entries = [
        {
          timestamp: new Date(baseTime).toISOString(),
          fromPhase: 'prd',
          toPhase: 'research',
          trigger: 'test',
        },
        {
          timestamp: new Date(baseTime + 1000).toISOString(),
          fromPhase: 'research',
          toPhase: 'plan',
          trigger: 'test',
        },
        {
          timestamp: new Date(baseTime + 2000).toISOString(),
          fromPhase: 'plan',
          toPhase: 'implement',
          trigger: 'test',
        },
      ]

      for (const entry of entries) {
        await tracker.recordTransition(featureName, entry)
      }

      const history = await tracker.getHistory(featureName)

      expect(history).toHaveLength(3)
      expect(history[0].fromPhase).toBe('prd')
      expect(history[2].toPhase).toBe('implement')
    })

    it('should return last N entries when limit specified', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      for (let i = 0; i < 10; i++) {
        await tracker.recordTransition(featureName, {
          timestamp: new Date().toISOString(),
          fromPhase: `phase${i}`,
          toPhase: `phase${i + 1}`,
          trigger: 'test',
        })
      }

      const history = await tracker.getHistory(featureName, 5)

      expect(history).toHaveLength(5)
      expect(history[4].toPhase).toBe('phase10')
    })

    it('should return empty array when no history exists', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const history = await tracker.getHistory('nonexistent-feature')

      expect(history).toEqual([])
    })

    it('should handle corrupted history.json gracefully', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const historyPath = tracker.getHistoryPath(featureName)
      await fs.ensureDir(path.dirname(historyPath))
      await fs.writeFile(historyPath, 'invalid json{]')

      const history = await tracker.getHistory(featureName)

      expect(history).toEqual([])
    })
  })

  describe('pruneHistory', () => {
    it('should remove oldest entries when exceeding limit', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      for (let i = 0; i < 60; i++) {
        await tracker.recordTransition(featureName, {
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          fromPhase: `phase${i}`,
          toPhase: `phase${i + 1}`,
          trigger: 'test',
        })
      }

      const removed = await tracker.pruneHistory(featureName, 50)

      expect(removed).toBe(10)

      const history = await tracker.getHistory(featureName)
      expect(history).toHaveLength(50)
    })

    it('should keep most recent entries after pruning', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      for (let i = 0; i < 100; i++) {
        await tracker.recordTransition(featureName, {
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          fromPhase: `phase${i}`,
          toPhase: `phase${i + 1}`,
          trigger: 'test',
        })
      }

      await tracker.pruneHistory(featureName, 10)

      const history = await tracker.getHistory(featureName)
      expect(history).toHaveLength(10)
      expect(history[9].toPhase).toBe('phase100')
    })

    it('should return 0 when nothing to prune', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      for (let i = 0; i < 10; i++) {
        await tracker.recordTransition(featureName, {
          timestamp: new Date().toISOString(),
          fromPhase: `phase${i}`,
          toPhase: `phase${i + 1}`,
          trigger: 'test',
        })
      }

      const removed = await tracker.pruneHistory(featureName, 50)

      expect(removed).toBe(0)
    })
  })

  describe('getHistoryPath', () => {
    it('should return correct path to history.json', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const historyPath = tracker.getHistoryPath(featureName)

      expect(historyPath).toContain('.claude')
      expect(historyPath).toContain('plans')
      expect(historyPath).toContain('features')
      expect(historyPath).toContain(featureName)
      expect(historyPath).toContain('history.json')
    })
  })

  describe('Auto-pruning', () => {
    it('should auto-prune when recording transition exceeds max (50 entries)', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      for (let i = 0; i < 55; i++) {
        await tracker.recordTransition(featureName, {
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          fromPhase: `phase${i}`,
          toPhase: `phase${i + 1}`,
          trigger: 'test',
        })
      }

      const history = await tracker.getHistory(featureName)

      // Should auto-prune to max 50 entries
      expect(history.length).toBeLessThanOrEqual(50)
    })
  })

  describe('Transition Metadata', () => {
    it('should include all required fields in transition entry', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entry = {
        timestamp: '2026-01-20T10:30:00Z',
        fromPhase: 'research',
        toPhase: 'plan',
        trigger: 'adk feature plan',
        duration: 1800,
      }

      await tracker.recordTransition(featureName, entry)

      const history = await tracker.getHistory(featureName)
      const saved = history[0]

      expect(saved.timestamp).toBe(entry.timestamp)
      expect(saved.fromPhase).toBe(entry.fromPhase)
      expect(saved.toPhase).toBe(entry.toPhase)
      expect(saved.trigger).toBe(entry.trigger)
      expect(saved.duration).toBe(entry.duration)
    })

    it('should handle missing optional fields', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entry = {
        timestamp: new Date().toISOString(),
        fromPhase: 'prd',
        toPhase: 'research',
        trigger: 'manual',
      }

      await tracker.recordTransition(featureName, entry)

      const history = await tracker.getHistory(featureName)
      expect(history[0].duration).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle feature names with special characters', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const specialName = 'feature-with-@special_chars'

      await tracker.recordTransition(specialName, {
        timestamp: new Date().toISOString(),
        fromPhase: 'start',
        toPhase: 'end',
        trigger: 'test',
      })

      const history = await tracker.getHistory(specialName)
      expect(history).toHaveLength(1)
    })

    it('should handle rapid sequential writes', async () => {
      const { HistoryTracker } = await import('../../src/utils/history-tracker')
      const tracker = new HistoryTracker()

      const entries = Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(Date.now() + i).toISOString(),
        fromPhase: `phase${i}`,
        toPhase: `phase${i + 1}`,
        trigger: 'rapid',
      }))

      for (const entry of entries) {
        await tracker.recordTransition(featureName, entry)
      }

      const history = await tracker.getHistory(featureName)
      expect(history).toHaveLength(20)
    })
  })
})
