import path from 'node:path'
import fs from 'fs-extra'
import type { MemoryTier } from '../types/context.js'
import { getClaudePath, getFeaturesBasePath } from './git-paths.js'

export interface RetrievedContext {
  source: string
  content: string
  score: number
  tier: MemoryTier | 'decision'
}

export interface RetrievalResult {
  contexts: RetrievedContext[]
  totalScore: number
  usedSources: string[]
}

export interface RetrievalOptions {
  limit?: number
  includeTiers?: MemoryTier[]
  includeDecisions?: boolean
}

const DEFAULT_OPTIONS: Required<RetrievalOptions> = {
  limit: 5,
  includeTiers: ['project', 'feature', 'phase'],
  includeDecisions: true,
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'add', 'new', 'create', 'update', 'delete', 'remove',
  'implement', 'feature', 'system', 'code',
])

const TIER_WEIGHTS: Record<MemoryTier | 'decision', number> = {
  project: 10,
  feature: 25,
  phase: 35,
  session: 30,
  decision: 30,
}

export async function dynamicContextRetrieval(
  task: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const keywords = extractKeywords(task)
  const contexts: RetrievedContext[] = []
  const usedSources: string[] = []

  if (opts.includeTiers.includes('project')) {
    const projectContexts = await searchProjectMemory(keywords)
    contexts.push(...projectContexts)
  }

  if (opts.includeTiers.includes('feature')) {
    const featureContexts = await searchFeatureMemories(keywords)
    contexts.push(...featureContexts)
  }

  if (opts.includeDecisions) {
    const decisionContexts = await searchDecisions(keywords)
    contexts.push(...decisionContexts)
  }

  contexts.sort((a, b) => b.score - a.score)

  const limitedContexts = contexts.slice(0, opts.limit)
  const totalScore = limitedContexts.reduce((sum, ctx) => sum + ctx.score, 0)

  for (const ctx of limitedContexts) {
    if (!usedSources.includes(ctx.source)) {
      usedSources.push(ctx.source)
    }
  }

  return {
    contexts: limitedContexts,
    totalScore,
    usedSources,
  }
}

async function searchProjectMemory(keywords: string[]): Promise<RetrievedContext[]> {
  const projectPath = getClaudePath('memory/project-context.md')

  if (!(await fs.pathExists(projectPath))) {
    return []
  }

  const content = await fs.readFile(projectPath, 'utf-8')
  const score = calculateRelevanceScore(content, keywords) * (TIER_WEIGHTS.project / 100)

  if (score === 0) {
    return []
  }

  return [{
    source: projectPath,
    content,
    score,
    tier: 'project',
  }]
}

async function searchFeatureMemories(keywords: string[]): Promise<RetrievedContext[]> {
  const featuresPath = getFeaturesBasePath()

  if (!(await fs.pathExists(featuresPath))) {
    return []
  }

  const contexts: RetrievedContext[] = []
  const features = await fs.readdir(featuresPath)

  for (const feature of features) {
    const memoryPath = path.join(featuresPath, feature, 'memory.md')

    if (await fs.pathExists(memoryPath)) {
      const content = await fs.readFile(memoryPath, 'utf-8')
      const score = calculateRelevanceScore(content, keywords) * (TIER_WEIGHTS.feature / 100)

      if (score > 0) {
        contexts.push({
          source: memoryPath,
          content,
          score,
          tier: 'feature',
        })
      }
    }
  }

  return contexts
}

async function searchDecisions(keywords: string[]): Promise<RetrievedContext[]> {
  const decisionsPath = getClaudePath('memory/decisions')

  if (!(await fs.pathExists(decisionsPath))) {
    return []
  }

  const contexts: RetrievedContext[] = []
  const files = await fs.readdir(decisionsPath)

  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const filePath = path.join(decisionsPath, file)
    const content = await fs.readFile(filePath, 'utf-8')
    const score = calculateRelevanceScore(content, keywords) * (TIER_WEIGHTS.decision / 100)

    if (score > 0) {
      contexts.push({
        source: filePath,
        content,
        score,
        tier: 'decision',
      })
    }
  }

  return contexts
}

export function extractKeywords(task: string): string[] {
  if (!task || task.trim() === '') {
    return []
  }

  const words = task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word))

  return [...new Set(words)]
}

export function calculateRelevanceScore(content: string, keywords: string[]): number {
  if (keywords.length === 0) {
    return 0
  }

  const lowerContent = content.toLowerCase()
  let matchCount = 0

  for (const keyword of keywords) {
    if (lowerContent.includes(keyword)) {
      matchCount++
    } else {
      const stemLength = Math.min(4, Math.ceil(keyword.length * 0.5))
      const stem = keyword.slice(0, stemLength)
      if (stem.length >= 3 && lowerContent.includes(stem)) {
        matchCount += 0.5
      }
    }
  }

  const score = (matchCount / keywords.length) * 100

  return Math.round(score)
}

interface CacheEntry {
  result: RetrievalResult
  timestamp: number
}

export class ContextCache {
  private cache: Map<string, CacheEntry> = new Map()
  private ttlMs: number

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs
  }

  get(taskHash: string): RetrievalResult | undefined {
    const entry = this.cache.get(taskHash)

    if (!entry) {
      return undefined
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(taskHash)
      return undefined
    }

    return entry.result
  }

  set(taskHash: string, result: RetrievalResult): void {
    this.cache.set(taskHash, {
      result,
      timestamp: Date.now(),
    })
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}
