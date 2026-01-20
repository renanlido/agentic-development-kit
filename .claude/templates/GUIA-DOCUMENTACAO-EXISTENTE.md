# 🎯 GUIA: Projeto com Documentação Existente

**Para quando você já tem PRD/Specs/Docs prontos mas o código não começou**

---

## 📋 CENÁRIO

Você tem em mãos:
- ✅ PRD completo (Product Requirements Document)
- ✅ Especificações técnicas
- ✅ Wireframes/mockups
- ✅ User stories
- ✅ Arquitetura definida
- ❌ Código ainda não iniciado

**Objetivo:** Importar toda essa documentação para estrutura CADD e começar desenvolvimento.

---

## 🚀 PROCESSO OTIMIZADO (3 FASES)

### FASE 1: Setup Inicial (5 min)
1. Criar projeto ADK
2. Estruturar documentação existente
3. Importar para CADD

### FASE 2: Extração de Features (15-30 min)
1. Quebrar PRD em features
2. Criar estrutura de cada feature
3. Distribuir documentação

### FASE 3: Desenvolvimento (Automático)
1. Executar pipeline para cada feature
2. Validação contínua

---

## FASE 1: SETUP INICIAL

### Passo 1.1: Criar Projeto (30 seg)

```bash
cd ~/projetos
adk init -n seu-projeto -t node
cd seu-projeto
npm install
```

### Passo 1.2: Organizar Documentação Existente (2 min)

Crie pasta temporária para seus docs:

```bash
mkdir -p _docs_originais
```

Organize seus arquivos:

```
_docs_originais/
├── PRD.pdf (ou .md)
├── specs-tecnicas.pdf
├── wireframes/
│   ├── home.png
│   ├── login.png
│   └── dashboard.png
├── user-stories.xlsx
└── architecture-diagram.png
```

### Passo 1.3: Extrair Contexto Principal (10 min)

Edite `.claude/memory/project-context.md` com informações do PRD:

```markdown
# Project: [Nome do Projeto]

**Criado:** [Data]
**Status:** Greenfield com documentação completa
**Framework:** CADD

---

## 🎯 VISÃO (do PRD)

### Objetivo do Produto
[Copiar seção "Visão" do PRD]

### Problema que Resolve
[Copiar seção "Problema" do PRD]

### Usuários Alvo
[Copiar personas/segmentos do PRD]

### Value Proposition
[Copiar proposta de valor do PRD]

---

## 📊 MÉTRICAS DE SUCESSO (do PRD)

### KPIs Principais
- [KPI 1]: [meta]
- [KPI 2]: [meta]
- [KPI 3]: [meta]

### Métricas Técnicas
- Performance: [requisitos do PRD]
- Disponibilidade: [SLA do PRD]
- Segurança: [requisitos de compliance]

---

## 🏗️ ARQUITETURA (das Specs Técnicas)

### Stack Tecnológico
**Frontend:**
- [Framework]: [versão] - Razão: [do doc de arquitetura]

**Backend:**
- [Framework]: [versão] - Razão: [do doc de arquitetura]

**Database:**
- [DB]: [versão] - Razão: [do doc de arquitetura]

**Infraestrutura:**
- [Cloud Provider]
- [CI/CD]
- [Monitoring]

### Decisões de Arquitetura
[Copiar ADRs se existirem no doc de arquitetura]

---

## 📱 FUNCIONALIDADES (do PRD)

### Escopo MVP
[Copiar lista de features do PRD marcadas como MVP]

- [ ] Feature 1: [nome]
- [ ] Feature 2: [nome]
- [ ] Feature 3: [nome]

### Features Futuras (Post-MVP)
[Copiar features marcadas como V2, V3]

---

## 🎨 DESIGN SYSTEM (se houver)

### Wireframes
Localizados em: `_docs_originais/wireframes/`

### Style Guide
- Cores: [do design system]
- Typography: [fontes]
- Componentes: [lista de componentes]

### Fluxos de Usuário
[Copiar user flows do PRD]

---

## 🔒 RESTRIÇÕES (do PRD)

### Técnicas
- [Restrição 1]
- [Restrição 2]

### Negócio
- Budget: [orçamento]
- Timeline: [prazo]
- Compliance: [regulamentações]

---

## 📚 DOCUMENTAÇÃO ORIGINAL

Toda documentação original está preservada em:
`_docs_originais/`

Referências:
- PRD completo: `_docs_originais/PRD.pdf`
- Specs técnicas: `_docs_originais/specs-tecnicas.pdf`
- Wireframes: `_docs_originais/wireframes/`
```

