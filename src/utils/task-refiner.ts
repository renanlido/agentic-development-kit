import path from 'node:path'
import fs from 'fs-extra'
import type { TaskState } from '../types/progress-sync'
import type { TaskRefineResult } from '../types/refine'
import { getFeaturePath } from './git-paths'
import { parseTasksFile, serializeTasksMarkdown } from './task-parser'

export function statusToMark(status: TaskState['status']): string {
  switch (status) {
    case 'completed':
      return 'x'
    case 'in_progress':
      return '~'
    case 'blocked':
      return '!'
    default:
      return ' '
  }
}

export function analyzeTasksForRefinement(tasks: TaskState[]): {
  canRefineAll: boolean
  pendingTasks: TaskState[]
  preservedTasks: TaskState[]
  stats: TaskRefineResult['summary']
} {
  const completed = tasks.filter((t) => t.status === 'completed')
  const inProgress = tasks.filter((t) => t.status === 'in_progress')
  const pending = tasks.filter((t) => t.status === 'pending')
  const blocked = tasks.filter((t) => t.status === 'blocked')

  const started = [...completed, ...inProgress]
  const canRefineAll = started.length === 0

  return {
    canRefineAll,
    pendingTasks: [...pending, ...blocked],
    preservedTasks: started,
    stats: {
      tasksRefined: 0,
      tasksAdded: 0,
      tasksPreserved: started.length,
    },
  }
}

export async function loadTasksForFeature(featureName: string): Promise<{
  tasks: TaskState[]
  raw: string
  path: string
}> {
  const featurePath = getFeaturePath(featureName)
  const tasksPath = path.join(featurePath, 'tasks.md')

  if (!(await fs.pathExists(tasksPath))) {
    return { tasks: [], raw: '', path: tasksPath }
  }

  const content = await fs.readFile(tasksPath, 'utf-8')
  const parsed = parseTasksFile(content)

  return {
    tasks: parsed.tasks,
    raw: content,
    path: tasksPath,
  }
}

export function buildRefineTasksPrompt(
  featureName: string,
  context: string,
  preserved: TaskState[],
  toRefine: TaskState[],
  prdContent?: string,
  researchContent?: string
): string {
  const preservedSection =
    preserved.length > 0
      ? `## Tasks Preservadas (NAO MODIFICAR - ja iniciadas/completadas)
${preserved.map((t) => `- [${statusToMark(t.status)}] ${t.priority !== undefined ? `P${t.priority}: ` : ''}${t.name}${t.notes ? ` (${t.notes})` : ''}`).join('\n')}`
      : ''

  const toRefineSection =
    toRefine.length > 0
      ? `## Tasks para Refinar
${toRefine.map((t) => `- [ ] ${t.priority !== undefined ? `P${t.priority}: ` : ''}${t.name}`).join('\n')}`
      : '## Tasks Atuais\nNenhuma task pendente para refinar.'

  const prdSection = prdContent
    ? `## PRD da Feature
${prdContent.substring(0, 2000)}${prdContent.length > 2000 ? '\n...[truncado]' : ''}`
    : ''

  const researchSection = researchContent
    ? `## Research da Feature
${researchContent.substring(0, 1500)}${researchContent.length > 1500 ? '\n...[truncado]' : ''}`
    : ''

  return `FASE: REFINAMENTO DE TASKS

Feature: ${featureName}

## Contexto Adicional do Usuario
${context}

${prdSection}

${researchSection}

${preservedSection}

${toRefineSection}

## Sua Tarefa

1. Analise o contexto adicional fornecido pelo usuario
2. Identifique gaps ou cenarios nao cobertos pelas tasks atuais
3. Refine as tasks pendentes se necessario (melhorar descricao, ajustar escopo)
4. Adicione NOVAS tasks para cobrir cenarios faltantes
5. Use prefixo [REFINAMENTO] para novas tasks adicionadas

## Regras Importantes

- NAO remova ou modifique tasks ja completadas ou em progresso
- Mantenha a estrutura markdown com checkboxes
- Cada task deve ser atomica e testavel
- Adicione prioridades (P0-P4) quando relevante
- Agrupe tasks por fase quando fizer sentido

## Output Esperado

Gere APENAS o conteudo do arquivo tasks.md atualizado no formato:

\`\`\`markdown
# Tasks: ${featureName}

## Tasks Preservadas
[copie as tasks preservadas exatamente como estao]

## Tasks Refinadas
[tasks pendentes refinadas]

## Tasks Adicionadas em Refinamento
[novas tasks com prefixo [REFINAMENTO]]

**Acceptance Criteria:**
- [ ] Criterios atualizados
\`\`\`
`
}

export function parseRefineResponse(
  response: string,
  preserved: TaskState[]
): TaskRefineResult {
  const markdownMatch = response.match(/```markdown\n([\s\S]*?)\n```/)
  const content = markdownMatch ? markdownMatch[1] : response

  const parsed = parseTasksFile(content)

  const newTasks = parsed.tasks.filter((t) =>
    t.name.includes('[REFINAMENTO]') ||
    t.notes?.includes('refinamento')
  )

  const refinedExisting = parsed.tasks.filter((t) =>
    !t.name.includes('[REFINAMENTO]') &&
    !preserved.some((p) => p.name === t.name)
  )

  return {
    preservedTasks: preserved,
    updatedTasks: refinedExisting,
    newTasks,
    summary: {
      tasksPreserved: preserved.length,
      tasksRefined: refinedExisting.length,
      tasksAdded: newTasks.length,
    },
  }
}

export function mergeRefinedTasks(
  preserved: TaskState[],
  refined: TaskState[],
  newTasks: TaskState[]
): TaskState[] {
  return [...preserved, ...refined, ...newTasks]
}

export async function saveRefinedTasks(
  featureName: string,
  result: TaskRefineResult
): Promise<void> {
  const featurePath = getFeaturePath(featureName)
  const tasksPath = path.join(featurePath, 'tasks.md')

  const allTasks = mergeRefinedTasks(
    result.preservedTasks,
    result.updatedTasks,
    result.newTasks
  )

  const content = serializeTasksMarkdown({
    tasks: allTasks,
    acceptanceCriteria: [],
  })

  const header = `# Tasks: ${featureName}

> Refinado em: ${new Date().toISOString()}
> Tasks preservadas: ${result.summary.tasksPreserved}
> Tasks refinadas: ${result.summary.tasksRefined}
> Tasks adicionadas: ${result.summary.tasksAdded}

`

  await fs.writeFile(tasksPath, header + content)
}
