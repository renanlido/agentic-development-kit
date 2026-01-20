# ADK v2: Framework de Desenvolvimento Assistido por IA

## Visão Geral

O ADK v2 é um **framework nativo para Claude Code** que orquestra agentes especializados para todo o ciclo de desenvolvimento de software.

**Diferença do v1:** O v1 era um CLI externo que gerava prompts. O v2 usa as **funcionalidades nativas** do Claude Code (agents, skills, commands, hooks) diretamente.

---

## Arquitetura Baseada no Estado da Arte 2025/2026

### Fontes de Referência

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) - Anthropic
- [Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase) - Exemplo completo
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [How I Use Every Claude Code Feature](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)

### Princípios do Estado da Arte

1. **Agentes Especializados** - Cada agente tem um propósito único e contexto isolado
2. **Skills Auto-Descobertos** - Claude aplica automaticamente quando detecta padrão
3. **Hooks Determinísticos** - Regras obrigatórias (não sugestões)
4. **Memória Hierárquica** - CLAUDE.md + rules/ + memory/
5. **Orquestração via Commands** - Pipelines de agentes via slash commands

---

## Estrutura do Framework

```
.claude/
├── CLAUDE.md                    # Memória principal do projeto
├── settings.json                # Hooks e permissões
│
├── memory/                      # Contexto persistente
│   ├── project-context.md       # Visão geral do projeto
│   ├── architecture.md          # Decisões arquiteturais
│   ├── conventions.md           # Padrões de código
│   └── current-state.md         # Estado atual (atualizado por hooks)
│
├── agents/                      # Agentes especializados
│   ├── prd-creator.md           # Cria PRDs a partir de ideias
│   ├── task-breakdown.md        # Quebra PRDs em tasks
│   ├── architect.md             # Analisa e documenta arquitetura
│   ├── implementer.md           # Implementa código (TDD)
│   ├── reviewer.md              # Review de código
│   ├── tester.md                # Cria testes
│   └── documenter.md            # Gera documentação
│
├── skills/                      # Capacidades auto-descobertas
│   ├── prd-writing/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── prd-template.md
│   ├── task-planning/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       └── task-template.md
│   ├── tdd-development/
│   │   ├── SKILL.md
│   │   └── patterns/
│   └── code-review/
│       └── SKILL.md
│
├── commands/                    # Workflows invocáveis
│   ├── new-feature.md           # /new-feature <nome>
│   ├── implement.md             # /implement <feature>
│   ├── review.md                # /review
│   ├── daily.md                 # /daily
│   └── deploy-check.md          # /deploy-check
│
├── hooks/                       # Scripts de automação
│   ├── pre-commit.sh            # Validação antes de commit
│   ├── post-implement.sh        # Após implementação
│   └── skill-suggester.js       # Sugere skills relevantes
│
├── plans/                       # Artefatos de planejamento
│   └── features/
│       └── <feature-name>/
│           ├── prd.md
│           ├── tasks.md
│           ├── research.md
│           └── implementation-plan.md
│
└── rules/                       # Regras modulares (auto-carregadas)
    ├── code-style.md
    ├── testing-standards.md
    ├── security-rules.md
    └── git-workflow.md
```

---

## Pipeline de Desenvolvimento

### Fluxo Orquestrado