**Dica:** Copie e cole! Não precisa reescrever o que já está no PRD.

---

## FASE 2: EXTRAÇÃO DE FEATURES

### Passo 2.1: Listar Features do PRD (5 min)

Abra seu PRD e liste TODAS as features mencionadas:

**Exemplo de PRD:**
```
MVP:
1. User Authentication (login, register, OAuth)
2. User Profile (view, edit, avatar upload)
3. Dashboard (overview, metrics, charts)
4. Product Catalog (list, search, filters)
5. Shopping Cart (add, remove, checkout)
6. Payment Integration (Stripe)
7. Order Management (history, tracking)

Post-MVP:
8. Wishlist
9. Reviews & Ratings
10. Notifications
```

### Passo 2.2: Criar Estrutura de Features (2 min)

```bash
# Para cada feature do MVP, criar estrutura
adk feature new user-authentication
adk feature new user-profile
adk feature new dashboard
adk feature new product-catalog
adk feature new shopping-cart
adk feature new payment-integration
adk feature new order-management
```

### Passo 2.3: Preencher PRD de Cada Feature (20-40 min)

Para cada feature, abra o PRD dela e **copie/adapte** do PRD original:

```bash
# Feature 1
code .claude/plans/features/user-authentication/prd.md
```

**Template Otimizado (copie do PRD original):**

```markdown
# Feature: User Authentication

**Ref:** [Seção do PRD original - página X]
**Wireframes:** `_docs_originais/wireframes/login.png`, `register.png`
**Priority:** P0 (MVP - Blocker)
**Estimate:** [do PRD original]

---

## Contexto
[Copiar contexto do PRD original]

Esta feature é parte do MVP e bloqueia:
- User Profile
- Dashboard
- Todas features que requerem login

---

## Requisitos Funcionais

[COPIAR DIRETAMENTE DO PRD ORIGINAL]

### RF1: Registro de Usuário
**Descrição:** [do PRD]
**Endpoint:** POST /api/auth/register
**Input:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```
**Output:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```
**Validações:** [do PRD]
- Email válido e único
- Senha >= 8 chars, 1 maiúscula, 1 número
- Nome >= 2 chars

**Error Cases:** [do PRD]
- 400: Email já existe
- 400: Validação falhou
- 500: Erro no servidor

---

### RF2: Login
[Copiar do PRD...]

### RF3: OAuth Google
[Copiar do PRD...]

### RF4: Get Current User
[Copiar do PRD...]

---

## Requisitos Não-Funcionais

[COPIAR DO PRD]

- **Performance:** [do PRD - ex: < 200ms p95]
- **Segurança:** [do PRD - ex: bcrypt rounds=12, JWT 24h]
- **Disponibilidade:** [do PRD - ex: 99.9% uptime]
- **Compliance:** [do PRD - ex: GDPR, LGPD]

---

## Design/UI

**Wireframes:** Ver `_docs_originais/wireframes/`
- Login: `login.png`
- Register: `register.png`
- OAuth flow: `oauth-flow.png`

**User Flow:**
[Copiar do PRD ou criar baseado nos wireframes]

1. Usuário acessa /login
2. Vê formulário (email + senha)
3. Pode clicar "Login with Google"
4. Após sucesso: redirect para /dashboard

---

## Database Schema

[COPIAR DO DOC DE ARQUITETURA]

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

---

## Critérios de Aceitação

[COPIAR/ADAPTAR DO PRD]

### Funcionais
- [ ] Usuário consegue criar conta com email/senha
- [ ] Usuário consegue fazer login
- [ ] Usuário consegue fazer login com Google
- [ ] Token JWT funciona em rotas protegidas
- [ ] Logout invalida token

### Técnicos
- [ ] Senhas hasheadas (bcrypt rounds >= 12)
- [ ] JWT expira em 24h
- [ ] Rate limiting: 5 tentativas/15min
- [ ] Testes >= 80% coverage
- [ ] API responde < 200ms (p95)

### UX
- [ ] Mensagens de erro claras
- [ ] Loading states durante autenticação
- [ ] Redirect após login bem-sucedido

---

## Dependências

### External APIs
- Google OAuth 2.0 API

### NPM Packages
- bcrypt (^5.1.0)
- jsonwebtoken (^9.0.0)
- passport-google-oauth20 (^2.0.0)

### Database
- PostgreSQL >= 14

### Outras Features
- Bloqueia: Todas features que requerem auth
- Bloqueado por: Nenhuma (primeira feature)

---

## Fora do Escopo (V1)

[DO PRD]

- Password reset (V2)
- 2FA (V2)
- Social login além do Google (V2)
- Remember me (V2)

---

## Riscos e Mitigações

[DO PRD OU SPECS TÉCNICAS]

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Google OAuth down | Baixa | Alto | Fallback para email/senha |
| JWT secret vazado | Média | Crítico | Rotation strategy + secrets manager |
| Brute force attacks | Alta | Médio | Rate limiting + CAPTCHA |

---

## Estimativa

[DO PRD]

- **Desenvolvimento:** 3 dias
- **Testes:** 1 dia
- **QA:** 0.5 dia
- **Total:** 4.5 dias

---

## Notas Adicionais

[Qualquer info relevante do PRD que não se encaixou acima]

- Discussão sobre password complexity: ver PRD página 12
- OAuth flow detalhado: ver specs técnicas seção 3.2
- Security audit: planejado para pós-MVP
```

