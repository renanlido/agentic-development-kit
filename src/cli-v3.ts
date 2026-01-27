#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { featureV3Command } from './commands/feature-v3.js'

const program = new Command()

program
  .name('adk3')
  .description('ADK v3 - Session Continuity Preview')
  .version('3.0.0-alpha')

const feature = program
  .command('feature')
  .description('Feature commands with session tracking')

feature
  .command('status <name>')
  .description('Show feature status including sessions')
  .action((name) => featureV3Command.status(name))

program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '))
  process.exit(1)
})

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
