# ADK v3 - Gerenciamento de Contexto e Memoria

**Data:** 2026-02-02
**Status:** ESPECIFICACAO COMPLETA
**Baseado em:** Pesquisa academica e industrial (25+ fontes)

---

## Indice

1. [Problema Central](#1-problema-central)
2. [Arquitetura de Memoria Hierarquica](#2-arquitetura-de-memoria-hierarquica)
3. [Tier 1: Core State](#3-tier-1-core-state)
4. [Tier 2: Session Context](#4-tier-2-session-context)
5. [Tier 3: Feature Context](#5-tier-3-feature-context)
6. [Tier 4: Project Context](#6-tier-4-project-context)
7. [Compaction Estruturada](#7-compaction-estruturada)
8. [Protocolos Anti-Stub](#8-protocolos-anti-stub)
9. [Hooks de Injecao de Contexto](#9-hooks-de-injecao-de-contexto)
10. [Metricas e KPIs](#10-metricas-e-kpis)
11. [Implementacao no ADK](#11-implementacao-no-adk)
12. [Garantia de Leitura de Contexto](#12-garantia-de-leitura-de-contexto)
13. [Multi-Agent Parallel Execution](#13-multi-agent-parallel-execution)
14. [Codebase Indexing (Fast Context)](#14-codebase-indexing-fast-context)
15. [Auto Memories (Captura Automatica)](#15-auto-memories-captura-automatica)
16. [Visual Progress UI](#16-visual-progress-ui)
17. [Referencias](#17-referencias)

---

## 1. Problema Central

### 1.1 Sintomas Observados

| Sintoma | Causa Raiz | Impacto |
|---------|-----------|---------|
| Codigo stub em vez de implementacao real | Context overload, agente "rushing forward" | Re-trabalho, bugs |
| Agente esquece instrucoes anteriores | Context window overflow | Inconsistencia |
| Repeticao de erros ja corrigidos | Falta de memoria persistente | Perda de produtividade |
| Implementacao parcial de features | Attention decay em contextos longos | Features incompletas |

### 1.2 Causas Tecnicas

**Context Pollution:** Informacao irrelevante ocupa espaco no contexto, degradando performance.

**Attention Decay (Context Rot):** Performance do modelo degrada conforme token count aumenta. Apos ~4000 tokens, atencao comeca a dispersar.

**"Rush Forward" Behavior:** Agentes treinados para minimizar esforco evitam ler arquivos e analisar estruturas existentes.

**Loss of Operational Details:** Compressao agressiva descarta file paths, API endpoints, condicoes de erro.

### 1.3 Principio Fundamental

> "Context Engineering e a pratica de curar o menor conjunto de tokens de alto sinal que o modelo ve em cada step."
> — Anthropic

Contexto e um recurso finito com "attention budget" que degrada conforme token count aumenta.

---

## 2. Arquitetura de Memoria Hierarquica

Baseado no padrao MemGPT (Memory-GPT), implementamos hierarquia similar a sistemas operacionais:

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLM PROCESSOR                              │
│                    (Inferencia ativa)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: CORE STATE (In-Context) - "RAM"                        │
│  ─────────────────────────────────────────                      │
│  Capacidade: ~2-4K tokens                                       │
│  Latencia: Instantanea                                          │
│  Conteudo: Estado atual, task corrente, constraints             │
│  Caracteristica: SEMPRE presente em TODA inferencia             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: SESSION CONTEXT (Carregado por sessao)                 │
│  ─────────────────────────────────────────────                  │
│  Capacidade: ~8-16K tokens                                      │
│  Latencia: Baixa (leitura de arquivo)                           │
│  Conteudo: Notas da sessao, decisoes, breadcrumbs               │
│  Caracteristica: Carregado no inicio da sessao                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: FEATURE CONTEXT (Carregado sob demanda)                │
│  ──────────────────────────────────────────────                 │
│  Capacidade: ~20-50K tokens                                     │
│  Latencia: Media (busca + leitura)                              │
│  Conteudo: PRD, plano, arquivos relacionados a task             │
│  Caracteristica: Carregado quando task muda                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 4: PROJECT CONTEXT (Referencia rara)                      │
│  ─────────────────────────────────────────                      │
│  Capacidade: Ilimitada                                          │
│  Latencia: Alta (semantic search)                               │
│  Conteudo: CLAUDE.md, guidelines, convencoes globais            │
│  Caracteristica: Carregado apenas quando explicitamente pedido  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Regras de Carregamento

| Tier | Quando Carregar | Quando Descartar |
|------|-----------------|------------------|
| **Tier 1** | Sempre presente | Nunca |
| **Tier 2** | Inicio de sessao | Fim de sessao (arquiva) |
| **Tier 3** | Mudanca de task | Quando task completa |
| **Tier 4** | Referencia explicita | Apos uso imediato |

---

## 3. Tier 1: Core State

### 3.1 Objetivo

Manter o foco imediato: "Onde estou e o que acabei de fazer."

### 3.2 Artefato

**Arquivo:** `.claude/plans/features/{name}/memory/core-state.json`

### 3.3 Schema Completo

```json
{
  "$schema": "core-state-v1",
  "version": "1.0",
  "feature": "nome-da-feature",
  "updatedAt": "2026-02-02T11:30:00Z",

  "currentTask": {
    "id": "1.3",
    "name": "Implementar generateFixPrompt",
    "status": "in_progress",
    "startedAt": "2026-02-02T10:30:00Z",
    "files": ["src/commands/feature.ts"],
    "lines": "3273-3325"
  },

  "taskProgress": {
    "total": 5,
    "completed": 2,
    "inProgress": 1,
    "pending": 2,
    "completedIds": ["1.1", "1.2"]
  },

  "criticalDecisions": [
    {
      "id": "dec-001",
      "decision": "Usar 3 iteracoes max para QA fix loop",
      "rationale": "Evita loops infinitos, permite revisao manual",
      "timestamp": "2026-02-02T10:15:00Z"
    }
  ],

  "modifiedFiles": [
    {
      "path": "src/commands/feature.ts",
      "sections": [
        {"name": "QAResult interface", "lines": "90-112"},
        {"name": "parseQAReport method", "lines": "3192-3250"}
      ],
      "lastModified": "2026-02-02T11:00:00Z"
    }
  ],

  "constraints": [
    "NAO criar stubs - implementar logica real",
    "NAO modificar codigo fora do escopo da task",
    "SEMPRE rodar type-check apos modificacoes",
    "SEMPRE atualizar este arquivo apos mudancas"
  ],

  "breadcrumbs": [
    {
      "description": "QA report format",
      "location": "qa-report.md:14",
      "pattern": "Overall Status na linha 14"
    }
  ],

  "blockers": [],

  "nextSteps": [
    "Completar implementacao de generateFixPrompt",
    "Testar com QA report real"
  ]
}
```

### 3.4 Regras de Atualizacao

| Evento | Acao no core-state.json |
|--------|-------------------------|
| Task iniciada | Atualizar `currentTask`, `status: in_progress` |
| Arquivo modificado | Adicionar em `modifiedFiles` com linhas |
| Decisao tomada | Adicionar em `criticalDecisions` (max 5) |
| Task completa | Mover ID para `completedIds`, limpar `currentTask` |
| Erro encontrado | Adicionar em `blockers` |

### 3.5 Tamanho Maximo

**Target:** < 2000 tokens (~1500 palavras)

Se exceder, comprimir `criticalDecisions` para ultimas 3 e `modifiedFiles` para ultimos 5.

---

## 4. Tier 2: Session Context

### 4.1 Objetivo

Historico da sessao atual para recuperacao se contexto estourar.

### 4.2 Artefatos

#### 4.2.1 session-notes.md

**Arquivo:** `.claude/plans/features/{name}/memory/session-notes.md`

```markdown
# Session Notes: {feature-name}
**Session ID:** sess-2026-02-02-001
**Started:** 2026-02-02 10:00
**Last Update:** 2026-02-02 11:30

## Objective
[Objetivo claro e especifico da sessao]

## Progress Timeline

| Time | Action | Result | Notes |
|------|--------|--------|-------|
| 10:00 | Leu plano de implementacao | OK | Entendeu arquitetura |
| 10:15 | Definiu interfaces | OK | Linhas 90-112 |
| 10:30 | Implementou parseQAReport | OK | Linhas 3192-3250 |

## Key Learnings This Session

1. **QA Report Format:** Overall Status esta na linha 14
2. **Dois loops autopilot:** Existem dois metodos que precisam das mesmas modificacoes

## Files Read This Session

- [x] src/commands/feature.ts (completo)
- [x] .claude/plans/features/example/qa-report.md

## Commands Executed

```bash
npm run type-check  # PASS
npm run build       # PASS
```

## Questions/Blockers

Nenhum no momento.

## Next Session Should

1. Criar testes unitarios para parseQAReport
2. Testar integracao com feature real
```

#### 4.2.2 decisions.md

**Arquivo:** `.claude/plans/features/{name}/memory/decisions.md`

```markdown
# Decision Log: {feature-name}

## DEC-001: Numero maximo de iteracoes
**Date:** 2026-02-02
**Status:** Approved

### Context
O loop de correcao pos-QA precisa de um limite.

### Options Considered
1. **3 iteracoes** - Conservador
2. **5 iteracoes** - Mais chances de resolver
3. **Configuravel** - Usuario define

### Decision
Usar **3 iteracoes** como default.

### Rationale
- Evita consumo excessivo de tokens
- Usuario pode revisar e ajustar manualmente
- Pode ser tornado configuravel no futuro

### Consequences
- Positivo: Previne loops infinitos
- Negativo: Pode parar antes de resolver problemas complexos

---

## DEC-002: Estrategia de parsing
**Date:** 2026-02-02
**Status:** Approved

### Context
Precisamos extrair metricas do qa-report.md.

### Options Considered
1. **Regex** - Simples, sem dependencias
2. **Markdown parser** - Mais robusto

### Decision
Usar **Regex** com fallbacks.

### Rationale
- Performance: regex e instantaneo
- Simplicidade: nao adiciona dependencias
```

#### 4.2.3 breadcrumbs.md

**Arquivo:** `.claude/plans/features/{name}/memory/breadcrumbs.md`

```markdown
# Breadcrumbs: {feature-name}

Referencias para re-fetch rapido de informacao.

## Formatos e Patterns

| Item | Localizacao | Pattern/Exemplo |
|------|-------------|-----------------|
| QA Overall Status | qa-report.md:14 | `\| **Overall Status** \| [emoji] **PASS/FAIL** \|` |
| Issue format | qa-report.md | `#### Issue #N: desc (Severity: LEVEL)` |
| File reference | qa-report.md | `**File**: \`path:line\`` |

## Arquivos Importantes

| Proposito | Arquivo | Notas |
|-----------|---------|-------|
| Testes de referencia | tests/utils/task-parser.test.ts | Padrao de testes do projeto |
| Tipos existentes | src/types/feature.ts | Interfaces principais |

## Comandos que Funcionaram

```bash
npm run type-check     # Verificar tipos
npm run build          # Build completo
npm run check          # Lint + format
```
```

---

## 5. Tier 3: Feature Context

### 5.1 Objetivo

Contexto completo da feature, carregado quando necessario.

### 5.2 Conteudo

| Artefato | Quando Carregar |
|----------|-----------------|
| `prd.md` | Inicio de fase Research/Plan |
| `research.md` | Inicio de fase Plan |
| `implementation-plan.md` | Inicio de fase Implement |
| `tasks.md` | Quando precisa ver lista completa |
| Arquivos de codigo | Quando task referencia arquivo |

### 5.3 Estrategia de Carregamento

```typescript
interface Tier3Loading {
  phase: 'research' | 'plan' | 'implement' | 'qa'
  autoLoad: string[]  // Arquivos carregados automaticamente
  onDemand: string[]  // Arquivos carregados quando referenciados
}

const tier3Config: Record<string, Tier3Loading> = {
  research: {
    autoLoad: ['prd.md', 'constraints.md'],
    onDemand: ['CLAUDE.md', 'guidelines.md']
  },
  plan: {
    autoLoad: ['prd.md', 'research.md'],
    onDemand: ['architecture.md', 'patterns.md']
  },
  implement: {
    autoLoad: ['implementation-plan.md', 'current-task-files'],
    onDemand: ['prd.md', 'research.md', 'other-source-files']
  },
  qa: {
    autoLoad: ['implementation-plan.md', 'test-files'],
    onDemand: ['source-files', 'qa-report.md']
  }
}
```

---

## 6. Tier 4: Project Context

### 6.1 Objetivo

Convencoes globais do projeto, raramente necessarias.

### 6.2 Conteudo

- `CLAUDE.md` - Instrucoes globais
- `guidelines.md` - Convencoes de codigo
- `architecture.md` - Arquitetura geral
- Dependencias e integracoes

### 6.3 Quando Carregar

- Explicitamente solicitado pelo agente
- Primeira task de uma nova feature
- Apos erro relacionado a convencoes

---

## 7. Compaction Estruturada

### 7.1 O Problema com Summarization Generica

Summarization generica trata todo conteudo como igualmente comprimivel. Mas um file path pode ser EXATAMENTE o que o agente precisa para continuar.

> "A maior surpresa foi o quanto estrutura importa."
> — Factory.ai

### 7.2 Two-Threshold Architecture

```
Token Count
    │
    │  ┌─────────────────────────── T_max (80% = trigger)
    │  │
    │  │   ← Zona de compressao
    │  │
    │  └─────────────────────────── T_target (50% = pos-compaction)
    │
    │     ← Zona de operacao normal
    │
    └────────────────────────────────────────────────────────────
```

### 7.3 Template de Compaction

```markdown
# COMPACTED_STATE.md

## 1. Session Intent (NUNCA comprimir)
[Objetivo original - preservar EXATAMENTE]

## 2. High-Level Timeline
| Timestamp | Action | Result |
|-----------|--------|--------|
| 10:30 | Criou interface | OK |
| 10:45 | Implementou parser | OK |

## 3. Artifact Trail (file paths CRITICOS)
| File | Operation | Lines |
|------|-----------|-------|
| src/commands/feature.ts | MODIFIED | 3192-3383 |

## 4. Decisions Made
- Usar 3 iteracoes max (evita loops infinitos)
- Parsear com regex (performance)

## 5. Breadcrumbs (referencias para re-fetch)
- qa-report.md:14 contem Overall Status
- Issues seguem padrao: `#### Issue #N`

## 6. Test Results (ultimos)
- type-check: PASS
- build: PASS

## 7. Pending Work
- [ ] Testar com report de 0 issues
- [ ] Verificar edge case: report malformado
```

### 7.4 Regras de Compaction

**NUNCA comprimir:**
- File paths completos
- Numeros de linha
- Nomes de funcoes/variaveis
- Comandos exatos que funcionaram
- Mensagens de erro especificas

**SEMPRE comprimir:**
- Explicacoes redundantes
- Tool outputs ja processados
- Tentativas falhas (manter apenas licao)
- Conversas de clarificacao (manter apenas decisao)

---

## 8. Protocolos Anti-Stub

### 8.1 Por que Agentes Criam Stubs?

1. **Rushing forward:** Agente minimiza esforco, pula leitura
2. **Context overload:** Muita informacao, "esquece" partes
3. **Ambiguidade:** Instrucoes nao claras sobre nivel de detalhe
4. **Falta de feedback:** Sem testes, assume que esta ok

### 8.2 Read Before Write Protocol

```markdown
## MANDATORY: Read First Protocol

ANTES de escrever QUALQUER codigo:

1. **READ** o plano de implementacao
2. **READ** arquivos que serao modificados
3. **EXPLAIN** o que encontrou
4. **PROPOSE** mudancas
5. **IMPLEMENT** (somente apos aprovacao)
```

### 8.3 Anti-Stub Rules

Incluir em TODO prompt de implementacao:

```markdown
## Anti-Stub Rules (OBRIGATORIO)

VOCE NAO PODE:
- [ ] Criar funcoes placeholder (throw new Error('Not implemented'))
- [ ] Deixar TODO comments em lugar de codigo real
- [ ] Criar catch blocks vazios
- [ ] Retornar valores hardcoded para "testar depois"
- [ ] Pular validacao de inputs
- [ ] Implementar apenas o "happy path"

SE NAO CONSEGUIR IMPLEMENTAR COMPLETAMENTE:
1. PARE imediatamente
2. Explique o que esta bloqueando
3. Liste o que precisa para continuar
4. AGUARDE instrucoes
```

### 8.4 One File, One Step Protocol

Previne agente de "rushing forward":

```markdown
## One Step Protocol

CADA iteracao:
1. **READ**: Ler UM arquivo especifico
2. **ANALYZE**: Explicar o que encontrou
3. **EXPLAIN**: Propor UMA mudanca
4. **EDIT**: Modificar APENAS esse arquivo
5. **VERIFY**: Rodar lint/test
6. **STOP**: Aguardar aprovacao
```

### 8.5 TDD Verification Loop

```
┌──────────────────────────────────────────────────────────────┐
│   1. WRITE RED TEST                                          │
│      - Teste que FALHA                                       │
│      - Para o ESTADO DE SUCESSO pretendido                   │
│      - NUNCA editado novamente                               │
│                         │                                    │
│                         ▼                                    │
│   2. IMPLEMENT                                               │
│      - Codigo real (NAO stub)                                │
│      - Minimo para passar o teste                            │
│                         │                                    │
│                         ▼                                    │
│   3. RUN TEST                                                │
│      - GREEN: proximo teste                                  │
│      - RED: voltar para step 2                               │
│                         │                                    │
│                         ▼                                    │
│   4. REFACTOR (opcional)                                     │
└──────────────────────────────────────────────────────────────┘
```

### 8.6 Verification Checklist

Antes de considerar task completa:

```markdown
## Completion Checklist

### Codigo
- [ ] Todas as funcoes tem implementacao real
- [ ] Todos os branches tem tratamento
- [ ] Inputs sao validados
- [ ] Erros tratados com mensagens uteis

### Testes
- [ ] Testes existem para cada funcao publica
- [ ] Happy path testado
- [ ] Edge cases testados
- [ ] Erros testados

### Verificacao
- [ ] Type check passa
- [ ] Lint passa
- [ ] Testes passam
- [ ] Build funciona
```

---

## 9. Hooks de Injecao de Contexto

### 9.1 inject-memory.sh

**Hook:** PreToolUse (qualquer tool)

```bash
#!/bin/bash
# .claude/hooks/inject-memory.sh

set -e

FOCUS_FILE=".claude/active-focus.md"
if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

FEATURE=$(grep "feature:" "$FOCUS_FILE" | cut -d' ' -f2)
if [ -z "$FEATURE" ]; then
  exit 0
fi

MEMORY_PATH=".claude/plans/features/$FEATURE/memory"
CORE_STATE="$MEMORY_PATH/core-state.json"

echo "## Memory Context Injection"
echo ""

if [ -f "$CORE_STATE" ]; then
  echo "### Current State"
  echo '```json'
  cat "$CORE_STATE"
  echo '```'
  echo ""
fi

echo "### Active Constraints"
echo "- NAO criar stubs - implementar logica real"
echo "- NAO modificar codigo fora do escopo"
echo "- SEMPRE rodar type-check apos modificacoes"
echo "- SEMPRE atualizar core-state.json"
echo ""

echo "### Anti-Stub Protocol"
echo "- LEIA arquivos antes de modificar"
echo "- IMPLEMENTE logica real, nunca placeholders"
echo "- TESTE apos cada mudanca"
echo "- PARE e pergunte se algo nao estiver claro"
```

### 9.2 auto-checkpoint.sh

**Hook:** Stop (quando sessao termina)

```bash
#!/bin/bash
# .claude/hooks/auto-checkpoint.sh

set -e

FOCUS_FILE=".claude/active-focus.md"
if [ ! -f "$FOCUS_FILE" ]; then
  exit 0
fi

FEATURE=$(grep "feature:" "$FOCUS_FILE" | cut -d' ' -f2)
if [ -z "$FEATURE" ]; then
  exit 0
fi

MEMORY_PATH=".claude/plans/features/$FEATURE/memory"
CHECKPOINT_PATH=".claude/plans/features/$FEATURE/checkpoints"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$CHECKPOINT_PATH"

CHECKPOINT_FILE="$CHECKPOINT_PATH/checkpoint-$TIMESTAMP.json"

cat > "$CHECKPOINT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "feature": "$FEATURE",
  "coreState": $(cat "$MEMORY_PATH/core-state.json" 2>/dev/null || echo "null"),
  "gitStatus": "$(git status --porcelain 2>/dev/null | head -20)",
  "lastCommit": "$(git log -1 --oneline 2>/dev/null || echo 'none')"
}
EOF

ln -sf "checkpoint-$TIMESTAMP.json" "$CHECKPOINT_PATH/latest.json"

echo "Checkpoint criado: $CHECKPOINT_FILE"
```

### 9.3 validate-no-stub.sh

**Hook:** PreToolUse (Write)

```bash
#!/bin/bash
# .claude/hooks/validate-no-stub.sh

# Verifica se o conteudo sendo escrito contem stubs

CONTENT="$1"

STUB_PATTERNS=(
  "throw new Error.*Not implemented"
  "TODO:"
  "FIXME:"
  "// stub"
  "pass  # stub"
  "NotImplementedError"
)

for pattern in "${STUB_PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -qE "$pattern"; then
    echo "BLOCKED: Stub detectado no codigo"
    echo "Pattern: $pattern"
    echo ""
    echo "Voce DEVE implementar logica real."
    echo "Se nao conseguir, PARE e explique o bloqueio."
    exit 1
  fi
done

exit 0
```

---

## 10. Metricas e KPIs

### 10.1 Metricas de Qualidade

| Metrica | Definicao | Target | Como Medir |
|---------|-----------|--------|------------|
| **Stub Rate** | % de tasks com codigo stub | <5% | Grep patterns |
| **First-Pass Success** | % de tasks que passam QA 1a vez | >70% | qa-report status |
| **Context Drift** | Desvio do objetivo original | Minimo | Comparar output vs task |
| **Rework Rate** | % de codigo refeito | <15% | Git history |

### 10.2 Metricas de Eficiencia

| Metrica | Definicao | Target |
|---------|-----------|--------|
| **Tokens per Task** | Media de tokens por task | Decrescente |
| **Sessions per Feature** | Sessoes para completar | Decrescente |
| **Compaction Efficiency** | Ratio de compressao | >50% |
| **Recovery Success** | % de sessoes recuperadas | >95% |

### 10.3 Metricas de Memoria

| Metrica | Definicao | Target |
|---------|-----------|--------|
| **Core State Freshness** | Idade do core-state.json | <5min |
| **Decision Coverage** | % de decisoes documentadas | >90% |
| **Breadcrumb Accuracy** | % de breadcrumbs corretos | >95% |

### 10.4 Dashboard

```markdown
# Feature Memory Health: {feature-name}

## Current Session
- Duration: 1h 30min
- Tasks Completed: 3/5
- Tokens Used: ~45K
- Compactions: 0

## Memory Status
- Core State: Fresh (2min ago)
- Session Notes: 15 entries
- Decisions: 4 documented
- Checkpoints: 3 available

## Quality Indicators
- Stub Rate: 0%
- Test Coverage: 85%
- Lint Issues: 0

## Warnings
- None
```

---

## 11. Implementacao no ADK

### 11.1 Estrutura de Diretorios

```
.claude/plans/features/{feature-name}/
├── tasks.md
├── implementation-plan.md
├── qa-report.md
│
├── memory/                        # NOVO
│   ├── core-state.json           # Tier 1
│   ├── session-notes.md          # Tier 2
│   ├── decisions.md              # Tier 2
│   ├── breadcrumbs.md            # Tier 2
│   └── archive/                  # Tier 3 (sessoes antigas)
│       ├── session-001.md
│       └── compacted-001.md
│
├── checkpoints/                   # NOVO
│   ├── checkpoint-20260202-113000.json
│   └── latest.json -> checkpoint-xxx.json
│
└── sessions/                      # Existente
    └── session-xxx.json
```

### 11.2 Novos Comandos ADK

```bash
adk memory status <feature>        # Ver estado da memoria
adk memory checkpoint <feature>    # Criar checkpoint manual
adk memory compact <feature>       # Compactar sessao atual
adk memory restore <feature> <id>  # Restaurar de checkpoint
```

### 11.3 Integracao com Implement

O comando `adk feature implement` deve:

1. **Antes de cada task:**
   - Carregar `core-state.json`
   - Injetar constraints anti-stub
   - Carregar arquivos relacionados (Tier 3)

2. **Durante task:**
   - Atualizar `core-state.json` a cada modificacao
   - Registrar decisoes em `decisions.md`
   - Adicionar breadcrumbs quando descobrir patterns

3. **Apos task completa:**
   - Atualizar `session-notes.md`
   - Criar checkpoint se >30min desde ultimo
   - Compactar se contexto >70%

### 11.4 Checklist de Implementacao

**Fase 1: Infraestrutura**
- [ ] Criar estrutura de diretorios memory/
- [ ] Implementar core-state.json schema
- [ ] Criar hook inject-memory.sh
- [ ] Criar hook auto-checkpoint.sh

**Fase 2: Gerenciamento de Sessao**
- [ ] Implementar session-notes.md automatico
- [ ] Criar decisions.md com tracking
- [ ] Implementar breadcrumbs.md

**Fase 3: Compaction**
- [ ] Criar template de compaction estruturada
- [ ] Implementar two-threshold architecture
- [ ] Testar preservacao de informacao critica

**Fase 4: Comandos ADK**
- [ ] `adk memory status`
- [ ] `adk memory checkpoint`
- [ ] `adk memory compact`
- [ ] `adk memory restore`

**Fase 5: Anti-Stub Enforcement**
- [ ] Implementar Read Before Write protocol
- [ ] Criar verification checklist automatico
- [ ] Integrar com QA para detectar stubs

**Fase 6: Metricas**
- [ ] Implementar coleta de metricas
- [ ] Criar dashboard de monitoramento
- [ ] Setup de alertas para degradacao

---

## 12. Garantia de Leitura de Contexto

### 12.1 O Problema

Agentes de IA tendem a:
- Ler apenas 10-20% do contexto disponivel
- Dar mais atencao aos primeiros tokens (attention decay)
- "Inferir" em vez de ler quando contexto e grande
- Nao verificar se entenderam corretamente

### 12.2 Solucao: 5 Camadas de Garantia

```text
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 5: STRATEGIC REDUNDANCY                                 │
│  Info critica aparece em 5+ lugares                             │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 4: COMPREHENSION CHECKPOINT                             │
│  Agente deve responder perguntas antes de implementar           │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 3: CRITICAL INFO FIRST                                  │
│  Constraints e estado atual no INICIO do prompt                 │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 2: PROGRESSIVE LOADING                                  │
│  Carregar apenas o necessario para a task atual                 │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 1: FORCED INJECTION                                     │
│  Hook injeta core-state em TODA operacao                        │
└─────────────────────────────────────────────────────────────────┘
```

### 12.3 Camada 1: Forced Injection

O hook `inject-memory.sh` injeta automaticamente em TODA tool call:

```text
[INJECTED CONTEXT - DO NOT SKIP]

Current Task: 1.3 - Implementar generateFixPrompt
Status: in_progress
Files: src/commands/feature.ts (lines 3273-3325)

Constraints:
- NO stubs - implement real logic
- NO code outside task scope
- ALWAYS run type-check after changes

[END INJECTED CONTEXT]
```

### 12.4 Camada 2: Progressive Loading

Carregar contexto progressivamente baseado na necessidade:

```typescript
interface ProgressiveLoader {
  // Sempre carrega (Tier 1)
  mandatory: ['core-state.json']

  // Carrega no inicio da task
  onTaskStart: ['session-notes.md', 'task-files']

  // Carrega sob demanda via breadcrumbs
  onDemand: {
    'prd-details': 'prd.md',
    'architecture': 'implementation-plan.md',
    'test-patterns': 'tests/*.test.ts'
  }
}
```

**Regra:** Nunca carregar mais de 20K tokens de uma vez.

### 12.5 Camada 3: Critical Info First (CIF)

Estrutura de prompt que coloca informacao critica no inicio:

```markdown
## [CRITICAL - READ FIRST]

### Constraints (MANDATORY)
- NO stubs or placeholder code
- NO modifications outside current task scope
- MUST run type-check after every change

### Current State
- Task: 1.3 - Implementar generateFixPrompt
- Files already modified: src/commands/feature.ts (3192-3250)
- Last decision: Usar regex para parsing (performance)

---

## [TASK DETAILS]

[Detalhes da task aqui...]

---

## [REFERENCE - READ IF NEEDED]

[Documentacao completa disponivel em...]
```

### 12.6 Camada 4: Comprehension Checkpoint

Antes de implementar, agente DEVE responder:

```markdown
## COMPREHENSION CHECKPOINT

Before writing ANY code, answer these questions:

1. **Current Task:** What is the task ID, name, and target files?
2. **Previous Work:** What files were already modified in this session?
3. **Decisions:** What were the last 2 decisions and their rationale?
4. **Constraints:** List the 3 main constraints for this task.
5. **Next Step:** What is the FIRST thing you will do?

### Verification
- [ ] I have read core-state.json
- [ ] I have read session-notes.md
- [ ] I understand the anti-stub rules
- [ ] I know which files to modify

IF YOU CANNOT ANSWER ALL QUESTIONS:
STOP and read the required files before proceeding.
```

### 12.7 Camada 5: Strategic Redundancy

Informacao critica aparece em multiplos lugares:

| Constraint | Onde aparece |
|------------|--------------|
| **NO STUBS** | core-state.json, inject-memory.sh, validate-no-stub.sh, prompt, checklist |
| **Task scope** | core-state.json, session-notes.md, prompt |
| **Modified files** | core-state.json, git status, session-notes.md |
| **Decisions** | core-state.json, decisions.md, breadcrumbs.md |

**Regra:** Constraint critica deve aparecer em no minimo 3 lugares.

### 12.8 Implementacao dos Checkpoints

Hook `comprehension-check.sh` (PreToolUse para Write/Edit):

```bash
#!/bin/bash
# .claude/hooks/comprehension-check.sh

FEATURE=$(grep "feature:" .claude/active-focus.md | cut -d' ' -f2)
CORE_STATE=".claude/plans/features/$FEATURE/memory/core-state.json"

if [ ! -f "$CORE_STATE" ]; then
  exit 0
fi

CURRENT_TASK=$(jq -r '.currentTask.id // "none"' "$CORE_STATE")
MODIFIED_COUNT=$(jq -r '.modifiedFiles | length' "$CORE_STATE")

echo "## COMPREHENSION CHECKPOINT"
echo ""
echo "Before proceeding, confirm you have read the context:"
echo ""
echo "- Current task: $CURRENT_TASK"
echo "- Files already modified: $MODIFIED_COUNT"
echo ""
echo "If this doesn't match your understanding, STOP and read:"
echo "- $CORE_STATE"
echo "- memory/session-notes.md"
```

### 12.9 Metricas de Leitura

| Metrica | Como medir | Target |
|---------|------------|--------|
| **Comprehension accuracy** | Respostas corretas no checkpoint | >95% |
| **Context utilization** | Decisoes que referenciam contexto | >80% |
| **Redundancy coverage** | Constraints em 3+ lugares | 100% |
| **Injection success** | Hook executou sem erro | 100% |

---

## 13. Multi-Agent Parallel Execution

### 13.1 Contexto e Desafios

Pesquisa analisando 200+ execution traces de frameworks multi-agent encontrou:
- **40-80% de taxa de falha** em sistemas multi-agent
- **36.9% das falhas** atribuidas a "inter-agent misalignment"
- Principal causa: falta de memoria compartilhada adequada

> "Memory engineering e a fundacao arquitetural ausente para sistemas multi-agent."
> — MongoDB Engineering Blog

### 13.2 Arquitetura de Memoria Multi-Agent

Baseado no padrao Google ADK e pesquisa academica:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MULTI-AGENT MEMORY ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED MEMORY (Tier 0)                            │   │
│  │  File: .claude/plans/features/{name}/memory/shared-state.json        │   │
│  │                                                                       │   │
│  │  - Feature-level decisions (todos agentes devem conhecer)            │   │
│  │  - Completed tasks (evita trabalho duplicado)                        │   │
│  │  - File ownership (quem esta editando o que)                         │   │
│  │  - Architectural constraints (regras globais)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│         ┌────────────────┼────────────────┬────────────────┐               │
│         ▼                ▼                ▼                ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  AGENT 1    │  │  AGENT 2    │  │  AGENT 3    │  │  AGENT 4    │       │
│  │  Worktree   │  │  Worktree   │  │  Worktree   │  │  Worktree   │       │
│  │             │  │             │  │             │  │             │       │
│  │ core-state  │  │ core-state  │  │ core-state  │  │ core-state  │       │
│  │ -agent-1    │  │ -agent-2    │  │ -agent-3    │  │ -agent-4    │       │
│  │ .json       │  │ .json       │  │ .json       │  │ .json       │       │
│  │             │  │             │  │             │  │             │       │
│  │ session-    │  │ session-    │  │ session-    │  │ session-    │       │
│  │ notes.md    │  │ notes.md    │  │ notes.md    │  │ notes.md    │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AGGREGATOR / MERGE CONTROLLER                     │   │
│  │                                                                       │   │
│  │  1. Coleta resultados de cada agente                                 │   │
│  │  2. Detecta conflitos de decisao                                     │   │
│  │  3. Merge de session-notes em timeline unificada                     │   │
│  │  4. Consolida metricas (stub rate, coverage, etc.)                   │   │
│  │  5. Atualiza shared-state.json                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3 Shared State Schema

```json
{
  "$schema": "shared-state-v1",
  "feature": "feature-name",
  "updatedAt": "ISO8601",

  "agents": {
    "active": ["agent-1", "agent-2", "agent-3"],
    "completed": [],
    "failed": []
  },

  "fileOwnership": {
    "src/models/user.ts": {"agent": "agent-1", "since": "ISO8601"},
    "src/services/auth.ts": {"agent": "agent-2", "since": "ISO8601"}
  },

  "sharedDecisions": [
    {
      "id": "shared-dec-001",
      "decision": "Usar JWT para autenticacao",
      "madeBy": "agent-1",
      "timestamp": "ISO8601",
      "affectsAgents": ["agent-2", "agent-3"]
    }
  ],

  "completedTasks": ["1.1", "1.2", "1.3"],
  "inProgressTasks": {
    "2.1": "agent-1",
    "2.2": "agent-2",
    "2.3": "agent-3"
  },

  "globalConstraints": [
    "NO stubs",
    "Use existing patterns from src/utils/",
    "All services must implement IService interface"
  ],

  "conflicts": [],

  "aggregatedMetrics": {
    "totalTasks": 10,
    "completed": 3,
    "stubRate": 0,
    "avgTokensPerTask": 15000
  }
}
```

### 13.4 Estrategias de Isolamento

Baseado em pesquisa de [Tessl.io](https://tessl.io/blog/how-to-parallelize-ai-coding-agents):

| Estrategia | Isolamento | Mergeabilidade | Quando Usar |
|------------|------------|----------------|-------------|
| **Git Worktrees** | Medio | Facil | Default - maioria dos casos |
| **DevContainers** | Alto | Externa | Tasks com dependencias diferentes |
| **Branches separadas** | Baixo | Manual | Tasks muito simples |

**Recomendacao ADK:** Git Worktrees como padrao.

```text
.worktrees/
├── feature-agent-1/     # Task 2.1
│   └── .claude/plans/features/{name}/memory/
│       ├── core-state-agent-1.json
│       └── session-notes-agent-1.md
├── feature-agent-2/     # Task 2.2
│   └── .claude/plans/features/{name}/memory/
│       ├── core-state-agent-2.json
│       └── session-notes-agent-2.md
└── feature-agent-3/     # Task 2.3
    └── .claude/plans/features/{name}/memory/
        ├── core-state-agent-3.json
        └── session-notes-agent-3.md
```

### 13.5 Comunicacao Entre Agentes

Tres paradigmas identificados na literatura:

| Paradigma | Descricao | Uso no ADK |
|-----------|-----------|------------|
| **Blackboard** | Memoria compartilhada acessivel por todos | `shared-state.json` |
| **Message Passing** | Agentes enviam mensagens diretas | Nao usado (complexo) |
| **Summarizer** | Agente intermediario agrega contexto | Aggregator pos-wave |

**Padrao ADK: Blackboard + Summarizer**

```text
Wave 1 executa:
  Agent 1 ──► atualiza shared-state.json
  Agent 2 ──► atualiza shared-state.json
  Agent 3 ──► atualiza shared-state.json
                       │
                       ▼
              Aggregator executa:
                - Merge decisions
                - Resolve conflicts
                - Update shared-state
                       │
                       ▼
Wave 2 inicia:
  Todos agentes leem shared-state.json atualizado
```

### 13.6 Prevencao de Conflitos

#### Antes da Execucao (Preventivo)

```typescript
interface ConflictPrevention {
  // Analisa tasks.md e detecta conflitos potenciais
  detectPotentialConflicts(tasks: Task[]): Conflict[]

  // Estrategias de resolucao
  strategies: {
    sameFile: 'sequential',      // Mesmo arquivo = sequencial
    sameModule: 'review',        // Mesmo modulo = revisar
    differentModules: 'parallel' // Modulos diferentes = paralelo
  }
}
```

#### Durante a Execucao (File Locking)

```json
// shared-state.json - fileOwnership
{
  "fileOwnership": {
    "src/services/user.ts": {
      "agent": "agent-1",
      "since": "2026-02-02T10:30:00Z",
      "operation": "writing"
    }
  }
}
```

**Regra:** Antes de editar arquivo, agente verifica `fileOwnership`. Se outro agente possui, ESPERA ou ESCALA.

#### Apos a Execucao (Merge Strategy)

Baseado em [Tessl.io](https://tessl.io/blog/how-to-parallelize-ai-coding-agents):

```text
MERGE STRATEGY: Two-Step Reduce

Step 1: Structure-First Merge
  - Normaliza outputs em schema consistente
  - Cada agente produz structured output (JSON)

Step 2: Auto-Dedupe
  - Similarity check (cosine >= 0.9)
  - Remove duplicatas
  - Preserva decisoes unicas
```

### 13.7 Agregacao de Resultados

#### Session Notes Merge

```markdown
# Consolidated Session Notes: feature-name
**Wave:** 2
**Agents:** agent-1, agent-2, agent-3
**Duration:** 45min

## Timeline (Merged)

| Time | Agent | Action | Result |
|------|-------|--------|--------|
| 10:30 | agent-1 | Started Task 2.1 | OK |
| 10:30 | agent-2 | Started Task 2.2 | OK |
| 10:30 | agent-3 | Started Task 2.3 | OK |
| 10:45 | agent-2 | Completed Task 2.2 | OK |
| 10:50 | agent-1 | Completed Task 2.1 | OK |
| 11:00 | agent-3 | Completed Task 2.3 | OK |

## Decisions Made (All Agents)

### By Agent 1
- DEC-001: Usar bcrypt para hash (Task 2.1)

### By Agent 2
- DEC-002: Middleware como classe (Task 2.2)

### By Agent 3
- DEC-003: Validacao com Zod (Task 2.3)

## Conflicts Detected
None

## Files Modified

| File | Agent | Lines |
|------|-------|-------|
| src/services/auth.ts | agent-1 | 1-150 |
| src/middleware/auth.ts | agent-2 | 1-80 |
| src/validators/user.ts | agent-3 | 1-60 |
```

#### Metricas Agregadas

```json
{
  "wave": 2,
  "agents": 3,
  "metrics": {
    "totalTokens": 45000,
    "avgTokensPerAgent": 15000,
    "totalTime": "45min",
    "speedup": "2.1x vs sequential",
    "stubRate": {
      "agent-1": 0,
      "agent-2": 0,
      "agent-3": 0,
      "aggregate": 0
    },
    "testsPassing": {
      "agent-1": 12,
      "agent-2": 8,
      "agent-3": 10,
      "aggregate": 30
    }
  }
}
```

### 13.8 Limites e Best Practices

Baseado em [Addy Osmani](https://addyosmani.com/blog/coding-agents-manager/) e [The Pragmatic Engineer](https://blog.pragmaticengineer.com/new-trend-programming-by-kicking-off-parallel-ai-agents/):

| Limite | Valor | Motivo |
|--------|-------|--------|
| Max agentes simultaneos | 3-4 | Alem disso, merge complexity supera ganhos |
| Max tasks por wave | 4 | Gerenciabilidade |
| Max arquivos por agente | 5 | Foco e qualidade |

**Escala Gradual Recomendada:**
1. Comece com 2 agentes em features bem isoladas
2. Domine o workflow de coordenacao
3. Escale para 4 agentes
4. Nunca exceda 4 sem automacao robusta de merge

**Delegation Framework (3 tiers):**

| Tier | O que delegar | Exemplo |
|------|---------------|---------|
| **Full Delegate** | Implementacao mecanica | Boilerplate, CRUD, testes |
| **Checkpoint** | Interfaces compartilhadas | APIs, contratos |
| **Reserve Human** | Decisoes arquiteturais | Design de sistema |

### 13.9 Recovery e Rollback

```text
SE Agent falha:

1. DETECTAR
   - Timeout (>30min sem progresso)
   - Erro explicito
   - Loop detectado (3x mesmo erro)

2. ISOLAR
   - Marcar agent como "failed" em shared-state
   - NAO afetar outros agentes

3. RECUPERAR
   - Checkpoint do worktree
   - Re-assign task para outro agente OU
   - Marcar task para execucao manual

4. CONTINUAR
   - Outros agentes continuam normalmente
   - Wave completa quando todos (exceto failed) terminam
```

### 13.10 Integracao com Sistema de Memoria v3

| Componente | Single Agent | Multi-Agent |
|------------|--------------|-------------|
| core-state.json | 1 arquivo | 1 por agente + shared-state |
| session-notes.md | 1 arquivo | 1 por agente + consolidated |
| decisions.md | 1 arquivo | 1 por agente + merged |
| checkpoints/ | Por task | Por agente + por wave |

### 13.11 Implementacao no ADK

**Novos arquivos necessarios:**

```text
src/utils/
├── parallel-executor.ts      ✅ Existe
├── wave-scheduler.ts         ✅ Existe
├── wave-executor.ts          ✅ Existe
├── multi-agent/              🆕 Criar
│   ├── shared-state.ts       # Gerencia shared-state.json
│   ├── file-ownership.ts     # Lock de arquivos
│   ├── decision-sync.ts      # Sync de decisoes
│   ├── result-aggregator.ts  # Merge de resultados
│   └── conflict-resolver.ts  # Resolucao de conflitos
```

**Hooks adicionais:**

```bash
# .claude/hooks/check-file-ownership.sh (PreToolUse: Write/Edit)
# Verifica se arquivo esta locked por outro agente

# .claude/hooks/sync-shared-state.sh (PostToolUse)
# Atualiza shared-state.json apos cada operacao

# .claude/hooks/broadcast-decision.sh (PostToolUse: quando decisao tomada)
# Propaga decisao para shared-state
```

---

## 14. Codebase Indexing (Fast Context)

### 14.1 Problema Atual

Sem indexacao, o agente precisa:
- Ler muitos arquivos para entender contexto
- Buscar por glob/grep (nao semantico)
- Nao sabe quais arquivos sao "importantes"
- Recarregar contexto a cada sessao

**Concorrentes que tem:**
- Windsurf: SWE-grep, Fast Context (10x mais rapido)
- Cursor: Codebase indexing com embeddings
- Cline: MCP para contexto profundo

### 14.2 Solucao: Semantic Codebase Index

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CODEBASE INDEXING ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SOURCE FILES                          │   │
│  │  src/**/*.ts, src/**/*.tsx, etc.                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    INDEXER                               │   │
│  │                                                          │   │
│  │  1. Parse AST (funcoes, classes, imports)               │   │
│  │  2. Extract symbols e docstrings                        │   │
│  │  3. Generate embeddings (local ou API)                  │   │
│  │  4. Build dependency graph                              │   │
│  │  5. Calculate file importance scores                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    INDEX STORAGE                         │   │
│  │  .claude/index/                                          │   │
│  │  ├── embeddings.db      # SQLite com vectors            │   │
│  │  ├── symbols.json       # Funcoes, classes, types       │   │
│  │  ├── dependencies.json  # Grafo de imports              │   │
│  │  ├── importance.json    # Score por arquivo             │   │
│  │  └── metadata.json      # Timestamp, stats              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    QUERY ENGINE                          │   │
│  │                                                          │   │
│  │  Input: "authentication logic"                          │   │
│  │  Output: [src/auth/login.ts, src/middleware/auth.ts]    │   │
│  │                                                          │   │
│  │  - Semantic search em embeddings                        │   │
│  │  - Rankeado por importance score                        │   │
│  │  - Retorna contexto minimo necessario                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 14.3 Index Schema

#### symbols.json

```json
{
  "version": "1.0",
  "indexed_at": "2026-02-02T12:00:00Z",
  "files_count": 150,
  "symbols": [
    {
      "name": "authenticateUser",
      "type": "function",
      "file": "src/auth/login.ts",
      "line": 45,
      "signature": "(email: string, password: string) => Promise<User>",
      "docstring": "Authenticates user with email and password",
      "exports": true,
      "complexity": 12
    },
    {
      "name": "AuthMiddleware",
      "type": "class",
      "file": "src/middleware/auth.ts",
      "line": 10,
      "methods": ["verify", "refresh", "logout"],
      "exports": true
    }
  ]
}
```

#### dependencies.json

```json
{
  "version": "1.0",
  "graph": {
    "src/auth/login.ts": {
      "imports": ["src/models/user.ts", "src/utils/hash.ts"],
      "imported_by": ["src/controllers/auth.ts", "src/middleware/auth.ts"]
    },
    "src/models/user.ts": {
      "imports": ["src/types/user.ts"],
      "imported_by": ["src/auth/login.ts", "src/services/user.ts"]
    }
  },
  "clusters": [
    {
      "name": "auth",
      "files": ["src/auth/*", "src/middleware/auth.ts"],
      "entry_point": "src/auth/index.ts"
    }
  ]
}
```

#### importance.json

```json
{
  "version": "1.0",
  "scores": {
    "src/auth/login.ts": {
      "score": 0.95,
      "factors": {
        "imported_by_count": 8,
        "complexity": 12,
        "recent_changes": 3,
        "test_coverage": 0.85
      }
    },
    "src/utils/helpers.ts": {
      "score": 0.3,
      "factors": {
        "imported_by_count": 2,
        "complexity": 3,
        "recent_changes": 0,
        "test_coverage": 0.5
      }
    }
  }
}
```

### 14.4 Comandos ADK

```bash
# Indexar projeto completo
adk index

# Atualizar incrementalmente (apenas arquivos modificados)
adk index --update

# Re-indexar forcado
adk index --force

# Ver status do indice
adk index --status

# Busca semantica
adk search "user authentication"
adk search "error handling in API"

# Encontrar arquivos relacionados a uma task
adk context "Task 2.1: Implementar login"
```

### 14.5 Integracao com Memory System

Quando uma task inicia, o sistema automaticamente:

```typescript
interface TaskContextLoader {
  async loadContextForTask(task: Task): Promise<Context> {
    // 1. Busca semantica pelo nome/descricao da task
    const relevantFiles = await this.index.search(task.description)

    // 2. Expande com dependencias
    const withDeps = await this.index.expandDependencies(relevantFiles)

    // 3. Filtra por importance score
    const filtered = withDeps.filter(f => f.importance > 0.5)

    // 4. Limita tokens
    return this.truncateToTokenLimit(filtered, 20000)
  }
}
```

### 14.6 Atualizacao Incremental

```text
Git Hook (post-commit):
  1. Detectar arquivos modificados
  2. Re-indexar apenas esses arquivos
  3. Atualizar dependency graph
  4. Recalcular importance scores afetados
```

---

## 15. Auto Memories (Captura Automatica)

### 15.1 Problema Atual

Nosso `decisions.md` e manual. Usuario precisa documentar decisoes importantes.

**Concorrentes que tem:**
- Windsurf: Memories automaticas em `~/.codeium/windsurf/memories/`
- Cursor: Project Rules persistentes

### 15.2 Solucao: Auto-Capture de Patterns

```text
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO MEMORIES SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGERS DE CAPTURA:                                          │
│  ─────────────────────                                          │
│  1. Decisao arquitetural detectada                             │
│     "Vou usar X em vez de Y porque..."                         │
│                                                                 │
│  2. Pattern descoberto                                          │
│     "Este projeto usa o padrao X para..."                      │
│                                                                 │
│  3. Constraint identificado                                     │
│     "Nao podemos usar X porque..."                             │
│                                                                 │
│  4. Correcao de erro recorrente                                │
│     "Este erro acontece quando... a solucao e..."              │
│                                                                 │
│  STORAGE:                                                       │
│  ─────────                                                      │
│  .claude/memories/                                              │
│  ├── project.json         # Memorias globais do projeto        │
│  ├── patterns.json        # Padroes descobertos                │
│  ├── decisions.json       # Decisoes arquiteturais             │
│  └── errors.json          # Erros e solucoes conhecidas        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 15.3 Memory Schema

```json
{
  "version": "1.0",
  "project": "adk",
  "memories": [
    {
      "id": "mem-001",
      "type": "pattern",
      "created_at": "2026-02-02T10:30:00Z",
      "source": "session-abc123",
      "trigger": "auto",
      "content": {
        "pattern": "Error handling in services",
        "description": "All services use try/catch with custom AppError class",
        "example_file": "src/services/user.ts:45-60",
        "applies_to": ["src/services/**/*.ts"]
      },
      "confidence": 0.9,
      "used_count": 5
    },
    {
      "id": "mem-002",
      "type": "decision",
      "created_at": "2026-02-02T11:00:00Z",
      "source": "user",
      "trigger": "explicit",
      "content": {
        "decision": "Use Zod for validation instead of Joi",
        "rationale": "Better TypeScript integration, smaller bundle",
        "alternatives_rejected": ["Joi", "Yup"],
        "affects": ["src/validators/**"]
      },
      "confidence": 1.0,
      "used_count": 12
    },
    {
      "id": "mem-003",
      "type": "error_solution",
      "created_at": "2026-02-02T11:30:00Z",
      "source": "auto",
      "trigger": "error_fixed",
      "content": {
        "error": "TypeError: Cannot read property 'id' of undefined",
        "context": "Accessing user.id before auth check",
        "solution": "Always check if user exists before accessing properties",
        "prevention": "Use optional chaining: user?.id"
      },
      "confidence": 0.85,
      "used_count": 3
    }
  ]
}
```

### 15.4 Deteccao Automatica

Hook `auto-memory-capture.sh` (PostToolUse):

```bash
#!/bin/bash
# Analisa output do agente e captura memorias

OUTPUT="$1"

# Detectar decisoes
if echo "$OUTPUT" | grep -qE "(decidi|escolhi|optei por|vou usar).*(porque|pois|devido)"; then
  # Extrair e salvar como decision memory
  adk memory add --type decision --auto
fi

# Detectar patterns
if echo "$OUTPUT" | grep -qE "(este projeto usa|o padrao aqui e|sempre fazemos)"; then
  # Extrair e salvar como pattern memory
  adk memory add --type pattern --auto
fi

# Detectar solucoes de erro
if echo "$OUTPUT" | grep -qE "(o erro era|a solucao foi|corrigi.*alterando)"; then
  # Extrair e salvar como error_solution memory
  adk memory add --type error_solution --auto
fi
```

### 15.5 Comandos ADK

```bash
# Ver todas as memorias
adk memory list

# Adicionar memoria manualmente
adk memory add "Use bcrypt for password hashing" --type decision

# Buscar memorias relevantes
adk memory search "authentication"

# Exportar memorias (para compartilhar com time)
adk memory export > project-memories.json

# Importar memorias
adk memory import < team-memories.json

# Limpar memorias antigas/nao usadas
adk memory prune --unused-days 30
```

### 15.6 Integracao com Context Injection

Memorias relevantes sao injetadas automaticamente:

```typescript
interface MemoryInjector {
  async injectForTask(task: Task): Promise<string> {
    // 1. Buscar memorias relevantes para a task
    const memories = await this.searchMemories(task.description)

    // 2. Filtrar por confidence e usage
    const relevant = memories
      .filter(m => m.confidence > 0.7)
      .sort((a, b) => b.used_count - a.used_count)
      .slice(0, 5)

    // 3. Formatar para injecao
    return this.formatAsContext(relevant)
  }
}
```

Output injetado:

```markdown
## Relevant Memories

### Patterns
- Error handling: All services use try/catch with AppError (confidence: 90%)

### Decisions
- Validation: Use Zod instead of Joi (used 12 times)

### Known Issues
- Always check user exists before accessing user.id
```

---

## 16. Visual Progress UI

### 16.1 Problema Atual

ADK e CLI-only. Dificil acompanhar:
- Multiplos agentes em paralelo
- Progresso de tasks longas
- Arquivos sendo modificados

**Concorrentes que tem:**
- VS 2026: Cloud Agent com UI de progresso
- Cursor: Composer mostra arquivos sendo editados
- Windsurf: Cascade com visualizacao de plano

### 16.2 Solucao: Terminal UI Rico (TUI)

```text
┌─────────────────────────────────────────────────────────────────┐
│  ADK v3 - Feature: user-authentication                    12:45 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROGRESS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 60% (3/5)  │
│                                                                 │
│  AGENTS                          CURRENT TASK                   │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐│
│  │ ● Agent 1  [Task 2.1]   │    │ Task 2.1: Auth Service      ││
│  │   src/services/auth.ts  │    │ Status: implementing        ││
│  │   ████████░░ 80%        │    │ Files: 2 modified           ││
│  │                         │    │ Time: 5m 32s                ││
│  │ ● Agent 2  [Task 2.2]   │    └─────────────────────────────┘│
│  │   src/middleware/auth   │                                   │
│  │   ██████░░░░ 60%        │    RECENT ACTIVITY               │
│  │                         │    ┌─────────────────────────────┐│
│  │ ○ Agent 3  [waiting]    │    │ 12:44 Modified auth.ts:45   ││
│  │                         │    │ 12:43 Created user.test.ts  ││
│  └─────────────────────────┘    │ 12:42 Decision: Use bcrypt  ││
│                                 │ 12:40 Started Task 2.1      ││
│  WAVE 2 of 4                    └─────────────────────────────┘│
│  ━━━━━━━━━━━━━━━ 2/3 agents active                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [p] pause  [r] resume  [l] logs  [d] details  [q] quit        │
└─────────────────────────────────────────────────────────────────┘
```

### 16.3 Implementacao

Usar biblioteca TUI como:
- **Ink** (React para terminal) - recomendado
- **Blessed** (ncurses para Node)
- **Ora** + **Chalk** (ja usamos, expandir)

```typescript
// src/ui/progress-dashboard.tsx (usando Ink)
import { render, Box, Text } from 'ink'

interface DashboardProps {
  feature: string
  agents: AgentStatus[]
  currentTask: Task
  progress: number
  recentActivity: Activity[]
}

const Dashboard: FC<DashboardProps> = (props) => {
  return (
    <Box flexDirection="column">
      <Header feature={props.feature} />
      <ProgressBar value={props.progress} />
      <Box>
        <AgentList agents={props.agents} />
        <TaskDetails task={props.currentTask} />
      </Box>
      <ActivityLog items={props.recentActivity} />
      <Footer />
    </Box>
  )
}
```

### 16.4 Modos de Visualizacao

```bash
# Modo dashboard (TUI interativo)
adk feature autopilot my-feature --ui

# Modo minimal (apenas spinners)
adk feature autopilot my-feature

# Modo verbose (logs completos)
adk feature autopilot my-feature --verbose

# Modo JSON (para integracao)
adk feature autopilot my-feature --json
```

### 16.5 Web Dashboard (Futuro)

```text
┌─────────────────────────────────────────────────────────────────┐
│  ADK Web Dashboard                                              │
│  http://localhost:3333                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Features em Progresso:                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ user-authentication    ████████████░░░░░░░░  60%        │   │
│  │ payment-integration    ██████░░░░░░░░░░░░░░  30%        │   │
│  │ notification-system    ░░░░░░░░░░░░░░░░░░░░  0% (queue) │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Live logs] [Agent details] [Metrics] [Settings]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 16.6 Comandos

```bash
# Iniciar dashboard web
adk dashboard

# Dashboard em porta especifica
adk dashboard --port 8080

# Ver status de todas as features
adk status --all

# Ver status com metricas
adk status --metrics
```

---

## 17. Referencias

### Papers Academicos

1. **Memory in the Age of AI Agents** (Dec 2025)
   - Survey completo sobre memoria em agentes
   - https://arxiv.org/abs/2512.13564

2. **MemGPT: Towards LLMs as Operating Systems** (Oct 2023)
   - Arquitetura de memoria hierarquica
   - https://arxiv.org/abs/2310.08560

3. **Chain of Agents: LLMs Collaborating on Long-Context Tasks** (NeurIPS 2024)
   - Multi-agent para contextos longos

4. **Collaborative Memory: Multi-User Memory Sharing in LLM Agents** (2025)
   - Framework para memoria compartilhada com controle de acesso
   - https://arxiv.org/html/2505.18279v1

5. **Memory in LLM-based Multi-agent Systems: Mechanisms, Challenges** (2024)
   - Survey sobre memoria em sistemas multi-agent
   - https://www.researchgate.net/publication/398392208

### Documentacao Oficial

1. **Anthropic: Effective Context Engineering**
   - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

2. **Anthropic: Effective Harnesses for Long-Running Agents**
   - https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

3. **Google ADK: Architecting Efficient Context-Aware Multi-Agent Framework**
   - Padroes de arquitetura para multi-agent em producao
   - https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/

4. **Google ADK: Parallel Agents Documentation**
   - https://google.github.io/adk-docs/agents/workflow-agents/parallel-agents/

### Artigos Tecnicos

1. **Factory.ai: Compressing Context**
   - https://factory.ai/news/compressing-context

2. **Continue.dev: Task Decomposition**
   - https://blog.continue.dev/task-decomposition/

3. **Augment Code: Best Practices for AI Coding Agents**
   - https://www.augmentcode.com/blog/best-practices-for-using-ai-coding-agents

4. **Tessl.io: How to Parallelize AI Coding Agents**
   - Estrategias de isolamento e merge
   - https://tessl.io/blog/how-to-parallelize-ai-coding-agents

5. **Addy Osmani: Your AI Coding Agents Need a Manager**
   - Padroes de coordenacao e delegation framework
   - https://addyosmani.com/blog/coding-agents-manager/

6. **The Pragmatic Engineer: Programming by Kicking Off Parallel AI Agents**
   - Tendencias e best practices 2025-2026
   - https://blog.pragmaticengineer.com/new-trend-programming-by-kicking-off-parallel-ai-agents/

7. **MongoDB: Why Multi-Agent Systems Need Memory Engineering**
   - Fundacao arquitetural para multi-agent
   - https://medium.com/mongodb/why-multi-agent-systems-need-memory-engineering-153a81f8d5be

8. **JetBrains Research: Smarter Context Management for LLM-Powered Agents**
   - https://blog.jetbrains.com/research/2025/12/efficient-context-management/

9. **Dagger: Containing Agent Chaos with Container Isolation**
   - https://dagger.io/blog/agent-container-use

10. **Git Worktrees for Parallel AI Coding Agents**
    - https://medium.com/@mabd.dev/git-worktrees-the-secret-weapon-for-running-multiple-ai-coding-agents-in-parallel-e9046451eb96

### Ferramentas

1. **Letta (ex-MemGPT)** - https://www.letta.com/
2. **Mem0** - https://mem0.ai/
3. **Container Use MCP** - Isolamento via containers para agentes

---

*Documento atualizado: 2026-02-02*
*Baseado em pesquisa de 25+ fontes academicas e industriais*
