import fs from 'node:fs/promises'
import path from 'node:path'
import type { Decision, DecisionCategory } from '../types/memory.js'

const DECISIONS_DIR = '.claude/memory/decisions'

function generateDecisionId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const timestamp = Date.now().toString(36)
  return `${slug}-${timestamp}`
}

function serializeDecisionToMarkdown(decision: Decision): string {
  const frontmatter = [
    '---',
    `id: ${decision.id}`,
    `title: "${decision.title}"`,
    `category: ${decision.category}`,
    `tags: [${decision.tags.map((t) => `"${t}"`).join(', ')}]`,
    `relatedFeatures: [${decision.relatedFeatures.map((f) => `"${f}"`).join(', ')}]`,
    `createdAt: ${decision.createdAt}`,
    `updatedAt: ${decision.updatedAt}`,
    '---',
  ].join('\n')

  const body = [
    `# ${decision.title}`,
    '',
    '## Context',
    decision.context,
    '',
    '## Alternatives Considered',
    ...decision.alternatives.map((alt) => `- ${alt}`),
    '',
    '## Decision',
    decision.chosen,
    '',
    '## Rationale',
    decision.rationale,
  ].join('\n')

  return `${frontmatter}\n\n${body}\n`
}

function parseMarkdownToDecision(content: string): Decision | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) {
    return null
  }

  const frontmatter = frontmatterMatch[1]
  const body = content.slice(frontmatterMatch[0].length)

  const getValue = (key: string): string => {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
    return match ? match[1].replace(/^["']|["']$/g, '') : ''
  }

  const getArray = (key: string): string[] => {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*\\[(.*)\\]$`, 'm'))
    if (!match) {
      return []
    }
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  const getSection = (header: string): string => {
    const regex = new RegExp(`## ${header}\\n([\\s\\S]*?)(?=\\n## |$)`)
    const match = body.match(regex)
    return match ? match[1].trim() : ''
  }

  const getListSection = (header: string): string[] => {
    const section = getSection(header)
    return section
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2))
  }

  return {
    id: getValue('id'),
    title: getValue('title'),
    category: getValue('category') as DecisionCategory,
    tags: getArray('tags'),
    relatedFeatures: getArray('relatedFeatures'),
    createdAt: getValue('createdAt'),
    updatedAt: getValue('updatedAt'),
    context: getSection('Context'),
    alternatives: getListSection('Alternatives Considered'),
    chosen: getSection('Decision'),
    rationale: getSection('Rationale'),
  }
}

export async function ensureDecisionsDir(): Promise<void> {
  await fs.mkdir(DECISIONS_DIR, { recursive: true })
}

export async function saveDecision(decision: Decision): Promise<void> {
  await ensureDecisionsDir()

  if (!decision.id) {
    decision.id = generateDecisionId(decision.title)
  }

  if (!decision.createdAt) {
    decision.createdAt = new Date().toISOString()
  }
  decision.updatedAt = new Date().toISOString()

  const filename = `${decision.id}.md`
  const filepath = path.join(DECISIONS_DIR, filename)
  const content = serializeDecisionToMarkdown(decision)

  await fs.writeFile(filepath, content, 'utf-8')
}

export async function loadDecision(id: string): Promise<Decision | null> {
  try {
    const filepath = path.join(DECISIONS_DIR, `${id}.md`)
    const content = await fs.readFile(filepath, 'utf-8')
    return parseMarkdownToDecision(content)
  } catch {
    return null
  }
}

export async function listDecisions(category?: DecisionCategory): Promise<Decision[]> {
  try {
    await ensureDecisionsDir()
    const files = await fs.readdir(DECISIONS_DIR)
    const decisions: Decision[] = []

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue
      }

      const filepath = path.join(DECISIONS_DIR, file)
      const content = await fs.readFile(filepath, 'utf-8')
      const decision = parseMarkdownToDecision(content)

      if (decision) {
        if (!category || decision.category === category) {
          decisions.push(decision)
        }
      }
    }

    return decisions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  } catch {
    return []
  }
}

export async function deleteDecision(id: string): Promise<boolean> {
  try {
    const filepath = path.join(DECISIONS_DIR, `${id}.md`)
    await fs.unlink(filepath)
    return true
  } catch {
    return false
  }
}

export async function updateDecisionFeatures(
  id: string,
  featureName: string,
  action: 'add' | 'remove'
): Promise<boolean> {
  const decision = await loadDecision(id)
  if (!decision) {
    return false
  }

  if (action === 'add' && !decision.relatedFeatures.includes(featureName)) {
    decision.relatedFeatures.push(featureName)
  } else if (action === 'remove') {
    decision.relatedFeatures = decision.relatedFeatures.filter((f) => f !== featureName)
  }

  await saveDecision(decision)
  return true
}

export function createDecision(
  title: string,
  context: string,
  alternatives: string[],
  chosen: string,
  rationale: string,
  category: DecisionCategory,
  tags: string[] = []
): Decision {
  return {
    id: generateDecisionId(title),
    title,
    context,
    alternatives,
    chosen,
    rationale,
    category,
    tags,
    relatedFeatures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
