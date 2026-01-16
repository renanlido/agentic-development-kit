import { execFileSync } from 'node:child_process'
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import type { DecisionCategory, MemoryOptions, MemoryPhase, SearchMatch } from '../types/memory.js'
import { MEMORY_LINE_LIMIT } from '../types/memory.js'
import { executeClaudeCommand } from '../utils/claude.js'
import { listDecisions, loadDecision, updateDecisionFeatures } from '../utils/decision-utils.js'
import { logger } from '../utils/logger.js'
import { formatSearchResults, getMemoryStats, recallMemory } from '../utils/memory-search.js'
import {
  countLines,
  createDefaultMemory,
  getMemoryArchivePath,
  getMemoryPath,
  isMemoryOverLimit,
  mergeMemoryContent,
  parseMemoryContent,
  searchInContent,
  serializeMemoryContent,
} from '../utils/memory-utils.js'

function getMainRepoPath(): string {
  try {
    const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      encoding: 'utf-8',
    }).trim()

    if (gitCommonDir === '.git' || gitCommonDir.endsWith('/.git')) {
      return process.cwd()
    }

    return path.dirname(gitCommonDir)
  } catch {
    return process.cwd()
  }
}

class MemoryCommand {
  async save(feature: string, options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Salvando memoria...').start()

    try {
      const mainRepoPath = getMainRepoPath()
      const featurePath = path.join(mainRepoPath, '.claude/plans/features', feature)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature ${feature} nao encontrada`)
        logger.info(`Crie primeiro: adk feature new ${feature}`)
        process.exit(1)
      }

      const memoryPath = getMemoryPath(feature)
      let existingMemory = createDefaultMemory(feature)

      if (await fs.pathExists(memoryPath)) {
        const content = await fs.readFile(memoryPath, 'utf-8')
        existingMemory = parseMemoryContent(content)
      }

      const phase = options.phase || existingMemory.phase

      const prdPath = path.join(featurePath, 'prd.md')
      const researchPath = path.join(featurePath, 'research.md')
      const planPath = path.join(featurePath, 'implementation-plan.md')

      let detectedPhase: MemoryPhase = 'research'
      if (await fs.pathExists(planPath)) {
        detectedPhase = 'implement'
      } else if (await fs.pathExists(researchPath)) {
        detectedPhase = 'plan'
      } else if (await fs.pathExists(prdPath)) {
        detectedPhase = 'research'
      }

      const updateData: Partial<typeof existingMemory> = {
        phase: phase || detectedPhase,
        history: [
          {
            date: new Date().toISOString().split('T')[0],
            phase: phase || detectedPhase,
            result: 'completed',
          },
        ],
      }

      const mergedMemory = mergeMemoryContent(existingMemory, updateData)
      const serialized = serializeMemoryContent(mergedMemory)

      const limitCheck = isMemoryOverLimit(serialized)
      if (limitCheck.warning && !limitCheck.over) {
        logger.warn(
          `Memoria em ${limitCheck.count}/${MEMORY_LINE_LIMIT} linhas (${Math.round((limitCheck.count / MEMORY_LINE_LIMIT) * 100)}%)`
        )
      }

      if (limitCheck.over) {
        spinner.warn('Memoria excede limite')
        logger.warn(`${limitCheck.count} linhas > ${MEMORY_LINE_LIMIT} limite`)
        logger.info(`Execute: adk memory compact ${feature}`)
      }

      await fs.ensureDir(path.dirname(memoryPath))
      await fs.writeFile(memoryPath, serialized)

      spinner.succeed('Memoria salva')
      logger.success(`Memoria: ${chalk.cyan(memoryPath)}`)
      logger.info(`Fase: ${chalk.yellow(mergedMemory.phase)} | Linhas: ${countLines(serialized)}`)
    } catch (error) {
      spinner.fail('Erro ao salvar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async load(feature: string, _options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Carregando memoria...').start()

    try {
      const memoryPath = getMemoryPath(feature)

      if (!(await fs.pathExists(memoryPath))) {
        spinner.fail(`Memoria para ${feature} nao encontrada`)
        logger.info(`Salve primeiro: adk memory save ${feature}`)
        process.exit(1)
      }

      const content = await fs.readFile(memoryPath, 'utf-8')
      const memory = parseMemoryContent(content)

      spinner.succeed('Memoria carregada')

      console.log()
      console.log(chalk.bold.cyan(`Memoria: ${memory.feature}`))
      console.log(chalk.gray('─'.repeat(50)))
      console.log()

      console.log(chalk.yellow('Fase:'), memory.phase)
      console.log(chalk.yellow('Status:'), memory.status)
      console.log(chalk.yellow('Atualizado:'), memory.lastUpdated)
      console.log()

      if (memory.summary) {
        console.log(chalk.bold('Resumo:'))
        console.log(chalk.gray(memory.summary))
        console.log()
      }

      if (memory.decisions.length > 0) {
        console.log(chalk.bold('Decisoes:'))
        for (const d of memory.decisions) {
          console.log(chalk.cyan(`  [${d.id}]`), d.decision)
        }
        console.log()
      }

      if (memory.state.inProgress.length > 0) {
        console.log(chalk.bold('Em Progresso:'))
        for (const item of memory.state.inProgress) {
          console.log(chalk.yellow('  ○'), item)
        }
        console.log()
      }

      if (memory.nextSteps.length > 0) {
        console.log(chalk.bold('Proximos Passos:'))
        memory.nextSteps.forEach((step, i) => {
          console.log(chalk.green(`  ${i + 1}.`), step)
        })
        console.log()
      }

      const lines = countLines(content)
      console.log(chalk.gray(`${lines} linhas | ${memoryPath}`))
    } catch (error) {
      spinner.fail('Erro ao carregar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async view(feature?: string, options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Carregando...').start()

    try {
      if (options.global || !feature) {
        const globalPath = getMemoryPath()

        if (!(await fs.pathExists(globalPath))) {
          spinner.fail('Memoria global nao encontrada')
          process.exit(1)
        }

        const content = await fs.readFile(globalPath, 'utf-8')
        spinner.succeed('Memoria global')

        console.log()
        console.log(content)
        console.log()
        console.log(chalk.gray(`${countLines(content)} linhas | ${globalPath}`))

        const featuresPath = path.join(getMainRepoPath(), '.claude/plans/features')
        if (await fs.pathExists(featuresPath)) {
          const features = await fs.readdir(featuresPath)
          const memoriesExist: string[] = []

          for (const f of features) {
            const memPath = path.join(featuresPath, f, 'memory.md')
            if (await fs.pathExists(memPath)) {
              memoriesExist.push(f)
            }
          }

          if (memoriesExist.length > 0) {
            console.log()
            console.log(chalk.bold('Memorias de Features:'))
            for (const f of memoriesExist) {
              console.log(chalk.cyan('  ●'), f)
            }
          }
        }

        return
      }

      const memoryPath = getMemoryPath(feature)

      if (!(await fs.pathExists(memoryPath))) {
        spinner.fail(`Memoria para ${feature} nao encontrada`)
        logger.info(`Salve primeiro: adk memory save ${feature}`)
        process.exit(1)
      }

      const content = await fs.readFile(memoryPath, 'utf-8')
      const stat = await fs.stat(memoryPath)

      spinner.succeed(`Memoria: ${feature}`)

      console.log()
      console.log(content)
      console.log()
      console.log(
        chalk.gray(`${countLines(content)} linhas | Modificado: ${stat.mtime.toISOString()}`)
      )
    } catch (error) {
      spinner.fail('Erro ao visualizar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async compact(feature: string, _options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Verificando memoria...').start()

    try {
      const memoryPath = getMemoryPath(feature)

      if (!(await fs.pathExists(memoryPath))) {
        spinner.fail(`Memoria para ${feature} nao encontrada`)
        process.exit(1)
      }

      const content = await fs.readFile(memoryPath, 'utf-8')
      const limitCheck = isMemoryOverLimit(content)

      if (!limitCheck.over && !limitCheck.warning) {
        spinner.succeed(
          `Memoria ja esta otimizada (${limitCheck.count}/${MEMORY_LINE_LIMIT} linhas)`
        )
        return
      }

      spinner.text = 'Arquivando versao original...'

      const archivePath = getMemoryArchivePath(feature)
      await fs.ensureDir(path.dirname(archivePath))
      await fs.copy(memoryPath, archivePath)

      spinner.text = 'Compactando com Claude...'

      const prompt = `
COMPACT MEMORY

Arquivo: ${memoryPath}
Linhas atuais: ${limitCheck.count}
Limite: ${MEMORY_LINE_LIMIT}

Tarefa:
1. Leia o arquivo de memoria
2. MANTENHA TODOS os ADRs (decisoes arquiteturais) - sao criticos
3. MANTENHA o historico de fases
4. RESUMA as outras secoes mantendo informacoes essenciais
5. Remova redundancias
6. Alvo: < 800 linhas

Output: Substitua o arquivo ${memoryPath} com versao compactada

IMPORTANTE:
- NAO perca nenhum ADR
- NAO perca historico de fases
- Mantenha formato markdown valido
`

      await executeClaudeCommand(prompt)

      const newContent = await fs.readFile(memoryPath, 'utf-8')
      const newCount = countLines(newContent)

      spinner.succeed('Memoria compactada')
      logger.success(`${limitCheck.count} → ${newCount} linhas`)
      logger.info(`Backup: ${chalk.gray(archivePath)}`)
    } catch (error) {
      spinner.fail('Erro ao compactar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async search(query: string, options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Buscando...').start()
    const startTime = Date.now()

    try {
      const results: SearchMatch[] = []
      const featuresPath = path.join(getMainRepoPath(), '.claude/plans/features')

      if (!(await fs.pathExists(featuresPath))) {
        spinner.fail('Nenhuma feature encontrada')
        process.exit(1)
      }

      let features: string[] = []

      if (options.feature) {
        features = [options.feature]
      } else {
        features = await fs.readdir(featuresPath)
      }

      for (const feature of features) {
        const memoryPath = path.join(featuresPath, feature, 'memory.md')

        if (!(await fs.pathExists(memoryPath))) {
          continue
        }

        const content = await fs.readFile(memoryPath, 'utf-8')
        const matches = searchInContent(content, query)

        for (const match of matches) {
          results.push({
            feature,
            file: memoryPath,
            line: match.line,
            content: match.content,
            context: match.context,
          })
        }
      }

      const elapsed = Date.now() - startTime

      if (results.length === 0) {
        spinner.warn(`Nenhum resultado para "${query}"`)
        return
      }

      results.sort((a, b) => b.context.length - a.context.length)

      spinner.succeed(`${results.length} resultados (${elapsed}ms)`)

      console.log()
      for (const result of results) {
        console.log(chalk.cyan(`${result.feature}/memory.md`) + chalk.gray(`:${result.line}`))
        console.log(chalk.yellow(`  ${result.content.trim()}`))
        console.log()
      }
    } catch (error) {
      spinner.fail('Erro na busca')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async update(_options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Atualizando memoria global...').start()

    try {
      const globalPath = getMemoryPath()

      if (!(await fs.pathExists(globalPath))) {
        spinner.fail('Memoria global nao encontrada')
        logger.info('Execute: adk init')
        process.exit(1)
      }

      const prompt = `
UPDATE GLOBAL MEMORY

Arquivo: ${globalPath}

Tarefa:
1. Analise o estado atual do projeto
2. Atualize .claude/memory/project-context.md com:
   - Tech stack atual
   - Patterns em uso
   - Current focus
3. Atualize .claude/memory/current-state.md com:
   - Features em progresso
   - Proximos passos
   - Metricas atualizadas

IMPORTANTE:
- Mantenha informacoes existentes relevantes
- Adicione novas descobertas
- Remova informacoes obsoletas
`

      await executeClaudeCommand(prompt)

      spinner.succeed('Memoria global atualizada')
      logger.success(`Atualizado: ${chalk.cyan('.claude/memory/')}`)
    } catch (error) {
      spinner.fail('Erro ao atualizar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async recall(query: string, options: { category?: string; limit?: string } = {}): Promise<void> {
    const spinner = ora('Buscando decisões...').start()

    try {
      const results = await recallMemory(query, {
        category: options.category as DecisionCategory | undefined,
        limit: options.limit ? Number.parseInt(options.limit, 10) : 5,
      })

      spinner.stop()

      console.log(formatSearchResults(results))
    } catch (error) {
      spinner.fail('Erro na busca')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async link(feature: string, decisionId: string): Promise<void> {
    const spinner = ora('Vinculando decisão...').start()

    try {
      const decision = await loadDecision(decisionId)

      if (!decision) {
        spinner.fail(`Decisão "${decisionId}" não encontrada`)
        process.exit(1)
      }

      const featurePath = path.join(getMainRepoPath(), '.claude/plans/features', feature)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${feature}" não encontrada`)
        process.exit(1)
      }

