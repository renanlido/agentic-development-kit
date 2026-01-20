# Tasks: Sistema de Memoria Especializada

**Feature**: memory
**Data**: 2026-01-13
**Metodologia**: TDD (Test-Driven Development)

## Visao Geral das Fases

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORDEM DE IMPLEMENTACAO                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FASE 0: Setup                                                       │
│    └─► [T0] Estrutura de arquivos e tipos                           │
│                                                                      │
│  FASE 1: Core Utils                                                  │
│    ├─► [T1] Testes: MemoryUtils                                     │
│    └─► [I1] Implementacao: MemoryUtils                              │
│                                                                      │
│  FASE 2: Comandos Basicos                                           │
│    ├─► [T2] Testes: memory save                                     │
│    ├─► [I2] Implementacao: memory save                              │
│    ├─► [T3] Testes: memory load                                     │
│    ├─► [I3] Implementacao: memory load                              │
│    ├─► [T4] Testes: memory view                                     │
│    └─► [I4] Implementacao: memory view                              │
│                                                                      │
│  FASE 3: Comandos Avancados                                         │
│    ├─► [T5] Testes: memory compact                                  │
│    ├─► [I5] Implementacao: memory compact                           │
│    ├─► [T6] Testes: memory search                                   │
│    ├─► [I6] Implementacao: memory search                            │
│    ├─► [T7] Testes: memory update                                   │
│    └─► [I7] Implementacao: memory update                            │
│                                                                      │
│  FASE 4: Integracao                                                 │
│    ├─► [T8] Testes: Hook pos-comando                                │
│    ├─► [I8] Implementacao: Hook pos-comando                         │
│    └─► [I9] Registro de comandos no CLI                             │
│                                                                      │
│  FASE 5: Refinamento                                                │
│    └─► [R1] Integracao E2E e ajustes finais                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FASE 0: Setup

### Task T0: Estrutura de Arquivos e Tipos

- **Tipo**: Config
- **Prioridade**: P0
- **Dependencias**: Nenhuma
- **Estimativa**: 1 SP

**Descricao**: Criar estrutura base de arquivos e definicoes de tipo.

**Arquivos a criar**:
```
src/
├── commands/
│   └── memory.ts           # Classe MemoryCommand
├── utils/
│   └── memory-utils.ts     # Utilitarios de memoria
└── types/
    └── memory.ts           # Tipos e interfaces
```

**Acceptance Criteria**:
- [ ] Arquivo `src/types/memory.ts` existe com interfaces
- [ ] Arquivo `src/utils/memory-utils.ts` existe (vazio, exportando stubs)
- [ ] Arquivo `src/commands/memory.ts` existe com classe base
- [ ] Projeto compila sem erros (`npm run type-check`)

**Interfaces a definir**:
```typescript
interface MemoryContent {
  feature: string
  lastUpdated: string
  phase: 'research' | 'plan' | 'implement' | 'qa' | 'deploy'
  status: 'in_progress' | 'blocked' | 'completed'
  summary: string
  decisions: ADR[]
  patterns: Pattern[]
  risks: Risk[]
  state: StateInfo
  nextSteps: string[]
  history: PhaseHistory[]
}

interface ADR {
  id: string
  decision: string
  reason: string
}

interface Pattern {
  name: string
  files: string[]
}

interface Risk {
  description: string
  mitigation: string
}

interface StateInfo {
  completed: string[]
  inProgress: string[]
  pending: string[]
}

interface PhaseHistory {
  date: string
  phase: string
  result: string
}

interface MemoryOptions {
  feature?: string
  global?: boolean
  query?: string
  force?: boolean
}
```

---

## FASE 1: Core Utils

### Task T1: Testes - MemoryUtils

- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: T0
- **Estimativa**: 2 SP

**Descricao**: Escrever testes para utilitarios de memoria.

**Arquivo**: `tests/utils/memory-utils.test.ts`

**Testes a escrever**:
```typescript
describe('MemoryUtils', () => {
  describe('getMemoryPath', () => {
    it('should return feature memory path for feature name')
    it('should return global memory path when no feature')
    it('should handle feature names with special characters')
  })

  describe('parseMemoryContent', () => {
    it('should parse valid memory markdown')
    it('should return default structure for empty content')
    it('should handle malformed content gracefully')
  })

  describe('serializeMemoryContent', () => {
    it('should serialize MemoryContent to markdown')
    it('should include all sections')
    it('should format dates correctly')
  })

  describe('countLines', () => {
    it('should count lines in content')
    it('should return 0 for empty content')
  })

  describe('isMemoryOverLimit', () => {
    it('should return true when over 1000 lines')
    it('should return false when under limit')
    it('should warn at 80% threshold')
  })

  describe('mergeMemoryContent', () => {
    it('should merge new content into existing')
    it('should not duplicate decisions')
    it('should update lastUpdated')
  })
})
```

