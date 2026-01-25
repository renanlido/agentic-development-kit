import { TokenCounter } from './token-counter'
import { SnapshotManager } from './snapshot-manager'
import { executeClaudeCommand } from './claude'
import type {
  ContextStatus,
  CompactionResult,
  CompactionLevelType,
  CompactedItem,
  CompactionHistoryEntry,
  CompactionConfig,
} from '../types/compaction'
import type { HandoffDocument } from '../types/session'
import * as fs from 'fs-extra'
import * as path from 'node:path'
import crypto from 'node:crypto'

interface CompactOptions {
  dryRun?: boolean
  level?: CompactionLevelType
}

interface SummarizeResult {
  summary: string
  preservedDecisions: string[]
  preservedFiles: string[]
  informationLoss: boolean
  tokensBefore: number
  tokensAfter: number
}

const TOOL_OUTPUT_PATTERNS = [
  /^Read tool output:[\s\S]*?(?=\n\n|\n(?=[A-Z])|$)/gm,
  /^Glob results:[\s\S]*?(?=\n\n|\n(?=[A-Z])|$)/gm,
  /^Bash output:[\s\S]*?(?=\n\n|\n(?=[A-Z])|$)/gm,
  /^Grep output:[\s\S]*?(?=\n\n|\n(?=[A-Z])|$)/gm,
]

export class ContextCompactor {
  private tokenCounter: TokenCounter
  private snapshotManager: SnapshotManager
  private config: CompactionConfig
  private readonly MAX_TOKENS = 80000

  constructor(
    tokenCounter?: TokenCounter,
    snapshotManager?: SnapshotManager,
    config?: CompactionConfig
  ) {
    this.tokenCounter = tokenCounter || new TokenCounter()
    this.snapshotManager = snapshotManager || new SnapshotManager()
    this.config = config || {
      thresholds: {
        warning: 0.7,
        critical: 0.85,
        emergency: 0.95,
      },
      tokenCounter: {
        cacheTTL: 3600000,
        cacheMaxSize: 1000,
        adjustmentFactor: 0.92,
      },
      pruning: {
        maxAge: 30,
        maxLines: 500,
      },
      compaction: {
        preservePatterns: ['/^## Decision:/gm', '/^ADR-\\d+/gm', '/error|fail|critical/gi'],
        removePatterns: [
          '/^Read tool output:[\\s\\S]*?(?=\\n\\n)/gm',
          '/^Glob results:[\\s\\S]*?(?=\\n\\n)/gm',
          '/^Bash output:[\\s\\S]*?(?=\\n\\n)/gm',
        ],
        rollbackWindow: 86400000,
      },
    }
  }

  async getContextStatus(feature: string): Promise<ContextStatus> {
    const content = await this.aggregateFeatureContent(feature)
    const tokenResult = await this.tokenCounter.count(content)
    const currentTokens = tokenResult.count
    const usagePercentage = (currentTokens / this.MAX_TOKENS) * 100

    let level: CompactionLevelType
    let recommendation: string
    let canContinue: boolean

    if (usagePercentage < this.config.thresholds.warning * 100) {
      level = 'raw'
      recommendation = 'Continue normally'
      canContinue = true
    } else if (usagePercentage < this.config.thresholds.critical * 100) {
      level = 'compact'
      recommendation = 'Consider compaction to free up space'
      canContinue = true
    } else if (usagePercentage < this.config.thresholds.emergency * 100) {
      level = 'summarize'
      recommendation = 'Summarization recommended to continue safely'
      canContinue = true
    } else {
      level = 'handoff'
      recommendation = 'Context limit reached. Create handoff document and start new session'
      canContinue = false
    }

    return {
      currentTokens,
      maxTokens: this.MAX_TOKENS,
      usagePercentage,
      level,
      recommendation,
      canContinue,
    }
  }

  async shouldCompact(feature: string): Promise<CompactionLevelType> {
    const status = await this.getContextStatus(feature)
    return status.level
  }

