import path from 'node:path'
import { executeClaudeCommand } from './claude.js'
import {
  createWorktree,
  DEFAULT_WORKTREE_CONFIG,
  generateWorktreePath,
  getChangedFilesInWorktree,
  removeWorktree,
  type WorktreeConfig,
} from './worktree-utils.js'

export interface ParallelConfig {
  maxAgents: number
  timeout: number
  cleanupOnError: boolean
  worktreeConfig: WorktreeConfig
}

export const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  maxAgents: 3,
  timeout: 300000,
  cleanupOnError: true,
  worktreeConfig: DEFAULT_WORKTREE_CONFIG,
}

export interface AgentResult {
  agent: string
  success: boolean
  branch: string
  worktreePath: string
  changedFiles: string[]
  output?: string
  error?: string
  duration: number
}

export interface ConflictInfo {
  file: string
  agents: string[]
  type: 'none' | 'auto-resolvable' | 'manual-required'
  diff?: string
}

export interface ParallelResult {
  success: boolean
  agentResults: AgentResult[]
  duration: number
  conflicts: ConflictInfo[]
  mode: 'parallel' | 'sequential'
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

async function executeAgentInWorktree(
  agent: string,
  feature: string,
  worktreePath: string,
  timeout: number
): Promise<{ output: string; changedFiles: string[] }> {
  const prompt = `
You are executing agent "${agent}" for feature "${feature}".
Working directory: ${worktreePath}

Execute the agent workflow and make necessary changes.
`

  const output = await Promise.race([
    executeClaudeCommand(prompt),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Agent execution timeout')), timeout)
    ),
  ])

  const changedFiles = await getChangedFilesInWorktree(worktreePath)

  return { output, changedFiles }
}

export async function executeParallel(
  agents: string[],
  feature: string,
  config: ParallelConfig = DEFAULT_PARALLEL_CONFIG
): Promise<ParallelResult> {
  const startTime = Date.now()
  const results: AgentResult[] = []
  const worktrees: string[] = []

  const chunks = chunkArray(agents, config.maxAgents)

  for (const chunk of chunks) {
    const promises = chunk.map(async (agent, index) => {
      const worktreePath = generateWorktreePath(feature, agent, index)
      const branch = `${feature}/${agent}`
      const agentStartTime = Date.now()

      try {
        await createWorktree(branch, worktreePath, config.worktreeConfig)
        worktrees.push(path.join(config.worktreeConfig.baseDir, worktreePath))

        const { output, changedFiles } = await executeAgentInWorktree(
          agent,
          feature,
          path.join(config.worktreeConfig.baseDir, worktreePath),
          config.timeout
        )

        return {
          agent,
          success: true,
          branch,
          worktreePath,
          changedFiles,
          output,
          duration: Date.now() - agentStartTime,
        }
      } catch (error) {
        return {
          agent,
          success: false,
          branch,
          worktreePath,
          changedFiles: [],
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - agentStartTime,
        }
      }
    })

    const chunkResults = await Promise.all(promises)
    results.push(...chunkResults)
  }

  const conflicts = detectConflicts(results)

  if (config.cleanupOnError || results.every((r) => r.success)) {
    for (const wt of worktrees) {
      try {
        await removeWorktree(wt, true)
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return {
    success:
      results.every((r) => r.success) && !conflicts.some((c) => c.type === 'manual-required'),
    agentResults: results,
    duration: Date.now() - startTime,
    conflicts,
    mode: 'parallel',
  }
}

function detectConflicts(results: AgentResult[]): ConflictInfo[] {
  const fileChanges: Map<string, string[]> = new Map()

  for (const result of results) {
    if (!result.success) {
      continue
    }

    for (const file of result.changedFiles) {
      const agents = fileChanges.get(file) || []
      agents.push(result.agent)
      fileChanges.set(file, agents)
    }
  }

  const conflicts: ConflictInfo[] = []

  for (const [file, agents] of fileChanges) {
    if (agents.length > 1) {
      conflicts.push({
        file,
        agents,
        type: classifyConflict(file, agents.length),
      })
    }
  }

  return conflicts
}

function classifyConflict(_file: string, agentCount: number): ConflictInfo['type'] {
  if (agentCount === 2) {
    return 'auto-resolvable'
  }
  return 'manual-required'
}

export async function executeSequential(
  agents: string[],
  feature: string,
  _config: Partial<ParallelConfig> = {}
): Promise<ParallelResult> {
  const startTime = Date.now()
  const results: AgentResult[] = []

  for (const agent of agents) {
    const agentStartTime = Date.now()

    try {
      const prompt = `
You are executing agent "${agent}" for feature "${feature}".
Execute the agent workflow and make necessary changes.
`
      const output = await executeClaudeCommand(prompt)

      results.push({
        agent,
        success: true,
        branch: `${feature}/${agent}`,
        worktreePath: '',
        changedFiles: [],
        output,
        duration: Date.now() - agentStartTime,
      })
    } catch (error) {
      results.push({
        agent,
        success: false,
        branch: `${feature}/${agent}`,
        worktreePath: '',
        changedFiles: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - agentStartTime,
      })
    }
  }

  return {
    success: results.every((r) => r.success),
    agentResults: results,
    duration: Date.now() - startTime,
    conflicts: [],
    mode: 'sequential',
  }
}

export interface FallbackConfig {
  autoFallback: boolean
  maxRetries: number
  retryDelay: number
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  autoFallback: true,
  maxRetries: 2,
  retryDelay: 1000,
}

export async function executeWithFallback(
  agents: string[],
  feature: string,
  parallelConfig: ParallelConfig = DEFAULT_PARALLEL_CONFIG,
  fallbackConfig: FallbackConfig = DEFAULT_FALLBACK_CONFIG
): Promise<ParallelResult> {
  try {
    const result = await executeParallel(agents, feature, parallelConfig)

    if (result.success) {
      return result
    }

    const failedAgents = result.agentResults.filter((r) => !r.success)
    const hasManualConflicts = result.conflicts.some((c) => c.type === 'manual-required')

    if (fallbackConfig.autoFallback && (failedAgents.length > 0 || hasManualConflicts)) {
      return executeSequential(agents, feature, parallelConfig)
    }

    return result
  } catch (error) {
    if (fallbackConfig.autoFallback) {
      return executeSequential(agents, feature, parallelConfig)
    }
    throw error
  }
}

export function formatParallelResult(result: ParallelResult): string {
  const lines: string[] = []

  lines.push(`\n📊 Execution Summary (${result.mode} mode)`)
  lines.push(`   Duration: ${(result.duration / 1000).toFixed(1)}s`)
  lines.push(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
  lines.push('')

  lines.push('Agent Results:')
  for (const agent of result.agentResults) {
    const icon = agent.success ? '✅' : '❌'
    const duration = `(${(agent.duration / 1000).toFixed(1)}s)`
    lines.push(`   ${icon} ${agent.agent} ${duration}`)
    if (agent.changedFiles.length > 0) {
      lines.push(`      Changed: ${agent.changedFiles.join(', ')}`)
    }
    if (agent.error) {
      lines.push(`      Error: ${agent.error}`)
    }
  }

  if (result.conflicts.length > 0) {
    lines.push('')
    lines.push('Conflicts:')
    for (const conflict of result.conflicts) {
      const icon =
        conflict.type === 'manual-required'
          ? '🔴'
          : conflict.type === 'auto-resolvable'
            ? '🟡'
            : '🟢'
      lines.push(`   ${icon} ${conflict.file} (${conflict.agents.join(', ')})`)
    }
  }

  return lines.join('\n')
}
