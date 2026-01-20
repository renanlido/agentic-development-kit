import type { LocalFeature, RemoteFeature } from '../../types/provider.js'
import type { ClickUpTask, CreateTaskPayload, UpdateTaskPayload } from './types.js'
import { ADK_PHASE_TO_CLICKUP_STATUS, CLICKUP_STATUS_TO_ADK_PHASE } from './types.js'

export function phaseToStatus(phase: string): string {
  return ADK_PHASE_TO_CLICKUP_STATUS[phase.toLowerCase()] || 'to do'
}

export function statusToPhase(status: string): string {
  const normalizedStatus = status.toLowerCase()
  return CLICKUP_STATUS_TO_ADK_PHASE[normalizedStatus] || 'prd'
}

export function progressToCustomField(progress: number): { value: number } {
  const clampedValue = Math.max(0, Math.min(100, progress))
  return { value: clampedValue }
}

export function featureToTask(feature: LocalFeature): CreateTaskPayload {
  const status = phaseToStatus(feature.phase)

  let description = `**ADK Feature:** ${feature.name}\n\n`
  description += `**Phase:** ${feature.phase}\n`
  description += `**Progress:** ${feature.progress}%\n`
  description += `**Last Updated:** ${feature.lastUpdated}\n`

  if (feature.prdPath) {
    description += `\n**PRD:** \`${feature.prdPath}\`\n`
  }
  if (feature.tasksPath) {
    description += `**Tasks:** \`${feature.tasksPath}\`\n`
  }
  if (feature.researchPath) {
    description += `**Research:** \`${feature.researchPath}\`\n`
  }
  if (feature.planPath) {
    description += `**Plan:** \`${feature.planPath}\`\n`
  }

  return {
    name: feature.name,
    description,
    status,
  }
}

export function featureToUpdatePayload(feature: Partial<LocalFeature>): UpdateTaskPayload {
  const payload: UpdateTaskPayload = {}

  if (feature.name) {
    payload.name = feature.name
  }

  if (feature.phase) {
    payload.status = phaseToStatus(feature.phase)
  }

  return payload
}

export function taskToFeature(task: ClickUpTask): RemoteFeature {
  const phase = statusToPhase(task.status.status)

  return {
    id: task.id,
    name: task.name,
    description: task.description || undefined,
    status: task.status.status,
    phase,
    progress: extractProgressFromTask(task),
    url: task.url,
    createdAt: formatTimestamp(task.date_created),
    updatedAt: formatTimestamp(task.date_updated),
    metadata: {
      customId: task.custom_id,
      teamId: task.team_id,
      listId: task.list?.id,
      spaceId: task.space?.id,
    },
  }
}

function extractProgressFromTask(task: ClickUpTask): number | undefined {
  const progressField = task.custom_fields?.find(
    (f) => f.type === 'manual_progress' || f.type === 'automatic_progress'
  )

  if (progressField?.value !== undefined) {
    return Number(progressField.value)
  }

  return undefined
}

function formatTimestamp(timestamp: string): string {
  const ms = Number.parseInt(timestamp, 10)
  if (Number.isNaN(ms)) {
    return timestamp
  }
  return new Date(ms).toISOString()
}

export function createTaskFromFeature(
  feature: LocalFeature,
  options?: { priority?: number; tags?: string[] }
): CreateTaskPayload {
  const basePayload = featureToTask(feature)

  return {
    ...basePayload,
    ...(options?.priority && { priority: options.priority }),
    ...(options?.tags && { tags: options.tags }),
  }
}
