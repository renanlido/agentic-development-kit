# 📄 TEMPLATE: Conversão de PRD Existente

**Use este checklist para converter seu PRD/documentação em estrutura CADD**

---

## 🎯 OBJETIVO

Transformar documentação existente (PRD, specs, wireframes) em estrutura CADD pronta para desenvolvimento com ADK.

---

## ✅ CHECKLIST DE CONVERSÃO

### ETAPA 1: PREPARAÇÃO (5 min)

- [ ] **1.1** Reunir toda documentação existente
  - [ ] PRD (Product Requirements Document)
  - [ ] Especificações técnicas
  - [ ] Wireframes/mockups
  - [ ] User stories
  - [ ] Diagramas de arquitetura
  - [ ] API specs (se houver)
  - [ ] Outros docs relevantes

- [ ] **1.2** Criar projeto ADK
  ```bash
  adk init -n nome-do-projeto -t node
  cd nome-do-projeto
  ```

- [ ] **1.3** Organizar docs originais
  ```bash
  mkdir -p _docs_originais/{wireframes,specs,prds,diagrams}
  # Mover arquivos para pastas apropriadas
  ```

---

### ETAPA 2: EXTRAÇÃO DE CONTEXTO (15-20 min)

Abra `.claude/memory/project-context.md` e preencha:

#### ✅ 2.1 Visão do Produto

**Do seu PRD, copie:**
- [ ] Objetivo do produto (seção "Vision" ou "Objetivo")
- [ ] Problema que resolve (seção "Problem Statement")
- [ ] Usuários alvo (seção "Target Users" ou "Personas")
- [ ] Proposta de valor (seção "Value Proposition")

**Cole aqui:**
```markdown
## 🎯 VISÃO
[Copiar do PRD]
```

#### ✅ 2.2 Stack Tecnológico

**Do doc de arquitetura/specs técnicas, copie:**
- [ ] Frontend: framework, versão, bibliotecas principais
- [ ] Backend: framework, versão, bibliotecas principais
- [ ] Database: tipo, versão
- [ ] Infraestrutura: cloud provider, CI/CD
- [ ] Justificativas técnicas (se houver ADRs)

**Cole aqui:**
```markdown
## 🏗️ STACK TECNOLÓGICO
[Copiar das specs técnicas]
```

#### ✅ 2.3 Funcionalidades

**Do seu PRD, identifique:**
- [ ] Features do MVP (must-have)
- [ ] Features pós-MVP (nice-to-have)
- [ ] Features futuras (roadmap)

**Liste aqui:**
```markdown
## 📱 FUNCIONALIDADES

### MVP
- [ ] Feature 1
- [ ] Feature 2

### Post-MVP
- [ ] Feature X
```

#### ✅ 2.4 Métricas e KPIs

**Do seu PRD, copie:**
- [ ] KPIs de negócio
- [ ] Métricas técnicas (performance, disponibilidade)
- [ ] Critérios de sucesso

**Cole aqui:**
```markdown
## 📊 MÉTRICAS
[Copiar do PRD]
```

#### ✅ 2.5 Restrições

**Do seu PRD/specs, copie:**
- [ ] Budget/orçamento
- [ ] Timeline/prazo
- [ ] Compliance (GDPR, LGPD, etc.)
- [ ] Limitações técnicas

**Cole aqui:**
```markdown
## 🔒 RESTRIÇÕES
[Copiar do PRD]
```

---

### ETAPA 3: QUEBRAR EM FEATURES (20-30 min)

#### ✅ 3.1 Listar Todas Features

No seu PRD, identifique cada funcionalidade distinta:

| # | Feature | Seção do PRD | Prioridade | Dependências |
|---|---------|--------------|------------|--------------|
| 1 | User Auth | 3.1 (p.12) | P0 | - |
| 2 | User Profile | 3.2 (p.15) | P0 | User Auth |
| 3 | Dashboard | 4.1 (p.20) | P1 | User Auth |
| ... | ... | ... | ... | ... |

#### ✅ 3.2 Criar Estrutura de Cada Feature

Para cada feature da tabela:

```bash
# Exemplo
adk feature new user-authentication
adk feature new user-profile
adk feature new dashboard
# ... etc
```

#### ✅ 3.3 Identificar Dependências

Mapear grafo de dependências:

