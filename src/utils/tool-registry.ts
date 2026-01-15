import fs from 'node:fs/promises'
import path from 'node:path'
import Fuse from 'fuse.js'
import type {
  ToolDefinition,
  ToolRegistry,
  ToolSearchOptions,
  ToolSearchResult,
} from '../types/tool.js'
import { DEFAULT_TOOL_SEARCH_OPTIONS, extractTriggers, ToolCategory } from '../types/tool.js'

const REGISTRY_PATH = '.claude/tools/registry.json'
const AGENTS_DIR = '.claude/agents'
const SKILLS_DIR = '.claude/skills'

let registryCache: ToolRegistry | null = null

const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 0.3 },
    { name: 'description', weight: 0.3 },
    { name: 'triggers', weight: 0.4 },
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  findAllMatches: true,
}

async function ensureRegistryDir(): Promise<void> {
  await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true })
}

async function loadRegistry(): Promise<ToolRegistry> {
  if (registryCache) {
    return registryCache
  }

  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8')
    registryCache = JSON.parse(content)
    return registryCache as ToolRegistry
  } catch {
    registryCache = {
      tools: [],
      lastIndexed: new Date().toISOString(),
      version: '1.0.0',
    }
    return registryCache
  }
}

async function saveRegistry(registry: ToolRegistry): Promise<void> {
  await ensureRegistryDir()
  registry.lastIndexed = new Date().toISOString()
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8')
  registryCache = registry
}

export async function registerTool(tool: ToolDefinition): Promise<void> {
  const registry = await loadRegistry()

  const existingIndex = registry.tools.findIndex((t) => t.name === tool.name)
  if (existingIndex >= 0) {
    registry.tools[existingIndex] = tool
  } else {
    registry.tools.push(tool)
  }

  await saveRegistry(registry)
}

export async function unregisterTool(name: string): Promise<boolean> {
  const registry = await loadRegistry()
  const initialLength = registry.tools.length

  registry.tools = registry.tools.filter((t) => t.name !== name)

  if (registry.tools.length < initialLength) {
    await saveRegistry(registry)
    return true
  }
  return false
}

export async function getTool(name: string): Promise<ToolDefinition | null> {
  const registry = await loadRegistry()
  return registry.tools.find((t) => t.name === name) || null
}

export async function listTools(category?: ToolCategory): Promise<ToolDefinition[]> {
  const registry = await loadRegistry()

  if (category) {
    return registry.tools.filter((t) => t.category === category)
  }
  return registry.tools
}

function buildFuseIndex(tools: ToolDefinition[]): Fuse<ToolDefinition> {
  return new Fuse(tools, FUSE_OPTIONS)
}

interface FuseMatch {
  key?: string
  value?: string
}

function extractMatchedTriggers(
  matches: readonly FuseMatch[] | undefined,
  tool: ToolDefinition
): string[] {
  if (!matches) {
    return []
  }

  const matchedTriggers: string[] = []
  for (const match of matches) {
    if (match.key === 'triggers' && typeof match.value === 'string') {
      matchedTriggers.push(match.value)
    }
  }

  if (matchedTriggers.length === 0 && matches.some((m) => m.key === 'triggers')) {
    return tool.triggers.slice(0, 3)
  }

  return matchedTriggers
}

export async function searchTools(
  query: string,
  options: ToolSearchOptions = DEFAULT_TOOL_SEARCH_OPTIONS
): Promise<ToolSearchResult[]> {
  const registry = await loadRegistry()

  let tools = registry.tools
  if (options.category) {
    tools = tools.filter((t) => t.category === options.category)
  }
  if (!options.includeDeferred) {
    tools = tools.filter((t) => !t.deferLoading)
  }

  if (tools.length === 0) {
    return []
  }

  const fuse = buildFuseIndex(tools)
  const threshold = options.threshold || 0.4

  const fuseResults = fuse.search(query)

  const results: ToolSearchResult[] = fuseResults
    .filter((r) => (r.score || 1) <= threshold)
    .slice(0, options.limit || 5)
    .map((r) => {
      const score = 1 - (r.score || 0)
      let confidence: 'high' | 'medium' | 'low' = 'low'
      if (score > 0.8) {
        confidence = 'high'
      } else if (score > 0.6) {
        confidence = 'medium'
      }

      return {
        tool: r.item,
        score,
        confidence,
        matchedTriggers: extractMatchedTriggers(r.matches, r.item),
      }
    })

  return results
}

