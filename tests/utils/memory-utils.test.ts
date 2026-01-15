import type { MemoryContent } from '../../src/types/memory'
import {
  countLines,
  createDefaultMemory,
  getMemoryArchivePath,
  getMemoryPath,
  isMemoryOverLimit,
  mergeMemoryContent,
  parseMemoryContent,
  searchInContent,
  serializeMemoryContent,
} from '../../src/utils/memory-utils'

describe('MemoryUtils', () => {
  describe('getMemoryPath', () => {
    it('should return feature memory path for feature name', () => {
      const result = getMemoryPath('auth')
      expect(result).toContain('.claude/plans/features/auth/memory.md')
    })

    it('should return global memory path when no feature', () => {
      const result = getMemoryPath()
      expect(result).toContain('.claude/memory/project-context.md')
    })

    it('should handle feature names with special characters', () => {
      const result = getMemoryPath('my feature@123!')
      expect(result).toContain('my-feature-123-')
      expect(result).not.toContain('@')
      expect(result).not.toContain('!')
      expect(result).not.toContain(' ')
    })

    it('should sanitize feature names', () => {
      const result = getMemoryPath('test/path/../attack')
      expect(result).not.toContain('..')
    })
  })

  describe('getMemoryArchivePath', () => {
    it('should return archive path with date', () => {
      const result = getMemoryArchivePath('auth')
      expect(result).toContain('memory-archive')
      expect(result).toMatch(/memory-\d{4}-\d{2}-\d{2}\.md$/)
    })
  })

  describe('countLines', () => {
    it('should count lines in content', () => {
      const content = 'line 1\nline 2\nline 3'
      expect(countLines(content)).toBe(3)
    })

    it('should return 0 for empty content', () => {
      expect(countLines('')).toBe(0)
    })

    it('should return 0 for whitespace only', () => {
      expect(countLines('   \n  \n  ')).toBe(0)
    })

    it('should count single line', () => {
      expect(countLines('single line')).toBe(1)
    })
  })

  describe('isMemoryOverLimit', () => {
    it('should return over true when over 1000 lines', () => {
      const content = Array(1001).fill('line').join('\n')
      const result = isMemoryOverLimit(content)
      expect(result.over).toBe(true)
      expect(result.count).toBe(1001)
    })

    it('should return over false when under limit', () => {
      const content = Array(500).fill('line').join('\n')
      const result = isMemoryOverLimit(content)
      expect(result.over).toBe(false)
      expect(result.count).toBe(500)
    })

    it('should return warning true at 80% threshold', () => {
      const content = Array(801).fill('line').join('\n')
      const result = isMemoryOverLimit(content)
      expect(result.warning).toBe(true)
      expect(result.over).toBe(false)
    })

    it('should respect custom limit', () => {
      const content = Array(51).fill('line').join('\n')
      const result = isMemoryOverLimit(content, 50)
      expect(result.over).toBe(true)
    })
  })

  describe('createDefaultMemory', () => {
    it('should create memory with feature name', () => {
      const memory = createDefaultMemory('test-feature')
      expect(memory.feature).toBe('test-feature')
    })

    it('should have default phase as research', () => {
      const memory = createDefaultMemory('test')
      expect(memory.phase).toBe('research')
    })

    it('should have default status as in_progress', () => {
      const memory = createDefaultMemory('test')
      expect(memory.status).toBe('in_progress')
    })

    it('should have empty arrays for collections', () => {
      const memory = createDefaultMemory('test')
      expect(memory.decisions).toEqual([])
      expect(memory.patterns).toEqual([])
      expect(memory.risks).toEqual([])
      expect(memory.nextSteps).toEqual([])
      expect(memory.history).toEqual([])
    })

    it('should have valid lastUpdated date', () => {
      const memory = createDefaultMemory('test')
      expect(memory.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('parseMemoryContent', () => {
    const validContent = `# Memoria: auth

**Ultima Atualizacao**: 2026-01-13
**Fase Atual**: implement
**Status**: in_progress

## Resumo Executivo

Esta feature implementa autenticacao JWT.

## Decisoes Arquiteturais

- **[ADR-001]**: Usar JWT para autenticacao
  - Razao: Stateless e escalavel

## Padroes Identificados

- **Singleton Pattern**: Usado em commands
  - Arquivos: src/commands/feature.ts, src/commands/memory.ts

## Riscos e Dependencias

| Risco | Mitigacao |
|-------|-----------|
| Token expirado | Refresh token |

## Estado Atual

**Concluido**:
- [x] Estrutura de arquivos
- [x] Testes unitarios

**Em Progresso**:
- [ ] Middleware

**Pendente**:
- [ ] Integracao

## Proximos Passos

1. Completar middleware
2. Adicionar refresh token

## Historico de Fases

| Data | Fase | Resultado |
|------|------|-----------|
| 2026-01-10 | research | completed |
| 2026-01-11 | plan | completed |
`

    it('should parse valid memory markdown', () => {
      const result = parseMemoryContent(validContent)
      expect(result.feature).toBe('auth')
      expect(result.phase).toBe('implement')
      expect(result.status).toBe('in_progress')
    })

    it('should return default structure for empty content', () => {
      const result = parseMemoryContent('')
      expect(result.feature).toBe('unknown')
      expect(result.phase).toBe('research')
    })

    it('should handle malformed content gracefully', () => {
      const malformed = 'random text without structure'
      const result = parseMemoryContent(malformed)
      expect(result.feature).toBe('unknown')
      expect(result.decisions).toEqual([])
    })

    it('should parse decisions correctly', () => {
      const result = parseMemoryContent(validContent)
      expect(result.decisions.length).toBe(1)
      expect(result.decisions[0].id).toBe('ADR-001')
      expect(result.decisions[0].decision).toBe('Usar JWT para autenticacao')
    })

    it('should parse state correctly', () => {
      const result = parseMemoryContent(validContent)
      expect(result.state.completed).toContain('Estrutura de arquivos')
      expect(result.state.inProgress).toContain('Middleware')
    })

    it('should parse next steps', () => {
      const contentWithSteps = [
        '# Memoria: test',
        '',
        '**Ultima Atualizacao**: 2026-01-13',
        '**Fase Atual**: implement',
        '**Status**: in_progress',
        '',
        '## Proximos Passos',
        '',
        '1. Completar middleware',
        '2. Adicionar refresh token',
        '',
      ].join('\n')
      const result = parseMemoryContent(contentWithSteps)
      expect(result.nextSteps.length).toBe(2)
      expect(result.nextSteps[0]).toBe('Completar middleware')
    })

    it('should handle content with risks section', () => {
      const result = parseMemoryContent(validContent)
      expect(result.risks).toBeDefined()
      expect(Array.isArray(result.risks)).toBe(true)
    })

    it('should handle content with history section', () => {
      const result = parseMemoryContent(validContent)
      expect(result.history).toBeDefined()
      expect(Array.isArray(result.history)).toBe(true)
    })

    it('should parse patterns correctly', () => {
      const contentWithPatterns = [
        '# Memoria: test',
        '',
        '**Ultima Atualizacao**: 2026-01-13',
        '**Fase Atual**: implement',
        '**Status**: in_progress',
        '',
        '## Padroes Identificados',
        '',
        '- **Singleton Pattern**: Usado em commands',
        '  - Arquivos: src/commands/feature.ts, src/commands/memory.ts',
        '',
      ].join('\n')
      const result = parseMemoryContent(contentWithPatterns)
      expect(result.patterns.length).toBe(1)
      expect(result.patterns[0].name).toBe('Singleton Pattern')
    })

    it('should handle blocked status', () => {
      const blockedContent = [
        '# Memoria: test',
        '',
        '**Ultima Atualizacao**: 2026-01-13',
        '**Fase Atual**: implement',
        '**Status**: blocked',
        '',
      ].join('\n')
      const result = parseMemoryContent(blockedContent)
      expect(result.status).toBe('blocked')
    })

    it('should handle completed status', () => {
      const completedContent = [
        '# Memoria: test',
        '',
        '**Ultima Atualizacao**: 2026-01-13',
        '**Fase Atual**: deploy',
        '**Status**: completed',
        '',
      ].join('\n')
      const result = parseMemoryContent(completedContent)
      expect(result.status).toBe('completed')
      expect(result.phase).toBe('deploy')
    })

    it('should handle qa phase', () => {
      const qaContent = [
        '# Memoria: test',
        '',
        '**Ultima Atualizacao**: 2026-01-13',
        '**Fase Atual**: qa',
        '**Status**: in_progress',
        '',
      ].join('\n')
      const result = parseMemoryContent(qaContent)
      expect(result.phase).toBe('qa')
    })

    it('should parse pending state items', () => {
      const result = parseMemoryContent(validContent)
      expect(result.state.pending.length).toBeGreaterThanOrEqual(1)
      expect(result.state.pending[0]).toBe('Integracao')
    })
  })

  describe('serializeMemoryContent', () => {
    it('should serialize MemoryContent to markdown', () => {
      const memory = createDefaultMemory('test')
      const result = serializeMemoryContent(memory)
      expect(result).toContain('# Memoria: test')
    })

    it('should include all sections', () => {
      const memory = createDefaultMemory('test')
      const result = serializeMemoryContent(memory)
      expect(result).toContain('## Resumo Executivo')
      expect(result).toContain('## Decisoes Arquiteturais')
      expect(result).toContain('## Padroes Identificados')
      expect(result).toContain('## Riscos e Dependencias')
      expect(result).toContain('## Estado Atual')
      expect(result).toContain('## Proximos Passos')
      expect(result).toContain('## Historico de Fases')
    })

    it('should format dates correctly', () => {
      const memory = createDefaultMemory('test')
      memory.lastUpdated = '2026-01-13T14:30:00.000Z'
      const result = serializeMemoryContent(memory)
      expect(result).toContain('**Ultima Atualizacao**: 2026-01-13T14:30:00.000Z')
    })

    it('should serialize decisions with ADR format', () => {
      const memory = createDefaultMemory('test')
      memory.decisions = [{ id: 'ADR-001', decision: 'Use TypeScript', reason: 'Type safety' }]
      const result = serializeMemoryContent(memory)
      expect(result).toContain('**[ADR-001]**: Use TypeScript')
      expect(result).toContain('Razao: Type safety')
    })

    it('should serialize risks as table', () => {
      const memory = createDefaultMemory('test')
      memory.risks = [{ description: 'Security issue', mitigation: 'Add validation' }]
      const result = serializeMemoryContent(memory)
      expect(result).toContain('| Risco | Mitigacao |')
      expect(result).toContain('| Security issue | Add validation |')
    })
  })

  describe('mergeMemoryContent', () => {
    it('should merge new content into existing', () => {
      const existing = createDefaultMemory('test')
      const update = { summary: 'New summary' }
      const result = mergeMemoryContent(existing, update)
      expect(result.summary).toBe('New summary')
    })

    it('should not duplicate decisions', () => {
      const existing = createDefaultMemory('test')
      existing.decisions = [{ id: 'ADR-001', decision: 'A', reason: 'B' }]
      const update = {
        decisions: [
          { id: 'ADR-001', decision: 'A', reason: 'B' },
          { id: 'ADR-002', decision: 'C', reason: 'D' },
        ],
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.decisions.length).toBe(2)
    })

    it('should update lastUpdated', () => {
      const existing = createDefaultMemory('test')
      existing.lastUpdated = '2020-01-01'
      const result = mergeMemoryContent(existing, {})
      expect(result.lastUpdated).not.toBe('2020-01-01')
    })

    it('should merge state arrays without duplicates', () => {
      const existing = createDefaultMemory('test')
      existing.state.completed = ['Item A']
      const update = {
        state: { completed: ['Item A', 'Item B'], inProgress: [], pending: [] },
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.state.completed).toEqual(['Item A', 'Item B'])
    })

    it('should replace nextSteps entirely', () => {
      const existing = createDefaultMemory('test')
      existing.nextSteps = ['Old step']
      const update = { nextSteps: ['New step 1', 'New step 2'] }
      const result = mergeMemoryContent(existing, update)
      expect(result.nextSteps).toEqual(['New step 1', 'New step 2'])
    })

    it('should append to history', () => {
      const existing = createDefaultMemory('test')
      existing.history = [{ date: '2026-01-01', phase: 'research', result: 'completed' }]
      const update = {
        history: [{ date: '2026-01-02', phase: 'plan' as const, result: 'completed' as const }],
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.history.length).toBe(2)
    })

    it('should merge patterns without duplicates', () => {
      const existing = createDefaultMemory('test')
      existing.patterns = [{ name: 'Pattern A', description: 'Desc A', files: ['a.ts'] }]
      const update = {
        patterns: [
          { name: 'Pattern A', description: 'Desc A', files: ['a.ts'] },
          { name: 'Pattern B', description: 'Desc B', files: ['b.ts'] },
        ],
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.patterns.length).toBe(2)
    })

    it('should merge risks without duplicates', () => {
      const existing = createDefaultMemory('test')
      existing.risks = [{ description: 'Risk A', mitigation: 'Fix A' }]
      const update = {
        risks: [
          { description: 'Risk A', mitigation: 'Fix A' },
          { description: 'Risk B', mitigation: 'Fix B' },
        ],
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.risks.length).toBe(2)
    })

    it('should handle state update with inProgress', () => {
      const existing = createDefaultMemory('test')
      const update = {
        state: { completed: [], inProgress: ['Task 1', 'Task 2'], pending: [] },
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.state.inProgress).toEqual(['Task 1', 'Task 2'])
    })

    it('should handle state update with pending', () => {
      const existing = createDefaultMemory('test')
      const update = {
        state: { completed: [], inProgress: [], pending: ['Future 1'] },
      }
      const result = mergeMemoryContent(existing, update)
      expect(result.state.pending).toEqual(['Future 1'])
    })
  })

  describe('searchInContent', () => {
    const content = [
      'Line 1: Introduction',
      'Line 2: Some context',
      'Line 3: JWT token implementation',
      'Line 4: More details',
      'Line 5: Another JWT reference',
      'Line 6: Conclusion',
    ].join('\n')

    it('should find matches with line numbers', () => {
      const results = searchInContent(content, 'JWT')
      expect(results.length).toBe(2)
      expect(results[0].line).toBe(3)
      expect(results[1].line).toBe(5)
    })

    it('should include context around matches', () => {
      const results = searchInContent(content, 'JWT', 1)
      expect(results[0].context.length).toBe(3)
    })

    it('should return empty for no matches', () => {
      const results = searchInContent(content, 'nonexistent')
      expect(results.length).toBe(0)
    })

    it('should be case insensitive', () => {
      const results = searchInContent(content, 'jwt')
      expect(results.length).toBe(2)
    })

    it('should find all lines containing term', () => {
      const results = searchInContent(content, 'Line')
      expect(results.length).toBe(6)
    })
  })

  describe('roundtrip serialization', () => {
    it('should maintain data through parse -> serialize -> parse', () => {
      const original: MemoryContent = {
        feature: 'roundtrip-test',
        lastUpdated: '2026-01-13T10:00:00.000Z',
        phase: 'implement',
        status: 'in_progress',
        summary: 'Test summary',
        decisions: [{ id: 'ADR-001', decision: 'Test', reason: 'Testing' }],
        patterns: [{ name: 'Pattern', description: 'Desc', files: ['a.ts', 'b.ts'] }],
        risks: [{ description: 'Risk', mitigation: 'Fix' }],
        state: {
          completed: ['Done'],
          inProgress: ['Doing'],
          pending: ['Todo'],
        },
        nextSteps: ['Step 1', 'Step 2'],
        history: [{ date: '2026-01-01', phase: 'research', result: 'completed' }],
      }

      const serialized = serializeMemoryContent(original)
      const parsed = parseMemoryContent(serialized)

      expect(parsed.feature).toBe(original.feature)
      expect(parsed.phase).toBe(original.phase)
      expect(parsed.status).toBe(original.status)
      expect(parsed.decisions.length).toBe(1)
      expect(parsed.decisions[0].id).toBe('ADR-001')
    })
  })
})
