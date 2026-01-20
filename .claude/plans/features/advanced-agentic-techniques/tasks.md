# Task Breakdown: Advanced Agentic Techniques

**PRD:** [prd.md](./prd.md)
**Created:** 2026-01-14
**Total Tasks:** 24
**Estimated Effort:** ~40h

---

## Task Hierarchy

```
Epic: Advanced Agentic Techniques
├── Story 1: Memory Persistence System (Foundation)
│   ├── Task 1.1: Extend memory types and interfaces
│   ├── Task 1.2: Implement decision persistence
│   ├── Task 1.3: Create memory recall with fuzzy search
│   ├── Task 1.4: Implement auto-compaction
│   ├── Task 1.5: Add memory linking to features
│   └── Task 1.6: Create memory export command
│
├── Story 2: Spec-Driven Development (SDD)
│   ├── Task 2.1: Create spec schema with Zod
│   ├── Task 2.2: Implement spec template generator
│   ├── Task 2.3: Add spec validation command
│   ├── Task 2.4: Integrate spec gate in feature workflow
│   ├── Task 2.5: Create spec-to-code generation prompt
│   └── Task 2.6: Add --quick flag for simple features
│
├── Story 3: Tool Search Tool (Dynamic Discovery)
│   ├── Task 3.1: Create tool registry system
│   ├── Task 3.2: Implement tool indexing with metadata
│   ├── Task 3.3: Add fuzzy search with Fuse.js
│   ├── Task 3.4: Create tool registration command
│   ├── Task 3.5: Implement defer_loading pattern
│   └── Task 3.6: Add tool discovery to agent prompts
│
└── Story 4: Multi-Agent Parallel Execution
    ├── Task 4.1: Add simple-git dependency and worktree utils
    ├── Task 4.2: Create parallel execution orchestrator
    ├── Task 4.3: Implement conflict detection and resolution
    ├── Task 4.4: Add agent status tracking
    ├── Task 4.5: Create merge strategy for parallel results
    └── Task 4.6: Add graceful fallback to sequential
```

---

## Story 1: Memory Persistence System (Foundation)

> **Objetivo:** Criar sistema de memória que persiste decisões, padrões e contexto entre sessões.
> **Dependências:** Nenhuma (foundation)
> **Impacto:** Elimina ~20% de decisões repetidas entre sessões

---

### Task 1.1: Extend memory types and interfaces

**Type:** Technical | **Priority:** P0

**Description:**
Estender `src/types/memory.ts` com novos tipos para suportar decisões persistentes, categorização e metadata de busca.

**Acceptance Criteria:**
- [ ] Tipo `Decision` com campos: id, title, context, alternatives, rationale, tags, createdAt
- [ ] Tipo `DecisionCategory` enum: architecture, pattern, library, convention, security
- [ ] Tipo `MemorySearchResult` com score de relevância
- [ ] Interface `MemoryIndex` para indexação de busca
- [ ] Testes unitários para serialização/deserialização

**Technical Details:**
```typescript
interface Decision {
  id: string
  title: string
  context: string
  alternatives: string[]
  chosen: string
  rationale: string
  category: DecisionCategory
  tags: string[]
  relatedFeatures: string[]
  createdAt: string
  updatedAt: string
}

enum DecisionCategory {
  ARCHITECTURE = 'architecture',
  PATTERN = 'pattern',
  LIBRARY = 'library',
  CONVENTION = 'convention',
  SECURITY = 'security'
}

interface MemorySearchResult {
  decision: Decision
  score: number
  matchedFields: string[]
}
```

**Files to modify:**
- `src/types/memory.ts`

**Files to create:**
- `tests/types/memory.test.ts`

---

### Task 1.2: Implement decision persistence

**Type:** Feature | **Priority:** P0

**Description:**
Implementar funções para salvar, carregar e listar decisões em `.claude/memory/decisions/`.

**Acceptance Criteria:**
- [ ] Função `saveDecision(decision: Decision): Promise<void>`
- [ ] Função `loadDecision(id: string): Promise<Decision | null>`
- [ ] Função `listDecisions(category?: DecisionCategory): Promise<Decision[]>`
- [ ] Decisões salvas como `{id}.md` com YAML frontmatter
- [ ] Testes unitários com mocks de filesystem

**Technical Details:**
```typescript
async function saveDecision(decision: Decision): Promise<void> {
  const filename = `${decision.id}.md`
  const filepath = path.join('.claude/memory/decisions', filename)
  const content = serializeDecisionToMarkdown(decision)
  await fs.writeFile(filepath, content)
}

function serializeDecisionToMarkdown(decision: Decision): string {
  const frontmatter = yaml.stringify({
    id: decision.id,
    title: decision.title,
    category: decision.category,
    tags: decision.tags,
    createdAt: decision.createdAt
  })
  return `---\n${frontmatter}---\n\n# ${decision.title}\n\n## Context\n${decision.context}\n\n## Alternatives\n${decision.alternatives.map(a => `- ${a}`).join('\n')}\n\n## Decision\n${decision.chosen}\n\n## Rationale\n${decision.rationale}`
}
```

**Files to create:**
- `src/utils/decision-utils.ts`
- `tests/utils/decision-utils.test.ts`

**Dependencies:**
- Task 1.1

---

### Task 1.3: Create memory recall with fuzzy search

**Type:** Feature | **Priority:** P0

**Description:**
Implementar comando `adk memory recall <query>` que busca decisões relevantes usando fuzzy search.

**Acceptance Criteria:**
- [ ] Comando `adk memory recall <query>` funcional
- [ ] Busca em título, context, rationale e tags
- [ ] Retorna top 5 resultados com score > 0.3
- [ ] Output formatado com highlight de matches
- [ ] Flag `--category` para filtrar por categoria
- [ ] Testes de integração

**Technical Details:**
```typescript
import Fuse from 'fuse.js'

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'context', weight: 0.2 },
    { name: 'rationale', weight: 0.2 },
    { name: 'tags', weight: 0.2 }
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true
}

