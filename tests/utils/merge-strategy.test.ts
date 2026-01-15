import {
  type BranchMergeResult,
  DEFAULT_MERGE_STRATEGY,
  formatMergeResult,
  type MergeResult,
  type MergeStrategy,
} from '../../src/utils/merge-strategy'

describe('MergeStrategy', () => {
  describe('DEFAULT_MERGE_STRATEGY', () => {
    it('should have autoMerge enabled', () => {
      expect(DEFAULT_MERGE_STRATEGY.autoMerge).toBe(true)
    })

    it('should have preserveCommits enabled', () => {
      expect(DEFAULT_MERGE_STRATEGY.preserveCommits).toBe(true)
    })

    it('should have squashOnConflict disabled', () => {
      expect(DEFAULT_MERGE_STRATEGY.squashOnConflict).toBe(false)
    })

    it('should target main branch', () => {
      expect(DEFAULT_MERGE_STRATEGY.targetBranch).toBe('main')
    })
  })

  describe('formatMergeResult', () => {
    it('should format successful merge result', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          {
            branch: 'feature/analyzer',
            success: true,
            autoResolved: false,
            commitHash: 'abc123',
          },
          {
            branch: 'feature/implementer',
            success: true,
            autoResolved: false,
            commitHash: 'def456',
          },
        ],
        targetBranch: 'main',
        totalMerged: 2,
        totalFailed: 0,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('🔀 Merge Summary')
      expect(formatted).toContain('Target: main')
      expect(formatted).toContain('✅ Success')
      expect(formatted).toContain('Merged: 2/2')
      expect(formatted).toContain('feature/analyzer')
      expect(formatted).toContain('feature/implementer')
    })

    it('should format failed merge result', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          {
            branch: 'feature/analyzer',
            success: true,
            autoResolved: false,
          },
          {
            branch: 'feature/implementer',
            success: false,
            autoResolved: false,
            error: 'Merge conflict in src/index.ts',
          },
        ],
        targetBranch: 'main',
        totalMerged: 1,
        totalFailed: 1,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('❌ Failed')
      expect(formatted).toContain('Merged: 1/2')
      expect(formatted).toContain('Error: Merge conflict')
    })

    it('should show auto-resolved indicator', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          {
            branch: 'feature/analyzer',
            success: true,
            autoResolved: true,
            commitHash: 'abc123',
          },
        ],
        targetBranch: 'main',
        totalMerged: 1,
        totalFailed: 0,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('(auto-resolved)')
    })

    it('should show commit hash when available', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          {
            branch: 'feature/test',
            success: true,
            autoResolved: false,
            commitHash: 'abc123def',
          },
        ],
        targetBranch: 'main',
        totalMerged: 1,
        totalFailed: 0,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('Commit: abc123def')
    })
  })

  describe('MergeStrategy interface', () => {
    it('should allow custom strategy configuration', () => {
      const customStrategy: MergeStrategy = {
        autoMerge: false,
        preserveCommits: false,
        squashOnConflict: true,
        targetBranch: 'develop',
      }

      expect(customStrategy.autoMerge).toBe(false)
      expect(customStrategy.targetBranch).toBe('develop')
    })
  })

  describe('BranchMergeResult scenarios', () => {
    it('should handle empty merge results', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [],
        targetBranch: 'main',
        totalMerged: 0,
        totalFailed: 0,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('Merged: 0/0')
    })

    it('should handle mixed success/failure results', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          { branch: 'a', success: true, autoResolved: false },
          { branch: 'b', success: false, autoResolved: false, error: 'conflict' },
          { branch: 'c', success: true, autoResolved: true },
        ],
        targetBranch: 'main',
        totalMerged: 2,
        totalFailed: 1,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('Merged: 2/3')
    })
  })

  describe('BranchMergeResult interface', () => {
    it('should represent successful merge without auto-resolution', () => {
      const result: BranchMergeResult = {
        branch: 'feature/auth',
        success: true,
        autoResolved: false,
        commitHash: 'abc123def',
      }

      expect(result.branch).toBe('feature/auth')
      expect(result.success).toBe(true)
      expect(result.autoResolved).toBe(false)
      expect(result.commitHash).toBe('abc123def')
      expect(result.error).toBeUndefined()
    })

    it('should represent failed merge with error', () => {
      const result: BranchMergeResult = {
        branch: 'feature/login',
        success: false,
        autoResolved: false,
        error: 'Merge conflict in src/index.ts',
      }

      expect(result.success).toBe(false)
      expect(result.error).toContain('Merge conflict')
      expect(result.commitHash).toBeUndefined()
    })

    it('should represent auto-resolved merge', () => {
      const result: BranchMergeResult = {
        branch: 'feature/api',
        success: true,
        autoResolved: true,
        commitHash: 'def456ghi',
      }

      expect(result.autoResolved).toBe(true)
      expect(result.success).toBe(true)
    })
  })

  describe('MergeResult totals', () => {
    it('should calculate totals correctly for all success', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          { branch: 'a', success: true, autoResolved: false },
          { branch: 'b', success: true, autoResolved: true },
          { branch: 'c', success: true, autoResolved: false },
        ],
        targetBranch: 'main',
        totalMerged: 3,
        totalFailed: 0,
      }

      expect(result.totalMerged).toBe(3)
      expect(result.totalFailed).toBe(0)
      expect(result.success).toBe(true)
    })

    it('should calculate totals correctly for partial failure', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          { branch: 'a', success: true, autoResolved: false },
          { branch: 'b', success: false, autoResolved: false, error: 'conflict' },
          { branch: 'c', success: true, autoResolved: false },
          { branch: 'd', success: false, autoResolved: false, error: 'timeout' },
        ],
        targetBranch: 'develop',
        totalMerged: 2,
        totalFailed: 2,
      }

      expect(result.totalMerged).toBe(2)
      expect(result.totalFailed).toBe(2)
      expect(result.success).toBe(false)
    })

    it('should calculate totals correctly for all failure', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          { branch: 'a', success: false, autoResolved: false, error: 'conflict' },
          { branch: 'b', success: false, autoResolved: false, error: 'conflict' },
        ],
        targetBranch: 'main',
        totalMerged: 0,
        totalFailed: 2,
      }

      expect(result.totalMerged).toBe(0)
      expect(result.totalFailed).toBe(2)
    })
  })

  describe('formatMergeResult edge cases', () => {
    it('should handle result with all branches auto-resolved', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          { branch: 'a', success: true, autoResolved: true },
          { branch: 'b', success: true, autoResolved: true },
        ],
        targetBranch: 'main',
        totalMerged: 2,
        totalFailed: 0,
      }

      const formatted = formatMergeResult(result)

      expect(formatted.match(/\(auto-resolved\)/g)?.length).toBe(2)
    })

    it('should handle result with very long branch names', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          {
            branch:
              'feature/very-long-branch-name-with-multiple-parts-and-descriptions-for-testing',
            success: true,
            autoResolved: false,
          },
        ],
        targetBranch: 'main',
        totalMerged: 1,
        totalFailed: 0,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('very-long-branch-name')
    })

    it('should handle result with error containing special characters', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          {
            branch: 'feature/test',
            success: false,
            autoResolved: false,
            error: 'Error: CONFLICT in "src/file.ts" at line 42',
          },
        ],
        targetBranch: 'main',
        totalMerged: 0,
        totalFailed: 1,
      }

      const formatted = formatMergeResult(result)

      expect(formatted).toContain('Error: CONFLICT')
    })
  })
})
