import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'

describe('Handoff Document System', () => {
  let tempDir: string
  let featureName: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'handoff-test-'))
    featureName = 'test-feature'
    process.env.TEST_FEATURE_PATH = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_FEATURE_PATH
  })

  describe('createHandoffDocument', () => {
    it('should generate document in correct format', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 60,
        tasks: [
          { name: 'Setup project', status: 'completed' as const, priority: 0 },
          { name: 'Create schema', status: 'completed' as const, priority: 0 },
          { name: 'Implement auth', status: 'in_progress' as const, priority: 0 },
          { name: 'Add tests', status: 'pending' as const, priority: 0 },
          { name: 'Deploy', status: 'pending' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('CURRENT:')
      expect(document).toContain('DONE:')
      expect(document).toContain('IN PROGRESS:')
      expect(document).toContain('NEXT:')
      expect(document).toContain('FILES:')
      expect(document).toContain('ISSUES:')
    })

    it('should include completed tasks in DONE section', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Setup project', status: 'completed' as const, priority: 0 },
          { name: 'Create schema', status: 'completed' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('Setup project')
      expect(document).toContain('Create schema')
    })

    it('should include in-progress tasks in IN PROGRESS section', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 30,
        tasks: [{ name: 'Implement auth', status: 'in_progress' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('Implement auth')
    })

    it('should include pending tasks in NEXT section', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 20,
        tasks: [
          { name: 'Add tests', status: 'pending' as const, priority: 0 },
          { name: 'Deploy', status: 'pending' as const, priority: 1 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('Add tests')
      expect(document).toContain('Deploy')
    })

    it('should show progress percentage in CURRENT section', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 60,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toMatch(/60%|60 %/)
    })

    it('should list modified files', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      await fs.ensureDir(featurePath)
      await fs.writeFile(path.join(featurePath, 'file1.ts'), 'content')
      await fs.writeFile(path.join(featurePath, 'file2.ts'), 'content')

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('FILES:')
    })

    it('should include blocking issues if any', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [
          { name: 'Task 1', status: 'blocked' as const, priority: 0, blockedBy: 'API issue' },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('ISSUES:')
    })

    it('should show "None blocking" when no issues', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'pending' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const document = await manager.createHandoffDocument(featureName)

      expect(document).toContain('None blocking')
    })

    it('should complete in < 300ms', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: Array.from({ length: 50 }, (_, i) => ({
          name: `Task ${i}`,
          status: i % 2 === 0 ? ('completed' as const) : ('pending' as const),
          priority: 0,
        })),
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const start = Date.now()
      await manager.createHandoffDocument(featureName)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(300)
    })
  })

  describe('parseHandoffDocument', () => {
    it('should parse valid document', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const validDocument = await fs.readFile(
        path.join(__dirname, '../fixtures/sessions/claude-progress-valid.txt'),
        'utf-8'
      )

      const parsed = manager.parseHandoffDocument(validDocument)

      expect(parsed.current).toContain('Implementing authentication')
      expect(parsed.done).toContain('Setup project structure')
      expect(parsed.inProgress).toContain('Implementing authentication middleware')
      expect(parsed.next).toContain('Add tests for authentication')
      expect(parsed.files).toContain('src/auth/middleware.ts')
      expect(parsed.issues).toBe('None blocking')
    })

    it('should be tolerant to malformed input', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const malformedDocument = await fs.readFile(
        path.join(__dirname, '../fixtures/sessions/claude-progress-malformed.txt'),
        'utf-8'
      )

      const parsed = manager.parseHandoffDocument(malformedDocument)

      expect(parsed).toHaveProperty('current')
      expect(parsed).toHaveProperty('done')
      expect(parsed).toHaveProperty('inProgress')
      expect(parsed).toHaveProperty('next')
      expect(parsed).toHaveProperty('files')
      expect(parsed).toHaveProperty('issues')
    })

    it('should handle empty sections gracefully', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const emptyDocument = `
CURRENT: Starting new feature

DONE:

IN PROGRESS:

NEXT:
1. Task 1

FILES:

ISSUES: None
      `

      const parsed = manager.parseHandoffDocument(emptyDocument)

      expect(parsed.done).toEqual([])
      expect(parsed.inProgress).toEqual([])
      expect(parsed.files).toEqual([])
    })

    it('should extract numbered list from NEXT section', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const document = `
CURRENT: Working

DONE:

IN PROGRESS:

NEXT:
1. First task
2. Second task
3. Third task

FILES:

ISSUES: None
      `

      const parsed = manager.parseHandoffDocument(document)

      expect(parsed.next).toHaveLength(3)
      expect(parsed.next[0]).toContain('First task')
      expect(parsed.next[1]).toContain('Second task')
    })

    it('should parse comma-separated files', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const document = `
CURRENT: Working

DONE:

IN PROGRESS:

NEXT:

FILES: file1.ts, file2.ts, file3.ts

ISSUES: None
      `

      const parsed = manager.parseHandoffDocument(document)

      expect(parsed.files).toHaveLength(3)
      expect(parsed.files).toContain('file1.ts')
      expect(parsed.files).toContain('file2.ts')
    })
  })

  describe('createContextSummary', () => {
    it('should generate concise summary', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 60,
        tasks: [
          { name: 'Task 1', status: 'completed' as const, priority: 0 },
          { name: 'Task 2', status: 'in_progress' as const, priority: 0 },
          { name: 'Task 3', status: 'pending' as const, priority: 0 },
        ],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const summary = await manager.createContextSummary(featureName)

      expect(summary).toBeTruthy()
      expect(summary.length).toBeGreaterThan(0)
      expect(summary.length).toBeLessThan(500)
    })

    it('should include current phase', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const summary = await manager.createContextSummary(featureName)

      expect(summary.toLowerCase()).toContain('implement')
    })

    it('should include progress percentage', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 75,
        tasks: [],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const summary = await manager.createContextSummary(featureName)

      expect(summary).toContain('75')
    })
  })

  describe('Integration with Checkpoint System', () => {
    it('should create handoff document on checkpoint', async () => {
      const { StateManager } = await import('../../src/utils/state-manager')
      const manager = new StateManager()

      const state = {
        feature: featureName,
        currentPhase: 'implement',
        progress: 50,
        tasks: [{ name: 'Task 1', status: 'completed' as const, priority: 0 }],
        transitions: [],
        lastUpdated: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
      }

      await manager.saveUnifiedState(featureName, state)

      const sessionId = await manager.createSession(featureName)
      await manager.endSession(featureName, sessionId, 'session_end')

      const featurePath = path.join(tempDir, '.claude', 'plans', 'features', featureName)
      const handoffPath = path.join(featurePath, 'claude-progress.txt')

      expect(await fs.pathExists(handoffPath)).toBe(true)

      const content = await fs.readFile(handoffPath, 'utf-8')
      expect(content).toContain('CURRENT:')
      expect(content).toContain('DONE:')
    })
  })
})
