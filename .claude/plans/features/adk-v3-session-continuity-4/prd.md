# PRD: adk-v3-session-continuity-4

**Data:** 2026-01-26
**Status:** Draft
**Autor:** Auto-generated
**Versão:** 1.0.0

---

## 1. Problema

### 1.1 Problema Central

O ADK v2 sofre de **perda total de contexto** entre fases de desenvolvimento. Cada chamada a `executeClaudeCommand()` cria uma nova sessão do Claude, resultando em:

- **0% de continuidade de contexto** entre fases (research → plan → implement)
- **7+ sessões isoladas** para completar uma única feature
- **~40% de declarações prematuras de conclusão** (Claude vê progresso parcial e declara projeto completo)
- **Esgotamento de contexto mid-implementation** (one-shotting)

### 1.2 Evidências Técnicas (Análise v2)

| Componente | Problema Identificado |
|------------|----------------------|
| `executeClaudeCommand()` | Usa `spawnSync` (bloqueante), não captura session ID, sempre retorna string vazia |
| `StateManager.createSession()` | Código morto - nunca é chamado em nenhum lugar |
| `MemoryMCP` | Marketing falso - é Fuse.js fuzzy matching, não busca semântica real |
| `session-checkpoint.sh` | Cria checkpoint JSON mas ninguém restaura |

### 1.3 Gap vs Padrão Anthropic (Long-Running Agents)

A Anthropic recomenda arquitetura de dois agentes:

| Recomendação Anthropic | ADK v2 | Gap |
|------------------------|--------|-----|
| Initializer Agent na primeira sessão | Mesmo prompt sempre | 🔴 Missing |
| Coding Agent em sessões subsequentes | Mesmo prompt sempre | 🔴 Missing |
| `feature_list.json` com testes estruturados | Apenas `progress.md` (fases) | 🔴 Missing |
| `init.sh` para ambiente | Não existe | 🔴 Missing |
| Leitura de `git log` no início | Não faz | 🔴 Missing |
| Loop até 100% passes | Não existe | 🔴 Missing |
| Session resume real | Código existe mas nunca usado | 🟡 Parcial |

---

## 2. Solução Proposta

### 2.1 Visão Geral

Criar sistema de **session continuity** que mantém contexto através de:

1. **CLI Separado (`adk3`)** - Isolado do v2 para não quebrar workflows existentes
2. **Session Tracking** - Persistência de session IDs do Claude para resume
3. **Dual-Agent Architecture** - Prompts diferenciados para primeira vs subsequentes sessões
4. **Feature List** - Testes estruturados em JSON com status pass/fail
5. **Git Context** - Leitura automática de histórico git no início de cada sessão

### 2.2 Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    adk3 feature work my-feature                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ É primeira      │
                    │ sessão?         │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ SIM             │          │ NÃO             │
    │ Initializer     │          │ Coding Agent    │
    │ Agent           │          │ Loop            │
    └────────┬────────┘          └────────┬────────┘
             │                            │
             ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ 1. Gerar        │          │ 1. pwd          │
    │    feature_list │          │ 2. Ler progress │
    │ 2. Gerar init.sh│          │ 3. Ler feature  │
    │ 3. Git commit   │          │    _list        │
    │    inicial      │          │ 4. git log -20  │
    │ 4. Salvar       │          │ 5. ./init.sh    │
    │    session ID   │          │ 6. Trabalhar 1  │
    └─────────────────┘          │    feature      │
                                 │ 7. Testar e2e   │
                                 │ 8. passes: true │
                                 │ 9. Git commit   │
                                 │ 10. Repetir até │
                                 │     100% passes │
                                 └─────────────────┘
