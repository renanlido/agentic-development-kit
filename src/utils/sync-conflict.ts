import type {
  ConflictStrategy,
  LocalFeature,
  RemoteFeature,
  SyncConflict,
} from '../types/provider.js'

export interface ResolvedConflict {
  field: string
  winner: 'local' | 'remote'
  value: unknown
}

export interface ConflictResolution {
  strategy: ConflictStrategy
  resolvedData: Record<string, unknown>
  resolvedConflicts: ResolvedConflict[]
  requiresManualResolution: boolean
  unresolvedConflicts: SyncConflict[]
}

/**
 * Detects conflicts between local and remote feature state.
 * Compares name, phase, and progress fields, returning an array of conflicts.
 * Empty array means no conflicts - safe to sync.
 */
export async function detectConflicts(
  local: LocalFeature,
  remote: RemoteFeature
): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = []
  const localTimestamp = local.lastUpdated
  const remoteTimestamp = remote.updatedAt

  if (local.name !== remote.name) {
    conflicts.push({
      field: 'name',
      localValue: local.name,
      remoteValue: remote.name,
      localTimestamp,
      remoteTimestamp,
    })
  }

  if (remote.phase !== undefined && local.phase !== remote.phase) {
    conflicts.push({
      field: 'phase',
      localValue: local.phase,
      remoteValue: remote.phase,
      localTimestamp,
      remoteTimestamp,
    })
  }

  if (remote.progress !== undefined && local.progress !== remote.progress) {
    conflicts.push({
      field: 'progress',
      localValue: local.progress,
      remoteValue: remote.progress,
      localTimestamp,
      remoteTimestamp,
    })
  }

  return conflicts
}

function parseTimestamp(timestamp: string): number {
  const parsed = new Date(timestamp).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Resolves conflicts using the specified strategy.
 * Returns a ConflictResolution with resolved data and metadata.
 * For 'manual' strategy, returns requiresManualResolution=true without resolving.
 */
export async function resolveConflicts(
  conflicts: SyncConflict[],
  strategy: ConflictStrategy
): Promise<ConflictResolution> {
  const resolvedData: Record<string, unknown> = {}
  const resolvedConflicts: ResolvedConflict[] = []
  const unresolvedConflicts: SyncConflict[] = []

  if (strategy === 'manual') {
    return {
      strategy,
      resolvedData: {},
      resolvedConflicts: [],
      requiresManualResolution: true,
      unresolvedConflicts: conflicts,
    }
  }

  for (const conflict of conflicts) {
    let winner: 'local' | 'remote'
    let value: unknown

    switch (strategy) {
      case 'local-wins':
        winner = 'local'
        value = conflict.localValue
        break

      case 'remote-wins':
        winner = 'remote'
        value = conflict.remoteValue
        break

      case 'newest-wins': {
        const localTime = parseTimestamp(conflict.localTimestamp)
        const remoteTime = parseTimestamp(conflict.remoteTimestamp)

        if (localTime >= remoteTime) {
          winner = 'local'
          value = conflict.localValue
        } else {
          winner = 'remote'
          value = conflict.remoteValue
        }
        break
      }

      default:
        winner = 'local'
        value = conflict.localValue
    }

    resolvedData[conflict.field] = value
    resolvedConflicts.push({
      field: conflict.field,
      winner,
      value,
    })
  }

  return {
    strategy,
    resolvedData,
    resolvedConflicts,
    requiresManualResolution: false,
    unresolvedConflicts,
  }
}

export function createConflictReport(
  conflicts: SyncConflict[],
  resolution: ConflictResolution
): string {
  const lines: string[] = []

  lines.push('# Conflict Resolution Report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Strategy: ${resolution.strategy}`)
  lines.push(`Total Conflicts: ${conflicts.length}`)
  lines.push('')

  if (conflicts.length === 0) {
    lines.push('No conflicts detected.')
    return lines.join('\n')
  }

  if (resolution.requiresManualResolution) {
    lines.push('## Manual Resolution Required')
    lines.push('')
    lines.push('The following conflicts require manual resolution:')
    lines.push('')

    for (const conflict of conflicts) {
      lines.push(`### ${conflict.field}`)
      lines.push(`- Local Value: ${String(conflict.localValue)}`)
      lines.push(`- Remote Value: ${String(conflict.remoteValue)}`)
      lines.push(`- Local Updated: ${conflict.localTimestamp}`)
      lines.push(`- Remote Updated: ${conflict.remoteTimestamp}`)
      lines.push('')
    }

    return lines.join('\n')
  }

  lines.push('## Conflicts Detected')
  lines.push('')

  for (const conflict of conflicts) {
    lines.push(`### ${conflict.field}`)
    lines.push(`- Local: ${String(conflict.localValue)} (${conflict.localTimestamp})`)
    lines.push(`- Remote: ${String(conflict.remoteValue)} (${conflict.remoteTimestamp})`)
    lines.push('')
  }

  lines.push('## Resolution Applied')
  lines.push('')

  for (const resolved of resolution.resolvedConflicts) {
    lines.push(
      `- **${resolved.field}**: Using ${resolved.winner} value → ${String(resolved.value)}`
    )
  }

  lines.push('')
  lines.push('## Resolved Data')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(resolution.resolvedData, null, 2))
  lines.push('```')

  return lines.join('\n')
}
