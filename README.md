# Agentic Development Kit (ADK)

> CLI toolkit para desenvolvimento com Claude Code usando framework CADD (Context-Agentic Development & Delivery)

## O que e o ADK?

O ADK e um **orquestrador de prompts** para Claude Code. Ele nao executa codigo diretamente - ele gera prompts estruturados e envia para o Claude Code fazer o trabalho real.

```
Voce roda: adk feature plan auth
           |
ADK gera prompt estruturado com contexto
           |
ADK executa: claude "prompt..."
           |
Claude Code faz o trabalho (le, escreve, implementa)
```

**Principais caracteristicas:**
- Workflow completo de desenvolvimento: PRD > Research > Tasks > Plan > Implement > QA > Docs
- Isolamento via git worktrees (cada feature em branch separada)
- Sistema de memoria hierarquica (4 niveis: Project > Feature > Phase > Session)
- Retrieval dinamico de contexto (Agentic RAG)
- Roteamento inteligente de modelos por fase
- Resiliencia cognitiva (CDR): health probes, retry, recovery, fallback
- AI-on-AI review para maior qualidade
- Quality gates com risk scoring
- 8 agents especializados (analyzer, implementer, tester, etc)
- Integracao com project management (ClickUp)
- TDD enforced (testes primeiro, sempre)

---

## Instalacao

```bash
git clone https://github.com/renanlido/agentic-development-kit
cd agentic-development-kit
npm install
npm run build
npm link

adk --version
```

**Requisitos:**
- Node.js >= 18
- Git
- Claude Code CLI instalado (`claude --version`)

---

## Quick Start

```bash
cd meu-projeto-existente
adk init
```

Isso cria a estrutura CADD no seu projeto:

```
projeto/
├── CLAUDE.md                    # Instrucoes para Claude Code
└── .claude/
    ├── memory/project-context.md
    ├── agents/                  # 8 agentes especializados
    ├── skills/                  # 4 skills com templates
    ├── commands/                # 9 slash commands
    ├── rules/                   # 4 regras de qualidade
    ├── hooks/                   # 6 hooks de automacao
    ├── settings.json
    └── ...
```

---

## Arquitetura

### Visao Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADK CLI                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ feature │ │workflow │ │  agent  │ │ memory  │ │ deploy  │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
│       └───────────┴───────────┴───────────┴───────────┘         │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │  Prompt Generator  │                        │
│                    │  (utils/claude.ts) │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Claude Code CLI    │
                    │  (executa prompts)   │
                    └─────────────────────┘
```

### Componentes Principais

| Componente | Localizacao | Responsabilidade |
|------------|-------------|------------------|
| CLI Entry | `src/cli.ts` | Parser de comandos (Commander.js) |
| Feature Command | `src/commands/feature.ts` | Lifecycle de features |
| Workflow Command | `src/commands/workflow.ts` | Workflows automatizados |
| Agent Command | `src/commands/agent.ts` | Gerenciamento de agents |
| Memory Command | `src/commands/memory.ts` | Sistema de memoria |
| Templates | `templates/` | Templates de PRD, tasks, plans |
| Providers | `src/providers/` | Integracao externa (ClickUp) |

### Fluxo de Feature (7 Fases)

```
┌─────────┐    ┌──────────┐    ┌───────┐    ┌──────────────┐
│   PRD   │───▶│ Research │───▶│ Tasks │───▶│ Architecture │
└─────────┘    └──────────┘    └───────┘    └──────────────┘
                                                    │
┌─────────┐    ┌──────────┐    ┌────┐              │
│  Docs   │◀───│    QA    │◀───│Impl│◀─────────────┘
└─────────┘    └──────────┘    └────┘
                                  │
                            ┌─────▼─────┐
                            │  Finish   │
                            │(PR/Merge) │
                            └───────────┘
