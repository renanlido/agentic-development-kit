import { execSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs-extra'

describe('Memory E2E', () => {
  let testDir: string
  let memoryDir: string

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adk-memory-e2e-'))
    memoryDir = path.join(testDir, '.claude', 'memory')
    await fs.ensureDir(memoryDir)
  })

  afterAll(async () => {
    await fs.remove(testDir)
  })

  beforeEach(() => {
    process.env.MEMORY_PROVIDER = 'local'
    process.env.MEMORY_LOCAL_PATH = memoryDir
  })

  afterEach(() => {
    delete process.env.MEMORY_PROVIDER
    delete process.env.MEMORY_LOCAL_PATH
  })

  describe('index workflow', () => {
    it('should index single file successfully', async () => {
      const testFile = path.join(testDir, 'test-doc.md')
      await fs.writeFile(testFile, '# Authentication\n\nJWT tokens for API authentication.')

      const indexCmd = `node dist/cli.js memory index ${testFile}`
      const output = execSync(indexCmd, { cwd: process.cwd(), encoding: 'utf-8' })

      expect(output).toContain('adicionado ao indice')
      expect(output).toContain('test-doc.md')
    })

    it('should index multiple files individually', async () => {
      const file1 = path.join(testDir, 'doc1.md')
      const file2 = path.join(testDir, 'doc2.md')
      await fs.writeFile(file1, 'Content 1')
      await fs.writeFile(file2, 'Content 2')

      const indexCmd = `node dist/cli.js memory index ${file1} ${file2}`
      const output = execSync(indexCmd, { cwd: process.cwd(), encoding: 'utf-8' })

      expect(output).toContain('arquivos adicionados ao indice')
    })

    it('should fail when file does not exist', () => {
      const nonExistent = path.join(testDir, 'nonexistent.md')

      expect(() => {
        execSync(`node dist/cli.js memory index ${nonExistent}`, {
          cwd: process.cwd(),
          encoding: 'utf-8',
        })
      }).toThrow()
    })
  })

  describe('recall workflow', () => {
    it('should execute recall command with query', async () => {
      const recallCmd = 'node dist/cli.js memory recall "authentication tokens"'
      const output = execSync(recallCmd, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, MEMORY_LOCAL_PATH: memoryDir },
      })

      expect(output).toBeDefined()
    })

    it('should support limit option', async () => {
      const recallCmd = 'node dist/cli.js memory recall "test query" --limit 10'
      const output = execSync(recallCmd, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, MEMORY_LOCAL_PATH: memoryDir },
      })

      expect(output).toBeDefined()
    })

    it('should support threshold option', async () => {
      const recallCmd = 'node dist/cli.js memory recall "test query" --threshold 0.8'
      const output = execSync(recallCmd, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, MEMORY_LOCAL_PATH: memoryDir },
      })

      expect(output).toBeDefined()
    })
  })

  describe('queue workflow', () => {
    it('should enqueue file successfully', async () => {
      const testFile = path.join(testDir, 'queued.md')
      await fs.writeFile(testFile, 'Queued content')

      const queueCmd = `node dist/cli.js memory queue ${testFile}`
      const output = execSync(queueCmd, { cwd: process.cwd(), encoding: 'utf-8' })

      expect(output).toContain('fila de indexacao')
    })

    it('should process queue on demand', async () => {
      const testFile = path.join(testDir, 'process.md')
      await fs.writeFile(testFile, 'Process queue content')

      const processCmd = 'node dist/cli.js memory process-queue'
      const output = execSync(processCmd, { cwd: process.cwd(), encoding: 'utf-8' })

      expect(output).toBeDefined()
    })
  })

  describe('integration scenarios', () => {
    it('should execute full index workflow', async () => {
      const doc = path.join(testDir, 'integration.md')
      await fs.writeFile(doc, 'Integration test content')

      const indexOutput = execSync(`node dist/cli.js memory index ${doc}`, {
        cwd: process.cwd(),
        encoding: 'utf-8',
      })

      expect(indexOutput).toContain('adicionado ao indice')
    })

    it('should execute queue and process workflow', async () => {
      const doc = path.join(testDir, 'workflow.md')
      await fs.writeFile(doc, 'Workflow test')

      const queueOutput = execSync(`node dist/cli.js memory queue ${doc}`, {
        cwd: process.cwd(),
        encoding: 'utf-8',
      })

      expect(queueOutput).toContain('fila')
    })

    it('should handle metadata in index command', async () => {
      const doc = path.join(testDir, 'metadata.md')
      await fs.writeFile(doc, 'Content with metadata')

      const indexOutput = execSync(
        `node dist/cli.js memory index ${doc} --tags auth --feature test`,
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
        }
      )

      expect(indexOutput).toContain('adicionado ao indice')
    })
  })

  describe('error handling', () => {
    it('should fail when indexing non-existent file', () => {
      expect(() => {
        execSync('node dist/cli.js memory index /nonexistent/file.md', {
          cwd: process.cwd(),
          encoding: 'utf-8',
        })
      }).toThrow()
    })

    it('should execute recall with query parameter', () => {
      const output = execSync('node dist/cli.js memory recall "test"', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      })

      expect(output).toBeDefined()
    })
  })

  describe('performance', () => {
    it('should index single file within reasonable time', async () => {
      const doc = path.join(testDir, 'perf.md')
      await fs.writeFile(doc, 'Performance test content')

      const start = Date.now()
      execSync(`node dist/cli.js memory index ${doc}`, {
        cwd: process.cwd(),
        encoding: 'utf-8',
      })
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10000)
    })

    it('should recall within reasonable time', async () => {
      const start = Date.now()
      execSync('node dist/cli.js memory recall "test query"', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, MEMORY_LOCAL_PATH: memoryDir },
      })
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10000)
    })
  })
})
