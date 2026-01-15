export enum ToolCategory {
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  DEPLOYMENT = 'deployment',
  QUALITY = 'quality',
  SECURITY = 'security',
}

export type ToolPriority = 'high' | 'medium' | 'low'

export interface ToolDefinition {
  name: string
  description: string
  triggers: string[]
  category: ToolCategory
  priority: ToolPriority
  deferLoading: boolean
  promptPath: string
  dependencies: string[]
  version: string
  author?: string
  createdAt: string
  updatedAt: string
}

export interface ToolSearchResult {
  tool: ToolDefinition
  score: number
  confidence: 'high' | 'medium' | 'low'
  matchedTriggers: string[]
}

export interface ToolSearchOptions {
  category?: ToolCategory
  limit?: number
  threshold?: number
  includeDeferred?: boolean
}

export interface ToolRegistry {
  tools: ToolDefinition[]
  lastIndexed: string
  version: string
}

export interface ToolExecutionContext {
  feature?: string
  phase?: string
  loadedTools: string[]
  searchHistory: Array<{ query: string; result: string | null; timestamp: string }>
}

export const DEFAULT_TOOL_SEARCH_OPTIONS: ToolSearchOptions = {
  limit: 5,
  threshold: 0.4,
  includeDeferred: true,
}

export function createToolDefinition(
  name: string,
  description: string,
  promptPath: string,
  category: ToolCategory,
  options: Partial<ToolDefinition> = {}
): ToolDefinition {
  const now = new Date().toISOString()
  return {
    name,
    description,
    promptPath,
    category,
    triggers: options.triggers || extractTriggers(description),
    priority: options.priority || 'medium',
    deferLoading: options.deferLoading ?? true,
    dependencies: options.dependencies || [],
    version: options.version || '1.0.0',
    author: options.author,
    createdAt: options.createdAt || now,
    updatedAt: now,
  }
}

export function extractTriggers(description: string): string[] {
  const stopwords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'for',
    'to',
    'and',
    'or',
    'with',
    'that',
    'this',
    'from',
    'by',
    'on',
    'in',
    'of',
    'it',
    'as',
    'be',
    'was',
    'were',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
  ])

  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word))
    .slice(0, 10)
}
