import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'fs-extra'
import { loadSessionContext } from '../../src/utils/session-bootstrap'

describe('session-bootstrap', () => {
  let tempDir: string
  let activeFocusPath: string
  let constraintsPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-bootstrap-'))
    activeFocusPath = path.join(tempDir, '.claude', 'active-focus.md')
    constraintsPath = path.join(
      tempDir,
      '.claude',
      'plans',
      'features',
      'test-feature',
      'constraints.md'
    )

    await fs.ensureDir(path.dirname(activeFocusPath))
    await fs.ensureDir(path.dirname(constraintsPath))

    process.env.TEST_CWD = tempDir
  })

  afterEach(async () => {
    await fs.remove(tempDir)
    delete process.env.TEST_CWD
  })

  describe('loadSessionContext', () => {
    describe('when active-focus.md exists', () => {
      it('should load context from active-focus.md', async () => {
        await fs.writeFile(
          activeFocusPath,
          '# Active Focus\nFeature: test-feature\nStatus: implementing\n'
        )

        const result = await loadSessionContext(tempDir)

        expect(result.context).toContain('Feature: test-feature')
        expect(result.context).toContain('Status: implementing')
        expect(result.loaded).toContain(activeFocusPath)
      })

      it('should load constraints from active feature', async () => {
        await fs.writeFile(activeFocusPath, 'Feature: test-feature\n')
        await fs.writeFile(constraintsPath, '## Escopo Permitido\n- src/commands/\n- tests/\n')

        const result = await loadSessionContext(tempDir)

        expect(result.context).toContain('## Escopo Permitido')
        expect(result.context).toContain('src/commands/')
        expect(result.loaded).toContain(constraintsPath)
      })

      it('should complete in less than 500ms', async () => {
        await fs.writeFile(activeFocusPath, 'Feature: test-feature\n')
        await fs.writeFile(constraintsPath, '## Constraints\nSome content\n')

        const start = Date.now()
        await loadSessionContext(tempDir)
        const duration = Date.now() - start

        expect(duration).toBeLessThan(500)
      })
    })

    describe('when files do not exist', () => {
      it('should not throw and return empty context', async () => {
        const result = await loadSessionContext(tempDir)

        expect(result.context).toBe('')
        expect(result.loaded).toEqual([])
        expect(result.warnings.length).toBeGreaterThan(0)
      })

      it('should include warning when active-focus.md is missing', async () => {
        const result = await loadSessionContext(tempDir)

        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings[0]).toContain('active-focus.md not found')
      })
    })

    describe('when constraints file is missing', () => {
      it('should load active-focus but skip constraints', async () => {
        await fs.writeFile(activeFocusPath, 'Feature: test-feature\n')

        const result = await loadSessionContext(tempDir)

        expect(result.context).toContain('Feature: test-feature')
        expect(result.loaded).toHaveLength(1)
        expect(result.warnings).toHaveLength(0)
      })
    })

    describe('when active-focus has no feature line', () => {
      it('should return active-focus content without constraints', async () => {
        await fs.writeFile(activeFocusPath, '# Some header\nNo feature here\n')

        const result = await loadSessionContext(tempDir)

        expect(result.context).toContain('No feature here')
        expect(result.loaded).toHaveLength(1)
        expect(result.warnings).toHaveLength(0)
      })
    })
  })
})
