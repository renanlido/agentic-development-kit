import { exec } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import fs from 'fs-extra'

const execAsync = promisify(exec)

export interface Worktree {
  path: string
  branch: string
  commit: string
  isMain: boolean
}

export interface WorktreeConfig {
  baseDir: string
  prefix: string
}

export const DEFAULT_WORKTREE_CONFIG: WorktreeConfig = {
  baseDir: '.worktrees',
  prefix: 'adk',
}

async function runGit(command: string, cwd?: string): Promise<string> {
  const options = cwd ? { cwd } : {}
  const { stdout } = await execAsync(`git ${command}`, options)
  return stdout.trim()
}

function parseVersion(versionString: string): number[] {
  const match = versionString.match(/(\d+)\.(\d+)\.?(\d+)?/)
  if (!match) {
    return [0, 0, 0]
  }
  return [
    Number.parseInt(match[1], 10) || 0,
    Number.parseInt(match[2], 10) || 0,
    Number.parseInt(match[3], 10) || 0,
  ]
}

function isVersionAtLeast(current: string, required: string): boolean {
  const [curMajor, curMinor, curPatch] = parseVersion(current)
  const [reqMajor, reqMinor, reqPatch] = parseVersion(required)

  if (curMajor !== reqMajor) {
    return curMajor > reqMajor
  }
  if (curMinor !== reqMinor) {
    return curMinor > reqMinor
  }
  return curPatch >= reqPatch
}

export async function checkGitVersion(): Promise<{ valid: boolean; version: string }> {
  try {
    const output = await runGit('--version')
    const match = output.match(/git version (\d+\.\d+\.\d+)/)
    const version = match ? match[1] : '0.0.0'
    const valid = isVersionAtLeast(version, '2.20.0')
    return { valid, version }
  } catch {
    return { valid: false, version: '0.0.0' }
  }
}

export async function createWorktree(
  branch: string,
  worktreePath: string,
  config: WorktreeConfig = DEFAULT_WORKTREE_CONFIG
): Promise<void> {
  const { valid, version } = await checkGitVersion()
  if (!valid) {
    throw new Error(`Git >= 2.20 required for worktree support. Current: ${version}`)
  }

  const fullPath = path.join(config.baseDir, worktreePath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })

  const branchOutput = await runGit('branch --list')
  const branches = branchOutput.split('\n').map((b) => b.replace(/^\*?\s*/, '').trim())
  const branchExists = branches.includes(branch)

  if (!branchExists) {
    const currentBranch = await runGit('branch --show-current')
    await runGit(`checkout -b ${branch}`)
    await runGit(`checkout ${currentBranch}`)
  }

  await runGit(`worktree add ${fullPath} ${branch}`)
}

export async function removeWorktree(worktreePath: string, force = false): Promise<void> {
  const forceFlag = force ? ' --force' : ''
  await runGit(`worktree remove ${worktreePath}${forceFlag}`)
}

export async function listWorktrees(): Promise<Worktree[]> {
  const output = await runGit('worktree list --porcelain')

  const worktrees: Worktree[] = []
  let current: Partial<Worktree> = {}

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as Worktree)
      }
      current = { path: line.slice(9), isMain: false }
    } else if (line.startsWith('HEAD ')) {
      current.commit = line.slice(5)
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '')
    } else if (line === 'bare') {
      current.isMain = true
    }
  }

  if (current.path) {
    worktrees.push(current as Worktree)
  }

  if (worktrees.length > 0) {
    worktrees[0].isMain = true
  }

  return worktrees
}

export async function getWorktree(branch: string): Promise<Worktree | null> {
  const worktrees = await listWorktrees()
  return worktrees.find((wt) => wt.branch === branch) || null
}

export async function cleanupWorktrees(prefix: string): Promise<number> {
  const worktrees = await listWorktrees()
  let cleaned = 0

  for (const wt of worktrees) {
    if (wt.isMain) {
      continue
    }
    if (wt.path.includes(prefix)) {
      try {
        await removeWorktree(wt.path, true)
        cleaned++
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return cleaned
}

export async function worktreeExists(worktreePath: string): Promise<boolean> {
  const worktrees = await listWorktrees()
  return worktrees.some((wt) => wt.path === worktreePath || wt.path.endsWith(worktreePath))
}

export async function getChangedFilesInWorktree(worktreePath: string): Promise<string[]> {
  try {
    const output = await runGit('status --porcelain', worktreePath)
    if (!output) {
      return []
    }

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3))
  } catch {
    return []
  }
}

export async function commitInWorktree(
  worktreePath: string,
  message: string,
  files?: string[]
): Promise<string> {
  if (files && files.length > 0) {
    await runGit(`add ${files.join(' ')}`, worktreePath)
  } else {
    await runGit('add .', worktreePath)
  }

  const output = await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`, worktreePath)
  const match = output.match(/\[[\w-]+ ([a-f0-9]+)\]/)
  return match ? match[1] : ''
}

export function generateWorktreePath(feature: string, agent: string, index: number): string {
  const sanitized = `${feature}-${agent}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `${sanitized}-${index}`
}

export async function setupClaudeSymlink(
  worktreePath: string,
  mainRepoPath: string
): Promise<void> {
  const worktreeClaudePath = path.join(worktreePath, '.claude')
  const mainClaudePath = path.join(mainRepoPath, '.claude')

  try {
    const stats = await fs.lstat(worktreeClaudePath)

    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(worktreeClaudePath)
      if (target === mainClaudePath || path.resolve(worktreePath, target) === mainClaudePath) {
        return
      }
    }

    if (stats.isDirectory()) {
      await fs.remove(worktreeClaudePath)
    }
  } catch {
    // Path doesn't exist, which is fine
  }

  await fs.ensureSymlink(mainClaudePath, worktreeClaudePath, 'dir')
}

export async function fixWorktreeSymlinks(
  mainRepoPath: string,
  config: WorktreeConfig = DEFAULT_WORKTREE_CONFIG
): Promise<{ fixed: number; errors: string[] }> {
  const worktrees = await listWorktrees()
  let fixed = 0
  const errors: string[] = []

  for (const wt of worktrees) {
    if (wt.isMain) {
      continue
    }

    if (!wt.path.includes(config.baseDir)) {
      continue
    }

    try {
      await setupClaudeSymlink(wt.path, mainRepoPath)
      fixed++
    } catch (error) {
      errors.push(`${wt.path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { fixed, errors }
}
