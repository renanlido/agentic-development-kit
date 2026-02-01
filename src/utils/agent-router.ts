import path from 'node:path'
import fs from 'fs-extra'
import { ModelType } from '../types/model'
import type { EnhancedTask, TaskComplexity } from '../types/parallel'
import { type TaskCategory, categorizeTask } from './task-parser'

export type TaskType =
  | 'Feature'
  | 'Refactor'
  | 'Bugfix'
  | 'Config'
  | 'Docs'
  | 'Test'
  | 'UnitTest'
  | 'IntegrationTest'
  | 'E2ETest'

export type AgentType =
  | 'feature-developer'
  | 'unit-test-specialist'
  | 'e2e-test-specialist'
  | 'implementer'
  | 'tester'
  | 'documenter'
  | 'reviewer'
  | 'general-purpose'

export interface AgentConfig {
  name: AgentType
  description: string
  model: ModelType
  promptPath: string
}

export interface AgentSelectionResult {
  agentType: AgentType
  model: ModelType
  config: AgentConfig
}

export function selectModelForTask(task: EnhancedTask): ModelType {
  if (task.modelOverride) {
    return task.modelOverride
  }

  const category = categorizeTask(task.title, task.type)
  if (category === 'implementation') {
    return ModelType.OPUS
  }

  const agentConfig = getAgentConfig(task.agentType as AgentType)
  if (agentConfig?.model) {
    return agentConfig.model
  }

  return task.complexity.recommendedModel
}

export function getAgentConfig(agentType: AgentType): AgentConfig | null {
  const configs: Record<AgentType, AgentConfig> = {
    'feature-developer': {
      name: 'feature-developer',
      description: 'Especialista em desenvolvimento de codigo de producao',
      model: ModelType.OPUS,
      promptPath: 'agents/specialists/feature-developer.md',
    },
    'unit-test-specialist': {
      name: 'unit-test-specialist',
      description: 'Especialista em testes unitarios e de integracao',
      model: ModelType.SONNET,
      promptPath: 'agents/specialists/unit-test-specialist.md',
    },
    'e2e-test-specialist': {
      name: 'e2e-test-specialist',
      description: 'Especialista em testes end-to-end',
      model: ModelType.SONNET,
      promptPath: 'agents/specialists/e2e-test-specialist.md',
    },
    implementer: {
      name: 'implementer',
      description: 'Implementador TDD generico',
      model: ModelType.OPUS,
      promptPath: 'agents/implementer.md',
    },
    tester: {
      name: 'tester',
      description: 'Testador generico',
      model: ModelType.SONNET,
      promptPath: 'agents/tester.md',
    },
    documenter: {
      name: 'documenter',
      description: 'Especialista em documentacao',
      model: ModelType.SONNET,
      promptPath: 'agents/documenter.md',
    },
    reviewer: {
      name: 'reviewer',
      description: 'Revisor de codigo e qualidade',
      model: ModelType.HAIKU,
      promptPath: 'agents/reviewer.md',
    },
    'general-purpose': {
      name: 'general-purpose',
      description: 'Agente de proposito geral',
      model: ModelType.OPUS,
      promptPath: 'agents/general.md',
    },
  }

  return configs[agentType] || null
}

export function getAgentForTaskCategory(category: TaskCategory): AgentSelectionResult {
  switch (category) {
    case 'implementation':
      return {
        agentType: 'feature-developer',
        model: ModelType.OPUS,
        config: getAgentConfig('feature-developer')!,
      }
    case 'testing':
      return {
        agentType: 'unit-test-specialist',
        model: ModelType.SONNET,
        config: getAgentConfig('unit-test-specialist')!,
      }
    case 'review':
      return {
        agentType: 'reviewer',
        model: ModelType.HAIKU,
        config: getAgentConfig('reviewer')!,
      }
    default:
      return {
        agentType: 'general-purpose',
        model: ModelType.OPUS,
        config: getAgentConfig('general-purpose')!,
      }
  }
}

export function selectAgentAndModel(
  taskTitle: string,
  taskType?: string,
  complexity?: TaskComplexity
): AgentSelectionResult {
  const category = categorizeTask(taskTitle, taskType)
  const result = getAgentForTaskCategory(category)

  if (category === 'implementation') {
    result.model = ModelType.OPUS
  } else if (complexity && category !== 'review') {
    result.model = complexity.recommendedModel
  }

  return result
}

export function upgradeModelForRetry(currentModel: ModelType): ModelType {
  if (currentModel === ModelType.HAIKU) {
    return ModelType.SONNET
  }
  return ModelType.OPUS
}

export interface TaskAgentMapping {
  taskType: TaskType
  agent: AgentType
  model: ModelType
  keywords: string[]
}

