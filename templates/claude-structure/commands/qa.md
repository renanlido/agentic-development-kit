---
description: Executa validacao completa de qualidade em uma feature
---

# QA - Validação de Qualidade

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

```
Erro: Nome da feature é obrigatório.

Uso: /qa <nome-da-feature>

Exemplo: /qa user-authentication

Para ver features disponíveis:
  adk feature list
```

## Pre-requisitos

Verifique se existe:
- `.claude/plans/features/$ARGUMENTS/`

Se NAO existir:
```
Erro: Feature "$ARGUMENTS" não encontrada.
Verifique o nome e tente novamente.

Features disponíveis:
  adk feature list
```

## Atualizar Focus

Atualize `.claude/active-focus.md`:
```
# Foco Ativo

feature: $ARGUMENTS
status: validando QA
path: .claude/plans/features/$ARGUMENTS/
```

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

## Atualizar Progress

Atualize `.claude/plans/features/$ARGUMENTS/progress.md`:
- Marque `qa` como `completed`

## Reportar

```
✅ QA de "$ARGUMENTS" concluído!

Status: [APROVADO/REPROVADO]
Relatório: .claude/plans/features/$ARGUMENTS/qa-report.md

Próximo passo:
  /next-step $ARGUMENTS
  ou
  adk feature docs $ARGUMENTS
```

## Decisao

- **Se APROVADO**: Feature pronta para docs e deploy
- **Se REPROVADO**: Liste issues e sugira correcoes
