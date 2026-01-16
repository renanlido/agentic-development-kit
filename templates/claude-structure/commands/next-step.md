---
description: Avança para próxima etapa da feature (aceita nome como argumento ou usa feature ativa)
---

# Next Step

IMPORTANTE: Este comando deve ser executado com contexto limpo. Se precisar, execute `/clear` antes.

## Argumento Recebido

O argumento passado foi: `$ARGUMENTS`

## Identificar Feature

### Se argumento foi passado:

Se `$ARGUMENTS` não estiver vazio (não é literalmente "$ARGUMENTS" ou string vazia), use esse valor como nome da feature.

### Se argumento não foi passado:

Leia o arquivo `.claude/active-focus.md` para identificar a feature atual.

Formato do arquivo:
```
feature: <nome-da-feature>
status: <status>
path: <caminho>
```

Extraia o valor após `feature:`.

### Se não conseguir identificar:

```
Erro: Nenhuma feature especificada ou ativa.

Uso:
  /next-step <nome-da-feature>   # Especifica a feature
  /next-step                      # Usa feature ativa

Para ativar uma feature:
  adk feature new <nome> -c <contexto>
```

## Identificar Próxima Etapa

Leia `.claude/plans/features/<feature>/progress.md` para ver o estado atual.

Formato do progress.md:
```yaml
steps:
  - name: prd
    status: completed|in_progress|pending|failed
  - name: research
    status: ...
```

Ordem das etapas e seus comandos:
1. **prd** → `adk feature new <feature>`
2. **research** → `adk feature research <feature>`
3. **tasks** → `adk feature tasks <feature>`
4. **arquitetura** → `adk feature plan <feature>`
5. **implementacao** → `adk feature implement <feature>`
6. **qa** → `adk feature qa <feature>`
7. **docs** → `adk feature docs <feature>`

A próxima etapa é a primeira que NÃO está com status `completed`.

## Verificar Arquivos (fallback se progress.md não existir)

Se `progress.md` não existir, verifique os arquivos:
- `prd.md` existe? → prd concluído
- `research.md` existe? → research concluído
- `tasks.md` existe? → tasks concluído
- `implementation-plan.md` existe? → arquitetura concluído
- `qa-report.md` existe? → qa concluído

## Executar Próxima Etapa

Com base na etapa identificada, execute o comando correspondente via Bash:

```bash
adk feature <etapa> <feature-name>
```

Mapeamento etapa → comando:
- prd → new
- research → research
- tasks → tasks
- arquitetura → plan
- implementacao → implement
- qa → qa
- docs → docs

## Output Esperado

Mostre ANTES de executar:
```
⏭️ Next Step
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature: <nome>
Progresso: PRD ✓ → Research ✓ → Tasks → Plan → Implement → QA → Docs
           (✓ = concluído, → = próximo)
Próxima etapa: <etapa>
Comando: adk feature <comando> <feature>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Então execute a etapa.

## Se Feature Completa

Se todas etapas estiverem concluídas:
```
✨ Feature "<nome>" completa!

Próximos passos:
  git diff
  git add . && git commit
  git push && gh pr create
```

## Múltiplas Features

Se precisar listar features disponíveis:
```bash
ls .claude/plans/features/
```

Ou use:
```bash
adk feature list
```
