import path from 'node:path'
import fs from 'fs-extra'
import type { TieredMemory } from '../types/context.js'

export interface CompressionConfig {
  warningThreshold: number
  compressionThreshold: number
  targetAfterCompression: number
}

const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  warningThreshold: 800,
  compressionThreshold: 1000,
  targetAfterCompression: 600,
}

export function getCompressionConfig(): CompressionConfig {
  return { ...DEFAULT_COMPRESSION_CONFIG }
}

export function shouldCompress(memory: TieredMemory): boolean {
  const config = getCompressionConfig()
  return memory.metadata.lineCount > config.compressionThreshold
}

export function isNearLimit(memory: TieredMemory): boolean {
  const config = getCompressionConfig()
  return memory.metadata.lineCount >= config.warningThreshold
}

export async function archiveMemory(memoryPath: string): Promise<string> {
  const dir = path.dirname(memoryPath)
  const ext = path.extname(memoryPath)
  const base = path.basename(memoryPath, ext)
  const date = new Date().toISOString().split('T')[0]
  const archiveName = `${base}.archive-${date}${ext}`
  const archivePath = path.join(dir, archiveName)

  await fs.copy(memoryPath, archivePath)

  return archivePath
}

export async function compressMemoryContent(
  content: string,
  memoryPath: string
): Promise<string> {
  const lineCount = content.split('\n').length
  const config = getCompressionConfig()

  if (lineCount <= config.compressionThreshold) {
    return content
  }

  const archivePath = await archiveMemory(memoryPath)

  const { executeClaudeCommand } = await import('./claude.js')

  const prompt = `
COMPRESS MEMORY

File: ${memoryPath}
Current lines: ${lineCount}
Target: < ${config.targetAfterCompression} lines

Instructions:
1. Read and analyze the memory content
2. PRESERVE all ADRs (architectural decisions) - they are critical
3. PRESERVE phase history and key milestones
4. SUMMARIZE verbose sections while keeping essential information
5. REMOVE redundancies and repetitive content
6. KEEP markdown structure valid

Archived original at: ${archivePath}

Content to compress:
---
${content}
---

Output: Return ONLY the compressed markdown content, nothing else.
`

  const compressed = await executeClaudeCommand(prompt)

  return compressed || content
}