```

Cada fase gera arquivos em `.claude/plans/features/<nome>/`:
- `prd.md` - Product Requirements
- `research.md` - Analise do codebase
- `tasks.md` - Breakdown de tasks
- `implementation-plan.md` - Plano detalhado
- `qa-report.md` - Relatorio de QA

---

## Comandos

### adk init

Adiciona estrutura CADD a um projeto existente.

```bash
adk init
adk init -n "Meu Projeto"
```

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `-n, --name` | Nome do projeto | nome da pasta |

---

### adk update

Atualiza templates ADK sem perder dados existentes.

```bash
adk update              # Atualiza todos
adk update --commands   # Apenas comandos
adk update --hooks      # Apenas hooks
adk update --force      # Sem confirmacao
```

| Opcao | Descricao |
|-------|-----------|
| `--commands` | Atualiza apenas slash commands |
| `--hooks` | Atualiza apenas hooks |
| `--agents` | Atualiza apenas agents |
| `--rules` | Atualiza apenas rules |
| `--skills` | Atualiza apenas skills |
| `--all` | Atualiza tudo |
| `--force` | Sem confirmacao |
| `--no-backup` | Nao cria backup |

---

### adk feature

Gerencia o lifecycle completo de features.

#### feature new

```bash
adk feature new auth
adk feature new auth "Sistema de autenticacao com JWT"
adk feature new auth -c /path/to/spec.md
adk feature new auth -p P0  # Prioridade
```

| Opcao | Descricao |
|-------|-----------|
| `[description]` | Descricao da feature |
| `-c, --context` | Arquivo de contexto |
| `-p, --priority` | Prioridade (P0-P4) |
| `--no-sync` | Nao sincroniza com PM tool |

#### feature research

```bash
adk feature research auth
adk feature research auth "Focar em seguranca"
```

**Output:** `.claude/plans/features/auth/research.md`

#### feature tasks

```bash
adk feature tasks auth
```

**Prereq:** research.md deve existir
**Output:** `.claude/plans/features/auth/tasks.md`

#### feature plan

```bash
adk feature plan auth
adk feature plan auth --skip-spec
```

**Prereq:** tasks.md deve existir
**Output:** `.claude/plans/features/auth/implementation-plan.md`

#### feature implement

```bash
adk feature implement auth
adk feature implement auth --phase 1
adk feature implement auth --base-branch develop
```

**Prereq:** implementation-plan.md deve existir
**Comportamento:** Cria worktree isolado em `.worktrees/auth/`

| Opcao | Descricao |
|-------|-----------|
| `--phase` | Fase especifica |
| `--skip-spec` | Pula validacao de spec |
| `--base-branch` | Branch base (default: main) |

#### feature qa

```bash
adk feature qa auth
```

**Prereq:** Worktree deve existir (rode implement primeiro)
**Output:** `.claude/plans/features/auth/qa-report.md`

#### feature docs

```bash
adk feature docs auth
```

**Prereq:** Worktree deve existir

#### feature finish

```bash
adk feature finish auth
adk feature finish auth --base-branch develop
```

**Comportamento:**
1. Commit das mudancas
2. Push para remote
3. Cria PR ou merge
4. Cleanup do worktree

#### feature list

```bash
adk feature list
```

**Output:**
```
Features do Projeto:

  * auth          Planned
  * user-profile  Researched
  * dashboard     Created
