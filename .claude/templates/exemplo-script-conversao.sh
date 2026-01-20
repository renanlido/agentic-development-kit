#!/bin/bash

# ═══════════════════════════════════════════════════════════
# Script Helper: Conversão de PRD para Estrutura CADD
# ═══════════════════════════════════════════════════════════
#
# USO:
#   ./exemplo-script-conversao.sh [nome-do-projeto]
#
# O QUE FAZ:
#   1. Cria projeto ADK
#   2. Cria estrutura para docs originais
#   3. Gera templates para preencher
#   4. Cria checklist de conversão
#
# ═══════════════════════════════════════════════════════════

set -e  # Exit on error

PROJECT_NAME=${1:-"meu-projeto"}

echo "🚀 Iniciando conversão de PRD para CADD"
echo "Projeto: $PROJECT_NAME"
echo ""

# ═══════════════════════════════════════════════════════════
# ETAPA 1: Criar Projeto Base
# ═══════════════════════════════════════════════════════════

echo "📦 Etapa 1: Criando projeto base..."
adk init -n "$PROJECT_NAME" -t node
cd "$PROJECT_NAME"

echo "✅ Projeto criado!"
echo ""

# ═══════════════════════════════════════════════════════════
# ETAPA 2: Estrutura para Docs Originais
# ═══════════════════════════════════════════════════════════

echo "📁 Etapa 2: Criando estrutura para docs originais..."

mkdir -p _docs_originais/{prds,specs,wireframes,diagrams,user-stories,api-specs}

echo "✅ Estrutura criada em: _docs_originais/"
echo ""

# ═══════════════════════════════════════════════════════════
# ETAPA 3: Criar README de Instruções
# ═══════════════════════════════════════════════════════════

echo "📝 Etapa 3: Criando guia de conversão..."

cat > _docs_originais/README.md << 'EOF'
# 📚 Documentação Original

## Instruções

1. **Organize seus documentos aqui:**
   - PRDs → `prds/`
   - Specs técnicas → `specs/`
   - Wireframes → `wireframes/`
   - Diagramas → `diagrams/`
   - User stories → `user-stories/`
   - API specs → `api-specs/`

2. **Após organizar:**
   - Preencha `.claude/memory/project-context.md`
   - Siga checklist em `.claude/CHECKLIST-CONVERSAO.md`

## Estrutura

```
_docs_originais/
├── prds/            ← PDFs/docs de PRD
├── specs/           ← Especificações técnicas
├── wireframes/      ← Mockups, protótipos
├── diagrams/        ← Diagramas de arquitetura
├── user-stories/    ← User stories, casos de uso
└── api-specs/       ← OpenAPI, Swagger, etc
```
EOF

echo "✅ README criado em: _docs_originais/README.md"
echo ""

# ═══════════════════════════════════════════════════════════
# ETAPA 4: Criar Checklist de Conversão
# ═══════════════════════════════════════════════════════════

echo "✅ Etapa 4: Criando checklist de conversão..."

cat > .claude/CHECKLIST-CONVERSAO.md << 'EOF'
# ✅ CHECKLIST DE CONVERSÃO PRD → CADD

**Data de início:** [DATA]
**Responsável:** [NOME]

---

## FASE 1: PREPARAÇÃO

- [ ] Todos docs copiados para `_docs_originais/`
  - [ ] PRD principal
  - [ ] Specs técnicas
  - [ ] Wireframes
  - [ ] Diagramas
  - [ ] Outros

- [ ] Documentação organizada por tipo

---

## FASE 2: CONTEXTO

- [ ] `.claude/memory/project-context.md` preenchido:
  - [ ] Visão do produto (do PRD)
  - [ ] Problema que resolve
  - [ ] Usuários alvo
  - [ ] Stack tecnológico (das specs)
  - [ ] Funcionalidades (lista completa)
  - [ ] Métricas de sucesso
  - [ ] Restrições (budget, timeline, etc)

---

## FASE 3: EXTRAÇÃO DE FEATURES

- [ ] Lista completa de features criada
- [ ] Features priorizadas (P0, P1, P2, etc)
- [ ] Dependências mapeadas

**Features do MVP:**

