import path from 'node:path'
import type { MemoryContent, MemoryLimitResult, MemoryPhase } from '../types/memory'
import { MEMORY_LINE_LIMIT, MEMORY_WARNING_THRESHOLD } from '../types/memory'

export function getMemoryPath(feature?: string): string {
  const basePath = process.cwd()

  if (feature) {
    const safeName = feature.replace(/[^a-zA-Z0-9-_]/g, '-')
    return path.join(basePath, '.claude/plans/features', safeName, 'memory.md')
  }

  return path.join(basePath, '.claude/memory/project-context.md')
}

export function getMemoryArchivePath(feature: string): string {
  const basePath = process.cwd()
  const safeName = feature.replace(/[^a-zA-Z0-9-_]/g, '-')
  const date = new Date().toISOString().split('T')[0]
  return path.join(
    basePath,
    '.claude/plans/features',
    safeName,
    'memory-archive',
    `memory-${date}.md`
  )
}

export function countLines(content: string): number {
  if (!content || content.trim() === '') {
    return 0
  }
  return content.split('\n').length
}

export function isMemoryOverLimit(
  content: string,
  limit: number = MEMORY_LINE_LIMIT
): MemoryLimitResult {
  const count = countLines(content)
  return {
    over: count > limit,
    warning: count > limit * MEMORY_WARNING_THRESHOLD,
    count,
  }
}

export function createDefaultMemory(feature: string): MemoryContent {
  return {
    feature,
    lastUpdated: new Date().toISOString(),
    phase: 'research',
    status: 'in_progress',
    summary: '',
    decisions: [],
    patterns: [],
    risks: [],
    state: {
      completed: [],
      inProgress: [],
      pending: [],
    },
    nextSteps: [],
    history: [],
  }
}

