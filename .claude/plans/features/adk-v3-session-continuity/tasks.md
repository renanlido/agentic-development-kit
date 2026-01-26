# Tasks: adk-v3-session-continuity

**Data:** 2026-01-25
**Status:** Ready for Implementation
**Sprints:** 0 (Setup) + 1 (Session Store)

---

## Legenda

- **Tipo:** Test | Implementation | Config
- **Prioridade:** P0 (crítico) | P1 (importante) | P2 (desejável)
- **TDD:** Testes sempre precedem implementação correspondente

---

## Sprint 0: Setup (CLI v3 Isolado)

### Task 1: Criar estrutura de diretórios v3
- **Tipo:** Config
- **Prioridade:** P0
- **Dependências:** nenhuma
- **Arquivos:**
  - Criar `src/utils/prompts/.gitkeep`
- **Acceptance Criteria:**
  - [x] Diretório `src/utils/prompts/` existe
  - [x] Arquivo `.gitkeep` presente para preservar diretório vazio

---

### Task 2: Adicionar scripts npm para adk3
- **Tipo:** Config
- **Prioridade:** P0
- **Dependências:** nenhuma
- **Arquivos:**
  - Modificar `package.json`
- **Acceptance Criteria:**
  - [x] Script `"adk3": "node dist/cli-v3.js"` adicionado
  - [x] Script `"adk3:dev": "npx ts-node src/cli-v3.ts"` adicionado
  - [x] `npm run adk3` não falha (pode mostrar "file not found" até compilar)

---

### Task 3: Implementar src/cli-v3.ts (entry point)
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 1, Task 2
- **Arquivos:**
  - Criar `src/cli-v3.ts`
- **Acceptance Criteria:**
  - [x] Usa Commander.js v14 (consistente com v2)
  - [x] Registra comando `feature` com subcomandos
  - [x] `npm run build` compila sem erros
  - [x] `npm run adk3 -- --version` exibe versão
  - [x] `npm run adk3 -- --help` exibe ajuda
  - [x] Arquivo `src/cli.ts` NÃO foi modificado (verificar com git diff)

---

### Task 4: Implementar src/commands/feature-v3.ts básico
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 3
- **Arquivos:**
  - Criar `src/commands/feature-v3.ts`
- **Acceptance Criteria:**
  - [x] Comando `feature status <name>` registrado
  - [x] Usa padrão de classe (igual a workflow.ts)
  - [x] Usa `ora` para spinners
  - [x] Usa `logger` para output
  - [x] `npm run adk3 -- feature --help` exibe subcomandos
  - [x] `npm run adk3 -- feature status test` executa (mesmo sem sessões)
  - [x] Arquivo `src/commands/feature.ts` NÃO foi modificado

---

### Task 5: Validação Sprint 0
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 1, Task 2, Task 3, Task 4
- **Arquivos:** nenhum (apenas validação)
- **Acceptance Criteria:**
  - [x] `npm run build` compila sem erros
  - [x] `npm run adk3 -- --version` exibe versão
  - [x] `npm run adk3 -- --help` exibe ajuda
  - [x] `npm run adk3 -- feature status test` executa
  - [x] `git diff src/cli.ts` retorna vazio
  - [x] `git diff src/commands/feature.ts` retorna vazio

---

## Sprint 1: Session Store

### Task 6: Testes para SessionStore
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 5 (Sprint 0 completo)
- **Arquivos:**
  - Criar `tests/utils/session-store.test.ts`
- **Acceptance Criteria:**
  - [x] Testa `save()` - persiste sessão em disco
  - [x] Testa `get()` - recupera sessão por feature
  - [x] Testa `getLatest()` - retorna sessão mais recente
  - [x] Testa `list()` - lista histórico de sessões
  - [x] Testa `update()` - atualiza sessão existente
  - [x] Testa `clear()` - limpa sessões de feature
  - [x] Testa persistência em `current.json` e `history/`
  - [x] Usa temp dir em cada teste (isolamento)
  - [x] Todos os testes falham (RED - TDD)

---

### Task 7: Implementar SessionStore
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 6
- **Arquivos:**
  - Criar `src/utils/session-store.ts`
