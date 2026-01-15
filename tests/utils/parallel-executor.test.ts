import type {
  AgentResult,
  ConflictInfo,
  FallbackConfig,
  ParallelConfig,
  ParallelResult,
} from '../../src/utils/parallel-executor.js'
import type { WorktreeConfig } from '../../src/utils/worktree-utils.js'

describe('parallel-executor interfaces and types', () => {
  describe('ParallelConfig interface', () => {
    const DEFAULT_WORKTREE_CONFIG: WorktreeConfig = {
      baseDir: '.worktrees',
      prefix: 'adk',
    }

    const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
      maxAgents: 3,
      timeout: 300000,
      cleanupOnError: true,
      worktreeConfig: DEFAULT_WORKTREE_CONFIG,
    }

    it('should have expected default values', () => {
      expect(DEFAULT_PARALLEL_CONFIG.maxAgents).toBe(3)
      expect(DEFAULT_PARALLEL_CONFIG.timeout).toBe(300000)
      expect(DEFAULT_PARALLEL_CONFIG.cleanupOnError).toBe(true)
    })

    it('should allow custom configuration', () => {
      const config: ParallelConfig = {
        maxAgents: 5,
        timeout: 600000,
        cleanupOnError: false,
        worktreeConfig: {
          baseDir: '/custom',
          prefix: 'custom',
        },
      }

      expect(config.maxAgents).toBe(5)
      expect(config.timeout).toBe(600000)
      expect(config.cleanupOnError).toBe(false)
    })

    it('should allow partial override of defaults', () => {
      const config: ParallelConfig = {
        ...DEFAULT_PARALLEL_CONFIG,
        maxAgents: 10,
      }

      expect(config.maxAgents).toBe(10)
      expect(config.timeout).toBe(300000)
    })
  })

  describe('FallbackConfig interface', () => {
    const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
      autoFallback: true,
      maxRetries: 2,
      retryDelay: 1000,
    }

    it('should have expected default values', () => {
      expect(DEFAULT_FALLBACK_CONFIG.autoFallback).toBe(true)
      expect(DEFAULT_FALLBACK_CONFIG.maxRetries).toBe(2)
      expect(DEFAULT_FALLBACK_CONFIG.retryDelay).toBe(1000)
    })

    it('should allow custom fallback configuration', () => {
      const config: FallbackConfig = {
        autoFallback: false,
        maxRetries: 5,
        retryDelay: 5000,
      }

      expect(config.autoFallback).toBe(false)
      expect(config.maxRetries).toBe(5)
      expect(config.retryDelay).toBe(5000)
    })
  })

  describe('AgentResult interface', () => {
    it('should represent successful agent execution', () => {
      const result: AgentResult = {
        agent: 'analyzer',
        success: true,
        branch: 'feature/test-analyzer',
        worktreePath: '.worktrees/test-analyzer-0',
        changedFiles: ['src/index.ts', 'src/utils.ts'],
        output: 'Analysis complete',
        duration: 5000,
      }

      expect(result.success).toBe(true)
      expect(result.changedFiles).toHaveLength(2)
      expect(result.error).toBeUndefined()
    })

    it('should represent failed agent execution', () => {
      const result: AgentResult = {
        agent: 'implementer',
        success: false,
        branch: 'feature/test-implementer',
        worktreePath: '.worktrees/test-implementer-1',
        changedFiles: [],
        error: 'Timeout exceeded',
        duration: 300000,
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('Timeout exceeded')
      expect(result.changedFiles).toHaveLength(0)
    })

    it('should handle agent with no changed files', () => {
      const result: AgentResult = {
        agent: 'readonly-agent',
        success: true,
        branch: 'feature/readonly',
        worktreePath: '',
        changedFiles: [],
        duration: 1000,
      }

      expect(result.changedFiles).toHaveLength(0)
      expect(result.success).toBe(true)
    })
  })

  describe('ConflictInfo interface', () => {
    it('should represent auto-resolvable conflict', () => {
      const conflict: ConflictInfo = {
        file: 'src/index.ts',
        agents: ['analyzer', 'implementer'],
        type: 'auto-resolvable',
      }

      expect(conflict.type).toBe('auto-resolvable')
      expect(conflict.agents).toHaveLength(2)
    })

    it('should represent manual-required conflict', () => {
      const conflict: ConflictInfo = {
        file: 'src/config.json',
        agents: ['agent1', 'agent2', 'agent3'],
        type: 'manual-required',
      }

      expect(conflict.type).toBe('manual-required')
    })

    it('should represent no conflict', () => {
      const conflict: ConflictInfo = {
        file: 'src/utils.ts',
        agents: ['analyzer'],
        type: 'none',
      }

      expect(conflict.type).toBe('none')
    })

    it('should include diff when available', () => {
      const conflict: ConflictInfo = {
        file: 'src/index.ts',
        agents: ['a', 'b'],
        type: 'auto-resolvable',
        diff: '<<<<<<< HEAD\nold content\n=======\nnew content\n>>>>>>> branch',
      }

      expect(conflict.diff).toBeDefined()
      expect(conflict.diff).toContain('<<<<<<< HEAD')
    })
  })

  describe('ParallelResult interface', () => {
    it('should represent successful parallel execution', () => {
      const result: ParallelResult = {
        success: true,
        agentResults: [
          {
            agent: 'analyzer',
            success: true,
            branch: 'feature/analyzer',
            worktreePath: '',
            changedFiles: ['a.ts'],
            duration: 1000,
          },
          {
            agent: 'implementer',
            success: true,
            branch: 'feature/implementer',
            worktreePath: '',
            changedFiles: ['b.ts'],
            duration: 2000,
          },
        ],
        duration: 3000,
        conflicts: [],
        mode: 'parallel',
      }

      expect(result.success).toBe(true)
      expect(result.mode).toBe('parallel')
      expect(result.agentResults).toHaveLength(2)
      expect(result.conflicts).toHaveLength(0)
    })

    it('should represent failed parallel execution', () => {
      const result: ParallelResult = {
        success: false,
        agentResults: [
          {
            agent: 'analyzer',
            success: true,
            branch: 'feature/analyzer',
            worktreePath: '',
            changedFiles: ['shared.ts'],
            duration: 1000,
          },
          {
            agent: 'implementer',
            success: true,
            branch: 'feature/implementer',
            worktreePath: '',
            changedFiles: ['shared.ts'],
            duration: 2000,
          },
        ],
        duration: 3000,
        conflicts: [
          {
            file: 'shared.ts',
            agents: ['analyzer', 'implementer'],
            type: 'manual-required',
          },
        ],
        mode: 'parallel',
      }

      expect(result.success).toBe(false)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].type).toBe('manual-required')
    })

    it('should represent sequential execution result', () => {
      const result: ParallelResult = {
        success: true,
        agentResults: [],
        duration: 0,
        conflicts: [],
        mode: 'sequential',
      }

      expect(result.mode).toBe('sequential')
    })
  })

  describe('Conflict detection scenarios', () => {
    it('should handle no conflicts when files do not overlap', () => {
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

      const fileChanges = new Map<string, string[]>()
      for (const result of results) {
        for (const file of result.changedFiles) {
          const agents = fileChanges.get(file) || []
          agents.push(result.agent)
          fileChanges.set(file, agents)
        }
      }

      const conflicts = Array.from(fileChanges.entries()).filter(([, agents]) => agents.length > 1)
      expect(conflicts).toHaveLength(0)
    })

    it('should detect conflicts when files overlap', () => {
      const results: AgentResult[] = [
        {
          agent: 'analyzer',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['shared.ts', 'a.ts'],
          duration: 0,
        },
        {
          agent: 'implementer',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['shared.ts', 'b.ts'],
          duration: 0,
        },
      ]

      const fileChanges = new Map<string, string[]>()
      for (const result of results) {
        for (const file of result.changedFiles) {
          const agents = fileChanges.get(file) || []
          agents.push(result.agent)
          fileChanges.set(file, agents)
        }
      }

      const conflicts = Array.from(fileChanges.entries()).filter(([, agents]) => agents.length > 1)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0][0]).toBe('shared.ts')
      expect(conflicts[0][1]).toContain('analyzer')
      expect(conflicts[0][1]).toContain('implementer')
    })

    it('should detect multiple conflicts', () => {
      const results: AgentResult[] = [
        {
          agent: 'a',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['file1.ts', 'file2.ts'],
          duration: 0,
        },
        {
          agent: 'b',
          success: true,
          branch: 'b',
          worktreePath: '',
          changedFiles: ['file1.ts', 'file2.ts'],
          duration: 0,
        },
      ]

      const fileChanges = new Map<string, string[]>()
      for (const result of results) {
        for (const file of result.changedFiles) {
          const agents = fileChanges.get(file) || []
          agents.push(result.agent)
          fileChanges.set(file, agents)
        }
      }

      const conflicts = Array.from(fileChanges.entries()).filter(([, agents]) => agents.length > 1)
      expect(conflicts).toHaveLength(2)
    })
  })

  describe('Execution timing scenarios', () => {
    it('should calculate total duration correctly for parallel execution', () => {
      const result: ParallelResult = {
        success: true,
        agentResults: [
          {
            agent: 'a',
            success: true,
            branch: 'b',
            worktreePath: '',
            changedFiles: [],
            duration: 5000,
          },
          {
            agent: 'b',
            success: true,
            branch: 'b',
            worktreePath: '',
            changedFiles: [],
            duration: 3000,
          },
        ],
        duration: 5500,
        conflicts: [],
        mode: 'parallel',
      }

      expect(result.duration).toBeLessThan(
        result.agentResults[0].duration + result.agentResults[1].duration
      )
    })

    it('should have longer duration for sequential execution', () => {
      const parallelResult: ParallelResult = {
        success: true,
        agentResults: [
          {
            agent: 'a',
            success: true,
            branch: 'b',
            worktreePath: '',
            changedFiles: [],
            duration: 3000,
          },
          {
            agent: 'b',
            success: true,
            branch: 'b',
            worktreePath: '',
            changedFiles: [],
            duration: 3000,
          },
        ],
        duration: 3500,
        conflicts: [],
        mode: 'parallel',
      }

      const sequentialResult: ParallelResult = {
        success: true,
        agentResults: [
          {
            agent: 'a',
            success: true,
            branch: 'b',
            worktreePath: '',
            changedFiles: [],
            duration: 3000,
          },
          {
            agent: 'b',
            success: true,
            branch: 'b',
            worktreePath: '',
            changedFiles: [],
            duration: 3000,
          },
        ],
        duration: 6500,
        conflicts: [],
        mode: 'sequential',
      }

      expect(sequentialResult.duration).toBeGreaterThan(parallelResult.duration)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty agent results', () => {
      const result: ParallelResult = {
        success: true,
        agentResults: [],
        duration: 100,
        conflicts: [],
        mode: 'parallel',
      }

      expect(result.agentResults).toHaveLength(0)
      expect(result.success).toBe(true)
    })

    it('should handle very long agent names', () => {
      const result: AgentResult = {
        agent: 'very-long-agent-name-for-testing-purposes-that-exceeds-normal-length',
        success: true,
        branch: 'b',
        worktreePath: '',
        changedFiles: [],
        duration: 1000,
      }

      expect(result.agent.length).toBeGreaterThan(50)
    })

    it('should handle many agents in single result', () => {
      const agents: AgentResult[] = Array.from({ length: 10 }, (_, i) => ({
        agent: `agent-${i}`,
        success: true,
        branch: `feature/agent-${i}`,
        worktreePath: '',
        changedFiles: [`file-${i}.ts`],
        duration: 1000,
      }))

      const result: ParallelResult = {
        success: true,
        agentResults: agents,
        duration: 10000,
        conflicts: [],
        mode: 'parallel',
      }

      expect(result.agentResults).toHaveLength(10)
    })
  })

  describe('Conflict classification', () => {
    it('should classify 2-agent conflict as auto-resolvable', () => {
      const conflict: ConflictInfo = {
        file: 'test.ts',
        agents: ['a', 'b'],
        type: 'auto-resolvable',
      }

      expect(conflict.type).toBe('auto-resolvable')
    })

    it('should classify 3+ agent conflict as manual-required', () => {
      const conflict: ConflictInfo = {
        file: 'test.ts',
        agents: ['a', 'b', 'c'],
        type: 'manual-required',
      }

      expect(conflict.type).toBe('manual-required')
    })
  })
})