```
┌─────────────────────────────────────────────────────────────────┐
│                        IDEIA / REQUISITO                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  /new-feature <nome>                                            │
│  ┌─────────────────┐                                            │
│  │  prd-creator    │ → Lê skill prd-writing                     │
│  │     agent       │ → Usa template prd-template.md             │
│  │                 │ → Gera plans/features/<nome>/prd.md        │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  (automático após PRD)                                          │
│  ┌─────────────────┐                                            │
│  │  task-breakdown │ → Lê PRD criado                            │
│  │     agent       │ → Usa template task-template.md            │
│  │                 │ → Gera plans/features/<nome>/tasks.md      │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  /implement <nome>                                              │
│  ┌─────────────────┐                                            │
│  │   architect     │ → Analisa codebase existente               │
│  │     agent       │ → Atualiza memory/architecture.md          │
│  │                 │ → Gera implementation-plan.md              │
│  └─────────────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │  implementer    │ → Lê plan + skill tdd-development          │
│  │     agent       │ → Escreve testes primeiro                  │
│  │                 │ → Implementa código                        │
│  │                 │ → Commit incremental                       │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  (hook: post-implement)                                         │
│  ┌─────────────────┐                                            │
│  │   reviewer      │ → Lê skill code-review                     │
│  │     agent       │ → Analisa código gerado                    │
│  │                 │ → Sugere melhorias                         │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  /deploy-check                                                  │
│  ┌─────────────────┐                                            │
│  │   tester +      │ → Valida coverage >= 80%                   │
│  │   documenter    │ → Gera documentação                        │
│  │                 │ → Checklist de deploy                      │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agentes Especializados

### 1. PRD Creator Agent

```yaml
name: prd-creator
description: Cria PRDs estruturados a partir de ideias ou requisitos
tools: [Read, Write, WebFetch, Glob, Grep]
model: opus
```

**Comportamento:**

1. Lê contexto do projeto em `memory/project-context.md`
2. Carrega template de `skills/prd-writing/templates/prd-template.md`
3. Faz perguntas para entender a feature
4. Gera PRD estruturado seguindo template
5. Salva em `plans/features/<nome>/prd.md`

### 2. Task Breakdown Agent

```yaml
name: task-breakdown
description: Quebra PRDs em tasks implementáveis
tools: [Read, Write, Glob]
model: sonnet
```

**Comportamento:**

1. Lê PRD da feature
2. Analisa dependências
3. Quebra em tasks ordenadas
4. Define critérios de aceitação por task
5. Salva em `plans/features/<nome>/tasks.md`

### 3. Architect Agent

```yaml
name: architect
description: Analisa e documenta arquitetura antes de implementar
tools: [Read, Write, Glob, Grep, Bash]
model: opus
```

**Comportamento:**

1. Analisa código existente
2. Identifica padrões usados
3. Atualiza `memory/architecture.md`
4. Cria `CLAUDE.md` se não existir
5. Gera plano de implementação alinhado à arquitetura

### 4. Implementer Agent

```yaml
name: implementer
description: Implementa código seguindo TDD
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: opus
```

**Comportamento:**

1. Lê tasks da feature
2. Para cada task:
   - Escreve teste primeiro (RED)
   - Implementa código mínimo (GREEN)
   - Refatora (REFACTOR)
   - Commit
3. Atualiza `memory/current-state.md`

### 5. Reviewer Agent

```yaml
name: reviewer
description: Review de código com checklist de qualidade
tools: [Read, Glob, Grep]
model: sonnet
```

**Comportamento:**

1. Analisa diff do código implementado
2. Verifica contra `rules/code-style.md`
3. Verifica contra `rules/security-rules.md`
4. Gera relatório de review

### 6. Tester Agent

```yaml
name: tester
description: Cria e valida testes
tools: [Read, Write, Bash, Glob]
model: sonnet
```

**Comportamento:**

1. Analisa código sem cobertura
2. Gera testes unitários/integração
3. Valida coverage >= 80%
4. Reporta gaps

### 7. Documenter Agent

```yaml
name: documenter
description: Gera documentação técnica
tools: [Read, Write, Glob, Grep]
model: haiku
```

**Comportamento:**

1. Analisa código implementado
2. Gera/atualiza README
3. Gera documentação de API
4. Atualiza `memory/` conforme necessário

---

## Skills (Auto-Descobertos)

### Skill: PRD Writing

```
.claude/skills/prd-writing/
├── SKILL.md              # Descrição para auto-descoberta
└── templates/
    └── prd-template.md   # Template usado pelo agent
```

**SKILL.md:**

```markdown
---
name: prd-writing
description: Escrever PRDs estruturados para features
triggers:
  - "criar prd"
  - "nova feature"
  - "definir requisitos"
---

# PRD Writing Skill

Este skill é ativado quando o usuário quer definir uma nova feature.

## Processo
1. Entender o problema/necessidade
2. Definir requisitos funcionais
3. Definir requisitos não-funcionais
4. Estabelecer critérios de aceitação

## Template
Use o template em `templates/prd-template.md`
```

### Skill: TDD Development

```
.claude/skills/tdd-development/
├── SKILL.md
└── patterns/
    ├── test-patterns.md
    └── mocking-guide.md
```

**SKILL.md:**

```markdown
---
name: tdd-development
description: Desenvolvimento guiado por testes
triggers:
  - "implementar"
  - "desenvolver"
  - "codar"
---

# TDD Development Skill

## Ciclo Obrigatório
1. **RED**: Escrever teste que falha
2. **GREEN**: Implementar código mínimo para passar
3. **REFACTOR**: Melhorar código mantendo testes passando

## Padrões
Ver `patterns/test-patterns.md`
```

---

## Slash Commands (Orquestradores)

### /new-feature

```markdown
---
description: Inicia o processo de criação de uma nova feature
---

# Nova Feature: $ARGUMENTS

## Processo

1. **Criar estrutura**
   Criar pasta `.claude/plans/features/$ARGUMENTS/`