**Acceptance Criteria**:
- [ ] Arquivo de teste existe
- [ ] Todos os testes falham (RED)
- [ ] Testes cobrem happy path e edge cases
- [ ] Commit: `test: add tests for MemoryUtils`

---

### Task I1: Implementacao - MemoryUtils

- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: T1
- **Estimativa**: 3 SP

**Descricao**: Implementar utilitarios de memoria.

**Arquivo**: `src/utils/memory-utils.ts`

**Funcoes a implementar**:
```typescript
export function getMemoryPath(feature?: string): string
export function parseMemoryContent(content: string): MemoryContent
export function serializeMemoryContent(memory: MemoryContent): string
export function countLines(content: string): number
export function isMemoryOverLimit(content: string, limit?: number): { over: boolean; warning: boolean; count: number }
export function mergeMemoryContent(existing: MemoryContent, update: Partial<MemoryContent>): MemoryContent
export function createDefaultMemory(feature: string): MemoryContent
```

**Acceptance Criteria**:
- [ ] Todas as funcoes implementadas
- [ ] Todos os testes de T1 passam (GREEN)
- [ ] Lint passa (`npm run check`)
- [ ] Commit: `feat(memory): implement MemoryUtils`

---

## FASE 2: Comandos Basicos

### Task T2: Testes - memory save

- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: I1
- **Estimativa**: 2 SP

**Descricao**: Escrever testes para comando `memory save`.

**Arquivo**: `tests/commands/memory.test.ts`

