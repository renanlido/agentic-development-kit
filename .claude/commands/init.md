---
description: Inicializa estrutura ADK em projeto existente
---

# Inicializar ADK

Voce vai configurar a estrutura ADK neste projeto.

## Processo

### 1. Verificar Estado

```bash
# Verificar se ja existe estrutura
ls -la .claude/ 2>/dev/null

# Verificar se e projeto git
git status 2>/dev/null
```

### 2. Criar Estrutura Base

Crie os diretorios necessarios:

```
.claude/
├── memory/           # Contexto persistente
├── plans/
│   └── features/     # Features planejadas
├── agents/           # Agentes especializados
├── skills/           # Skills auto-descobertos
├── commands/         # Slash commands
├── rules/            # Regras modulares
└── hooks/            # Scripts de automacao
```

### 3. Criar Arquivos Iniciais

#### .claude/memory/project-context.md

```markdown
# Contexto do Projeto

**Nome:** [nome do projeto]
**Data:** YYYY-MM-DD
**Framework:** ADK (Agentic Development Kit)

## Stack Tecnologico

[Preencher com stack identificado ou perguntar ao usuario]

- **Linguagem:**
- **Framework:**
- **Database:**
- **Testes:**

## Estrutura do Projeto

[Descricao da estrutura]

## Convencoes

[Padroes a seguir]

## Comandos Principais

\`\`\`bash
# Desenvolvimento
[comando]

# Testes
[comando]

# Build
[comando]
\`\`\`

## Notas

[Observacoes importantes]
```

#### .claude/memory/current-state.md

```markdown
# Estado Atual

**Ultima Atualizacao:** YYYY-MM-DD

## Em Progresso

- [Nenhum]

## Concluido Recentemente

- Configuracao inicial do ADK

## Proximos Passos

- Definir primeira feature com /new-feature
```

### 4. Copiar Agentes Padrao

Copie os agentes do ADK:
- prd-creator.md
- task-breakdown.md
- architect.md
- implementer.md
- reviewer.md
- tester.md
- documenter.md

### 5. Copiar Skills Padrao

Copie os skills do ADK:
- prd-writing/
- task-planning/
- tdd-development/
- code-review/

### 6. Copiar Commands Padrao

Copie os commands do ADK:
- new-feature.md
- implement.md
- qa.md
- daily.md
- analyze.md

### 7. Atualizar .gitignore

Adicione ao .gitignore:

```
# ADK - Arquivos transientes
.claude/reports/
.claude/daily/
.claude/analysis/

# ADK - Arquivos locais (nao versionar)
.claude/*.local.md
```

## Output

```
ADK Inicializado!

Estrutura criada:
.claude/
├── memory/          (contexto persistente)
├── plans/features/  (features planejadas)
├── agents/          (7 agentes)
├── skills/          (4 skills)
├── commands/        (5 commands)
└── rules/           (regras modulares)

Proximos passos:
1. Edite .claude/memory/project-context.md com detalhes do seu projeto
2. Execute /analyze para documentar arquitetura existente
3. Execute /new-feature <nome> para criar sua primeira feature

Comandos disponiveis:
- /new-feature <nome>  - Criar nova feature
- /implement <nome>    - Implementar feature
- /qa <nome>           - Validar qualidade
- /daily               - Sincronizar estado
- /analyze             - Analisar codebase
```