async function recallMemory(query: string, category?: DecisionCategory): Promise<MemorySearchResult[]> {
  const decisions = await listDecisions(category)
  const fuse = new Fuse(decisions, fuseOptions)
  return fuse.search(query).slice(0, 5).map(result => ({
    decision: result.item,
    score: 1 - (result.score || 0),
    matchedFields: result.matches?.map(m => m.key) || []
  }))
}
```

**Dependencies:**
- Task 1.1, Task 1.2
- npm: `fuse.js`

**Files to modify:**
- `src/commands/memory.ts`
- `src/cli.ts`

**Files to create:**
- `src/utils/memory-search.ts`
- `tests/utils/memory-search.test.ts`

---

### Task 1.4: Implement auto-compaction

**Type:** Feature | **Priority:** P1

**Description:**
Implementar compactação automática de memória quando arquivo excede limite (1000 linhas ou 50KB).

**Acceptance Criteria:**
- [ ] Detecta automaticamente quando memória excede limite
- [ ] Compacta preservando: decisões, patterns, risks críticos
- [ ] Arquiva versão completa em `.claude/memory/archive/`
- [ ] Log de compactação com estatísticas (antes/depois)
- [ ] Threshold configurável via `.claude/config.json`
- [ ] Testes unitários

**Technical Details:**
```typescript
interface CompactionConfig {
  maxLines: number      // default: 1000
  maxSizeKB: number     // default: 50
  preserveDecisions: boolean  // default: true
  archivePath: string   // default: .claude/memory/archive
}

async function shouldCompact(memoryPath: string, config: CompactionConfig): Promise<boolean> {
  const stats = await fs.stat(memoryPath)
  const content = await fs.readFile(memoryPath, 'utf-8')
  const lines = content.split('\n').length
  return lines > config.maxLines || stats.size > config.maxSizeKB * 1024
}

async function compactMemory(feature: string, config: CompactionConfig): Promise<CompactionResult> {
  // 1. Archive original
  // 2. Extract essentials (decisions, patterns, risks)
  // 3. Generate compacted version via Claude
  // 4. Save compacted version
  // 5. Return stats
}
```

**Files to modify:**
- `src/utils/memory-utils.ts`
- `src/commands/memory.ts`

**Files to create:**
- `src/utils/memory-compaction.ts`
- `tests/utils/memory-compaction.test.ts`

**Dependencies:**
- Task 1.2

---

### Task 1.5: Add memory linking to features

**Type:** Feature | **Priority:** P1

**Description:**
Implementar comando `adk memory link <feature> <decision-id>` e carregamento automático de decisões relacionadas.

**Acceptance Criteria:**
- [ ] Comando `adk memory link <feature> <decision-id>` funcional
- [ ] Atualiza `relatedFeatures` na decisão
- [ ] Atualiza `context.md` da feature com referência
- [ ] Auto-load de decisões relacionadas no início de feature workflow
- [ ] Comando `adk memory unlink` para remover vínculo
- [ ] Testes de integração

**Technical Details:**
```typescript
async function linkDecisionToFeature(featureName: string, decisionId: string): Promise<void> {
  // 1. Load decision
  const decision = await loadDecision(decisionId)
  if (!decision) throw new Error(`Decision ${decisionId} not found`)

  // 2. Update decision's relatedFeatures
  decision.relatedFeatures.push(featureName)
  await saveDecision(decision)

  // 3. Update feature's context.md
  const contextPath = `.claude/plans/features/${featureName}/context.md`
  await appendToContext(contextPath, `\n## Related Decisions\n- [${decision.title}](../../memory/decisions/${decisionId}.md)`)
}

async function loadRelatedDecisions(featureName: string): Promise<Decision[]> {
  const decisions = await listDecisions()
  return decisions.filter(d => d.relatedFeatures.includes(featureName))
}
```

**Files to modify:**
- `src/commands/memory.ts`
- `src/commands/feature.ts` (auto-load no início)
- `src/cli.ts`

**Dependencies:**
- Task 1.2

---

### Task 1.6: Create memory export command

**Type:** Feature | **Priority:** P2

**Description:**
Implementar `adk memory export` para exportar base de conhecimento em formato portável.

**Acceptance Criteria:**
- [ ] Comando `adk memory export [--format json|md]` funcional
- [ ] Export inclui: decisions, patterns, project-context
- [ ] Formato JSON é importável em outro projeto
- [ ] Formato Markdown é legível standalone
- [ ] Flag `--output <path>` para destino customizado
- [ ] Testes unitários

**Technical Details:**
```typescript
interface MemoryExport {
  exportedAt: string
  projectName: string
  decisions: Decision[]
  patterns: Pattern[]
  projectContext: string
}

async function exportMemory(format: 'json' | 'md', outputPath?: string): Promise<string> {
  const exportData: MemoryExport = {
    exportedAt: new Date().toISOString(),
    projectName: await getProjectName(),
    decisions: await listDecisions(),
    patterns: await listPatterns(),
    projectContext: await readProjectContext()
  }

  const content = format === 'json'
    ? JSON.stringify(exportData, null, 2)
    : serializeExportToMarkdown(exportData)

  const finalPath = outputPath || `.claude/exports/memory-${Date.now()}.${format}`
  await fs.writeFile(finalPath, content)
  return finalPath
}
```

**Files to modify:**
- `src/commands/memory.ts`
- `src/cli.ts`

**Dependencies:**
- Task 1.2

---

## Story 2: Spec-Driven Development (SDD)

> **Objetivo:** Workflow que exige especificações detalhadas antes de qualquer implementação.
> **Dependências:** Story 1 (memory para persistir specs)
> **Impacto:** Reduz retrabalho de ~30% para <15%

---

### Task 2.1: Create spec schema with Zod

**Type:** Technical | **Priority:** P0

**Description:**
Criar schema Zod para validação de especificações, garantindo campos obrigatórios.

**Acceptance Criteria:**
- [ ] Schema `SpecSchema` com validação de campos obrigatórios
- [ ] Campos: inputs, outputs, behaviors, edgeCases, acceptanceCriteria
- [ ] Validação de formato Gherkin para acceptanceCriteria
- [ ] Mensagens de erro claras e acionáveis
- [ ] Testes unitários para cada regra de validação

**Technical Details:**
```typescript
import { z } from 'zod'

