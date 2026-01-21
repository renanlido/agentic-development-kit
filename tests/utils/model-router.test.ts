import {
  getModelForPhase,
  getModelRouterConfig,
  setModelRouterConfig,
  resetModelRouterConfig,
} from '../../src/utils/model-router'
import { ModelType, DEFAULT_MODEL_MAPPING } from '../../src/types/model'
import fs from 'node:fs'

jest.mock('node:fs')
const mockFs = fs as jest.Mocked<typeof fs>

describe('model-router', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetModelRouterConfig()
  })

  describe('getModelForPhase', () => {
    describe('with default mapping', () => {
      it('should return opus for research phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('research')).toBe(ModelType.OPUS)
      })

      it('should return opus for planning phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('planning')).toBe(ModelType.OPUS)
      })

      it('should return opus for prd phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('prd')).toBe(ModelType.OPUS)
      })

      it('should return sonnet for implement phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('implement')).toBe(ModelType.SONNET)
      })

      it('should return haiku for qa phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('qa')).toBe(ModelType.HAIKU)
      })

      it('should return haiku for validation phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('validation')).toBe(ModelType.HAIKU)
      })

      it('should return sonnet for docs phase', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('docs')).toBe(ModelType.SONNET)
      })

      it('should return sonnet for unknown phase (default)', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('default')).toBe(ModelType.SONNET)
      })
    })

    describe('with CLI override', () => {
      it('should return override model when provided', () => {
        mockFs.existsSync.mockReturnValue(false)
        expect(getModelForPhase('research', ModelType.HAIKU)).toBe(ModelType.HAIKU)
      })

      it('should ignore config and return override', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            modelRouting: {
              enabled: true,
              mapping: { research: 'sonnet' },
            },
          })
        )

        expect(getModelForPhase('research', ModelType.HAIKU)).toBe(ModelType.HAIKU)
      })
    })

    describe('with config override', () => {
      it('should use config mapping when enabled', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            modelRouting: {
              enabled: true,
              mapping: { research: 'sonnet', implement: 'opus' },
            },
          })
        )

        expect(getModelForPhase('research')).toBe(ModelType.SONNET)
        expect(getModelForPhase('implement')).toBe(ModelType.OPUS)
      })

      it('should use default mapping when config routing is disabled', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            modelRouting: {
              enabled: false,
              mapping: { research: 'haiku' },
            },
          })
        )

        expect(getModelForPhase('research')).toBe(ModelType.OPUS)
      })

      it('should fallback to default for phases not in config', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            modelRouting: {
              enabled: true,
              mapping: { research: 'haiku' },
            },
          })
        )

        expect(getModelForPhase('implement')).toBe(ModelType.SONNET)
      })

      it('should handle malformed config gracefully', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue('invalid json')

        expect(getModelForPhase('research')).toBe(ModelType.OPUS)
      })

      it('should handle config without modelRouting', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(JSON.stringify({}))

        expect(getModelForPhase('research')).toBe(ModelType.OPUS)
      })

      it('should handle config with partial modelRouting', () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            modelRouting: {
              enabled: true,
            },
          })
        )

        expect(getModelForPhase('research')).toBe(ModelType.OPUS)
      })
    })
  })

  describe('getModelRouterConfig', () => {
    it('should return default config when no file exists', () => {
      mockFs.existsSync.mockReturnValue(false)

      const config = getModelRouterConfig()

      expect(config).toEqual({
        enabled: true,
        mapping: DEFAULT_MODEL_MAPPING,
      })
    })

    it('should merge config from file with defaults', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          modelRouting: {
            enabled: true,
            mapping: { research: 'haiku' },
          },
        })
      )

      const config = getModelRouterConfig()

      expect(config.enabled).toBe(true)
      expect(config.mapping.research).toBe(ModelType.HAIKU)
      expect(config.mapping.implement).toBe(ModelType.SONNET)
    })

    it('should cache config after first read', () => {
      mockFs.existsSync.mockReturnValue(false)

      getModelRouterConfig()
      getModelRouterConfig()
      getModelRouterConfig()

      expect(mockFs.existsSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('setModelRouterConfig', () => {
    it('should update in-memory config', () => {
      mockFs.existsSync.mockReturnValue(false)

      setModelRouterConfig({
        enabled: true,
        mapping: { research: ModelType.HAIKU },
      })

      expect(getModelForPhase('research')).toBe(ModelType.HAIKU)
    })

    it('should preserve unmodified mappings', () => {
      mockFs.existsSync.mockReturnValue(false)

      setModelRouterConfig({
        enabled: true,
        mapping: { research: ModelType.HAIKU },
      })

      expect(getModelForPhase('implement')).toBe(ModelType.SONNET)
    })
  })

  describe('resetModelRouterConfig', () => {
    it('should reset config to defaults', () => {
      mockFs.existsSync.mockReturnValue(false)

      setModelRouterConfig({
        enabled: true,
        mapping: { research: ModelType.HAIKU },
      })

      resetModelRouterConfig()

      expect(getModelForPhase('research')).toBe(ModelType.OPUS)
    })
  })

  describe('edge cases', () => {
    it('should validate model type values', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          modelRouting: {
            enabled: true,
            mapping: { research: 'invalid-model' },
          },
        })
      )

      expect(getModelForPhase('research')).toBe(ModelType.OPUS)
    })

    it('should handle fs read errors', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      expect(getModelForPhase('research')).toBe(ModelType.OPUS)
    })
  })
})
