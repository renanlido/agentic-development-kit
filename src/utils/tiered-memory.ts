import path from 'node:path'
import fs from 'fs-extra'
import type {
  MemoryHierarchy,
  MemoryTier,
  SessionEntry,
  SessionMemory,
  TieredMemory,
} from '../types/context.js'
import { getClaudePath, getFeaturesBasePath } from './git-paths.js'

const FRESHNESS_DECAY_DAYS = 30
const MIN_FRESHNESS_SCORE = 5

/**
 * Carrega hierarquia completa de memoria em 4 niveis.
 * Project memory sempre carregado se existir.
 * Feature e phase memory carregados apenas se parametros fornecidos.
 *
 * @param feature - Nome da feature (opcional)
 * @param phase - Nome da fase (opcional, requer feature)
 * @returns Hierarquia com todos niveis disponiveis
 */
export async function loadMemoryHierarchy(
  feature?: string,
  phase?: string
): Promise<MemoryHierarchy> {
  const hierarchy: MemoryHierarchy = {
    session: createEmptySession(),
  }

  const projectMemory = await loadProjectMemory()
  if (projectMemory) {
    hierarchy.project = projectMemory
  }

  if (feature) {
    const featureMemory = await loadFeatureMemory(feature)
    if (featureMemory) {
      hierarchy.feature = featureMemory
    }

    if (phase) {
      const phaseMemory = await loadPhaseMemory(feature, phase)
      if (phaseMemory) {
        hierarchy.phase = phaseMemory
      }
    }
  }

  return hierarchy
}

async function loadProjectMemory(): Promise<TieredMemory | undefined> {
  const memoryPath = getClaudePath('memory/project-context.md')

  if (!(await fs.pathExists(memoryPath))) {
    return undefined
  }

  const content = await fs.readFile(memoryPath, 'utf-8')
  const stat = await fs.stat(memoryPath)

  return createTieredMemory('project', content, stat.mtime)
}

async function loadFeatureMemory(feature: string): Promise<TieredMemory | undefined> {
  const memoryPath = path.join(getFeaturesBasePath(), feature, 'memory.md')

  if (!(await fs.pathExists(memoryPath))) {
    return undefined
  }

  const content = await fs.readFile(memoryPath, 'utf-8')
  const stat = await fs.stat(memoryPath)

  return createTieredMemory('feature', content, stat.mtime)
}

async function loadPhaseMemory(feature: string, phase: string): Promise<TieredMemory | undefined> {
  const memoryPath = path.join(getFeaturesBasePath(), feature, phase, 'memory.md')

  if (!(await fs.pathExists(memoryPath))) {
    return undefined
  }

  const content = await fs.readFile(memoryPath, 'utf-8')
  const stat = await fs.stat(memoryPath)

  return createTieredMemory('phase', content, stat.mtime)
}

function createTieredMemory(tier: MemoryTier, content: string, modifiedAt: Date): TieredMemory {
  const updatedAt = modifiedAt.toISOString()

  return {
    tier,
    content,
    metadata: {
      createdAt: updatedAt,
      updatedAt,
      lineCount: content.split('\n').length,
      freshnessScore: calculateFreshnessScore(updatedAt),
      relevanceScore: 50,
      usageCount: 0,
    },
  }
}

function createEmptySession(): SessionMemory {
  return {
    entries: [],
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Combina todos niveis de memoria em um unico contexto.
 * Prioridade: Session (4) > Phase (3) > Feature (2) > Project (1)
 * Remove linhas duplicadas mantendo apenas a primeira ocorrencia.
 *
 * @param hierarchy - Hierarquia de memoria carregada
 * @returns String com conteudo combinado e deduplicado
 */
export function flattenHierarchy(hierarchy: MemoryHierarchy): string {
  const sections: Array<{ content: string; priority: number }> = []

  if (hierarchy.session.entries.length > 0) {
    const sessionContent = hierarchy.session.entries.map((e) => e.content).join('\n\n')
    sections.push({ content: sessionContent, priority: 4 })
  }

  if (hierarchy.phase) {
    sections.push({ content: hierarchy.phase.content, priority: 3 })
  }

  if (hierarchy.feature) {
    sections.push({ content: hierarchy.feature.content, priority: 2 })
  }

  if (hierarchy.project) {
    sections.push({ content: hierarchy.project.content, priority: 1 })
  }

  sections.sort((a, b) => b.priority - a.priority)

  const seen = new Set<string>()
  const dedupedLines: string[] = []

  for (const section of sections) {
    const lines = section.content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed)
        dedupedLines.push(line)
      } else if (!trimmed) {
        dedupedLines.push(line)
      }
    }
    dedupedLines.push('')
  }

  return dedupedLines.join('\n').trim()
}

export function calculateFreshnessScore(updatedAt: string): number {
  const now = Date.now()
  const updated = new Date(updatedAt).getTime()
  const ageInDays = (now - updated) / (1000 * 60 * 60 * 24)

  if (ageInDays <= 1) {
    return 100
  }

  const decay = Math.min(ageInDays / FRESHNESS_DECAY_DAYS, 1)
  const score = 100 * (1 - decay * 0.9)

  return Math.max(Math.round(score), MIN_FRESHNESS_SCORE)
}

export class SessionMemoryCache {
  private cache: Map<string, SessionEntry> = new Map()

  add(key: string, content: string): void {
    this.cache.set(key, {
      key,
      content,
      timestamp: new Date().toISOString(),
      usageCount: 0,
    })
  }

  get(key: string): SessionEntry | undefined {
    const entry = this.cache.get(key)

    if (entry) {
      entry.usageCount++
      return entry
    }

    return undefined
  }

  listEntries(): SessionEntry[] {
    return Array.from(this.cache.values())
  }

  clear(): void {
    this.cache.clear()
  }

  async flush(toPath: string): Promise<void> {
    const entries = this.listEntries()

    if (entries.length === 0) {
      return
    }

    const lines = ['# Session Memory', '', `> Flushed: ${new Date().toISOString()}`, '']

    for (const entry of entries) {
      lines.push(`## ${entry.key}`)
      lines.push('')
      lines.push(entry.content)
      lines.push('')
    }

    await fs.ensureDir(path.dirname(toPath))
    await fs.writeFile(toPath, lines.join('\n'))
  }
}