const GherkinScenarioSchema = z.object({
  name: z.string().min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1)
})

const SpecSchema = z.object({
  feature: z.string().min(1),
  description: z.string().min(10),
  inputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    required: z.boolean().default(true),
    validation: z.string().optional()
  })).min(1),
  outputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string()
  })).min(1),
  behaviors: z.array(z.string()).min(1),
  edgeCases: z.array(z.object({
    scenario: z.string(),
    expectedBehavior: z.string()
  })).min(1),
  acceptanceCriteria: z.array(GherkinScenarioSchema).min(1),
  nonFunctional: z.object({
    performance: z.string().optional(),
    security: z.string().optional(),
    scalability: z.string().optional()
  }).optional()
})

type Spec = z.infer<typeof SpecSchema>
```

**Files to create:**
- `src/types/spec.ts`
- `src/utils/spec-validator.ts`
- `tests/utils/spec-validator.test.ts`

**Dependencies:**
- npm: `zod`

---

### Task 2.2: Implement spec template generator

**Type:** Feature | **Priority:** P0

**Description:**
Criar comando `adk spec create <feature>` que gera template interativo de especificação.

**Acceptance Criteria:**
- [ ] Comando `adk spec create <feature>` funcional
- [ ] Prompt interativo (Inquirer) para cada seção
- [ ] Gera `spec.md` em formato estruturado
- [ ] Inclui exemplos inline para guiar preenchimento
- [ ] Flag `--from-prd` para extrair base do PRD existente
- [ ] Testes de integração

**Technical Details:**
```typescript
async function createSpec(featureName: string, options: { fromPrd?: boolean }): Promise<void> {
  const spinner = ora('Creating spec...').start()

  const questions = [
    {
      type: 'input',
      name: 'description',
      message: 'Describe the feature in one paragraph:',
      validate: (input: string) => input.length >= 10 || 'Description must be at least 10 characters'
    },
    {
      type: 'editor',
      name: 'inputs',
      message: 'Define inputs (one per line, format: name:type - description):',
    },
    // ... more questions for outputs, behaviors, edgeCases, acceptanceCriteria
  ]

  const answers = await inquirer.prompt(questions)
  const spec = buildSpecFromAnswers(answers)
  const markdown = serializeSpecToMarkdown(spec)

  await fs.writeFile(`.claude/plans/features/${featureName}/spec.md`, markdown)
  spinner.succeed('Spec created successfully')
}
```

**Files to create:**
- `src/commands/spec.ts`
- `templates/spec-template.md`
- `tests/commands/spec.test.ts`

**Files to modify:**
- `src/cli.ts`

**Dependencies:**
- Task 2.1

---

### Task 2.3: Add spec validation command

**Type:** Feature | **Priority:** P0

**Description:**
Implementar `adk spec validate <feature>` que valida spec contra schema Zod.

**Acceptance Criteria:**
- [ ] Comando `adk spec validate <feature>` funcional
- [ ] Reporta erros com linha e campo específico
- [ ] Exit code 0 se válido, 1 se inválido
- [ ] Flag `--fix` para tentar corrigir problemas simples
- [ ] Output colorido com ✅/❌ por seção
- [ ] Testes de integração

**Technical Details:**
```typescript
async function validateSpec(featureName: string, options: { fix?: boolean }): Promise<ValidationResult> {
  const specPath = `.claude/plans/features/${featureName}/spec.md`

  if (!await fs.pathExists(specPath)) {
    return { valid: false, errors: [{ field: 'spec', message: 'Spec file not found' }] }
  }

  const specContent = await fs.readFile(specPath, 'utf-8')
  const spec = parseMarkdownToSpec(specContent)

  const result = SpecSchema.safeParse(spec)

  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }))

    if (options.fix) {
      // Attempt to fix simple issues
      return await attemptAutoFix(spec, errors, specPath)
    }

    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}
```

**Files to modify:**
- `src/commands/spec.ts`
- `src/cli.ts`

**Dependencies:**
- Task 2.1, Task 2.2

---

### Task 2.4: Integrate spec gate in feature workflow

**Type:** Feature | **Priority:** P0

**Description:**
Modificar `feature plan` e `feature implement` para exigir spec válida antes de prosseguir.

**Acceptance Criteria:**
- [ ] `adk feature plan` verifica se spec.md existe e é válida
- [ ] Bloqueia com mensagem clara se spec inválida
- [ ] `adk feature implement` também valida spec
- [ ] Spec é incluída automaticamente no prompt do agente
- [ ] Flag `--skip-spec` para casos emergenciais (com warning)
- [ ] Testes de integração

**Technical Details:**
```typescript
async function validateSpecGate(featureName: string, options: { skipSpec?: boolean }): Promise<boolean> {
  if (options.skipSpec) {
    logger.warn('⚠️  Skipping spec validation. This may lead to implementation issues.')
    return true
  }

  const validation = await validateSpec(featureName, { fix: false })

  if (!validation.valid) {
    logger.error('❌ Spec validation failed:')
    validation.errors.forEach(e => logger.error(`  - ${e.field}: ${e.message}`))
    logger.info('Run "adk spec validate --fix" to attempt auto-fix')
    return false
  }

  logger.success('✅ Spec validation passed')
  return true
}

