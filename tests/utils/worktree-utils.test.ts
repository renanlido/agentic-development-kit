import {
  DEFAULT_WORKTREE_CONFIG,
  generateWorktreePath,
  type Worktree,
  type WorktreeConfig,
} from '../../src/utils/worktree-utils.js'

describe('worktree-utils', () => {
  describe('DEFAULT_WORKTREE_CONFIG', () => {
    it('should have correct default baseDir', () => {
      expect(DEFAULT_WORKTREE_CONFIG.baseDir).toBe('.worktrees')
    })

    it('should have correct default prefix', () => {
      expect(DEFAULT_WORKTREE_CONFIG.prefix).toBe('adk')
    })
  })

  describe('generateWorktreePath', () => {
    it('should generate path with feature, agent and index', () => {
      const result = generateWorktreePath('my-feature', 'analyzer', 0)
      expect(result).toBe('my-feature-analyzer-0')
    })

    it('should sanitize special characters', () => {
      const result = generateWorktreePath('Feature@123', 'Test/Agent', 1)
      expect(result).toBe('feature-123-test-agent-1')
    })

    it('should convert to lowercase', () => {
      const result = generateWorktreePath('FeatureName', 'AgentName', 2)
      expect(result).toBe('featurename-agentname-2')
    })

    it('should handle underscores', () => {
      const result = generateWorktreePath('my_feature', 'my_agent', 3)
      expect(result).toBe('my-feature-my-agent-3')
    })

    it('should handle spaces', () => {
      const result = generateWorktreePath('my feature', 'my agent', 4)
      expect(result).toBe('my-feature-my-agent-4')
    })

    it('should handle empty strings', () => {
      const result = generateWorktreePath('', '', 0)
      expect(result).toBe('--0')
    })

    it('should handle numbers in feature and agent', () => {
      const result = generateWorktreePath('feature123', 'agent456', 5)
      expect(result).toBe('feature123-agent456-5')
    })

    it('should handle consecutive special characters', () => {
      const result = generateWorktreePath('feature@@##name', 'agent!!name', 6)
      expect(result).toBe('feature----name-agent--name-6')
    })
  })

  describe('Worktree interface', () => {
    it('should represent a main worktree', () => {
      const worktree: Worktree = {
        path: '/home/user/project',
        branch: 'main',
        commit: 'abc123def456',
        isMain: true,
      }

      expect(worktree.path).toBe('/home/user/project')
      expect(worktree.branch).toBe('main')
      expect(worktree.commit).toBe('abc123def456')
      expect(worktree.isMain).toBe(true)
    })

    it('should represent a feature worktree', () => {
      const worktree: Worktree = {
        path: '/home/user/project/.worktrees/feature-1',
        branch: 'feature/auth',
        commit: 'def456ghi789',
        isMain: false,
      }

      expect(worktree.isMain).toBe(false)
      expect(worktree.branch).toBe('feature/auth')
    })
  })

  describe('WorktreeConfig interface', () => {
    it('should allow custom configuration', () => {
      const config: WorktreeConfig = {
        baseDir: '/custom/worktrees',
        prefix: 'custom-prefix',
      }

      expect(config.baseDir).toBe('/custom/worktrees')
      expect(config.prefix).toBe('custom-prefix')
    })

    it('should use default values from constant', () => {
      const config: WorktreeConfig = { ...DEFAULT_WORKTREE_CONFIG }

      expect(config.baseDir).toBe('.worktrees')
      expect(config.prefix).toBe('adk')
    })

    it('should allow partial override of defaults', () => {
      const config: WorktreeConfig = {
        ...DEFAULT_WORKTREE_CONFIG,
        baseDir: '/custom/path',
      }

      expect(config.baseDir).toBe('/custom/path')
      expect(config.prefix).toBe('adk')
    })
  })

  describe('Path generation edge cases', () => {
    it('should handle very long feature names', () => {
      const longFeature = 'a'.repeat(100)
      const result = generateWorktreePath(longFeature, 'agent', 0)
      expect(result).toBe(`${'a'.repeat(100)}-agent-0`)
    })

    it('should handle unicode characters', () => {
      const result = generateWorktreePath('fèature', 'agënt', 0)
      expect(result).toMatch(/f-?ature-ag-?nt-0/)
    })

    it('should handle mixed case and special chars', () => {
      const result = generateWorktreePath('MyFeature-v2.0', 'TestAgent_1', 1)
      expect(result.toLowerCase()).toBe(result)
      expect(result).not.toContain('.')
      expect(result).not.toContain('_')
    })
  })

  describe('Worktree path patterns', () => {
    it('should generate consistent paths for same inputs', () => {
      const path1 = generateWorktreePath('feature', 'agent', 0)
      const path2 = generateWorktreePath('feature', 'agent', 0)
      expect(path1).toBe(path2)
    })

    it('should generate different paths for different indexes', () => {
      const path1 = generateWorktreePath('feature', 'agent', 0)
      const path2 = generateWorktreePath('feature', 'agent', 1)
      expect(path1).not.toBe(path2)
    })

    it('should generate different paths for different agents', () => {
      const path1 = generateWorktreePath('feature', 'analyzer', 0)
      const path2 = generateWorktreePath('feature', 'implementer', 0)
      expect(path1).not.toBe(path2)
    })

    it('should generate different paths for different features', () => {
      const path1 = generateWorktreePath('feature-a', 'agent', 0)
      const path2 = generateWorktreePath('feature-b', 'agent', 0)
      expect(path1).not.toBe(path2)
    })
  })

  describe('Worktree collection scenarios', () => {
    it('should correctly model multiple worktrees', () => {
      const worktrees: Worktree[] = [
        { path: '/project', branch: 'main', commit: 'aaa', isMain: true },
        { path: '/project/.worktrees/f1', branch: 'feature/1', commit: 'bbb', isMain: false },
        { path: '/project/.worktrees/f2', branch: 'feature/2', commit: 'ccc', isMain: false },
      ]

      const mainWorktree = worktrees.find((w) => w.isMain)
      const featureWorktrees = worktrees.filter((w) => !w.isMain)

      expect(mainWorktree?.branch).toBe('main')
      expect(featureWorktrees).toHaveLength(2)
    })

    it('should find worktree by branch name', () => {
      const worktrees: Worktree[] = [
        { path: '/project', branch: 'main', commit: 'aaa', isMain: true },
        { path: '/project/.worktrees/f1', branch: 'feature/auth', commit: 'bbb', isMain: false },
      ]

      const found = worktrees.find((w) => w.branch === 'feature/auth')
      expect(found).toBeDefined()
      expect(found?.path).toContain('f1')
    })

    it('should check if worktree exists by path', () => {
      const worktrees: Worktree[] = [
        { path: '/project', branch: 'main', commit: 'aaa', isMain: true },
        { path: '/project/.worktrees/test', branch: 'test', commit: 'bbb', isMain: false },
      ]

      const existsByFullPath = worktrees.some((w) => w.path === '/project/.worktrees/test')
      const existsByPartialPath = worktrees.some((w) => w.path.endsWith('test'))

      expect(existsByFullPath).toBe(true)
      expect(existsByPartialPath).toBe(true)
    })
  })
})
