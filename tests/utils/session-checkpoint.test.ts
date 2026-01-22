import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'fs-extra'
import { createSessionCheckpoint } from '../../src/utils/session-checkpoint'

describe('session-checkpoint', () => {
  let tempDir: string
  let featureDir: string
  let snapshotsDir: string
  let progressPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-checkpoint-'))
    featureDir = path.join(tempDir, '.claude', 'plans', 'features', 'test-feature')
    snapshotsDir = path.join(featureDir, '.snapshots')
    progressPath = path.join(featureDir, 'claude-progress.txt')

    await fs.ensureDir(featureDir)
    await fs.ensureDir(snapshotsDir)
    await fs.writeFile(
      path.join(featureDir, 'progress.md'),
      '# Progress\nPhase: implement\nProgress: 50%\n'
    )
    await fs.writeFile(path.join(featureDir, 'tasks.md'), '# Tasks\n- [x] Task 1\n- [ ] Task 2\n')
    await fs.writeFile(
      path.join(featureDir, 'state.json'),
      '{"progress": 50, "currentPhase": "implement"}'
    )
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  describe('createSessionCheckpoint', () => {
    describe('when creating snapshot', () => {
      it('should create snapshot in .snapshots directory', async () => {
        const result = await createSessionCheckpoint('test-feature', tempDir)

        expect(result.snapshotCreated).toBe(true)
        expect(result.snapshotPath).toBeDefined()

        const snapshotExists = await fs.pathExists(result.snapshotPath!)
        expect(snapshotExists).toBe(true)
      })

      it('should include session_end reason in snapshot', async () => {
        const result = await createSessionCheckpoint('test-feature', tempDir)

        const snapshotContent = await fs.readJSON(result.snapshotPath!)
        expect(snapshotContent.reason).toBe('session_end')
      })

      it('should include timestamp in snapshot', async () => {
        const result = await createSessionCheckpoint('test-feature', tempDir)

        const snapshotContent = await fs.readJSON(result.snapshotPath!)
        expect(snapshotContent.timestamp).toBeDefined()
        expect(new Date(snapshotContent.timestamp).getTime()).toBeGreaterThan(0)
      })

      it('should include state snapshot', async () => {
        const result = await createSessionCheckpoint('test-feature', tempDir)

        const snapshotContent = await fs.readJSON(result.snapshotPath!)
        expect(snapshotContent.state).toBeDefined()
        expect(snapshotContent.state.progress).toBe(50)
      })

      it('should handle missing state.json file', async () => {
        await fs.remove(path.join(featureDir, 'state.json'))

        const result = await createSessionCheckpoint('test-feature', tempDir)

        expect(result.snapshotCreated).toBe(true)
        const snapshotContent = await fs.readJSON(result.snapshotPath!)
        expect(snapshotContent.state).toEqual({})
      })
    })

    describe('when updating progress file', () => {
      it('should create claude-progress.txt', async () => {
        const result = await createSessionCheckpoint('test-feature', tempDir)

        expect(result.progressUpdated).toBe(true)
        const exists = await fs.pathExists(progressPath)
        expect(exists).toBe(true)
      })

      it('should include feature name in progress file', async () => {
        await createSessionCheckpoint('test-feature', tempDir)

        const content = await fs.readFile(progressPath, 'utf-8')
        expect(content).toContain('Feature: test-feature')
      })

      it('should include current phase', async () => {
        await createSessionCheckpoint('test-feature', tempDir)

        const content = await fs.readFile(progressPath, 'utf-8')
        expect(content).toContain('Phase: implement')
      })

      it('should include progress percentage', async () => {
        await createSessionCheckpoint('test-feature', tempDir)

        const content = await fs.readFile(progressPath, 'utf-8')
        expect(content).toContain('Progress: 50%')
      })
    })

    describe('error handling', () => {
      it('should not throw when feature directory does not exist', async () => {
        await expect(createSessionCheckpoint('nonexistent-feature', tempDir)).resolves.not.toThrow()
      })

      it('should return snapshotCreated: false on error', async () => {
        const result = await createSessionCheckpoint('nonexistent-feature', tempDir)

        expect(result.snapshotCreated).toBe(false)
        expect(result.progressUpdated).toBe(false)
      })

      it('should handle filesystem errors gracefully', async () => {
        await fs.remove(featureDir)
        await fs.writeFile(featureDir, 'not-a-directory')

        const result = await createSessionCheckpoint('test-feature', tempDir)

        expect(result.snapshotCreated).toBe(false)
        expect(result.duration).toBeGreaterThanOrEqual(0)
      })

      it('should complete within 2 seconds', async () => {
        const start = Date.now()
        await createSessionCheckpoint('test-feature', tempDir)
        const duration = Date.now() - start

        expect(duration).toBeLessThan(2000)
      })
    })
  })
})
