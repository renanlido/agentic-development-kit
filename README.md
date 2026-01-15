# Agentic Development Kit (ADK)

> CLI toolkit para desenvolvimento com Claude Code usando framework CADD

## O que e o ADK?

O ADK e um orquestrador de prompts para Claude Code. Ele nao executa codigo diretamente - ele gera prompts estruturados e envia para o Claude Code fazer o trabalho real.

```
Voce roda: adk feature plan auth
           |
ADK gera prompt estruturado com contexto
           |
ADK executa: claude "prompt..."
           |
Claude Code faz o trabalho (le, escreve, implementa)
```

## Instalacao

```bash
git clone https://github.com/renanlido/agentic-development-kit
cd agentic-development-kit
npm install
npm run build
npm link

adk --version
```

## Quick Start

```bash
cd meu-projeto-existente
adk init
```

---

# Comandos

## adk init

Adiciona estrutura CADD (.claude/) a um projeto existente.

### CLI

```bash
adk init
adk init -n "Meu Projeto"
```

### Opcoes

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `-n, --name` | Nome do projeto | nome da pasta |

### O que e criado

```
projeto/
├── CLAUDE.md                    # Instrucoes para Claude Code
└── .claude/
    ├── memory/project-context.md
    ├── agents/                  # 8 agentes especializados
    ├── skills/                  # 4 skills com templates
    ├── commands/                # 6 slash commands
    ├── rules/                   # 4 regras de qualidade
    ├── hooks/                   # 5 hooks de automacao
    ├── settings.json
    └── ...
```

### Direto no Claude Code

```
Crie a estrutura CADD neste projeto:
- .claude/memory/
- .claude/plans/features/
- .claude/agents/
- .claude/skills/
- .claude/commands/
- .claude/rules/
- .claude/hooks/
```

---

## adk quick (ou adk q)

Tarefa rapida sem processo formal. Para bugs, ajustes, micro features.

### CLI

```bash
adk quick "corrigir botao de login no mobile"
adk q "adicionar validacao de email"

adk quick "fix parser error" -f src/utils/parser.ts

adk quick "ajustar cor" --no-test

adk quick "fix typo" --commit
```

### Opcoes

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `-f, --file` | Arquivo especifico para focar | - |
| `-t, --test` | Rodar testes apos | true |
| `--no-test` | Nao rodar testes | - |
| `--commit` | Commit automatico | false |

### Direto no Claude Code

```
QUICK TASK: [descricao do problema]

Regras:
1. Analise rapida - identifique o problema
2. Solucao minima - apenas o necessario
3. Nao refatore codigo nao relacionado
4. Rode testes existentes

Ao final: mostre o que alterou e se testes passaram.
```

---

## adk feature new

Cria nova feature com estrutura completa.

### CLI

```bash
adk feature new auth
adk feature new auth "Sistema de autenticacao com JWT"

adk feature new auth -c /path/to/spec.md

adk feature new auth "Resumo" -c /path/to/detalhes.md
```

### Opcoes

| Opcao | Descricao |
|-------|-----------|
| `[description]` | Descricao da feature |
| `-c, --context` | Arquivo de contexto |
| `-p, --priority` | Prioridade (P0-P4) |

### Arquivos criados

```
.claude/plans/features/auth/
  prd.md          # Product Requirements
  tasks.md        # Task breakdown
  plan.md         # Implementation plan
  context.md      # Contexto especifico
```

### Direto no Claude Code

```
Crie estrutura para feature "auth":
1. Criar pasta .claude/plans/features/auth/
2. Criar prd.md com template de PRD
3. Criar tasks.md com template de tasks
4. Criar context.md com: [contexto aqui]
5. Criar branch feature/auth
```

---

## adk feature research

Fase de pesquisa - analisa codebase antes de implementar.

### CLI

```bash
adk feature research auth

adk feature research auth "Focar em seguranca"

adk feature research auth -c /path/to/requirements.md
```

### Opcoes

| Opcao | Descricao |
|-------|-----------|
| `[description]` | Contexto adicional |
| `-c, --context` | Arquivo de contexto |

### Output

```
.claude/plans/features/auth/research.md
```

### Direto no Claude Code

