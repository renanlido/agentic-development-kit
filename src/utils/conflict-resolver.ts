import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import chalk from 'chalk'
import type {
  ConflictInfo as EnhancedConflictInfo,
  TaskExecutionResult,
  WaveExecutionOptions,
} from '../types/parallel'
import type { AgentResult, ConflictInfo } from './parallel-executor.js'

const execAsync = promisify(exec)

export interface FileConflictForWave {
  file: string
  tasks: string[]
  conflictType: 'overlap' | 'merge'
}

export function detectFileConflictsForWave(results: TaskExecutionResult[]): FileConflictForWave[] {
  const fileToTasks = new Map<string, string[]>()

  for (const result of results) {
    if (!result.success) continue

    for (const file of result.filesModified) {
      const tasks = fileToTasks.get(file) || []
      tasks.push(result.taskId)
      fileToTasks.set(file, tasks)
    }
  }

  const conflicts: FileConflictForWave[] = []
  for (const [file, tasks] of fileToTasks) {
    if (tasks.length > 1) {
      conflicts.push({
        file,
        tasks,
        conflictType: 'overlap',
      })
    }
  }

  return conflicts
}

export function classifyConflictResolution(
  file: string,
  taskCount: number
): EnhancedConflictInfo['resolution'] {
  const simpleFiles = [
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.env',
    '.lock',
    'package.json',
  ]

  const isSimpleFile = simpleFiles.some((ext) => file.endsWith(ext))

  if (taskCount === 2 && isSimpleFile) {
    return 'auto'
  }

  if (taskCount > 3) {
    return 'manual'
  }

  return 'retry'
}

export async function resolveConflicts(
  results: TaskExecutionResult[],
  _options: WaveExecutionOptions
): Promise<EnhancedConflictInfo[]> {
  const fileConflicts = detectFileConflictsForWave(results)
  const conflicts: EnhancedConflictInfo[] = []

  for (const fc of fileConflicts) {
    const resolution = classifyConflictResolution(fc.file, fc.tasks.length)

    conflicts.push({
      type: 'file_overlap',
      tasks: fc.tasks,
      files: [fc.file],
      resolution,
      resolved: resolution === 'auto',
    })
  }

  return conflicts
}

export async function attemptAutoResolveEnhanced(conflict: EnhancedConflictInfo): Promise<boolean> {
  if (conflict.resolution !== 'auto') {
    return false
  }

  try {
    await execAsync(`git add ${conflict.files.join(' ')}`)
    return true
  } catch {
    return false
  }
}

export function formatEnhancedConflictReport(conflicts: EnhancedConflictInfo[]): string {
  if (conflicts.length === 0) {
    return chalk.green('No conflicts detected')
  }

  const lines: string[] = []
  lines.push('')
  lines.push(chalk.yellow.bold('Conflicts Detected:'))

  for (const conflict of conflicts) {
    const icon =
      conflict.resolution === 'manual'
        ? chalk.red('!')
        : conflict.resolution === 'auto'
          ? chalk.green('~')
          : chalk.yellow('?')

    lines.push(`  ${icon} ${conflict.type}: ${conflict.files.join(', ')}`)
    lines.push(`    Tasks: ${conflict.tasks.join(', ')}`)
    lines.push(`    Resolution: ${conflict.resolution}`)
  }

  return lines.join('\n')
}

export interface ConflictResolutionStrategy {
  type: 'ours' | 'theirs' | 'manual' | 'retry-sequential'
  description: string
}

export function suggestResolutionStrategy(conflict: EnhancedConflictInfo): ConflictResolutionStrategy {
  if (conflict.resolution === 'auto') {
    return {
      type: 'theirs',
      description: 'Accept the latest changes automatically',
    }
  }

  if (conflict.tasks.length === 2) {
    return {
      type: 'retry-sequential',
      description: 'Re-run conflicting tasks sequentially',
    }
  }

  return {
    type: 'manual',
    description: 'Manual intervention required',
  }
}

export function getConflictSummary(conflicts: EnhancedConflictInfo[]): {
  auto: number
  manual: number
  retry: number
} {
  return {
    auto: conflicts.filter((c) => c.resolution === 'auto').length,
    manual: conflicts.filter((c) => c.resolution === 'manual').length,
    retry: conflicts.filter((c) => c.resolution === 'retry').length,
  }
}

async function runGit(command: string, cwd?: string): Promise<string> {
  const options = cwd ? { cwd } : {}
  const { stdout } = await execAsync(`git ${command}`, options)
  return stdout.trim()
}

export interface MergeStrategy {
  autoMerge: boolean
  preserveCommits: boolean
  squashOnConflict: boolean
  targetBranch: string
}

export const DEFAULT_MERGE_STRATEGY: MergeStrategy = {
  autoMerge: true,
  preserveCommits: false,
  squashOnConflict: true,
  targetBranch: 'main',
}

export interface BranchMergeResult {
  branch: string
  success: boolean
  autoResolved: boolean
  error?: string
}

export interface MergeResult {
  success: boolean
  mergeResults: BranchMergeResult[]
  finalCommit?: string
}

