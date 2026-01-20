#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { agentCommand } from './commands/agent.js'
import { configCommand } from './commands/config.js'
import { deployCommand } from './commands/deploy.js'
import { featureCommand } from './commands/feature.js'
import { importCommand } from './commands/import.js'
import { initCommand } from './commands/init.js'
import { memoryCommand } from './commands/memory.js'
import { reportCommand } from './commands/report.js'
import { specCommand } from './commands/spec.js'
import { syncCommand } from './commands/sync.js'
import { toolCommand } from './commands/tool.js'
import { updateCommand } from './commands/update.js'
import { workflowCommand } from './commands/workflow.js'

const program = new Command()

program
  .name('adk')
  .description('Agentic Development Kit - CLI para desenvolvimento com Claude Code')
  .version('1.0.0')

// Comando: adk init
program
  .command('init')
  .description('Adiciona estrutura CADD (.claude/) ao projeto atual')
  .option('-n, --name <name>', 'Nome do projeto')
  .action(initCommand)

// Comando: adk update
program
  .command('update')
  .description('Atualiza templates ADK (commands, hooks, agents, rules, skills) sem perder dados')
  .option('--commands', 'Atualiza apenas comandos slash')
  .option('--hooks', 'Atualiza apenas hooks')
  .option('--agents', 'Atualiza apenas agents')
  .option('--rules', 'Atualiza apenas rules')
  .option('--skills', 'Atualiza apenas skills')
  .option('--all', 'Atualiza todos os templates')
  .option('--force', 'Força atualização sem confirmação')
  .option('--no-backup', 'Não cria backup dos arquivos existentes')
  .action(updateCommand)

// Comando: adk feature
const feature = program
  .command('feature')
  .description(
    'Gerencia features do projeto (new, research, tasks, plan, implement, qa, docs, list, autopilot)'
  )

feature
  .command('new <name> [description]')
  .description('Cria nova feature com PRD e tasks')
  .option('-p, --priority <priority>', 'Prioridade (P0-P4)', 'P1')
  .option('-c, --context <file>', 'Arquivo de contexto adicional')
  .option('-d, --desc <description>', 'Descrição da feature (alternativa ao argumento posicional)')
  .option('--no-sync', 'Não sincroniza com ferramenta de projeto')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, description, options) =>
    featureCommand.create(name, { ...options, description: options.desc || description })
  )

feature
  .command('research <name> [description]')
  .description('Executa fase de research da feature')
  .option('-c, --context <file>', 'Arquivo de contexto adicional')
  .option('--no-sync', 'Não sincroniza com ferramenta de projeto')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, description, options) =>
    featureCommand.research(name, { ...options, description })
  )

feature
  .command('tasks <name>')
  .description('Cria breakdown de tasks a partir do PRD/research')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, options) => featureCommand.tasks(name, options))

feature
  .command('plan <name>')
  .description('Cria plano de implementação detalhado')
  .option('--skip-spec', 'Pula validação de spec (não recomendado)')
  .option('--no-sync', 'Não sincroniza com ferramenta de projeto')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, options) => featureCommand.plan(name, options))

feature
  .command('implement <name>')
  .description('Implementa feature seguindo TDD (sempre em worktree isolado)')
  .option('--phase <phase>', 'Fase específica para implementar')
  .option('--skip-spec', 'Pula validação de spec (não recomendado)')
  .option('--base-branch <branch>', 'Branch base para criar o worktree (padrão: main)')
  .option('--no-sync', 'Não sincroniza com ferramenta de projeto')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, options) =>
    featureCommand.implement(name, { ...options, baseBranch: options.baseBranch })
  )

feature
  .command('qa <name>')
  .description('Executa revisão de qualidade (QA) - requer worktree')
  .option('--base-branch <branch>', 'Branch base para criar o worktree (padrão: main)')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, options) => featureCommand.qa(name, { baseBranch: options.baseBranch, model: options.model }))

feature
  .command('docs <name>')
  .description('Gera/atualiza documentação da feature - requer worktree')
  .option('--base-branch <branch>', 'Branch base para criar o worktree (padrão: main)')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku) - sobrepõe config')
  .action((name, options) => featureCommand.docs(name, { baseBranch: options.baseBranch, model: options.model }))

feature
  .command('finish <name>')
  .description('Finaliza feature: commit, push, PR/merge e cleanup do worktree')
  .option('--base-branch <branch>', 'Branch base para merge/PR (padrão: main)')
  .action((name, options) => featureCommand.finish(name, { baseBranch: options.baseBranch }))

feature
  .command('list')
  .description('Lista todas features do projeto')
  .action(() => featureCommand.list())

feature
  .command('next [name]')
  .alias('n')
  .description('Executa próxima etapa da feature (usa ativa se nome não informado)')
  .action((name?: string) => featureCommand.next(name))