```

#### feature next

```bash
adk feature next auth    # Proxima etapa de auth
adk feature next         # Proxima etapa da feature ativa
adk feature n            # Alias
```

#### feature autopilot

```bash
adk feature autopilot auth
adk feature autopilot auth "Sistema de login com OAuth"
adk feature autopilot auth -c /path/to/spec.md
```

**Comportamento:**
- Executa todas as fases automaticamente
- Retomavel: se parar no meio, continua de onde parou
- Isolado: usa worktree separado

---

### adk quick (ou adk q)

Tarefa rapida sem processo formal. Para bugs, ajustes, micro features.

```bash
adk quick "corrigir botao de login no mobile"
adk q "adicionar validacao de email"
adk quick "fix parser error" -f src/utils/parser.ts
adk quick "ajustar cor" --no-test
adk quick "fix typo" --commit
```

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `-f, --file` | Arquivo especifico | - |
| `-t, --test` | Rodar testes | true |
| `--no-test` | Nao rodar testes | - |
| `--commit` | Commit automatico | false |

---

### adk workflow

Workflows automatizados de desenvolvimento.

#### workflow daily

```bash
adk workflow daily
```

**Comportamento:**
- Reviews git log desde ontem
- Atualiza project memory
- Cria nota em `.claude/daily/YYYY-MM-DD.md`

#### workflow pre-commit

```bash
adk workflow pre-commit
```

**Verifica:**
- console.log/debugger
- Secrets hardcoded
- TODOs criticos
- Testes quebrados

#### workflow pre-deploy

```bash
adk workflow pre-deploy -f auth
```

**Checklist:**
- [ ] Testes passando
- [ ] Coverage adequado
- [ ] Sem vulnerabilidades
- [ ] Documentacao atualizada
- [ ] Feature flags configurados
- [ ] Monitoring setup

**Resultado:** GO / NO-GO

---

### adk agent

Gerencia agents especializados.

#### agent create

```bash
adk agent create security-scanner
adk agent create optimizer -t analyzer
```

| Opcao | Descricao |
|-------|-----------|
| `-t, --type` | Tipo (analyzer, implementer, tester, generic) |

#### agent run

```bash
adk agent run security-scanner
adk agent run optimizer -c "Focar em queries SQL"
```

#### agent pipeline

```bash
adk agent pipeline auth
```

**Pipeline padrao:** analyzer > optimizer > documenter

#### agent parallel

```bash
adk agent parallel auth
adk agent parallel auth --max-agents 5
adk agent parallel auth --fallback-sequential
```

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `--max-agents` | Maximo simultaneo | 3 |
| `--fallback-sequential` | Fallback se paralelo falhar | false |

#### agent status

```bash
adk agent status
adk agent status --watch
```

---

### adk memory

Gerencia memoria persistente do projeto.

#### memory save

```bash
adk memory save auth
```

**Salva:** Contexto atual para feature especifica

#### memory load

```bash
adk memory load auth
```

**Carrega:** Memoria de feature para sessao

#### memory view

```bash
adk memory view auth
adk memory view --global
```

#### memory compact

```bash
adk memory compact auth
```

**Comportamento:** Compacta memoria grande usando Claude (>800 linhas)

#### memory search

```bash
adk memory search "OAuth"
adk memory search "login" -f auth
```

#### memory update

```bash
adk memory update
```

**Atualiza:** Memoria global do projeto

#### memory recall

```bash
adk memory recall "autenticacao"
adk memory recall "cache" -c architecture -l 10
```

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `-c, --category` | Filtrar por categoria | - |
| `-l, --limit` | Limite de resultados | 5 |

#### memory link / unlink

```bash
adk memory link auth ADR-001
adk memory unlink auth ADR-001
```

**Comportamento:** Vincula/desvincula decisao a feature

#### memory export

```bash
adk memory export
adk memory export --format json --output ./backup/
```

---

### adk spec

Gerencia especificacoes formais de features.

#### spec create

```bash
adk spec create auth
adk spec create auth --from-prd
```

#### spec validate

```bash
adk spec validate auth
adk spec validate auth --fix
```

#### spec generate

```bash
adk spec generate auth
```

**Comportamento:** Gera scaffolding de codigo a partir da spec

#### spec view

```bash
adk spec view auth
```

---

### adk tool

Gerencia registry de tools.

#### tool search

```bash
adk tool search "test"
adk tool search "validation" -c testing -l 10
```

#### tool register / unregister

```bash
adk tool register my-linter
adk tool register --from-file tools.json
adk tool unregister my-linter
```

#### tool list

```bash
adk tool list
adk tool list -c testing
adk tool list --discoverable
```

#### tool index

```bash
adk tool index
```

**Comportamento:** Re-indexa tools de agents e skills

#### tool info

```bash
adk tool info my-linter
```

---

### adk deploy

Gerencia deployments.

#### deploy staging

```bash
adk deploy staging auth
```

**Comportamento:**
- Merge para staging branch
- Trigger CI/CD
- Monitor deploy
- Run smoke tests

#### deploy production

```bash
adk deploy production auth
adk deploy production auth --percentage 10
```

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `--percentage` | Porcentagem inicial de rollout | 10 |

#### deploy rollback

```bash
adk deploy rollback auth
```

---

### adk config

Configura integracoes externas.

#### config integration

```bash
adk config integration clickup  # Setup interativo
adk config integration --show   # Ver config atual
adk config integration --disable
```

---

### adk sync

Sincroniza features com ferramenta de projeto.

```bash
adk sync              # Todas features pendentes
adk sync auth         # Feature especifica
adk sync --force      # Re-sync ja sincronizadas
```

---

### adk import

Importa tasks de ferramenta externa como features.

```bash
adk import            # Importa todas
adk import --list     # Lista sem importar
adk import --dry-run  # Preview
adk import --id abc123  # Task especifica
adk import --force    # Sobrescreve existentes
```

---

### adk report

Gera relatorios do projeto.

```bash
adk report --weekly            # Relatorio semanal
adk report --feature auth      # Relatorio de feature
```

---

## Estrutura CADD

```
.claude/
├── memory/                 # Contexto persistente
│   ├── project-context.md  # Memoria global
│   └── features/           # Memorias por feature
│       └── auth.md
├── plans/
│   └── features/
│       └── auth/
│           ├── prd.md
│           ├── research.md
│           ├── tasks.md
│           ├── implementation-plan.md
│           ├── spec.md
│           ├── context.md
│           ├── qa-report.md
│           └── progress.json
├── agents/                 # 8 agents especializados
│   ├── analyzer.md
│   ├── architect.md
│   ├── implementer.md
│   ├── tester.md
│   ├── reviewer.md
│   ├── prd-creator.md
│   ├── task-breakdown.md
│   └── documenter.md
├── skills/                 # 4 skills
│   ├── code-review/
│   ├── tdd-development/
│   ├── task-planning/
│   └── prd-writing/
├── commands/               # 9 slash commands
│   ├── analyze.md
│   ├── daily.md
│   ├── new-feature.md
│   ├── implement.md
│   ├── qa.md
│   ├── finish.md
│   ├── init.md
│   ├── recall.md
│   └── next-step.md
├── rules/                  # 4 regras
│   ├── code-style.md
│   ├── testing-standards.md
│   ├── security-rules.md
│   └── git-workflow.md
├── hooks/                  # 6 hooks
│   ├── inject-focus.sh
│   ├── scope-check.sh
│   ├── validate-bash.sh
│   ├── post-write.sh
│   ├── context-recall.sh
│   └── update-state.sh
├── decisions/              # ADRs
├── daily/                  # Notas diarias
├── reports/                # Relatorios gerados
├── settings.json           # Config de hooks
└── active-focus.md         # Feature ativa atual
```

---

## Integracao com Project Management

### ClickUp

O ADK suporta sincronizacao bidirecional com ClickUp.

#### Setup

```bash
adk config integration clickup
```

O assistente ira pedir:
- API Token (salvo em `.env`)
- Workspace ID
- Space ID
- List ID

**Configuracao gerada:**

`.adk/config.json`:
```json
{
  "version": "1.0.0",
  "integration": {
    "provider": "clickup",
    "enabled": true,
    "autoSync": false,
    "syncOnPhaseChange": true,
    "conflictStrategy": "local-wins"
  },
  "providers": {
    "clickup": {
      "workspaceId": "123456",
      "spaceId": "789012",
      "listId": "345678"
    }
  }
}
```

`.env`:
```
CLICKUP_API_TOKEN=pk_12345678_XXXX
```

#### Mapeamento

| ADK | ClickUp |
|-----|---------|
| Feature name | Task name |
| Phase | Task status |
| PRD content | Task description |
| Progress % | Custom field |

#### Conflict Resolution

Estrategias disponiveis (`conflictStrategy`):
- `local-wins` - Local sempre sobrescreve (default)
- `remote-wins` - Remoto sempre sobrescreve
- `newest-wins` - Mais recente vence
- `manual` - Gera conflict report

#### Offline Queue

Operacoes que falham sao enfileiradas em `.adk/sync-queue.json`:
- Max 3 retries com exponential backoff
- Persistente entre sessoes
- `adk sync` processa a fila

---

## Extensibilidade

### Criar Novo Agent

1. Crie arquivo em `.claude/agents/meu-agent.md`:

```markdown
---
name: meu-agent
description: Descricao do agent
context: fork
---

