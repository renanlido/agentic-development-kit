# ADK v2 - Agentic Development Kit

Framework de desenvolvimento assistido por IA usando Claude Code com as melhores praticas de 2025/2026.

## O Que E

O ADK e um **framework nativo para Claude Code** que orquestra agentes especializados para todo o ciclo de desenvolvimento de software.

**NAO e um CLI externo.** E uma estrutura de arquivos (agents, skills, commands, hooks) que funciona diretamente no Claude Code.

---

## Como Funciona

```
Voce tem uma ideia
       │
       ▼
/new-feature login ────────► prd-creator agent ────► PRD
       │                            │
       │                            ▼
       │                     task-breakdown agent ──► Tasks
       │
       ▼
/implement login ─────────► architect agent ────────► Plano
       │                            │
       │                            ▼
       │                     implementer agent ─────► Codigo (TDD)
       │                            │
       │                            ▼
       │                     reviewer agent ────────► Review
       │
       ▼
/qa login ────────────────► tester agent ──────────► Validacao
       │
       ▼
Feature Pronta!
```

---

## Estrutura

```
.claude/
├── memory/              # Contexto persistente
│   ├── project-context.md
│   ├── architecture.md
│   └── current-state.md
│
├── agents/              # Agentes especializados
│   ├── prd-creator.md
│   ├── task-breakdown.md
│   ├── architect.md
│   ├── implementer.md
│   ├── reviewer.md
│   ├── tester.md
│   └── documenter.md
│
├── skills/              # Capacidades auto-descobertas
│   ├── prd-writing/
│   ├── task-planning/
│   ├── tdd-development/
│   └── code-review/
│
├── commands/            # Slash commands
│   ├── new-feature.md
│   ├── implement.md
│   ├── qa.md
│   ├── daily.md
│   ├── analyze.md
│   └── init.md
│
├── rules/               # Regras auto-carregadas
│   ├── code-style.md
│   ├── testing-standards.md
│   ├── security-rules.md
│   └── git-workflow.md
│
├── hooks/               # Automacao e Guardrails
│   ├── inject-focus.sh  # Injeta contexto da feature ativa
│   ├── scope-check.sh   # Alerta edicoes fora do escopo
│   ├── validate-bash.sh
│   ├── post-write.sh
│   └── update-state.sh
│
├── plans/features/      # Features planejadas
│   └── <nome>/
│       ├── prd.md
│       ├── tasks.md
│       ├── constraints.md  # Restricoes da feature
│       └── implementation-plan.md
│
├── active-focus.md      # Feature ativa no momento
└── settings.json        # Configuracao de hooks
```

---

## Comandos Disponiveis

| Comando | Descricao |
|---------|-----------|
| `/init` | Inicializa ADK em projeto existente |
| `/analyze` | Analisa codebase e documenta arquitetura |
| `/new-feature <nome>` | Cria PRD + Tasks para nova feature |
| `/implement <nome>` | Implementa feature seguindo TDD |
| `/qa <nome>` | Valida qualidade da feature |
| `/daily` | Sincroniza estado do projeto |

---

## Como Usar

### Em Projeto Novo

```bash
# 1. No seu projeto
cd meu-projeto

# 2. Copiar estrutura ADK
cp -r /path/to/adk/.claude .

# 3. Abrir Claude Code
claude

# 4. Inicializar
> /init

# 5. Analisar projeto (se tiver codigo)
> /analyze

# 6. Criar primeira feature
> /new-feature user-authentication
```

### Em Projeto Existente

```bash
# 1. Copiar estrutura
cp -r /path/to/adk/.claude .

# 2. Abrir Claude Code
claude

# 3. Analisar e documentar
> /analyze

# 4. Preencher contexto
> Edite .claude/memory/project-context.md

# 5. Comecar a desenvolver
> /new-feature minha-feature
```

---

## Fluxo de Desenvolvimento

### 1. Definir Feature

```
> /new-feature checkout-payment

Claude vai:
1. Fazer perguntas sobre a feature
2. Criar PRD estruturado
3. Quebrar em tasks implementaveis
```

### 2. Implementar

```
> /implement checkout-payment

Claude vai:
1. Analisar arquitetura existente
2. Criar plano de implementacao
3. Implementar seguindo TDD:
   - Escrever teste (RED)
   - Implementar minimo (GREEN)
   - Refatorar (REFACTOR)
4. Fazer commits incrementais
```

### 3. Validar

```
> /qa checkout-payment

Claude vai:
1. Rodar testes
2. Verificar coverage
3. Fazer code review
4. Gerar relatorio
```

---

## Agentes Especializados

| Agente | Proposito |
|--------|-----------|
| **prd-creator** | Cria PRDs a partir de ideias |
| **task-breakdown** | Quebra PRDs em tasks |
| **architect** | Analisa e documenta arquitetura |
| **implementer** | Implementa codigo (TDD) |
| **reviewer** | Code review com checklist |
| **tester** | Cria e valida testes |
| **documenter** | Gera documentacao |

---

## Skills Auto-Descobertos

Skills sao capacidades que o Claude aplica automaticamente:

| Skill | Ativado quando |
|-------|---------------|
| **prd-writing** | Criar PRD, definir requisitos |
| **task-planning** | Quebrar em tasks, planejar |
| **tdd-development** | Implementar, codar |
| **code-review** | Revisar, analisar codigo |

---

## Rules (Regras)

Regras em `.claude/rules/` sao carregadas automaticamente em toda sessao:

- **code-style.md** - Padroes de formatacao
- **testing-standards.md** - Padroes de teste
- **security-rules.md** - Regras de seguranca
- **git-workflow.md** - Workflow git

---

## Hooks (Automacao e Guardrails)

| Hook | Evento | Funcao |
|------|--------|--------|
| **inject-focus.sh** | UserPromptSubmit | Mostra feature ativa + constraints |
| **scope-check.sh** | PreToolUse (Write/Edit) | Alerta edicoes fora do escopo |
| **validate-bash.sh** | PreToolUse (Bash) | Bloqueia comandos perigosos |
| **post-write.sh** | PostToolUse | Auto-format apos escrita |
| **update-state.sh** | Stop | Atualiza estado ao finalizar |

### Sistema de Foco

O ADK mantem voce focado na feature atual:

1. **active-focus.md** - Registra feature sendo trabalhada
2. **constraints.md** - Define escopo permitido por feature
3. **inject-focus.sh** - Mostra contexto a cada prompt

Ao iniciar trabalho em uma feature, voce vera:
```
FOCO ATIVO: minha-feature
Status: arquitetura pronta
Path: .claude/plans/features/minha-feature/

CONSTRAINTS:
- src/commands/
- src/utils/

- NAO adicionar dependencias externas
```

---

## Personalizacao

### Adicionar Agente

```yaml
# .claude/agents/meu-agente.md
---
name: meu-agente
description: O que faz
tools: [Read, Write]
model: sonnet
---

# Instrucoes
[Conteudo]
```

### Adicionar Command

```yaml
# .claude/commands/meu-comando.md
---
description: O que faz
---

# Meu Comando: $ARGUMENTS
[Instrucoes]
```

### Adicionar Rule

Crie `.claude/rules/minha-regra.md` com regras a serem seguidas.

---

## Referencias

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Docs - Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Memory](https://code.claude.com/docs/en/memory)
- [Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase)
