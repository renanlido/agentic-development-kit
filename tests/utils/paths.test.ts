import { execFileSync } from 'node:child_process'
import path from 'node:path'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn(),
}))

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>

describe('paths utilities', () => {
  const mockCwd = '/test/project'

  beforeEach(() => {
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd)
    mockExecFileSync.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getMainRepoPath', () => {
    it('should return cwd when git common dir is ".git"', () => {
      mockExecFileSync.mockReturnValue('.git')

      const { getMainRepoPath } = require('../../src/utils/paths.js')
      const result = getMainRepoPath()

      expect(result).toBe(mockCwd)
    })

    it('should return cwd when git common dir ends with "/.git"', () => {
      mockExecFileSync.mockReturnValue('/test/project/.git')

      const { getMainRepoPath } = require('../../src/utils/paths.js')
      const result = getMainRepoPath()

      expect(result).toBe(mockCwd)
    })

    it('should return parent directory of git common dir for worktrees', () => {
      mockExecFileSync.mockReturnValue('/main/repo/.git/worktrees/feature-branch')

      const { getMainRepoPath } = require('../../src/utils/paths.js')
      const result = getMainRepoPath()

      expect(result).toBe('/main/repo/.git/worktrees')
    })

    it('should return cwd when git command fails', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      const { getMainRepoPath } = require('../../src/utils/paths.js')
      const result = getMainRepoPath()

      expect(result).toBe(mockCwd)
    })
  })

  describe('getClaudePath', () => {
    it('should return .claude path relative to main repo', () => {
      mockExecFileSync.mockReturnValue('.git')

      const { getClaudePath } = require('../../src/utils/paths.js')
      const result = getClaudePath()

      expect(result).toBe(path.join(mockCwd, '.claude'))
    })
  })

  describe('getFeaturePath', () => {
    it('should return feature path for given name', () => {
      mockExecFileSync.mockReturnValue('.git')

      const { getFeaturePath } = require('../../src/utils/paths.js')
      const result = getFeaturePath('my-feature')

      expect(result).toBe(path.join(mockCwd, '.claude', 'plans/features', 'my-feature'))
    })
  })

  describe('getAgentsPath', () => {
    it('should return agents path relative to main repo', () => {
      mockExecFileSync.mockReturnValue('.git')

      const { getAgentsPath } = require('../../src/utils/paths.js')
      const result = getAgentsPath()

      expect(result).toBe(path.join(mockCwd, '.claude', 'agents'))
    })
  })
})
