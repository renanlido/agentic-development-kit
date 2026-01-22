# ADK v2 - Técnicas Avançadas para Agentes de Longa Duração

## Visão Geral

ADK v2 adiciona 4 capacidades críticas que transformam o ADK em um framework robusto para agentes de longa duração:

1. **Hooks de Enforcement Automático** (Fase 0 - ✅ Implementado)
2. **MCP Memory RAG** - Busca semântica via embeddings
3. **Session Management** - Checkpoints e resume de sessões
4. **Context Compactor** - Prevenção de overflow inteligente
5. **Constitution/Steering** - Contexto estruturado persistente

Este documento foca na **Fase 0**, que já está implementada e ativa.

---

## Fase 0: Hooks de Enforcement Automático

### O Que É

Sistema de hooks que garante aplicação automática das técnicas ADK em **ambos os modos**:
- **Modo CLI**: Quando você usa `adk feature implement`
- **Modo Autônomo**: Quando Claude Code trabalha diretamente (sem CLI)

### Hooks Implementados

#### 1. SessionStart Hook (`session-bootstrap.sh`)

**Quando executa:** Início de cada sessão Claude Code

**O que faz:**
- Lê `.claude/active-focus.md` para identificar feature ativa
- Injeta contexto da feature no início da conversa
- Carrega constraints do arquivo `constraints.md` da feature
- Elimina "cold start" - Claude sempre sabe em qual feature está trabalhando

**Exemplo de output:**
```
=== ACTIVE CONTEXT ===
Feature: adk-v2
Status: implementacao
Path: .claude/plans/features/adk-v2/

=== CONSTRAINTS ===
## Escopo Permitido
- src/utils/
- .claude/hooks/
- tests/

## Restrições
- NAO adicionar dependencias sem aprovacao
```

**Localização:** `.claude/hooks/session-bootstrap.sh`

---

#### 2. Stop Hook (`session-checkpoint.sh`)

**Quando executa:** Fim de cada sessão (quando você fecha Claude Code)

**O que faz:**
- Cria snapshot automático com reason `session_end`
- Atualiza `claude-progress.txt` com estado atual
- Extrai phase e progress de `progress.md`
- Garante recovery mesmo se sessão for interrompida abruptamente

**Snapshot criado:**
```json
{
  "id": "session-end-1737513600",
  "feature": "adk-v2",
  "reason": "session_end",
  "timestamp": "2026-01-21T10:30:00Z"
}
```

**Localização:** `.claude/hooks/session-checkpoint.sh`

**Recovery:** Use `adk agent run <name> --resume` para retomar (quando Fase 2 estiver implementada)

---

#### 3. TDD Validation Hook (`validate-tdd.sh`)

**Quando executa:** Antes de criar arquivo via `Write` em `src/`

**O que faz:**
- Detecta criação de arquivo `.ts` ou `.tsx` em `src/`
- Verifica se teste correspondente existe
- Exibe **warning** (não bloqueia) se teste não existir
- Patterns verificados:
  - `tests/<dir>/<nome>.test.ts`
  - `tests/<dir>/<nome>.spec.ts`
  - `src/<dir>/__tests__/<nome>.test.ts`
  - `src/<dir>/__tests__/<nome>.spec.ts`

**Exemplo de warning:**
```
⚠️  TDD Warning: Creating file in src/ without corresponding test.
   File: src/utils/memory-mcp.ts
   Expected test at: tests/utils/memory-mcp.test.ts
   Alternative patterns: tests/utils/memory-mcp.spec.ts, ...

   This is a reminder to follow TDD. Tests should be written first.
```

**Filosofia:** "Nudge, don't block" - avisa mas não impede trabalho

**Localização:** `.claude/hooks/validate-tdd.sh`

---

#### 4. State Sync Hook (`sync-state.sh`)

**Quando executa:** Depois de criar/modificar arquivo via `Write` ou `Edit`

**O que faz:**
- Registra arquivo modificado em `progress.md` (seção "Files Modified")
- Atualiza `state.json` com timestamp e último arquivo modificado
- Mantém histórico de modificações
- Previne inconsistências entre state.json e progress.md

**Exemplo de registro:**
```markdown
## Files Modified
- src/utils/memory-mcp.ts (2026-01-21T10:30:00Z)
- tests/utils/memory-mcp.test.ts (2026-01-21T10:32:00Z)
```

**state.json atualizado:**
```json
{
  "lastModified": "2026-01-21T10:32:00Z",
  "lastModifiedFile": "tests/utils/memory-mcp.test.ts"
}
```

**Localização:** `.claude/hooks/sync-state.sh`

---

### Como Usar

#### Configuração (Já Feita)

Os hooks estão configurados em `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": ".claude/hooks/session-bootstrap.sh" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": ".claude/hooks/session-checkpoint.sh" }] }
    ],
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/validate-tdd.sh" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/sync-state.sh" }]
      }
    ]
  }
}
```

