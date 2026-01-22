import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import type { MemoryOptions, MemoryPhase, SearchMatch } from '../types/memory.js'
import { MEMORY_LINE_LIMIT } from '../types/memory.js'
import { executeClaudeCommand } from '../utils/claude.js'
import { listDecisions, loadDecision, updateDecisionFeatures } from '../utils/decision-utils.js'
import { getFeaturePath, getFeaturesBasePath } from '../utils/git-paths.js'
import { logger } from '../utils/logger.js'
import { MemoryMCP } from '../utils/memory-mcp.js'
import { getMemoryStats } from '../utils/memory-search.js'
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

class MemoryCommand {
  async save(feature: string, options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Salvando memoria...').start()

    try {
      const featurePath = getFeaturePath(feature)

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

        const featuresPath = getFeaturesBasePath()
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
      const featuresPath = getFeaturesBasePath()

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

  async sync(_options: MemoryOptions = {}): Promise<void> {
    const spinner = ora('Sincronizando memoria global...').start()

    try {
      const globalPath = getMemoryPath()

      if (!(await fs.pathExists(globalPath))) {
        spinner.fail('Memoria global nao encontrada')
        logger.info('Execute: adk init')
        process.exit(1)
      }

      const prompt = `
SYNC GLOBAL MEMORY

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

      spinner.succeed('Memoria global sincronizada')
      logger.success(`Sincronizado: ${chalk.cyan('.claude/memory/')}`)
    } catch (error) {
      spinner.fail('Erro ao sincronizar memoria')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  async update(options: MemoryOptions = {}): Promise<void> {
    console.warn(
      chalk.yellow('⚠️  Deprecated: use "adk memory sync" instead of "adk memory update"')
    )
    return this.sync(options)
  }

  async recall(
    query: string,
    options: {
      category?: string
      limit?: string
      threshold?: string
      hybrid?: string
    } = {}
  ): Promise<void> {
    const spinner = ora('Buscando...').start()

    try {
      const mcp = new MemoryMCP()

      const connected = await mcp.connect()
      if (!connected) {
        spinner.fail('Falha ao conectar ao MCP')
        logger.error('Nao foi possivel estabelecer conexao com o servidor MCP')
        process.exit(1)
      }

      const limit = options.limit ? Number.parseInt(options.limit, 10) : 5
      const threshold = options.threshold ? Number.parseFloat(options.threshold) : undefined
      const hybrid = options.hybrid === 'false' ? false : true

      const result = await mcp.recall(query, {
        limit,
        threshold,
        hybrid,
      })

      await mcp.disconnect()

      spinner.stop()

      if (result.documents.length === 0) {
        spinner.warn(`Nenhum resultado para "${query}"`)
        return
      }

      console.log()
      console.log(chalk.bold.cyan(`Resultados para: ${query}`))
      console.log(chalk.gray('─'.repeat(60)))
      console.log()

      for (const doc of result.documents) {
        const score = Math.round(doc.score * 100)
        console.log(chalk.cyan(`${doc.metadata.source}`) + chalk.gray(` (${score}%)`))
        console.log(chalk.yellow(`  ${doc.content.substring(0, 200)}...`))
        console.log()
      }

      console.log(
        chalk.gray(`${result.documents.length} resultados | ${result.timings.total}ms | ${result.meta.mode}`)
      )
      console.log()
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

      const featurePath = getFeaturePath(feature)

      if (!(await fs.pathExists(featurePath))) {
        spinner.fail(`Feature "${feature}" não encontrada`)
        process.exit(1)
      }

      await updateDecisionFeatures(decisionId, feature, 'add')

      const contextPath = getFeaturePath(feature, 'context.md')
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

  async status(): Promise<void> {
    const spinner = ora('Verificando memórias...').start()

    try {
      const memories: Array<{
        type: 'global' | 'feature'
        name: string
        lines: number
        percentUsed: number
        lastUpdated: Date
        warning: boolean
      }> = []

      const globalPath = getMemoryPath()

      if (await fs.pathExists(globalPath)) {
        const content = await fs.readFile(globalPath, 'utf-8')
        const stat = await fs.stat(globalPath)
        const lines = countLines(content)
        const percentUsed = Math.round((lines / MEMORY_LINE_LIMIT) * 100)

        memories.push({
          type: 'global',
          name: 'project-context',
          lines,
          percentUsed,
          lastUpdated: stat.mtime,
          warning: percentUsed >= 80,
        })
      }

      const featuresPath = getFeaturesBasePath()

      if (await fs.pathExists(featuresPath)) {
        const features = await fs.readdir(featuresPath)

        for (const feature of features) {
          const memoryPath = path.join(featuresPath, feature, 'memory.md')

          if (await fs.pathExists(memoryPath)) {
            const content = await fs.readFile(memoryPath, 'utf-8')
            const stat = await fs.stat(memoryPath)
            const lines = countLines(content)
            const percentUsed = Math.round((lines / MEMORY_LINE_LIMIT) * 100)

            memories.push({
              type: 'feature',
              name: feature,
              lines,
              percentUsed,
              lastUpdated: stat.mtime,
              warning: percentUsed >= 80,
            })
          }
        }
      }

      spinner.stop()

      if (memories.length === 0) {
        console.log(chalk.yellow('Nenhuma memória encontrada'))
        console.log(chalk.gray('Execute: adk init'))
        return
      }

      console.log()
      console.log(chalk.bold.cyan('Status das Memórias'))
      console.log(chalk.gray('─'.repeat(60)))
      console.log()

      console.log(
        chalk.gray(
          `${'Tipo'.padEnd(10)} ${'Nome'.padEnd(25)} ${'Linhas'.padStart(8)} ${'Uso'.padStart(6)} ${'Última Atualização'.padStart(20)}`
        )
      )
      console.log(chalk.gray('─'.repeat(60)))

      for (const memory of memories) {
        const typeLabel = memory.type === 'global' ? 'Global' : 'Feature'
        const usageLabel = `${memory.percentUsed}%`
        const dateLabel = memory.lastUpdated.toISOString().split('T')[0]

        const usageColor = memory.warning ? chalk.yellow : chalk.green

        console.log(
          `${typeLabel.padEnd(10)} ${memory.name.padEnd(25)} ${String(memory.lines).padStart(8)} ${usageColor(usageLabel.padStart(6))} ${chalk.gray(dateLabel.padStart(20))}`
        )
      }

      console.log()

      const warnings = memories.filter((m) => m.warning)
      if (warnings.length > 0) {
        console.log(chalk.yellow('⚠️  Memórias próximas do limite (>= 80%):'))
        for (const w of warnings) {
          console.log(chalk.yellow(`   - ${w.name}: ${w.percentUsed}%`))
        }
        console.log(chalk.gray('   Execute: adk memory compact <feature>'))
        console.log()
      }

      console.log(
        chalk.gray(`Total: ${memories.length} memórias | Limite: ${MEMORY_LINE_LIMIT} linhas`)
      )
    } catch (error) {
      spinner.fail('Erro ao verificar memórias')
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

  async index(
    paths: string | string[],
    options: { tags?: string[]; feature?: string; title?: string } = {}
  ): Promise<void> {
    const spinner = ora('Indexando arquivos...').start()

    try {
      const filePaths = Array.isArray(paths) ? paths : [paths]
      const mcp = new MemoryMCP()

      const connected = await mcp.connect()
      if (!connected) {
        spinner.fail('Falha ao conectar ao MCP')
        logger.error('Nao foi possivel estabelecer conexao com o servidor MCP')
        process.exit(1)
      }

      let indexed = 0
      let failed = 0
      const failures: string[] = []

      for (const filePath of filePaths) {
        if (!(await fs.pathExists(filePath))) {
          logger.warn(`Arquivo nao encontrado: ${chalk.gray(filePath)}`)
          failed++
          failures.push(filePath)
          continue
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const stat = await fs.stat(filePath)

          const metadata: Record<string, unknown> = {
            source: filePath,
            createdAt: stat.mtime.toISOString(),
            updatedAt: stat.mtime.toISOString(),
          }

          if (options.tags) {
            metadata.tags = options.tags
          }

          if (options.feature) {
            metadata.feature = options.feature
          }

          if (options.title) {
            metadata.title = options.title
          }

          const result = await mcp.index(content, metadata)

          if (!result.success) {
            logger.warn(`Falha ao indexar ${chalk.gray(filePath)}: ${result.error}`)
            failed++
            failures.push(filePath)
          } else {
            indexed++
          }
        } catch (error) {
          logger.warn(`Erro ao processar ${chalk.gray(filePath)}: ${error instanceof Error ? error.message : String(error)}`)
          failed++
          failures.push(filePath)
        }
      }

      await mcp.disconnect()

      if (indexed === 0) {
        spinner.fail('Nenhum arquivo indexado')
        if (failures.length > 0) {
          logger.error(`Falhas: ${failures.join(', ')}`)
        }
        process.exit(1)
      }

      if (failed > 0) {
        spinner.warn(`${indexed} de ${filePaths.length} arquivos indexados`)
        logger.warn(`${failed} falhas`)
      } else if (indexed === 1) {
        spinner.succeed('Arquivo indexado com sucesso')
        logger.success(`${chalk.cyan(filePaths[0])} adicionado ao indice`)
      } else {
        spinner.succeed('Arquivos indexados com sucesso')
        logger.success(`${indexed} arquivos adicionados ao indice`)
      }
    } catch (error) {
      spinner.fail('Erro ao indexar')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}

export const memoryCommand = new MemoryCommand()
