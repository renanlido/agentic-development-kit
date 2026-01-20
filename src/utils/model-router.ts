import fs from 'node:fs'
import path from 'node:path'
import {
  ModelType,
  type PhaseType,
  type PhaseModelMapping,
  type ModelRoutingConfig,
  DEFAULT_MODEL_MAPPING,
} from '../types/model'

const CONFIG_FILE = '.adk/config.json'

let cachedConfig: ModelRoutingConfig | null = null

function isValidModelType(value: string): value is ModelType {
  return Object.values(ModelType).includes(value as ModelType)
}

function loadConfigFromFile(): ModelRoutingConfig | null {
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE)

    if (!fs.existsSync(configPath)) {
      return null
    }

    const content = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content)

    if (!config.modelRouting) {
      return null
    }

    const mapping: Partial<PhaseModelMapping> = {}
    const rawMapping = config.modelRouting.mapping || {}

    for (const [phase, model] of Object.entries(rawMapping)) {
      if (typeof model === 'string' && isValidModelType(model)) {
        mapping[phase as PhaseType] = model as ModelType
      }
    }

    return {
      enabled: config.modelRouting.enabled ?? true,
      mapping: { ...DEFAULT_MODEL_MAPPING, ...mapping },
    }
  } catch {
    return null
  }
}

/**
 * Retorna a configuracao atual de roteamento de modelos.
 * Carrega do arquivo .adk/config.json se ainda nao cached.
 */
export function getModelRouterConfig(): ModelRoutingConfig {
  if (cachedConfig === null) {
    const fileConfig = loadConfigFromFile()
    cachedConfig = fileConfig || {
      enabled: true,
      mapping: { ...DEFAULT_MODEL_MAPPING },
    }
  }

  return cachedConfig
}

export function setModelRouterConfig(
  config: Partial<ModelRoutingConfig>
): void {
  const currentConfig = getModelRouterConfig()
  cachedConfig = {
    enabled: config.enabled ?? currentConfig.enabled,
    mapping: {
      ...currentConfig.mapping,
      ...(config.mapping || {}),
    },
  }
}

export function resetModelRouterConfig(): void {
  cachedConfig = null
}

/**
 * Retorna o modelo apropriado para uma fase especifica.
 * Precedencia: override CLI > config por fase > default mapping > fallback
 *
 * @param phase - Fase do workflow (research, plan, implement, qa)
 * @param override - Override opcional via CLI (--model flag)
 * @returns Tipo de modelo Claude a ser usado (opus, sonnet, haiku)
 */
export function getModelForPhase(
  phase: PhaseType,
  override?: ModelType
): ModelType {
  if (override) {
    return override
  }

  const config = getModelRouterConfig()

  if (!config.enabled) {
    return DEFAULT_MODEL_MAPPING[phase] || DEFAULT_MODEL_MAPPING.default
  }

  return config.mapping[phase] || DEFAULT_MODEL_MAPPING[phase] || DEFAULT_MODEL_MAPPING.default
}
