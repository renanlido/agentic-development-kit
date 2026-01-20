import path from 'node:path'
import fs from 'fs-extra'
import { getFeaturePath, getMainRepoPath, isInWorktree } from './git-paths'

function getWorktreeProgressPath(featureName: string): string | null {
  const mainRepo = getMainRepoPath()
  const featureSlug = featureName.replace(/[^a-zA-Z0-9-]/g, '-')

  if (isInWorktree()) {
    const cwd = process.cwd()
    if (cwd.includes('.worktrees/' + featureSlug) || cwd.includes('.worktrees\\' + featureSlug)) {
      return path.join(cwd, '.claude', 'plans', 'features', featureName, 'progress.md')
    }
  }

  const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)
  const worktreeProgressPath = path.join(
    worktreeDir,
    '.claude',
    'plans',
    'features',
    featureName,
    'progress.md'
  )

  return worktreeProgressPath
}

async function getFileModTime(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath)
    return stats.mtimeMs
  } catch {
    return 0
  }
}

async function syncProgressFiles(
  mainPath: string,
  worktreePath: string | null
): Promise<{ newestPath: string; needsSync: boolean }> {
  if (!worktreePath) {
    return { newestPath: mainPath, needsSync: false }
  }

  const mainExists = await fs.pathExists(mainPath)
  const worktreeExists = await fs.pathExists(worktreePath)

  if (!mainExists && !worktreeExists) {
    return { newestPath: mainPath, needsSync: false }
  }

  if (mainExists && !worktreeExists) {
    return { newestPath: mainPath, needsSync: false }
  }

  if (!mainExists && worktreeExists) {
    const content = await fs.readFile(worktreePath, 'utf-8')
    await fs.ensureDir(path.dirname(mainPath))
    await fs.writeFile(mainPath, content)
    return { newestPath: mainPath, needsSync: false }
  }

  const mainModTime = await getFileModTime(mainPath)
  const worktreeModTime = await getFileModTime(worktreePath)

  if (worktreeModTime > mainModTime) {
    const content = await fs.readFile(worktreePath, 'utf-8')
    await fs.writeFile(mainPath, content)
    return { newestPath: mainPath, needsSync: false }
  }

  if (mainModTime > worktreeModTime) {
    const content = await fs.readFile(mainPath, 'utf-8')
    await fs.ensureDir(path.dirname(worktreePath))
    await fs.writeFile(worktreePath, content)
  }

  return { newestPath: mainPath, needsSync: false }
}

export interface StepProgress {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  notes?: string
}

export interface FeatureProgress {
  feature: string
  currentPhase: string
  steps: StepProgress[]
  lastUpdated: string
  nextStep?: string
}

const DEFAULT_STEPS: StepProgress[] = [
  { name: 'prd', status: 'pending' },
  { name: 'research', status: 'pending' },
  { name: 'tasks', status: 'pending' },
  { name: 'arquitetura', status: 'pending' },
  { name: 'implementacao', status: 'pending' },
  { name: 'qa', status: 'pending' },
  { name: 'docs', status: 'pending' },
  { name: 'finish', status: 'pending' },
]

function getProgressPath(featureName: string): string {
  return getFeaturePath(featureName, 'progress.md')
}

function parseProgressFile(content: string): FeatureProgress | null {
  const featureMatch = content.match(/^# Progress: (.+)$/m)
  if (!featureMatch) {
    return null
  }

  const feature = featureMatch[1]

  const phaseMatch = content.match(/- \*\*Phase\*\*: (.+)$/m)
  const currentPhase = phaseMatch ? phaseMatch[1] : 'unknown'

  const nextStepMatch = content.match(/- \*\*Next Step\*\*: (.+)$/m)
  const nextStep = nextStepMatch ? nextStepMatch[1] : undefined

  const lastUpdatedMatch = content.match(/> Last updated: (.+)$/m)
  const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : new Date().toISOString()

  const steps: StepProgress[] = []
  const stepRegex = /- \[([ x~!])\] \*\*(\w+)\*\*(?:\s*\(([^)]+)\))?/g

  for (const match of content.matchAll(stepRegex)) {
    const [, statusChar, name, details] = match
    let status: StepProgress['status'] = 'pending'

    if (statusChar === 'x') {
      status = 'completed'
    } else if (statusChar === '~') {
      status = 'in_progress'
    } else if (statusChar === '!') {
      status = 'failed'
    }

    const step: StepProgress = { name, status }

    if (details) {
      if (details.includes('completed:')) {
        step.completedAt = details.match(/completed: ([^\s,]+)/)?.[1]
      }
      if (details.includes('started:')) {
        step.startedAt = details.match(/started: ([^\s,]+)/)?.[1]
      }
      if (details.includes('failed:')) {
        step.notes = details.match(/failed: (.+)/)?.[1]
      }
    }

    steps.push(step)
  }

  if (steps.length === 0) {
    return {
      feature,
      currentPhase,
      steps: DEFAULT_STEPS.map((s) => ({ ...s })),
      lastUpdated,
      nextStep,
    }
  }

  return { feature, currentPhase, steps, lastUpdated, nextStep }
}