export function parseMemoryContent(content: string): MemoryContent {
  if (!content || content.trim() === '') {
    return createDefaultMemory('unknown')
  }

  let feature = 'unknown'
  const featureMatch = content.match(/^#\s*Memoria:\s*(.+)$/m)
  if (featureMatch) {
    feature = featureMatch[1].trim()
  }

  let lastUpdated = new Date().toISOString()
  const dateMatch = content.match(/\*\*Ultima Atualizacao\*\*:\s*(.+)$/m)
  if (dateMatch) {
    lastUpdated = dateMatch[1].trim()
  }

  let phase: MemoryPhase = 'research'
  const phaseMatch = content.match(/\*\*Fase Atual\*\*:\s*(\w+)/m)
  if (phaseMatch) {
    const p = phaseMatch[1].toLowerCase()
    if (['research', 'tasks', 'plan', 'implement', 'qa', 'docs', 'deploy'].includes(p)) {
      phase = p as MemoryPhase
    }
  }

  let status: 'in_progress' | 'blocked' | 'completed' = 'in_progress'
  const statusMatch = content.match(/\*\*Status\*\*:\s*(\w+)/m)
  if (statusMatch) {
    const s = statusMatch[1].toLowerCase()
    if (['in_progress', 'blocked', 'completed'].includes(s)) {
      status = s as 'in_progress' | 'blocked' | 'completed'
    }
  }

  let summary = ''
  const summaryStart = content.indexOf('## Resumo Executivo')
  const summaryEnd = content.indexOf('## ', summaryStart + 1)
  if (summaryStart !== -1) {
    const end = summaryEnd !== -1 ? summaryEnd : content.length
    summary = content
      .slice(summaryStart + '## Resumo Executivo'.length, end)
      .trim()
      .split('\n')
      .filter((l) => l.trim() !== '')
      .join(' ')
  }

  const decisions: MemoryContent['decisions'] = []
  const decisionRegex = /\*\*\[([^\]]+)\]\*\*:\s*([^\n]+)\n\s*-\s*Razao:\s*([^\n]+)/g
  for (const decMatch of content.matchAll(decisionRegex)) {
    decisions.push({
      id: decMatch[1],
      decision: decMatch[2].trim(),
      reason: decMatch[3].trim(),
    })
  }

  const patterns: MemoryContent['patterns'] = []
  const patternRegex = /\*\*([^*]+)\*\*:\s*([^\n]+)\n\s*-\s*Arquivos:\s*([^\n]+)/g
  for (const patMatch of content.matchAll(patternRegex)) {
    if (!patMatch[1].startsWith('[')) {
      patterns.push({
        name: patMatch[1].trim(),
        description: patMatch[2].trim(),
        files: patMatch[3].split(',').map((f) => f.trim()),
      })
    }
  }

  const risks: MemoryContent['risks'] = []
  const risksSection = content.match(/## Riscos e Dependencias[\s\S]*?(?=##|$)/m)
  if (risksSection) {
    const riskLines = risksSection[0].match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)
    if (riskLines) {
      for (const line of riskLines.slice(2)) {
        const parts = line.split('|').map((p) => p.trim())
        if (parts[1] && parts[2] && parts[1] !== '-------' && parts[1] !== 'Risco') {
          risks.push({
            description: parts[1],
            mitigation: parts[2],
          })
        }
      }
    }
  }

  const state: MemoryContent['state'] = {
    completed: [],
    inProgress: [],
    pending: [],
  }

  const completedMatch = content.match(/\*\*Concluido\*\*:\n([\s\S]*?)(?=\*\*|##|$)/m)
  if (completedMatch) {
    state.completed = completedMatch[1]
      .split('\n')
      .filter((l) => l.includes('[x]'))
      .map((l) => l.replace(/^.*\[x\]\s*/, '').trim())
  }

  const progressMatch = content.match(/\*\*Em Progresso\*\*:\n([\s\S]*?)(?=\*\*|##|$)/m)
  if (progressMatch) {
    state.inProgress = progressMatch[1]
      .split('\n')
      .filter((l) => l.includes('[ ]'))
      .map((l) => l.replace(/^.*\[ \]\s*/, '').trim())
  }

  const pendingMatch = content.match(/\*\*Pendente\*\*:\n([\s\S]*?)(?=\*\*|##|$)/m)
  if (pendingMatch) {
    state.pending = pendingMatch[1]
      .split('\n')
      .filter((l) => l.includes('[ ]'))
      .map((l) => l.replace(/^.*\[ \]\s*/, '').trim())
  }

  const nextSteps: string[] = []
  const nextStart = content.indexOf('## Proximos Passos')
  if (nextStart !== -1) {
    let nextEnd = content.indexOf('##', nextStart + 1)
    if (nextEnd === -1) {
      nextEnd = content.length
    }
    const nextSection = content.slice(nextStart, nextEnd)
    const stepLines = nextSection.split('\n')
    for (const line of stepLines) {
      const trimmed = line.trim()
      if (/^\d+\./.test(trimmed)) {
        nextSteps.push(trimmed.replace(/^\d+\.\s*/, ''))
      }
    }
  }

  const history: MemoryContent['history'] = []
  const historyMatch = content.match(
    /## Historico de Fases\n[\s\S]*?\|[\s\S]*?\|([\s\S]*?)(?=##|$)/m
  )
  if (historyMatch) {
    const historyLines = historyMatch[0].match(
      /\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|/g
    )
    if (historyLines) {
      for (const line of historyLines) {
        const parts = line.split('|').map((p) => p.trim())
        if (parts[1] && parts[2] && parts[3]) {
          history.push({
            date: parts[1],
            phase: parts[2] as MemoryPhase,
            result: parts[3] as 'completed' | 'blocked' | 'skipped',
          })
        }
      }
    }
  }

  return {
    feature,
    lastUpdated,
    phase,
    status,
    summary,
    decisions,
    patterns,
    risks,
    state,
    nextSteps,
    history,
  }
}

export function serializeMemoryContent(memory: MemoryContent): string {
  const lines: string[] = []

  lines.push(`# Memoria: ${memory.feature}`)
  lines.push('')
  lines.push(`**Ultima Atualizacao**: ${memory.lastUpdated}`)
  lines.push(`**Fase Atual**: ${memory.phase}`)
  lines.push(`**Status**: ${memory.status}`)
  lines.push('')

  lines.push('## Resumo Executivo')
  lines.push('')
  lines.push(memory.summary || '[Adicione um resumo]')
  lines.push('')

  lines.push('## Decisoes Arquiteturais')
  lines.push('')
  if (memory.decisions.length === 0) {
    lines.push('[Nenhuma decisao registrada]')
  } else {
    for (const d of memory.decisions) {
      lines.push(`- **[${d.id}]**: ${d.decision}`)
      lines.push(`  - Razao: ${d.reason}`)
      lines.push('')
    }
  }
  lines.push('')

  lines.push('## Padroes Identificados')
  lines.push('')
  if (memory.patterns.length === 0) {
    lines.push('[Nenhum padrao identificado]')
  } else {
    for (const p of memory.patterns) {
      lines.push(`- **${p.name}**: ${p.description}`)
      lines.push(`  - Arquivos: ${p.files.join(', ')}`)
      lines.push('')
    }
  }
  lines.push('')

  lines.push('## Riscos e Dependencias')
  lines.push('')
  if (memory.risks.length === 0) {
    lines.push('[Nenhum risco identificado]')
  } else {
    lines.push('| Risco | Mitigacao |')
    lines.push('|-------|-----------|')
    for (const r of memory.risks) {
      lines.push(`| ${r.description} | ${r.mitigation} |`)
    }
  }
  lines.push('')

  lines.push('## Estado Atual')
  lines.push('')
  lines.push('**Concluido**:')
  if (memory.state.completed.length === 0) {
    lines.push('- [Nenhum item concluido]')
  } else {
    for (const item of memory.state.completed) {
      lines.push(`- [x] ${item}`)
    }
  }
  lines.push('')
  lines.push('**Em Progresso**:')
  if (memory.state.inProgress.length === 0) {
    lines.push('- [Nenhum item em progresso]')
  } else {
    for (const item of memory.state.inProgress) {
      lines.push(`- [ ] ${item}`)
    }
  }
  lines.push('')
  lines.push('**Pendente**:')
  if (memory.state.pending.length === 0) {
    lines.push('- [Nenhum item pendente]')
  } else {
    for (const item of memory.state.pending) {
      lines.push(`- [ ] ${item}`)
    }
  }
  lines.push('')

  lines.push('## Proximos Passos')
  lines.push('')
  if (memory.nextSteps.length === 0) {
    lines.push('1. [Definir proximos passos]')
  } else {
    memory.nextSteps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`)
    })
  }
  lines.push('')

  lines.push('## Historico de Fases')
  lines.push('')
  lines.push('| Data | Fase | Resultado |')
  lines.push('|------|------|-----------|')
  if (memory.history.length === 0) {
    lines.push('| - | - | - |')
  } else {
    for (const h of memory.history) {
      lines.push(`| ${h.date} | ${h.phase} | ${h.result} |`)
    }
  }
  lines.push('')

  return lines.join('\n')
}

export function mergeMemoryContent(
  existing: MemoryContent,
  update: Partial<MemoryContent>
): MemoryContent {
  const merged = { ...existing }

  merged.lastUpdated = new Date().toISOString()

  if (update.phase) {
    merged.phase = update.phase
  }
  if (update.status) {
    merged.status = update.status
  }
  if (update.summary) {
    merged.summary = update.summary
  }

  if (update.decisions) {
    const existingIds = new Set(merged.decisions.map((d) => d.id))
    for (const d of update.decisions) {
      if (!existingIds.has(d.id)) {
        merged.decisions.push(d)
      }
    }
  }

  if (update.patterns) {
    const existingNames = new Set(merged.patterns.map((p) => p.name))
    for (const p of update.patterns) {
      if (!existingNames.has(p.name)) {
        merged.patterns.push(p)
      }
    }
  }

  if (update.risks) {
    const existingDescs = new Set(merged.risks.map((r) => r.description))
    for (const r of update.risks) {
      if (!existingDescs.has(r.description)) {
        merged.risks.push(r)
      }
    }
  }

  if (update.state) {
    if (update.state.completed) {
      merged.state.completed = [...new Set([...merged.state.completed, ...update.state.completed])]
    }
    if (update.state.inProgress) {
      merged.state.inProgress = [
        ...new Set([...merged.state.inProgress, ...update.state.inProgress]),
      ]
    }
    if (update.state.pending) {
      merged.state.pending = [...new Set([...merged.state.pending, ...update.state.pending])]
    }
  }

  if (update.nextSteps) {
    merged.nextSteps = update.nextSteps
  }

  if (update.history) {
    merged.history = [...merged.history, ...update.history]
  }

  return merged
}

export function searchInContent(
  content: string,
  query: string,
  contextLines = 3
): { line: number; content: string; context: string[] }[] {
  const results: { line: number; content: string; context: string[] }[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const regex = new RegExp(query, 'gi')
    if (regex.test(lines[i])) {
      const start = Math.max(0, i - contextLines)
      const end = Math.min(lines.length, i + contextLines + 1)
      results.push({
        line: i + 1,
        content: lines[i],
        context: lines.slice(start, end),
      })
    }
  }

  return results
}