const TASK_AGENT_MAPPINGS: TaskAgentMapping[] = [
  {
    taskType: 'UnitTest',
    agent: 'unit-test-specialist',
    model: ModelType.SONNET,
    keywords: [
      'unit test',
      'teste unitario',
      'unit.test',
      '.unit.test',
      'mock',
      'stub',
      'coverage',
    ],
  },
  {
    taskType: 'IntegrationTest',
    agent: 'unit-test-specialist',
    model: ModelType.SONNET,
    keywords: [
      'integration test',
      'teste de integracao',
      'integration.test',
      '.integration.test',
      'testcontainers',
    ],
  },
  {
    taskType: 'E2ETest',
    agent: 'e2e-test-specialist',
    model: ModelType.SONNET,
    keywords: [
      'e2e',
      'end-to-end',
      'end to end',
      'teste e2e',
      'playwright',
      'cypress',
      'supertest',
      '.e2e.test',
      'scenarios',
    ],
  },
  {
    taskType: 'Test',
    agent: 'unit-test-specialist',
    model: ModelType.SONNET,
    keywords: ['test', 'teste', 'testes', 'testing'],
  },
  {
    taskType: 'Feature',
    agent: 'feature-developer',
    model: ModelType.OPUS,
    keywords: ['feature', 'implementar', 'criar', 'adicionar', 'implement', 'create', 'add'],
  },
  {
    taskType: 'Refactor',
    agent: 'feature-developer',
    model: ModelType.OPUS,
    keywords: ['refactor', 'refatorar', 'extrair', 'extract', 'mover', 'move', 'reorganizar'],
  },
  {
    taskType: 'Bugfix',
    agent: 'feature-developer',
    model: ModelType.OPUS,
    keywords: ['fix', 'bug', 'corrigir', 'correção', 'erro', 'error', 'hotfix'],
  },
  {
    taskType: 'Config',
    agent: 'feature-developer',
    model: ModelType.SONNET,
    keywords: ['config', 'configurar', 'setup', 'ci/cd', 'pipeline', 'devops', 'infra'],
  },
  {
    taskType: 'Docs',
    agent: 'documenter',
    model: ModelType.SONNET,
    keywords: ['doc', 'documentar', 'readme', 'adr', 'documentação', 'documentation'],
  },
]

export function detectTaskType(taskTitle: string, taskContent: string): TaskType {
  const text = `${taskTitle} ${taskContent}`.toLowerCase()

  for (const mapping of TASK_AGENT_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return mapping.taskType
      }
    }
  }

  return 'Feature'
}

export function getAgentForTask(taskType: TaskType): AgentConfig {
  const mapping = TASK_AGENT_MAPPINGS.find((m) => m.taskType === taskType)

  if (!mapping) {
    return {
      name: 'implementer',
      description: 'Agente generico de implementacao',
      model: ModelType.OPUS,
      promptPath: 'agents/implementer.md',
    }
  }

  return {
    name: mapping.agent,
    description: getAgentDescription(mapping.agent),
    model: mapping.model,
    promptPath: getAgentPromptPath(mapping.agent),
  }
}

function getAgentDescription(agent: AgentType): string {
  const descriptions: Record<AgentType, string> = {
    'feature-developer': 'Especialista em desenvolvimento de codigo de producao',
    'unit-test-specialist': 'Especialista em testes unitarios e de integracao',
    'e2e-test-specialist': 'Especialista em testes end-to-end',
    implementer: 'Implementador TDD generico',
    tester: 'Testador generico',
    documenter: 'Especialista em documentacao',
    reviewer: 'Revisor de codigo e qualidade',
    'general-purpose': 'Agente de proposito geral',
  }
  return descriptions[agent]
}

function getAgentPromptPath(agent: AgentType): string {
  const paths: Record<AgentType, string> = {
    'feature-developer': 'agents/specialists/feature-developer.md',
    'unit-test-specialist': 'agents/specialists/unit-test-specialist.md',
    'e2e-test-specialist': 'agents/specialists/e2e-test-specialist.md',
    implementer: 'agents/implementer.md',
    tester: 'agents/tester.md',
    documenter: 'agents/documenter.md',
    reviewer: 'agents/reviewer.md',
    'general-purpose': 'agents/general.md',
  }
  return paths[agent]
}

export async function loadAgentPrompt(agentPath: string): Promise<string | null> {
  const claudePath = path.join(process.cwd(), '.claude', agentPath)

  if (await fs.pathExists(claudePath)) {
    return await fs.readFile(claudePath, 'utf-8')
  }

  return null
}

export interface TaskRoutingDecision {
  taskId: string
  taskTitle: string
  taskType: TaskType
  agent: AgentConfig
  reasoning: string
}

export function routeTask(
  taskId: string,
  taskTitle: string,
  taskContent: string
): TaskRoutingDecision {
  const taskType = detectTaskType(taskTitle, taskContent)
  const agent = getAgentForTask(taskType)

  return {
    taskId,
    taskTitle,
    taskType,
    agent,
    reasoning: `Task "${taskTitle}" identificada como ${taskType}, roteada para ${agent.name}`,
  }
}

export function groupTasksByAgent(
  tasks: Array<{ id: string; title: string; content: string }>
): Map<AgentType, TaskRoutingDecision[]> {
  const groups = new Map<AgentType, TaskRoutingDecision[]>()

  for (const task of tasks) {
    const decision = routeTask(task.id, task.title, task.content)
    const existing = groups.get(decision.agent.name) || []
    existing.push(decision)
    groups.set(decision.agent.name, existing)
  }

  return groups
}

export function formatAgentHeader(agent: AgentConfig): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AGENTE ESPECIALISTA: ${agent.name.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agent.description}
Modelo: ${agent.model}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}