```
RESEARCH: feature auth

1. Analise o codebase:
   - Componentes similares
   - Padroes existentes
   - Tech stack

2. Identifique:
   - Arquivos a criar
   - Arquivos a modificar
   - Riscos tecnicos

3. Salve em .claude/plans/features/auth/research.md
```

---

## adk feature plan

Cria plano detalhado de implementacao.

### CLI

```bash
adk feature plan auth
```

### Pre-requisito

Requer `research.md` existir.

### Output

```
.claude/plans/features/auth/implementation-plan.md
```

### Direto no Claude Code

```
PLANNING: feature auth

Leia:
- .claude/plans/features/auth/prd.md
- .claude/plans/features/auth/research.md

Crie plano com:
- Fases de implementacao
- Tasks por fase
- Testes necessarios
- Criterios de aceitacao
- Ordem de implementacao

Output: .claude/plans/features/auth/implementation-plan.md
```

---

## adk feature implement

Implementa feature seguindo TDD.

### CLI

```bash
adk feature implement auth

adk feature implement auth --phase 1
```

### Pre-requisito

Requer `implementation-plan.md` existir.

### Opcoes

| Opcao | Descricao |
|-------|-----------|
| `--phase` | Fase especifica |

### Direto no Claude Code

```
IMPLEMENTATION (TDD): feature auth

Leia: .claude/plans/features/auth/implementation-plan.md

Para cada task:
1. RED: Escreva teste que falha
2. GREEN: Implemente codigo minimo
3. REFACTOR: Melhore mantendo testes passando
4. Commit

Criterios:
- Todos testes passam
- Coverage >= 80%
- Lint clean
```

---

## adk feature autopilot

Fluxo completo automatizado: PRD -> Tasks -> Arquitetura -> Implementacao -> Revisao -> Documentacao

### CLI

```bash
adk feature autopilot auth

adk feature autopilot auth "Sistema de login com OAuth"

adk feature autopilot auth -c /path/to/spec.md
```

### Opcoes

| Opcao | Descricao |
|-------|-----------|
| `[description]` | Descricao da feature |
| `-c, --context` | Arquivo de contexto |

### Comportamento

- **Retomavel**: se parar no meio, roda novamente e continua de onde parou
- **Pergunta entre etapas**: confirma antes de prosseguir
- **6 etapas**: Entendimento -> Breakdown -> Arquitetura -> Implementacao -> Revisao -> Documentacao

### Direto no Claude Code

```
AUTOPILOT: feature auth

Etapas:
1. Entendimento - pergunte sobre a feature, crie PRD
2. Breakdown - quebre em tasks atomicas
3. Arquitetura - desenhe arquitetura (ASCII), crie plano
4. Implementacao - TDD rigoroso
5. Revisao - checklist de qualidade
6. Documentacao - README, JSDoc
```

---

## adk feature list

Lista todas as features e seus status.

### CLI

```bash
adk feature list
```

### Output

```
Features do Projeto:

  * auth          Planned
  * user-profile  Researched
  * dashboard     Created
```

---

## adk memory

Gerencia memoria especializada por feature.

### CLI

```bash
adk memory save auth

adk memory load auth

adk memory view auth

adk memory view --global

adk memory compact auth

adk memory search "OAuth"
adk memory search "login" -f auth

adk memory update
```

### Subcomandos

| Comando | Descricao |
|---------|-----------|
| `save <feature>` | Salva contexto atual para feature |
| `load <feature>` | Carrega memoria de feature |
| `view [feature]` | Visualiza memoria |
| `compact <feature>` | Compacta memoria grande |
| `search <query>` | Busca em memorias |
| `update` | Atualiza memoria global |

### Direto no Claude Code

```
Salve o contexto atual da feature "auth" em:
.claude/plans/features/auth/memory.md

Inclua:
- Estado atual
- Decisoes tomadas
- Proximos passos
- Bloqueios
```

---

## adk workflow daily

Rotina diaria de setup.

### CLI

```bash
adk workflow daily
```

### Direto no Claude Code

```
DAILY WORKFLOW:

1. git log desde ontem
2. Identifique work in progress
3. Atualize .claude/memory/project-context.md
4. Crie nota em .claude/daily/YYYY-MM-DD.md
```

---

## adk workflow pre-commit

Validacao antes de commit.

### CLI

```bash
adk workflow pre-commit
```

### Direto no Claude Code

