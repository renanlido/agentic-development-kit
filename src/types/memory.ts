export type MemoryPhase = 'research' | 'tasks' | 'plan' | 'implement' | 'qa' | 'docs' | 'finish' | 'deploy'
export type MemoryStatus = 'in_progress' | 'blocked' | 'completed'
export type PhaseResult = 'completed' | 'blocked' | 'skipped'

export interface ADR {
  id: string
  decision: string
  reason: string
}

export interface Pattern {
  name: string
  description: string
  files: string[]
}

export interface Risk {
  description: string
  mitigation: string
}

export interface StateInfo {
  completed: string[]
  inProgress: string[]
  pending: string[]
}

export interface PhaseHistory {
  date: string
  phase: MemoryPhase
  result: PhaseResult
}

export interface MemoryContent {
  feature: string
  lastUpdated: string
  phase: MemoryPhase
  status: MemoryStatus
  summary: string
  decisions: ADR[]
  patterns: Pattern[]
  risks: Risk[]
  state: StateInfo
  nextSteps: string[]
  history: PhaseHistory[]
}

export interface MemoryOptions {
  feature?: string
  global?: boolean
  query?: string
  force?: boolean
  phase?: MemoryPhase
}

export interface MemoryLimitResult {
  over: boolean
  warning: boolean
  count: number
}

export interface SearchMatch {
  feature: string
  file: string
  line: number
  content: string
  context: string[]
}

export const MEMORY_LINE_LIMIT = 1000
export const MEMORY_WARNING_THRESHOLD = 0.8
export const MEMORY_CONTEXT_LINES = 3

export enum DecisionCategory {
  ARCHITECTURE = 'architecture',
  PATTERN = 'pattern',
  LIBRARY = 'library',
  CONVENTION = 'convention',
  SECURITY = 'security',
}

export interface Decision {
  id: string
  title: string
  context: string
  alternatives: string[]
  chosen: string
  rationale: string
  category: DecisionCategory
  tags: string[]
  relatedFeatures: string[]
  createdAt: string
  updatedAt: string
}

export interface MemorySearchResult {
  decision: Decision
  score: number
  matchedFields: string[]
}

export interface MemoryIndex {
  decisions: Map<string, Decision>
  lastIndexed: string
  version: string
}

export interface CompactionConfig {
  maxLines: number
  maxSizeKB: number
  preserveDecisions: boolean
  archivePath: string
}

export interface CompactionResult {
  originalLines: number
  compactedLines: number
  archivedPath: string
  preservedDecisions: number
  timestamp: string
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  maxLines: 1000,
  maxSizeKB: 50,
  preserveDecisions: true,
  archivePath: '.claude/memory/archive',
}
