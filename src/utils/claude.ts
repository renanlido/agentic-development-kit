import { spawnSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ModelType } from '../types/model'
import { logger } from './logger'

export interface ClaudeCommandOptions {
  model?: ModelType
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

  const tempFile = path.join(os.tmpdir(), `adk-prompt-${Date.now()}.txt`)

  try {
    fs.writeFileSync(tempFile, prompt)

    const validatedModel = validateModel(options.model)
    const args = ['--dangerously-skip-permissions']
    if (validatedModel) {
      args.push('--model', validatedModel)
    }

    logger.debug(`Executing: claude ${args.join(' ')} < ${tempFile}`)

    const input = fs.readFileSync(tempFile, 'utf-8')
    const result = spawnSync('claude', args, {
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'inherit', 'inherit'],
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
    } catch {
    }
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
