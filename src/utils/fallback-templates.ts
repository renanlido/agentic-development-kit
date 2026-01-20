import fs from 'node:fs'
import path from 'node:path'
import type { FallbackTemplate } from '../types/cdr'
import type { PhaseType } from '../types/model'

const FALLBACK_PHASES: PhaseType[] = [
  'prd',
  'research',
  'planning',
  'implement',
  'qa',
  'validation',
  'docs',
]

const DEFAULT_TEMPLATES: Record<string, string> = {
  prd: `# PRD: [Feature Name]

**Data:** YYYY-MM-DD
**Status:** Draft

## Visao Geral

[Descricao breve da feature]

## Problema

[Qual problema esta feature resolve?]

## Solucao Proposta

[Como a feature resolve o problema?]

## Requisitos Funcionais

1. [Requisito 1]
2. [Requisito 2]
3. [Requisito 3]

## Requisitos Nao-Funcionais

- Performance: [especificar]
- Seguranca: [especificar]
- Escalabilidade: [especificar]

## Criterios de Aceitacao

- [ ] [Criterio 1]
- [ ] [Criterio 2]
- [ ] [Criterio 3]

## Fora de Escopo

- [Item 1]
- [Item 2]
`,
  research: `# Research: [Feature Name]

**Data:** YYYY-MM-DD

## Objetivo

[O que precisa ser pesquisado?]

## Contexto do Codebase

### Arquivos Relevantes

- \`src/path/to/file.ts\` - [descricao]

### Padroes Existentes

[Padroes identificados no codigo]

## Analise de Alternativas

### Opcao 1: [Nome]

**Pros:**
- [pro 1]

**Cons:**
- [con 1]

### Opcao 2: [Nome]

**Pros:**
- [pro 1]

**Cons:**
- [con 1]

## Recomendacao

[Opcao recomendada e justificativa]

## Riscos Identificados

1. [Risco 1]
2. [Risco 2]

## Proximos Passos

1. [Passo 1]
2. [Passo 2]
`,
  planning: `# Implementation Plan: [Feature Name]

**Data:** YYYY-MM-DD

## Resumo

[Resumo do plano de implementacao]

## Arquivos a Criar

1. \`src/path/to/new-file.ts\` - [descricao]

## Arquivos a Modificar

1. \`src/path/to/existing.ts\` - [mudancas necessarias]

## Sequencia de Implementacao

### Fase 1: Setup

1. [Tarefa 1]
2. [Tarefa 2]

### Fase 2: Core

1. [Tarefa 1]
2. [Tarefa 2]

### Fase 3: Integracao

1. [Tarefa 1]
2. [Tarefa 2]

## Dependencias

- [Dependencia 1]
- [Dependencia 2]

## Testes Necessarios

1. Unitarios: [descricao]
2. Integracao: [descricao]

## Estimativa

- Tempo: [estimativa]
- Complexidade: [baixa/media/alta]
`,
  implement: `# Implementation: [Feature Name]

**Data:** YYYY-MM-DD
**Status:** In Progress

## Checklist de Implementacao

### Testes (TDD)

- [ ] Testes unitarios escritos
- [ ] Testes de integracao escritos
- [ ] Todos testes passando

### Codigo

- [ ] Implementacao do core
- [ ] Tratamento de erros
- [ ] Validacao de inputs
- [ ] Documentacao inline

### Qualidade

- [ ] Lint passando
- [ ] Tipos corretos
- [ ] Sem warnings

## Progresso

### Completado

- [Item completado 1]

### Em Progresso

- [Item em progresso]

### Pendente

- [Item pendente]

## Notas de Implementacao

[Notas importantes sobre decisoes tomadas]

## Issues Encontrados

[Problemas encontrados durante implementacao]
`,
  qa: `# QA Report: [Feature Name]

**Data:** YYYY-MM-DD

## Sumario de Testes

| Categoria | Passando | Falhando | Total |
|-----------|----------|----------|-------|
| Unitarios | 0 | 0 | 0 |
| Integracao | 0 | 0 | 0 |

## Coverage

- Statements: 0%
- Branches: 0%
- Functions: 0%
- Lines: 0%

## Checklist de Qualidade

- [ ] Lint sem erros
- [ ] Types sem erros
- [ ] Testes passando
- [ ] Coverage >= 80%
- [ ] Sem vulnerabilidades de seguranca

## Issues Encontrados

### Criticos

- [Nenhum]

### Importantes

- [Nenhum]

### Menores

- [Nenhum]

## Recomendacao

[ ] Aprovado para deploy
[ ] Requer correcoes
`,
  validation: `# Validation: [Feature Name]

**Data:** YYYY-MM-DD

## Criterios de Validacao

- [ ] Funcionalidade correta
- [ ] Performance aceitavel
- [ ] Seguranca validada
- [ ] UX adequada

## Resultados

[Resultados da validacao]

## Status

[ ] Validado
[ ] Requer ajustes
`,
  docs: `# Documentation: [Feature Name]

**Data:** YYYY-MM-DD

## Visao Geral

[Descricao da feature para documentacao]

## Como Usar

[Instrucoes de uso]

## API

### Funcoes

#### \`nomeDaFuncao(params)\`

[Descricao]

**Parametros:**
- \`param1\`: [tipo] - [descricao]

**Retorno:**
- [tipo] - [descricao]

## Exemplos

\`\`\`typescript
// Exemplo de uso
\`\`\`

## FAQ

### Pergunta 1?

[Resposta]
`,
}

function getTemplatesDir(): string {
  return path.join(process.cwd(), 'templates', 'fallback')
}

export function getFallbackTemplatePath(phase: PhaseType): string {
  return path.join(getTemplatesDir(), `${phase}.md`)
}

export function loadFallbackTemplate(
  phase: PhaseType
): FallbackTemplate | undefined {
  const templatePath = getFallbackTemplatePath(phase)

  try {
    if (!fs.existsSync(templatePath)) {
      return undefined
    }

    const content = fs.readFileSync(templatePath, 'utf-8')

    return {
      phase,
      content,
      isReadOnly: true,
      lastValidated: new Date().toISOString(),
    }
  } catch {
    return undefined
  }
}

export function getFallbackTemplates(): FallbackTemplate[] {
  const templatesDir = getTemplatesDir()

  if (!fs.existsSync(templatesDir)) {
    return []
  }

  const templates: FallbackTemplate[] = []

  try {
    const files = fs.readdirSync(templatesDir)

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue
      }

      const phase = file.replace('.md', '') as PhaseType
      if (!FALLBACK_PHASES.includes(phase)) {
        continue
      }

      const template = loadFallbackTemplate(phase)
      if (template) {
        templates.push(template)
      }
    }
  } catch {
    return []
  }

  return templates
}

export function validateFallbackTemplate(
  template: FallbackTemplate | null | undefined
): boolean {
  if (!template) {
    return false
  }

  if (!template.content || template.content.trim().length === 0) {
    return false
  }

  if (!template.content.startsWith('#')) {
    return false
  }

  return true
}

export async function initializeFallbackTemplates(): Promise<void> {
  const templatesDir = getTemplatesDir()

  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true })
  }

  for (const phase of FALLBACK_PHASES) {
    const templatePath = path.join(templatesDir, `${phase}.md`)

    if (fs.existsSync(templatePath)) {
      continue
    }

    const defaultContent = DEFAULT_TEMPLATES[phase]
    if (defaultContent) {
      fs.writeFileSync(templatePath, defaultContent)
    }
  }
}
