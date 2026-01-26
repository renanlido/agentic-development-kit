# ADK v3 Session Continuity - Índice de Documentação

Guia para navegar toda a documentação da feature.

---

## 📚 Documentos Principais

### [README.md](./README.md)
**Para:** Desenvolvedores que querem entender e usar a feature
**Contém:**
- Problema resolvido e arquitetura
- Como usar (CLI e programático)
- API reference completa
- Estrutura de persistência
- Tipos TypeScript
- Diferenças v2 vs v3
- Limitações conhecidas
- Roadmap

**Quando usar:** Primeira leitura, referência de API, entender arquitetura

---

### [QUICKSTART.md](./QUICKSTART.md)
**Para:** Desenvolvedores que querem começar rapidamente
**Contém:**
- Setup em 5 passos
- Exemplos práticos e executáveis
- Workflow TDD recomendado
- Checklist de desenvolvimento
- Debugging tips
- Troubleshooting FAQ

**Quando usar:** Começar a desenvolver, resolver problemas, contribuir

---

### [CHANGELOG.md](./CHANGELOG.md)
**Para:** Histórico técnico e comparações
**Contém:**
- Mudanças Sprint 0 e Sprint 1
- Comparação detalhada v2 vs v3
- Breaking changes (nenhum ainda)
- Roadmap de Sprints futuros
- Known limitations

**Quando usar:** Entender evolução, planejar migração (futuro), ver o que mudou

---

### [prd.md](./prd.md)
**Para:** Product context e requirements
**Contém:**
- Problema detalhado do v2
- Solução proposta
- Requisitos funcionais e não-funcionais
- User stories
- Métricas de sucesso
- Riscos e mitigações

**Quando usar:** Entender decisões de produto, validar features contra requirements

---

### [implementation-plan.md](./implementation-plan.md)
**Para:** Roadmap de implementação
**Contém:**
- Breakdown por Sprint e Fase
- Código esperado para cada fase
- Critérios de aceitação
- Estratégia de testes
- Gates de qualidade

**Quando usar:** Planejar implementação, revisar progresso, entender ordem de execução

---

### [tasks.md](./tasks.md)
**Para:** Checklist de implementação
**Contém:**
- 19 tasks ordenadas por dependência
- Status de cada task (todas completas ✅)
- Critérios de aceitação por task
- Constraints críticos (não modificar v2)

**Quando usar:** Tracking de progresso, validar completude

---

## 📖 Documentação no Código

### [src/types/session-v3.ts](../../../../../../src/types/session-v3.ts)
**JSDoc adicionado:**
- `SessionInfoV3`: Diferença entre `id` e `claudeSessionId`, significado de `resumable`
- `ClaudeV3Options`: Defaults e comportamentos
- `ClaudeV3Result`: Estrutura de retorno

**Quando usar:** Referência rápida ao escrever código TypeScript

---

### [src/utils/session-store.ts](../../../../../../src/utils/session-store.ts)
**JSDoc adicionado:**
- `SessionStore` class: Overview do que faz
- `save()`: Atomic write pattern
- `list()`: Ordenação e tratamento de arquivos corrompidos
- `update()`: Preservação de id/startedAt, atualização automática de lastActivity
- `isResumable()`: Lógica de 24h

**Quando usar:** Entender comportamentos não-óbvios, debugar persistência

---

### [src/utils/claude-v3.ts](../../../../../../src/utils/claude-v3.ts)
**JSDoc adicionado:**
- `parseSessionId()`: Regex pattern usado
- `executeClaudeCommandV3()`: Features principais, parâmetros, defaults
- `executeWithSessionTracking()`: Resume automático, integração com SessionStore

**Quando usar:** Entender execução de comandos Claude, debugar session tracking

---

## 🗂️ Documentação de Projeto

### [README.md principal](../../../../../../README.md)
**Seção adicionada:**
- "ADK v3 (Preview - Session Continuity)"
- Status: Alpha
- Comparação rápida v2 vs v3
- Como testar
- Link para documentação completa

**Quando usar:** Descobrir que existe v3, entender status do projeto

---

## 🎯 Recomendações de Leitura

### Se você quer...

**...usar v3 pela primeira vez:**
1. [README.md](./README.md) - seção "Como Usar"
2. [QUICKSTART.md](./QUICKSTART.md) - seção "Para Usuários"

**...contribuir com v3:**
1. [QUICKSTART.md](./QUICKSTART.md) - seção "Para Desenvolvedores"
2. [README.md](./README.md) - seção "API Reference"
3. [implementation-plan.md](./implementation-plan.md) - entender arquitetura

**...entender decisões de design:**
1. [prd.md](./prd.md) - contexto do problema
2. [CHANGELOG.md](./CHANGELOG.md) - comparação v2 vs v3
3. JSDoc no código - comportamentos específicos

**...debugar problemas:**
1. [QUICKSTART.md](./QUICKSTART.md) - seção "Debugging"
2. [README.md](./README.md) - seção "Troubleshooting"
3. JSDoc no código - detalhes de implementação

**...planejar próximos Sprints:**
1. [CHANGELOG.md](./CHANGELOG.md) - seção "Roadmap"
2. [prd.md](./prd.md) - seção "Escopo"
3. [implementation-plan.md](./implementation-plan.md) - próximas fases

---

## 📊 Cobertura de Documentação

| Aspecto | Documentado | Onde |
|---------|-------------|------|
| Overview da feature | ✅ | README.md |
| Como instalar/usar | ✅ | README.md, QUICKSTART.md |
| API reference | ✅ | README.md, JSDoc |
| Exemplos de código | ✅ | README.md, QUICKSTART.md |
| Arquitetura | ✅ | README.md, prd.md |
| Decisões de design | ✅ | prd.md, CHANGELOG.md |
| Troubleshooting | ✅ | README.md, QUICKSTART.md |
| Workflow de desenvolvimento | ✅ | QUICKSTART.md |
| Histórico de mudanças | ✅ | CHANGELOG.md |
| Requirements | ✅ | prd.md |
| Roadmap | ✅ | CHANGELOG.md, prd.md |
| Comparação v2/v3 | ✅ | CHANGELOG.md, README.md |

---

## 🔍 Como Encontrar Informação Específica

**"Como faço para..."**
→ README.md seção "Como Usar" ou QUICKSTART.md

**"Por que foi feito assim?"**
→ prd.md ou CHANGELOG.md

**"O que mudou?"**
→ CHANGELOG.md

**"Como funciona internamente?"**
→ JSDoc no código ou implementation-plan.md

**"Como começar a desenvolver?"**
→ QUICKSTART.md seção "Para Desenvolvedores"

**"Quais são os próximos passos?"**
→ CHANGELOG.md seção "Roadmap"

**"Existe um exemplo de X?"**
→ README.md ou QUICKSTART.md seção "Exemplos"

---

## ✅ Checklist de Documentação Mantida

Ao modificar código v3, atualize:

- [ ] JSDoc se comportamento mudou
- [ ] README.md se API mudou
- [ ] CHANGELOG.md para nova versão
- [ ] QUICKSTART.md se workflow mudou
- [ ] README principal se há nova funcionalidade importante

---

## 📞 Contato

Dúvidas sobre documentação:
- Abra issue no GitHub
- Tag: `documentation`, `v3`

---

**Última atualização:** 2026-01-26
**Versão documentada:** 3.0.0-alpha