export async function detectFileConflicts(
  results: AgentResult[]
): Promise<Map<string, AgentResult[]>> {
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

export async function classifyConflicts(
  conflicts: Map<string, AgentResult[]>
): Promise<ConflictInfo[]> {
  const result: ConflictInfo[] = []

  for (const [file, agents] of conflicts) {
    const agentNames = agents.map((a) => a.agent)
    const ext = path.extname(file).toLowerCase()

    const configFiles = ['.json', '.yaml', '.yml', '.toml', '.env']
    const isConfig = configFiles.includes(ext)

    let type: ConflictInfo['type'] = 'auto-resolvable'

    if (agents.length > 2) {
      type = 'manual-required'
    } else if (isConfig) {
      type = 'manual-required'
    }

    result.push({
      file,
      agents: agentNames,
      type,
    })
  }

  return result
}

export async function autoResolveConflict(
  file: string,
  agents: AgentResult[],
  worktreePaths: string[]
): Promise<boolean> {
  if (agents.length !== 2 || worktreePaths.length !== 2) {
    return false
  }

  try {
    const content1 = await fs.readFile(path.join(worktreePaths[0], file), 'utf-8')
    const content2 = await fs.readFile(path.join(worktreePaths[1], file), 'utf-8')

    const lines1 = new Set(content1.split('\n'))
    const lines2 = content2.split('\n')

    const hasOverlap = lines2.some((line) => lines1.has(line) && line.trim() !== '')

    return !hasOverlap
  } catch {
    return false
  }
}

export async function mergeParallelResults(
  feature: string,
  results: AgentResult[],
  conflicts: ConflictInfo[],
  strategy: MergeStrategy = DEFAULT_MERGE_STRATEGY
): Promise<MergeResult> {
  const mergeResults: BranchMergeResult[] = []
  const originalBranch = await runGit('branch --show-current')

  try {
    await runGit(`checkout ${strategy.targetBranch}`)

    const successfulResults = results.filter((r) => r.success)

    for (const agentResult of successfulResults) {
      try {
        const fileConflicts = conflicts.filter((c) => c.agents.includes(agentResult.agent))

        const hasManualConflicts = fileConflicts.some((c) => c.type === 'manual-required')

        if (hasManualConflicts && !strategy.autoMerge) {
          mergeResults.push({
            branch: agentResult.branch,
            success: false,
            autoResolved: false,
            error: 'Manual conflict resolution required',
          })
          continue
        }

        if (strategy.preserveCommits) {
          await runGit(`merge ${agentResult.branch} --no-ff`)
        } else {
          await runGit(`merge ${agentResult.branch} --squash`)
          await runGit(`commit -m "merge: ${agentResult.agent} for ${feature}"`)
        }

        mergeResults.push({
          branch: agentResult.branch,
          success: true,
          autoResolved: false,
        })
      } catch (error) {
        const autoResolvable = conflicts.filter(
          (c) => c.agents.includes(agentResult.agent) && c.type === 'auto-resolvable'
        )

        if (autoResolvable.length > 0 && strategy.autoMerge) {
          try {
            await runGit('add .')
            await runGit(`commit -m "merge: ${agentResult.agent} (auto-resolved)"`)

            mergeResults.push({
              branch: agentResult.branch,
              success: true,
              autoResolved: true,
            })
            continue
          } catch {
            // Fall through to abort
          }
        }

        await runGit('merge --abort').catch(() => {
          // Intentionally empty - abort may fail if no merge in progress
        })

        mergeResults.push({
          branch: agentResult.branch,
          success: false,
          autoResolved: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const finalCommit = await runGit('log -1 --format=%H').catch(() => undefined)

    return {
      success: mergeResults.every((r) => r.success),
      mergeResults,
      finalCommit,
    }
  } finally {
    try {
      await runGit(`checkout ${originalBranch}`)
    } catch {
      // Best effort to return to original branch
    }
  }
}

export async function rollbackMerge(targetBranch: string, commitHash: string): Promise<boolean> {
  try {
    await runGit(`checkout ${targetBranch}`)
    await runGit(`reset --hard ${commitHash}`)
    return true
  } catch {
    return false
  }
}

export async function generateConflictReport(
  conflicts: ConflictInfo[],
  results: AgentResult[]
): Promise<string> {
  const lines: string[] = []

  lines.push('# Conflict Report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
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

  if (auto.length > 0) {
    lines.push('## Auto-Resolvable Conflicts')
    lines.push('')
    for (const conflict of auto) {
      lines.push(`- ${conflict.file} (${conflict.agents.join(', ')})`)
    }
    lines.push('')
  }

  lines.push('## Agent Results')
  lines.push('')
  for (const result of results) {
    const status = result.success ? '✅' : '❌'
    lines.push(`### ${status} ${result.agent}`)
    lines.push(`- Branch: ${result.branch}`)
    lines.push(`- Changed Files: ${result.changedFiles.length}`)
    if (result.error) {
      lines.push(`- Error: ${result.error}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function formatMergeResult(result: MergeResult): string {
  const lines: string[] = []

  lines.push(`\n📦 Merge Summary`)
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
