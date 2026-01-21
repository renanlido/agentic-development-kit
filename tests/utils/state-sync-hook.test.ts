import * as fs from 'fs-extra'
import * as path from 'node:path'
import * as os from 'node:os'
import { syncStateAfterWrite } from '../../src/utils/state-sync-hook'

describe('state-sync-hook', () => {
  let tempDir: string
  let featureDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-sync-'))
    featureDir = path.join(tempDir, '.claude', 'plans', 'features', 'test-feature')

    await fs.ensureDir(featureDir)
    await fs.writeFile(
      path.join(tempDir, '.claude', 'active-focus.md'),
      'Feature: test-feature\n'
    )
    await fs.writeFile(
      path.join(featureDir, 'progress.md'),
      '# Progress\nPhase: implement\n'
    )
    await fs.writeFile(
      path.join(featureDir, 'tasks.md'),
      '# Tasks\n- [ ] Task 1\n- [ ] Task 2\n'
    )
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  describe('syncStateAfterWrite', () => {
    describe('when file is written', () => {
      it('should update progress.md with modified file', async () => {
        const filePath = 'src/commands/feature.ts'

        const result = await syncStateAfterWrite(filePath, tempDir)

        expect(result.synced).toBe(true)
        expect(result.filesUpdated).toContain('progress.md')

        const progressContent = await fs.readFile(
          path.join(featureDir, 'progress.md'),
          'utf-8'
        )
        expect(progressContent).toContain(filePath)
      })

      it('should update state.json', async () => {
        const filePath = 'src/utils/helper.ts'

        const result = await syncStateAfterWrite(filePath, tempDir)

        expect(result.synced).toBe(true)

        const statePath = path.join(featureDir, 'state.json')
        const stateExists = await fs.pathExists(statePath)
        expect(stateExists).toBe(true)

        const state = await fs.readJSON(statePath)
        expect(state.lastModified).toBeDefined()
      })

      it('should execute asynchronously (non-blocking)', async () => {
        const filePath = 'src/index.ts'

        const start = Date.now()
        const result = await syncStateAfterWrite(filePath, tempDir)
        const duration = Date.now() - start

        expect(result.synced).toBe(true)
        expect(duration).toBeLessThan(1000)
      })
    })

    describe('when no active feature', () => {
      beforeEach(async () => {
        await fs.remove(path.join(tempDir, '.claude', 'active-focus.md'))
      })

      it('should not sync and return early', async () => {
        const result = await syncStateAfterWrite('src/file.ts', tempDir)

        expect(result.synced).toBe(false)
        expect(result.filesUpdated).toHaveLength(0)
      })

      it('should not throw error', async () => {
        await expect(
          syncStateAfterWrite('src/file.ts', tempDir)
        ).resolves.not.toThrow()
      })
    })

    describe('error handling', () => {
      it('should catch errors gracefully', async () => {
        await fs.remove(featureDir)

        const result = await syncStateAfterWrite('src/file.ts', tempDir)

        expect(result.synced).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should not throw on filesystem errors', async () => {
        await fs.remove(featureDir)

        await expect(
          syncStateAfterWrite('src/file.ts', tempDir)
        ).resolves.not.toThrow()
      })
    })

    describe('when syncing multiple files', () => {
      it('should track all modified files', async () => {
        await syncStateAfterWrite('src/commands/feature.ts', tempDir)
        await syncStateAfterWrite('src/utils/helper.ts', tempDir)

        const progressContent = await fs.readFile(
          path.join(featureDir, 'progress.md'),
          'utf-8'
        )

        expect(progressContent).toContain('src/commands/feature.ts')
        expect(progressContent).toContain('src/utils/helper.ts')
      })

      it('should not duplicate entries for same file', async () => {
        await syncStateAfterWrite('src/commands/feature.ts', tempDir)
        await syncStateAfterWrite('src/commands/feature.ts', tempDir)

        const progressContent = await fs.readFile(
          path.join(featureDir, 'progress.md'),
          'utf-8'
        )

        const matches = progressContent.match(/src\/commands\/feature\.ts/g)
        expect(matches?.length).toBe(1)
      })
    })

    describe('when active-focus.md has no feature', () => {
      beforeEach(async () => {
        await fs.writeFile(
          path.join(tempDir, '.claude', 'active-focus.md'),
          'No feature here\n'
        )
      })

      it('should return early without syncing', async () => {
        const result = await syncStateAfterWrite('src/file.ts', tempDir)

        expect(result.synced).toBe(false)
      })
    })
  })
})