```

### 2.3 Regras Críticas de Implementação

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🚫 PROIBIDO:                                                            │
│     - NÃO modificar src/cli.ts                                          │
│     - NÃO modificar src/commands/feature.ts                             │
│     - NÃO fazer npm link durante desenvolvimento                        │
│                                                                          │
│  ✅ OBRIGATÓRIO:                                                        │
│     - Criar arquivos NOVOS com sufixo -v3                               │
│     - Testar com: npm run adk3 -- <comando>                             │
│     - Manter v2 congelado até v3 100% validado                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Requisitos Funcionais

### 3.1 CLI Separado (✅ Implementado)

- **RF01**: CLI `adk3` deve ser entry point separado de `adk`
- **RF02**: Comando base `adk3 feature status <name>` deve mostrar info de sessão
- **RF03**: Script npm `adk3` deve executar `dist/cli-v3.js`

### 3.2 Session Store (✅ Implementado)

- **RF04**: Salvar session info em `.claude/plans/features/{name}/sessions/current.json`
- **RF05**: Manter histórico em `sessions/history/{session-id}.json`
- **RF06**: Escrita atômica (temp file + move) para evitar corrupção
- **RF07**: Validar resumabilidade: sessão existe + flag `resumable=true` + última atividade < 24h

### 3.3 Claude V3 Execution (✅ Implementado)

- **RF08**: Usar `spawn` (async) ao invés de `spawnSync`
- **RF09**: Capturar stdout/stderr enquanto streaming para console
- **RF10**: Extrair session ID automaticamente via pattern `/Session ID: ([a-f0-9-]+)/i`
- **RF11**: Suportar `--resume` flag para continuar sessão existente
- **RF12**: Timeout configurável (default 5 minutos)

### 3.4 Session Detection (🔴 A Implementar)

- **RF13**: Detectar se é primeira sessão verificando existência de `feature_list.json` e `claude-progress.txt`
- **RF14**: Se primeira sessão → usar Initializer Agent prompt
- **RF15**: Se sessão subsequente → usar Coding Agent prompt

### 3.5 Initializer Agent (🔴 A Implementar)

- **RF16**: Analisar PRD e extrair TODOS os requisitos testáveis
- **RF17**: Gerar `feature_list.json` com estrutura:
  ```json
  {
    "feature": "nome",
    "tests": [{
      "id": "test-001",
      "description": "...",
      "category": "functional|ui|integration",
      "steps": ["step1", "step2"],
      "passes": false
    }],
    "summary": { "total": N, "passing": 0, "failing": 0, "pending": N }
  }
  ```
- **RF18**: Gerar `init.sh` script para setup do ambiente de desenvolvimento
- **RF19**: Criar commit inicial com arquivos de setup

### 3.6 Coding Agent (🔴 A Implementar)

- **RF20**: Iniciar cada sessão com checklist:
  1. `pwd` para confirmar diretório
  2. Ler `claude-progress.txt`
  3. Ler `feature_list.json`
  4. `git log --oneline -20`
  5. Executar `./init.sh`
- **RF21**: Trabalhar em UMA feature por vez do `feature_list.json`
- **RF22**: Só marcar `passes: true` após teste end-to-end real
- **RF23**: Commit após completar cada feature
- **RF24**: Atualizar `claude-progress.txt` antes de encerrar sessão

### 3.7 Git Context (🔴 A Implementar)

- **RF25**: Função para ler últimos N commits: `git log --oneline -N`
- **RF26**: Função para verificar arquivos modificados: `git status --porcelain`
- **RF27**: Auto-commit com mensagem descritiva após cada feature completa
- **RF28**: Incluir no prompt informações de contexto git

### 3.8 Comando Work (🔴 A Implementar)

- **RF29**: `adk3 feature work <name>` como comando principal
- **RF30**: Loop automático até `feature_list.json` ter 100% passes
- **RF31**: Detecção automática de primeira vs subsequente sessão
- **RF32**: Resume automático se sessão < 24h

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01**: Tempo de startup do CLI < 500ms
- **RNF02**: Detecção de sessão < 100ms
- **RNF03**: Escrita atômica não deve adicionar mais de 50ms de latência

### 4.2 Confiabilidade

- **RNF04**: Session store deve usar escrita atômica para prevenir corrupção
- **RNF05**: Erros em hooks não devem impedir execução principal
- **RNF06**: Timeout de 5 minutos por default para evitar sessões travadas

### 4.3 Compatibilidade

- **RNF07**: v3 deve coexistir com v2 sem interferência
- **RNF08**: Arquivos v3 não devem sobrescrever arquivos v2
- **RNF09**: Node.js >= 18.0.0 (mesmo requisito v2)

### 4.4 Testabilidade

- **RNF10**: Cobertura de testes >= 80% para novos módulos
- **RNF11**: `TEST_FEATURE_PATH` env var para testes isolados
- **RNF12**: Mocks para execução Claude em testes

### 4.5 Segurança

- **RNF13**: Validação de nomes de feature contra path traversal (`/../`)
- **RNF14**: Não armazenar credenciais em session files
- **RNF15**: Temp files devem ser removidos após uso

---

## 5. User Stories

### US01: Primeira Sessão de Feature
**Como** desenvolvedor
**Quero** que o ADK configure automaticamente meu ambiente na primeira sessão
**Para** começar a trabalhar com todos os artefatos necessários já criados

**Critérios de Aceitação:**
- [ ] `feature_list.json` é gerado a partir do PRD
- [ ] `init.sh` é criado para setup do ambiente
- [ ] `claude-progress.txt` é inicializado
- [ ] Commit inicial é feito com arquivos de setup
- [ ] Session ID é salvo para resume futuro

---

### US02: Continuidade de Sessão
**Como** desenvolvedor
**Quero** que o ADK retome automaticamente minha última sessão
**Para** manter todo o contexto de conversação com Claude

**Critérios de Aceitação:**
- [ ] Se última sessão < 24h, usa `--resume` automaticamente
- [ ] Contexto git é injetado no início da sessão
- [ ] `feature_list.json` atual é apresentado ao Claude
- [ ] Progresso anterior é preservado

---

### US03: Trabalho Incremental
**Como** desenvolvedor
**Quero** que Claude trabalhe em uma feature por vez
**Para** evitar declaração prematura de conclusão e garantir qualidade

**Critérios de Aceitação:**
- [ ] Claude seleciona UMA feature pendente do `feature_list.json`
- [ ] Feature só é marcada `passes: true` após teste real
- [ ] Commit é feito após cada feature completa
- [ ] Loop continua até 100% passes

---

### US04: Visibilidade de Status
**Como** desenvolvedor
**Quero** ver o status detalhado da minha feature e sessões
**Para** entender o progresso e estado atual

**Critérios de Aceitação:**
- [ ] `adk3 feature status <name>` mostra sessão atual
- [ ] Histórico de sessões é exibido
- [ ] Flag de resumabilidade é mostrada
- [ ] Última atividade é formatada legível

---

### US05: Isolamento de Versões
**Como** desenvolvedor
**Quero** que v3 não afete meus workflows v2 existentes
**Para** migrar gradualmente sem riscos

**Critérios de Aceitação:**
- [ ] `adk` (v2) continua funcionando normalmente
- [ ] `adk3` é comando completamente separado
- [ ] Arquivos v3 não sobrescrevem v2
- [ ] npm link não é necessário durante dev

---

## 6. Escopo

### 6.1 Incluído

- CLI separado `adk3` com comandos feature
- Sistema de session tracking com persistência
- Execução assíncrona do Claude com captura de session ID
- Resume automático de sessões < 24h
- Detecção de primeira vs subsequente sessão
- Prompts diferenciados (Initializer vs Coding Agent)
- Geração de `feature_list.json` a partir de PRD
- Geração de `init.sh` para setup
- Integração com git (log, status, auto-commit)
- Comando `work` com loop até 100% passes
- Testes unitários com cobertura >= 80%

### 6.2 Excluído (Out of Scope)

- Modificação de arquivos v2 (`src/cli.ts`, `src/commands/feature.ts`)
- `npm link` durante desenvolvimento
- Migração de Python SDK (será v4)
- Constitution/Steering prompts avançados
- Browser automation e2e (Puppeteer MCP)
- Busca semântica real (mantém Fuse.js por ora)
- Tarefas pendentes de v2-fase3
- UI/Dashboard para visualização

---

## 7. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| `--print-session-id` não funciona em todas versões do Claude CLI | Alto | Média | Implementar fallback para extrair de stderr; validar versão mínima do Claude CLI |
| Corrupção de session file durante escrita | Alto | Baixa | Escrita atômica já implementada (temp + move) |
| Timeout insuficiente para operações complexas | Médio | Média | Timeout configurável por comando; default 5min pode ser aumentado |
| Claude declara feature completa sem testar | Alto | Alta | Prompt explícito: "só marcar passes:true após teste real"; checklist obrigatório |
| Conflito entre v2 e v3 em arquivos compartilhados | Alto | Baixa | Arquivos v3 em diretórios separados; validação de feature name |
| git auto-commit com mensagens ruins | Médio | Média | Template de commit no prompt; revisão de mensagem antes de commit |
| Session expira durante trabalho longo | Médio | Média | Janela de 24h é generosa; warning quando próximo de expirar |

---

## 8. Métricas de Sucesso

### 8.1 Métricas Quantitativas

| Métrica | Baseline v2 | Target v3 | Como Medir |
|---------|-------------|-----------|------------|
| Sessões por feature | 7+ (uma por fase) | 1-3 | Contar sessions no histórico |
| Contexto entre fases | ~0% | >95% | Resume success rate |
| Conclusão prematura | ~40% | <5% | Features marcadas `passes:true` sem teste real |
| Recovery após crash | Manual (minutos) | <30s | Tempo para `--resume` funcionar |
| Cobertura de testes | - | >=80% | Jest coverage report |

### 8.2 Métricas Qualitativas

- Desenvolvedor consegue pausar e retomar trabalho no dia seguinte sem perda de contexto
- Claude demonstra conhecimento de commits anteriores ao iniciar sessão
- `feature_list.json` reflete fielmente os requisitos do PRD
- Auto-commits têm mensagens descritivas e úteis

---

## 9. Dependências

### 9.1 Dependências Técnicas

| Dependência | Versão | Status | Uso |
|-------------|--------|--------|-----|
| Claude CLI | >= 1.0 | Instalado | Execução de comandos com `--resume` e `--print-session-id` |
| Node.js | >= 18.0.0 | Requisito existente | Runtime |
| Commander.js | ^14.0.2 | Instalado | CLI parsing |
| fs-extra | ^11.3.3 | Instalado | Operações de arquivo |
| simple-git | ^3.30.0 | Instalado | Integração git |
| ora | ^9.0.0 | Instalado | Spinners |
| chalk | ^5.6.2 | Instalado | Cores no terminal |

### 9.2 Dependências de Código (Já Implementadas)

| Módulo | Status | Usado por |
|--------|--------|-----------|
| `src/cli-v3.ts` | ✅ Implementado | Entry point |
| `src/utils/session-store.ts` | ✅ Implementado | Persistência de sessões |
| `src/types/session-v3.ts` | ✅ Implementado | Type definitions |
| `src/utils/claude-v3.ts` | ✅ Implementado | Execução com tracking |
| `src/commands/feature-v3.ts` | ✅ Parcial | Comando status |

### 9.3 Dependências de Código (A Implementar)

| Módulo | Depende de | Bloqueia |
|--------|------------|----------|
| `src/utils/prompts/initializer-agent.ts` | - | Comando work |
| `src/utils/prompts/coding-agent.ts` | - | Comando work |
| `src/utils/feature-list.ts` | - | Initializer agent |
| `src/utils/init-script.ts` | - | Initializer agent |
| `src/utils/git-context.ts` | simple-git | Coding agent |
| `feature work` command | Todos acima | Release v3 |

---

## 10. Timeline (Sprints)

### Sprint 0: Setup ✅ (Concluído)
- [x] Branch feature/adk-v3 criada
- [x] `src/cli-v3.ts` criado
- [x] Script "adk3" no package.json
- [x] Estrutura de diretórios v3

### Sprint 1: Session Store ✅ (Concluído)
- [x] `src/utils/session-store.ts` com CRUD completo
- [x] `src/utils/claude-v3.ts` com tracking
- [x] `src/types/session-v3.ts`
- [x] Testes unitários básicos

### Sprint 2: Dual-Agent Prompts (A Fazer)
- [ ] `src/utils/prompts/initializer-agent.ts`
- [ ] `src/utils/prompts/coding-agent.ts`
- [ ] Session detection (primeira vs subsequente)
- [ ] Testes unitários

### Sprint 3: Feature List & Init Script (A Fazer)
- [ ] `src/utils/feature-list.ts` (generator + validator)
- [ ] `src/utils/init-script.ts` (generator)
- [ ] Integração com Initializer Agent
- [ ] Testes unitários

### Sprint 4: Git Integration & Command Work (A Fazer)
- [ ] `src/utils/git-context.ts` (log, status, auto-commit)
- [ ] Comando `adk3 feature work <name>`
- [ ] Loop até 100% passes
- [ ] Integração completa
- [ ] Testes e2e

### Sprint 5: Migração & Release (Futuro)
- [ ] Testes completos de integração
- [ ] Documentação atualizada
- [ ] Merge para CLI principal
- [ ] Release v3.0.0

---

## 11. Estrutura de Arquivos Final

```
src/
├── cli.ts                    # v2 - CONGELADO
├── cli-v3.ts                 # ✅ v3 entry point
├── commands/
│   ├── feature.ts            # v2 - CONGELADO
│   └── feature-v3.ts         # ✅ v3 feature commands (parcial)
├── types/
│   ├── session.ts            # v2
│   └── session-v3.ts         # ✅ v3 types
└── utils/
    ├── claude.ts             # v2 - CONGELADO
    ├── claude-v3.ts          # ✅ v3 execution
    ├── session-store.ts      # ✅ v3 session persistence
    ├── git-context.ts        # 🔴 A criar
    ├── feature-list.ts       # 🔴 A criar
    ├── init-script.ts        # 🔴 A criar
    └── prompts/
        ├── .gitkeep          # ✅ Existe
        ├── initializer-agent.ts  # 🔴 A criar
        └── coding-agent.ts       # 🔴 A criar