2. **Delegar para PRD Creator**
   Use o Task tool para chamar o agent `prd-creator`:
   - Contexto: `.claude/memory/project-context.md`
   - Template: `.claude/skills/prd-writing/templates/prd-template.md`
   - Output: `.claude/plans/features/$ARGUMENTS/prd.md`

3. **Delegar para Task Breakdown**
   Após PRD criado, use Task tool para chamar `task-breakdown`:
   - Input: PRD criado
   - Output: `.claude/plans/features/$ARGUMENTS/tasks.md`

4. **Reportar resultado**
   Informar ao usuário que PRD e tasks foram criados.
```

### /implement

```markdown
---
description: Implementa uma feature existente
---

# Implementar: $ARGUMENTS

## Pré-requisitos
Verificar se existe:
- `.claude/plans/features/$ARGUMENTS/prd.md`
- `.claude/plans/features/$ARGUMENTS/tasks.md`

Se não existir, informar usuário para rodar `/new-feature` primeiro.

## Processo

1. **Análise arquitetural**
   Use Task tool para chamar `architect`:
   - Analisar codebase
   - Atualizar memory/architecture.md
   - Gerar implementation-plan.md

2. **Implementação**
   Use Task tool para chamar `implementer`:
   - Seguir tasks.md
   - Aplicar skill tdd-development
   - Commits incrementais

3. **Review automático**
   Use Task tool para chamar `reviewer`:
   - Analisar código gerado
   - Reportar issues
```

### /daily

```markdown
---
description: Atualiza estado do projeto e sincroniza memória
---

# Daily Sync

1. Analisar git log das últimas 24h
2. Atualizar `.claude/memory/current-state.md`
3. Identificar trabalho em progresso
4. Listar próximos passos
```

---

## Hooks (Automação)

### settings.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [".claude/hooks/validate-bash.sh"]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [".claude/hooks/post-write.sh"]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [".claude/hooks/skill-suggester.js"]
      }
    ],
    "Stop": [
      {
        "hooks": [".claude/hooks/update-state.sh"]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep",
      "Bash(npm run *)",
      "Bash(git *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force)"
    ]
  }
}
```

### Hook: skill-suggester.js

```javascript
// Analisa prompt do usuário e sugere skills relevantes
const triggers = {
  'prd-writing': ['criar prd', 'nova feature', 'definir requisitos'],
  'tdd-development': ['implementar', 'desenvolver', 'codar'],
  'code-review': ['review', 'revisar', 'analisar código']
};

// Retorna skills sugeridos baseado no prompt
```

### Hook: update-state.sh

```bash
#!/bin/bash
# Atualiza current-state.md ao final de cada sessão

DATE=$(date +%Y-%m-%d)
echo "## Última atualização: $DATE" > .claude/memory/current-state.md
git status --short >> .claude/memory/current-state.md
```

---

## Como Usar o ADK v2

### Setup Inicial (Projeto Novo)

```bash
# 1. Clonar ADK
git clone <adk-repo>

# 2. Copiar estrutura .claude/ para seu projeto
cp -r adk/.claude-template/ meu-projeto/.claude/

# 3. Preencher contexto inicial
code meu-projeto/.claude/memory/project-context.md

# 4. Abrir Claude Code
cd meu-projeto
claude
```

### Setup (Projeto Existente)

```bash
# 1. Copiar estrutura .claude/
cp -r adk/.claude-template/ .claude/

# 2. Rodar agent architect para documentar
# No Claude Code:
> Use o agent architect para analisar este projeto e documentar a arquitetura
```

### Workflow Diário

```bash
# Abrir Claude Code
claude

# Sincronizar estado
> /daily

# Criar nova feature
> /new-feature login-social

# Implementar
> /implement login-social

# Verificar para deploy
> /deploy-check login-social
```

---

## Diferenças: ADK v1 vs v2

| Aspecto | v1 | v2 |
|---------|----|----|
| Execução | CLI externo (`adk`) | Nativo Claude Code |
| Agentes | Prompts gerados | `.claude/agents/` nativos |
| Skills | Templates soltos | Auto-descobertos |
| Automação | Manual | Hooks nativos |
| Orquestração | CLI commands | Slash commands |
| Memória | Arquivos avulsos | Hierarquia nativa |

---

## Próximos Passos

1. [ ] Implementar estrutura de agentes
2. [ ] Criar skills com templates
3. [ ] Configurar hooks
4. [ ] Criar slash commands
5. [ ] Testar fluxo completo
6. [ ] Documentar uso

---

## Referências

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Docs - Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase)
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Agentic AI Frameworks 2025](https://akka.io/blog/agentic-ai-frameworks)
- [Claude Code Memory](https://code.claude.com/docs/en/memory)