**Dica:** Use busca (Ctrl+F) no PRD original para copiar seções rapidamente!

---

## FASE 3: DESENVOLVIMENTO

### Passo 3.1: Priorizar Features (5 min)

Liste features na ordem de implementação:

```bash
# Criar arquivo de roadmap
cat > .claude/plans/roadmap.md << 'EOF'
# Roadmap de Implementação

## Sprint 1 (Semana 1-2)
1. ✅ Setup inicial
2. ⏭️ User Authentication (blocker)
3. ⏭️ Database setup

## Sprint 2 (Semana 3-4)
4. User Profile
5. Dashboard (visualização)

## Sprint 3 (Semana 5-6)
6. Product Catalog
7. Shopping Cart

## Sprint 4 (Semana 7-8)
8. Payment Integration
9. Order Management

## Sprint 5 (Semana 9-10)
10. QA completo
11. Deploy staging
12. Beta testing
EOF
```

### Passo 3.2: Pipeline Automático por Feature

Para cada feature, executar pipeline completo:

```bash
# Feature 1: User Authentication
adk feature research user-authentication
adk feature plan user-authentication
adk feature implement user-authentication
adk workflow qa user-authentication

# Feature 2: User Profile
adk feature research user-profile
adk feature plan user-profile
adk feature implement user-profile
adk workflow qa user-profile

# Repeat...
```

### Passo 3.3: Script de Automação (Opcional)

Crie script para pipeline completo:

```bash
cat > .claude/scripts/implement-feature.sh << 'EOF'
#!/bin/bash

FEATURE=$1

if [ -z "$FEATURE" ]; then
  echo "Usage: ./implement-feature.sh <feature-name>"
  exit 1
fi

echo "🚀 Implementando feature: $FEATURE"
echo ""

echo "📊 Phase 1: Research"
adk feature research $FEATURE

echo ""
echo "📋 Phase 2: Planning"
adk feature plan $FEATURE

echo ""
echo "⚙️  Phase 3: Implementation"
adk feature implement $FEATURE

echo ""
echo "✅ Phase 4: QA"
adk workflow qa $FEATURE

echo ""
echo "🎉 Feature $FEATURE completa!"
EOF

chmod +x .claude/scripts/implement-feature.sh
```

**Usar:**
```bash
./.claude/scripts/implement-feature.sh user-authentication
```

---

## 💡 DICAS PRO

### Dica 1: Referencie Documentação Original

Sempre linke para docs originais nos PRDs:

```markdown
## Referências
- PRD Original: Seção 3.2 (página 15)
- Wireframe: `_docs_originais/wireframes/checkout-flow.png`
- API Spec: `_docs_originais/api-spec.yaml` - endpoint `/payment`
```

### Dica 2: Preserve Decisões de Arquitetura

Se há ADRs (Architecture Decision Records) no doc original:

```bash
# Copiar para .claude/decisions/
cp _docs_originais/adrs/* .claude/decisions/

# Ou criar novos baseados nas decisões do PRD
```

### Dica 3: Importe Diagramas

```bash
# Copiar diagramas para documentação
cp _docs_originais/architecture-diagram.png docs/developer/
cp _docs_originais/erd.png docs/developer/
cp _docs_originais/user-flow.png docs/developer/
```

Referencie nos PRDs:

```markdown
## Arquitetura
Ver diagrama completo: `docs/developer/architecture-diagram.png`
```

### Dica 4: Use Templates de PRD

Se todas features seguem mesmo formato no PRD original, crie template:

