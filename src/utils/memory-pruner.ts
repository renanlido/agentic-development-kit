import fs from 'fs-extra'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { getFeaturePath } from './git-paths.js'

interface PruneResult {
  filesIdentified: string[]
  filesArchived: string[]
  dryRun: boolean
  totalSaved: number
}

interface LimitResult {
  linesBefore: number
  linesAfter: number
  archivedLines: number
}

interface PruningConfig {
  maxAge: number
  maxLines: number
}

export class MemoryPruner {
  private config: PruningConfig

  constructor(config?: Partial<PruningConfig>) {
    this.config = {
      maxAge: config?.maxAge ?? 30 * 24 * 60 * 60 * 1000,
      maxLines: config?.maxLines ?? 500,
    }
  }

  async pruneFeature(feature: string, dryRun = false): Promise<PruneResult> {
    const featurePath = path.join(getFeaturePath(feature))
    const filesIdentified: string[] = []
    const filesArchived: string[] = []
    let totalSaved = 0

    if (!(await fs.pathExists(featurePath))) {
      return {
        filesIdentified,
        filesArchived,
        dryRun,
        totalSaved,
      }
    }

    const files = await fs.readdir(featurePath)

    for (const file of files) {
      const filePath = path.join(featurePath, file)
      const stats = await fs.stat(filePath)

      if (!stats.isFile()) {
        continue
      }

      const age = await this.getContentAge(filePath)
      const ageInDays = age / (24 * 60 * 60 * 1000)

      if (ageInDays > 30) {
        filesIdentified.push(filePath)

        if (!dryRun) {
          const archivePath = path.join(
            process.cwd(),
            '.compaction',
            'archived',
            feature
          )
          await this.archiveContent(filePath, archivePath)
          filesArchived.push(filePath)

          const fileSize = (await fs.stat(filePath)).size
          totalSaved += fileSize

          await fs.remove(filePath)
        }
      }
    }

    return {
      filesIdentified,
      filesArchived,
      dryRun,
      totalSaved,
    }
  }

  async pruneProjectContext(dryRun = false): Promise<LimitResult> {
    const contextPath = path.join(
      process.cwd(),
      '.claude',
      'memory',
      'project-context.md'
    )

    if (!(await fs.pathExists(contextPath))) {
      return {
        linesBefore: 0,
        linesAfter: 0,
        archivedLines: 0,
      }
    }

    const content = await fs.readFile(contextPath, 'utf-8')
    const lines = content.split('\n')
    const linesBefore = lines.length

    if (linesBefore <= this.config.maxLines) {
      return {
        linesBefore,
        linesAfter: linesBefore,
        archivedLines: 0,
      }
    }

    if (dryRun) {
      return {
        linesBefore,
        linesAfter: this.config.maxLines,
        archivedLines: linesBefore - this.config.maxLines,
      }
    }

    const headers: Array<{ index: number; line: string }> = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#')) {
        headers.push({ index: i, line: lines[i] })
      }
    }

    const linesToArchive = linesBefore - this.config.maxLines
    const archivePath = path.join(
      process.cwd(),
      '.compaction',
      'archived',
      'project-context'
    )

    await fs.ensureDir(archivePath)
    const archivedContent = lines.slice(0, linesToArchive).join('\n')
    const archiveFile = path.join(
      archivePath,
      `archive-${Date.now()}.md`
    )
    await fs.writeFile(archiveFile, archivedContent)

    const remainingLines = lines.slice(linesToArchive)
    await fs.writeFile(contextPath, remainingLines.join('\n'))

    return {
      linesBefore,
      linesAfter: remainingLines.length,
      archivedLines: linesToArchive,
    }
  }

  private async getContentAge(file: string): Promise<number> {
    const stats = await fs.stat(file)
    return Date.now() - stats.mtimeMs
  }

  private async archiveContent(file: string, archivePath: string): Promise<void> {
    await fs.ensureDir(archivePath)

    const fileName = path.basename(file)
    const content = await fs.readFile(file, 'utf-8')

    await fs.writeFile(path.join(archivePath, fileName), content)

    const metadata = {
      originalPath: file,
      archivedAt: new Date().toISOString(),
      hash: createHash('md5').update(content).digest('hex'),
    }

    await fs.writeJson(
      path.join(archivePath, `${fileName}.meta.json`),
      metadata,
      { spaces: 2 }
    )

    const logPath = path.join(archivePath, 'archive.log')
    const logEntry = `${new Date().toISOString()} - ${fileName} - ${metadata.hash}\n`
    await fs.appendFile(logPath, logEntry)
  }

  async limitFileLines(file: string, maxLines: number): Promise<LimitResult> {
    const content = await fs.readFile(file, 'utf-8')
    const lines = content.split('\n')
    const linesBefore = lines.length

    if (linesBefore <= maxLines) {
      return {
        linesBefore,
        linesAfter: linesBefore,
        archivedLines: 0,
      }
    }

    const limitedLines = lines.slice(0, maxLines)
    await fs.writeFile(file, limitedLines.join('\n'))

    return {
      linesBefore,
      linesAfter: maxLines,
      archivedLines: linesBefore - maxLines,
    }
  }
}

export const memoryPruner = new MemoryPruner()
