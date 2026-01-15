import inquirer from 'inquirer'
import ora from 'ora'
import { createToolDefinition, ToolCategory, type ToolDefinition } from '../types/tool.js'
import { logger } from '../utils/logger.js'
import {
  getDeferredTools,
  getImmediateTools,
  getTool,
  indexAllTools,
  listTools,
  registerTool,
  searchTools,
  unregisterTool,
} from '../utils/tool-registry.js'

export interface ToolOptions {
  category?: string
  limit?: number
  discoverable?: boolean
  fromFile?: string
}

export class ToolCommand {
  async search(query: string, options: ToolOptions = {}): Promise<void> {
    const spinner = ora('Searching tools...').start()

    try {
      const results = await searchTools(query, {
        category: options.category as ToolCategory | undefined,
        limit: options.limit || 5,
        includeDeferred: true,
      })

      spinner.stop()

      if (results.length === 0) {
        logger.info('No matching tools found.')
        return
      }

      console.log(`\n🔍 Found ${results.length} tool(s) for "${query}":\n`)

      for (const result of results) {
        const confidenceIcon =
          result.confidence === 'high' ? '🟢' : result.confidence === 'medium' ? '🟡' : '🔴'

        console.log(`${confidenceIcon} ${result.tool.name}`)
        console.log(`   ${result.tool.description}`)
        console.log(`   Category: ${result.tool.category} | Priority: ${result.tool.priority}`)
        console.log(`   Score: ${Math.round(result.score * 100)}%`)
        if (result.matchedTriggers.length > 0) {
          console.log(`   Matched: ${result.matchedTriggers.join(', ')}`)
        }
        console.log('')
      }
    } catch (error) {
      spinner.fail('Search failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }

  async register(name: string, options: ToolOptions = {}): Promise<void> {
    const spinner = ora('Registering tool...').start()

    try {
      if (options.fromFile) {
        // TODO: Implement bulk register from file
        spinner.fail('Bulk register not implemented yet')
        return
      }

      spinner.stop()

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Tool description:',
          validate: (input: string) => input.length >= 10 || 'Description too short',
        },
        {
          type: 'input',
          name: 'promptPath',
          message: 'Path to tool prompt file:',
          default: `.claude/agents/${name}.md`,
        },
        {
          type: 'list',
          name: 'category',
          message: 'Category:',
          choices: Object.values(ToolCategory),
          default: ToolCategory.IMPLEMENTATION,
        },
        {
          type: 'list',
          name: 'priority',
          message: 'Priority:',
          choices: ['high', 'medium', 'low'],
          default: 'medium',
        },
        {
          type: 'confirm',
          name: 'deferLoading',
          message: 'Load on-demand (defer)?',
          default: true,
        },
      ])

      const tool = createToolDefinition(
        name,
        answers.description,
        answers.promptPath,
        answers.category,
        {
          priority: answers.priority,
          deferLoading: answers.deferLoading,
        }
      )

      await registerTool(tool)

      logger.success(`Tool "${name}" registered successfully`)
    } catch (error) {
      spinner.fail('Registration failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }

  async unregister(name: string): Promise<void> {
    const spinner = ora('Unregistering tool...').start()

    try {
      const success = await unregisterTool(name)

      if (success) {
        spinner.succeed(`Tool "${name}" unregistered`)
      } else {
        spinner.fail(`Tool "${name}" not found`)
      }
    } catch (error) {
      spinner.fail('Unregistration failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }

  async list(options: ToolOptions = {}): Promise<void> {
    const spinner = ora('Loading tools...').start()

    try {
      let tools: ToolDefinition[]

      if (options.discoverable) {
        tools = await getDeferredTools()
        spinner.stop()
        console.log('\n📦 Discoverable Tools (loaded on-demand):\n')
      } else if (options.category) {
        tools = await listTools(options.category as ToolCategory)
        spinner.stop()
        console.log(`\n📦 Tools in category "${options.category}":\n`)
      } else {
        tools = await listTools()
        spinner.stop()
        console.log('\n📦 All Registered Tools:\n')
      }

      if (tools.length === 0) {
        logger.info('No tools found. Run "adk tool index" to index agents and skills.')
        return
      }

      const immediate = await getImmediateTools()
      const immediateNames = new Set(immediate.map((t) => t.name))

      for (const tool of tools) {
        const loadingIcon = immediateNames.has(tool.name) ? '⚡' : '💤'
        const priorityIcon =
          tool.priority === 'high' ? '🔴' : tool.priority === 'medium' ? '🟡' : '🟢'

        console.log(`${loadingIcon} ${priorityIcon} ${tool.name}`)
        console.log(`   ${tool.description.slice(0, 60)}...`)
        console.log(`   Category: ${tool.category} | Path: ${tool.promptPath}`)
        console.log('')
      }

      console.log(`Total: ${tools.length} tools`)
      console.log(`Legend: ⚡ Loaded immediately | 💤 Loaded on-demand`)
    } catch (error) {
      spinner.fail('List failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }

  async index(): Promise<void> {
    const spinner = ora('Indexing tools from agents and skills...').start()

    try {
      const count = await indexAllTools()
      spinner.succeed(`Indexed ${count} tools`)
    } catch (error) {
      spinner.fail('Indexing failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }

  async info(name: string): Promise<void> {
    const spinner = ora('Loading tool info...').start()

    try {
      const tool = await getTool(name)

      if (!tool) {
        spinner.fail(`Tool "${name}" not found`)
        return
      }

      spinner.stop()

      console.log(`\n📦 Tool: ${tool.name}\n`)
      console.log(`Description: ${tool.description}`)
      console.log(`Category: ${tool.category}`)
      console.log(`Priority: ${tool.priority}`)
      console.log(`Defer Loading: ${tool.deferLoading ? 'Yes' : 'No'}`)
      console.log(`Prompt Path: ${tool.promptPath}`)
      console.log(`Version: ${tool.version}`)
      console.log(`Created: ${tool.createdAt}`)
      console.log(`Updated: ${tool.updatedAt}`)

      if (tool.triggers.length > 0) {
        console.log(`\nTriggers: ${tool.triggers.join(', ')}`)
      }

      if (tool.dependencies.length > 0) {
        console.log(`Dependencies: ${tool.dependencies.join(', ')}`)
      }
    } catch (error) {
      spinner.fail('Info failed')
      logger.error(error instanceof Error ? error.message : String(error))
    }
  }
}

export const toolCommand = new ToolCommand()
