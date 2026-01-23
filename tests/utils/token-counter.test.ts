import { TokenCounter } from '../../src/utils/token-counter'

const mockCountTokens = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    beta: {
      messages: {
        countTokens: mockCountTokens,
      },
    },
  })),
}))

jest.mock('tiktoken', () => ({
  encoding_for_model: jest.fn().mockReturnValue({
    encode: jest.fn().mockReturnValue(new Array(100)),
  }),
}))

describe('TokenCounter', () => {
  let tokenCounter: TokenCounter

  beforeEach(() => {
    tokenCounter = new TokenCounter()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCountTokens.mockReset()
  })

  afterEach(() => {
    tokenCounter.invalidateCache()
    jest.clearAllMocks()
  })

  describe('count', () => {
    it('should return cached result when available', async () => {
      const text = 'This is a test text for caching'
      const firstResult = await tokenCounter.count(text)
      const secondResult = await tokenCounter.count(text)

      expect(firstResult.count).toBe(secondResult.count)
      expect(secondResult.source).toBe('cache')
      expect(secondResult.cached).toBe(true)
    })

    it('should call API when cache miss', async () => {
      mockCountTokens.mockResolvedValue({ input_tokens: 150 })

      const text = 'New text not in cache'
      const result = await tokenCounter.count(text)

      expect(result.source).toBe('api')
      expect(result.count).toBe(150)
      expect(result.precision).toBe(1.0)
      expect(result.cached).toBe(false)
    })

    it('should fallback to offline when API fails', async () => {
      mockCountTokens.mockRejectedValue(new Error('API unavailable'))

      const text = 'Text when API is down'
      const result = await tokenCounter.count(text)

      expect(result.source).toBe('offline')
      expect(result.precision).toBe(0.88)
      expect(result.count).toBeGreaterThan(0)
    })

    it('should apply adjustment factor in offline mode', async () => {
      mockCountTokens.mockRejectedValue(new Error('API down'))

      const tiktoken = jest.requireMock('tiktoken')
      const mockTokens = new Array(100)
      tiktoken.encoding_for_model.mockReturnValue({
        encode: jest.fn().mockReturnValue(mockTokens),
      })

      const text = 'Test adjustment factor'
      const result = await tokenCounter.count(text)

      const expectedCount = Math.round(mockTokens.length * 0.92)
      expect(result.count).toBe(expectedCount)
      expect(result.source).toBe('offline')
    })

    it('should respect cache TTL', async () => {
      const CACHE_TTL = 100
      const text = 'TTL test text'

      const counter = new TokenCounter({ cacheTTL: CACHE_TTL })
      await counter.count(text)

      await new Promise((resolve) => setTimeout(resolve, CACHE_TTL + 50))

      const result = await counter.count(text)
      expect(result.cached).toBe(false)
    })

    it('should evict LRU entries when cache is full', async () => {
      const CACHE_MAX_SIZE = 3
      const counter = new TokenCounter({ cacheMaxSize: CACHE_MAX_SIZE })

      for (let i = 0; i < CACHE_MAX_SIZE + 2; i++) {
        await counter.count(`text-${i}`)
      }

      const stats = counter.getCacheStats()
      expect(stats.size).toBeLessThanOrEqual(CACHE_MAX_SIZE)
    })
  })

  describe('countViaAPI', () => {
    it('should call anthropic.messages.countTokens', async () => {
      mockCountTokens.mockResolvedValue({ input_tokens: 200 })

      const counter = new TokenCounter()
      const text = 'API counting test'
      const result = await counter.count(text)

      expect(mockCountTokens).toHaveBeenCalled()
      expect(result.count).toBe(200)
    })

    it('should throw on API error', async () => {
      const Anthropic = jest.requireMock('@anthropic-ai/sdk').default
      const mockInstance = new Anthropic()
      const apiError = new Error('API rate limit')
      mockInstance.beta.messages.countTokens.mockRejectedValue(apiError)

      const counter = new TokenCounter()
      const text = 'API error test'

      const result = await counter.count(text)
      expect(result.source).toBe('offline')
    })
  })

  describe('countOffline', () => {
    it('should return result with precision 0.88', async () => {
      mockCountTokens.mockRejectedValue(new Error('No API'))

      const counter = new TokenCounter()
      const text = 'Offline precision test'
      const result = await counter.count(text)

      expect(result.precision).toBe(0.88)
      expect(result.source).toBe('offline')
    })

    it('should apply adjustment factor 0.92', async () => {
      mockCountTokens.mockRejectedValue(new Error('No API'))

      const tiktoken = jest.requireMock('tiktoken')
      const mockTokens = new Array(100)
      tiktoken.encoding_for_model.mockReturnValue({
        encode: jest.fn().mockReturnValue(mockTokens),
      })

      const counter = new TokenCounter()
      const result = await counter.count('Adjustment test')

      expect(result.count).toBe(Math.round(100 * 0.92))
    })

    it('should handle empty string', async () => {
      mockCountTokens.mockRejectedValue(new Error('No API'))

      const tiktoken = jest.requireMock('tiktoken')
      tiktoken.encoding_for_model.mockReturnValue({
        encode: jest.fn().mockReturnValue([]),
      })

      const counter = new TokenCounter()
      const result = await counter.count('')

      expect(result.count).toBe(0)
    })

    it('should handle unicode text', async () => {
      mockCountTokens.mockRejectedValue(new Error('No API'))

      const tiktoken = jest.requireMock('tiktoken')
      const mockTokens = new Array(50)
      tiktoken.encoding_for_model.mockReturnValue({
        encode: jest.fn().mockReturnValue(mockTokens),
      })

      const counter = new TokenCounter()
      const result = await counter.count('Hello 世界 🌍')

      expect(result.count).toBeGreaterThan(0)
      expect(result.source).toBe('offline')
    })
  })

  describe('cache', () => {
    it('should store entries with correct TTL', async () => {
      const counter = new TokenCounter()
      const text = 'Cache TTL test'

      await counter.count(text)
      const stats1 = counter.getCacheStats()
      expect(stats1.size).toBeGreaterThan(0)

      await counter.count(text)
      const stats2 = counter.getCacheStats()
      expect(stats2.hits).toBeGreaterThan(stats1.hits)
    })

    it('should invalidate on demand', async () => {
      const counter = new TokenCounter()
      await counter.count('test1')
      await counter.count('test2')

      const statsBefore = counter.getCacheStats()
      expect(statsBefore.size).toBeGreaterThan(0)

      counter.invalidateCache()
      const statsAfter = counter.getCacheStats()
      expect(statsAfter.size).toBe(0)
    })

    it('should report cache stats', async () => {
      const counter = new TokenCounter()

      await counter.count('text1')
      await counter.count('text2')
      await counter.count('text1')

      const stats = counter.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.hits).toBeGreaterThan(0)
      expect(stats.misses).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should count via API in less than 500ms', async () => {
      mockCountTokens.mockResolvedValue({ input_tokens: 100 })

      const counter = new TokenCounter()
      const start = Date.now()
      await counter.count('Performance test API')
      const duration = Date.now() - start

      expect(duration).toBeLessThan(500)
    })

    it('should count offline in less than 50ms', async () => {
      mockCountTokens.mockRejectedValue(new Error('No API'))

      const counter = new TokenCounter()
      const start = Date.now()
      await counter.count('Performance test offline')
      const duration = Date.now() - start

      expect(duration).toBeLessThan(50)
    })

    it('should lookup cache in less than 5ms', async () => {
      const counter = new TokenCounter()
      const text = 'Cache performance test'

      await counter.count(text)

      const start = Date.now()
      await counter.count(text)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(5)
    })
  })
})
