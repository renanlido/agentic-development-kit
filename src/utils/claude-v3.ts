import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ClaudeV3Options, ClaudeV3Result, SessionInfoV3 } from '../types/session-v3.js'
import { logger } from './logger.js'
import { getAntiStubPrompt, validateOutput } from './memory/anti-stub.js'
import { coreStateManager } from './memory/core-state.js'
import { sessionStore } from './session-store.js'

const SESSION_ID_PATTERN = /Session ID: ([a-f0-9-]+)/i

/**
 * Extracts Claude session ID from command output.
 * Looks for pattern: "Session ID: <uuid>"
 */
export function parseSessionId(output: string): string | null {
  const match = output.match(SESSION_ID_PATTERN)
  return match ? match[1] : null
}

/**
 * Executes Claude CLI command asynchronously with session ID capture.
 */
export async function executeClaudeCommandV3(
  prompt: string,
  options: ClaudeV3Options = {}
): Promise<ClaudeV3Result> {
  const startTime = Date.now()
  const tempFile = path.join(os.tmpdir(), `adk3-prompt-${Date.now()}.txt`)

  try {
    fs.writeFileSync(tempFile, prompt)

    const args = ['--dangerously-skip-permissions']

    if (options.printSessionId !== false) {
      args.push('--print-session-id')
    }

    if (options.model) {
      args.push('--model', options.model)
    }

    if (options.resume) {
      args.push('--resume', options.resume)
    }

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }

    logger.debug(`Executing: claude ${args.join(' ')}`)

    return new Promise((resolve, reject) => {
      const claude = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      const input = fs.readFileSync(tempFile, 'utf-8')
      claude.stdin.write(input)
      claude.stdin.end()

      claude.stdout.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk

        if (options.onOutput) {
          options.onOutput(chunk)
        }

        process.stdout.write(chunk)
      })

      claude.stderr.on('data', (data) => {
        const chunk = data.toString()
        stderr += chunk
        process.stderr.write(chunk)
      })

      const timeout = options.timeout || 300000
      const timer = setTimeout(() => {
        claude.kill('SIGTERM')
        reject(new Error(`Claude command timed out after ${timeout}ms`))
      }, timeout)

      claude.on('close', (code) => {
        clearTimeout(timer)

        const duration = Date.now() - startTime
        const sessionId = parseSessionId(stdout) || parseSessionId(stderr)

        resolve({
          output: stdout,
          sessionId,
          exitCode: code || 0,
          duration,
        })
      })

      claude.on('error', (error) => {
        clearTimeout(timer)
        reject(new Error(`Failed to start Claude: ${error.message}`))
      })
    })
  } finally {
    try {
      fs.unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function isClaudeInstalledV3(): boolean {
  try {
    const result = spawnSync('which', ['claude'], { stdio: 'pipe' })
    return result.status === 0
  } catch {
    return false
  }
}

/**
 * Generates the unified system prompt for ADK v3.
 */
async function generateSystemPrompt(feature: string): Promise<string> {
  const coreState = await coreStateManager.get(feature)
  const antiStub = getAntiStubPrompt()

  let prompt = `${antiStub}\n\n`

  if (coreState) {
    prompt += `<core-state>\n${JSON.stringify(coreState, null, 2)}\n</core-state>\n\n`
  }

  prompt += `You are working on the feature: ${feature}.
Always check the core-state for current task and constraints.
If you make a decision, state it clearly so it can be captured.`

  return prompt.trim()
}

/**
 * Executes Claude with automatic session tracking and resume.
 */
export async function executeWithSessionTracking(
  feature: string,
  prompt: string,
  options: ClaudeV3Options = {},
  maxRetries = 2
): Promise<ClaudeV3Result> {
  const existingSession = await sessionStore.get(feature)
  const isResumable = await sessionStore.isResumable(feature)

  const sessionId = existingSession?.claudeSessionId || null

  if (isResumable && sessionId && !options.resume) {
    options.resume = sessionId
    logger.info(`Resuming session ${sessionId}`)
  }

  // Inject system prompt if not provided
  if (!options.systemPrompt) {
    options.systemPrompt = await generateSystemPrompt(feature)
  }

  let result = await executeClaudeCommandV3(prompt, options)
  let retryCount = 0

  // Anti-Stub Self-Correction Loop
  while (retryCount < maxRetries) {
    const validation = validateOutput(result.output)
    if (validation.valid) break

    retryCount++
    logger.warn(`Anti-Stub validation failed: ${validation.error}. Retrying (${retryCount}/${maxRetries})...`)

    const retryPrompt = `Your previous response contained stub patterns: ${validation.matches?.join(', ')}. 
Please provide the FULL implementation. Do not use placeholders or TODOs.`

    // Update options to resume the session we just started/continued
    const retryOptions = { ...options, resume: result.sessionId || options.resume }
    result = await executeClaudeCommandV3(retryPrompt, retryOptions)
  }

  const generateSessionId = (): string => {
    const timestamp = Date.now()
    const randomPart = Math.random().toString(36).substring(2, 9)
    return `session-${timestamp}-${randomPart}`
  }

  const sessionInfo: SessionInfoV3 = {
    id: existingSession?.id || generateSessionId(),
    claudeSessionId: result.sessionId,
    feature,
    startedAt: existingSession?.startedAt || new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    status: result.exitCode === 0 ? 'active' : 'interrupted',
    resumable: result.sessionId !== null,
    metadata: {
      model: options.model,
      exitCode: result.exitCode,
      duration: result.duration,
    },
  }

  await sessionStore.save(feature, sessionInfo)

  return result
}
