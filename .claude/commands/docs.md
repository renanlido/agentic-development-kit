---
description: Gera documentacao tecnica automatica para uma feature
---

# Docs - Geracao de Documentacao

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

```
Erro: Nome da feature é obrigatório.

Uso: /docs <nome-da-feature> [--scope <tipo>]

Exemplo: /docs user-authentication
         /docs user-authentication --scope api
         /docs user-authentication --scope readme
         /docs user-authentication --scope changelog

Escopos disponíveis:
  - all (default): Gera toda documentacao
  - api: Apenas documentacao de API
  - readme: Apenas README da feature
  - changelog: Apenas changelog/release notes

Para ver features disponíveis:
  adk feature list
```

## Pre-requisitos

Verifique se existe:
- `.claude/plans/features/$ARGUMENTS/`
- `.claude/plans/features/$ARGUMENTS/prd.md`

Se NAO existir:
```
Erro: Feature "$ARGUMENTS" não encontrada ou sem PRD.
Verifique o nome e tente novamente.

Features disponíveis:
  adk feature list
```

## Atualizar Focus

Atualize `.claude/active-focus.md`:
```
# Foco Ativo

feature: $ARGUMENTS
status: gerando documentacao
path: .claude/plans/features/$ARGUMENTS/
```

## Processo

### 1. Coletar Contexto

Leia os seguintes arquivos para entender a feature:
- `.claude/plans/features/$ARGUMENTS/prd.md` - Requisitos
- `.claude/plans/features/$ARGUMENTS/tasks.md` - Tasks implementadas
- `.claude/plans/features/$ARGUMENTS/implementation-plan.md` - Detalhes tecnicos
- `.claude/memory/architecture.md` - Arquitetura do projeto

### 2. Gerar Documentacao

Use o Task tool para delegar ao agent `documenter`:

**Instrucoes:**
- Leia o contexto coletado acima
- Identifique a audiencia (devs novos vs experientes)
- Gere documentacao apropriada ao escopo solicitado
- Siga as convencoes de documentacao do projeto

### 3. Escopos de Documentacao

#### Escopo: `all` (default)

Gere todos os tipos de documentacao:

1. **README da Feature** (`.claude/plans/features/$ARGUMENTS/README.md`)
   - Visao geral
   - Como usar
   - Exemplos
   - Troubleshooting

2. **API Reference** (se aplicavel)
   - Endpoints/Metodos
   - Parametros
   - Responses
   - Exemplos de uso

3. **Changelog Entry**
   - Resumo das mudancas
   - Breaking changes (se houver)
   - Migration guide (se necessario)

#### Escopo: `api`

Gere apenas documentacao de API:
- Endpoints/Metodos publicos
- Request/Response schemas
- Exemplos de uso
- Error handling

#### Escopo: `readme`

Gere apenas README da feature:
- Descricao
- Quick start
- Exemplos
- Troubleshooting

#### Escopo: `changelog`

Gere apenas changelog entry:
- Resumo das mudancas
- Breaking changes
- Migration guide

### 4. Verificacao de Qualidade

Use o agent `documenter` para validar:
- [ ] Exemplos funcionam se copiados
- [ ] Nao ha informacao desatualizada
- [ ] Links estao corretos
- [ ] Novo dev consegue comecar

### 5. Atualizar Progress

Atualize `.claude/plans/features/$ARGUMENTS/progress.md`:
- Marque `docs` como `completed`

## Output

Salve documentacao gerada em:
- `.claude/plans/features/$ARGUMENTS/README.md` (principal)
- `.claude/plans/features/$ARGUMENTS/docs/` (adicional)
- Ou local apropriado baseado no tipo de projeto

## Reportar

```
✅ Documentação de "$ARGUMENTS" gerada!

Arquivos criados:
- .claude/plans/features/$ARGUMENTS/README.md
- [outros arquivos gerados]

Escopo: [all|api|readme|changelog]

Verificação:
- [ ] Exemplos testados
- [ ] Links validados
- [ ] Formatação consistente

Próximo passo:
  /finish $ARGUMENTS
  ou
  adk feature finish $ARGUMENTS
```

## Importante

- **NUNCA** documente codigo obvio
- **SEMPRE** inclua exemplos que funcionam
- Mantenha documentacao concisa e util
- Siga o estilo de documentacao existente no projeto
- Considere as duas audiencias: devs novos e experientes
