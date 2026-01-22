import { execSync } from 'node:child_process'
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
  try {
    execSync('which claude', { stdio: 'pipe' })
  } catch {
    logger.error('Claude Code is not installed')
    logger.info('Install: https://github.com/anthropics/claude-code')
    process.exit(1)
  }

  const tempFile = path.join(os.tmpdir(), `adk-prompt-${Date.now()}.txt`)

  try {
    fs.writeFileSync(tempFile, prompt)

    const validatedModel = validateModel(options.model)
    const modelFlag = validatedModel ? ` --model ${validatedModel}` : ''
    const command = `claude --dangerously-skip-permissions${modelFlag} < ${tempFile}`

    logger.debug(`Executing: ${command}`)

    execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit',
    })

    return ''
  } catch (error) {
    logger.error('Error executing Claude Code')
    throw error
  } finally {
    try {
      fs.unlinkSync(tempFile)
    } catch {
      // Ignore error if temp file doesn't exist
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
