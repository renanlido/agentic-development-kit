import { execSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as readline from 'node:readline'
import { ModelType } from '../types/model'
import type { CollectedMetrics, StreamEventCallback } from '../types/parallel'
import type { StreamEvent } from '../types/stream-events'
import { logger } from './logger'
import {
  disableMetricsCollection,
  disableOutputCollection,
  enableMetricsCollection,
  enableOutputCollection,
  getCollectedMetrics,
  getCollectedOutput,
  parseAndDisplayStream,
} from './stream-parser'

export interface ClaudeCommandOptions {
  model?: ModelType
  headless?: boolean
  showProgress?: boolean
  cwd?: string
  collectMetrics?: boolean
  enableTokenStreaming?: boolean
  onEvent?: StreamEventCallback
  disableHooks?: boolean
}

export interface HeadlessResult {
  success: boolean
  metrics?: CollectedMetrics
  output?: string
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
  const enableStreaming = options.enableTokenStreaming !== false
  const args = [
    '-p',
    '--dangerously-skip-permissions',
    '--output-format',
    'stream-json',
    '--verbose',
    ...(enableStreaming ? ['--include-partial-messages'] : []),
  ]

  if (options.disableHooks) {
    const parallelSettingsPath = path.join(process.cwd(), '.claude', 'settings.parallel.json')
    if (fs.existsSync(parallelSettingsPath)) {
      args.push('--settings', parallelSettingsPath)
    }
  }

  if (validatedModel) {
    args.push('--model', validatedModel)
  }

  const showProgress = options.showProgress !== false
  const collectMetrics = options.collectMetrics === true
  const collectOutput = true

  if (collectMetrics) {
    enableMetricsCollection()
  }
  if (collectOutput) {
    enableOutputCollection()
  }

  logger.debug(`Executing headless: claude ${args.join(' ')}`)

  return new Promise((resolve, reject) => {
    const stderrMode = showProgress ? 'inherit' : 'pipe'
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', stderrMode],
      cwd: options.cwd || process.cwd(),
    })

    child.stdin!.write(prompt)
    child.stdin!.end()

    const rl = readline.createInterface({
      input: child.stdout!,
      crlfDelay: Infinity,
    })

    rl.on('line', (line) => {
      if (showProgress) {
        parseAndDisplayStream(line)
      }
      if (options.onEvent) {
        try {
          const event = JSON.parse(line) as StreamEvent
          options.onEvent(event)
        } catch {}
      }
    })

    child.on('close', (code) => {
      rl.close()
      const metrics = collectMetrics ? getCollectedMetrics() : undefined
      const output = collectOutput ? getCollectedOutput() : undefined
      if (collectMetrics) {
        disableMetricsCollection()
      }
      if (collectOutput) {
        disableOutputCollection()
      }
      if (code === 0) {
        resolve({ success: true, metrics: metrics || undefined, output: output || undefined })
      } else {
        reject(new Error(`Claude exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      rl.close()
      if (collectMetrics) {
        disableMetricsCollection()
      }
      if (collectOutput) {
        disableOutputCollection()
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
