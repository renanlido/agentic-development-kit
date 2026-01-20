import fs from 'node:fs/promises'
import chalk from 'chalk'
import { getClaudePath } from './git-paths'

const STATUS_FILE = getClaudePath('agent-status.json')

export type AgentStatusState = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentStatus {
  id: string
  agent: string
  feature: string
  status: AgentStatusState
  startedAt?: string
  completedAt?: string
  duration?: number
  worktree?: string
  error?: string
  changedFiles?: string[]
}

export interface AgentStatusStore {
  statuses: AgentStatus[]
  lastUpdated: string
  version: string
}

let statusCache: AgentStatusStore | null = null

async function ensureStatusDir(): Promise<void> {
  const dir = STATUS_FILE.split('/').slice(0, -1).join('/')
  await fs.mkdir(dir, { recursive: true })
}

async function loadStatusStore(): Promise<AgentStatusStore> {
  if (statusCache) {
    return statusCache
  }

  try {
    const content = await fs.readFile(STATUS_FILE, 'utf-8')
    statusCache = JSON.parse(content)
    return statusCache as AgentStatusStore
  } catch {
    statusCache = {
      statuses: [],
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    }
    return statusCache
  }
}

async function saveStatusStore(store: AgentStatusStore): Promise<void> {
  await ensureStatusDir()
  store.lastUpdated = new Date().toISOString()
  await fs.writeFile(STATUS_FILE, JSON.stringify(store, null, 2), 'utf-8')
  statusCache = store
}

export function generateAgentId(feature: string, agent: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 6)
  return `${feature}-${agent}-${timestamp}-${random}`
}

export async function createAgentStatus(
  feature: string,
  agent: string,
  worktree?: string
): Promise<AgentStatus> {
  const store = await loadStatusStore()

  const status: AgentStatus = {
    id: generateAgentId(feature, agent),
    agent,
    feature,
    status: 'pending',
    worktree,
  }

  store.statuses.push(status)
  await saveStatusStore(store)

  return status
}

export async function updateAgentStatus(
  id: string,
  update: Partial<AgentStatus>
): Promise<AgentStatus | null> {
  const store = await loadStatusStore()
  const index = store.statuses.findIndex((s) => s.id === id)

  if (index < 0) {
    return null
  }

  store.statuses[index] = { ...store.statuses[index], ...update }
  await saveStatusStore(store)

  return store.statuses[index]
}

export async function startAgent(id: string): Promise<AgentStatus | null> {
  return updateAgentStatus(id, {
    status: 'running',
    startedAt: new Date().toISOString(),
  })
}

export async function completeAgent(
  id: string,
  changedFiles?: string[]
): Promise<AgentStatus | null> {
  const store = await loadStatusStore()
  const status = store.statuses.find((s) => s.id === id)

  if (!status) {
    return null
  }

  const completedAt = new Date().toISOString()
  const duration = status.startedAt
    ? new Date(completedAt).getTime() - new Date(status.startedAt).getTime()
    : 0

  return updateAgentStatus(id, {
    status: 'completed',
    completedAt,
    duration,
    changedFiles,
  })
}

export async function failAgent(id: string, error: string): Promise<AgentStatus | null> {
  const store = await loadStatusStore()
  const status = store.statuses.find((s) => s.id === id)

  if (!status) {
    return null
  }

  const completedAt = new Date().toISOString()
  const duration = status.startedAt
    ? new Date(completedAt).getTime() - new Date(status.startedAt).getTime()
    : 0

  return updateAgentStatus(id, {
    status: 'failed',
    completedAt,
    duration,
    error,
  })
}

export async function getAgentStatus(id: string): Promise<AgentStatus | null> {
  const store = await loadStatusStore()
  return store.statuses.find((s) => s.id === id) || null
}

export async function getAllAgentStatuses(): Promise<AgentStatus[]> {
  const store = await loadStatusStore()
  return store.statuses
}

export async function getAgentStatusesByFeature(feature: string): Promise<AgentStatus[]> {
  const store = await loadStatusStore()
  return store.statuses.filter((s) => s.feature === feature)
}

export async function getRunningAgents(): Promise<AgentStatus[]> {
  const store = await loadStatusStore()
  return store.statuses.filter((s) => s.status === 'running')
}

export async function getPendingAgents(): Promise<AgentStatus[]> {
  const store = await loadStatusStore()
  return store.statuses.filter((s) => s.status === 'pending')
}

export async function clearOldStatuses(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const store = await loadStatusStore()
  const now = Date.now()
  const initialLength = store.statuses.length

  store.statuses = store.statuses.filter((s) => {
    if (s.status === 'running' || s.status === 'pending') {
      return true
    }
    const completedAt = s.completedAt ? new Date(s.completedAt).getTime() : 0
    return now - completedAt < maxAgeMs
  })

  await saveStatusStore(store)
  return initialLength - store.statuses.length
}

export async function clearAllStatuses(): Promise<void> {
  const store = await loadStatusStore()
  store.statuses = []
  await saveStatusStore(store)
}

export function formatAgentStatus(status: AgentStatus): string {
  const icons: Record<AgentStatusState, string> = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
  }

  const icon = icons[status.status]
  const duration = status.duration ? ` (${(status.duration / 1000).toFixed(1)}s)` : ''
  const elapsed =
    status.status === 'running' && status.startedAt
      ? ` (${((Date.now() - new Date(status.startedAt).getTime()) / 1000).toFixed(1)}s)`
      : ''

  return `${icon} ${status.agent} - ${status.feature}${duration}${elapsed}`
}

export function displayAgentStatuses(statuses: AgentStatus[]): void {
  console.log('\n📊 Agent Status\n')

  if (statuses.length === 0) {
    console.log(chalk.gray('  No agents tracked'))
    return
  }

  const grouped: Record<string, AgentStatus[]> = {}
  for (const status of statuses) {
    if (!grouped[status.feature]) {
      grouped[status.feature] = []
    }
    grouped[status.feature].push(status)
  }

  for (const [feature, featureStatuses] of Object.entries(grouped)) {
    console.log(chalk.cyan.bold(`  ${feature}:`))

    for (const status of featureStatuses) {
      const line = formatAgentStatus(status)
      console.log(`    ${line}`)

      if (status.error) {
        console.log(chalk.red(`      Error: ${status.error}`))
      }

      if (status.changedFiles && status.changedFiles.length > 0) {
        console.log(chalk.gray(`      Changed: ${status.changedFiles.join(', ')}`))
      }
    }
    console.log()
  }
}

export async function watchAgentStatuses(
  intervalMs = 1000,
  callback?: (statuses: AgentStatus[]) => void
): Promise<() => void> {
  let running = true

  const poll = async () => {
    while (running) {
      statusCache = null
      const statuses = await getAllAgentStatuses()

      if (callback) {
        callback(statuses)
      } else {
        console.clear()
        displayAgentStatuses(statuses)
      }

      const hasActive = statuses.some((s) => s.status === 'running' || s.status === 'pending')
      if (!hasActive) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  poll()

  return () => {
    running = false
  }
}

export function clearStatusCache(): void {
  statusCache = null
}