feature
  .command('refine <name>')
  .description('Refina artefatos de uma feature (PRD, research, tasks) com contexto adicional')
  .option('--prd', 'Refinar apenas PRD')
  .option('--research', 'Refinar apenas Research')
  .option('--tasks', 'Refinar apenas Tasks pendentes')
  .option('--all', 'Refinar todos os artefatos elegíveis')
  .option('--cascade', 'Propagar mudanças para fases seguintes (default: pergunta)')
  .option('--no-cascade', 'Não propagar mudanças (pula pergunta)')
  .option('-c, --context <text>', 'Contexto adicional inline')
  .option('-m, --model <model>', 'Modelo a usar (opus, sonnet, haiku)')
  .action((name, options) => featureCommand.refine(name, options))

feature
  .command('autopilot <name> [description]')
  .description(
    'Executa fluxo completo automatizado em worktree isolado: PRD → Research → Tasks → Arquitetura → Implementação → QA → Documentação'
  )
  .option('-c, --context <file>', 'Arquivo de contexto adicional')
  .option('-d, --desc <description>', 'Descrição da feature (alternativa ao argumento posicional)')
  .option('--base-branch <branch>', 'Branch base para criar o worktree (padrão: main)')
  .action((name, description, options) =>
    featureCommand.autopilot(name, {
      ...options,
      description: options.desc || description,
      baseBranch: options.baseBranch,
    })
  )

// Comando: adk quick - tarefas rápidas sem processo formal
program
  .command('quick <description>')
  .alias('q')
  .description('Tarefa rápida (bug fix, ajuste, micro feature) sem processo formal')
  .option('-f, --file <file>', 'Arquivo específico para focar')
  .option('-t, --test', 'Rodar testes após tarefa', true)
  .option('--no-test', 'Não rodar testes')
  .option('--commit', 'Commitar automaticamente se testes passarem')
  .action((description, options) => featureCommand.quick(description, options))

// Comando: adk workflow
const workflow = program
  .command('workflow')
  .description('Executa workflows automatizados (daily, pre-commit, pre-deploy)')

workflow
  .command('daily')
  .description('Workflow diário de setup')
  .action(() => workflowCommand.daily())

workflow
  .command('pre-commit')
  .description('Validação pré-commit')
  .action(() => workflowCommand.preCommit())

workflow
  .command('pre-deploy')
  .description('Checklist completo pré-deploy')
  .option('-f, --feature <feature>', 'Feature específica')
  .action((options) => workflowCommand.preDeploy(options))

// Comando: adk agent
const agent = program
  .command('agent')
  .description('Gerencia agents especializados (create, run, pipeline)')

agent
  .command('create <name>')
  .description('Cria novo agent')
  .option('-t, --type <type>', 'Tipo do agent (analyzer, implementer, tester)')
  .action((name, options) => agentCommand.create(name, options))

agent
  .command('run <name>')
  .description('Executa agent específico')
  .option('-c, --context <context>', 'Contexto adicional')
  .action((name, options) => agentCommand.run(name, options))

agent
  .command('pipeline <feature>')
  .description('Executa pipeline de agents para feature')
  .action((feature) => agentCommand.pipeline(feature))

agent
  .command('parallel <feature>')
  .description('Executa múltiplos agents em paralelo')
  .option('--max-agents <n>', 'Máximo de agents simultâneos', '3')
  .option('--fallback-sequential', 'Fallback para sequencial se paralelo falhar')
  .action((feature, options) => agentCommand.parallel(feature, options))

agent
  .command('status')
  .description('Mostra status dos agents em execução')
  .option('--watch', 'Atualiza em tempo real')
  .action((options) => agentCommand.status(options))

// Comando: adk deploy
const deploy = program
  .command('deploy')
  .description('Gerencia deploys (staging, production, rollback)')

deploy
  .command('staging <feature>')
  .description('Deploy para staging')
  .action((feature) => deployCommand.staging(feature))

deploy
  .command('production <feature>')
  .description('Deploy gradual para produção')
  .option('--percentage <percentage>', 'Porcentagem inicial', '10')
  .action((feature, options) => deployCommand.production(feature, options))

deploy
  .command('rollback <feature>')
  .description('Rollback de feature')
  .action((feature) => deployCommand.rollback(feature))

// Comando: adk memory
const memory = program
  .command('memory')
  .description(
    'Gerencia memoria especializada por feature (status, save, load, view, compact, search, sync)'
  )

memory
  .command('save <feature>')
  .description('Salva contexto atual para feature')
  .action((feature) => memoryCommand.save(feature))

memory
  .command('load <feature>')
  .description('Carrega memoria de feature')
  .action((feature) => memoryCommand.load(feature))

memory
  .command('view [feature]')
  .description('Visualiza memoria de feature ou global')
  .option('-g, --global', 'Visualiza memoria global')
  .action((feature, options) => memoryCommand.view(feature, options))

memory
  .command('compact <feature>')
  .description('Compacta memoria grande usando Claude')
  .action((feature) => memoryCommand.compact(feature))

memory
  .command('search <query>')
  .description('Busca em todas as memorias')
  .option('-f, --feature <feature>', 'Filtrar por feature')
  .action((query, options) => memoryCommand.search(query, options))