```
PRE-COMMIT:

1. git diff --cached
2. Verifique:
   - Console.log/debug
   - Secrets hardcoded
   - TODOs criticos
   - Testes quebrados
3. npm test
4. Reporte problemas
```

---

## adk workflow qa

QA completo de feature.

### CLI

```bash
adk workflow qa auth
```

### Direto no Claude Code

```
QA: feature auth

Checklist:
1. Lint/format - npm run check
2. Testes - npm test (coverage >= 80%)
3. Performance - p95 < 100ms
4. Seguranca - SQL injection, XSS, secrets
5. Self-review - codigo legivel?

Output: .claude/plans/features/auth/qa-report.md
```

---

## adk workflow pre-deploy

Checklist completo antes de deploy.

### CLI

```bash
adk workflow pre-deploy -f auth
```

### Direto no Claude Code

```
PRE-DEPLOY: feature auth

Checklist:
- [ ] Testes passando
- [ ] Coverage adequado
- [ ] Sem vulnerabilidades
- [ ] Documentacao atualizada
- [ ] Feature flags configurados
- [ ] Monitoring setup
- [ ] Rollback plan

Resultado: GO / NO-GO
```

---

## adk agent create

Cria novo agent especializado.

### CLI

```bash
adk agent create security-scanner

adk agent create optimizer -t analyzer
```

### Opcoes

| Opcao | Descricao |
|-------|-----------|
| `-t, --type` | Tipo (analyzer, implementer, tester) |

### Arquivo criado

```
.claude/agents/security-scanner.md
```

---

## adk agent run

Executa um agent.

### CLI

```bash
adk agent run security-scanner

adk agent run optimizer -c "Focar em queries SQL"
```

### Opcoes

| Opcao | Descricao |
|-------|-----------|
| `-c, --context` | Contexto adicional |

---

## adk agent pipeline

Executa pipeline de agents para feature.

### CLI

```bash
adk agent pipeline auth
```

### Pipeline padrao

```
analyzer -> optimizer -> documenter
```

---

## adk deploy staging

Deploy para ambiente de staging.

### CLI

```bash
adk deploy staging auth
```

---

## adk deploy production

Deploy para producao com rollout gradual.

### CLI

```bash
adk deploy production auth

adk deploy production auth --percentage 10
```

### Opcoes

| Opcao | Descricao | Default |
|-------|-----------|---------|
| `--percentage` | Porcentagem inicial | 10 |

---

## adk deploy rollback

Rollback de feature.

### CLI

```bash
adk deploy rollback auth
```

---

# Estrutura CADD

```
.claude/
  memory/                 # Contexto persistente
    project-context.md
  plans/
    features/
      <feature>/
        prd.md            # Product Requirements
        tasks.md          # Task breakdown
        plan.md           # Plan geral
        research.md       # Analise de codebase
        implementation-plan.md  # Plano detalhado
        context.md        # Contexto especifico
        memory.md         # Memoria da feature
        qa-report.md      # Relatorio QA
  agents/                 # Agents especializados
  skills/                 # Skills reutilizaveis
  commands/               # Custom commands
  rules/                  # Regras automaticas
  hooks/                  # Hooks de automacao
  decisions/              # Architecture Decision Records
  daily/                  # Notas diarias
  reports/                # Relatorios
```

---

# Fluxos de Trabalho

## Tarefa Rapida (Bug/Ajuste)

```bash
adk quick "descricao do problema"
```

## Feature Completa (Manual)

```bash
adk feature new nome "descricao"
adk feature research nome
adk feature plan nome
adk feature implement nome
adk workflow qa nome
```

## Feature Completa (Automatico)

```bash
adk feature autopilot nome "descricao"
```

## Retomando Feature Interrompida

```bash
adk feature autopilot nome
```

---

# Dicas

## Passar contexto externo

```bash
adk feature research nome -c /path/to/documento.md
```

## Focar em arquivo especifico

```bash
adk quick "fix bug" -f src/utils/auth.ts
```

## Commit automatico apos quick task

```bash
adk quick "fix typo" --commit
```

## Pular testes em ajuste visual

```bash
adk quick "ajustar css" --no-test
```

---

# Desenvolvimento do ADK

```bash
npm run dev        # Watch mode
npm run build      # Compilar
npm run check:fix  # Lint + format
npm test           # Testes
```

---

Feito por [Renan Lido](https://github.com/renanlido)