```bash
cat > .claude/templates/feature-prd-template.md << 'EOF'
# Feature: [NOME]

**Ref:** [Seção do PRD - página X]
**Wireframes:** [links]
**Priority:** [P0-P4]

## Contexto
[Do PRD original]

## Requisitos Funcionais
[Copiar do PRD]

## Requisitos Não-Funcionais
[Copiar do PRD]

## Database Schema
[Copiar das specs]

## Critérios de Aceitação
[Copiar do PRD]
EOF
```

### Dica 5: Extraia User Stories

Se PRD tem user stories:

```bash
# Criar arquivo com todas user stories
cat > .claude/plans/user-stories.md << 'EOF'
# User Stories

## Epic: Authentication
- Como usuário, quero criar uma conta para acessar o sistema
- Como usuário, quero fazer login para acessar minhas informações
- Como usuário, quero fazer login com Google para facilitar acesso

## Epic: Profile
- Como usuário, quero editar meu perfil para manter dados atualizados
...
EOF
```

---

## 🎯 CHECKLIST COMPLETO

### Setup (5 min)
- [ ] Projeto criado (`adk init`)
- [ ] Documentação original em `_docs_originais/`
- [ ] `project-context.md` preenchido com info do PRD

### Extração (30 min)
- [ ] Todas features listadas
- [ ] Estrutura criada (`adk feature new` para cada)
- [ ] PRDs individuais preenchidos (copiar do PRD original)
- [ ] Roadmap de implementação criado

### Desenvolvimento (Contínuo)
- [ ] Pipeline executado para Feature 1
- [ ] QA validado (>= 80% coverage)
- [ ] Feature mergeada
- [ ] Repeat para próximas features

---

## 📊 EXEMPLO REAL

### Antes (Documentação Original)

```
📁 project-docs/
  ├── PRD-Ecommerce.pdf (50 páginas)
  ├── Technical-Specs.pdf (30 páginas)
  ├── wireframes/ (25 arquivos .png)
  └── API-Documentation.yaml
```

### Depois (Estrutura CADD)

```
📁 ecommerce-app/
  ├── _docs_originais/        ← Docs preservados
  │   ├── PRD-Ecommerce.pdf
  │   ├── Technical-Specs.pdf
  │   ├── wireframes/
  │   └── API-Documentation.yaml
  │
  ├── .claude/
  │   ├── memory/
  │   │   └── project-context.md  ← Extraído do PRD
  │   │
  │   ├── plans/
  │   │   ├── roadmap.md          ← Sprints definidos
  │   │   └── features/
  │   │       ├── user-auth/
  │   │       │   └── prd.md      ← Seção 3.1 do PRD original
  │   │       ├── product-catalog/
  │   │       │   └── prd.md      ← Seção 4.2 do PRD original
  │   │       └── shopping-cart/
  │   │           └── prd.md      ← Seção 5.1 do PRD original
  │   │
  │   └── decisions/              ← ADRs do doc de arquitetura
  │
  └── src/                        ← Código será gerado aqui
```

---

## 🚀 WORKFLOW TÍPICO

### Dia 1: Setup
```bash
# Manhã (2h)
adk init -n ecommerce-app
# Importar docs
# Preencher project-context.md

# Tarde (3h)
# Criar todas features
# Preencher PRDs (copiar do original)
```

### Dia 2-X: Implementação
```bash
# Por feature (1-3 dias cada)
adk feature research auth
adk feature plan auth
adk feature implement auth
adk workflow qa auth

# Repeat próxima feature
```

### Resultado em 4 Semanas
- ✅ 7 features implementadas (MVP completo)
- ✅ 80%+ test coverage
- ✅ Deploy staging
- ✅ Pronto para beta

---

## 💎 VANTAGENS DESTA ABORDAGEM

### vs Começar do Zero
- ✅ Contexto rico desde o início
- ✅ Requisitos claros (do PRD)
- ✅ Menos ambiguidade
- ✅ Mais rápido (copiar > escrever)

### vs Desenvolver Sem Framework
- ✅ Estrutura consistente
- ✅ TDD forçado
- ✅ Quality gates automáticos
- ✅ Documentação sincronizada

---

## 📚 RECURSOS

### Templates
- PRD de Feature: `.claude/templates/feature-prd-template.md`
- Script de automação: `.claude/scripts/implement-feature.sh`

### Exemplos
- Contexto extraído: `.claude/templates/projeto-do-zero-exemplo.md`

---

## ✅ PRÓXIMOS PASSOS

1. **Organize documentação** em `_docs_originais/`
2. **Extraia contexto** para `project-context.md`
3. **Crie features** e preencha PRDs
4. **Execute pipeline** feature por feature
5. **Itere** até MVP completo

---

**Boa sorte com seu projeto! 🚀**

*Template otimizado para projetos com documentação existente*
