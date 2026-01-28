import { execSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as readline from 'node:readline'
import { ModelType } from '../types/model'
import type { CollectedMetrics } from '../types/parallel'
import { logger } from './logger'
import {
  disableMetricsCollection,
  enableMetricsCollection,
  getCollectedMetrics,
  parseAndDisplayStream,
} from './stream-parser'

export interface ClaudeCommandOptions {
  model?: ModelType
  headless?: boolean
  showProgress?: boolean
  cwd?: string
  collectMetrics?: boolean
}

export interface HeadlessResult {
  success: boolean
  metrics?: CollectedMetrics
}

const VALID_MODELS = new Set<string>([ModelType.OPUS, ModelType.SONNET, ModelType.HAIKU])

function validateModel(model: string | undefined): string | undefined {
  if (!model) {
    return undefined
  }
  if (VALID_MODELS.has(model)) {
    return model
  }
  logger.warn(`Invalid model "${model}", ignoring`)
  return undefined
}

export async function executeClaudeCommand(
  prompt: string,
  options: ClaudeCommandOptions = {}
): Promise<string> {
  if (!isClaudeInstalled()) {
    logger.error('Claude Code is not installed')
    logger.info('Install: https://github.com/anthropics/claude-code')
    process.exit(1)
  }

  if (options.headless) {
    return executeHeadless(prompt, options)
  }

  return executeInteractive(prompt, options)
}

async function executeHeadless(prompt: string, options: ClaudeCommandOptions): Promise<string> {
  const result = await executeHeadlessWithMetrics(prompt, options)
  return result.success ? '' : ''
}

export async function executeHeadlessWithMetrics(
  prompt: string,
  options: ClaudeCommandOptions = {}
): Promise<HeadlessResult> {
  const validatedModel = validateModel(options.model)
  const args = [
    '-p',
    '--dangerously-skip-permissions',
    '--output-format',
    'stream-json',
    '--verbose',
  ]

  if (validatedModel) {
    args.push('--model', validatedModel)
  }

  const showProgress = options.showProgress !== false
  const collectMetrics = options.collectMetrics === true

  if (collectMetrics) {
    enableMetricsCollection()
  }

  logger.debug(`Executing headless: claude ${args.join(' ')}`)

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: options.cwd || process.cwd(),
    })

    child.stdin.write(prompt)
    child.stdin.end()

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    })

    rl.on('line', (line) => {
      if (showProgress) {
        parseAndDisplayStream(line)
      }
    })

    child.on('close', (code) => {
      rl.close()
      const metrics = collectMetrics ? getCollectedMetrics() : undefined
      if (collectMetrics) {
        disableMetricsCollection()
      }
      if (code === 0) {
        resolve({ success: true, metrics: metrics || undefined })
      } else {
        reject(new Error(`Claude exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      rl.close()
      if (collectMetrics) {
        disableMetricsCollection()
      }
      reject(new Error(`Failed to start Claude: ${err.message}`))
    })
  })
}

async function executeInteractive(prompt: string, options: ClaudeCommandOptions): Promise<string> {
  const tempFile = path.join(os.tmpdir(), `adk-prompt-${Date.now()}.txt`)

  try {
    fs.writeFileSync(tempFile, prompt)

    const validatedModel = validateModel(options.model)
    const args = ['--dangerously-skip-permissions']
    if (validatedModel) {
      args.push('--model', validatedModel)
    }

    logger.debug(`Executing interactive: claude ${args.join(' ')} < ${tempFile}`)

    const input = fs.readFileSync(tempFile, 'utf-8')
    const result = spawnSync('claude', args, {
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: options.cwd || process.cwd(),
    })

    if (result.error) {
      throw new Error(`Failed to start Claude: ${result.error.message}`)
    }

    if (result.status !== 0) {
      throw new Error(`Claude exited with code ${result.status}`)
    }

    return ''
  } catch (error) {
    logger.error('Error executing Claude Code')
    throw error
  } finally {
    try {
      fs.unlinkSync(tempFile)
    } catch {}
  }
}

export function isClaudeInstalled(): boolean {
  try {
    execSync('which claude', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