# Agent: Meu Agent

## Objetivo
[Descreva o objetivo]

## Workflow
1. Passo 1
2. Passo 2
3. Passo 3

## Output
[Descreva o output esperado]
```

2. Execute:
```bash
adk agent run meu-agent
```

### Criar Novo Skill

1. Crie diretorio em `.claude/skills/meu-skill/`
2. Adicione `SKILL.md` com instrucoes
3. Adicione templates em `templates/`
4. Reference no agent: `skill: meu-skill`

### Adicionar Novo Provider

1. Crie diretorio em `src/providers/meu-provider/`
2. Implemente interface `ProjectProvider`:
   - `connect(credentials)`
   - `createFeature(feature)`
   - `updateFeature(id, data)`
   - `syncFeature(feature, remoteId?)`
   - `getRemoteChanges(since)`
3. Registre em `src/providers/index.ts`
4. Adicione a `SUPPORTED_PROVIDERS` em `src/commands/config.ts`

---

## Tecnicas de Prompt Engineering

O ADK utiliza tecnicas avancadas de engenharia de prompt:

### 1. Phased Prompting

Prompts em fases numeradas:

```
PHASE 1: RESEARCH
PHASE 2: DETAILED PLANNING
PHASE 3: IMPLEMENTATION (TDD)
```

### 2. Input/Output Specification

```
Input: .claude/plans/features/auth/research.md
Output: .claude/plans/features/auth/implementation-plan.md
```

### 3. Structured Templates

Templates com estrutura pre-definida garantem consistencia.

### 4. Context Injection

```
<context>
${contextContent}
</context>
```

### 5. Explicit Constraints

```
IMPORTANTE: TDD - TESTES PRIMEIRO
IMPORTANTE: Este e apenas o plano. NAO IMPLEMENTE AINDA.
```

### 6. Verification Gates

Validacoes que impedem avanco sem pre-requisitos.

### 7. Chain of Thought

```
Process:
1. WRITE TESTS FIRST
   - Escreva TODOS os testes da fase
   - Execute e confirme que falham
