import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { logger } from './logger'

export async function executeClaudeCommand(prompt: string): Promise<string> {
  // Check if Claude Code is installed
  try {
    execSync('which claude', { stdio: 'pipe' })
  } catch {
    logger.error('Claude Code não está instalado')
    logger.info('Instale: https://github.com/anthropics/claude-code')
    process.exit(1)
  }

  const tempFile = path.join(os.tmpdir(), `adk-prompt-${Date.now()}.txt`)

  try {
    // Create temporary file for prompt
    fs.writeFileSync(tempFile, prompt)

    // Execute Claude with prompt (skip permissions for automation)
    const command = `claude --dangerously-skip-permissions < ${tempFile}`

    logger.debug(`Executing: ${command}`)

    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit',
    })

    return result.toString()
  } catch (error) {
    logger.error('Erro ao executar Claude Code')
    throw error
  } finally {
    // Cleanup - always remove temp file
    try {
      fs.unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
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