| # | Feature | Criada? | PRD Preenchido? |
|---|---------|---------|-----------------|
| 1 | [nome]  | [ ]     | [ ]             |
| 2 | [nome]  | [ ]     | [ ]             |
| 3 | [nome]  | [ ]     | [ ]             |

---

## FASE 4: CRIAÇÃO DE FEATURES

Para cada feature:

```bash
adk feature new [nome-feature]
```

- [ ] Feature 1: [nome]
- [ ] Feature 2: [nome]
- [ ] Feature 3: [nome]

---

## FASE 5: PREENCHER PRDs

Para cada feature, preencher `.claude/plans/features/[nome]/prd.md`:

- [ ] Feature 1: PRD completo
  - [ ] Contexto
  - [ ] Requisitos funcionais
  - [ ] Requisitos não-funcionais
  - [ ] Database schema
  - [ ] Critérios de aceitação
  - [ ] Referências ao doc original

- [ ] Feature 2: PRD completo
- [ ] Feature 3: PRD completo

---

## FASE 6: ROADMAP

- [ ] `.claude/plans/roadmap.md` criado
  - [ ] Sprints definidos
  - [ ] Features por sprint
  - [ ] Critérios de sucesso

---

## VALIDAÇÃO FINAL

- [ ] Todos PRDs referenciam docs originais
- [ ] Nenhuma feature do MVP sem PRD
- [ ] Roadmap reflete dependências
- [ ] Context completo e detalhado

---

## PRONTO PARA DESENVOLVIMENTO?

- [ ] Checklist 100% completo
- [ ] Team review feito
- [ ] Primeira feature identificada

**Próximo passo:**
```bash
adk feature research [primeira-feature]
```

---

**Data de conclusão:** [DATA]
EOF

echo "✅ Checklist criado em: .claude/CHECKLIST-CONVERSAO.md"
echo ""

# ═══════════════════════════════════════════════════════════
# ETAPA 5: Criar Template de Context
# ═══════════════════════════════════════════════════════════

echo "📋 Etapa 5: Criando template de context..."

cat > .claude/memory/project-context.md << 'EOF'
# Project: [NOME DO PROJETO]

**Criado:** [DATA]
**Status:** Conversão de documentação existente para CADD
**Framework:** CADD

**INSTRUÇÕES:** Preencha cada seção copiando do PRD/docs originais

---

## 🎯 VISÃO (do PRD original)

### Objetivo do Produto
[Copiar seção "Vision" do PRD]

### Problema que Resolve
[Copiar seção "Problem Statement" do PRD]

### Usuários Alvo
[Copiar seção "Target Users" do PRD]
- Persona 1: [descrição]
- Persona 2: [descrição]

### Proposta de Valor
[Copiar seção "Value Proposition" do PRD]

---

## 🏗️ STACK TECNOLÓGICO (das specs técnicas)

### Frontend
- Framework: [nome + versão]
- Bibliotecas: [lista]
- Justificativa: [por que escolhido - do ADR se houver]

### Backend
- Framework: [nome + versão]
- Bibliotecas: [lista]
- Justificativa: [por que escolhido]

### Database
- Tipo: [PostgreSQL/MongoDB/etc]
- Versão: [versão]
- Justificativa: [por que escolhido]

### Infraestrutura
- Cloud Provider: [AWS/GCP/Azure]
- CI/CD: [ferramenta]
- Monitoring: [ferramenta]

---

## 📱 FUNCIONALIDADES (do PRD)

### Escopo MVP
[Copiar lista de features do PRD marcadas como MVP/Must-Have]

- [ ] Feature 1: [nome]
- [ ] Feature 2: [nome]
- [ ] Feature 3: [nome]

### Features Pós-MVP
[Copiar features marcadas como V2, Nice-to-Have]

- [ ] Feature X
- [ ] Feature Y

---

## 📊 MÉTRICAS DE SUCESSO (do PRD)

### KPIs de Negócio
- [KPI 1]: [meta]
- [KPI 2]: [meta]

### Métricas Técnicas
- Performance: [requisito do PRD - ex: p95 < 200ms]
- Disponibilidade: [SLA - ex: 99.9%]
- Segurança: [compliance - ex: OWASP Top 10]

---

## 🔒 RESTRIÇÕES (do PRD)