**Testes a escrever**:
```typescript
describe('MemoryCommand', () => {
  describe('save', () => {
    it('should create memory file for new feature')
    it('should update existing memory file')
    it('should respect 1000 line limit')
    it('should warn when approaching limit')
    it('should fail if feature directory does not exist')
    it('should auto-detect current phase from artifacts')
    it('should preserve existing decisions')
  })
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Mock de fs-extra configurado
- [ ] Commit: `test: add tests for memory save command`

---

### Task I2: Implementacao - memory save

- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: T2
- **Estimativa**: 3 SP

**Descricao**: Implementar comando `adk memory save <feature>`.

**Arquivo**: `src/commands/memory.ts`

**Metodo a implementar**:
```typescript
async save(feature: string, options: MemoryOptions = {}): Promise<void>
```

**Logica**:
1. Validar que feature existe em `.claude/plans/features/<feature>/`
2. Carregar memoria existente (se houver)
3. Gerar prompt para Claude extrair contexto da sessao
4. Mesclar com memoria existente
5. Validar limite de linhas
6. Salvar em `.claude/plans/features/<feature>/memory.md`
7. Exibir resumo

**Acceptance Criteria**:
- [ ] Comando funciona via CLI
- [ ] Testes T2 passam
- [ ] Arquivo de memoria criado corretamente
- [ ] Commit: `feat(memory): implement save command`

---

### Task T3: Testes - memory load

- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: I2
- **Estimativa**: 2 SP

**Arquivo**: `tests/commands/memory.test.ts` (adicionar)

**Testes a escrever**:
```typescript
describe('load', () => {
  it('should load existing memory for feature')
  it('should inject context into prompt')
  it('should display summary to user')
  it('should fail gracefully if memory does not exist')
  it('should suggest creating feature if not found')
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Commit: `test: add tests for memory load command`

---

### Task I3: Implementacao - memory load

- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: T3
- **Estimativa**: 2 SP

**Arquivo**: `src/commands/memory.ts`

**Metodo a implementar**:
```typescript
async load(feature: string, options: MemoryOptions = {}): Promise<void>
```

**Logica**:
1. Verificar existencia de memoria
2. Carregar e parsear conteudo
3. Exibir resumo formatado
4. Opcional: Injetar em prompt para Claude

**Acceptance Criteria**:
- [ ] Comando funciona via CLI
- [ ] Testes T3 passam
- [ ] Exibe resumo legivel
- [ ] Commit: `feat(memory): implement load command`

---

### Task T4: Testes - memory view

- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: I3
- **Estimativa**: 1 SP

**Testes a escrever**:
```typescript
describe('view', () => {
  it('should display feature memory with syntax highlighting')
  it('should display global memory with --global flag')
  it('should show statistics (lines, last update)')
  it('should list available feature memories')
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Commit: `test: add tests for memory view command`

---

### Task I4: Implementacao - memory view

- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: T4
- **Estimativa**: 2 SP

**Metodo a implementar**:
```typescript
async view(feature?: string, options: MemoryOptions = {}): Promise<void>
```

**Acceptance Criteria**:
- [ ] Comando funciona via CLI
- [ ] Testes T4 passam
- [ ] Output formatado com chalk
- [ ] Commit: `feat(memory): implement view command`

---

## FASE 3: Comandos Avancados

### Task T5: Testes - memory compact

- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: I4
- **Estimativa**: 2 SP

**Testes a escrever**:
```typescript
describe('compact', () => {
  it('should compact memory over 1000 lines')
  it('should archive original before compacting')
  it('should use Claude to summarize')
  it('should preserve essential information')
  it('should skip if already under limit')
  it('should maintain all ADRs')
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Mock de Claude command configurado
- [ ] Commit: `test: add tests for memory compact command`

---

### Task I5: Implementacao - memory compact

- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: T5
- **Estimativa**: 4 SP

**Metodo a implementar**:
```typescript
async compact(feature: string, options: MemoryOptions = {}): Promise<void>
```

**Logica**:
1. Verificar se memoria excede limite
2. Se nao, informar que ja esta otimizada
3. Arquivar original em `memory-archive/memory-YYYY-MM-DD.md`
4. Gerar prompt para Claude resumir mantendo essenciais
5. Salvar versao compactada
6. Exibir diff (linhas antes vs depois)

**Acceptance Criteria**:
- [ ] Comando funciona via CLI
- [ ] Testes T5 passam
- [ ] Backup criado antes de compact
- [ ] Commit: `feat(memory): implement compact command`

---

### Task T6: Testes - memory search

- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: I5
- **Estimativa**: 2 SP

**Testes a escrever**:
```typescript
describe('search', () => {
  it('should search across all feature memories')
  it('should filter by feature with --feature flag')
  it('should show context around matches')
  it('should order by relevance')
  it('should handle regex patterns')
  it('should complete under 100ms for 50 files')
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Commit: `test: add tests for memory search command`

---

### Task I6: Implementacao - memory search

- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: T6
- **Estimativa**: 3 SP

**Metodo a implementar**:
```typescript
async search(query: string, options: MemoryOptions = {}): Promise<void>
```

**Logica**:
1. Listar todos os arquivos memory.md
2. Usar grep interno (nao shell) para buscar
3. Coletar matches com contexto (3 linhas)
4. Ordenar por numero de matches
5. Exibir formatado: feature > linha > contexto

**Acceptance Criteria**:
- [ ] Comando funciona via CLI
- [ ] Testes T6 passam
- [ ] Performance < 100ms
- [ ] Commit: `feat(memory): implement search command`

---

### Task T7: Testes - memory update

- **Tipo**: Test
- **Prioridade**: P1
- **Dependencias**: I6
- **Estimativa**: 1 SP

**Testes a escrever**:
```typescript
describe('update', () => {
  it('should update global project memory')
  it('should analyze current project state')
  it('should show diff of changes')
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Commit: `test: add tests for memory update command`

---

### Task I7: Implementacao - memory update

- **Tipo**: Implementation
- **Prioridade**: P1
- **Dependencias**: T7
- **Estimativa**: 2 SP

**Metodo a implementar**:
```typescript
async update(options: MemoryOptions = {}): Promise<void>
```

**Acceptance Criteria**:
- [ ] Comando funciona via CLI
- [ ] Testes T7 passam
- [ ] Atualiza project-context.md e current-state.md
- [ ] Commit: `feat(memory): implement update command`

---

## FASE 4: Integracao

### Task T8: Testes - Hook pos-comando

- **Tipo**: Test
- **Prioridade**: P0
- **Dependencias**: I7
- **Estimativa**: 2 SP

**Arquivo**: `tests/commands/feature.test.ts` (adicionar)

**Testes a escrever**:
```typescript
describe('Feature command with memory hook', () => {
  it('should save memory after research completes')
  it('should save memory after plan completes')
  it('should save memory after implement completes')
  it('should record phase in memory history')
  it('should not fail if memory save fails')
})
```

**Acceptance Criteria**:
- [ ] Testes escritos e falhando
- [ ] Commit: `test: add tests for memory hook integration`

---

### Task I8: Implementacao - Hook pos-comando

- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: T8
- **Estimativa**: 3 SP

**Descricao**: Integrar salvamento automatico de memoria nos comandos existentes.

**Arquivos a modificar**:
- `src/commands/feature.ts` - Adicionar chamada a memory.save() apos cada fase
- `src/commands/workflow.ts` - Adicionar chamada a memory.save() apos workflows

**Logica**:
```typescript
private async saveMemoryAfterPhase(feature: string, phase: string): Promise<void> {
  try {
    await memoryCommand.save(feature, { phase })
  } catch (error) {
    logger.warn(`Nao foi possivel salvar memoria: ${error}`)
  }
}
```

**Acceptance Criteria**:
- [ ] Memory salvada automaticamente apos feature research
- [ ] Memory salvada automaticamente apos feature plan
- [ ] Memory salvada automaticamente apos feature implement
- [ ] Falha no save nao bloqueia fluxo principal
- [ ] Testes T8 passam
- [ ] Commit: `feat(memory): integrate automatic memory save hook`

---

### Task I9: Registro de Comandos no CLI

- **Tipo**: Implementation
- **Prioridade**: P0
- **Dependencias**: I8
- **Estimativa**: 1 SP

**Descricao**: Registrar todos os subcomandos de memory no CLI.

**Arquivo a modificar**: `src/cli.ts`

**Comandos a registrar**:
```typescript
const memory = program
  .command('memory')
  .description('Gerencia memoria especializada por feature')

memory
  .command('save <feature>')
  .description('Salva contexto atual para feature')
  .action((feature) => memoryCommand.save(feature))

memory
  .command('load <feature>')
  .description('Carrega memoria de feature')
  .action((feature) => memoryCommand.load(feature))

memory
  .command('view [feature]')
  .description('Visualiza memoria')
  .option('-g, --global', 'Visualiza memoria global')
  .action((feature, options) => memoryCommand.view(feature, options))

memory
  .command('compact <feature>')
  .description('Compacta memoria grande')
  .action((feature) => memoryCommand.compact(feature))

memory
  .command('search <query>')
  .description('Busca em memorias')
  .option('-f, --feature <feature>', 'Filtrar por feature')
  .action((query, options) => memoryCommand.search(query, options))

memory
  .command('update')
  .description('Atualiza memoria global')
  .action(() => memoryCommand.update())
```

**Acceptance Criteria**:
- [ ] Todos os comandos registrados
- [ ] `adk memory --help` mostra todos os subcomandos
- [ ] Comandos antigos (--update, --view) removidos ou redirecionados
- [ ] Commit: `feat(memory): register all memory subcommands in CLI`

---

## FASE 5: Refinamento

### Task R1: Integracao E2E e Ajustes Finais

- **Tipo**: Refinement
- **Prioridade**: P2
- **Dependencias**: I9
- **Estimativa**: 2 SP

**Descricao**: Testes de integracao completos e ajustes finais.

**Atividades**:
1. Teste E2E: fluxo completo de feature com memoria
2. Ajustar mensagens de erro
3. Verificar performance
4. Documentar no CLAUDE.md

**Acceptance Criteria**:
- [ ] Fluxo completo funciona: create → research → plan → implement (com memoria)
- [ ] Performance < 100ms para search
- [ ] Documentacao atualizada
- [ ] Coverage >= 80%
- [ ] Commit: `chore(memory): finalize integration and documentation`

---

## Resumo de Estimativas

| Fase | Tasks | Story Points | Descricao |
|------|-------|--------------|-----------|
| 0 | T0 | 1 SP | Setup inicial |
| 1 | T1, I1 | 5 SP | Core utils |
| 2 | T2-T4, I2-I4 | 12 SP | Comandos basicos |
| 3 | T5-T7, I5-I7 | 14 SP | Comandos avancados |
| 4 | T8-I9 | 6 SP | Integracao |
| 5 | R1 | 2 SP | Refinamento |
| **Total** | **17 tasks** | **40 SP** | |

---

## Dependencias Visuais

```
T0 ─────────────────────────────────────────────────────┐
│                                                        │
▼                                                        │
T1 ──► I1 ──► T2 ──► I2 ──► T3 ──► I3 ──► T4 ──► I4 ──┤
                                                         │
              T5 ──► I5 ──► T6 ──► I6 ──► T7 ──► I7 ──┤
                                                         │
                                    T8 ──► I8 ──► I9 ──┤
                                                         │
                                                    R1 ◄─┘
```

---

## Checklist de Conclusao

- [ ] Fase 0 completa
- [ ] Fase 1 completa (testes + implementacao)
- [ ] Fase 2 completa (save, load, view)
- [ ] Fase 3 completa (compact, search, update)
- [ ] Fase 4 completa (integracao automatica)
- [ ] Fase 5 completa (E2E e docs)
- [ ] Coverage >= 80%
- [ ] Lint passa
- [ ] Tipos corretos
- [ ] Documentacao atualizada

---

**Criado por**: ADK Autopilot - Task Breakdown Agent
**Metodologia**: TDD - Testes SEMPRE antes de implementacao