function formatProgressFile(progress: FeatureProgress): string {
  const lines: string[] = [
    `# Progress: ${progress.feature}`,
    '',
    `> Last updated: ${progress.lastUpdated}`,
    '',
    '## Current State',
    `- **Phase**: ${progress.currentPhase}`,
  ]

  if (progress.nextStep) {
    lines.push(`- **Next Step**: ${progress.nextStep}`)
  }

  lines.push('', '## Steps')

  for (const step of progress.steps) {
    let statusChar = ' '
    let details = ''

    switch (step.status) {
      case 'completed':
        statusChar = 'x'
        if (step.completedAt) {
          details = `completed: ${step.completedAt}`
        }
        break
      case 'in_progress':
        statusChar = '~'
        if (step.startedAt) {
          details = `started: ${step.startedAt}`
        }
        break
      case 'failed':
        statusChar = '!'
        details = step.notes ? `failed: ${step.notes}` : 'failed'
        break
      case 'pending':
        statusChar = ' '
        break
    }

    const detailsPart = details ? ` (${details})` : ''
    lines.push(`- [${statusChar}] **${step.name}**${detailsPart}`)
  }

  lines.push('')

  return lines.join('\n')
}

export async function loadProgress(featureName: string): Promise<FeatureProgress> {
  const mainPath = getProgressPath(featureName)
  const worktreePath = getWorktreeProgressPath(featureName)

  await syncProgressFiles(mainPath, worktreePath)

  if (await fs.pathExists(mainPath)) {
    const content = await fs.readFile(mainPath, 'utf-8')
    const parsed = parseProgressFile(content)
    if (parsed) {
      return parsed
    }
  }

  return {
    feature: featureName,
    currentPhase: 'not_started',
    steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    lastUpdated: new Date().toISOString(),
  }
}

export async function saveProgress(featureName: string, progress: FeatureProgress): Promise<void> {
  const mainPath = getProgressPath(featureName)
  const worktreePath = getWorktreeProgressPath(featureName)
  progress.lastUpdated = new Date().toISOString()

  const content = formatProgressFile(progress)

  await fs.ensureDir(path.dirname(mainPath))
  await fs.writeFile(mainPath, content)

  if (worktreePath && worktreePath !== mainPath) {
    try {
      await fs.ensureDir(path.dirname(worktreePath))
      await fs.writeFile(worktreePath, content)
    } catch {
      // Ignore errors syncing to worktree
    }
  }
}

export function updateStepStatus(
  progress: FeatureProgress,
  stepName: string,
  status: StepProgress['status'],
  notes?: string
): FeatureProgress {
  const now = new Date().toISOString().split('T')[0]

  const steps = progress.steps.map((step) => {
    if (step.name === stepName) {
      const updated: StepProgress = { ...step, status }

      if (status === 'in_progress') {
        updated.startedAt = now
      } else if (status === 'completed') {
        updated.completedAt = now
      } else if (status === 'failed' && notes) {
        updated.notes = notes
      }

      return updated
    }
    return step
  })

  const inProgressStep = steps.find((s) => s.status === 'in_progress')
  const currentPhase = inProgressStep?.name || stepName

  const currentIndex = steps.findIndex((s) => s.name === stepName)
  const nextPending = steps.slice(currentIndex + 1).find((s) => s.status === 'pending')

  return {
    ...progress,
    steps,
    currentPhase,
    nextStep: nextPending?.name,
  }
}

export function getNextStep(progress: FeatureProgress): string | null {
  const pendingStep = progress.steps.find((s) => s.status === 'pending')
  const inProgressStep = progress.steps.find((s) => s.status === 'in_progress')

  return inProgressStep?.name || pendingStep?.name || null
}

export function isStepCompleted(progress: FeatureProgress, stepName: string): boolean {
  const step = progress.steps.find((s) => s.name === stepName)
  return step?.status === 'completed'
}

export function getCompletedSteps(progress: FeatureProgress): string[] {
  return progress.steps.filter((s) => s.status === 'completed').map((s) => s.name)
}