      await updateDecisionFeatures(decisionId, feature, 'add')

      const contextPath = path.join(featurePath, 'context.md')
      let contextContent = ''

      if (await fs.pathExists(contextPath)) {
        contextContent = await fs.readFile(contextPath, 'utf-8')
      }

      const link = `\n## Related Decisions\n- [${decision.title}](../../../memory/decisions/${decisionId}.md)\n`

      if (!contextContent.includes(decisionId)) {
        await fs.writeFile(contextPath, contextContent + link, 'utf-8')
      }

      spinner.succeed(`Decisão "${decision.title}" vinculada a "${feature}"`)
    } catch (error) {
      spinner.fail('Erro ao vincular')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async unlink(feature: string, decisionId: string): Promise<void> {
    const spinner = ora('Removendo vínculo...').start()

    try {
      const decision = await loadDecision(decisionId)

      if (!decision) {
        spinner.fail(`Decisão "${decisionId}" não encontrada`)
        process.exit(1)
      }

      await updateDecisionFeatures(decisionId, feature, 'remove')

      spinner.succeed(`Vínculo removido: "${decision.title}" de "${feature}"`)
    } catch (error) {
      spinner.fail('Erro ao remover vínculo')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async export(options: { format?: string; output?: string } = {}): Promise<void> {
    const spinner = ora('Exportando base de conhecimento...').start()

    try {
      const format = options.format || 'md'
      const decisions = await listDecisions()
      const stats = await getMemoryStats()

      let content: string
      let extension: string

      if (format === 'json') {
        content = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            stats,
            decisions,
          },
          null,
          2
        )
        extension = 'json'
      } else {
        const lines: string[] = []
        lines.push('# Knowledge Base Export')
        lines.push('')
        lines.push(`Exported: ${new Date().toISOString()}`)
        lines.push(`Total Decisions: ${stats.totalDecisions}`)
        lines.push('')

        lines.push('## Decisions by Category')
        for (const [cat, count] of Object.entries(stats.byCategory)) {
          lines.push(`- ${cat}: ${count}`)
        }
        lines.push('')

        lines.push('## All Decisions')
        lines.push('')

        for (const decision of decisions) {
          lines.push(`### ${decision.title}`)
          lines.push(`- **ID:** ${decision.id}`)
          lines.push(`- **Category:** ${decision.category}`)
          lines.push(`- **Tags:** ${decision.tags.join(', ') || 'none'}`)
          lines.push(`- **Related Features:** ${decision.relatedFeatures.join(', ') || 'none'}`)
          lines.push('')
          lines.push(`**Context:** ${decision.context}`)
          lines.push('')
          lines.push(`**Decision:** ${decision.chosen}`)
          lines.push('')
          lines.push(`**Rationale:** ${decision.rationale}`)
          lines.push('')
          lines.push('---')
          lines.push('')
        }

        content = lines.join('\n')
        extension = 'md'
      }

      const outputPath =
        options.output || `.claude/exports/knowledge-base-${Date.now()}.${extension}`

      await fs.ensureDir(path.dirname(outputPath))
      await fs.writeFile(outputPath, content, 'utf-8')

      spinner.succeed(`Exportado para ${chalk.cyan(outputPath)}`)
      logger.info(`${decisions.length} decisões exportadas`)
    } catch (error) {
      spinner.fail('Erro ao exportar')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const memoryCommand = new MemoryCommand()