  async compact(feature: string, options: CompactOptions = {}): Promise<CompactionResult> {
    const featurePath = this.getFeaturePath(feature)

    const snapshotId = await this.snapshotManager.createSnapshot(feature, 'pre_compaction')

    const files = await this.getFeatureFiles(featurePath)
    const items: CompactedItem[] = []
    let originalTokens = 0
    let compactedTokens = 0

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      const originalSize = (await this.tokenCounter.count(content)).count
      originalTokens += originalSize

      if (options.dryRun) {
        continue
      }

      let compacted = content
      const fileItems: CompactedItem[] = []

      const { content: cleaned, items: toolItems } = await this.removeToolOutputs(compacted)
      compacted = cleaned
      fileItems.push(...toolItems)

      const { content: deduped, items: dedupItems } = await this.deduplicateContent(compacted)
      compacted = deduped
      fileItems.push(...dedupItems)

      compacted = await this.preserveCriticalContent(compacted)

      await fs.writeFile(file, compacted)
      const compactedSize = (await this.tokenCounter.count(compacted)).count
      compactedTokens += compactedSize

      items.push(...fileItems)
    }

    const savedTokens = originalTokens - compactedTokens
    const timestamp = new Date().toISOString()
    const historyId = this.generateHistoryId()

    const result: CompactionResult = {
      originalTokens,
      compactedTokens,
      savedTokens,
      itemsCompacted: items.length,
      items,
      level: options.level || 'compact',
      timestamp,
      canRevert: true,
      historyId,
    }

    if (!options.dryRun) {
      await this.saveCompactionHistory(feature, result, snapshotId)
    }