// In feature.ts plan() method:
async plan(name: string, options: PlanOptions): Promise<void> {
  // ... existing checks ...

  if (!await validateSpecGate(name, options)) {
    process.exit(1)
  }

  // ... continue with planning ...
}
```

**Files to modify:**
- `src/commands/feature.ts`

**Dependencies:**
- Task 2.3

---

### Task 2.5: Create spec-to-code generation prompt

**Type:** Feature | **Priority:** P1

**Description:**
Implementar `adk spec generate <feature>` que gera código estrutural a partir da spec.

**Acceptance Criteria:**
- [ ] Comando `adk spec generate <feature>` funcional
- [ ] Gera scaffolding: interfaces, tipos, function signatures
- [ ] Inclui TODOs nos bodies das funções
- [ ] Gera testes skeleton baseados em acceptanceCriteria
- [ ] Respeita patterns existentes do projeto
- [ ] Testes de integração

**Technical Details:**
```typescript
function buildSpecToCodePrompt(spec: Spec, projectContext: string): string {
  return `
TASK: Generate code scaffolding from specification

SPEC:
${serializeSpecToMarkdown(spec)}

PROJECT CONTEXT:
${projectContext}

REQUIREMENTS:
1. Generate TypeScript interfaces for all inputs/outputs
2. Create function signatures (no implementation, just TODO comments)
3. Generate test file with describe blocks for each acceptanceCriteria
4. Follow existing project patterns from context

OUTPUT:
1. src/types/${spec.feature}.ts - Interfaces
2. src/${spec.feature}.ts - Function signatures with TODOs
3. tests/${spec.feature}.test.ts - Test scaffolding

IMPORTANT:
- Do NOT implement logic, only scaffolding
- Each function body should be: throw new Error('TODO: implement')
- Each test should be: it.todo('scenario description')
`
}
```

**Files to modify:**
- `src/commands/spec.ts`
- `src/cli.ts`

**Dependencies:**
- Task 2.1, Task 2.2

---

### Task 2.6: Add --quick flag for simple features

**Type:** Feature | **Priority:** P2

**Description:**
Adicionar flag `--quick` ao workflow para bypass de SDD em features muito simples.

**Acceptance Criteria:**
- [ ] Flag `--quick` em `adk feature new`
- [ ] Skip spec creation/validation com warning
- [ ] Registra em memory que feature foi "quick" (para tracking)
- [ ] Recomendação de threshold: features < 2 files ou < 50 LOC
- [ ] Testes unitários

**Technical Details:**
```typescript
interface QuickModeMetrics {
  feature: string
  usedQuickMode: boolean
  estimatedComplexity: 'simple' | 'medium' | 'complex'
  actualFiles: number
  actualLOC: number
}

async function shouldRecommendQuickMode(featureName: string): Promise<boolean> {
  // Heuristics for quick mode recommendation
  const prd = await loadPRD(featureName)
  const estimatedFiles = estimateFilesFromPRD(prd)
  const estimatedLOC = estimateLOCFromPRD(prd)

  return estimatedFiles <= 2 && estimatedLOC <= 50
}
```

**Files to modify:**
- `src/commands/feature.ts`
- `src/cli.ts`

**Dependencies:**
- Task 2.4

---

## Story 3: Tool Search Tool (Dynamic Discovery)

> **Objetivo:** Meta-tool que permite descobrir e carregar tools sob demanda.
> **Dependências:** Nenhuma
> **Impacto:** Reduz overhead de contexto em prompts complexos

---

### Task 3.1: Create tool registry system

**Type:** Technical | **Priority:** P0

**Description:**
Criar sistema de registro de tools com metadata para descoberta.

**Acceptance Criteria:**
- [ ] Interface `ToolDefinition` com name, description, triggers, priority
- [ ] Função `registerTool(tool: ToolDefinition): void`
- [ ] Função `getTool(name: string): ToolDefinition | null`
- [ ] Função `listTools(): ToolDefinition[]`
- [ ] Tools registradas em `.claude/tools/registry.json`
- [ ] Testes unitários

**Technical Details:**
```typescript
interface ToolDefinition {
  name: string
  description: string
  triggers: string[]        // Keywords that trigger this tool
  category: ToolCategory
  priority: 'high' | 'medium' | 'low'
  deferLoading: boolean     // Load on-demand vs upfront
  promptPath: string        // Path to tool prompt/instructions
  dependencies: string[]    // Other tools this depends on
}

enum ToolCategory {
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  DEPLOYMENT = 'deployment'
}

const registry: Map<string, ToolDefinition> = new Map()

