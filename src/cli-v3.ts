#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { featureV3Command } from './commands/feature-v3.js'

const program = new Command()

program.name('adk3').description('ADK v3 - Session Continuity Preview').version('3.0.0-alpha')

const feature = program.command('feature').description('Feature commands with session tracking')

feature
  .command('status <name>')
  .description('Show feature status including sessions')
  .action((name) => featureV3Command.status(name))

feature
  .command('prompt <name> <text>')
  .description('Send a prompt to Claude with session tracking')
  .option('-m, --model <model>', 'Model to use (sonnet, opus, haiku)')
  .action((name, text, options) => featureV3Command.prompt(name, text, options))

feature
  .command('task <name> <task_id>')
  .description('Set the current task in core state')
  .action((name, taskId) => featureV3Command.setTask(name, taskId))

program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '))
  process.exit(1)
})

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
