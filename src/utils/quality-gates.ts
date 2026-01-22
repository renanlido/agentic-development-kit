export type DebtType = 'shortcut' | 'hack' | 'todo' | 'workaround'
export type DebtSeverity = 'low' | 'medium' | 'high'

export interface DebtItem {
  id: string
  type: DebtType
  description: string
  file: string
  line: number
  severity: DebtSeverity
  createdAt: string
}

export interface RiskFactors {
  codeComplexity: number
  testCoverage: number
  securityIssues: number
  aiReviewRisk: number
  debtRatio: number
}

export interface ConfidenceFactors {
  testCoverage: number
  reviewAgreement: number
  codeComplexity: number
  documentationScore: number
}

export interface QualityGateResult {
  passed: boolean
  riskScore: number
  threshold: number
  recommendation: 'APPROVE' | 'REVIEW' | 'BLOCK'
  factors: RiskFactors
}

export class QualityGate {
  private threshold: number

  constructor(threshold = 70) {
    this.threshold = threshold
  }

  evaluate(factors: RiskFactors): QualityGateResult {
    const riskScore = calculateOverallRiskScore(factors)
    return evaluateQualityGate(riskScore, this.threshold, factors)
  }
}

const RISK_WEIGHTS = {
  codeComplexity: 0.15,
  testCoverage: 0.25,
  securityIssues: 0.3,
  aiReviewRisk: 0.2,
  debtRatio: 0.1,
}

export function calculateOverallRiskScore(factors: RiskFactors): number {
  let risk = 0

  risk += factors.codeComplexity * RISK_WEIGHTS.codeComplexity

  const coverageRisk = Math.max(0, 100 - factors.testCoverage)
  risk += coverageRisk * RISK_WEIGHTS.testCoverage

  risk += Math.min(100, factors.securityIssues * 15) * RISK_WEIGHTS.securityIssues

  risk += factors.aiReviewRisk * RISK_WEIGHTS.aiReviewRisk

  risk += Math.min(100, factors.debtRatio * 2) * RISK_WEIGHTS.debtRatio

  return Math.min(100, Math.round(risk))
}

let debtIdCounter = 0

export function trackTechnicalDebt(input: {
  type: DebtType
  description: string
  file: string
  line: number
  severity: DebtSeverity
}): DebtItem {
  debtIdCounter++

  return {
    id: `debt-${debtIdCounter}-${Date.now()}`,
    type: input.type,
    description: input.description,
    file: input.file,
    line: input.line,
    severity: input.severity,
    createdAt: new Date().toISOString(),
  }
}

const CONFIDENCE_WEIGHTS = {
  testCoverage: 0.3,
  reviewAgreement: 0.35,
  codeComplexity: 0.15,
  documentationScore: 0.2,
}

export function calculateConfidenceScore(factors: ConfidenceFactors): number {
  let confidence = 0

  confidence += factors.testCoverage * CONFIDENCE_WEIGHTS.testCoverage

  confidence += factors.reviewAgreement * CONFIDENCE_WEIGHTS.reviewAgreement

  const complexityBonus = Math.max(0, 100 - factors.codeComplexity)
  confidence += complexityBonus * CONFIDENCE_WEIGHTS.codeComplexity

  confidence += factors.documentationScore * CONFIDENCE_WEIGHTS.documentationScore

  return Math.min(100, Math.round(confidence))
}

const WARNING_MARGIN = 10

export function evaluateQualityGate(
  riskScore: number,
  threshold: number,
  factors?: RiskFactors
): QualityGateResult {
  const passed = riskScore <= threshold
  let recommendation: 'APPROVE' | 'REVIEW' | 'BLOCK'

  if (riskScore > threshold) {
    recommendation = 'BLOCK'
  } else if (riskScore >= threshold - WARNING_MARGIN) {
    recommendation = 'REVIEW'
  } else {
    recommendation = 'APPROVE'
  }

  return {
    passed,
    riskScore,
    threshold,
    recommendation,
    factors: factors ?? {
      codeComplexity: 0,
      testCoverage: 100,
      securityIssues: 0,
      aiReviewRisk: 0,
      debtRatio: 0,
    },
  }
}

export function formatQualityReport(result: QualityGateResult): string {
  const lines: string[] = []

  lines.push('## Quality Gate Report')
  lines.push('')

  const statusIcon = result.passed ? '✅' : '❌'
  const statusText = result.passed ? 'PASSED' : 'FAILED'
  lines.push(`**Status:** ${statusIcon} ${statusText}`)
  lines.push('')

  lines.push(`**Risk Score:** ${result.riskScore}/${result.threshold}`)
  lines.push(`**Recommendation:** ${result.recommendation}`)
  lines.push('')

  lines.push('### Factor Breakdown')
  lines.push('')
  lines.push('| Factor | Value | Impact |')
  lines.push('|--------|-------|--------|')

  const factors = result.factors

  const complexityImpact = factors.codeComplexity > 50 ? '⚠️ High' : '✅ OK'
  lines.push(`| Code Complexity | ${factors.codeComplexity}% | ${complexityImpact} |`)

  const coverageImpact = factors.testCoverage < 80 ? '⚠️ Low' : '✅ OK'
  lines.push(`| Test Coverage | ${factors.testCoverage}% | ${coverageImpact} |`)

  const securityImpact = factors.securityIssues > 0 ? '❌ Issues' : '✅ OK'
  lines.push(`| Security Issues | ${factors.securityIssues} | ${securityImpact} |`)

  const aiImpact = factors.aiReviewRisk > 50 ? '⚠️ Concerns' : '✅ OK'
  lines.push(`| AI Review Risk | ${factors.aiReviewRisk}% | ${aiImpact} |`)

  const debtImpact = factors.debtRatio > 10 ? '⚠️ High' : '✅ OK'
  lines.push(`| Debt Ratio | ${factors.debtRatio}% | ${debtImpact} |`)

  lines.push('')

  if (!result.passed) {
    lines.push('### Required Actions')
    lines.push('')
    if (factors.securityIssues > 0) {
      lines.push(`- Address ${factors.securityIssues} security issue(s)`)
    }
    if (factors.testCoverage < 80) {
      lines.push('- Increase test coverage to at least 80%')
    }
    if (factors.codeComplexity > 50) {
      lines.push('- Reduce code complexity')
    }
  }

  return lines.join('\n')
}
