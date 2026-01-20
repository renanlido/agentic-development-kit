import type { MemoryPhase } from './memory'

export interface WeeklyReportCommit {
  hash: string
  message: string
  author: string
  date: string
}

export interface WeeklyReportFeature {
  name: string
  phase: MemoryPhase
  progress: number
  lastUpdated: string
}

export interface WeeklyReport {
  period: {
    start: string
    end: string
  }
  commits: WeeklyReportCommit[]
  featuresWorked: WeeklyReportFeature[]
  summary: {
    totalCommits: number
    featuresStarted: number
    featuresCompleted: number
    linesAdded: number
    linesRemoved: number
  }
  generatedAt: string
}

export interface FeatureReportPhase {
  name: MemoryPhase
  status: 'completed' | 'in_progress' | 'pending'
  startedAt?: string
  completedAt?: string
  duration?: number
}

export interface FeatureReportMetrics {
  totalDuration: number
  testsWritten: number
  testsPassing: number
  coverage: number
  linesAdded: number
  linesRemoved: number
  filesChanged: number
}

export interface FeatureReportRisk {
  description: string
  severity: 'low' | 'medium' | 'high'
  mitigated: boolean
}

export interface FeatureReport {
  feature: string
  createdAt: string
  currentPhase: MemoryPhase
  phases: FeatureReportPhase[]
  metrics: FeatureReportMetrics
  risks: FeatureReportRisk[]
  blockers: string[]
  nextSteps: string[]
  generatedAt: string
}

export interface ReportOptions {
  weekly?: boolean
  feature?: string
  output?: string
  format?: 'markdown' | 'json'
}
