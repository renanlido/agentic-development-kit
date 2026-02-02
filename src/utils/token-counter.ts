import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { encoding_for_model, type Tiktoken } from 'tiktoken'
import type { TokenCountResult } from '../types/compaction.js'

interface CacheEntry {
  count: number
  timestamp: number
  hash: string
  lastAccessed: number
}

let sharedEncoder: Tiktoken | null = null

function getEncoder(): Tiktoken {
  if (!sharedEncoder) {
    sharedEncoder = encoding_for_model('gpt-4')
  }
  return sharedEncoder
}

export function resetEncoder(): void {
  sharedEncoder = null
}

export class TokenCounter {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly CACHE_TTL: number
  private readonly CACHE_MAX_SIZE: number
  private readonly ADJUSTMENT_FACTOR = 0.92
  private hits = 0
  private misses = 0
  private anthropic: Anthropic | null = null

  constructor(options?: { cacheTTL?: number; cacheMaxSize?: number }) {
    this.CACHE_TTL = options?.cacheTTL ?? 3600000
    this.CACHE_MAX_SIZE = options?.cacheMaxSize ?? 1000

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    }
  }

  async count(text: string): Promise<TokenCountResult> {
    const hash = this.createHash(text)
    const cached = this.getCached(hash)

    if (cached) {
      this.hits++
      return {
        count: cached.count,
        source: 'cache',
        precision: 1.0,
        timestamp: cached.timestamp,
        cached: true,
      }
    }

    this.misses++

    try {
      if (this.anthropic) {
        const count = await this.countViaAPI(text)
        this.setCache(hash, count)
        return {
          count,
          source: 'api',
          precision: 1.0,
          timestamp: Date.now(),
          cached: false,
        }
      }
    } catch (error) {
      console.warn('API token counting failed, using offline mode:', error)
    }

    const result = this.countOffline(text)
    this.setCache(hash, result.count)
    return result
  }

  private async countViaAPI(text: string): Promise<number> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized')
    }

    const response = await this.anthropic.beta.messages.countTokens({
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: text,
        },
      ],
      betas: ['token-counting-2024-11-01'],
    })

    return response.input_tokens
  }

  private countOffline(text: string): TokenCountResult {
    const encoder = getEncoder()
    const tokens = encoder.encode(text)
    const rawCount = tokens.length
    const adjustedCount = Math.round(rawCount * this.ADJUSTMENT_FACTOR)

    return {
      count: adjustedCount,
      source: 'offline',
      precision: 0.88,
      timestamp: Date.now(),
      cached: false,
    }
  }

  private createHash(text: string): string {
    return createHash('md5').update(text).digest('hex')
  }

  private getCached(hash: string): CacheEntry | undefined {
    const entry = this.cache.get(hash)

    if (!entry) {
      return undefined
    }

    const age = Date.now() - entry.timestamp
    if (age > this.CACHE_TTL) {
      this.cache.delete(hash)
      return undefined
    }

    entry.lastAccessed = Date.now()
    return entry
  }

  private setCache(hash: string, count: number): void {
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      let lruKey: string | null = null
      let lruTime = Number.MAX_SAFE_INTEGER

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed
          lruKey = key
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey)
      }
    }

    this.cache.set(hash, {
      count,
      timestamp: Date.now(),
      hash,
      lastAccessed: Date.now(),
    })
  }

  invalidateCache(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    }
  }
}

export const tokenCounter = new TokenCounter()
