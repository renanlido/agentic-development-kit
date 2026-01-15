import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentResult, ConflictInfo, ParallelResult } from './parallel-executor.js'

const execAsync = promisify(exec)

export interface MergeStrategy {
  autoMerge: boolean
  preserveCommits: boolean
  squashOnConflict: boolean
  targetBranch: string
}

export const DEFAULT_MERGE_STRATEGY: MergeStrategy = {
  autoMerge: true,
  preserveCommits: true,
  squashOnConflict: false,
  targetBranch: 'main',
}

export interface BranchMergeResult {
  branch: string
  success: boolean
  autoResolved: boolean
  error?: string
  commitHash?: string
}

export interface MergeResult {
  success: boolean
  mergeResults: BranchMergeResult[]
  targetBranch: string
  totalMerged: number
  totalFailed: number
}

async function runGit(command: string, cwd?: string): Promise<string> {
  const options = cwd ? { cwd } : {}
  const { stdout } = await execAsync(`git ${command}`, options)
  return stdout.trim()
}

async function getCurrentBranch(): Promise<string> {
  return runGit('branch --show-current')
}

async function checkoutBranch(branch: string): Promise<void> {
  await runGit(`checkout ${branch}`)
}

async function mergeBranch(
  branch: string,
  options: { noFf?: boolean; squash?: boolean }
): Promise<string> {
  const flags: string[] = []
  if (options.noFf) {
    flags.push('--no-ff')
  }
  if (options.squash) {
    flags.push('--squash')
  }

  const output = await runGit(`merge ${flags.join(' ')} ${branch}`)
  return output
}

async function abortMerge(): Promise<void> {
  try {
    await runGit('merge --abort')
  } catch {
    // No merge to abort
  }
}

async function commitMerge(message: string): Promise<string> {
  const output = await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`)
  const match = output.match(/\[[\w/-]+ ([a-f0-9]+)\]/)
  return match ? match[1] : ''
}

async function getConflictedFiles(): Promise<string[]> {
  try {
    const output = await runGit('diff --name-only --diff-filter=U')
    return output ? output.split('\n').filter(Boolean) : []
  } catch {
    return []
  }
}

async function autoResolveConflict(
  file: string,
  strategy: 'ours' | 'theirs' = 'theirs'
): Promise<boolean> {
  try {
    await runGit(`checkout --${strategy} ${file}`)
    await runGit(`add ${file}`)
    return true
  } catch {
    return false
  }
}

export async function mergeParallelResults(
  feature: string,
  results: ParallelResult,
  strategy: MergeStrategy = DEFAULT_MERGE_STRATEGY
): Promise<MergeResult> {
  const originalBranch = await getCurrentBranch()
  const mergeResults: BranchMergeResult[] = []

  try {
    await checkoutBranch(strategy.targetBranch)

    for (const agentResult of results.agentResults) {
      if (!agentResult.success) {
        mergeResults.push({
          branch: agentResult.branch,
          success: false,
          autoResolved: false,
          error: 'Agent execution failed',
        })
        continue
      }

      const branchMergeResult = await mergeSingleBranch(
        agentResult,
        feature,
        results.conflicts,
        strategy
      )
      mergeResults.push(branchMergeResult)
    }

    return {
      success: mergeResults.every((r) => r.success),
      mergeResults,
      targetBranch: strategy.targetBranch,
      totalMerged: mergeResults.filter((r) => r.success).length,
      totalFailed: mergeResults.filter((r) => !r.success).length,
    }
  } finally {
    try {
      await checkoutBranch(originalBranch)
    } catch {
      // Best effort to return to original branch
    }
  }
}

async function mergeSingleBranch(
  agentResult: AgentResult,
  feature: string,
  conflicts: ConflictInfo[],
  strategy: MergeStrategy
): Promise<BranchMergeResult> {
  try {
    if (strategy.preserveCommits) {
      await mergeBranch(agentResult.branch, { noFf: true })
    } else {
      await mergeBranch(agentResult.branch, { squash: true })
      const commitHash = await commitMerge(`merge: ${agentResult.agent} for ${feature}`)
      return {
        branch: agentResult.branch,
        success: true,
        autoResolved: false,
        commitHash,
      }
    }

    return {
      branch: agentResult.branch,
      success: true,
      autoResolved: false,
    }
  } catch (error) {
    const conflictedFiles = await getConflictedFiles()

    if (conflictedFiles.length === 0) {
      return {
        branch: agentResult.branch,
        success: false,
        autoResolved: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    const relatedConflicts = conflicts.filter(
      (c) => c.agents.includes(agentResult.agent) && c.type === 'auto-resolvable'
    )

    if (strategy.autoMerge && relatedConflicts.length > 0) {
      let allResolved = true

      for (const file of conflictedFiles) {
        const resolved = await autoResolveConflict(file, 'theirs')
        if (!resolved) {
          allResolved = false
          break
        }
      }

      if (allResolved) {
        try {
          const commitHash = await commitMerge(`merge: ${agentResult.agent} (auto-resolved)`)
          return {
            branch: agentResult.branch,
            success: true,
            autoResolved: true,
            commitHash,
          }
        } catch (commitError) {
          await abortMerge()
          return {
            branch: agentResult.branch,
            success: false,
            autoResolved: false,
            error: commitError instanceof Error ? commitError.message : String(commitError),
          }
        }
      }
    }

    await abortMerge()
    return {
      branch: agentResult.branch,
      success: false,
      autoResolved: false,
      error: `Merge conflict in: ${conflictedFiles.join(', ')}`,
    }
  }
}

export async function rollbackMerge(_targetBranch: string, commitsBefore: number): Promise<void> {
  await runGit(`reset --hard HEAD~${commitsBefore}`)
}

export function formatMergeResult(result: MergeResult): string {
  const lines: string[] = []

  lines.push('\n🔀 Merge Summary')
  lines.push(`   Target: ${result.targetBranch}`)
  lines.push(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
  lines.push(`   Merged: ${result.totalMerged}/${result.mergeResults.length}`)
  lines.push('')

  lines.push('Branch Results:')
  for (const br of result.mergeResults) {
    const icon = br.success ? '✅' : '❌'
    const resolved = br.autoResolved ? ' (auto-resolved)' : ''
    lines.push(`   ${icon} ${br.branch}${resolved}`)
    if (br.commitHash) {
      lines.push(`      Commit: ${br.commitHash}`)
    }
    if (br.error) {
      lines.push(`      Error: ${br.error}`)
    }
  }

  return lines.join('\n')
}
