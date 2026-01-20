---
description: Atualiza estado do projeto e sincroniza memoria
---

# Daily Sync

Voce vai fazer a sincronizacao diaria do projeto.

## Processo

### 1. Analisar Mudancas Recentes

```bash
# Ver commits das ultimas 24h
git log --since="24 hours ago" --oneline

# Ver arquivos modificados
git diff --stat HEAD~10

# Ver branches ativas
git branch -a
```

### 2. Atualizar Estado

Atualize `.claude/memory/current-state.md`:

```markdown
# Estado Atual do Projeto

**Ultima Atualizacao:** YYYY-MM-DD HH:MM

## Trabalho em Progresso

### Features
- [Feature X]: Task 3 de 5 (60%)
- [Feature Y]: Aguardando review

### Bugs/Issues
- [Issue #123]: Em investigacao

## Completado Recentemente

### Ultimas 24h
- [Feature Z]: Implementacao completa
- [Bug #456]: Corrigido

## Proximos Passos

### Prioridade Alta
1. Completar Feature X
2. Review de Feature Y

### Prioridade Media
3. Iniciar Feature W

## Bloqueios

- [Nenhum | Lista de bloqueios]

## Notas

[Observacoes importantes]
```

### 3. Verificar Consistencia

**Checar:**
- [ ] Branches sem merge ha muito tempo
- [ ] PRs pendentes de review
- [ ] Issues sem atualizacao
- [ ] Testes falhando no CI

### 4. Atualizar Documentacao (se necessario)

Se houve mudancas significativas:
- Atualizar `.claude/memory/architecture.md`
- Atualizar `.claude/memory/project-context.md`
- Atualizar `CLAUDE.md`

## Output

Resumo para o usuario:

```
Daily Sync Completo

Mudancas (24h):
- N commits
- X arquivos modificados
- Y features em progresso

Estado:
- Features em progresso: [lista]
- Bloqueios: [nenhum | lista]

Sugestao de foco hoje:
- [Acao prioritaria 1]
- [Acao prioritaria 2]
```
