---
description: Executa validacao completa de qualidade em uma feature
---

# QA: $ARGUMENTS

Voce vai validar a qualidade da feature "$ARGUMENTS".

## Checklist de Validacao

### 1. Testes

Use o Task tool para delegar ao agent `tester`:

**Validar:**
- [ ] Todos os testes passando
- [ ] Coverage >= 80%
- [ ] Edge cases cobertos
- [ ] Testes de integracao existem

**Comandos:**
```bash
npm test
npm run test:coverage
```

### 2. Qualidade de Codigo

**Validar:**
- [ ] Lint sem erros
- [ ] Formatacao correta
- [ ] Type check passando

**Comandos:**
```bash
npm run lint
npm run format:check
npm run type-check
```

### 3. Review de Codigo

Use o Task tool para delegar ao agent `reviewer`:

**Validar:**
- [ ] Segue padroes do projeto
- [ ] Sem vulnerabilidades obvias
- [ ] Codigo limpo e legivel
- [ ] Documentacao adequada

### 4. Performance

**Validar:**
- [ ] Sem N+1 queries
- [ ] Sem loops desnecessarios
- [ ] Resposta dentro do SLA

### 5. PRD Compliance

**Validar:**
- [ ] Todos requisitos funcionais atendidos
- [ ] Criterios de aceitacao cumpridos
- [ ] Nada fora do escopo implementado

## Output

Gere relatorio em `.claude/plans/features/$ARGUMENTS/qa-report.md`:

```markdown
# QA Report: $ARGUMENTS

**Data:** YYYY-MM-DD
**Status:** APROVADO | REPROVADO | PENDENTE

## Resumo

| Categoria | Status |
|-----------|--------|
| Testes | OK/FAIL |
| Lint | OK/FAIL |
| Types | OK/FAIL |
| Review | OK/FAIL |
| Performance | OK/FAIL |
| PRD Compliance | OK/FAIL |

## Issues Encontradas

### CRITICAL
- [Nenhuma | Lista]

### HIGH
- [Nenhuma | Lista]

### MEDIUM
- [Nenhuma | Lista]

## Recomendacao

[APROVADO para deploy | REPROVADO - corrigir issues]

## Proximos Passos

- [Lista de acoes]
```

## Decisao

- **Se APROVADO**: Feature pronta para deploy
- **Se REPROVADO**: Liste issues e sugira correcoes