### Orçamento
[Copiar do PRD]

### Timeline
[Copiar do PRD]

### Compliance
[GDPR, LGPD, PCI-DSS, etc - do PRD]

### Limitações Técnicas
[Qualquer restrição técnica do PRD/specs]

---

## 📚 DOCUMENTAÇÃO ORIGINAL

Toda documentação original preservada em:
`_docs_originais/`

### Referências Principais
- PRD: `_docs_originais/prds/[nome-arquivo]`
- Specs: `_docs_originais/specs/[nome-arquivo]`
- Wireframes: `_docs_originais/wireframes/`
- Diagramas: `_docs_originais/diagrams/`

---

## 🗺️ ROADMAP (alto nível)

[Copiar roadmap do PRD se houver, ou criar baseado em features]

### Fase 1: [Nome]
- Objetivo: [descrição]
- Features: [lista]

### Fase 2: [Nome]
- Objetivo: [descrição]
- Features: [lista]

---

**PRÓXIMO PASSO:** Preencher este arquivo completamente, depois seguir checklist em `.claude/CHECKLIST-CONVERSAO.md`
EOF

echo "✅ Template criado em: .claude/memory/project-context.md"
echo ""

# ═══════════════════════════════════════════════════════════
# ETAPA 6: Criar Script de Pipeline
# ═══════════════════════════════════════════════════════════

echo "🔧 Etapa 6: Criando script de pipeline..."

mkdir -p .claude/scripts

cat > .claude/scripts/implement-feature.sh << 'EOF'
#!/bin/bash

# Pipeline completo para implementar uma feature

FEATURE=$1

if [ -z "$FEATURE" ]; then
  echo "❌ Erro: Nome da feature é obrigatório"
  echo "Uso: ./implement-feature.sh <feature-name>"
  exit 1
fi

echo "🚀 Implementando feature: $FEATURE"
echo "════════════════════════════════════"
echo ""

echo "📊 1/4 Research Phase"
adk feature research $FEATURE
echo ""

echo "📋 2/4 Planning Phase"
adk feature plan $FEATURE
echo ""

echo "⚙️  3/4 Implementation Phase"
adk feature implement $FEATURE
echo ""

echo "✅ 4/4 QA Phase"
adk workflow qa $FEATURE
echo ""

echo "════════════════════════════════════"
echo "🎉 Feature $FEATURE completa!"
echo ""
echo "Próximos passos:"
echo "  1. Review do código gerado"
echo "  2. Testar manualmente"
echo "  3. Criar PR"
EOF

chmod +x .claude/scripts/implement-feature.sh

echo "✅ Script criado em: .claude/scripts/implement-feature.sh"
echo ""

# ═══════════════════════════════════════════════════════════
# RESUMO FINAL
# ═══════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════"
echo "✨ SETUP COMPLETO!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📁 Estrutura criada:"
echo "  ├── _docs_originais/          ← Coloque seus PRDs/docs aqui"
echo "  ├── .claude/memory/           ← Preencha project-context.md"
echo "  ├── .claude/CHECKLIST-CONVERSAO.md  ← Siga este checklist"
echo "  └── .claude/scripts/          ← Scripts de automação"
echo ""
echo "📝 PRÓXIMOS PASSOS:"
echo ""
echo "  1. Copie documentação original:"
echo "     cp ~/path/to/PRD.pdf _docs_originais/prds/"
echo "     cp ~/path/to/wireframes/* _docs_originais/wireframes/"
echo ""
echo "  2. Preencha contexto:"
echo "     code .claude/memory/project-context.md"
echo ""
echo "  3. Siga checklist:"
echo "     code .claude/CHECKLIST-CONVERSAO.md"
echo ""
echo "  4. Crie features:"
echo "     adk feature new primeira-feature"
echo ""
echo "  5. Implemente:"
echo "     ./.claude/scripts/implement-feature.sh primeira-feature"
echo ""
echo "════════════════════════════════════════════════════════"
echo "📚 Documentação em:"
echo "  - .claude/templates/GUIA-DOCUMENTACAO-EXISTENTE.md"
echo "  - .claude/templates/template-conversao-prd.md"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Boa sorte com a conversão! 🚀"