.claude/plans/features/{feature}/
├── prd.md                    # ✅ Já existe (v2)
├── research.md               # ✅ Já existe (v2)
├── tasks.md                  # ✅ Já existe (v2)
├── progress.md               # ✅ Já existe (v2)
├── claude-progress.txt       # ✅ Já existe (v2)
├── feature_list.json         # 🔴 v3 - A criar por Initializer
├── init.sh                   # 🔴 v3 - A criar por Initializer
├── state.json                # ✅ Já existe (v2)
├── sessions/                 # ✅ v3 - Criado automaticamente
│   ├── current.json
│   └── history/
│       └── {session-id}.json
└── .snapshots/               # ✅ Já existe (v2)
```

---

## 12. Critérios de Aceite Final

Para considerar a feature **completa**, todos os seguintes critérios devem ser atendidos:

### 12.1 Funcionalidade

- [ ] `adk3 feature work <name>` executa loop completo
- [ ] Primeira sessão gera `feature_list.json` e `init.sh`
- [ ] Sessões subsequentes usam `--resume` automaticamente
- [ ] Claude recebe contexto git no início de cada sessão
- [ ] Features são marcadas `passes: true` apenas após teste
- [ ] Auto-commit funciona com mensagens descritivas
- [ ] Loop para quando `feature_list.json` tem 100% passes

### 12.2 Qualidade

- [ ] Cobertura de testes >= 80%
- [ ] Sem erros de tipo (type-check passa)
- [ ] Lint/format passa (biome check)
- [ ] v2 continua funcionando sem alterações

### 12.3 Documentação

- [ ] README atualizado com comandos v3
- [ ] CLAUDE.md atualizado com workflow v3
- [ ] Exemplos de uso documentados

---

*PRD gerado automaticamente - ADK v3 Session Continuity*
