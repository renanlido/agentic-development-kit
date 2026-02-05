export type TestStatus = 'passing' | 'failing' | 'pending' | 'skipped'

export type TestCategory = 'functional' | 'ui' | 'integration' | 'api' | 'performance'

export interface TestStep {
  description: string
  expected: string
}

export interface FeatureTest {
  id: string
  description: string
  category: TestCategory
  steps: TestStep[]
  status: TestStatus
  files: string[]
  lastTested?: string
  evidence?: string
}

export interface FeatureListSummary {
  total: number
  passing: number
  failing: number
  pending: number
  skipped: number
}

export interface FeatureList {
  $schema: string
  version: string
  feature: string
  createdAt: string
  updatedAt: string
  tests: FeatureTest[]
  summary: FeatureListSummary
}

export interface FeatureTestInput {
  id: string
  description: string
  category: TestCategory
  steps: TestStep[]
  files?: string[]
}
