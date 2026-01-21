export interface MemoryDocumentMetadata {
  source: string
  title?: string
  createdAt: string
  updatedAt: string
  tags?: string[]
  feature?: string
}

export interface MemoryDocument {
  id: string
  content: string
  metadata: MemoryDocumentMetadata
  embedding?: number[]
}

export interface MemoryQueryOptions {
  limit?: number
  threshold?: number
  hybrid?: boolean
  hybridWeights?: {
    semantic: number
    keyword: number
  }
}

export interface MemoryQuery {
  query: string
  options?: MemoryQueryOptions
}

export interface MemoryResultDocument {
  id: string
  content: string
  score: number
  metadata: MemoryDocumentMetadata
}

export interface MemoryResult {
  documents: MemoryResultDocument[]
  timings: {
    total: number
    embedding?: number
    search?: number
    rerank?: number
  }
  meta: {
    provider: string
    query: string
    mode: 'semantic' | 'keyword' | 'hybrid'
  }
}

export interface MemoryConfigInput {
  version?: string
  provider: 'mcp-memory' | 'mcp-local-rag'
  storage?: {
    path?: string
    maxSize?: string
  }
  embedding?: {
    model?: string
    chunkSize?: number
    overlap?: number
  }
  retrieval?: {
    topK?: number
    finalK?: number
    threshold?: number
  }
  hybridSearch?: {
    enabled?: boolean
    weights?: {
      semantic?: number
      keyword?: number
    }
  }
  indexPatterns?: string[]
  ignorePatterns?: string[]
}

export interface MemoryConfig {
  version: string
  provider: 'mcp-memory' | 'mcp-local-rag'
  storage: {
    path: string
    maxSize: string
  }
  embedding: {
    model: string
    chunkSize: number
    overlap: number
  }
  retrieval: {
    topK: number
    finalK: number
    threshold: number
  }
  hybridSearch: {
    enabled: boolean
    weights: {
      semantic: number
      keyword: number
    }
  }
  indexPatterns: string[]
  ignorePatterns: string[]
}

export class MemoryConfigSchema {
  static parse(input: MemoryConfigInput): MemoryConfig {
    const validated = this.safeParse(input)
    if (!validated.success) {
      throw new Error(`Invalid MemoryConfig: ${validated.errors.join(', ')}`)
    }
    return validated.data
  }