2. IMPLEMENT
   - Implemente codigo minimo
```

### 8. Checklist-Driven

```
## 1. Tests
- [ ] Unit tests
- [ ] Integration tests
```

---

## Troubleshooting

### Claude Code nao encontrado

```
Erro: Claude Code CLI nao esta instalado
```

**Solucao:**
```bash
# Verifique se claude esta no PATH
which claude

# Se nao estiver, instale via:
npm install -g @anthropic-ai/claude-code
```

### Worktree ja existe

```
Erro: Worktree para feature 'auth' ja existe
```

**Solucao:**
```bash
# Liste worktrees
git worktree list

# Remova o existente
git worktree remove .worktrees/auth --force

# Tente novamente
adk feature implement auth
```

### Fase nao pode ser executada

```
Erro: Execute research primeiro: adk feature research auth
```

**Solucao:** As fases devem ser executadas em ordem. Execute a fase faltante primeiro.

### Sync falha repetidamente

```
Erro: Falha ao sincronizar com ClickUp
```

**Solucao:**
1. Verifique `.env` tem token valido
2. Verifique `.adk/config.json` tem IDs corretos
3. Verifique conectividade de rede
4. `adk sync --force` para re-tentar

### Memoria muito grande

```
Warning: Memoria excede 800 linhas
```

**Solucao:**
```bash
adk memory compact auth
```

### Hooks nao executam

**Solucao:**
1. Verifique `.claude/settings.json` existe
2. Verifique permissao de execucao: `chmod +x .claude/hooks/*.sh`
3. Verifique sintaxe dos hooks

---

## Fluxos de Trabalho Recomendados

### Bug Fix Rapido

```bash
adk quick "corrigir X" --commit
```

### Feature Completa (Manual)

```bash
adk feature new nome "descricao"
adk feature research nome
adk feature tasks nome
adk feature plan nome
adk feature implement nome
adk feature qa nome
adk feature docs nome
adk feature finish nome
```

### Feature Completa (Automatico)

```bash
adk feature autopilot nome "descricao"
```

### Retomando Feature Interrompida

```bash
adk feature autopilot nome   # Continua de onde parou
# ou
adk feature next nome        # Proxima etapa
```

### Rotina Diaria

```bash
adk workflow daily
adk feature list
adk feature next             # Proxima etapa da feature ativa
```

---

## Desenvolvimento do ADK

### Comandos

```bash
npm run dev        # Watch mode
npm run build      # Compilar
npm run check:fix  # Lint + format
npm test           # Testes
npm run type-check # Verificar tipos
```

### Estrutura do Codigo

```
src/
├── cli.ts           # Entry point
├── commands/        # Implementacao de comandos
├── providers/       # Integracoes externas
├── types/           # TypeScript types
└── utils/           # Utilitarios
    ├── claude.ts    # Execucao de Claude Code
    ├── templates.ts # Sistema de templates
    ├── memory-utils.ts
    ├── progress.ts
    └── ...
```

### Adicionar Novo Comando

1. Crie `src/commands/meu-comando.ts`
2. Exporte instancia singleton
3. Registre em `src/cli.ts`
4. Siga pattern de error handling (ora + logger)

---

## ADK v3 (Preview - Session Continuity)

**Status:** Alpha / Desenvolvimento Isolado

O ADK v3 introduz **session continuity** - rastreamento e retomada de sessões Claude entre fases de desenvolvimento, resolvendo o problema crítico de perda de contexto do v2.

### Problema Resolvido

No v2, cada comando (`feature research`, `feature plan`, etc) criava uma nova sessão Claude isolada, resultando em **0% de continuidade de contexto**. O v3 captura session IDs e permite retomada automática.

### Como Testar

```bash
npm run build
npm run adk3 -- feature status my-feature
```

**Importante:** v3 é isolado e não afeta comandos v2. Use apenas `npm run adk3` para testar.

### Arquitetura v3

```
executeClaudeCommandV3 (spawn assíncrono)
    ↓
--print-session-id → parseSessionId()
    ↓
SessionStore.save() → .claude/plans/features/{name}/sessions/
    ↓
Resume automático quando < 24h de inatividade
```

### Funcionalidades

- ✅ Captura automática de session ID via `--print-session-id`
- ✅ Resume automático de sessões (janela de 24h)
- ✅ Persistência em `.claude/plans/features/{name}/sessions/`
- ✅ Comando `feature status` com histórico de sessões
- ✅ Atomic writes para consistência de dados
- 🚧 Prompts diferenciados (Initializer/Coding Agent) - Sprint 2
- 🚧 Comando `feature work` com loop - Sprint 3

### Documentação Completa

Ver `.claude/plans/features/adk-v3-session-continuity/README.md`

---

## Licenca

MIT

---

Feito por [Renan Lido](https://github.com/renanlido)