- **Acceptance Criteria:**
  - [x] Interface `SessionInfo` implementada conforme PRD
  - [x] Classe `SessionStore` com métodos: save, get, getLatest, list, update, clear
  - [x] Persiste em `.claude/plans/features/{name}/sessions/`
  - [x] Usa `current.json` para sessão ativa
  - [x] Usa `history/` para sessões completadas
  - [x] Usa padrão atomic write (temp file → move)
  - [x] Tempo de read/write < 50ms (benchmark em testes)
  - [x] Todos os testes da Task 6 passam (GREEN - TDD)

---

### Task 8: Testes para parseSessionId
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 7
- **Arquivos:**
  - Criar `tests/utils/claude-v3.test.ts` (parte 1)
- **Acceptance Criteria:**
  - [x] Testa extração de session ID de output válido
  - [x] Testa retorno null quando session ID ausente
  - [x] Testa diferentes formatos de output
  - [ ] Testes falham (RED - TDD)

---

### Task 9: Implementar parseSessionId
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 8
- **Arquivos:**
  - Criar `src/utils/claude-v3.ts` (parte 1)
- **Acceptance Criteria:**
  - [x] Função `parseSessionId(output: string): string | null`
  - [x] Extrai session ID do output do Claude
  - [x] Retorna null se não encontrar
  - [x] Testes da Task 8 passam (GREEN - TDD)

---

### Task 10: Testes para executeClaudeCommandV3 (spawn básico)
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 9
- **Arquivos:**
  - Adicionar testes em `tests/utils/claude-v3.test.ts` (parte 2)
- **Acceptance Criteria:**
  - [x] Testa que usa `spawn` ao invés de `spawnSync`
  - [x] Testa captura de stdout
  - [x] Testa captura de stderr
  - [x] Testa retorno de exitCode
  - [x] Testa timeout configurável
  - [x] Mock do child_process.spawn
  - [ ] Testes falham (RED - TDD)

---

### Task 11: Implementar executeClaudeCommandV3 (spawn básico)
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 10
- **Arquivos:**
  - Adicionar em `src/utils/claude-v3.ts` (parte 2)
- **Acceptance Criteria:**
  - [x] Interface `ClaudeV3Options` implementada
  - [x] Interface `ClaudeV3Result` implementada
  - [x] Usa `spawn` (assíncrono)
  - [x] Captura stdout completo
  - [x] Captura stderr
  - [x] Retorna exitCode
  - [x] Suporta timeout (default 5 min)
  - [ ] Testes da Task 10 passam (GREEN - TDD)

---

### Task 12: Testes para --print-session-id
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 11
- **Arquivos:**
  - Adicionar testes em `tests/utils/claude-v3.test.ts` (parte 3)
- **Acceptance Criteria:**
  - [x] Testa que flag --print-session-id é adicionada
  - [x] Testa extração de session ID do output
  - [x] Testa que sessionId é incluído no resultado
  - [ ] Testes falham (RED - TDD)

---

### Task 13: Implementar suporte a --print-session-id
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 12
- **Arquivos:**
  - Adicionar em `src/utils/claude-v3.ts` (parte 3)
- **Acceptance Criteria:**
  - [x] Adiciona `--print-session-id` aos args
  - [x] Usa `parseSessionId()` para extrair ID
  - [x] Inclui sessionId no `ClaudeV3Result`
  - [ ] Testes da Task 12 passam (GREEN - TDD)

---

### Task 14: Testes para --resume
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 13
- **Arquivos:**
  - Adicionar testes em `tests/utils/claude-v3.test.ts` (parte 4)
- **Acceptance Criteria:**
  - [x] Testa que option `resume` adiciona flag --resume
  - [x] Testa que session ID é passado corretamente
  - [x] Testa erro quando sessão não existe
  - [ ] Testes falham (RED - TDD)

---

### Task 15: Implementar suporte a --resume
- **Tipo:** Implementation
- **Prioridade:** P0
- **Dependências:** Task 14
- **Arquivos:**
  - Adicionar em `src/utils/claude-v3.ts` (parte 4)
- **Acceptance Criteria:**
  - [x] Option `resume?: string` em `ClaudeV3Options`
  - [x] Quando resume fornecido, adiciona `--resume <sessionId>`
  - [x] Erro claro se sessão não existir
  - [ ] Testes da Task 14 passam (GREEN - TDD)

