import { execFileSync } from 'node:child_process'
import path from 'node:path'

export function getMainRepoPath(): string {
  try {
    const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      encoding: 'utf-8',
    }).trim()

    if (gitCommonDir === '.git') {
      return process.cwd()
    }

    return path.dirname(gitCommonDir)
  } catch {
    return process.cwd()
  }
}

export function isInWorktree(): boolean {
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      encoding: 'utf-8',
    }).trim()

    return gitDir.includes('.git/worktrees')
  } catch {
    return false
  }
}

export function getCurrentWorktreePath(): string | null {
  if (!isInWorktree()) {
    return null
  }
  return process.cwd()
}

export function getClaudePath(...segments: string[]): string {
  return path.join(getMainRepoPath(), '.claude', ...segments)
}

export function getFeaturesBasePath(): string {
  return path.join(getMainRepoPath(), '.claude/plans/features')
}

export function getFeaturePath(featureName: string, ...segments: string[]): string {
  return path.join(getFeaturesBasePath(), featureName, ...segments)
}

export function getAgentsPath(): string {
  return getClaudePath('agents')
}
