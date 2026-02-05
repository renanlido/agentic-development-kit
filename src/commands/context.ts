import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import { logger } from '../utils/logger'

class ContextCommand {
  async status(feature?: string): Promise<void> {
    const spinner = ora('Carregando status de contexto...').start()

    try {
      const { StateManager } = await import('../utils/state-manager')
      const manager = new StateManager()

      if (!feature) {
        const featuresPath = '.claude/plans/features'
        if (!(await fs.pathExists(featuresPath))) {
          spinner.fail('Nenhuma feature encontrada')
          process.exit(1)
        }

        const features = await fs.readdir(featuresPath)
        spinner.succeed(`Encontradas ${features.length} features`)

        console.log(chalk.cyan('\n📊 Context Status - Todas as Features\n'))

        for (const featureName of features) {
          const featureStat = await fs.stat(`${featuresPath}/${featureName}`)
          if (!featureStat.isDirectory()) {
            continue
          }

          try {
            const status = await manager.getContextStatus(featureName)

            let levelIcon = '✅'
            let levelColor = chalk.green
            if (status.level === 'compact') {
              levelIcon = '⚠️ '
              levelColor = chalk.yellow
            } else if (status.level === 'summarize') {
              levelIcon = '🔶'
              levelColor = chalk.yellow
            } else if (status.level === 'handoff') {
              levelIcon = '🔴'
              levelColor = chalk.red
            }

            console.log(
              `${levelIcon} ${chalk.bold(featureName)}: ${levelColor(status.currentTokens.toLocaleString())} tokens (${status.usagePercentage.toFixed(1)}%) - ${levelColor(status.level.toUpperCase())}`
            )
          } catch {
            console.log(`⚪ ${featureName}: (erro ao carregar)`)
          }
        }

        return
      }

      const status = await manager.getContextStatus(feature)

      spinner.succeed('Status carregado')

      console.log(chalk.cyan(`\n📊 Context Status: ${feature}\n`))
      console.log(`Current Tokens: ${chalk.bold(status.currentTokens.toLocaleString())}`)
      console.log(`Max Tokens: ${status.maxTokens.toLocaleString()}`)
      console.log(`Usage: ${chalk.bold(`${status.usagePercentage.toFixed(1)}%`)}`)

      let levelColor = chalk.green
      if (status.level === 'compact') {
        levelColor = chalk.yellow
      } else if (status.level === 'summarize') {
        levelColor = chalk.yellow
      } else if (status.level === 'handoff') {
        levelColor = chalk.red
      }

      console.log(`Level: ${levelColor(status.level.toUpperCase())}`)
      console.log(`Recommendation: ${status.recommendation}`)
      console.log(`Can Continue: ${status.canContinue ? chalk.green('Yes') : chalk.red('No')}`)
    } catch (error) {
      spinner.fail('Falha ao carregar status de contexto')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async prune(feature: string, options: { dryRun?: boolean } = {}): Promise<void> {
    const spinner = ora('Executando memory pruning...').start()

    try {
      const { memoryPruner } = await import('../utils/memory-pruner')

      if (options.dryRun) {
        spinner.info('Modo dry-run: nenhuma mudança será aplicada')
      }

      spinner.text = 'Arquivando conteúdo antigo...'
      const featureResult = await memoryPruner.pruneFeature(feature, options.dryRun)

      spinner.text = 'Limpando project-context...'
      const projectResult = await memoryPruner.pruneProjectContext(options.dryRun)

      spinner.succeed('Memory pruning completo')

      console.log(chalk.cyan('\n🗑️  Memory Pruning Results\n'))

      console.log(chalk.bold('Feature:'))
      console.log(`  Arquivos processados: ${featureResult.filesIdentified.length}`)
      console.log(`  Arquivos arquivados: ${featureResult.filesArchived.length}`)
      console.log(`  Espaço economizado: ${(featureResult.totalSaved / 1024).toFixed(2)} KB`)

      console.log(chalk.bold('\nProject Context:'))
      console.log(`  Linhas antes: ${projectResult.linesBefore}`)
      console.log(`  Linhas depois: ${projectResult.linesAfter}`)
      console.log(`  Linhas removidas: ${projectResult.linesBefore - projectResult.linesAfter}`)

      if (options.dryRun) {
        console.log(chalk.yellow('\nℹ️  Execute sem --dry-run para aplicar as mudanças'))
      } else {
        console.log(
          chalk.green(
            `\n✨ Conteúdo arquivado em: .claude/plans/features/${feature}/.compaction/archived/`
          )
        )
      }
    } catch (error) {
      spinner.fail('Falha no memory pruning')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const contextCommand = new ContextCommand()
