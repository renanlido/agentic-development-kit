export type MemoryTier = 'project' | 'feature' | 'phase' | 'session'

export interface MemoryMetadata {
  createdAt: string
  updatedAt: string
  lineCount: number
  freshnessScore: number
  relevanceScore: number
  usageCount: number
}

export interface TieredMemory {
  tier: MemoryTier
  content: string
  metadata: MemoryMetadata
}

export interface SessionEntry {
  key: string
  content: string
  timestamp: string
  usageCount: number
}

export interface SessionMemory {
  entries: SessionEntry[]
  lastUpdated: string
}

export interface MemoryHierarchy {
  project?: TieredMemory
  feature?: TieredMemory
  phase?: TieredMemory
  session: SessionMemory
}

export interface MemoryContent {
  raw: string
  sections: MemorySection[]
}

export interface MemorySection {
  title: string
  content: string
  level: number
}
