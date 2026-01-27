import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function validateFeatureName(featureName: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(featureName)) {
    throw new Error(
      `Invalid feature name: "${featureName}". Use only alphanumeric characters, dashes, and underscores.`
    )
  }
}

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

    const absoluteGitDir = path.resolve(process.cwd(), gitCommonDir)
    return path.dirname(absoluteGitDir)
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
  validateFeatureName(featureName)

  const mainBasePath = getFeaturesBasePath()
  let resolvedPath: string
  let usedWorktreeLocal = false

  if (isInWorktree()) {
    const worktreeBase = process.cwd()
    const localPath = path.join(worktreeBase, '.claude/plans/features', featureName, ...segments)
    if (fs.existsSync(localPath)) {
      resolvedPath = path.resolve(localPath)
      usedWorktreeLocal = true
    } else {
      resolvedPath = path.resolve(path.join(mainBasePath, featureName, ...segments))
    }
  } else {
    resolvedPath = path.resolve(path.join(mainBasePath, featureName, ...segments))
  }

  const mainBaseResolved = path.resolve(mainBasePath)
  let isValidPath = resolvedPath.startsWith(mainBaseResolved)

  if (!isValidPath && usedWorktreeLocal) {
    const worktreeBasePath = path.join(process.cwd(), '.claude/plans/features')
    const worktreeBaseResolved = path.resolve(worktreeBasePath)
    isValidPath = resolvedPath.startsWith(worktreeBaseResolved)
  }

  if (!isValidPath) {
    throw new Error(`Path traversal detected: "${featureName}" resolves outside feature directory`)
  }

  return resolvedPath
}

export function getAgentsPath(): string {
  return getClaudePath('agents')
}
