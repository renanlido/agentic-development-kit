import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function findGitRoot(startDir: string): string | null {
  let currentDir = startDir

  while (currentDir !== path.dirname(currentDir)) {
    const gitPath = path.join(currentDir, '.git')

    if (fs.existsSync(gitPath)) {
      const stat = fs.statSync(gitPath)
      if (stat.isDirectory()) {
        return currentDir
      }
      if (stat.isFile()) {
        const content = fs.readFileSync(gitPath, 'utf-8').trim()
        if (content.startsWith('gitdir:')) {
          const gitDir = content.slice(7).trim()
          const worktreesMatch = gitDir.match(/(.+)\/\.git\/worktrees\//)
          if (worktreesMatch) {
            return worktreesMatch[1]
          }
        }
        return currentDir
      }
    }

    currentDir = path.dirname(currentDir)
  }

  return null
}

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
    const gitRoot = findGitRoot(process.cwd())
    if (gitRoot) {
      return gitRoot
    }
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