  static safeParse(input: unknown): { success: true; data: MemoryConfig } | { success: false; errors: string[] } {
    const errors: string[] = []

    if (typeof input !== 'object' || input === null) {
      return { success: false, errors: ['Input must be an object'] }
    }

    const obj = input as Record<string, unknown>

    if (!obj.provider || (obj.provider !== 'mcp-memory' && obj.provider !== 'mcp-local-rag')) {
      errors.push('provider must be "mcp-memory" or "mcp-local-rag"')
    }

    if (obj.storage && typeof obj.storage !== 'object') {
      errors.push('storage must be an object')
    }

    if (obj.embedding && typeof obj.embedding !== 'object') {
      errors.push('embedding must be an object')
    }

    const embeddingObj = (obj.embedding as Record<string, unknown> | undefined) ?? {}
    if (embeddingObj.chunkSize !== undefined && (typeof embeddingObj.chunkSize !== 'number' || embeddingObj.chunkSize <= 0)) {
      errors.push('embedding.chunkSize must be a positive number')
    }

    if (embeddingObj.overlap !== undefined && (typeof embeddingObj.overlap !== 'number' || embeddingObj.overlap < 0)) {
      errors.push('embedding.overlap must be a non-negative number')
    }

    const retrievalObj = (obj.retrieval as Record<string, unknown> | undefined) ?? {}
    if (retrievalObj.topK !== undefined && (typeof retrievalObj.topK !== 'number' || retrievalObj.topK <= 0)) {
      errors.push('retrieval.topK must be a positive number')
    }

    if (retrievalObj.finalK !== undefined && (typeof retrievalObj.finalK !== 'number' || retrievalObj.finalK <= 0)) {
      errors.push('retrieval.finalK must be a positive number')
    }

    if (retrievalObj.threshold !== undefined && (typeof retrievalObj.threshold !== 'number' || retrievalObj.threshold < 0 || retrievalObj.threshold > 1)) {
      errors.push('retrieval.threshold must be a number between 0 and 1')
    }

    const hybridObj = (obj.hybridSearch as Record<string, unknown> | undefined) ?? {}
    const weightsObj = (hybridObj.weights as Record<string, unknown> | undefined) ?? {}

    if (weightsObj.semantic !== undefined && (typeof weightsObj.semantic !== 'number' || weightsObj.semantic < 0 || weightsObj.semantic > 1)) {
      errors.push('hybridSearch.weights.semantic must be a number between 0 and 1')
    }

    if (weightsObj.keyword !== undefined && (typeof weightsObj.keyword !== 'number' || weightsObj.keyword < 0 || weightsObj.keyword > 1)) {
      errors.push('hybridSearch.weights.keyword must be a number between 0 and 1')
    }

    if (errors.length > 0) {
      return { success: false, errors }
    }

    const inputTyped = obj as unknown as MemoryConfigInput
    const storageObj = (inputTyped.storage ?? {}) as Record<string, unknown>

    return {
      success: true,
      data: {
        version: inputTyped.version ?? '1.0.0',
        provider: inputTyped.provider,
        storage: {
          path: (storageObj.path as string) ?? '.adk/memory.db',
          maxSize: (storageObj.maxSize as string) ?? '500MB',
        },
        embedding: {
          model: embeddingObj.model as string ?? 'nomic-embed-text-v1.5',
          chunkSize: (embeddingObj.chunkSize as number) ?? 512,
          overlap: (embeddingObj.overlap as number) ?? 100,
        },
        retrieval: {
          topK: (retrievalObj.topK as number) ?? 10,
          finalK: (retrievalObj.finalK as number) ?? 5,
          threshold: (retrievalObj.threshold as number) ?? 0.65,
        },
        hybridSearch: {
          enabled: (hybridObj.enabled as boolean) ?? true,
          weights: {
            semantic: (weightsObj.semantic as number) ?? 0.7,
            keyword: (weightsObj.keyword as number) ?? 0.3,
          },
        },
        indexPatterns: (inputTyped.indexPatterns as string[]) ?? ['.claude/**/*.md', '.claude/**/*.txt'],
        ignorePatterns: (inputTyped.ignorePatterns as string[]) ?? ['**/.env*', '**/credentials*', '**/*.key', '**/*.pem', '**/secrets*'],
      },
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMemoryDocumentMetadata(obj: unknown): obj is MemoryDocumentMetadata {
  if (!isObject(obj)) return false

  return (
    typeof obj.source === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    (obj.title === undefined || typeof obj.title === 'string') &&
    (obj.tags === undefined || (Array.isArray(obj.tags) && obj.tags.every((t) => typeof t === 'string'))) &&
    (obj.feature === undefined || typeof obj.feature === 'string')
  )
}

export function isMemoryDocument(obj: unknown): obj is MemoryDocument {
  if (!isObject(obj)) return false

  return (
    typeof obj.id === 'string' &&
    typeof obj.content === 'string' &&
    isMemoryDocumentMetadata(obj.metadata) &&
    (obj.embedding === undefined || (Array.isArray(obj.embedding) && obj.embedding.every((e) => typeof e === 'number')))
  )
}

export function isMemoryResult(obj: unknown): obj is MemoryResult {
  if (!isObject(obj)) return false

  const hasDocuments =
    Array.isArray(obj.documents) &&
    obj.documents.every(
      (doc) =>
        isObject(doc) &&
        typeof doc.id === 'string' &&
        typeof doc.content === 'string' &&
        typeof doc.score === 'number' &&
        isMemoryDocumentMetadata(doc.metadata),
    )

  const hasTimings = isObject(obj.timings) && typeof obj.timings.total === 'number'

  const hasMeta =
    isObject(obj.meta) &&
    typeof obj.meta.provider === 'string' &&
    typeof obj.meta.query === 'string' &&
    (obj.meta.mode === 'semantic' || obj.meta.mode === 'keyword' || obj.meta.mode === 'hybrid')

  return hasDocuments && hasTimings && hasMeta
}