    return result
  }

  async summarize(feature: string): Promise<SummarizeResult> {
    const content = await this.aggregateFeatureContent(feature)

    const tokensBefore = (await this.tokenCounter.count(content)).count

    const decisions = this.extractDecisions(content)
    const files = await this.extractFiles(feature)

    const prompt = `Summarize this feature progress preserving:
- Key decisions
- Files modified
- Next steps
- Critical context

Keep summary under 500 tokens. Be concise but preserve essential information.

Content:
${content}
`

    const summaryResult = await executeClaudeCommand(prompt)
    const summary = `⚠️ Information loss: This is a summarized view. Some details were removed.

${summaryResult || 'Summary could not be generated'}

Preserved Decisions:
${decisions.map((d) => `- ${d}`).join('\n')}

Files Modified:
${files.map((f) => `- ${f}`).join('\n')}
`

    const tokensAfter = (await this.tokenCounter.count(summary)).count

    return {
      summary,
      preservedDecisions: decisions,
      preservedFiles: files,
      informationLoss: true,
      tokensBefore,
      tokensAfter,
    }
  }

  async createHandoffDocument(feature: string): Promise<HandoffDocument> {
    const checkpointId = await this.snapshotManager.createSnapshot(feature, 'context_overflow')

    const content = await this.aggregateFeatureContent(feature)
    const decisions = this.extractDecisions(content)
    const files = await this.extractFiles(feature)

    const sessionId = process.env.CLAUDE_SESSION_ID || 'unknown'

    const handoff: HandoffDocument = {
      feature,
      currentTask: 'Continue implementation',
      completed: [],
      inProgress: [],
      nextSteps: [],
      filesModified: files,
      issues: [],
      decisions,
      context: `CURRENT TASK\n\nCOMPLETED\n\nIN PROGRESS\n\nNEXT STEPS\n\nFILES MODIFIED\n${files.join('\n')}\n\nBLOCKING ISSUES\n\nDECISIONS MADE\n${decisions.join('\n')}\n\nCONTEXT FOR CONTINUATION`,
      createdAt: new Date().toISOString(),
      sessionId,
      checkpointId,
    }

    const handoffPath = path.join(this.getFeaturePath(feature), 'handoff.md')
    await fs.writeFile(
      handoffPath,
      `========================================
HANDOFF DOCUMENT: ${feature}
Generated: ${handoff.createdAt}
Session: ${handoff.sessionId}
Checkpoint: ${handoff.checkpointId}
========================================

${handoff.context}

========================================
Use: adk feature continue ${feature} to resume
========================================
`
    )

    return handoff
  }

  async revertCompaction(feature: string, historyId: string): Promise<boolean> {
    const historyPath = path.join(
      this.getCompactionPath(),
      'history',
      feature,
      `${historyId}.json`
    )

    if (!(await fs.pathExists(historyPath))) {
      return false
    }

    const history = await fs.readJson(historyPath)
    const compactionTime = new Date(history.timestamp).getTime()
    const now = Date.now()
    const hoursSince = (now - compactionTime) / (1000 * 60 * 60)

    if (hoursSince > 24) {
      return false
    }

    const backupPath = history.revertPath || path.join(this.getCompactionPath(), 'backup', historyId)

    if (await fs.pathExists(backupPath)) {
      const featurePath = this.getFeaturePath(feature)
      await fs.copy(backupPath, featurePath, { overwrite: true })

      history.reverted = true
      history.revertedAt = new Date().toISOString()
      await fs.writeJson(historyPath, history, { spaces: 2 })

      return true
    }

    return false
  }

  private async removeToolOutputs(
    content: string
  ): Promise<{ content: string; items: CompactedItem[] }> {
    const items: CompactedItem[] = []
    let cleaned = content

    for (const pattern of TOOL_OUTPUT_PATTERNS) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        const originalSize = (await this.tokenCounter.count(match)).count
        cleaned = cleaned.replace(match, '[Tool output removed]')

        items.push({
          type: 'tool_output',
          originalSize,
          compactedSize: 3,
          canRevert: true,
        })
      }
    }

    return { content: cleaned, items }
  }

  private async deduplicateContent(
    content: string
  ): Promise<{ content: string; items: CompactedItem[] }> {
    const items: CompactedItem[] = []
    const lines = content.split('\n')
    const seen = new Map<string, number>()
    const result: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0) {
        result.push(line)
        continue
      }

      const hash = crypto.createHash('md5').update(trimmed).digest('hex')
      const count = seen.get(hash) || 0

      if (count > 0 && trimmed.length > 10) {
        const originalSize = (await this.tokenCounter.count(line)).count
        items.push({
          type: 'duplicate',
          originalSize,
          compactedSize: 0,
          canRevert: true,
        })
      } else {
        result.push(line)
        seen.set(hash, count + 1)
      }
    }

    return { content: result.join('\n'), items }
  }

  private async preserveCriticalContent(content: string): Promise<string> {
    return content
  }

  private async saveCompactionHistory(
    feature: string,
    result: CompactionResult,
    snapshotId: string
  ): Promise<void> {
    const historyDir = path.join(this.getCompactionPath(), 'history', feature)
    await fs.ensureDir(historyDir)

    const historyPath = path.join(historyDir, `${result.historyId}.json`)
    const entry: CompactionHistoryEntry = {
      timestamp: result.timestamp,
      level: result.level,
      tokensBefore: result.originalTokens,
      tokensAfter: result.compactedTokens,
      itemsCompacted: result.itemsCompacted,
    }

    const snapshotPath = path.join(this.getSnapshotsPath(), feature, snapshotId)
    await fs.writeJson(historyPath, { ...entry, revertPath: snapshotPath }, { spaces: 2 })
  }

  private async aggregateFeatureContent(feature: string): Promise<string> {
    const featurePath = this.getFeaturePath(feature)
    const files = await this.getFeatureFiles(featurePath)

    const contents = await Promise.all(
      files.map(async (file) => {
        if (await fs.pathExists(file)) {
          return await fs.readFile(file, 'utf-8')
        }
        return ''
      })
    )

    return contents.join('\n\n')
  }

  private async getFeatureFiles(featurePath: string): Promise<string[]> {
    if (!(await fs.pathExists(featurePath))) {
      return []
    }

    const files = await fs.readdir(featurePath)
    return files
      .filter((f) => f.endsWith('.md') || f.endsWith('.json'))
      .map((f) => path.join(featurePath, f))
  }

  private extractDecisions(content: string): string[] {
    const decisions: string[] = []
    const decisionRegex = /##\s*Decision:\s*(.+)/gi

    let match
    while ((match = decisionRegex.exec(content)) !== null) {
      decisions.push(match[1].trim())
    }

    return decisions
  }

  private async extractFiles(feature: string): Promise<string[]> {
    const featurePath = this.getFeaturePath(feature)
    const stateFile = path.join(featurePath, 'state.json')

    if (await fs.pathExists(stateFile)) {
      const state = await fs.readJson(stateFile)
      return state.filesModified || []
    }

    return []
  }

  private getFeaturePath(feature: string): string {
    const basePath = process.env.TEST_FEATURE_PATH || process.cwd()
    return path.join(basePath, '.claude/plans/features', feature)
  }

  private getCompactionPath(): string {
    const basePath = process.env.TEST_FEATURE_PATH || process.cwd()
    return path.join(basePath, '.compaction')
  }

  private getSnapshotsPath(): string {
    const basePath = process.env.TEST_FEATURE_PATH || process.cwd()
    return path.join(basePath, '.claude/plans/features')
  }

  private generateHistoryId(): string {
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  }
}

export const contextCompactor = new ContextCompactor()
