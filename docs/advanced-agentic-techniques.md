# Advanced Agentic Techniques

Guia de uso das funcionalidades avancadas do ADK.

---

## Indice

1. [Memory Persistence System](#1-memory-persistence-system)
2. [Spec-Driven Development](#2-spec-driven-development)
3. [Tool Search System](#3-tool-search-system)
4. [Multi-Agent Parallel Execution](#4-multi-agent-parallel-execution)

---

## 1. Memory Persistence System

Sistema de memoria que persiste decisoes, padroes e contexto entre sessoes.

### 1.1 Decisoes

Registre decisoes arquiteturais para consulta futura:

```bash
adk memory recall "autenticacao"
```

**Categorias de decisoes:**
- `architecture` - Decisoes de arquitetura
- `pattern` - Padroes de codigo
- `library` - Escolha de bibliotecas
- `convention` - Convencoes do projeto
- `security` - Decisoes de seguranca

### 1.2 Linking de Memoria

Vincule decisoes a features:

```bash
adk memory link <feature> <decision-id>
```

### 1.3 Export de Memoria

Exporte a base de conhecimento:

```bash
adk memory export --format json
adk memory export --format md --output ./export.md
```

### 1.4 Fuzzy Search

A busca usa Fuse.js com pesos:
- Titulo: 40%
- Contexto: 20%
- Rationale: 20%
- Tags: 20%

Threshold padrao: 0.3 (quanto menor, mais preciso)

---

## 2. Spec-Driven Development

Workflow que exige especificacoes detalhadas antes de implementacao.

### 2.1 Criar Spec

```bash
adk spec create <feature>
```

O comando interativo solicita:
- Descricao da feature
- Inputs (nome, tipo, obrigatoriedade)
- Outputs esperados
- Behaviors
- Edge cases
- Acceptance criteria (formato Gherkin)

### 2.2 Validar Spec

```bash
adk spec validate <feature>
adk spec validate <feature> --fix
```

Validacoes:
- Campos obrigatorios preenchidos
- Formato Gherkin correto
- Minimo de edge cases definidos

### 2.3 Gerar Codigo

```bash
adk spec generate <feature>
```

Gera scaffolding:
- `src/types/<feature>.ts` - Interfaces
- `src/<feature>.ts` - Funcoes com TODO
- `tests/<feature>.test.ts` - Testes skeleton

### 2.4 Gate de Spec

Os comandos `feature plan` e `feature implement` validam a spec automaticamente.

Para bypass em emergencias:
```bash
adk feature plan <name> --skip-spec
```

---

## 3. Tool Search System

Meta-tool para descoberta dinamica de ferramentas.

### 3.1 Registrar Tool

```bash
adk tool register <name>
adk tool register <name> --from-file tools.json
```

### 3.2 Indexar Tools

```bash
adk tool index
```

Indexa automaticamente:
- `.claude/agents/*.md`
- `.claude/skills/*.md`

### 3.3 Buscar Tools

```bash
adk tool search "analise de codigo"
```

A busca fuzzy retorna tools por relevancia.

### 3.4 Defer Loading

Tools marcadas com `deferLoading: true` sao carregadas sob demanda.

No prompt do agente:
```
TOOL_SEARCH: <descreva o que precisa>
```

---

## 4. Multi-Agent Parallel Execution

Execucao de multiplos agentes em paralelo usando git worktrees.

### 4.1 Executar em Paralelo

```bash
adk agent parallel <agents...> --feature <name>
adk agent parallel analyzer implementer tester --feature auth --max-agents 3
```

**Opcoes:**
- `--max-agents N` - Limite de agentes simultaneos (default: 3)
- `--timeout N` - Timeout por agente em ms (default: 300000)
- `--no-merge` - Skip merge automatico

### 4.2 Status dos Agentes

```bash
adk agent status
adk agent status --watch
```

Estados:
- `pending` - Aguardando execucao
- `running` - Em execucao
- `completed` - Finalizado com sucesso
- `failed` - Falhou

### 4.3 Deteccao de Conflitos

O sistema detecta automaticamente:
- `none` - Sem conflito
- `auto-resolvable` - 2 agentes, secoes diferentes
- `manual-required` - 3+ agentes ou mesmas linhas

### 4.4 Estrategia de Merge

```bash
adk agent merge --strategy squash
adk agent merge --preserve-commits
```

### 4.5 Fallback Sequencial

Em caso de falhas, o sistema pode fazer fallback:

```bash
adk agent parallel --fallback-sequential
```

---

## Arquivos de Configuracao

### .claude/config.json

```json
{
  "memory": {
    "maxLines": 1000,
    "maxSizeKB": 50,
    "archivePath": ".claude/memory/archive"
  },
  "parallel": {
    "maxAgents": 3,
    "timeout": 300000,
    "cleanupOnError": true
  },
  "tools": {
    "searchThreshold": 0.4,
    "deferLoadingDefault": true
  }
}
```

---

## Estrutura de Arquivos

```
.claude/
├── memory/
│   ├── decisions/          # Decisoes persistidas
│   ├── archive/            # Memorias arquivadas
│   └── project-context.md
├── tools/
│   └── registry.json       # Registro de tools
├── agent-status.json       # Status de agentes
└── plans/features/
    └── <feature>/
        ├── spec.md         # Especificacao
        ├── progress.md     # Progresso
        └── qa-report.md    # Relatorio QA
```

---

## Exemplos Praticos

### Workflow Completo com SDD

```bash
adk feature new auth-system
adk spec create auth-system
adk spec validate auth-system
adk spec generate auth-system
adk feature plan auth-system
adk feature implement auth-system
adk workflow qa auth-system
```

### Execucao Paralela de Feature

```bash
adk agent parallel analyzer implementer documenter \
  --feature auth-system \
  --max-agents 3 \
  --fallback-sequential
```

### Recall de Decisoes

```bash
adk memory recall "jwt vs session"
adk memory link auth-system decision-001
```

---

## Troubleshooting

### Conflitos em Execucao Paralela

Se houver conflitos manuais:
1. Verifique `.claude/agent-status.json`
2. Resolva conflitos manualmente
3. Execute `adk agent merge --continue`

### Spec Invalida

```bash
adk spec validate <feature> --fix
```

O auto-fix corrige:
- Campos vazios com placeholders
- Formato Gherkin incorreto

### Memory Cheia

O sistema auto-compacta quando excede limites. Para forcar:

```bash
adk memory compact <feature>
```
