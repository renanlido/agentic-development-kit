import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'fs-extra'
import { MemoryPruner } from '../../src/utils/memory-pruner'

describe('MemoryPruner', () => {
  let memoryPruner: MemoryPruner
  let tempDir: string

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'test-memory-pruner-' + Date.now())
    await fs.ensureDir(tempDir)
    memoryPruner = new MemoryPruner({ basePath: tempDir })
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  describe('pruneFeature', () => {
    it('should identify content older than threshold', async () => {
      const feature = 'test-feature'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)

      const oldFile = path.join(featurePath, 'old.md')
      const recentFile = path.join(featurePath, 'recent.md')

      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000

      await fs.writeFile(oldFile, 'Old content')
      await fs.writeFile(recentFile, 'Recent content')
      await fs.utimes(oldFile, new Date(thirtyOneDaysAgo), new Date(thirtyOneDaysAgo))
      await fs.utimes(recentFile, new Date(oneDayAgo), new Date(oneDayAgo))

      const result = await memoryPruner.pruneFeature(feature, true)

      expect(result.filesIdentified).toContain(oldFile)
      expect(result.filesIdentified).not.toContain(recentFile)
    })

    it('should archive old content', async () => {
      const feature = 'archive-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)

      const oldFile = path.join(featurePath, 'old-content.md')
      const content = 'Content to archive'
      await fs.writeFile(oldFile, content)

      const oldDate = Date.now() - 35 * 24 * 60 * 60 * 1000
      await fs.utimes(oldFile, new Date(oldDate), new Date(oldDate))

      const result = await memoryPruner.pruneFeature(feature, false)

      expect(result.filesArchived).toContain(oldFile)
      const archivePath = path.join(tempDir, '.compaction/archived', feature)
      const archivedFile = await fs.pathExists(path.join(archivePath, 'old-content.md'))
      expect(archivedFile).toBe(true)
    })

    it('should preserve recent content', async () => {
      const feature = 'preserve-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)

      const recentFile = path.join(featurePath, 'recent.md')
      await fs.writeFile(recentFile, 'Recent content')

      const result = await memoryPruner.pruneFeature(feature, false)

      expect(result.filesArchived).not.toContain(recentFile)
      const exists = await fs.pathExists(recentFile)
      expect(exists).toBe(true)
    })

    it('should respect dry-run mode', async () => {
      const feature = 'dry-run-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)

      const oldFile = path.join(featurePath, 'old.md')
      await fs.writeFile(oldFile, 'Old content')

      const oldDate = Date.now() - 35 * 24 * 60 * 60 * 1000
      await fs.utimes(oldFile, new Date(oldDate), new Date(oldDate))

      const result = await memoryPruner.pruneFeature(feature, true)

      expect(result.dryRun).toBe(true)
      expect(result.filesIdentified.length).toBeGreaterThan(0)
      expect(result.filesArchived.length).toBe(0)

      const stillExists = await fs.pathExists(oldFile)
      expect(stillExists).toBe(true)
    })

    it('should create archive log', async () => {
      const feature = 'log-test'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)

      const oldFile = path.join(featurePath, 'to-archive.md')
      await fs.writeFile(oldFile, 'Content with metadata')

      const oldDate = Date.now() - 35 * 24 * 60 * 60 * 1000
      await fs.utimes(oldFile, new Date(oldDate), new Date(oldDate))

      await memoryPruner.pruneFeature(feature, false)

      const logPath = path.join(tempDir, '.compaction/archived', feature, 'archive.log')
      const logExists = await fs.pathExists(logPath)
      expect(logExists).toBe(true)

      const logContent = await fs.readFile(logPath, 'utf-8')
      expect(logContent).toContain('to-archive.md')
      expect(logContent).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should skip directories when pruning', async () => {
      const feature = 'skip-dirs'
      const featurePath = path.join(tempDir, '.claude/plans/features', feature)
      await fs.ensureDir(featurePath)

      const subDir = path.join(featurePath, 'subdirectory')
      await fs.ensureDir(subDir)

      const oldDate = Date.now() - 35 * 24 * 60 * 60 * 1000
      await fs.utimes(subDir, new Date(oldDate), new Date(oldDate))

      const result = await memoryPruner.pruneFeature(feature, true)

      expect(result.filesIdentified).toHaveLength(0)
      expect(result.filesArchived).toHaveLength(0)
    })

    it('should handle non-existent feature path', async () => {
      const result = await memoryPruner.pruneFeature('non-existent', false)

      expect(result.filesIdentified).toEqual([])
      expect(result.filesArchived).toEqual([])
      expect(result.totalSaved).toBe(0)
    })
  })

  describe('pruneProjectContext', () => {
    it('should limit to 500 lines', async () => {
      const contextPath = path.join(tempDir, '.claude/memory/project-context.md')
      await fs.ensureDir(path.dirname(contextPath))

      const lines = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`)
      await fs.writeFile(contextPath, lines.join('\n'))

      const result = await memoryPruner.pruneProjectContext(false)

      expect(result.linesBefore).toBe(600)
      expect(result.linesAfter).toBe(500)

      const content = await fs.readFile(contextPath, 'utf-8')
      const finalLines = content.split('\n')
      expect(finalLines.length).toBeLessThanOrEqual(500)
    })

    it('should preserve headers', async () => {
      const contextPath = path.join(tempDir, '.claude/memory/project-context.md')
      await fs.ensureDir(path.dirname(contextPath))

      const content = [
        '# Project Overview',
        'Content line 1',
        'Content line 2',
        '## Architecture',
        ...Array.from({ length: 600 }, (_, i) => `Detail ${i}`),
      ].join('\n')

      await fs.writeFile(contextPath, content)

      await memoryPruner.pruneProjectContext(false)

      const finalContent = await fs.readFile(contextPath, 'utf-8')
      expect(finalContent).toContain('# Project Overview')
      expect(finalContent).toContain('## Architecture')
    })

    it('should archive overflow', async () => {
      const contextPath = path.join(tempDir, '.claude/memory/project-context.md')
      await fs.ensureDir(path.dirname(contextPath))

      const lines = Array.from({ length: 700 }, (_, i) => `Line ${i + 1}`)
      await fs.writeFile(contextPath, lines.join('\n'))

      const result = await memoryPruner.pruneProjectContext(false)

      expect(result.archivedLines).toBeGreaterThan(0)

      const archivePath = path.join(tempDir, '.compaction/archived/project-context')
      const archiveExists = await fs.pathExists(archivePath)
      expect(archiveExists).toBe(true)
    })

    it('should handle non-existent project context', async () => {
      const result = await memoryPruner.pruneProjectContext(false)

      expect(result.linesBefore).toBe(0)
      expect(result.linesAfter).toBe(0)
      expect(result.archivedLines).toBe(0)
    })

    it('should respect dry-run mode in project context pruning', async () => {
      const contextPath = path.join(tempDir, '.claude/memory/project-context.md')
      await fs.ensureDir(path.dirname(contextPath))

      const lines = Array.from({ length: 700 }, (_, i) => `Line ${i + 1}`)
      await fs.writeFile(contextPath, lines.join('\n'))

      const result = await memoryPruner.pruneProjectContext(true)

      expect(result.linesBefore).toBe(700)
      expect(result.linesAfter).toBe(500)
      expect(result.archivedLines).toBeGreaterThan(0)

      const content = await fs.readFile(contextPath, 'utf-8')
      const currentLines = content.split('\n')
      expect(currentLines.length).toBe(700)
    })
  })

  describe('archiveContent', () => {
    it('should create backup before archiving', async () => {
      const file = path.join(tempDir, 'test-file.md')
      const content = 'Important content'
      await fs.writeFile(file, content)

      const archivePath = path.join(tempDir, '.compaction/archived/backup')
      await memoryPruner['archiveContent'](file, archivePath)

      const backupExists = await fs.pathExists(path.join(archivePath, 'test-file.md'))
      expect(backupExists).toBe(true)

      const backupContent = await fs.readFile(path.join(archivePath, 'test-file.md'), 'utf-8')
      expect(backupContent).toBe(content)
    })

    it('should add metadata to archived content', async () => {
      const file = path.join(tempDir, 'metadata-test.md')
      const content = 'Content with metadata'
      await fs.writeFile(file, content)

      const archivePath = path.join(tempDir, '.compaction/archived/metadata')
      await memoryPruner['archiveContent'](file, archivePath)

      const metadataPath = path.join(archivePath, 'metadata-test.meta.json')
      const metadataExists = await fs.pathExists(metadataPath)
      expect(metadataExists).toBe(true)

      const metadata = await fs.readJson(metadataPath)
      expect(metadata).toHaveProperty('originalPath')
      expect(metadata).toHaveProperty('archivedAt')
      expect(metadata).toHaveProperty('hash')
    })

    it('should index in archive log', async () => {
      const file = path.join(tempDir, 'index-test.md')
      await fs.writeFile(file, 'Indexed content')

      const archivePath = path.join(tempDir, '.compaction/archived/index')
      await memoryPruner['archiveContent'](file, archivePath)

      const logPath = path.join(archivePath, 'archive.log')
      const logExists = await fs.pathExists(logPath)
      expect(logExists).toBe(true)

      const logContent = await fs.readFile(logPath, 'utf-8')
      expect(logContent).toContain('index-test.md')
    })
  })

  describe('getContentAge', () => {
    it('should calculate age in days', async () => {
      const file = path.join(tempDir, 'age-test.md')
      await fs.writeFile(file, 'Content')

      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000
      await fs.utimes(file, new Date(tenDaysAgo), new Date(tenDaysAgo))

      const age = await memoryPruner['getContentAge'](file)
      expect(age).toBeGreaterThanOrEqual(9)
      expect(age).toBeLessThanOrEqual(11)
    })

    it('should handle recent files', async () => {
      const file = path.join(tempDir, 'recent.md')
      await fs.writeFile(file, 'Recent content')

      const age = await memoryPruner['getContentAge'](file)
      expect(age).toBeLessThanOrEqual(1)
    })
  })

  describe('limitFileLines', () => {
    it('should truncate file to max lines', async () => {
      const file = path.join(tempDir, 'truncate-test.md')
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
      await fs.writeFile(file, lines.join('\n'))

      const result = await memoryPruner['limitFileLines'](file, 50)

      expect(result.linesBefore).toBe(100)
      expect(result.linesAfter).toBe(50)

      const content = await fs.readFile(file, 'utf-8')
      const finalLines = content.split('\n')
      expect(finalLines.length).toBe(50)
    })

    it('should not modify file if already under limit', async () => {
      const file = path.join(tempDir, 'under-limit.md')
      const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`)
      const content = lines.join('\n')
      await fs.writeFile(file, content)

      const result = await memoryPruner['limitFileLines'](file, 50)

      expect(result.linesBefore).toBe(30)
      expect(result.linesAfter).toBe(30)

      const finalContent = await fs.readFile(file, 'utf-8')
      expect(finalContent).toBe(content)
    })
  })
})
