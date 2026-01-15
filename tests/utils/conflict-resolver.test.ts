import type {
  BranchMergeResult,
  MergeResult,
  MergeStrategy,
} from '../../src/utils/conflict-resolver.js'
import type { AgentResult, ConflictInfo } from '../../src/utils/parallel-executor.js'

describe('conflict-resolver', () => {
  const DEFAULT_MERGE_STRATEGY: MergeStrategy = {
    autoMerge: true,
    preserveCommits: false,
    squashOnConflict: true,
    targetBranch: 'main',
  }

  describe('MergeStrategy interface', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_MERGE_STRATEGY.autoMerge).toBe(true)
      expect(DEFAULT_MERGE_STRATEGY.preserveCommits).toBe(false)
      expect(DEFAULT_MERGE_STRATEGY.squashOnConflict).toBe(true)
      expect(DEFAULT_MERGE_STRATEGY.targetBranch).toBe('main')
    })

    it('should allow custom strategy', () => {
      const strategy: MergeStrategy = {
        autoMerge: false,
        preserveCommits: true,
        squashOnConflict: false,
        targetBranch: 'develop',
      }

      expect(strategy.autoMerge).toBe(false)
      expect(strategy.preserveCommits).toBe(true)
      expect(strategy.targetBranch).toBe('develop')
    })

    it('should allow partial override', () => {
      const strategy: MergeStrategy = {
        ...DEFAULT_MERGE_STRATEGY,
        targetBranch: 'release',
      }

      expect(strategy.autoMerge).toBe(true)
      expect(strategy.targetBranch).toBe('release')
    })
  })

  describe('BranchMergeResult interface', () => {
    it('should represent successful merge', () => {
      const result: BranchMergeResult = {
        branch: 'feature/auth',
        success: true,
        autoResolved: false,
      }

      expect(result.success).toBe(true)
      expect(result.autoResolved).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it('should represent auto-resolved merge', () => {
      const result: BranchMergeResult = {
        branch: 'feature/api',
        success: true,
        autoResolved: true,
      }

      expect(result.autoResolved).toBe(true)
    })

    it('should represent failed merge', () => {
      const result: BranchMergeResult = {
        branch: 'feature/broken',
        success: false,
        autoResolved: false,
        error: 'Merge conflict in src/index.ts',
      }

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('MergeResult interface', () => {
    it('should represent successful merge operation', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [
          { branch: 'a', success: true, autoResolved: false },
          { branch: 'b', success: true, autoResolved: false },
        ],
        finalCommit: 'abc123',
      }

      expect(result.success).toBe(true)
      expect(result.mergeResults).toHaveLength(2)
      expect(result.finalCommit).toBe('abc123')
    })

    it('should represent failed merge operation', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          { branch: 'a', success: true, autoResolved: false },
          { branch: 'b', success: false, autoResolved: false, error: 'conflict' },
        ],
      }

      expect(result.success).toBe(false)
      expect(result.finalCommit).toBeUndefined()
    })
  })

  describe('Conflict detection logic', () => {
    function detectFileConflicts(results: AgentResult[]): Map<string, AgentResult[]> {
      const fileAgentMap = new Map<string, AgentResult[]>()

      for (const result of results) {
        if (!result.success) {
          continue
        }

        for (const file of result.changedFiles) {
          const agents = fileAgentMap.get(file) || []
          agents.push(result)
          fileAgentMap.set(file, agents)
        }
      }

      const conflicts = new Map<string, AgentResult[]>()
      for (const [file, agents] of fileAgentMap) {
        if (agents.length > 1) {
          conflicts.set(file, agents)
        }
      }

      return conflicts
    }

    it('should detect no conflicts when no file overlaps', () => {
      const results: AgentResult[] = [
        {
          agent: 'a',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['file1.ts'],
          duration: 0,
        },
        {
          agent: 'b',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['file2.ts'],
          duration: 0,
        },
      ]

      const conflicts = detectFileConflicts(results)
      expect(conflicts.size).toBe(0)
    })

    it('should detect conflict when files overlap', () => {
      const results: AgentResult[] = [
        {
          agent: 'analyzer',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['shared.ts'],
          duration: 0,
        },
        {
          agent: 'implementer',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['shared.ts'],
          duration: 0,
        },
      ]

      const conflicts = detectFileConflicts(results)
      expect(conflicts.size).toBe(1)
      expect(conflicts.has('shared.ts')).toBe(true)
      expect(conflicts.get('shared.ts')).toHaveLength(2)
    })

    it('should ignore failed agent results', () => {
      const results: AgentResult[] = [
        {
          agent: 'a',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['shared.ts'],
          duration: 0,
        },
        {
          agent: 'b',
          success: false,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['shared.ts'],
          duration: 0,
        },
      ]

      const conflicts = detectFileConflicts(results)
      expect(conflicts.size).toBe(0)
    })
  })

  describe('Conflict classification logic', () => {
    function classifyConflicts(conflicts: Map<string, AgentResult[]>): ConflictInfo[] {
      const result: ConflictInfo[] = []

      for (const [file, agents] of conflicts) {
        const agentNames = agents.map((a) => a.agent)
        const ext = file.split('.').pop()?.toLowerCase() || ''

        const configFiles = ['json', 'yaml', 'yml', 'toml', 'env']
        const isConfig = configFiles.includes(ext)

        let type: ConflictInfo['type'] = 'auto-resolvable'

        if (agents.length > 2) {
          type = 'manual-required'
        } else if (isConfig) {
          type = 'manual-required'
        }

        result.push({ file, agents: agentNames, type })
      }

      return result
    }

    it('should classify 2-agent conflict as auto-resolvable', () => {
      const conflicts = new Map<string, AgentResult[]>()
      conflicts.set('test.ts', [
        { agent: 'a', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
        { agent: 'b', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
      ])

      const classified = classifyConflicts(conflicts)
      expect(classified[0].type).toBe('auto-resolvable')
    })

    it('should classify 3+ agent conflict as manual-required', () => {
      const conflicts = new Map<string, AgentResult[]>()
      conflicts.set('test.ts', [
        { agent: 'a', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
        { agent: 'b', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
        { agent: 'c', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
      ])

      const classified = classifyConflicts(conflicts)
      expect(classified[0].type).toBe('manual-required')
    })

    it('should classify config file conflict as manual-required', () => {
      const conflicts = new Map<string, AgentResult[]>()
      conflicts.set('package.json', [
        { agent: 'a', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
        { agent: 'b', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
      ])

      const classified = classifyConflicts(conflicts)
      expect(classified[0].type).toBe('manual-required')
    })

    it('should classify yaml file conflict as manual-required', () => {
      const conflicts = new Map<string, AgentResult[]>()
      conflicts.set('config.yaml', [
        { agent: 'a', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
        { agent: 'b', success: true, branch: '', worktreePath: '', changedFiles: [], duration: 0 },
      ])

      const classified = classifyConflicts(conflicts)
      expect(classified[0].type).toBe('manual-required')
    })
  })

  describe('Merge result formatting', () => {
    function formatMergeResult(result: MergeResult): string {
      const lines: string[] = []

      lines.push('📦 Merge Summary')
      lines.push(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
      if (result.finalCommit) {
        lines.push(`   Final Commit: ${result.finalCommit.slice(0, 8)}`)
      }
      lines.push('')

      lines.push('Branch Merges:')
      for (const merge of result.mergeResults) {
        const icon = merge.success ? '✅' : '❌'
        const resolved = merge.autoResolved ? ' (auto-resolved)' : ''
        lines.push(`   ${icon} ${merge.branch}${resolved}`)
        if (merge.error) {
          lines.push(`      Error: ${merge.error}`)
        }
      }

      return lines.join('\n')
    }

    it('should format successful result', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [{ branch: 'feature/test', success: true, autoResolved: false }],
        finalCommit: 'abc123def456',
      }

      const formatted = formatMergeResult(result)
      expect(formatted).toContain('✅ Success')
      expect(formatted).toContain('abc123de')
      expect(formatted).toContain('feature/test')
    })

    it('should format failed result with error', () => {
      const result: MergeResult = {
        success: false,
        mergeResults: [
          { branch: 'feature/broken', success: false, autoResolved: false, error: 'Conflict' },
        ],
      }

      const formatted = formatMergeResult(result)
      expect(formatted).toContain('❌ Failed')
      expect(formatted).toContain('Error: Conflict')
    })

    it('should show auto-resolved indicator', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [{ branch: 'feature/auto', success: true, autoResolved: true }],
      }

      const formatted = formatMergeResult(result)
      expect(formatted).toContain('(auto-resolved)')
    })
  })

  describe('Conflict report generation', () => {
    function generateConflictReport(conflicts: ConflictInfo[], _results: AgentResult[]): string {
      const lines: string[] = []

      lines.push('# Conflict Report')
      lines.push('')
      lines.push(`Total Conflicts: ${conflicts.length}`)
      lines.push('')

      const manual = conflicts.filter((c) => c.type === 'manual-required')
      const auto = conflicts.filter((c) => c.type === 'auto-resolvable')

      lines.push('## Summary')
      lines.push(`- Manual Resolution Required: ${manual.length}`)
      lines.push(`- Auto-Resolvable: ${auto.length}`)
      lines.push('')

      if (manual.length > 0) {
        lines.push('## Manual Resolution Required')
        lines.push('')
        for (const conflict of manual) {
          lines.push(`### ${conflict.file}`)
          lines.push(`Agents: ${conflict.agents.join(', ')}`)
          lines.push('')
        }
      }

      return lines.join('\n')
    }

    it('should generate report with summary', () => {
      const conflicts: ConflictInfo[] = [
        { file: 'a.ts', agents: ['x', 'y'], type: 'auto-resolvable' },
        { file: 'b.json', agents: ['x', 'y'], type: 'manual-required' },
      ]
      const results: AgentResult[] = []

      const report = generateConflictReport(conflicts, results)

      expect(report).toContain('# Conflict Report')
      expect(report).toContain('Total Conflicts: 2')
      expect(report).toContain('Manual Resolution Required: 1')
      expect(report).toContain('Auto-Resolvable: 1')
    })

    it('should list manual conflicts', () => {
      const conflicts: ConflictInfo[] = [
        { file: 'config.json', agents: ['a', 'b'], type: 'manual-required' },
      ]

      const report = generateConflictReport(conflicts, [])

      expect(report).toContain('### config.json')
      expect(report).toContain('Agents: a, b')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty conflicts list', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [],
      }

      expect(result.mergeResults).toHaveLength(0)
      expect(result.success).toBe(true)
    })

    it('should handle merge with no final commit', () => {
      const result: MergeResult = {
        success: true,
        mergeResults: [{ branch: 'a', success: true, autoResolved: false }],
      }

      expect(result.finalCommit).toBeUndefined()
    })

    it('should handle very long branch names', () => {
      const result: BranchMergeResult = {
        branch: 'feature/very-long-branch-name-that-exceeds-normal-length-for-testing',
        success: true,
        autoResolved: false,
      }

      expect(result.branch.length).toBeGreaterThan(50)
    })

    it('should handle special characters in error messages', () => {
      const result: BranchMergeResult = {
        branch: 'feature/test',
        success: false,
        autoResolved: false,
        error: 'CONFLICT in "src/file.ts": line 42 contains <invalid> characters',
      }

      expect(result.error).toContain('<invalid>')
    })
  })
})