export async function searchToolsWithFallback(
  query: string,
  options: ToolSearchOptions = DEFAULT_TOOL_SEARCH_OPTIONS
): Promise<ToolSearchResult[]> {
  const fuseResults = await searchTools(query, options)

  if (fuseResults.length > 0) {
    return fuseResults
  }

  const registry = await loadRegistry()
  let tools = registry.tools

  if (options.category) {
    tools = tools.filter((t) => t.category === options.category)
  }

  const lowerQuery = query.toLowerCase()
  const fallbackResults: ToolSearchResult[] = tools
    .filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.triggers.some((tr) => tr.toLowerCase().includes(lowerQuery))
    )
    .slice(0, options.limit || 5)
    .map((tool) => ({
      tool,
      score: 0.5,
      confidence: 'low' as const,
      matchedTriggers: tool.triggers.filter((tr) => tr.toLowerCase().includes(lowerQuery)),
    }))

  return fallbackResults
}

interface Frontmatter {
  name?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  deferLoading?: boolean
  dependencies?: string[]
  category?: string
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterStr = match[1]
  const body = content.slice(match[0].length).trim()

  const frontmatter: Frontmatter = {}

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) {
      continue
    }

    const key = line.slice(0, colonIndex).trim()
    let value: string | boolean | string[] = line.slice(colonIndex + 1).trim()

    if (value === 'true') {
      value = true
    } else if (value === 'false') {
      value = false
    } else if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
    } else {
      value = value.replace(/['"]/g, '')
    }

    ;(frontmatter as Record<string, unknown>)[key] = value
  }

  return { frontmatter, body }
}

function inferCategory(frontmatter: Frontmatter, filename: string): ToolCategory {
  if (frontmatter.category) {
    const cat = frontmatter.category.toLowerCase()
    if (Object.values(ToolCategory).includes(cat as ToolCategory)) {
      return cat as ToolCategory
    }
  }

  const name = (frontmatter.name || filename).toLowerCase()
  if (name.includes('test') || name.includes('spec')) {
    return ToolCategory.TESTING
  }
  if (name.includes('doc') || name.includes('readme')) {
    return ToolCategory.DOCUMENTATION
  }
  if (name.includes('deploy') || name.includes('release')) {
    return ToolCategory.DEPLOYMENT
  }
  if (name.includes('lint') || name.includes('format') || name.includes('review')) {
    return ToolCategory.QUALITY
  }
  if (name.includes('security') || name.includes('audit')) {
    return ToolCategory.SECURITY
  }
  if (name.includes('analyze') || name.includes('research')) {
    return ToolCategory.ANALYSIS
  }

  return ToolCategory.IMPLEMENTATION
}

export async function indexToolsFromDirectory(directory: string): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []

  try {
    const files = await fs.readdir(directory)

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue
      }

      const filepath = path.join(directory, file)
      const content = await fs.readFile(filepath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(content)

      const name = frontmatter.name || file.replace('.md', '')
      const description = frontmatter.description || extractDescriptionFromBody(body)

      tools.push({
        name,
        description,
        triggers: extractTriggers(description),
        category: inferCategory(frontmatter, file),
        priority: frontmatter.priority || 'medium',
        deferLoading: frontmatter.deferLoading ?? true,
        promptPath: filepath,
        dependencies: frontmatter.dependencies || [],
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  } catch {
    // Directory doesn't exist
  }

  return tools
}

function extractDescriptionFromBody(body: string): string {
  const lines = body.split('\n').filter((line) => line.trim() && !line.startsWith('#'))
  return lines.slice(0, 3).join(' ').slice(0, 200)
}

export async function indexAllTools(): Promise<number> {
  const agentTools = await indexToolsFromDirectory(AGENTS_DIR)
  const skillTools = await indexToolsFromDirectory(SKILLS_DIR)

  const allTools = [...agentTools, ...skillTools]

  const registry = await loadRegistry()
  registry.tools = allTools
  await saveRegistry(registry)

  return allTools.length
}

export async function getImmediateTools(): Promise<ToolDefinition[]> {
  const tools = await listTools()
  return tools.filter((t) => !t.deferLoading || t.priority === 'high')
}

export async function getDeferredTools(): Promise<ToolDefinition[]> {
  const tools = await listTools()
  return tools.filter((t) => t.deferLoading && t.priority !== 'high')
}

export function clearRegistryCache(): void {
  registryCache = null
}
