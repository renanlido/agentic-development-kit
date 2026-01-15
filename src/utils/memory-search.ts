import type { Decision, DecisionCategory, MemorySearchResult } from '../types/memory.js'
import { listDecisions } from './decision-utils.js'

export interface MemorySearchOptions {
  category?: DecisionCategory
  limit?: number
  threshold?: number
  includeArchived?: boolean
}

export const DEFAULT_MEMORY_SEARCH_OPTIONS: MemorySearchOptions = {
  limit: 5,
  threshold: 0.3,
  includeArchived: false,
}

function simpleSearch(text: string, query: string): number {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const words = lowerQuery.split(/\s+/)

  let matches = 0
  for (const word of words) {
    if (lowerText.includes(word)) {
      matches++
    }
  }

  return words.length > 0 ? matches / words.length : 0
}

function calculateScore(
  decision: Decision,
  query: string
): { score: number; matchedFields: string[] } {
  const fields = [
    { name: 'title', value: decision.title, weight: 0.35 },
    { name: 'context', value: decision.context, weight: 0.2 },
    { name: 'rationale', value: decision.rationale, weight: 0.2 },
    { name: 'tags', value: decision.tags.join(' '), weight: 0.15 },
    { name: 'chosen', value: decision.chosen, weight: 0.1 },
  ]

  let totalScore = 0
  const matchedFields: string[] = []

  for (const field of fields) {
    const fieldScore = simpleSearch(field.value, query)
    if (fieldScore > 0) {
      totalScore += fieldScore * field.weight
      matchedFields.push(field.name)
    }
  }

  return { score: totalScore, matchedFields }
}

export async function recallMemory(
  query: string,
  options: MemorySearchOptions = DEFAULT_MEMORY_SEARCH_OPTIONS
): Promise<MemorySearchResult[]> {
  const decisions = await listDecisions(options.category)

  if (decisions.length === 0) {
    return []
  }

  const results = decisions
    .map((decision) => {
      const { score, matchedFields } = calculateScore(decision, query)
      return { decision, score, matchedFields }
    })
    .filter((r) => r.score >= (options.threshold || 0.3))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit || 5)

  return results
}

export async function findRelatedDecisions(
  featureName: string,
  options: MemorySearchOptions = DEFAULT_MEMORY_SEARCH_OPTIONS
): Promise<MemorySearchResult[]> {
  const decisions = await listDecisions(options.category)

  const directlyRelated = decisions.filter((d) => d.relatedFeatures.includes(featureName))

  if (directlyRelated.length > 0) {
    return directlyRelated.map((decision) => ({
      decision,
      score: 1.0,
      matchedFields: ['relatedFeatures'],
    }))
  }

  return recallMemory(featureName, options)
}

export async function searchByTags(
  tags: string[],
  options: MemorySearchOptions = DEFAULT_MEMORY_SEARCH_OPTIONS
): Promise<MemorySearchResult[]> {
  const decisions = await listDecisions(options.category)

  const matchingDecisions = decisions.filter((d) =>
    tags.some((tag) => d.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase()))
  )

  return matchingDecisions.slice(0, options.limit || 5).map((decision) => {
    const matchedTags = decision.tags.filter((t) =>
      tags.map((tag) => tag.toLowerCase()).includes(t.toLowerCase())
    )
    return {
      decision,
      score: matchedTags.length / tags.length,
      matchedFields: ['tags'],
    }
  })
}

export async function getDecisionsByCategory(
  category: DecisionCategory
): Promise<MemorySearchResult[]> {
  const decisions = await listDecisions(category)

  return decisions.map((decision) => ({
    decision,
    score: 1.0,
    matchedFields: ['category'],
  }))
}

export interface MemoryStats {
  totalDecisions: number
  byCategory: Record<string, number>
  recentDecisions: Decision[]
  mostLinkedDecisions: Decision[]
}

export async function getMemoryStats(): Promise<MemoryStats> {
  const decisions = await listDecisions()

  const byCategory: Record<string, number> = {}
  for (const decision of decisions) {
    byCategory[decision.category] = (byCategory[decision.category] || 0) + 1
  }

  const sorted = [...decisions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const mostLinked = [...decisions].sort(
    (a, b) => b.relatedFeatures.length - a.relatedFeatures.length
  )

  return {
    totalDecisions: decisions.length,
    byCategory,
    recentDecisions: sorted.slice(0, 5),
    mostLinkedDecisions: mostLinked.slice(0, 5),
  }
}

export function formatSearchResult(result: MemorySearchResult): string {
  const { decision, score, matchedFields } = result
  const scorePercent = Math.round(score * 100)
  const fields = matchedFields.join(', ')

  return [
    `📌 ${decision.title} (${scorePercent}% match)`,
    `   Category: ${decision.category}`,
    `   Tags: ${decision.tags.join(', ') || 'none'}`,
    `   Matched: ${fields}`,
    `   ID: ${decision.id}`,
  ].join('\n')
}

export function formatSearchResults(results: MemorySearchResult[]): string {
  if (results.length === 0) {
    return 'No matching decisions found.'
  }

  const header = `Found ${results.length} matching decision(s):\n`
  const formatted = results.map(formatSearchResult).join('\n\n')

  return `${header}\n${formatted}`
}