```markdown
user-authentication (raiz)
  ├─> user-profile (depende de auth)
  ├─> dashboard (depende de auth)
  └─> product-catalog (depende de auth)
        └─> shopping-cart (depende de catalog)
              └─> checkout (depende de cart)
                    └─> payment (depende de checkout)
```

**Ordem de implementação:** Bottom-up (raiz primeiro)

---

### ETAPA 4: PREENCHER PRD DE CADA FEATURE (5-10 min por feature)

Para cada feature criada, preencha `.claude/plans/features/<nome>/prd.md`:

#### ✅ 4.1 Template por Feature

```markdown
# Feature: [NOME]

**Ref:** PRD original - Seção X.X (página Y)
**Wireframes:** [links para _docs_originais/wireframes/]
**Priority:** [P0-P4 - do PRD]
**Dependencies:** [features que bloqueiam esta]

---

## Contexto (do PRD)
[Copiar contexto específico da feature do PRD]

Esta feature faz parte de: [Epic/Módulo]
Bloqueia: [lista de features dependentes]

---

## Requisitos Funcionais (do PRD)

### RF1: [Nome do Requisito]
**Descrição:** [do PRD]

**Endpoint:** [se aplicável]
```
POST /api/[endpoint]
```

**Input:**
```json
{
  "field1": "value",
  "field2": 123
}
```

**Output:**
```json
{
  "result": "data"
}
```

**Validações:** [do PRD]
- Validação 1
- Validação 2

**Error Cases:** [do PRD]
- 400: [quando]
- 401: [quando]
- 500: [quando]

---

[Repeat para RF2, RF3, etc...]

---

## Requisitos Não-Funcionais (do PRD)

- **Performance:** [ex: < 200ms p95]
- **Segurança:** [ex: criptografia, autenticação]
- **Disponibilidade:** [ex: 99.9% SLA]
- **Escalabilidade:** [ex: suportar 10k usuários simultâneos]

---

## Database Schema (das specs técnicas)

```sql
[Copiar schema relevante das specs]
```

---

## Design/UI (dos wireframes)

**Telas:** Ver `_docs_originais/wireframes/[nome-feature]/`

**User Flow:** [do PRD ou wireframes]
1. Passo 1
2. Passo 2
3. Passo 3

---

## Critérios de Aceitação (do PRD)

### Funcionais
- [ ] [Critério 1 - do PRD]
- [ ] [Critério 2 - do PRD]

### Técnicos
- [ ] Testes >= 80% coverage
- [ ] Performance requirements met
- [ ] Security requirements met

---

## Dependências Técnicas

**APIs Externas:** [do PRD]
- API 1: [propósito]

**NPM Packages:** [das specs técnicas]
- package1: [versão]

**Features Dependentes:**
- Depende de: [feature1, feature2]
- Bloqueia: [feature3, feature4]

---

## Fora do Escopo (V1) - do PRD

- [ ] Item 1 (será V2)
- [ ] Item 2 (será V3)

---

## Estimativa (do PRD se tiver)

- Dev: [X dias]
- Test: [Y dias]
- QA: [Z dias]
- **Total:** [N dias]
```

#### ✅ 4.2 Checklist por PRD de Feature

- [ ] Contexto copiado do PRD original
- [ ] Todos requisitos funcionais listados
- [ ] Requisitos não-funcionais copiados
- [ ] Database schema incluído
- [ ] Wireframes referenciados
- [ ] Critérios de aceitação definidos
- [ ] Dependências mapeadas
- [ ] Estimativa incluída (se houver)

---

### ETAPA 5: CRIAR ROADMAP (10 min)

Criar `.claude/plans/roadmap.md`:

```markdown
# Roadmap de Implementação

**Baseado em:** PRD original + dependências técnicas

---

## Sprint 1: Foundation (Semana 1-2)
**Objetivo:** Base funcional

### Features
1. Setup de infraestrutura
2. Database schema
3. User Authentication (P0 - blocker)

**Critério de Sucesso:**
- [ ] Usuário consegue criar conta e logar
- [ ] Database em staging
- [ ] CI/CD configurado

---

## Sprint 2: Core Features (Semana 3-4)
**Objetivo:** Features principais do MVP

### Features
4. User Profile (P0)
5. Dashboard (P1)

**Critério de Sucesso:**
- [ ] Usuário vê dashboard personalizado
- [ ] Profile editável

---

## Sprint 3: Business Logic (Semana 5-6)
**Objetivo:** Funcionalidades de negócio

### Features
6. [Feature principal 1]
7. [Feature principal 2]

---

[... etc]

---

## Post-MVP (Futuro)
- Feature X (V2)
- Feature Y (V2)
- Feature Z (V3)
```

