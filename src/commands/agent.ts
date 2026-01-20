import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { executeClaudeCommand } from '../utils/claude.js'
import { getAgentsPath, getClaudePath } from '../utils/git-paths.js'
import { logger } from '../utils/logger.js'
import {
  DEFAULT_PARALLEL_CONFIG,
  executeParallel,
  executeWithFallback,
  formatParallelResult,
} from '../utils/parallel-executor.js'

interface AgentOptions {
  type?: string
  context?: string
  maxAgents?: string
  fallbackSequential?: boolean
  watch?: boolean
}

class AgentCommand {
  async create(name: string, options: AgentOptions): Promise<void> {
    const spinner = ora('Criando agent...').start()

    try {
      const agentsPath = getAgentsPath()
      const agentPath = path.join(agentsPath, `${name}.md`)

      if (await fs.pathExists(agentPath)) {
        spinner.fail(`Agent ${name} já existe`)
        process.exit(1)
      }

      const type = options.type || 'generic'
      const template = this.getAgentTemplate(name, type)

      await fs.writeFile(agentPath, template)

      spinner.succeed(`Agent ${name} criado`)

      console.log()
      logger.success(`Agent criado: ${chalk.cyan(`.claude/agents/${name}.md`)}`)
      console.log()
      console.log(chalk.yellow('Para executar:'))
      console.log(chalk.gray(`  adk agent run ${name}`))
    } catch (error) {
      spinner.fail('Erro ao criar agent')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async run(name: string, options: AgentOptions): Promise<void> {
    const spinner = ora(`Executando agent ${name}...`).start()

    try {
      const agentPath = path.join(getAgentsPath(), `${name}.md`)

      if (!(await fs.pathExists(agentPath))) {
        spinner.fail(`Agent ${name} não encontrado`)
        process.exit(1)
      }

      const agentContent = await fs.readFile(agentPath, 'utf-8')
      const context = options.context || ''

      const prompt = `
Execute agent: ${name}

Agent instructions:
${agentContent}

Additional context:
${context}

Execute the agent tasks and report results.
`

      await executeClaudeCommand(prompt)

      spinner.succeed(`Agent ${name} executado`)
    } catch (error) {
      spinner.fail(`Erro ao executar agent ${name}`)
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async pipeline(feature: string): Promise<void> {
    const spinner = ora('Executando agent pipeline...').start()

    try {
      const agents = ['analyzer', 'optimizer', 'documenter']

      for (const agent of agents) {
        spinner.text = `Executando agent: ${agent}`

        const agentPath = path.join(getAgentsPath(), `${agent}.md`)

        if (await fs.pathExists(agentPath)) {
          await this.run(agent, { context: feature })
        } else {
          logger.warn(`Agent ${agent} não encontrado, pulando...`)
        }
      }

      spinner.succeed('Pipeline concluído')

      console.log()
      logger.success('✨ Agent pipeline executado com sucesso!')
    } catch (error) {
      spinner.fail('Erro no pipeline')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async parallel(feature: string, options: AgentOptions): Promise<void> {
    const spinner = ora('Preparando execução paralela...').start()

    try {
      const agentsPath = getAgentsPath()
      const agents: string[] = []

      if (await fs.pathExists(agentsPath)) {
        const files = await fs.readdir(agentsPath)
        for (const file of files) {
          if (file.endsWith('.md')) {
            agents.push(file.replace('.md', ''))
          }
        }
      }

      if (agents.length === 0) {
        spinner.fail('Nenhum agent encontrado em .claude/agents/')
        process.exit(1)
      }

      const maxAgents = options.maxAgents ? Number.parseInt(options.maxAgents, 10) : 3

      spinner.text = `Executando ${agents.length} agents em paralelo (max ${maxAgents} simultâneos)...`

      const config = {
        ...DEFAULT_PARALLEL_CONFIG,
        maxAgents,
      }

      const result = options.fallbackSequential
        ? await executeWithFallback(agents, feature, config)
        : await executeParallel(agents, feature, config)

      spinner.stop()
      console.log(formatParallelResult(result))

      if (result.success) {
        logger.success('✨ Execução paralela concluída com sucesso!')
      } else {
        logger.error('Execução paralela teve problemas')
        process.exit(1)
      }
    } catch (error) {
      spinner.fail('Erro na execução paralela')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async status(options: AgentOptions): Promise<void> {
    const statusPath = getClaudePath('agent-status.json')

    const displayStatus = async (): Promise<void> => {
      if (!(await fs.pathExists(statusPath))) {
        console.log(chalk.yellow('Nenhum agent em execução'))
        return
      }

      const statuses = JSON.parse(await fs.readFile(statusPath, 'utf-8'))

      console.log(chalk.bold('\n📊 Agent Status\n'))

      if (statuses.length === 0) {
        console.log(chalk.gray('Nenhum agent registrado'))
        return
      }

      for (const status of statuses) {
        const icon =
          status.status === 'completed'
            ? '✅'
            : status.status === 'running'
              ? '🔄'
              : status.status === 'failed'
                ? '❌'
                : '⏳'

        let duration = ''
        if (status.duration) {
          duration = `(${(status.duration / 1000).toFixed(1)}s)`
        } else if (status.startedAt) {
          const elapsed = Date.now() - new Date(status.startedAt).getTime()
          duration = `(${(elapsed / 1000).toFixed(1)}s)`
        }

        console.log(`${icon} ${status.agent} - ${status.feature || 'N/A'} ${duration}`)
        if (status.error) {
          console.log(chalk.red(`   Error: ${status.error}`))
        }
      }
      console.log()
    }

    if (options.watch) {
      console.clear()
      await displayStatus()

      const interval = setInterval(async () => {
        console.clear()
        await displayStatus()
      }, 2000)

      process.on('SIGINT', () => {
        clearInterval(interval)
        process.exit(0)
      })
    } else {
      await displayStatus()
    }
  }

  private getAgentTemplate(name: string, type: string): string {
    const templates: Record<string, string> = {
      analyzer: `---
name: ${name}
description: Analisa código e identifica issues
context: fork
---

# ${name} Agent

Analise o código e identifique:

1. Performance bottlenecks
2. Security vulnerabilities
3. Code smells
4. Technical debt

Output: .claude/analysis/${name}-report.json

Format:
\`\`\`json
{
  "performance": [],
  "security": [],
  "code_quality": [],
  "debt": []
}
\`\`\`
`,

      implementer: `---
name: ${name}
description: Implementa features seguindo TDD
context: fork
---

# ${name} Agent

Implementation workflow:

1. Read specifications
2. Write tests first
3. Implement code
4. Verify all tests pass
5. Refactor if needed
6. Document changes

Always follow TDD principles.
`,

      tester: `---
name: ${name}
description: Cria e executa testes
context: fork
---

# ${name} Agent

Testing workflow:

1. Analyze implementation
2. Write comprehensive tests:
   - Unit tests
   - Integration tests
   - E2E tests
3. Ensure coverage >= 80%
4. Document test strategy

Output: Test files + coverage report
`,

      generic: `---
name: ${name}
description: Custom agent
---

# ${name} Agent

[Define agent purpose and workflow]

1. Task 1
2. Task 2
3. Task 3

Output: [Define output]
`,
    }

    return templates[type] || templates.generic
  }
}

export const agentCommand = new AgentCommand()
