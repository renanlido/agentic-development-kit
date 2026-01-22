export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface ReviewFinding {
  id: string
  category: string
  severity: Severity
  message: string
  file: string
  line: number
}

export interface Agreement {
  primary: ReviewFinding
  secondary: ReviewFinding
}

export interface Disagreement {
  primary: ReviewFinding
  secondary: ReviewFinding
  reason: string
}

export interface ConsolidatedReview {
  agreements: Agreement[]
  primaryOnly: ReviewFinding[]
  secondaryOnly: ReviewFinding[]
  disagreements: Disagreement[]
}

const LINE_PROXIMITY_THRESHOLD = 5
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
}

function findMatchingFinding(
  finding: ReviewFinding,
  candidates: ReviewFinding[]
): ReviewFinding | undefined {
  return candidates.find(
    (c) =>
      c.file === finding.file &&
      c.category === finding.category &&
      Math.abs(c.line - finding.line) <= LINE_PROXIMITY_THRESHOLD
  )
}

export function consolidateReviews(
  primary: ReviewFinding[],
  secondary: ReviewFinding[]
): ConsolidatedReview {
  const result: ConsolidatedReview = {
    agreements: [],
    primaryOnly: [],
    secondaryOnly: [],
    disagreements: [],
  }

  const matchedSecondaryIds = new Set<string>()

  for (const pFinding of primary) {
    const match = findMatchingFinding(
      pFinding,
      secondary.filter((s) => !matchedSecondaryIds.has(s.id))
    )

    if (match) {
      matchedSecondaryIds.add(match.id)

      if (pFinding.severity === match.severity) {
        result.agreements.push({
          primary: pFinding,
          secondary: match,
        })
      } else {
        result.disagreements.push({
          primary: pFinding,
          secondary: match,
          reason: 'Severity mismatch',
        })
      }
    } else {
      result.primaryOnly.push(pFinding)
    }
  }

  for (const sFinding of secondary) {
    if (!matchedSecondaryIds.has(sFinding.id)) {
      result.secondaryOnly.push(sFinding)
    }
  }

  return result
}

export function calculateRiskFromReviews(consolidated: ConsolidatedReview): number {
  let risk = 0

  for (const agreement of consolidated.agreements) {
    const severity = agreement.primary.severity
    risk += SEVERITY_WEIGHTS[severity] * 1.5
  }

  for (const finding of consolidated.primaryOnly) {
    risk += SEVERITY_WEIGHTS[finding.severity] * 0.8
  }

  for (const finding of consolidated.secondaryOnly) {
    risk += SEVERITY_WEIGHTS[finding.severity] * 0.8
  }

  for (const disagreement of consolidated.disagreements) {
    const maxSeverity =
      SEVERITY_WEIGHTS[disagreement.primary.severity] >
      SEVERITY_WEIGHTS[disagreement.secondary.severity]
        ? disagreement.primary.severity
        : disagreement.secondary.severity

    risk += SEVERITY_WEIGHTS[maxSeverity] * 1.2
    risk += 5
  }

  return Math.min(100, Math.round(risk))
}

export function formatReviewReport(consolidated: ConsolidatedReview, riskScore: number): string {
  const lines: string[] = []

  lines.push('## AI-on-AI Review')
  lines.push('')
  lines.push(`**Risk Score: ${riskScore}/100**`)
  lines.push('')

  const totalFindings =
    consolidated.agreements.length +
    consolidated.primaryOnly.length +
    consolidated.secondaryOnly.length +
    consolidated.disagreements.length

  if (totalFindings === 0) {
    lines.push('No findings detected by either reviewer.')
    return lines.join('\n')
  }

  if (consolidated.agreements.length > 0) {
    lines.push(`### Agreements (${consolidated.agreements.length} findings)`)
    lines.push('')
    for (const agreement of consolidated.agreements) {
      lines.push(
        '- **[' +
          agreement.primary.severity.toUpperCase() +
          ']** ' +
          agreement.primary.message +
          ' (`' +
          agreement.primary.file +
          ':' +
          agreement.primary.line +
          '`)'
      )
    }
    lines.push('')
  }

  if (consolidated.primaryOnly.length > 0) {
    lines.push(`### Primary-only (${consolidated.primaryOnly.length} findings)`)
    lines.push('')
    for (const finding of consolidated.primaryOnly) {
      lines.push(
        '- **[' +
          finding.severity.toUpperCase() +
          ']** ' +
          finding.message +
          ' (`' +
          finding.file +
          ':' +
          finding.line +
          '`)'
      )
    }
    lines.push('')
  }

  if (consolidated.secondaryOnly.length > 0) {
    lines.push(`### Secondary-only (${consolidated.secondaryOnly.length} findings)`)
    lines.push('')
    for (const finding of consolidated.secondaryOnly) {
      lines.push(
        `- **[${finding.severity.toUpperCase()}]** ${finding.message} (\`${finding.file}:${finding.line}\`)`
      )
    }
    lines.push('')
  }

  if (consolidated.disagreements.length > 0) {
    lines.push(`### Disagreements (${consolidated.disagreements.length} items)`)
    lines.push('')
    for (const disagreement of consolidated.disagreements) {
      lines.push(
        `- \`${disagreement.primary.file}:${disagreement.primary.line}\`: ${disagreement.reason}`
      )
      lines.push(
        `  - Primary: **${disagreement.primary.severity.toUpperCase()}** - ${disagreement.primary.message}`
      )
      lines.push(
        `  - Secondary: **${disagreement.secondary.severity.toUpperCase()}** - ${disagreement.secondary.message}`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}
