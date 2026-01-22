---
description: Avanca para proxima etapa da feature (aceita nome como argumento ou usa feature ativa)
---

# Next Step

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Executar Comando ADK

Este comando delega para o CLI do ADK que possui toda a logica de:
- Identificar a feature (por argumento ou active-focus)
- Verificar o progresso atual
- Determinar a proxima etapa
- Executar o comando correto

### Se argumento foi passado:

Se `$ARGUMENTS` nao estiver vazio (nao e literalmente "$ARGUMENTS" ou string vazia):

```bash
adk feature next $ARGUMENTS
```

### Se argumento nao foi passado:

```bash
adk feature next
```

## Importante

- O comando `adk feature next` ja cuida de todo o fluxo
- Ele verifica arquivos existentes e progress.md
- Ele executa o proximo passo automaticamente
- Nao tente replicar a logica aqui - use o CLI

## Em caso de erro

Se o comando falhar com "feature nao encontrada":

```
Erro: Feature nao especificada ou nao encontrada.

Uso:
  /next-step <nome-da-feature>   # Especifica a feature
  /next-step                      # Usa feature ativa

Para criar uma feature:
  adk feature new <nome>
```
