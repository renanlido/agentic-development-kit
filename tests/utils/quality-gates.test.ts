import {
  calculateOverallRiskScore,
  trackTechnicalDebt,
  calculateConfidenceScore,
  evaluateQualityGate,
  formatQualityReport,
  type DebtItem,
  type ConfidenceFactors,
  type QualityGateResult,
} from '../../src/utils/quality-gates'

describe('Quality Gates', () => {
  describe('calculateOverallRiskScore', () => {
    it('should return 0 for empty factors', () => {
      const score = calculateOverallRiskScore({
        codeComplexity: 0,
        testCoverage: 100,
        securityIssues: 0,
        aiReviewRisk: 0,
        debtRatio: 0,
      })

      expect(score).toBe(0)
    })

    it('should increase risk for low test coverage', () => {
      const lowCoverage = calculateOverallRiskScore({
        codeComplexity: 0,
        testCoverage: 40,
        securityIssues: 0,
        aiReviewRisk: 0,
        debtRatio: 0,
      })

      const highCoverage = calculateOverallRiskScore({
        codeComplexity: 0,
        testCoverage: 90,
        securityIssues: 0,
        aiReviewRisk: 0,
        debtRatio: 0,
      })

      expect(lowCoverage).toBeGreaterThan(highCoverage)
    })

    it('should heavily weight security issues', () => {
      const score = calculateOverallRiskScore({
        codeComplexity: 0,
        testCoverage: 100,
        securityIssues: 3,
        aiReviewRisk: 0,
        debtRatio: 0,
      })

      expect(score).toBeGreaterThan(10)
    })

    it('should cap at 100', () => {
      const score = calculateOverallRiskScore({
        codeComplexity: 100,
        testCoverage: 0,
        securityIssues: 10,
        aiReviewRisk: 100,
        debtRatio: 100,
      })

      expect(score).toBe(100)
    })

    it('should factor in AI review risk', () => {
      const lowAIRisk = calculateOverallRiskScore({
        codeComplexity: 20,
        testCoverage: 80,
        securityIssues: 0,
        aiReviewRisk: 10,
        debtRatio: 0,
      })

      const highAIRisk = calculateOverallRiskScore({
        codeComplexity: 20,
        testCoverage: 80,
        securityIssues: 0,
        aiReviewRisk: 80,
        debtRatio: 0,
      })

      expect(highAIRisk).toBeGreaterThan(lowAIRisk)
    })
  })

  describe('trackTechnicalDebt', () => {
    it('should create debt item with timestamp', () => {
      const debt = trackTechnicalDebt({
        type: 'shortcut',
        description: 'Hardcoded config value',
        file: 'config.ts',
        line: 42,
        severity: 'medium',
      })

      expect(debt.id).toBeDefined()
      expect(debt.createdAt).toBeDefined()
      expect(debt.type).toBe('shortcut')
    })

    it('should calculate debt ratio', () => {
      const debts: DebtItem[] = [
        trackTechnicalDebt({
          type: 'shortcut',
          description: 'A',
          file: 'a.ts',
          line: 1,
          severity: 'low',
        }),
        trackTechnicalDebt({
          type: 'hack',
          description: 'B',
          file: 'b.ts',
          line: 1,
          severity: 'high',
        }),
        trackTechnicalDebt({
          type: 'todo',
          description: 'C',
          file: 'c.ts',
          line: 1,
          severity: 'medium',
        }),
      ]

      const totalLines = 1000

      const ratio =
        (debts.reduce((sum, d) => {
          const weight = d.severity === 'high' ? 3 : d.severity === 'medium' ? 2 : 1
          return sum + weight
        }, 0) /
          totalLines) *
        100

      expect(ratio).toBeGreaterThan(0)
    })

    it('should categorize debt types', () => {
      const shortcut = trackTechnicalDebt({
        type: 'shortcut',
        description: 'A',
        file: 'a.ts',
        line: 1,
        severity: 'low',
      })
      const hack = trackTechnicalDebt({
        type: 'hack',
        description: 'B',
        file: 'b.ts',
        line: 1,
        severity: 'low',
      })
      const todo = trackTechnicalDebt({
        type: 'todo',
        description: 'C',
        file: 'c.ts',
        line: 1,
        severity: 'low',
      })
      const workaround = trackTechnicalDebt({
        type: 'workaround',
        description: 'D',
        file: 'd.ts',
        line: 1,
        severity: 'low',
      })

      expect(shortcut.type).toBe('shortcut')
      expect(hack.type).toBe('hack')
      expect(todo.type).toBe('todo')
      expect(workaround.type).toBe('workaround')
    })
  })

  describe('calculateConfidenceScore', () => {
    it('should return high confidence for good factors', () => {
      const factors: ConfidenceFactors = {
        testCoverage: 90,
        reviewAgreement: 100,
        codeComplexity: 10,
        documentationScore: 80,
      }

      const score = calculateConfidenceScore(factors)

      expect(score).toBeGreaterThanOrEqual(80)
    })

    it('should return low confidence for poor factors', () => {
      const factors: ConfidenceFactors = {
        testCoverage: 30,
        reviewAgreement: 40,
        codeComplexity: 80,
        documentationScore: 20,
      }

      const score = calculateConfidenceScore(factors)

      expect(score).toBeLessThan(50)
    })

    it('should weight review agreement highly', () => {
      const lowAgreement: ConfidenceFactors = {
        testCoverage: 80,
        reviewAgreement: 30,
        codeComplexity: 20,
        documentationScore: 70,
      }

      const highAgreement: ConfidenceFactors = {
        testCoverage: 80,
        reviewAgreement: 95,
        codeComplexity: 20,
        documentationScore: 70,
      }

      expect(calculateConfidenceScore(highAgreement)).toBeGreaterThan(
        calculateConfidenceScore(lowAgreement)
      )
    })

    it('should cap at 100', () => {
      const perfectFactors: ConfidenceFactors = {
        testCoverage: 100,
        reviewAgreement: 100,
        codeComplexity: 0,
        documentationScore: 100,
      }

      expect(calculateConfidenceScore(perfectFactors)).toBeLessThanOrEqual(100)
    })
  })

  describe('evaluateQualityGate', () => {
    it('should pass when risk is below threshold', () => {
      const result = evaluateQualityGate(30, 70)

      expect(result.passed).toBe(true)
      expect(result.recommendation).toBe('APPROVE')
    })

    it('should fail when risk exceeds threshold', () => {
      const result = evaluateQualityGate(85, 70)

      expect(result.passed).toBe(false)
      expect(result.recommendation).toBe('BLOCK')
    })

    it('should warn when risk is near threshold', () => {
      const result = evaluateQualityGate(65, 70)

      expect(result.passed).toBe(true)
      expect(result.recommendation).toBe('REVIEW')
    })

    it('should use custom threshold', () => {
      const strictResult = evaluateQualityGate(40, 30)
      const lenientResult = evaluateQualityGate(40, 50)

      expect(strictResult.passed).toBe(false)
      expect(lenientResult.passed).toBe(true)
    })

    it('should include breakdown in result', () => {
      const result = evaluateQualityGate(50, 70)

      expect(result.riskScore).toBe(50)
      expect(result.threshold).toBe(70)
    })
  })

  describe('formatQualityReport', () => {
    it('should format passing gate', () => {
      const result: QualityGateResult = {
        passed: true,
        riskScore: 30,
        threshold: 70,
        recommendation: 'APPROVE',
        factors: {
          codeComplexity: 20,
          testCoverage: 85,
          securityIssues: 0,
          aiReviewRisk: 25,
          debtRatio: 5,
        },
      }

      const report = formatQualityReport(result)

      expect(report).toContain('PASSED')
      expect(report).toContain('30/70')
      expect(report).toContain('APPROVE')
    })

    it('should format failing gate', () => {
      const result: QualityGateResult = {
        passed: false,
        riskScore: 85,
        threshold: 70,
        recommendation: 'BLOCK',
        factors: {
          codeComplexity: 60,
          testCoverage: 45,
          securityIssues: 3,
          aiReviewRisk: 70,
          debtRatio: 15,
        },
      }

      const report = formatQualityReport(result)

      expect(report).toContain('FAILED')
      expect(report).toContain('85/70')
      expect(report).toContain('BLOCK')
    })

    it('should include factor breakdown', () => {
      const result: QualityGateResult = {
        passed: true,
        riskScore: 40,
        threshold: 70,
        recommendation: 'APPROVE',
        factors: {
          codeComplexity: 30,
          testCoverage: 75,
          securityIssues: 1,
          aiReviewRisk: 35,
          debtRatio: 8,
        },
      }

      const report = formatQualityReport(result)

      expect(report).toContain('Code Complexity')
      expect(report).toContain('Test Coverage')
      expect(report).toContain('Security Issues')
    })
  })
})