function registerTool(tool: ToolDefinition): void {
  registry.set(tool.name, tool)
  persistRegistry()
}
```

**Files to create:**
- `src/types/tool.ts`
- `src/utils/tool-registry.ts`
- `tests/utils/tool-registry.test.ts`

---

### Task 3.2: Implement tool indexing with metadata

**Type:** Feature | **Priority:** P0

**Description:**
Implementar indexação automática de tools existentes em `.claude/agents/` e `.claude/skills/`.

**Acceptance Criteria:**
- [ ] Scan automático de `.claude/agents/*.md`
- [ ] Scan automático de `.claude/skills/*.md`
- [ ] Extração de metadata do YAML frontmatter
- [ ] Geração de triggers a partir de description
- [ ] Comando `adk tool index` para re-indexar
- [ ] Testes de integração

**Technical Details:**
```typescript
async function indexTools(): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []

  // Index agents
  const agentFiles = await glob('.claude/agents/*.md')
  for (const file of agentFiles) {
    const content = await fs.readFile(file, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(content)

    tools.push({
      name: frontmatter.name,
      description: frontmatter.description,
      triggers: extractTriggers(frontmatter.description),
      category: inferCategory(frontmatter),
      priority: frontmatter.priority || 'medium',
      deferLoading: frontmatter.deferLoading ?? true,
      promptPath: file,
      dependencies: frontmatter.dependencies || []
    })
  }

  // Index skills
  const skillFiles = await glob('.claude/skills/*.md')
  // ... similar logic

  return tools
}

function extractTriggers(description: string): string[] {
  // Use NLP-ish heuristics to extract keywords
  const stopwords = ['the', 'a', 'an', 'is', 'are', 'for', 'to', 'and', 'or']
  return description
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3 && !stopwords.includes(word))
}
```

**Files to modify:**
- `src/utils/tool-registry.ts`
- `src/cli.ts`

**Files to create:**
- `src/commands/tool.ts`

**Dependencies:**
- Task 3.1

---

### Task 3.3: Add fuzzy search with Fuse.js

**Type:** Feature | **Priority:** P0

**Description:**
Implementar busca fuzzy de tools usando Fuse.js.

**Acceptance Criteria:**
- [ ] Busca por nome, description, triggers
- [ ] Threshold de similaridade configurável (default: 0.4)
- [ ] Retorna top N resultados ordenados por score
- [ ] Suporta busca por categoria
- [ ] Testes unitários

**Technical Details:**
```typescript
import Fuse from 'fuse.js'

const fuseOptions: Fuse.IFuseOptions<ToolDefinition> = {
  keys: [
    { name: 'name', weight: 0.3 },
    { name: 'description', weight: 0.3 },
    { name: 'triggers', weight: 0.4 }
  ],
  threshold: 0.4,
  includeScore: true
}

function searchTools(query: string, options?: SearchOptions): ToolSearchResult[] {
  const tools = listTools()
  const fuse = new Fuse(tools, fuseOptions)

  let results = fuse.search(query)

  if (options?.category) {
    results = results.filter(r => r.item.category === options.category)
  }

  return results.slice(0, options?.limit || 5).map(r => ({
    tool: r.item,
    score: 1 - (r.score || 0),
    confidence: r.score < 0.2 ? 'high' : r.score < 0.4 ? 'medium' : 'low'
  }))
}
```

**Files to modify:**
- `src/utils/tool-registry.ts`

**Dependencies:**
- Task 3.1, Task 3.2
- npm: `fuse.js` (já adicionado em Story 1)

---

### Task 3.4: Create tool registration command

**Type:** Feature | **Priority:** P1

**Description:**
Implementar `adk tool register <name>` para registrar tools customizadas.

**Acceptance Criteria:**
- [ ] Comando `adk tool register <name>` funcional
- [ ] Prompt interativo para metadata
- [ ] Valida que promptPath existe
- [ ] Atualiza registry.json
- [ ] Flag `--from-file <path>` para bulk register
- [ ] Testes de integração

**Technical Details:**
```typescript
async function registerToolCommand(name: string, options: RegisterOptions): Promise<void> {
  const spinner = ora('Registering tool...').start()

  if (options.fromFile) {
    const tools = await loadToolsFromFile(options.fromFile)
    for (const tool of tools) {
      registerTool(tool)
    }
    spinner.succeed(`Registered ${tools.length} tools`)
    return
  }

  const questions = [
    { type: 'input', name: 'description', message: 'Tool description:' },
    { type: 'input', name: 'promptPath', message: 'Path to tool prompt:' },
    { type: 'checkbox', name: 'category', message: 'Category:', choices: Object.values(ToolCategory) },
    { type: 'confirm', name: 'deferLoading', message: 'Load on-demand?', default: true }
  ]

  const answers = await inquirer.prompt(questions)
  const triggers = extractTriggers(answers.description)

  registerTool({
    name,
    ...answers,
    triggers,
    priority: 'medium',
    dependencies: []
  })

  spinner.succeed(`Tool "${name}" registered`)
}
```

**Files to modify:**
- `src/commands/tool.ts`
- `src/cli.ts`

**Dependencies:**
- Task 3.1

---

### Task 3.5: Implement defer_loading pattern

**Type:** Feature | **Priority:** P1

**Description:**
Implementar padrão de carregamento sob demanda de tools nos prompts de agentes.

**Acceptance Criteria:**
- [ ] Tools com `deferLoading: true` não são incluídas no prompt inicial
- [ ] Prompt inclui "Tool Search" como meta-tool disponível
- [ ] Quando agente invoca Tool Search, carrega tool dinamicamente
- [ ] Tracking de tools carregadas por sessão
- [ ] Testes de integração

**Technical Details:**
```typescript
function buildAgentPromptWithDeferredTools(agent: string, context: string): string {
  const allTools = listTools()
  const immediateTools = allTools.filter(t => !t.deferLoading || t.priority === 'high')
  const deferredTools = allTools.filter(t => t.deferLoading && t.priority !== 'high')

  return `
${context}

## Available Tools (Loaded)
${immediateTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## Tool Search (Meta-Tool)
If you need a capability not listed above, use Tool Search:
\`\`\`
TOOL_SEARCH: <describe what you need>
\`\`\`

Available on-demand tools: ${deferredTools.map(t => t.name).join(', ')}

When Tool Search returns a tool, it will be loaded and you can use it immediately.
`
}

async function handleToolSearchRequest(query: string): Promise<ToolDefinition | null> {
  const results = searchTools(query, { limit: 1 })

  if (results.length === 0 || results[0].confidence === 'low') {
    return null
  }

  const tool = results[0].tool
  // Load tool prompt content
  const toolContent = await fs.readFile(tool.promptPath, 'utf-8')

  return { ...tool, loadedContent: toolContent }
}
```

**Files to modify:**
- `src/utils/claude.ts`
- `src/utils/tool-registry.ts`

**Dependencies:**
- Task 3.3

---

### Task 3.6: Add tool discovery to agent prompts

**Type:** Feature | **Priority:** P1

**Description:**
Integrar Tool Search nos prompts de todos os agentes existentes.

**Acceptance Criteria:**
- [ ] Todos os agentes incluem seção "Tool Search"
- [ ] Agentes podem descobrir tools dinamicamente
- [ ] Log de tools descobertas/carregadas
- [ ] Métricas de uso de Tool Search
- [ ] Testes de integração

**Technical Details:**
```typescript
// Update agent execution to include tool search capability
async function executeAgentWithToolSearch(agentName: string, context: string): Promise<void> {
  const agent = await loadAgent(agentName)
  const promptWithTools = buildAgentPromptWithDeferredTools(agentName, context)

  const fullPrompt = `
${agent.instructions}

${promptWithTools}

IMPORTANT: If you need a tool not listed in "Available Tools", use Tool Search before attempting the action.
`

  await executeClaudeCommand(fullPrompt)
}
```

**Files to modify:**
- `src/commands/agent.ts`
- `src/utils/claude.ts`

**Dependencies:**
- Task 3.5

---

## Story 4: Multi-Agent Parallel Execution

> **Objetivo:** Permitir execução de múltiplos agentes em paralelo usando git worktrees.
> **Dependências:** Stories 1-3 (optional but recommended)
> **Impacto:** Reduz tempo de feature em ~50%

---

### Task 4.1: Add simple-git dependency and worktree utils

**Type:** Technical | **Priority:** P0

**Description:**
Adicionar dependência `simple-git` e criar utilitários para gerenciar worktrees.

**Acceptance Criteria:**
- [ ] Dependência `simple-git` instalada
- [ ] Função `createWorktree(branch: string, path: string): Promise<void>`
- [ ] Função `removeWorktree(path: string): Promise<void>`
- [ ] Função `listWorktrees(): Promise<Worktree[]>`
- [ ] Validação de git version >= 2.20
- [ ] Testes unitários com mocks

**Technical Details:**
```typescript
import simpleGit, { SimpleGit } from 'simple-git'

interface Worktree {
  path: string
  branch: string
  commit: string
}

async function createWorktree(branch: string, worktreePath: string): Promise<void> {
  const git = simpleGit()

  // Check git version
  const version = await git.version()
  if (!isVersionAtLeast(version, '2.20')) {
    throw new Error('Git >= 2.20 required for worktree support')
  }

  // Create branch if doesn't exist
  const branches = await git.branchLocal()
  if (!branches.all.includes(branch)) {
    await git.checkoutLocalBranch(branch)
    await git.checkout('main') // Return to main
  }

  // Create worktree
  await git.raw(['worktree', 'add', worktreePath, branch])
}

async function removeWorktree(worktreePath: string): Promise<void> {
  const git = simpleGit()
  await git.raw(['worktree', 'remove', worktreePath, '--force'])
}
```

**Files to create:**
- `src/utils/worktree-utils.ts`
- `tests/utils/worktree-utils.test.ts`

**Dependencies:**
- npm: `simple-git`

---

### Task 4.2: Create parallel execution orchestrator

**Type:** Feature | **Priority:** P0

**Description:**
Implementar orquestrador que executa múltiplos agentes em paralelo.

**Acceptance Criteria:**
- [ ] Função `executeParallel(agents: string[], feature: string): Promise<ParallelResult>`
- [ ] Cria worktree isolado para cada agente
- [ ] Limita paralelismo via `--max-agents N`
- [ ] Coleta resultados de todos os agentes
- [ ] Cleanup de worktrees após execução
- [ ] Testes de integração

**Technical Details:**
```typescript
interface ParallelConfig {
  maxAgents: number      // default: 3
  timeout: number        // per agent, in ms
  cleanupOnError: boolean
}

interface ParallelResult {
  success: boolean
  agentResults: AgentResult[]
  duration: number
  conflicts: ConflictInfo[]
}

async function executeParallel(
  agents: string[],
  feature: string,
  config: ParallelConfig
): Promise<ParallelResult> {
  const startTime = Date.now()
  const results: AgentResult[] = []
  const worktrees: string[] = []

  // Chunk agents by maxAgents
  const chunks = chunkArray(agents, config.maxAgents)

  for (const chunk of chunks) {
    const promises = chunk.map(async (agent, index) => {
      const worktreePath = `.worktrees/${feature}-${agent}-${index}`
      const branch = `${feature}/${agent}`

      await createWorktree(branch, worktreePath)
      worktrees.push(worktreePath)

      try {
        const result = await executeAgentInWorktree(agent, feature, worktreePath, config.timeout)
        return { agent, success: true, result }
      } catch (error) {
        return { agent, success: false, error: String(error) }
      }
    })

    const chunkResults = await Promise.all(promises)
    results.push(...chunkResults)
  }

  // Cleanup worktrees
  for (const wt of worktrees) {
    await removeWorktree(wt)
  }

  return {
    success: results.every(r => r.success),
    agentResults: results,
    duration: Date.now() - startTime,
    conflicts: await detectConflicts(results)
  }
}
```

**Files to create:**
- `src/utils/parallel-executor.ts`
- `tests/utils/parallel-executor.test.ts`

**Dependencies:**
- Task 4.1

---

### Task 4.3: Implement conflict detection and resolution

**Type:** Feature | **Priority:** P0

**Description:**
Implementar detecção de conflitos entre branches de agentes paralelos.

**Acceptance Criteria:**
- [ ] Detecta arquivos modificados por múltiplos agentes
- [ ] Classifica conflitos: none, auto-resolvable, manual-required
- [ ] Tenta auto-merge para conflitos simples
- [ ] Reporta conflitos manuais com diff
- [ ] Testes unitários

**Technical Details:**
```typescript
interface ConflictInfo {
  file: string
  agents: string[]
  type: 'none' | 'auto-resolvable' | 'manual-required'
  diff?: string
}

async function detectConflicts(results: AgentResult[]): Promise<ConflictInfo[]> {
  const fileChanges: Map<string, string[]> = new Map()

  // Collect changed files per agent
  for (const result of results) {
    if (!result.success) continue

    const changedFiles = await getChangedFiles(result.branch)
    for (const file of changedFiles) {
      const agents = fileChanges.get(file) || []
      agents.push(result.agent)
      fileChanges.set(file, agents)
    }
  }

  // Analyze conflicts
  const conflicts: ConflictInfo[] = []

  for (const [file, agents] of fileChanges) {
    if (agents.length > 1) {
      const type = await classifyConflict(file, agents)
      conflicts.push({
        file,
        agents,
        type,
        diff: type === 'manual-required' ? await generateDiff(file, agents) : undefined
      })
    }
  }

  return conflicts
}

async function classifyConflict(file: string, agents: string[]): Promise<ConflictInfo['type']> {
  // Heuristics:
  // - Different sections of file = auto-resolvable
  // - Same lines modified = manual-required
  // - One adds, one modifies different part = auto-resolvable
}
```

**Files to create:**
- `src/utils/conflict-resolver.ts`
- `tests/utils/conflict-resolver.test.ts`

**Dependencies:**
- Task 4.1

---

### Task 4.4: Add agent status tracking

**Type:** Feature | **Priority:** P1

**Description:**
Implementar `adk agent status` para visualizar agentes em execução.

**Acceptance Criteria:**
- [ ] Comando `adk agent status` funcional
- [ ] Mostra agentes em execução, completed, failed
- [ ] Mostra tempo decorrido por agente
- [ ] Flag `--watch` para atualização em tempo real
- [ ] Persiste status em `.claude/agent-status.json`
- [ ] Testes de integração

**Technical Details:**
```typescript
interface AgentStatus {
  id: string
  agent: string
  feature: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  duration?: number
  worktree?: string
  error?: string
}

async function getAgentStatus(): Promise<AgentStatus[]> {
  const statusPath = '.claude/agent-status.json'
  if (!await fs.pathExists(statusPath)) {
    return []
  }
  return JSON.parse(await fs.readFile(statusPath, 'utf-8'))
}

async function updateAgentStatus(id: string, update: Partial<AgentStatus>): Promise<void> {
  const statuses = await getAgentStatus()
  const index = statuses.findIndex(s => s.id === id)
  if (index >= 0) {
    statuses[index] = { ...statuses[index], ...update }
  } else {
    statuses.push({ id, ...update } as AgentStatus)
  }
  await fs.writeFile('.claude/agent-status.json', JSON.stringify(statuses, null, 2))
}

function displayAgentStatus(statuses: AgentStatus[]): void {
  console.log('\n📊 Agent Status\n')

  for (const status of statuses) {
    const icon = status.status === 'completed' ? '✅'
               : status.status === 'running' ? '🔄'
               : status.status === 'failed' ? '❌'
               : '⏳'

    const duration = status.duration
      ? `(${(status.duration / 1000).toFixed(1)}s)`
      : status.startedAt
        ? `(${((Date.now() - new Date(status.startedAt).getTime()) / 1000).toFixed(1)}s)`
        : ''

    console.log(`${icon} ${status.agent} - ${status.feature} ${duration}`)
  }
}
```

**Files to create:**
- `src/utils/agent-status.ts`

**Files to modify:**
- `src/commands/agent.ts`
- `src/cli.ts`

**Dependencies:**
- Task 4.2

---

### Task 4.5: Create merge strategy for parallel results

**Type:** Feature | **Priority:** P1

**Description:**
Implementar estratégia de merge para combinar resultados de agentes paralelos.

**Acceptance Criteria:**
- [ ] Merge automático para conflitos auto-resolvable
- [ ] Commit por agente preserva autoria
- [ ] Merge final na branch principal da feature
- [ ] Rollback se merge falhar
- [ ] Flag `--no-merge` para skip de merge automático
- [ ] Testes de integração

**Technical Details:**
```typescript
interface MergeStrategy {
  autoMerge: boolean
  preserveCommits: boolean
  squashOnConflict: boolean
  targetBranch: string
}

async function mergeParallelResults(
  feature: string,
  results: ParallelResult,
  strategy: MergeStrategy
): Promise<MergeResult> {
  const git = simpleGit()

  // Checkout target branch
  await git.checkout(strategy.targetBranch)

  const mergeResults: BranchMergeResult[] = []

  for (const agentResult of results.agentResults) {
    if (!agentResult.success) continue

    try {
      if (strategy.preserveCommits) {
        await git.merge([agentResult.branch, '--no-ff'])
      } else {
        await git.merge([agentResult.branch, '--squash'])
        await git.commit(`merge: ${agentResult.agent} for ${feature}`)
      }

      mergeResults.push({ branch: agentResult.branch, success: true })
    } catch (error) {
      // Attempt auto-resolve or abort
      const conflict = results.conflicts.find(c =>
        c.agents.includes(agentResult.agent) && c.type === 'auto-resolvable'
      )

      if (conflict && strategy.autoMerge) {
        await autoResolveConflict(conflict)
        await git.add('.')
        await git.commit(`merge: ${agentResult.agent} (auto-resolved)`)
        mergeResults.push({ branch: agentResult.branch, success: true, autoResolved: true })
      } else {
        await git.merge(['--abort'])
        mergeResults.push({ branch: agentResult.branch, success: false, error: String(error) })
      }
    }
  }

  return {
    success: mergeResults.every(r => r.success),
    mergeResults
  }
}
```

**Files to create:**
- `src/utils/merge-strategy.ts`
- `tests/utils/merge-strategy.test.ts`

**Dependencies:**
- Task 4.3

---

### Task 4.6: Add graceful fallback to sequential

**Type:** Feature | **Priority:** P2

**Description:**
Implementar fallback automático para execução sequencial quando paralelo falha.

**Acceptance Criteria:**
- [ ] Detecta falhas em execução paralela
- [ ] Oferece opção de retry sequencial
- [ ] Flag `--fallback-sequential` para auto-fallback
- [ ] Log detalhado de razão do fallback
- [ ] Métricas de fallbacks para análise
- [ ] Testes de integração

**Technical Details:**
```typescript
interface FallbackConfig {
  autoFallback: boolean
  maxRetries: number
  retryDelay: number
}

async function executeWithFallback(
  agents: string[],
  feature: string,
  parallelConfig: ParallelConfig,
  fallbackConfig: FallbackConfig
): Promise<ExecutionResult> {
  // Attempt parallel execution
  try {
    const result = await executeParallel(agents, feature, parallelConfig)

    if (result.success) {
      return { mode: 'parallel', result }
    }

    // Check if fallback should trigger
    const failedAgents = result.agentResults.filter(r => !r.success)
    const hasConflicts = result.conflicts.some(c => c.type === 'manual-required')

    if (fallbackConfig.autoFallback && (failedAgents.length > 0 || hasConflicts)) {
      logger.warn('⚠️ Parallel execution had issues. Falling back to sequential...')
      logger.info(`Reason: ${failedAgents.length} failed agents, ${result.conflicts.length} conflicts`)

      return await executeSequentialFallback(agents, feature, fallbackConfig)
    }

    return { mode: 'parallel', result, needsManualIntervention: true }

  } catch (error) {
    if (fallbackConfig.autoFallback) {
      logger.error('Parallel execution failed completely. Falling back to sequential...')
      return await executeSequentialFallback(agents, feature, fallbackConfig)
    }
    throw error
  }
}

async function executeSequentialFallback(
  agents: string[],
  feature: string,
  config: FallbackConfig
): Promise<ExecutionResult> {
  const results: AgentResult[] = []

  for (const agent of agents) {
    let retries = 0
    let success = false

    while (!success && retries < config.maxRetries) {
      try {
        const result = await executeAgent(agent, feature)
        results.push({ agent, success: true, result })
        success = true
      } catch (error) {
        retries++
        if (retries < config.maxRetries) {
          await sleep(config.retryDelay)
        } else {
          results.push({ agent, success: false, error: String(error) })
        }
      }
    }
  }

  return { mode: 'sequential', results }
}
```

**Files to modify:**
- `src/utils/parallel-executor.ts`
- `src/commands/agent.ts`

**Dependencies:**
- Task 4.2

---

## Task Tracking

### Sprint Board

| Status | Task ID | Task Name | Priority | Deps |
|--------|---------|-----------|----------|------|
| Todo | 1.1 | Extend memory types | P0 | - |
| Todo | 1.2 | Decision persistence | P0 | 1.1 |
| Todo | 1.3 | Memory recall fuzzy search | P0 | 1.1, 1.2 |
| Todo | 1.4 | Auto-compaction | P1 | 1.2 |
| Todo | 1.5 | Memory linking | P1 | 1.2 |
| Todo | 1.6 | Memory export | P2 | 1.2 |
| Todo | 2.1 | Spec schema Zod | P0 | - |
| Todo | 2.2 | Spec template generator | P0 | 2.1 |
| Todo | 2.3 | Spec validation command | P0 | 2.1, 2.2 |
| Todo | 2.4 | Spec gate integration | P0 | 2.3 |
| Todo | 2.5 | Spec-to-code generation | P1 | 2.1, 2.2 |
| Todo | 2.6 | Quick flag | P2 | 2.4 |
| Todo | 3.1 | Tool registry system | P0 | - |
| Todo | 3.2 | Tool indexing | P0 | 3.1 |
| Todo | 3.3 | Fuzzy search | P0 | 3.1, 3.2 |
| Todo | 3.4 | Tool registration command | P1 | 3.1 |
| Todo | 3.5 | Defer loading pattern | P1 | 3.3 |
| Todo | 3.6 | Tool discovery in agents | P1 | 3.5 |
| Todo | 4.1 | Git worktree utils | P0 | - |
| Todo | 4.2 | Parallel orchestrator | P0 | 4.1 |
| Todo | 4.3 | Conflict detection | P0 | 4.1 |
| Todo | 4.4 | Agent status tracking | P1 | 4.2 |
| Todo | 4.5 | Merge strategy | P1 | 4.3 |
| Todo | 4.6 | Sequential fallback | P2 | 4.2 |

---

## Dependency Graph

```
Story 1 (Memory)          Story 2 (SDD)           Story 3 (Tools)         Story 4 (Parallel)
      │                        │                        │                        │
    ┌─┴─┐                   ┌──┴──┐                  ┌──┴──┐                  ┌──┴──┐
    │1.1│                   │ 2.1 │                  │ 3.1 │                  │ 4.1 │
    └─┬─┘                   └──┬──┘                  └──┬──┘                  └──┬──┘
      │                        │                        │                        │
    ┌─┴─┐                   ┌──┴──┐                  ┌──┴──┐              ┌──────┼──────┐
    │1.2│                   │ 2.2 │                  │ 3.2 │              │      │      │
    └─┬─┘                   └──┬──┘                  └──┬──┘           ┌──┴──┐┌──┴──┐   │
      │                        │                        │             │ 4.2 ││ 4.3 │   │
  ┌───┼───┬───┐             ┌──┴──┐                  ┌──┴──┐          └──┬──┘└──┬──┘   │
  │   │   │   │             │ 2.3 │                  │ 3.3 │             │      │      │
┌─┴─┐│ ┌─┴─┐┌─┴─┐           └──┬──┘                  └──┬──┘          ┌──┴──┐┌──┴──┐   │
│1.3││ │1.4││1.5│           ┌──┴──┐              ┌───┬──┴──┐          │ 4.4 ││ 4.5 │   │
└───┘│ └───┘└───┘           │ 2.4 │              │   │     │          └─────┘└─────┘   │
     │                      └──┬──┘           ┌──┴──┐│  ┌──┴──┐                        │
  ┌──┴──┐               ┌─────┼─────┐         │ 3.4 ││  │ 3.5 │                     ┌──┴──┐
  │ 1.6 │               │     │     │         └─────┘│  └──┬──┘                     │ 4.6 │
  └─────┘            ┌──┴──┐┌─┴──┐  │                │     │                        └─────┘
                     │ 2.5 ││2.6 │  │                │  ┌──┴──┐
                     └─────┘└────┘  │                │  │ 3.6 │
                                    │                │  └─────┘
                                    │                │
                                    └────────────────┘
```

---

## Definition of Done

Para uma task ser considerada "Done":

- [ ] Código implementado seguindo TDD
- [ ] Unit tests escritos (coverage >= 80%)
- [ ] Integration tests (se aplicável)
- [ ] Lint/format passou (`npm run check`)
- [ ] Type-check passou (`npm run type-check`)
- [ ] Documentação inline (JSDoc) para APIs públicas
- [ ] Backward compatibility verificada
- [ ] Acceptance criteria validados

---

## New Dependencies to Add

```json
{
  "dependencies": {
    "simple-git": "^3.22.0",
    "fuse.js": "^7.0.0",
    "zod": "^3.23.0"
  }
}
```

Comando: `npm install simple-git fuse.js zod`

---

## Execution Order Recommendation

**Phase 1 (Foundation):** Tasks 1.1 → 1.2 → 1.3 (Core memory)
**Phase 2 (SDD Core):** Tasks 2.1 → 2.2 → 2.3 → 2.4 (Spec workflow)
**Phase 3 (Tools Core):** Tasks 3.1 → 3.2 → 3.3 (Tool registry)
**Phase 4 (Parallel Core):** Tasks 4.1 → 4.2 → 4.3 (Parallel execution)
**Phase 5 (Enhancements):** Remaining P1/P2 tasks
