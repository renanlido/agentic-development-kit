export type CompactionLevelType = 'raw' | 'compact' | 'summarize' | 'handoff'

export type TokenSource = 'api' | 'cache' | 'offline'

export type CompactedItemType = 'tool_output' | 'duplicate' | 'verbose' | 'old_content'

export interface CompactionLevel {
  level: CompactionLevelType
  threshold: number
  description: string
}

export interface CompactionResult {
  originalTokens: number
  compactedTokens: number
  savedTokens: number
  itemsCompacted: number
  level: CompactionLevelType
  timestamp: string
  canRevert: boolean
  historyId: string
  items: CompactedItem[]
}

export interface CompactedItem {
  type: CompactedItemType
  originalSize: number
  compactedSize: number
  canRevert: boolean
  revertPath?: string
}

export interface TokenCountResult {
  count: number
  source: TokenSource
  precision: number
  timestamp: number
  cached: boolean
}

export interface ContextStatus {
  currentTokens: number
  maxTokens: number
  usagePercentage: number
  level: CompactionLevelType
  recommendation: string
  canContinue: boolean
}

export interface CompactionConfig {
  thresholds: {
    warning: number
    critical: number
    emergency: number
  }
  tokenCounter: {
    cacheTTL: number
    cacheMaxSize: number
    adjustmentFactor: number
  }
  pruning: {
    maxAge: number
    maxLines: number
  }
  compaction: {
    preservePatterns: string[]
    removePatterns: string[]
    rollbackWindow: number
  }
}

export interface CompactionHistoryEntry {
  timestamp: string
  level: CompactionLevelType
  tokensBefore: number
  tokensAfter: number
  itemsCompacted: number
  reverted?: boolean
  revertedAt?: string
}

export interface CompactionHistory {
  entries: CompactionHistoryEntry[]
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
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
    maxAge: 2592000000,
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

export const COMPACTION_LEVELS: CompactionLevel[] = [
  {
    level: 'raw',
    threshold: 0.0,
    description: 'No compaction needed - under 70% usage',
  },
  {
    level: 'compact',
    threshold: 0.7,
    description: 'Reversible compaction recommended - 70-85% usage',
  },
  {
    level: 'summarize',
    threshold: 0.85,
    description: 'Lossy summarization recommended - 85-95% usage',
  },
  {
    level: 'handoff',
    threshold: 0.95,
    description: 'Create handoff document - over 95% usage',
  },
]

export const MAX_TOKENS = 80000

export type ContextWarningSeverity = 'warning' | 'critical' | 'emergency'
export type ContextWarningAction = 'compact' | 'summarize' | 'handoff'

export interface ContextWarning {
  severity: ContextWarningSeverity
  message: string
  action: ContextWarningAction
}

export interface SummarizeResult {
  summary: string
  preservedDecisions: string[]
  preservedFiles: string[]
  informationLoss: boolean
  tokensBefore: number
  tokensAfter: number
}

export interface CompactOptions {
  dryRun?: boolean
  level?: CompactionLevelType
  preservePatterns?: string[]
}