---

## 📊 EXEMPLO PRÁTICO DE CONVERSÃO

### ANTES: PRD Original

```
═══════════════════════════════════════════════
         E-COMMERCE PLATFORM - PRD
═══════════════════════════════════════════════

1. VISION
Build a modern e-commerce platform for small
businesses with integrated payment and inventory.

2. TARGET USERS
- Small business owners (10-100 products)
- Physical stores going digital
- New entrepreneurs

3. MVP FEATURES
3.1 User Management (p.12)
    - Registration
    - Login (email/password)
    - Profile management
    - OAuth (Google)

3.2 Product Catalog (p.18)
    - CRUD products
    - Categories
    - Search
    - Filters

3.3 Shopping Cart (p.25)
    - Add to cart
    - Update quantities
    - Remove items
    - Calculate totals

[... 50 páginas ...]
```

### DEPOIS: Estrutura CADD

```
ecommerce-platform/
├── _docs_originais/
│   └── PRD-Ecommerce.pdf
│
├── .claude/
│   ├── memory/
│   │   └── project-context.md
│   │       """
│   │       # Project: E-commerce Platform
│   │
│   │       ## VISÃO (do PRD seção 1)
│   │       Build modern e-commerce for small businesses...
│   │
│   │       ## USUÁRIOS (do PRD seção 2)
│   │       - Small business owners...
│   │       """
│   │
│   ├── plans/
│   │   ├── roadmap.md
│   │   └── features/
│   │       ├── user-management/
│   │       │   └── prd.md
│   │       │       """
│   │       │       # Feature: User Management
│   │       │       Ref: PRD seção 3.1 (p.12)
│   │       │
│   │       │       ## RF1: Registration
│   │       │       [Copiado do PRD...]
│   │       │       """
│   │       │
│   │       ├── product-catalog/
│   │       │   └── prd.md
│   │       │       """
│   │       │       Ref: PRD seção 3.2 (p.18)
│   │       │       """
│   │       │
│   │       └── shopping-cart/
│   │           └── prd.md
│   │               """
│   │               Ref: PRD seção 3.3 (p.25)
│   │               """
│   │
│   └── scripts/
│       └── implement-all.sh  # Script para pipeline completo
│
└── src/  # Será gerado pelo ADK
```

---

## 🚀 EXECUTAR IMPLEMENTAÇÃO

Após conversão completa:

```bash
# Feature 1
adk feature research user-management
adk feature plan user-management
adk feature implement user-management
adk workflow qa user-management

# Feature 2
adk feature research product-catalog
...

# Ou usar script de automação:
./.claude/scripts/implement-all.sh
```

---

## ✅ VALIDAÇÃO FINAL

Antes de começar desenvolvimento, verificar:

- [ ] **project-context.md** tem visão completa do PRD
- [ ] **Todas features** do MVP têm estrutura criada
- [ ] **Cada PRD de feature** referencia doc original
- [ ] **Roadmap** define ordem de implementação
- [ ] **Dependências** entre features mapeadas
- [ ] **Docs originais** preservados em `_docs_originais/`

---

## 💡 DICAS FINAIS

### Conversão Eficiente

1. **Use Ctrl+C / Ctrl+V generosamente**
   - Não reescreva o que já está no PRD
   - Copie e adapte formato

2. **Referencie sempre**
   - `Ref: PRD p.15` ajuda a rastrear origem
   - Link para wireframes mantém contexto visual

3. **Mantenha docs originais**
   - Não delete PRD original
   - Use como fonte da verdade

4. **Priorize MVP**
   - Converta features MVP primeiro
   - Post-MVP pode ficar para depois

### Tempo Esperado

- **Projeto pequeno** (5-10 features): 1-2 horas
- **Projeto médio** (10-20 features): 2-4 horas
- **Projeto grande** (20+ features): 4-8 horas

**Vale a pena:** 1 dia de conversão economiza semanas de desenvolvimento desorganizado!

---

## 📞 PRÓXIMOS PASSOS

1. ✅ Complete este checklist
2. ✅ Valide que tudo está correto
3. 🚀 Comece implementação: `adk feature implement <primeira-feature>`

---

**Conversão bem-sucedida? Hora de codar! 🎉**
