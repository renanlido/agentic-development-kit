import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { logger } from '../utils/logger'
import { copyClaudeStructure } from '../utils/templates'

interface InitOptions {
  name?: string
}

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora()

  try {
    const projectPath = process.cwd()
    const claudeExists = await fs.pathExists(path.join(projectPath, '.claude'))

    if (claudeExists) {
      logger.info('Estrutura .claude encontrada - incrementando com componentes faltantes...')
    }

    // 1. Get project name (for templates only)
    let projectName = options.name
    if (!projectName) {
      const currentDirName = path.basename(projectPath)
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Nome do projeto:',
          default: currentDirName,
          validate: (input) => input.length > 0 || 'Nome é obrigatório',
        },
      ])
      projectName = answers.name
    }

    if (!projectName) {
      logger.error('Nome do projeto é obrigatório')
      process.exit(1)
    }

    spinner.start('Criando estrutura do projeto...')

    // 3. Create project structure
    await createCADDStructure(projectPath)

    spinner.succeed('Estrutura criada')

    // 4. Copy ADK Claude structure (agents, skills, commands, hooks, rules)
    spinner.start('Copiando estrutura ADK (agents, skills, commands, hooks, rules)...')
    await copyClaudeStructure(projectPath)
    spinner.succeed('Estrutura ADK copiada')

    // 3. Create initial memory
    spinner.start('Criando project memory...')
    await createInitialMemory(projectPath, projectName)
    spinner.succeed('Memory criado')

    // 4. Create CLAUDE.md if not exists
    spinner.start('Criando CLAUDE.md...')
    const claudeMdCreated = await createClaudeMd(projectPath, projectName)
    if (claudeMdCreated) {
      spinner.succeed('CLAUDE.md criado')
    } else {
      spinner.info('CLAUDE.md já existe - mantido')
    }

    console.log()
    logger.success(`Projeto ${projectName} inicializado com sucesso!`)
    console.log()
    console.log(chalk.cyan('Estrutura ADK incluida:'))
    console.log(chalk.gray('  - 7 agentes especializados'))
    console.log(chalk.gray('  - 4 skills com templates'))
    console.log(chalk.gray('  - 6 slash commands'))
    console.log(chalk.gray('  - 4 rules de qualidade'))
    console.log(chalk.gray('  - 5 hooks (foco, escopo, validacao, format, estado)'))
    console.log()
    console.log(chalk.cyan('Proximos passos:'))
    console.log(chalk.gray('  claude              # Abrir Claude Code'))
    console.log(chalk.gray('  /analyze            # Analisar projeto existente'))
    console.log(chalk.gray('  /new-feature <nome> # Criar nova feature'))
    console.log()
    console.log(chalk.yellow('Documentacao: .claude/README.md'))
  } catch (error) {
    spinner.fail('Erro ao inicializar projeto')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function createCADDStructure(projectPath: string): Promise<void> {
  const dirs = [
    '.claude/memory',
    '.claude/plans/features',
    '.claude/plans/refactors',
    '.claude/agents',
    '.claude/skills',
    '.claude/commands',
    '.claude/decisions',
    '.claude/incidents/post-mortems',
    '.claude/templates',
    '.claude/scripts',
    '.claude/reports',
    '.claude/daily',
    '.claude/analysis',
  ]

  for (const dir of dirs) {
    await fs.ensureDir(path.join(projectPath, dir))
  }
}

async function createInitialMemory(projectPath: string, projectName: string): Promise<void> {
  const memoryContent = `# Project: ${projectName}

**Created:** ${new Date().toISOString().split('T')[0]}
**Framework:** CADD (Context-Agentic Development & Delivery)

---

## Tech Stack

[Detectado automaticamente pelo /analyze]

## Architecture

[A ser documentado pelo /analyze]

## Patterns & Conventions

[A ser documentado pelo /analyze]

## Current Focus

[Será atualizado durante desenvolvimento]

## Known Issues

[Será atualizado conforme necessário]
`

  const memoryPath = path.join(projectPath, '.claude/memory/project-context.md')

  if (!(await fs.pathExists(memoryPath))) {
    await fs.writeFile(memoryPath, memoryContent)
  }
}

async function createClaudeMd(projectPath: string, projectName: string): Promise<boolean> {
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md')

  if (await fs.pathExists(claudeMdPath)) {
    return false
  }

  const claudeMdContent = `# ${projectName}

## Estrutura CADD

Este projeto utiliza o framework CADD (Context-Agentic Development & Delivery).

### Contexto do Projeto
- Leia \`.claude/memory/project-context.md\` antes de iniciar qualquer tarefa

### Comandos Disponíveis
- \`/analyze\` - Analisa o projeto e documenta arquitetura
- \`/new-feature <nome>\` - Inicia processo de nova feature
- \`/implement <nome>\` - Implementa feature existente
- \`/qa <nome>\` - Executa validação de qualidade
- \`/daily\` - Atualiza estado do projeto

### Agentes Especializados
Ver \`.claude/agents/\` para lista completa de agentes disponíveis.

### Regras
Ver \`.claude/rules/\` para padrões de código, testes e git.
`

  await fs.writeFile(claudeMdPath, claudeMdContent)
  return true
}