#### Uso Diário

**Não há nada a fazer!** Os hooks executam automaticamente:

1. **Ao abrir Claude Code**: SessionStart injeta contexto
2. **Ao criar arquivo em src/**: TDD validation exibe warning
3. **Ao escrever qualquer arquivo**: State sync registra modificação
4. **Ao fechar sessão**: Stop hook cria snapshot

#### Desabilitar (Se Necessário)

Para desabilitar um hook temporariamente:

```bash
# Renomear hook para .disabled
mv .claude/hooks/validate-tdd.sh .claude/hooks/validate-tdd.sh.disabled
```

Para reabilitar:

```bash
mv .claude/hooks/validate-tdd.sh.disabled .claude/hooks/validate-tdd.sh
```

---

### Comportamento de Fallback

Todos os hooks seguem o padrão **fail-silent**:

```bash
#!/bin/bash

# Early exit se precondição não satisfeita
if [ ! -f "$REQUIRED_FILE" ]; then
  exit 0  # Não bloqueia operação
fi

# ... lógica do hook ...

exit 0  # Sempre retorna sucesso
```

**Por quê?** Hooks são auxiliares, não bloqueadores. Se algo falhar (arquivo ausente, permissão negada, etc.), prefere-se permitir a operação a bloquear o workflow do usuário.

---

### Performance

Todos os hooks executam em **< 100ms** (medido em features típicas):

| Hook | Tempo Típico | Timeout |
|------|--------------|---------|
| session-bootstrap.sh | ~30ms | N/A |
| session-checkpoint.sh | ~50ms | 2s |
| validate-tdd.sh | ~10ms | N/A |
| sync-state.sh | ~20ms | N/A |

**Nota:** Hooks são síncronos por design. Se precisar operação lenta, use `&` para executar em background.

---

## Próximas Fases

### Fase 1: MCP Memory RAG (Em Planejamento)

**Objetivo:** Busca semântica via embeddings

**Entregas:**
- `src/utils/memory-mcp.ts` - Wrapper para MCP server
- Comandos `adk memory index` e `adk memory recall`
- Hook de indexação automática após escrita

**Status:** Tasks 1.1-1.11 prontas, aguardando benchmark de providers

---

### Fase 2: Session Management (Em Planejamento)

**Objetivo:** Retomar sessões de onde parou

**Entregas:**
- `StateManager.resumeFromSnapshot()` - Resume de checkpoint
- Flag `--resume` em `adk agent run`
- Template `claude-progress.txt` em plain text

**Status:** Tasks 2.1-2.10 prontas

---

### Fase 3: Context Compactor (Em Planejamento)

**Objetivo:** Prevenir context overflow

**Entregas:**
- `TokenCounter` - Contagem precisa via API
- Compactação hierárquica (reversível → summarization)
- Handoff documents automáticos

**Status:** Tasks 3.1-3.10 prontas

---

## Troubleshooting

### Hook não está executando

**Sintomas:** Contexto não injetado, snapshot não criado, etc.

**Diagnóstico:**
```bash
# Verificar se hooks estão executáveis
ls -la .claude/hooks/*.sh

# Tornar executáveis se necessário
chmod +x .claude/hooks/*.sh
```

**Solução:**
```bash
# Recarregar settings.json (reinicie Claude Code)
```

---

### TDD Warning aparecendo demais

**Sintomas:** Warning exibido mesmo com teste existente

**Causa:** Padrão de nome de teste não reconhecido

**Solução:** Verificar se teste segue padrões suportados:
```bash
# Padrões suportados:
tests/<dir>/<nome>.test.ts
tests/<dir>/<nome>.spec.ts
src/<dir>/__tests__/<nome>.test.ts
src/<dir>/__tests__/<nome>.spec.ts
```

Se seu projeto usa padrão diferente, edite `validate-tdd.sh` linha 17-22.

---

### Snapshot criado mas não consigo usar --resume

**Causa:** Fase 2 (Session Management) ainda não implementada

**Workaround temporário:**
```bash
# Ver snapshots criados
ls .claude/plans/features/*/. snapshots/

# Restaurar manualmente (copiar state.json)
cp .claude/plans/features/<feature>/.snapshots/<snapshot-id>.json \
   .claude/plans/features/<feature>/state.json
```

**Solução permanente:** Aguardar implementação da Fase 2

---

## Referências

- **PRD:** `.claude/plans/features/adk-v2/prd.md`
- **Implementation Plan:** `.claude/plans/features/adk-v2/implementation-plan.md`
- **Tasks:** `.claude/plans/features/adk-v2/tasks.md`
- **Progress:** `.claude/plans/features/adk-v2/progress.md`
- **QA Report:** `.claude/plans/features/adk-v2/qa-report.md`

---

**Criado em:** 2026-01-21
**Status:** Fase 0 ✅ Completa | Fases 1-6 📋 Planejadas
