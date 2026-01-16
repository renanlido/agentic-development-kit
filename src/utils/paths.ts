import { execFileSync } from 'node:child_process'
import path from 'node:path'

export function getMainRepoPath(): string {
  try {
    const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      encoding: 'utf-8',
    }).trim()

    if (gitCommonDir === '.git' || gitCommonDir.endsWith('/.git')) {
      return process.cwd()
    }

    return path.dirname(gitCommonDir)
  } catch {
    return process.cwd()
  }
}

export function getClaudePath(): string {
  return path.join(getMainRepoPath(), '.claude')
}

export function getFeaturePath(name: string): string {
  return path.join(getClaudePath(), 'plans/features', name)
}

export function getAgentsPath(): string {
  return path.join(getClaudePath(), 'agents')
}
