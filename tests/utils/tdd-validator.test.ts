import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'fs-extra'
import { validateTDD } from '../../src/utils/tdd-validator'

describe('tdd-validator', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-tdd-'))
    await fs.ensureDir(path.join(tempDir, 'src'))
    await fs.ensureDir(path.join(tempDir, 'tests'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  describe('validateTDD', () => {
    describe('when creating file in src/', () => {
      const srcFile = 'src/commands/feature.ts'

      it('should detect file creation in src/', async () => {
        const result = await validateTDD(srcFile, tempDir)

        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('src/')
      })

      it('should suggest corresponding test file', async () => {
        const result = await validateTDD(srcFile, tempDir)

        expect(result.testFile).toBe('tests/commands/feature.test.ts')
      })

      describe('when corresponding test exists', () => {
        it('should not show warning', async () => {
          const testFile = path.join(tempDir, 'tests/commands/feature.test.ts')
          await fs.ensureDir(path.dirname(testFile))
          await fs.writeFile(testFile, 'describe("feature", () => {})')

          const result = await validateTDD(srcFile, tempDir)

          expect(result.isValid).toBe(true)
          expect(result.warnings).toHaveLength(0)
        })
      })

      describe('when test file has .spec.ts extension', () => {
        it('should recognize spec.ts pattern', async () => {
          const testFile = path.join(tempDir, 'tests/commands/feature.spec.ts')
          await fs.ensureDir(path.dirname(testFile))
          await fs.writeFile(testFile, 'describe("feature", () => {})')

          const result = await validateTDD(srcFile, tempDir)

          expect(result.isValid).toBe(true)
          expect(result.warnings).toHaveLength(0)
        })
      })

      describe('when test in __tests__ directory', () => {
        it('should recognize __tests__ pattern', async () => {
          const testFile = path.join(tempDir, 'src/commands/__tests__/feature.test.ts')
          await fs.ensureDir(path.dirname(testFile))
          await fs.writeFile(testFile, 'describe("feature", () => {})')

          const result = await validateTDD(srcFile, tempDir)

          expect(result.isValid).toBe(true)
          expect(result.warnings).toHaveLength(0)
        })
      })
    })

    describe('when creating file outside src/', () => {
      it('should not show warning for test files', async () => {
        const result = await validateTDD('tests/commands/feature.test.ts', tempDir)

        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      })

      it('should not show warning for config files', async () => {
        const result = await validateTDD('package.json', tempDir)

        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      })

      it('should not show warning for markdown files', async () => {
        const result = await validateTDD('.claude/plans/feature/prd.md', tempDir)

        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      })
    })

    describe('when creating non-TypeScript file in src/', () => {
      it('should not show warning for .json files', async () => {
        const result = await validateTDD('src/config.json', tempDir)

        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      })

      it('should not show warning for .md files', async () => {
        const result = await validateTDD('src/README.md', tempDir)

        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      })
    })
  })
})
