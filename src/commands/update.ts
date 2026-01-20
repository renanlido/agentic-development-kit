import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { logger } from '../utils/logger'
import { getTemplateDir } from '../utils/templates'

interface UpdateOptions {
  commands?: boolean
  hooks?: boolean
  agents?: boolean
  rules?: boolean
  skills?: boolean
  all?: boolean
  force?: boolean
  backup?: boolean
}

type UpdateCategory = 'commands' | 'hooks' | 'agents' | 'rules' | 'skills'

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const spinner = ora()

  try {
    const projectPath = process.cwd()
    const claudePath = path.join(projectPath, '.claude')

    if (!(await fs.pathExists(claudePath))) {
      logger.error('Estrutura .claude não encontrada. Execute "adk init" primeiro.')
      process.exit(1)
    }

    const templateDir = getTemplateDir()
    const claudeStructureDir = path.join(templateDir, 'claude-structure')

    if (!(await fs.pathExists(claudeStructureDir))) {
      logger.error('Templates ADK não encontrados.')
      process.exit(1)
    }

    const categories: UpdateCategory[] = []

    if (options.all) {
      categories.push('commands', 'hooks', 'agents', 'rules', 'skills')
    } else {
      if (options.commands) {
        categories.push('commands')
      }
      if (options.hooks) {
        categories.push('hooks')
      }
      if (options.agents) {
        categories.push('agents')
      }
      if (options.rules) {
        categories.push('rules')
      }
      if (options.skills) {
        categories.push('skills')
      }
    }

    if (categories.length === 0) {
      console.log()
      console.log(chalk.cyan('ADK Update - Atualiza templates sem perder dados'))
      console.log()
      console.log(chalk.yellow('Uso:'))
      console.log(chalk.gray('  adk update --commands    # Atualiza apenas comandos slash'))
      console.log(chalk.gray('  adk update --hooks       # Atualiza apenas hooks'))
      console.log(chalk.gray('  adk update --agents      # Atualiza apenas agents'))
      console.log(chalk.gray('  adk update --rules       # Atualiza apenas rules'))
      console.log(chalk.gray('  adk update --skills      # Atualiza apenas skills'))
      console.log(chalk.gray('  adk update --all         # Atualiza tudo'))
      console.log()
      console.log(chalk.yellow('Opções:'))
      console.log(chalk.gray('  --force                  # Força atualização sem confirmação'))
      console.log(chalk.gray('  --no-backup              # Não cria backup (padrão: cria)'))
      console.log()
      return
    }

    const shouldBackup = options.backup !== false

    console.log()
    console.log(chalk.bold.cyan('ADK Update'))
    console.log(chalk.gray('━'.repeat(50)))
    console.log()

    const updates: { category: string; file: string; status: 'new' | 'update' | 'skip' }[] = []

    for (const category of categories) {
      const srcDir = path.join(claudeStructureDir, category)
      const destDir = path.join(claudePath, category)

      if (!(await fs.pathExists(srcDir))) {
        continue
      }

      const files = await getAllFiles(srcDir)

      for (const file of files) {
        const relativePath = path.relative(srcDir, file)
        const destFile = path.join(destDir, relativePath)

        if (await fs.pathExists(destFile)) {
          const srcContent = await fs.readFile(file, 'utf-8')
          const destContent = await fs.readFile(destFile, 'utf-8')

          if (srcContent !== destContent) {
            updates.push({ category, file: relativePath, status: 'update' })
          } else {
            updates.push({ category, file: relativePath, status: 'skip' })
          }
        } else {
          updates.push({ category, file: relativePath, status: 'new' })
        }
      }
    }

    const newFiles = updates.filter((u) => u.status === 'new')
    const updatedFiles = updates.filter((u) => u.status === 'update')
    const skippedFiles = updates.filter((u) => u.status === 'skip')

    if (newFiles.length === 0 && updatedFiles.length === 0) {
      console.log(chalk.green('✓ Todos os arquivos já estão atualizados!'))
      console.log()
      return
    }

    console.log(chalk.yellow('Mudanças detectadas:'))
    console.log()

    if (newFiles.length > 0) {
      console.log(chalk.green(`  Novos arquivos (${newFiles.length}):`))
      for (const f of newFiles) {
        console.log(chalk.gray(`    + ${f.category}/${f.file}`))
      }
      console.log()
    }

    if (updatedFiles.length > 0) {
      console.log(chalk.yellow(`  Arquivos a atualizar (${updatedFiles.length}):`))
      for (const f of updatedFiles) {
        console.log(chalk.gray(`    ~ ${f.category}/${f.file}`))
      }
      console.log()
    }

    if (skippedFiles.length > 0) {
      console.log(chalk.gray(`  Já atualizados (${skippedFiles.length}): pulando`))
      console.log()
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: shouldBackup
            ? 'Aplicar atualizações? (backup será criado)'
            : 'Aplicar atualizações? (SEM backup)',
          default: true,
        },
      ])

      if (!confirm) {
        logger.info('Atualização cancelada.')
        return
      }
    }

    if (shouldBackup && updatedFiles.length > 0) {
      spinner.start('Criando backup...')
      const backupDir = path.join(
        claudePath,
        '.backup',
        new Date().toISOString().replace(/[:.]/g, '-')
      )
      await fs.ensureDir(backupDir)

      for (const update of updatedFiles) {
        const srcFile = path.join(claudePath, update.category, update.file)
        const backupFile = path.join(backupDir, update.category, update.file)
        await fs.ensureDir(path.dirname(backupFile))
        await fs.copy(srcFile, backupFile)
      }

      spinner.succeed(`Backup criado em: .claude/.backup/`)
    }

    spinner.start('Aplicando atualizações...')

    let applied = 0
    for (const update of [...newFiles, ...updatedFiles]) {
      const srcFile = path.join(claudeStructureDir, update.category, update.file)
      const destFile = path.join(claudePath, update.category, update.file)

      await fs.ensureDir(path.dirname(destFile))
      await fs.copy(srcFile, destFile, { overwrite: true })
      applied++
    }

    spinner.succeed(`${applied} arquivo(s) atualizado(s)`)

    console.log()
    console.log(chalk.bold.green('✨ Atualização concluída!'))
    console.log()

    if (shouldBackup && updatedFiles.length > 0) {
      console.log(chalk.gray('Para reverter, restaure os arquivos de: .claude/.backup/'))
      console.log()
    }
  } catch (error) {
    spinner.fail('Erro ao atualizar')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const items = await fs.readdir(dir)

  for (const item of items) {
    const itemPath = path.join(dir, item)
    const stat = await fs.stat(itemPath)

    if (stat.isDirectory()) {
      const subFiles = await getAllFiles(itemPath)
      files.push(...subFiles)
    } else {
      files.push(itemPath)
    }
  }

  return files
}
