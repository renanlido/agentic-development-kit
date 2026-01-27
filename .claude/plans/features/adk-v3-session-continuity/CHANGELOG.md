# Changelog: ADK v3 Session Continuity

## [3.0.0-alpha] - 2026-01-26

### Sprint 0: CLI Isolado ✅

#### Added
- CLI v3 separado do v2 (`cli-v3.ts`)
- Entry point isolado executável via `npm run adk3`
- Comando `feature status <name>` básico
- Scripts npm: `adk3` e `adk3:dev`
- Estrutura de diretórios v3 (`src/utils/prompts/`)

#### Changed
- Nenhuma modificação em arquivos v2 (garantido por testes)

### Sprint 1: Session Store ✅

#### Added
- `SessionStore` class para persistência de sessões
  - `save()` com atomic write pattern (temp → move)
  - `get()` recupera sessão atual
  - `list()` retorna histórico ordenado
  - `update()` atualiza com preservação de id/startedAt
  - `clear()` remove sessão atual
  - `isResumable()` valida janela de 24h
- `executeClaudeCommandV3()` com spawn assíncrono
  - Captura completa de stdout/stderr
  - Streaming de output para console
  - Timeout configurável (default 5min)
  - Callback para chunks de output
- `parseSessionId()` para extração de session ID
- `executeWithSessionTracking()` com resume automático
  - Detecta sessões resumíveis (< 24h)
  - Adiciona `--resume` automaticamente
  - Salva session info após execução
  - Preserva session id e startedAt
- Tipos TypeScript completos:
  - `SessionInfoV3`
  - `ClaudeV3Options`
  - `ClaudeV3Result`
- Comando `feature status` com display de sessões
  - Sessão atual com Claude session ID
  - Status visual (active/completed/interrupted)
  - Indicador de resumabilidade
  - Histórico das últimas 5 sessões
- Persistência em `.claude/plans/features/{name}/sessions/`
  - `current.json` para sessão ativa
  - `history/` para todas as sessões

#### Fixed
- Race condition em saves concorrentes (atomic write pattern)
- Session ID perdido em v2 (agora 100% capturado)
- Timeout inexistente em v2 (agora configurável)
- Output não capturado em v2 (stdio: pipe vs inherit)

#### Security
- Validação de feature names (previne path traversal)
- Atomic writes previnem corrupção de dados
- Temp files com IDs únicos evitam colisões

#### Performance
- SessionStore operations < 50ms (verificado em testes)
- Spawn assíncrono permite cancelamento e controle fino
- Histórico ignora arquivos corrompidos (fail-safe)

#### Documentation
- README completo da feature
- JSDoc em métodos públicos principais
- Exemplos práticos de uso
- API reference completa
- Troubleshooting guide
- Seção v3 no README principal

#### Testing
- Cobertura >= 80% em todos os novos arquivos
- Testes unitários: SessionStore (13 casos)
- Testes unitários: claude-v3 (12 casos)
- Testes unitários: feature-v3 (5 casos)
- Testes de integração: session tracking (6 casos)
- Mocks completos do Claude CLI
- Isolamento via temp dirs em testes

---

## Comparação v2 vs v3

| Aspecto | v2 | v3 |
|---------|----|----|
| **Execução** | `spawnSync` (bloqueante) | `spawn` (assíncrono) |
| **Output** | Impossível capturar | Capturado completamente |
| **Session ID** | Nunca capturado | Sempre extraído |
| **Resume** | Impossível | Automático quando < 24h |
| **Contexto** | 0% entre fases | 100% (sessão contínua) |
| **Timeout** | Nenhum | Configurável (5min default) |
| **Persistência** | Nenhuma | JSON em disco |
| **Atomic Writes** | Não | Sim (temp → move) |
| **Histórico** | Não existe | Mantido indefinidamente |
| **Isolamento** | N/A | Completamente separado de v2 |

---

## Breaking Changes

Nenhum - v3 é completamente isolado do v2.

---

## Migration Path (Futuro)

**Não disponível ainda.** v3 é preview apenas.

Quando v3 for promovido a stable:
1. Backfill de sessões v2 (não será possível, sem session IDs)
2. Comandos v2 deprecados gradualmente
3. CLI unificado com flag `--legacy` para v2

---

## Known Limitations

1. **Session Resume Window**: 24 horas (hard-coded)
2. **Claude CLI Dependency**: Requer `--print-session-id` e `--resume`
3. **No Backfill**: Sessões v2 não podem ser migradas
4. **CLI Separado**: Não integrado com v2 ainda

---

## Roadmap

### Sprint 2 (Planejado)
- [ ] Prompts diferenciados (Initializer Agent / Coding Agent)
- [ ] `feature_list.json` generator
- [ ] `init.sh` generator

### Sprint 3 (Planejado)
- [ ] Comando `feature work` com loop
- [ ] Integração com Git (auto-commit, git log reading)
- [ ] Unificação de CLIs v2/v3

### Sprint 4 (Futuro)
- [ ] Session analytics (duração média, taxa de sucesso)
- [ ] Session cleanup automático (> 30 dias)
- [ ] Session export/import para compartilhamento
- [ ] Multi-session support (múltiplas sessões paralelas)

---

## Contributors

- Implementation: Renan Lido + Claude Sonnet 4.5
- Architecture: Based on ADK v2 analysis and research
- Testing: TDD rigoroso com 80%+ coverage

---

## References

- PRD: `prd.md`
- Implementation Plan: `implementation-plan.md`
- Tasks Breakdown: `tasks.md`
- Feature README: `README.md`
- Research: `research.md`
