import * as fs from 'fs-extra'
import * as path from 'node:path'
import { MemoryConfigSchema, type MemoryConfig, type MemoryConfigInput } from '../types/mcp-memory'

export function getMemoryConfigPath(): string {
  return path.join(process.cwd(), '.adk', 'memory.json')
}

export async function loadMemoryConfig(): Promise<MemoryConfig> {
  const configPath = getMemoryConfigPath()

  if (!(await fs.pathExists(configPath))) {
    return getDefaultConfig()
  }

  const rawConfig = await fs.readJson(configPath)
  const result = MemoryConfigSchema.safeParse(rawConfig)

  if (!result.success) {
    throw new Error(`Invalid MemoryConfig: ${result.errors.join(', ')}`)
  }

  return result.data
}

export async function saveMemoryConfig(config: MemoryConfig): Promise<void> {
  const configPath = getMemoryConfigPath()
  const configDir = path.dirname(configPath)

  await fs.ensureDir(configDir)
  await fs.writeJson(configPath, config, { spaces: 2 })
}

function getDefaultConfig(): MemoryConfig {
  const defaultInput: MemoryConfigInput = {
    provider: 'mcp-memory',
  }

  const result = MemoryConfigSchema.safeParse(defaultInput)

  if (!result.success) {
    throw new Error('Failed to create default config')
  }

  return result.data
}
