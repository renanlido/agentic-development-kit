---
description: Busca e recupera contexto de arquivos do projeto (RAG simples)
---

# Recall Context

Este comando permite recuperar contexto relevante de arquivos do projeto após compactação.

## Argumento Recebido

Query de busca: `$ARGUMENTS`

## Validar Argumento

Se `$ARGUMENTS` estiver vazio ou for literalmente "$ARGUMENTS":

```
Erro: Query de busca é obrigatória.

Uso: /recall <query>

Exemplos:
  /recall authentication
  /recall como funciona o login
  /recall decisão sobre banco de dados
```

## Comportamento

1. **Buscar em memórias**: Pesquise em `.claude/memory/*.md`
2. **Buscar em feature ativa**: Pesquise em `.claude/plans/features/<active>/*.md`
3. **Buscar em documentação**: Pesquise em `.docs/*.md` (se existir)
4. **Buscar em decisões**: Pesquise em `.claude/decisions/*.md`

## Execução

Para a query "$ARGUMENTS":

1. Extraia keywords relevantes (palavras com 3+ caracteres)
2. Busque arquivos que contenham essas keywords usando grep
3. Ranqueie por número de matches
4. Leia os top 3 arquivos mais relevantes
5. Apresente um resumo estruturado:

```
CONTEXT RECALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Query: $ARGUMENTS
Keywords: <keywords extraídas>

## Arquivo 1: <path>
<resumo das seções relevantes>

## Arquivo 2: <path>
<resumo das seções relevantes>

## Arquivo 3: <path>
<resumo das seções relevantes>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Alternativas via CLI

O ADK também oferece busca via CLI:

```bash
adk memory search "$ARGUMENTS"
adk memory recall "$ARGUMENTS"
```

## Integração com Decisões

Se a query mencionar decisões arquiteturais, também busque em:
- `.claude/decisions/` - Decisões documentadas
- Use `adk memory recall "$ARGUMENTS"` internamente

## Dica

Após compactação do contexto, use `/recall` para recuperar informações específicas sem precisar reler todos os arquivos manualmente.
