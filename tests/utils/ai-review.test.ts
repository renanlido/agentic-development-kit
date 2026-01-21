import {
  consolidateReviews,
  calculateRiskFromReviews,
  formatReviewReport,
  type ReviewFinding,
  type ConsolidatedReview,
} from '../../src/utils/ai-review'

describe('AI-on-AI Review', () => {
  describe('consolidateReviews', () => {
    it('should identify agreements between reviews', () => {
      const primary: ReviewFinding[] = [
        {
          id: '1',
          category: 'security',
          severity: 'high',
          message: 'SQL injection risk',
          file: 'user.ts',
          line: 42,
        },
        {
          id: '2',
          category: 'quality',
          severity: 'medium',
          message: 'Missing error handling',
          file: 'api.ts',
          line: 100,
        },
      ]
      const secondary: ReviewFinding[] = [
        {
          id: '3',
          category: 'security',
          severity: 'high',
          message: 'SQL injection vulnerability',
          file: 'user.ts',
          line: 42,
        },
      ]

      const result = consolidateReviews(primary, secondary)

      expect(result.agreements.length).toBe(1)
      expect(result.agreements[0].primary.id).toBe('1')
      expect(result.agreements[0].secondary.id).toBe('3')
    })

    it('should identify primary-only findings', () => {
      const primary: ReviewFinding[] = [
        {
          id: '1',
          category: 'quality',
          severity: 'low',
          message: 'Consider refactoring',
          file: 'utils.ts',
          line: 10,
        },
      ]
      const secondary: ReviewFinding[] = []

      const result = consolidateReviews(primary, secondary)

      expect(result.primaryOnly.length).toBe(1)
      expect(result.primaryOnly[0].id).toBe('1')
    })

    it('should identify secondary-only findings', () => {
      const primary: ReviewFinding[] = []
      const secondary: ReviewFinding[] = [
        {
          id: '1',
          category: 'performance',
          severity: 'medium',
          message: 'N+1 query issue',
          file: 'db.ts',
          line: 55,
        },
      ]

      const result = consolidateReviews(primary, secondary)

      expect(result.secondaryOnly.length).toBe(1)
      expect(result.secondaryOnly[0].id).toBe('1')
    })

    it('should identify disagreements (different severity)', () => {
      const primary: ReviewFinding[] = [
        {
          id: '1',
          category: 'security',
          severity: 'low',
          message: 'Minor issue',
          file: 'auth.ts',
          line: 20,
        },
      ]
      const secondary: ReviewFinding[] = [
        {
          id: '2',
          category: 'security',
          severity: 'critical',
          message: 'Critical security flaw',
          file: 'auth.ts',
          line: 20,
        },
      ]

      const result = consolidateReviews(primary, secondary)

      expect(result.disagreements.length).toBe(1)
      expect(result.disagreements[0].primary.severity).toBe('low')
      expect(result.disagreements[0].secondary.severity).toBe('critical')
    })

    it('should handle empty reviews', () => {
      const result = consolidateReviews([], [])

      expect(result.agreements).toEqual([])
      expect(result.primaryOnly).toEqual([])
      expect(result.secondaryOnly).toEqual([])
      expect(result.disagreements).toEqual([])
    })

    it('should match findings by file and line proximity', () => {
      const primary: ReviewFinding[] = [
        {
          id: '1',
          category: 'quality',
          severity: 'medium',
          message: 'Issue A',
          file: 'test.ts',
          line: 50,
        },
      ]
      const secondary: ReviewFinding[] = [
        {
          id: '2',
          category: 'quality',
          severity: 'medium',
          message: 'Issue B',
          file: 'test.ts',
          line: 52,
        },
      ]

      const result = consolidateReviews(primary, secondary)

      expect(result.agreements.length).toBe(1)
    })

    it('should not match findings from different files', () => {
      const primary: ReviewFinding[] = [
        {
          id: '1',
          category: 'quality',
          severity: 'medium',
          message: 'Issue A',
          file: 'a.ts',
          line: 50,
        },
      ]
      const secondary: ReviewFinding[] = [
        {
          id: '2',
          category: 'quality',
          severity: 'medium',
          message: 'Issue B',
          file: 'b.ts',
          line: 50,
        },
      ]

      const result = consolidateReviews(primary, secondary)

      expect(result.agreements.length).toBe(0)
      expect(result.primaryOnly.length).toBe(1)
      expect(result.secondaryOnly.length).toBe(1)
    })
  })

  describe('calculateRiskFromReviews', () => {
    it('should return 0 for no findings', () => {
      const consolidated: ConsolidatedReview = {
        agreements: [],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [],
      }

      const risk = calculateRiskFromReviews(consolidated)

      expect(risk).toBe(0)
    })

    it('should increase risk for critical findings', () => {
      const consolidated: ConsolidatedReview = {
        agreements: [
          {
            primary: {
              id: '1',
              category: 'security',
              severity: 'critical',
              message: 'Critical',
              file: 'a.ts',
              line: 1,
            },
            secondary: {
              id: '2',
              category: 'security',
              severity: 'critical',
              message: 'Critical',
              file: 'a.ts',
              line: 1,
            },
          },
        ],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [],
      }

      const risk = calculateRiskFromReviews(consolidated)

      expect(risk).toBeGreaterThan(30)
    })

    it('should increase risk for disagreements', () => {
      const consolidated: ConsolidatedReview = {
        agreements: [],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [
          {
            primary: {
              id: '1',
              category: 'security',
              severity: 'low',
              message: 'Low',
              file: 'a.ts',
              line: 1,
            },
            secondary: {
              id: '2',
              category: 'security',
              severity: 'critical',
              message: 'Critical',
              file: 'a.ts',
              line: 1,
            },
            reason: 'Severity mismatch',
          },
        ],
      }

      const risk = calculateRiskFromReviews(consolidated)

      expect(risk).toBeGreaterThan(0)
    })

    it('should cap risk at 100', () => {
      const manyFindings: ReviewFinding[] = Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        category: 'security',
        severity: 'critical' as const,
        message: 'Critical issue',
        file: 'a.ts',
        line: i,
      }))

      const consolidated: ConsolidatedReview = {
        agreements: manyFindings.map((f) => ({ primary: f, secondary: { ...f, id: `s${f.id}` } })),
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [],
      }

      const risk = calculateRiskFromReviews(consolidated)

      expect(risk).toBeLessThanOrEqual(100)
    })

    it('should weight findings by severity', () => {
      const lowSeverity: ConsolidatedReview = {
        agreements: [
          {
            primary: {
              id: '1',
              category: 'quality',
              severity: 'low',
              message: 'Low',
              file: 'a.ts',
              line: 1,
            },
            secondary: {
              id: '2',
              category: 'quality',
              severity: 'low',
              message: 'Low',
              file: 'a.ts',
              line: 1,
            },
          },
        ],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [],
      }

      const highSeverity: ConsolidatedReview = {
        agreements: [
          {
            primary: {
              id: '1',
              category: 'security',
              severity: 'high',
              message: 'High',
              file: 'a.ts',
              line: 1,
            },
            secondary: {
              id: '2',
              category: 'security',
              severity: 'high',
              message: 'High',
              file: 'a.ts',
              line: 1,
            },
          },
        ],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [],
      }

      const lowRisk = calculateRiskFromReviews(lowSeverity)
      const highRisk = calculateRiskFromReviews(highSeverity)

      expect(highRisk).toBeGreaterThan(lowRisk)
    })
  })

  describe('formatReviewReport', () => {
    it('should format consolidated review as markdown', () => {
      const consolidated: ConsolidatedReview = {
        agreements: [
          {
            primary: {
              id: '1',
              category: 'security',
              severity: 'high',
              message: 'SQL injection',
              file: 'user.ts',
              line: 42,
            },
            secondary: {
              id: '2',
              category: 'security',
              severity: 'high',
              message: 'SQL injection risk',
              file: 'user.ts',
              line: 42,
            },
          },
        ],
        primaryOnly: [
          {
            id: '3',
            category: 'quality',
            severity: 'low',
            message: 'Consider refactoring',
            file: 'utils.ts',
            line: 10,
          },
        ],
        secondaryOnly: [],
        disagreements: [],
      }

      const report = formatReviewReport(consolidated, 45)

      expect(report).toContain('## AI-on-AI Review')
      expect(report).toContain('Agreements')
      expect(report).toContain('SQL injection')
      expect(report).toContain('Risk Score: 45')
    })

    it('should include disagreements section when present', () => {
      const consolidated: ConsolidatedReview = {
        agreements: [],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [
          {
            primary: {
              id: '1',
              category: 'security',
              severity: 'low',
              message: 'Minor',
              file: 'a.ts',
              line: 1,
            },
            secondary: {
              id: '2',
              category: 'security',
              severity: 'critical',
              message: 'Critical',
              file: 'a.ts',
              line: 1,
            },
            reason: 'Severity mismatch',
          },
        ],
      }

      const report = formatReviewReport(consolidated, 30)

      expect(report).toContain('Disagreements')
      expect(report).toContain('Severity mismatch')
    })

    it('should handle empty consolidated review', () => {
      const consolidated: ConsolidatedReview = {
        agreements: [],
        primaryOnly: [],
        secondaryOnly: [],
        disagreements: [],
      }

      const report = formatReviewReport(consolidated, 0)

      expect(report).toContain('## AI-on-AI Review')
      expect(report).toContain('Risk Score: 0')
      expect(report).toContain('No findings')
    })
  })
})