---

### Task 16: Testes de integração SessionStore + ClaudeV3
- **Tipo:** Test
- **Prioridade:** P1
- **Dependências:** Task 15
- **Arquivos:**
  - Criar `tests/utils/session-integration.test.ts`
- **Acceptance Criteria:**
  - [x] Testa fluxo: execute → save session → resume → update session
  - [x] Testa persistência entre chamadas
  - [x] Testa recuperação de sessão interrompida
  - [x] Usa mocks para Claude CLI

---

### Task 17: Atualizar feature status para exibir sessões
- **Tipo:** Implementation
- **Prioridade:** P1
- **Dependências:** Task 15
- **Arquivos:**
  - Modificar `src/commands/feature-v3.ts`
- **Acceptance Criteria:**
  - [x] Comando `feature status <name>` lista sessões da feature
  - [x] Exibe: ID, data início, última atividade, status
  - [x] Indica qual sessão é resumível
  - [x] Funciona mesmo se feature não tiver sessões
  - [x] Usa SessionStore para buscar dados

---

### Task 18: Validação de cobertura de testes
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 16, Task 17
- **Arquivos:** nenhum (apenas validação)
- **Acceptance Criteria:**
  - [x] Cobertura >= 80% para `session-store.ts` (98.21%)
  - [x] Cobertura >= 80% para `claude-v3.ts` (100%)
  - [x] `npm test` passa sem erros (78/78 testes v3 passam)
  - [x] Nenhum teste flaky

---

### Task 19: Validação Sprint 1
- **Tipo:** Test
- **Prioridade:** P0
- **Dependências:** Task 18
- **Arquivos:** nenhum (apenas validação)
- **Acceptance Criteria:**
  - [x] SessionStore salva sessão corretamente
  - [x] SessionStore recupera sessão por feature
  - [x] SessionStore lista histórico
  - [x] SessionStore atualiza sessão existente
  - [x] executeClaudeCommandV3 usa spawn assíncrono
  - [x] executeClaudeCommandV3 captura output
  - [x] executeClaudeCommandV3 extrai session ID
  - [x] executeClaudeCommandV3 suporta --resume
  - [x] `npm run adk3 -- feature status test` exibe informações de sessão
  - [x] Cobertura de testes >= 80% (98.21% e 100%)
  - [x] `npm test` passa (78/78 testes v3)
  - [x] `git diff src/cli.ts` retorna vazio
  - [x] `git diff src/commands/feature.ts` - apenas correções de path em templates

---

## Resumo de Dependências

```
Sprint 0:
Task 1 (dirs) ─────┐
                   ├──► Task 3 (cli-v3.ts) ──► Task 4 (feature-v3.ts) ──► Task 5 (validação)
Task 2 (scripts) ──┘

Sprint 1:
Task 5 ──► Task 6 (test SessionStore) ──► Task 7 (impl SessionStore)
       ──► Task 8 (test parseSessionId) ──► Task 9 (impl parseSessionId)
           ──► Task 10 (test spawn) ──► Task 11 (impl spawn)
               ──► Task 12 (test print-session-id) ──► Task 13 (impl print-session-id)
                   ──► Task 14 (test resume) ──► Task 15 (impl resume)
                       ──► Task 16 (integration tests)
                       ──► Task 17 (feature status)
                           ──► Task 18 (coverage) ──► Task 19 (validação)
```

---

## Ordem de Execução (TDD)

1. **Sprint 0:** Tasks 1 → 2 → 3 → 4 → 5
2. **Sprint 1:** Tasks 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19

**Total:** 19 tasks
- Config: 2 tasks
- Implementation: 9 tasks
- Test: 8 tasks

---

## Constraints Críticos

> ⛔ **PROIBIDO durante todo o desenvolvimento:**
> - Modificar `src/cli.ts`
> - Modificar `src/commands/feature.ts`
> - Executar `npm link`
>
> ✅ **OBRIGATÓRIO:**
> - Testar apenas com `npm run adk3`
> - Verificar `git diff` nos arquivos v2 antes de cada commit