memory
  .command('sync')
  .description('Sincroniza memoria global do projeto')
  .action(() => memoryCommand.sync())

memory
  .command('update')
  .description('(Deprecated: use sync) Atualiza memoria global')
  .action(() => memoryCommand.update())

memory
  .command('recall <query>')
  .description('Busca decisões por contexto usando fuzzy search')
  .option('-c, --category <category>', 'Filtrar por categoria')
  .option('-l, --limit <limit>', 'Limite de resultados', '5')
  .action((query, options) => memoryCommand.recall(query, options))

memory
  .command('link <feature> <decision-id>')
  .description('Vincula decisão a uma feature')
  .action((feature, decisionId) => memoryCommand.link(feature, decisionId))

memory
  .command('unlink <feature> <decision-id>')
  .description('Remove vínculo de decisão com feature')
  .action((feature, decisionId) => memoryCommand.unlink(feature, decisionId))

memory
  .command('export')
  .description('Exporta base de conhecimento')
  .option('--format <format>', 'Formato de export (json, md)', 'md')
  .option('--output <path>', 'Caminho de saída')
  .action((options) => memoryCommand.export(options))

memory
  .command('status')
  .description('Lista todas as memórias com estatísticas de uso')
  .action(() => memoryCommand.status())

// Comando: adk spec
const spec = program
  .command('spec')
  .description('Gerencia especificações de features (create, validate, generate, view)')

spec
  .command('create <feature>')
  .description('Cria especificação interativa para feature')
  .option('--from-prd', 'Usar PRD como base')
  .action((feature, options) => specCommand.create(feature, options))

spec
  .command('validate <feature>')
  .description('Valida especificação contra schema')
  .option('--fix', 'Tenta corrigir problemas automaticamente')
  .action(async (feature, options) => {
    await specCommand.validate(feature, options)
  })

spec
  .command('generate <feature>')
  .description('Gera scaffolding de código a partir da spec')
  .action((feature) => specCommand.generate(feature))

spec
  .command('view <feature>')
  .description('Visualiza especificação da feature')
  .action((feature) => specCommand.view(feature))

// Comando: adk tool
const tool = program
  .command('tool')
  .description('Gerencia tool registry (search, register, list, index, info)')

tool
  .command('search <query>')
  .description('Busca tools por query')
  .option('-c, --category <category>', 'Filtrar por categoria')
  .option('-l, --limit <limit>', 'Limite de resultados', '5')
  .action((query, options) => toolCommand.search(query, options))

tool
  .command('register <name>')
  .description('Registra nova tool')
  .option('--from-file <file>', 'Registrar de arquivo JSON')
  .action((name, options) => toolCommand.register(name, options))

tool
  .command('unregister <name>')
  .description('Remove tool do registry')
  .action((name) => toolCommand.unregister(name))

tool
  .command('list')
  .description('Lista todas as tools registradas')
  .option('-c, --category <category>', 'Filtrar por categoria')
  .option('--discoverable', 'Mostrar apenas tools on-demand')
  .action((options) => toolCommand.list(options))

tool
  .command('index')
  .description('Re-indexa tools de agents e skills')
  .action(() => toolCommand.index())

tool
  .command('info <name>')
  .description('Mostra informações detalhadas de uma tool')
  .action((name) => toolCommand.info(name))

// Comando: adk config
const config = program.command('config').description('Gerencia configurações do ADK (integration)')

config
  .command('integration [provider]')
  .description('Configura integração com ferramentas de projeto (ClickUp, etc)')
  .option('--disable', 'Desabilita integração atual')
  .option('--show', 'Mostra configuração atual')
  .action((provider, options) => configCommand.integration(provider, options))

config
  .command('migrate-hooks')
  .description('Migra configuração de hooks de .claude/settings.json para .adk/config.json')
  .action(() => configCommand.migrateHooks())

// Comando: adk sync
program
  .command('sync [feature]')
  .description('Sincroniza features com ferramenta de projeto integrada')
  .option('--force', 'Força sincronização mesmo de features já sincronizadas')
  .action((feature, options) => syncCommand.run(feature, options))

// Comando: adk import
program
  .command('import')
  .description('Importa tasks da ferramenta de projeto como features locais')
  .option('--list', 'Lista tasks disponíveis sem importar')
  .option('--dry-run', 'Mostra o que seria importado sem criar arquivos')
  .option('--force', 'Sobrescreve features existentes')
  .option('--id <taskId>', 'Importa task específica por ID')
  .action((options) => importCommand.run(options))

// Comando: adk report
program
  .command('report')
  .description('Gera relatórios de atividade')
  .option('-w, --weekly', 'Relatório semanal com commits e features')
  .option('-f, --feature <feature>', 'Relatório detalhado de uma feature')
  .action((options) => reportCommand.run(options))

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('Comando inválido: %s'), program.args.join(' '))
  console.log(chalk.yellow('Veja --help para comandos disponíveis'))
  process.exit(1)
})

// Parse
program.parse(process.argv)

// Show help se nenhum comando
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
