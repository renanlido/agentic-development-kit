# 🚀 GUIA DEFINITIVO: DO ZERO AO CÓDIGO

**Para quando você tem APENAS uma ideia/sonho e quer transformar em código funcionando**

---

## 📋 ÍNDICE RÁPIDO

1. [Pré-Requisitos](#pré-requisitos) (1 min)
2. [Fase 1: Da Ideia ao Contexto](#fase-1-da-ideia-ao-contexto) (15-30 min)
3. [Fase 2: Estruturar o Projeto](#fase-2-estruturar-o-projeto) (2 min)
4. [Fase 3: Primeira Feature](#fase-3-primeira-feature) (5 min)
5. [Fase 4: Desenvolvimento Automático](#fase-4-desenvolvimento-automático) (Automático)
6. [Fase 5: Iteração e Crescimento](#fase-5-iteração-e-crescimento) (Contínuo)

---

## PRÉ-REQUISITOS

✅ **Antes de começar:**

```bash
# 1. ADK instalado globalmente
cd ~/path/to/agentic-development-kit
npm run build
npm link

# 2. Verificar
adk --version  # Deve mostrar: 1.0.0

# 3. Claude Code instalado
claude --version  # Deve funcionar

# 4. Node.js >= 18
node --version
```

**Pronto?** Vamos lá! 🚀

---

## FASE 1: DA IDEIA AO CONTEXTO

### Passo 1.1: Preencher Template (15-30 min)

**Baixe o template:**
```bash
cp ~/path/to/agentic-development-kit/.claude/templates/template-ideia-para-contexto.md ~/minha-ideia.md
```

**Abra e preencha:**
```bash
code ~/minha-ideia.md
```

**Preencha pelo menos:**
- ✅ Seção 1: A Ideia (obrigatório)
- ✅ Seção 2: O Problema (obrigatório)
- ✅ Seção 3: Quem vai usar (obrigatório)
- ✅ Seção 4: Funcionalidades MVP (obrigatório)

**Exemplo Rápido:**

```markdown
## 1. A IDEIA
Quero criar um app que ajuda freelancers a rastrear tempo
gasto em projetos e gerar faturas automaticamente.

## 2. O PROBLEMA
Freelancers perdem tempo todo mês:
- Lembrando quantas horas trabalharam
- Criando faturas manualmente
- Enviando por email

## 3. QUEM VAI USAR
- Freelancers tech (designers, devs)
- Consultores
- Pequenas agências

## 4. FUNCIONALIDADES MVP
- [ ] Timer para rastrear tempo
- [ ] Associar tempo a projetos/clientes
- [ ] Gerar fatura PDF
- [ ] Enviar fatura por email
```

**Dica:** Não se preocupe em ser perfeito. Escreva como se estivesse explicando para um amigo!

---

## FASE 2: ESTRUTURAR O PROJETO

### Passo 2.1: Criar Projeto com ADK (30 segundos)

```bash
# Ir para sua pasta de projetos
cd ~/projetos

# Escolher nome (kebab-case)
PROJECT_NAME="freelance-timer"

# Criar com ADK
adk init -n $PROJECT_NAME -t node

# Entrar no projeto
cd $PROJECT_NAME

# Instalar dependências
npm install
```

**Resultado:** Estrutura CADD completa criada! ✅

### Passo 2.2: Adicionar Seu Contexto (2 min)

```bash
# Copiar seu contexto para o projeto
cat ~/minha-ideia.md > .claude/memory/project-context.md

# Ou editar diretamente
code .claude/memory/project-context.md
```

**Cole todo o conteúdo** que você preencheu no Passo 1.1!

### Passo 2.3: Verificar Estrutura

```bash
# Ver estrutura criada
ls -la .claude/

# Deve ter:
# - memory/project-context.md  ← Seu contexto aqui
# - plans/features/            ← Features vão aqui
# - agents/                    ← Agents customizados
# - reports/                   ← Relatórios gerados
```

**Checkpoint:** Você tem estrutura + contexto? ✅ Próximo passo!

---

## FASE 3: PRIMEIRA FEATURE

### Passo 3.1: Escolher Primeira Feature (1 min)

**Olhe seu MVP** (Seção 4 do template). Escolha a feature **mais fundamental**.

**Exemplos:**
- E-commerce → Autenticação
- Todo List → CRUD de tarefas
- Blog → Sistema de posts
- Freelance Timer → Timer + Projects

**Regra de ouro:** Escolha algo que **bloqueia outras features**.

### Passo 3.2: Criar Feature (30 segundos)

```bash
# Criar estrutura da feature (use kebab-case)
adk feature new user-authentication

# Resultado:
# ✨ Feature user-authentication criada!
#
# Arquivos criados:
# .claude/plans/features/user-authentication/
#   ├── prd.md
#   ├── tasks.md
#   ├── plan.md
#   └── context.md
#
# Branch: feature/user-authentication
```

### Passo 3.3: Escrever PRD (5-10 min) ⭐ IMPORTANTE

```bash
# Abrir PRD
code .claude/plans/features/user-authentication/prd.md
```

**Estrutura do PRD:**

```markdown
# Feature: User Authentication

## Contexto
Primeira feature do [SEU PROJETO].
Ver `.claude/memory/project-context.md` para visão completa.

## Objetivo
Sistema de autenticação para proteger dados do usuário.

## Requisitos Funcionais

### RF1: Registro
- POST /api/auth/register
- Input: email, password, name
- Validações:
  - Email válido e único
  - Senha >= 8 caracteres
- Output: JWT token + user data

### RF2: Login
- POST /api/auth/login
- Input: email, password
- Output: JWT token + user data

### RF3: Get Current User
- GET /api/auth/me
- Header: Authorization: Bearer <token>
- Output: User data

## Requisitos Não-Funcionais
- Performance: < 200ms
- Segurança: bcrypt hash, JWT expira 24h

## Critérios de Aceitação
- [ ] Usuário consegue criar conta
- [ ] Usuário consegue fazer login
- [ ] Token JWT funciona
- [ ] Testes >= 80% coverage

## Tech Stack
- bcrypt
- jsonwebtoken
- PostgreSQL

## Database Schema
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Fora do Escopo (V1)
- Reset de senha (V2)
- OAuth social (V2)
```

**Dica:** Seja específico! Quanto mais detalhes, melhor o resultado.

---

## FASE 4: DESENVOLVIMENTO AUTOMÁTICO

### Passo 4.1: Research Phase (Automático - 2 min)

```bash
adk feature research user-authentication
```

**O que acontece:**
1. Claude Code lê `.claude/memory/project-context.md`
2. Claude Code lê PRD da feature
3. Analisa código existente (no seu caso, vazio ainda)
4. Identifica padrões e arquivos a criar
5. Documenta riscos e dependências

**Output:** `.claude/plans/features/user-authentication/research.md`

**Exemplo de conteúdo gerado:**

```markdown
# Research: User Authentication

## Current State
- Projeto greenfield (sem código ainda)
- Stack: Node.js + PostgreSQL + TypeScript

## Files to Create
- [ ] src/models/user.model.ts
- [ ] src/services/auth.service.ts
- [ ] src/controllers/auth.controller.ts
- [ ] src/middleware/auth.middleware.ts
- [ ] src/routes/auth.routes.ts
- [ ] tests/auth.test.ts

## Dependencies
- npm install bcrypt @types/bcrypt
- npm install jsonwebtoken @types/jsonwebtoken
- npm install express-validator

## Risks
- Segurança: precisa hash forte (bcrypt rounds >= 12)
- JWT secret precisa estar em .env
```

### Passo 4.2: Planning Phase (Automático - 3 min)

```bash
adk feature plan user-authentication
```

**O que acontece:**
1. Lê research.md
2. Cria breakdown detalhado em fases
3. Define estratégia TDD
4. Estabelece ordem de implementação

**Output:** `.claude/plans/features/user-authentication/implementation-plan.md`

**Exemplo de conteúdo gerado:**

```markdown
# Implementation Plan: User Authentication

## Phase 1: Setup & Models
**Duration:** 1 hour
**Tests First:** Yes

### Tasks
1. Create User model
2. Write model validation tests
3. Create database migration

### Files
- src/models/user.model.ts
- tests/models/user.test.ts
- migrations/001_create_users.sql

### Tests
- User validation (email, password)
- Unique email constraint
- Password hashing

---

## Phase 2: Auth Service
**Duration:** 2 hours
**Tests First:** Yes

### Tasks
1. Password hashing logic
2. JWT generation/verification
3. Service unit tests

### Files
- src/services/auth.service.ts
- tests/services/auth.test.ts

### Tests
- Hash password correctly
- Compare password
- Generate valid JWT
- Verify JWT

---

[... Phase 3, 4, etc ...]
```

### Passo 4.3: Implementation Phase (Automático - TDD)

```bash
adk feature implement user-authentication
```

**Você vai ver:**

```
? Qual fase implementar?
  ❯ All (todas as fases)
    Phase 1
    Phase 2
    Phase 3
    Phase 4
```

**Escolha:** `All` (primeira vez)

**O que acontece (TDD Automático):**

**LOOP PARA CADA FASE:**

```
📝 FASE 1: Setup & Models

STEP 1: Escrever Testes (RED)
────────────────────────────
✍️  Criando: tests/models/user.test.ts
📝 Tests escritos (mas ainda não passam)
🔴 npm test → FAIL (esperado!)

STEP 2: Implementar Código (GREEN)
───────────────────────────────────
✍️  Criando: src/models/user.model.ts
💻 Código implementado
🟢 npm test → PASS!

STEP 3: Refatorar (REFACTOR)
─────────────────────────────
🔧 Melhorando código...
🟢 npm test → PASS!

STEP 4: Commit
──────────────
✅ git commit -m "test: add user model tests"
✅ git commit -m "feat(models): add User model"

════════════════════════════════════

📝 FASE 2: Auth Service
[Repeat TDD cycle...]

📝 FASE 3: Controllers
[Repeat TDD cycle...]

📝 FASE 4: Routes & Middleware
[Repeat TDD cycle...]

════════════════════════════════════

🎉 IMPLEMENTAÇÃO COMPLETA!

Arquivos criados: 12
Testes: 45 passing
Coverage: 92%
Commits: 8
```

**Tempo total:** 10-30 minutos (automático!)

### Passo 4.4: Validação QA (Automático - 3 min)

```bash
adk workflow qa user-authentication
```

**O que acontece:**

```
🔍 QA Workflow Executando...

1/5 Lint & Format
  ✅ Biome check: 0 issues
  ✅ TypeScript: No errors

2/5 Test Coverage
  ✅ Coverage: 92% (target: 80%)
  ✅ All tests passing: 45/45

3/5 Performance
  ✅ Register endpoint: 78ms (target: < 200ms)
  ✅ Login endpoint: 45ms (target: < 200ms)

4/5 Security
  ✅ No hardcoded secrets
  ✅ Password hashing: bcrypt rounds = 12
  ✅ JWT expiration set: 24h
  ⚠️  Consider: Rate limiting on login

5/5 Self-Review
  ✅ Code follows conventions
  ✅ Error handling present
  ✅ Documentation complete

═══════════════════════════════════

📊 QA Report: .claude/plans/features/user-authentication/qa-report.md

RESULTADO: ✅ APPROVED FOR MERGE
```

**Resultado:** Feature completa, testada, validada! 🎉

---

## FASE 5: ITERAÇÃO E CRESCIMENTO

### Passo 5.1: Segunda Feature

```bash
# Voltar para branch main
git checkout main

# Criar próxima feature do MVP
adk feature new task-timer

# Editar PRD
code .claude/plans/features/task-timer/prd.md

# Repeat: research → plan → implement → qa
adk feature research task-timer
adk feature plan task-timer
adk feature implement task-timer
adk workflow qa task-timer
```

### Passo 5.2: Workflow Diário

**Todo dia de manhã:**

```bash
adk workflow daily

# Gera: .claude/daily/2026-01-XX.md
# Conteúdo:
# - O que foi feito ontem
# - O que fazer hoje
# - Features em progresso
# - Blockers
```

**Antes de cada commit:**

```bash
adk workflow pre-commit

# Valida automaticamente:
# - Sem console.log
# - Sem secrets
# - Testes passam
# - Lint clean
```

### Passo 5.3: Agents Customizados (Conforme necessário)

**Quando surgir task repetitiva:**

```bash
# Exemplo: Criar agent para sync de banco
adk agent create db-sync -t generic

# Editar agent
code .claude/agents/db-sync.md

# Usar
adk agent run db-sync
```

---

## 🎯 CHECKLIST COMPLETO

### Setup Inicial
- [ ] ADK instalado (`adk --version` funciona)
- [ ] Claude Code instalado
- [ ] Template preenchido com sua ideia

### Estruturação
- [ ] Projeto criado (`adk init`)
- [ ] Contexto copiado para `.claude/memory/project-context.md`
- [ ] Estrutura verificada

### Primeira Feature
- [ ] Feature criada (`adk feature new`)
- [ ] PRD escrito com detalhes
- [ ] Research executado
- [ ] Plan executado
- [ ] Implementation executado (TDD)
- [ ] QA validado (>= 80% coverage)

### Próximas Features
- [ ] Segunda feature planejada
- [ ] Workflow diário estabelecido
- [ ] Pre-commit hooks em uso

---

## 💡 DICAS PRO

### Dica 1: Comece Pequeno
Não tente implementar TODO o MVP de uma vez. Quebre em features menores:

❌ **Ruim:** "Criar todo sistema de e-commerce"
✅ **Bom:**
- Feature 1: Auth
- Feature 2: Product CRUD
- Feature 3: Shopping Cart
- Feature 4: Checkout

### Dica 2: PRDs Detalhados = Melhores Resultados
Invista 10 minutos escrevendo um PRD bom. Vale a pena!

❌ **Ruim:**
```markdown
# Feature: Login
Fazer login de usuário.
```

✅ **Bom:**
```markdown
# Feature: Login

## Requisitos
- POST /api/auth/login
- Input: email, password
- Validações: email válido, senha correta
- Output: JWT token
- Rate limit: 5 tentativas/15min

## Critérios
- [ ] Usuário consegue logar
- [ ] Token funciona
- [ ] Testes >= 80%
```

### Dica 3: Atualize o Contexto
Conforme toma decisões, atualize `.claude/memory/project-context.md`:

```bash
# Exemplo: Decidiu usar Redis para cache
code .claude/memory/project-context.md

# Adicionar na seção "Tech Stack":
# - Cache: Redis (decisão: 2026-01-13)
```

### Dica 4: Use Agents para Tarefas Repetitivas
Se você vai fazer a mesma coisa várias vezes, crie um agent!

**Exemplo:** Toda feature precisa de migration de banco?

```bash
adk agent create db-migration -t generic
# Edit agent para gerar migrations automaticamente
```

### Dica 5: QA Antes de Merge
**SEMPRE** rode QA antes de fazer merge:

```bash
adk workflow qa nome-feature

# Só mergear se: ✅ APPROVED
```

---

## ❓ TROUBLESHOOTING

### "Claude Code não está instalado"
```bash
# Instalar Claude Code
# https://github.com/anthropics/claude-code
```

### "Feature já existe"
```bash
# Deletar e recriar
rm -rf .claude/plans/features/nome-feature
adk feature new nome-feature
```

### "Testes falhando"
```bash
# Ver log detalhado
npm test -- --verbose

# Rodar teste específico
npm test -- path/to/test.test.ts
```

### "Implementação não saiu como esperado"
**Solução:** Seu PRD não estava detalhado o suficiente.

1. Delete a implementação
2. Reescreva PRD com mais detalhes
3. Execute novamente: research → plan → implement

---

## 📚 RECURSOS ADICIONAIS

### Templates
- `.claude/templates/template-ideia-para-contexto.md` → Preencher sua ideia
- `.claude/templates/projeto-do-zero-exemplo.md` → Exemplo completo

### Documentação
- `CLAUDE.md` → Arquitetura do ADK
- `.claude/README.md` → Como usar framework CADD

### Comandos
```bash
adk --help              # Ver todos comandos
adk feature --help      # Help de features
adk workflow --help     # Help de workflows
adk agent --help        # Help de agents
```

---

## 🎉 PRÓXIMOS PASSOS

Agora que você sabe o processo completo:

1. **Pegue sua ideia**
2. **Preencha o template** (15 min)
3. **Execute os comandos** (2 min setup + automação)
4. **Veja o código aparecer!** 🚀

**Dúvidas?** Consulte os exemplos em `.claude/templates/`

**Pronto para começar?** `adk init -n seu-projeto`

---

**Boa sorte com seu projeto! 🚀**

*Made with ❤️ using ADK + CADD Framework*
