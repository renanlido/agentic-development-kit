export enum ModelType {
  OPUS = 'opus',
  SONNET = 'sonnet',
  HAIKU = 'haiku',
}

export type PhaseType =
  | 'guidelines'
  | 'research'
  | 'planning'
  | 'prd'
  | 'implement'
  | 'qa'
  | 'validation'
  | 'docs'
  | 'default'

export interface PhaseModelMapping {
  guidelines: ModelType
  research: ModelType
  planning: ModelType
  prd: ModelType
  implement: ModelType
  qa: ModelType
  validation: ModelType
  docs: ModelType
  default: ModelType
}

export interface ModelRoutingConfig {
  enabled: boolean
  mapping: Partial<PhaseModelMapping>
}

export interface ModelConfig {
  modelRouting: ModelRoutingConfig
}

export const DEFAULT_MODEL_MAPPING: PhaseModelMapping = {
  guidelines: ModelType.OPUS,
  research: ModelType.OPUS,
  planning: ModelType.OPUS,
  prd: ModelType.OPUS,
  implement: ModelType.OPUS,
  qa: ModelType.HAIKU,
  validation: ModelType.HAIKU,
  docs: ModelType.SONNET,
  default: ModelType.SONNET,
}
