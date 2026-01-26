# adk-v3-session-continuity Context

Inherits: .claude/memory/project-context.md

## Feature-specific Context

Implementar Sprint 0 e Sprint 1 do ADK v3: criar CLI separado e sistema de session tracking. REGRA CRÍTICA: NÃO modificar src/cli.ts nem src/commands/feature.ts - criar arquivos NOVOS com sufixo -v3. NÃO fazer npm link. Testar com 'npm run adk3'. Ler os 4 documentos da pasta de contexto ANES de começar.

---

# File: 00-MASTER-INDEX.md

# ADK v3 - MASTER INDEX

**Data**: 2026-01-25
**Status**: PLANEJAMENTO COMPLETO - PRONTO PARA IMPLEMENTAÇÃO

---

## ⛔ REGRA MÁXIMA - LER ANTES DE QUALQUER COISA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   🚫  NÃO FAZER `npm link` NO CLI ATUAL                                 │
│   🚫  NÃO MODIFICAR src/cli.ts                                          │
│   🚫  NÃO MODIFICAR src/commands/feature.ts                             │
│                                                                          │
│   ✅  CRIAR src/cli-v3.ts SEPARADO                                      │
│   ✅  TESTAR COM: npm run adk3 -- <comando>                             │
│   ✅  MANTER v2 CONGELADO ATÉ v3 ESTAR 100% VALIDADO                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 DOCUMENTAÇÃO v3 (ESTA PASTA)

### Ordem de Leitura Recomendada:

| # | Documento | O que contém | Ler quando |
|---|-----------|--------------|------------|
| 1 | **03-v3-decisions.md** | Decisões finais, estrutura, sprints | PRIMEIRO - visão geral |
| 2 | 01-deep-analysis.md | Análise linha a linha do código v2 | Entender problemas |
| 3 | 02-long-running-agents-gap.md | Gap vs padrão Anthropic | Entender solução |

### Resumo de Cada Documento:

**03-v3-decisions.md** (LER PRIMEIRO)
- Regras de isolamento do CLI
- O que congelar vs criar
- Estrutura de arquivos v3
- Sprints detalhados
- Como testar sem quebrar v2

**01-deep-analysis.md**
- Análise do `executeClaudeCommand()` - retorna string vazia!
- Análise do `MemoryMCP` - é Fuse.js, não semântico!
- Código morto em `StateManager` - nunca chamado!
- Mapa de dependências

**02-long-running-agents-gap.md**
- Comparação ADK vs Anthropic best practices
- Initializer Agent vs Coding Agent
- Formato `feature_list.json`
- Formato `init.sh`
- Fluxo ideal de sessões

---

## 🎯 RESUMO EXECUTIVO

### Problema Central:
```
v2: Cada fase = nova sessão Claude = 0% contexto mantido
v3: Uma sessão persistente = 95%+ contexto mantido
```

### Solução:
```
1. CLI separado (adk3) para não quebrar v2
2. Detectar primeira sessão → Initializer Agent
3. Sessões subsequentes → Coding Agent
4. Loop até feature_list.json 100% passes
5. Session ID tracking para resume
```

### O que v2 tem que FUNCIONA:
- ✅ Token counting
- ✅ Context compaction
- ✅ Progress tracking
- ✅ Snapshots
- ✅ Retry com backoff
- ✅ Hooks básicos

### O que v2 tem mas NÃO FUNCIONA:
- ❌ MCP Memory (é Fuse.js fuzzy, não semântico)
- ❌ Session management (código existe mas nunca é chamado)
- ❌ Continuidade entre fases (0%)

### O que v3 vai CRIAR:
- 🆕 `src/cli-v3.ts` - Entry point separado
- 🆕 `src/utils/claude-v3.ts` - Com session tracking
- 🆕 `src/utils/session-store.ts` - Persistência
- 🆕 `src/utils/prompts/*.ts` - Prompts diferenciados
- 🆕 `feature_list.json` - Testes estruturados
- 🆕 `init.sh` - Setup automático

---

## 🚀 PRÓXIMOS PASSOS

### Imediato (antes de codar):
```bash
# 1. Ler 03-v3-decisions.md completo
# 2. Tag v2 estável
git tag -a v2.0.0 -m "ADK v2 stable"
git push --tags

# 3. Branch v3
git checkout -b feature/adk-v3

# 4. Criar estrutura vazia
mkdir -p src/utils/prompts
touch src/cli-v3.ts
touch src/commands/feature-v3.ts
# etc...

# 5. Adicionar ao package.json:
# "adk3": "node dist/cli-v3.js"

# 6. NUNCA fazer npm link
```

### Sprint 0-1 (primeira semana):
- Setup básico do CLI v3
- Session store funcional
- Primeiro teste de ponta a ponta

---

## 📁 ARQUIVOS DE BACKUP

Os documentos de análise completos estão em:
```
/home/claude/adk-analysis/
├── 01-INITIAL-ASSESSMENT.md
├── 02-SDK-MIGRATION-ARCHITECTURE.md  # (futuro v4)
├── 03-PRACTICAL-RECOMMENDATIONS.md
├── 04-GAPS-AND-ADDITIONAL-FINDINGS.md
├── 05-LONG-RUNNING-AGENTS-GAP-ANALYSIS.md
├── 06-CONSOLIDATED-ACTION-PLAN.md
├── 07-V3-FINAL-DECISION.md
├── 08-DEEP-LINE-BY-LINE-ANALYSIS.md
└── 09-V3-CONSOLIDATED-DECISIONS.md
```

Transcripts detalhados em:
```
/mnt/transcripts/
├── 2026-01-25-16-06-52-adk-v2-to-v3-transition-analysis.txt
└── 2026-01-25-15-59-08-adk-long-running-agents-analysis.txt
```

---

## ✅ CHECKLIST PRÉ-IMPLEMENTAÇÃO

- [ ] Li 03-v3-decisions.md completo
- [ ] Entendi por que NÃO fazer npm link
- [ ] Tag v2.0.0 criada
- [ ] Branch feature/adk-v3 criada
- [ ] Estrutura de arquivos v3 criada
- [ ] Script adk3 no package.json

---

*Master Index - ADK v3 Planning*
*Última atualização: 2026-01-25*


---

# File: 01-deep-analysis.md

# ADK v2 - Análise Profunda Linha a Linha

**Data**: 2026-01-25
**Status**: ANÁLISE CRÍTICA

---

## 🚨 RESUMO EXECUTIVO

A v2 do ADK tem **código implementado que nunca é usado** e **funcionalidades que parecem existir mas são falsas**:

| Componente | Aparenta Ser | Na Realidade |
|------------|--------------|--------------|
| `MemoryMCP` | Busca semântica com embeddings | Fuse.js fuzzy matching em memória |
| `StateManager.createSession()` | Gerenciamento de sessões | **CÓDIGO MORTO** - nunca chamado |
| `executeClaudeCommand()` | Execução de Claude | Nova sessão cada vez, sem tracking |
| `session-checkpoint.sh` | Recovery de sessões | Cria JSON mas nunca restaura |

---

## 1. ANÁLISE: `src/utils/claude.ts`

```typescript
// Linha 1-6: Imports
import { spawnSync, execSync } from 'node:child_process'
// ❌ PROBLEMA: Ambos são SÍNCRONOS (bloqueantes)
// ❌ FALTA: spawn (assíncrono) para streaming

// Linha 8-10: Interface
export interface ClaudeCommandOptions {
  model?: ModelType
}
// ❌ FALTA: resume?: string    // Para retomar sessão
// ❌ FALTA: sessionId?: string // Para rastrear sessão
// ❌ FALTA: timeout?: number   // Para controle de tempo

// Linha 23-60: executeClaudeCommand
export async function executeClaudeCommand(
  prompt: string,
  options: ClaudeCommandOptions = {}
): Promise<string> {
  // ❌ MENTIRA: Função é "async" mas internamente é SÍNCRONA
  
  // Linha 38-41:
  const args = ['--dangerously-skip-permissions']
  if (validatedModel) {
    args.push('--model', validatedModel)
  }
  // ❌ FALTA: args.push('--resume', sessionId)
  // ❌ FALTA: args.push('--print-session-id')
  
  // Linha 46-50:
  const result = spawnSync('claude', args, {
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'inherit', 'inherit'],  // ❌ output vai pro terminal!
  })
  // ❌ PROBLEMA: spawnSync é BLOCKING
  // ❌ PROBLEMA: stdio inherit = não captura output
  // ❌ PROBLEMA: Não pode cancelar ou fazer timeout
  
  // Linha 58:
  return ''  // ❌ SEMPRE RETORNA STRING VAZIA!
  // ❌ PROBLEMA CRÍTICO: Não retorna output do Claude
  // ❌ PROBLEMA CRÍTICO: Não pode pegar session ID
}
```

### Impacto:
- **Cada chamada de `executeClaudeCommand()` = nova sessão Claude**
- **Impossível retomar sessões**
- **Impossível saber o que Claude fez**
- **Impossível capturar session ID**

---

## 2. ANÁLISE: `src/utils/memory-mcp.ts`

```typescript
// Linha 28-31: Estrutura interna
interface InternalDocument {
  id: string
  content: string
  metadata: Record<string, unknown>
  indexedAt: string
}
// ❌ PROBLEMA: Armazenado em memória, não persistido

// Linha 55-59: Array em memória
private documents: InternalDocument[] = []
// ❌ CRÍTICO: Array JavaScript em memória!
// ❌ CRÍTICO: Perdido quando processo termina!
// ❌ CRÍTICO: Não há persistência em disco!

// Linha 92-95: "Conexão" falsa
private simulateConnection(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 10)  // ❌ MENTIRA: Só espera 10ms
  })
}
// ❌ CRÍTICO: Não conecta a nenhum MCP server real!

// Linha 134-145: "Index"
async index(content: string, metadata: Record<string, unknown>): Promise<IndexResult> {
  // ...
  this.documents.push({  // ❌ Apenas adiciona ao array
    id: documentId,
    content,
    metadata,
    indexedAt: new Date().toISOString(),
  })
}
// ❌ CRÍTICO: Não usa embeddings
// ❌ CRÍTICO: Não persiste em disco
// ❌ CRÍTICO: Não conecta a vector database

// Linha 216: "Busca semântica"
const fuse = new Fuse(this.documents, {
  keys: ['content', 'metadata.source'],
  threshold: 1 - threshold,
  includeScore: true,
})
// ❌ MENTIRA COMPLETA: Fuse.js é fuzzy matching, NÃO é semântico!
// ❌ MENTIRA: Não há embedding model
// ❌ MENTIRA: Não há vector similarity
```

### Impacto:
- **"MCP Memory RAG" é uma MENTIRA**
- **Busca é fuzzy matching, não semântica**
- **Dados são perdidos quando processo termina**
- **Não há integração com nenhum MCP server real**

---

## 3. ANÁLISE: `src/utils/state-manager.ts`

```typescript
// Linha 221-244: createSession - CÓDIGO MORTO
async createSession(feature: string): Promise<string> {
  const sessionId = `session-${year}${month}${day}-${hours}${minutes}${seconds}`
  const session: LongRunningSession = {
    id: sessionId,
    feature,
    startedAt: now.toISOString(),
    // ...
  }
  // Cria arquivo JSON com sessão
  await fs.writeJSON(sessionPath, session, { spaces: 2 })
  return sessionId
}
// ❓ PERGUNTA: Quem chama esse método?
// ✅ RESPOSTA: NINGUÉM! É código morto.

// Linha 246-262: updateSession - CÓDIGO MORTO
async updateSession(
  feature: string,
  sessionId: string,
  updates: Partial<LongRunningSession>
): Promise<void> {
  // ...
}
// ❓ PERGUNTA: Quem chama esse método?
// ✅ RESPOSTA: NINGUÉM! É código morto.

// Linha 264-287: endSession - CÓDIGO MORTO
async endSession(feature: string, sessionId: string, reason: CheckpointReason): Promise<void> {
  // ...
}
// ❓ PERGUNTA: Quem chama esse método?
// ✅ RESPOSTA: NINGUÉM! É código morto.

// Linha 289-311: resumeFromSnapshot - CÓDIGO MORTO
async resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState> {
  // ...
}
// ❓ PERGUNTA: Quem chama esse método?
// ✅ RESPOSTA: NINGUÉM! É código morto.
```

### Verificação de uso:

```bash
# Procurando por chamadas a createSession
grep -r "createSession" src/ --include="*.ts"
# RESULTADO: Apenas a definição em state-manager.ts

# Procurando por chamadas a updateSession  
grep -r "updateSession" src/ --include="*.ts"
# RESULTADO: Apenas a definição em state-manager.ts

# Procurando por chamadas a endSession
grep -r "endSession" src/ --include="*.ts"
# RESULTADO: Apenas a definição em state-manager.ts
```

### Impacto:
- **StateManager tem sistema de sessões COMPLETO mas NUNCA USADO**
- **Código foi escrito mas nunca integrado**
- **Feature "Sessions" é uma mentira funcional**

---

## 4. ANÁLISE: `src/commands/feature.ts`

```typescript
// Linha ~450: research()
async research(name: string, options: FeatureOptions = {}): Promise<void> {
  // ...
  await executeClaudeCommand(prompt, { model: researchModel })
  // ❌ PROBLEMA: Nova sessão, contexto de PRD perdido
}

// Linha ~550: plan()
async plan(name: string, options: FeatureOptions = {}): Promise<void> {
  // ...
  await executeClaudeCommand(prompt, { model: planModel })
  // ❌ PROBLEMA: Nova sessão, contexto de research perdido
}

// Linha ~700: implement()
async implement(name: string, options: FeatureOptions): Promise<void> {
  // ...
  await executeClaudeCommand(prompt, { model: implModel })
  // ❌ PROBLEMA: Nova sessão, contexto de plan perdido
}

// FLUXO REAL:
// adk feature research → Sessão 1 (contexto: PRD)
// adk feature tasks    → Sessão 2 (perdeu contexto de research)
// adk feature plan     → Sessão 3 (perdeu contexto de tasks)
// adk feature implement → Sessão 4 (perdeu contexto de plan)
// adk feature qa       → Sessão 5 (perdeu contexto de implement)
// adk feature docs     → Sessão 6 (perdeu tudo)
// adk feature finish   → Sessão 7 (perdeu tudo)
// 
// RESULTADO: 7 sessões isoladas, 0% de continuidade de contexto
```

### O que deveria acontecer (padrão Anthropic):
```typescript
// PRIMEIRA SESSÃO:
// - Detectar que é primeira vez
// - Rodar Initializer Agent
// - Criar feature_list.json
// - Criar init.sh
// - Commit inicial

// SESSÕES SUBSEQUENTES:
// - Ler claude-progress.txt
// - Ler feature_list.json
// - Rodar git log
// - Rodar init.sh
// - Trabalhar UMA feature
// - Testar e2e
// - Marcar passes: true
// - Commit
// - Repetir até 100%
```

---

## 5. ANÁLISE: `.claude/hooks/`

### `session-bootstrap.sh`
```bash
#!/bin/bash
ACTIVE_FOCUS=".claude/active-focus.md"
# ...
echo "=== ACTIVE CONTEXT ==="
cat "$ACTIVE_FOCUS"

if [ -f "$CONSTRAINTS" ]; then
  echo "=== CONSTRAINTS ==="
  cat "$CONSTRAINTS"
fi
# ❌ PROBLEMA: Apenas imprime arquivos
# ❌ FALTA: Não lê claude-progress.txt
# ❌ FALTA: Não lê feature_list.json
# ❌ FALTA: Não roda git log
# ❌ FALTA: Não verifica ambiente (init.sh)
# ❌ FALTA: Não detecta primeira sessão
```

### `session-checkpoint.sh`
```bash
#!/bin/bash
# ...
cat > "$SNAPSHOT_FILE" <<EOF
{
  "id": "$SNAPSHOT_ID",
  "feature": "$FEATURE",
  "reason": "session_end",
  // ...
}
EOF
# ✅ BOM: Cria snapshot JSON
# ❌ PROBLEMA: Mas quem usa esse snapshot para restaurar?
# ❌ RESPOSTA: NINGUÉM! Hook session-bootstrap.sh não lê isso.
```

---

## 6. O QUE NÃO EXISTE

| Funcionalidade | Status | Referência Anthropic |
|----------------|--------|---------------------|
| Detecção primeira sessão | ❌ NÃO EXISTE | "Different prompt for first vs subsequent" |
| Initializer Agent | ❌ NÃO EXISTE | "First session: setup environment" |
| Coding Agent | ❌ NÃO EXISTE | "Subsequent: incremental work" |
| `feature_list.json` | ❌ NÃO EXISTE | "JSON with pass/fail tests" |
| `init.sh` generator | ❌ NÃO EXISTE | "Auto-generated startup script" |
| Leitura git log no início | ❌ NÃO EXISTE | "Read git log --oneline -10" |
| Loop até 100% passes | ❌ NÃO EXISTE | "Loop until feature_list 100% passes" |
| Browser automation e2e | ❌ NÃO EXISTE | "Puppeteer MCP for testing" |
| Session resume real | ❌ EXISTE MAS NUNCA USADO | "SDK built-in checkpoint/resume" |

---

## 7. CÓDIGO MORTO vs CÓDIGO FUNCIONAL

### ✅ FUNCIONAL (realmente usado):
```
src/utils/token-counter.ts    → Contagem de tokens funciona
src/utils/context-compactor.ts → Compactação funciona
src/utils/progress.ts         → Tracking de fases funciona
src/utils/retry.ts            → Retry com backoff funciona
src/utils/snapshot-manager.ts → Snapshots funcionam
.claude/hooks/*               → Hooks executam (mas são limitados)
```

### ❌ CÓDIGO MORTO (nunca chamado):
```
StateManager.createSession()      → Definido, nunca usado
StateManager.updateSession()      → Definido, nunca usado
StateManager.endSession()         → Definido, nunca usado
StateManager.resumeFromSnapshot() → Definido, nunca usado
StateManager.listSessions()       → Definido, nunca usado
```

### 🎭 MENTIRAS FUNCIONAIS (parece funcionar mas não faz o que diz):
```
MemoryMCP                    → Diz "semantic search", é Fuse.js fuzzy
executeClaudeCommand()       → Diz "async", é sync blocking
session-checkpoint.sh        → Cria checkpoint, mas ninguém restaura
"MCP Memory RAG"             → Marketing, não é RAG real
```

---

## 8. CONCLUSÃO TÉCNICA

### O que a v2 REALMENTE entregou:
1. ✅ Token counting funcional
2. ✅ Context compaction funcional  
3. ✅ Progress tracking por fases
4. ✅ Snapshot creation
5. ✅ Retry com backoff
6. ✅ Sistema de hooks (básico)

### O que a v2 ALEGOU entregar mas não entregou:
1. ❌ MCP Memory RAG → É Fuse.js fuzzy matching
2. ❌ Session management → Código existe mas nunca é chamado
3. ❌ Long-running agent support → Cada fase é sessão nova
4. ❌ Context continuity → 0% de continuidade entre fases

### O que PRECISA ser feito para v3:
1. **INTEGRAR** StateManager sessions (código já existe!)
2. **MODIFICAR** executeClaudeCommand para capturar session ID
3. **CRIAR** detecção primeira sessão
4. **CRIAR** prompts diferenciados (Initializer vs Coding)
5. **CRIAR** feature_list.json generator
6. **CRIAR** init.sh generator
7. **CRIAR** comando `adk feature work` com loop

---

## 9. MAPA DE DEPENDÊNCIAS PARA v3

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE EXECUÇÃO                                │
│                                                                          │
│  executeClaudeCommand() ─────────────────────────────────────────────►  │
│  ❌ Atual: spawnSync, sem session tracking                              │
│  ✅ Precisa: spawn, capturar session ID, suportar --resume              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE SESSÃO                                  │
│                                                                          │
│  StateManager.createSession()  ◄──── EXISTE MAS NÃO USADO!             │
│  StateManager.updateSession()  ◄──── EXISTE MAS NÃO USADO!             │
│  StateManager.endSession()     ◄──── EXISTE MAS NÃO USADO!             │
│                                                                          │
│  ✅ Código pronto, só precisa INTEGRAR                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE AGENTES                                 │
│                                                                          │
│  ❌ Initializer Agent  → NÃO EXISTE, precisa criar                      │
│  ❌ Coding Agent       → NÃO EXISTE, precisa criar                      │
│  ❌ Session Detector   → NÃO EXISTE, precisa criar                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE ARTEFATOS                               │
│                                                                          │
│  ❌ feature_list.json  → NÃO EXISTE, precisa criar                      │
│  ❌ init.sh            → NÃO EXISTE, precisa criar                      │
│  ✅ claude-progress.txt → EXISTE, funciona                              │
│  ✅ progress.md         → EXISTE, funciona                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. RECOMENDAÇÃO FINAL

### Opção A: Integrar código morto + criar faltantes (2-3 semanas)
- Usar StateManager sessions existentes
- Modificar executeClaudeCommand
- Criar Initializer/Coding agents
- Criar feature_list.json generator

### Opção B: Migrar para Claude Agent SDK (4-6 semanas)
- Abandonar implementação TypeScript
- Usar Python SDK oficial
- Aproveitar session management nativo
- Mais trabalho inicial, melhor resultado

### RECOMENDAÇÃO: **Opção A primeiro, Opção B depois**
- v3: Integrar código existente (rápido)
- v4: Migrar para SDK (robusto)

---

*Análise concluída - ADK v2 Deep Dive*


---

# File: 02-long-running-agents-gap.md

# ADK Analysis - Part 5: Long-Running Agents Gap Analysis

**Date**: 2026-01-24
**Source**: [Anthropic Engineering - Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

---

## Executive Summary

O artigo da Anthropic identifica **dois problemas centrais** em long-running agents:

1. **One-shotting**: Agente tenta fazer tudo de uma vez, esgota contexto no meio da implementação
2. **Declaração prematura de vitória**: Agente vê progresso parcial e declara projeto completo

**Solução proposta**: Arquitetura de dois agentes:
- **Initializer Agent**: Configura ambiente na primeira execução
- **Coding Agent**: Faz progresso incremental em cada sessão

---

## Comparação ADK vs Anthropic Best Practices

### 1. Initializer Agent

| Componente | Anthropic Recomenda | ADK Atual | Status |
|------------|---------------------|-----------|--------|
| `init.sh` script | ✅ Script para iniciar dev server | ❌ Não existe | 🔴 Missing |
| `claude-progress.txt` | ✅ Log estruturado de progresso | ✅ Template existe | 🟡 Parcial |
| `feature_list.json` | ✅ Lista de features com status pass/fail | ❌ Não existe | 🔴 Missing |
| Git commit inicial | ✅ Commit com arquivos de setup | ❌ Não automatizado | 🔴 Missing |
| Prompt diferenciado | ✅ Primeiro prompt configura ambiente | ❌ Mesmo prompt sempre | 🔴 Missing |

**O que ADK tem:**
```
templates/claude-progress.txt  # Template existe
src/utils/progress.ts          # Sistema de progresso por fases
src/utils/session-checkpoint.ts # Checkpoint ao fim de sessão
```

**O que falta:**
```
❌ init.sh automático por feature
❌ feature_list.json com tests estruturados
❌ Prompt diferenciado para primeira sessão
❌ Detecção de "é primeira sessão?"
```

---

### 2. Coding Agent (Sessões Subsequentes)

| Comportamento | Anthropic Recomenda | ADK Atual | Status |
|---------------|---------------------|-----------|--------|
| Ler git logs | ✅ `git log --oneline -20` | ❌ Não faz | 🔴 Missing |
| Ler progress file | ✅ Sempre no início | 🟡 Parcial (manual) | 🟡 Parcial |
| Trabalhar UMA feature | ✅ Incremental, uma por vez | 🟡 7 fases, mas re-cria sessão | 🟡 Parcial |
| Testar end-to-end | ✅ Browser automation | ❌ Apenas unit tests sugeridos | 🔴 Missing |
| Commit ao final | ✅ Sempre com mensagem descritiva | ❌ Manual | 🔴 Missing |
| Atualizar progress | ✅ Ao final de cada sessão | ✅ session-checkpoint.sh | 🟢 OK |

**Fluxo Anthropic (ideal):**
```
1. pwd
2. Ler claude-progress.txt
3. Ler feature_list.json
4. git log --oneline -20
5. Rodar init.sh (dev server)
6. Testar funcionalidade básica
7. Escolher UMA feature para trabalhar
8. Implementar
9. Testar end-to-end (browser)
10. Marcar feature como "passes: true"
11. git commit com mensagem descritiva
12. Atualizar claude-progress.txt
```

**Fluxo ADK (atual):**
```
1. executeClaudeCommand(prompt)  # Nova sessão
2. Claude trabalha
3. session-checkpoint.sh salva state.json
4. [FIM - próxima chamada começa do zero]
```

---

### 3. Feature List com Testes

**Formato Anthropic (JSON estruturado):**
```json
{
  "category": "functional",
  "description": "New chat button creates a fresh conversation",
  "steps": [
    "Navigate to main interface",
    "Click the 'New Chat' button",
    "Verify a new conversation is created",
    "Check that chat area shows welcome state",
    "Verify conversation appears in sidebar"
  ],
  "passes": false
}
```

**Formato ADK (Markdown):**
```markdown
# Progress: feature-name

## Steps
- [ ] **prd**
- [~] **research** (started: 2026-01-24)
- [ ] **tasks**
- [ ] **arquitetura**
- [ ] **implementacao**
- [ ] **qa**
- [ ] **docs**
- [ ] **finish**
```

**Gap crítico**: ADK rastreia **fases**, não **features/funcionalidades**.

O artigo diz explicitamente:
> "We use strongly-worded instructions like 'It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality.'"

ADK não tem este mecanismo de proteção.

---

### 4. Testing End-to-End

**Anthropic:**
- Usa Puppeteer MCP para testar como usuário faria
- Tira screenshots para verificar UI
- Só marca feature como "passes" após teste real

**ADK:**
- Sugere TDD mas não enforça
- Não tem integração com browser automation
- QA phase existe mas não usa e2e real

---

### 5. Session Continuity

**Anthropic (SDK + resume):**
```python
# Sessão persiste, agente retoma de onde parou
async with ClaudeSDKClient(options) as client:
    # Mesma sessão, contexto mantido
```

**ADK (CLI subprocess):**
```typescript
// CADA chamada = nova sessão
await executeClaudeCommand(prompt)  // Sessão 1
await executeClaudeCommand(prompt)  // Sessão 2 (sem memória)
```

**Impacto**: Mesmo que ADK salve progress files, o **contexto conversacional** é perdido.

---

## Gaps Prioritários

### 🔴 Crítico (Bloqueia long-running)

| Gap | Descrição | Esforço |
|-----|-----------|---------|
| Session continuity | Cada execução cria nova sessão | Alto |
| Initializer vs Coding prompts | Mesmo prompt para todas as sessões | Médio |
| feature_list.json | Não existe lista estruturada de features | Médio |

### 🟠 Alto (Reduz efetividade)

| Gap | Descrição | Esforço |
|-----|-----------|---------|
| Git log reading | Agente não lê histórico git | Baixo |
| init.sh script | Não tem script de setup automático | Baixo |
| Browser automation | Sem teste e2e real | Médio |

### 🟡 Médio (Nice to have)

| Gap | Descrição | Esforço |
|-----|-----------|---------|
| JSON vs Markdown | Feature list em MD ao invés de JSON | Baixo |
| Auto-commit | Commits não são automáticos | Baixo |

---

## Implementação Proposta

### Fase 1: Initializer Agent

```typescript
// src/commands/feature-v3.ts - NÃO modificar feature.ts atual!

async function initializeFeature(name: string): Promise<void> {
  // 1. Criar feature_list.json
  const featureList = await generateFeatureList(name, prdContent)
  await fs.writeJSON(featurePath('feature_list.json'), featureList)
  
  // 2. Criar init.sh
  const initScript = generateInitScript(name)
  await fs.writeFile(featurePath('init.sh'), initScript)
  await fs.chmod(featurePath('init.sh'), 0o755)
  
  // 3. Criar claude-progress.txt inicial
  const initialProgress = `
CURRENT: Feature "${name}" initialized (0% complete)

DONE:
- Feature environment setup
- Feature list generated with ${featureList.features.length} requirements

IN PROGRESS:
- None

NEXT:
1. Run research phase
2. Generate implementation plan
3. Start TDD implementation

FILES: feature_list.json, init.sh, claude-progress.txt

ISSUES: None blocking
`
  await fs.writeFile(featurePath('claude-progress.txt'), initialProgress)
  
  // 4. Git commit inicial
  await git.add([featurePath('*')])
  await git.commit(`feat(${name}): initialize feature environment`)
}
```

### Fase 2: Coding Agent Prompt

```typescript
// src/utils/prompts/coding-agent.ts

export function buildCodingAgentPrompt(feature: string): string {
  return `
You are a coding agent working on feature "${feature}".

## Session Start Checklist
1. Run \`pwd\` to confirm working directory
2. Read claude-progress.txt to understand current state
3. Read feature_list.json to see remaining features
4. Run \`git log --oneline -10\` to see recent changes
5. Run ./init.sh to start dev environment
6. Test basic functionality before making changes

## Working Rules
- Work on ONE feature at a time from feature_list.json
- Only mark features as "passes": true after end-to-end testing
- NEVER remove or edit test descriptions
- Commit after completing each feature
- Update claude-progress.txt before session ends

## Session End Checklist
1. Ensure all changes are committed
2. Update claude-progress.txt with:
   - CURRENT: what you accomplished
   - DONE: completed features
   - IN PROGRESS: if anything incomplete
   - NEXT: suggested next steps
   - FILES: modified files
   - ISSUES: any blockers

Begin by running the session start checklist.
`
}
```

### Fase 3: Feature List Generator

```typescript
// src/utils/feature-list.ts

interface FeatureTest {
  id: string
  category: 'functional' | 'ui' | 'integration' | 'performance'
  description: string
  steps: string[]
  passes: boolean
  lastTested?: string
}

interface FeatureList {
  feature: string
  createdAt: string
  totalTests: number
  passingTests: number
  tests: FeatureTest[]
}

export async function generateFeatureList(
  featureName: string,
  prdContent: string
): Promise<FeatureList> {
  // Use Claude to extract testable requirements from PRD
  const prompt = `
Analyze this PRD and generate a comprehensive list of testable features.

PRD:
${prdContent}

Output JSON array of features with:
- id: unique identifier
- category: functional|ui|integration|performance
- description: what the feature does
- steps: array of verification steps
- passes: false (all start as failing)

Be comprehensive. Include edge cases. Each feature should be independently testable.
`

  const response = await executeClaudeCommand(prompt, { 
    outputFormat: 'json' 
  })
  
  const tests = JSON.parse(response) as FeatureTest[]
  
  return {
    feature: featureName,
    createdAt: new Date().toISOString(),
    totalTests: tests.length,
    passingTests: 0,
    tests
  }
}
```

### Fase 4: Session Detection

```typescript
// src/utils/session-detector.ts

export async function isFirstSession(feature: string): Promise<boolean> {
  const progressPath = getFeaturePath(feature, 'claude-progress.txt')
  const featureListPath = getFeaturePath(feature, 'feature_list.json')
  
  // Se não existe progress ou feature_list, é primeira sessão
  const progressExists = await fs.pathExists(progressPath)
  const featureListExists = await fs.pathExists(featureListPath)
  
  return !progressExists || !featureListExists
}

export async function getAgentPrompt(feature: string): Promise<string> {
  if (await isFirstSession(feature)) {
    return buildInitializerPrompt(feature)
  }
  return buildCodingAgentPrompt(feature)
}
```

---

## Modificações no Fluxo de Feature

### Antes (ADK atual):

```
feature new    → Cria estrutura básica
feature research → Nova sessão Claude
feature plan     → Nova sessão Claude  
feature implement → Nova sessão Claude
```

### Depois (com long-running):

```
feature new      → Initializer Agent:
                   - Gera feature_list.json
                   - Cria init.sh
                   - Cria claude-progress.txt
                   - Git commit inicial

feature work     → Coding Agent (loop):
                   - Lê progress + git log
                   - Roda init.sh
                   - Trabalha UMA feature
                   - Testa e2e
                   - Commit + update progress
                   - Repete até feature_list completa
```

---

## Exemplo Prático

### feature_list.json para "login-system"

```json
{
  "feature": "login-system",
  "createdAt": "2026-01-24T10:00:00Z",
  "totalTests": 12,
  "passingTests": 0,
  "tests": [
    {
      "id": "login-001",
      "category": "functional",
      "description": "User can enter email and password",
      "steps": [
        "Navigate to /login",
        "Find email input field",
        "Enter valid email",
        "Find password input field",
        "Enter password",
        "Verify inputs retain values"
      ],
      "passes": false
    },
    {
      "id": "login-002",
      "category": "functional",
      "description": "Login button submits credentials",
      "steps": [
        "Fill email and password fields",
        "Click login button",
        "Verify loading state appears",
        "Verify redirect to dashboard on success"
      ],
      "passes": false
    },
    {
      "id": "login-003",
      "category": "ui",
      "description": "Error message shows for invalid credentials",
      "steps": [
        "Enter invalid email/password",
        "Click login button",
        "Verify error message appears",
        "Verify error message is user-friendly"
      ],
      "passes": false
    }
  ]
}
```

### init.sh para "login-system"

```bash
#!/bin/bash
# init.sh - Feature: login-system

echo "🚀 Starting development environment..."

# Start backend
cd backend && npm run dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend
sleep 3

# Start frontend
cd ../frontend && npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend
sleep 5

echo "✅ Environment ready"
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:3000"

# Save PIDs for cleanup
echo "$BACKEND_PID" > .dev-pids
echo "$FRONTEND_PID" >> .dev-pids
```

---

## Métricas de Sucesso

| Métrica | Antes | Depois | Target |
|---------|-------|--------|--------|
| Sessões para completar feature | 7+ (uma por fase) | 1-3 | <5 |
| Features "declaradas completas" prematuramente | ~40% | <5% | <5% |
| Context exhaustion mid-implementation | Frequente | Raro | Nunca |
| Testes end-to-end executados | 0% | 100% | 100% |

---

## Próximos Passos

1. **Imediato**: Implementar `generateFeatureList()` usando PRD
2. **Esta semana**: Criar prompt diferenciado para Initializer vs Coding
3. **Próximas 2 semanas**: Integrar Puppeteer MCP para testes e2e
4. **Mês**: Session continuity com SDK

---

*Artifact created by Claude Opus 4.5 - Long-Running Agents Gap Analysis*


---

# File: 03-v3-decisions.md

# ADK v3 - DOCUMENTO DE DECISÕES CONSOLIDADO

**Data**: 2026-01-25
**Status**: APROVADO PARA IMPLEMENTAÇÃO

---

## ⚠️ REGRA CRÍTICA: ISOLAMENTO DO CLI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🚫 PROIBIDO: NÃO FAZER `npm link` NO CLI ATUAL                        │
│                                                                          │
│  O CLI v2 atual (comando `adk`) DEVE permanecer CONGELADO.              │
│  Qualquer modificação pode quebrar workflows existentes.                │
│                                                                          │
│  ✅ CORRETO: Criar CLI v3 SEPARADO para testes                          │
│     - Novo comando: `adk3` ou `adk-v3`                                   │
│     - Novo entry point: `src/cli-v3.ts`                                  │
│     - Testar isoladamente até estável                                    │
│     - Só depois de validado, migrar para CLI principal                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. DOCUMENTOS DE REFERÊNCIA

### Documentação v3 (esta pasta):
| Doc | Conteúdo |
|-----|----------|
| `00-MASTER-INDEX.md` | Índice e visão geral |
| `01-deep-analysis.md` | Análise linha a linha do código v2 |
| `02-long-running-agents-gap.md` | Gap vs padrão Anthropic |
| `03-v3-decisions.md` | **ESTE DOCUMENTO** - Decisões finais |

### Documentos Históricos (backup em /home/claude/adk-analysis/):
- 01-INITIAL-ASSESSMENT.md
- 02-SDK-MIGRATION-ARCHITECTURE.md (futuro v4)
- 03-PRACTICAL-RECOMMENDATIONS.md
- 04-GAPS-AND-ADDITIONAL-FINDINGS.md
- 05-LONG-RUNNING-AGENTS-GAP-ANALYSIS.md
- 06-CONSOLIDATED-ACTION-PLAN.md
- 07-V3-FINAL-DECISION.md
- 08-DEEP-LINE-BY-LINE-ANALYSIS.md
- 09-V3-CONSOLIDATED-DECISIONS.md

---

## 2. DECISÕES FINAIS

### 2.1 O que MANTER (v2 funcional - CONGELADO):
```
✅ CONGELADO - NÃO MODIFICAR:
├── src/cli.ts                    # CLI atual
├── src/commands/feature.ts       # Comandos atuais
├── src/utils/token-counter.ts    # Funciona
├── src/utils/context-compactor.ts # Funciona
├── src/utils/progress.ts         # Funciona
├── src/utils/retry.ts            # Funciona
├── src/utils/snapshot-manager.ts # Funciona
├── src/utils/state-manager.ts    # Funciona (tem código morto mas OK)
├── .claude/hooks/*               # Funcionam
└── templates/*                   # Funcionam
```

### 2.2 O que CRIAR (v3 novo):
```
🆕 CRIAR NOVOS ARQUIVOS:
├── src/cli-v3.ts                           # Entry point v3 (comando adk3)
├── src/commands/feature-v3.ts              # Comandos v3
├── src/utils/claude-v3.ts                  # executeClaudeCommand com session
├── src/utils/session-store.ts              # Persistência de session IDs
├── src/utils/prompts/
│   ├── initializer-agent.ts                # Prompt primeira sessão
│   └── coding-agent.ts                     # Prompt sessões subsequentes
├── src/utils/feature-list.ts               # Generator feature_list.json
├── src/utils/init-script.ts                # Generator init.sh
└── src/utils/git-context.ts                # Git log reading
```

### 2.3 O que ABORTAR:
```
❌ NÃO FAZER:
- Modificar src/cli.ts atual
- Modificar src/commands/feature.ts atual
- Fazer npm link durante desenvolvimento
- Migrar para Python SDK agora
- Implementar Constitution/Steering
- Completar tarefas pendentes de v2-fase3
```

---

## 3. ESTRUTURA DE ARQUIVOS v3

### 3.1 Nova Estrutura de Feature:
```
.claude/plans/features/{feature-name}/
├── feature_list.json      # 🆕 Lista estruturada de testes
├── init.sh                # 🆕 Script de setup do ambiente
├── claude-progress.txt    # ✅ Já existe
├── progress.md            # ✅ Já existe
├── prd.md                 # ✅ Já existe
├── research.md            # ✅ Já existe
├── tasks.md               # ✅ Já existe
├── implementation-plan.md # ✅ Já existe
├── state.json             # ✅ Já existe
├── sessions/              # 🆕 Histórico de sessões
│   └── session-YYYYMMDD-HHMMSS.json
└── .snapshots/            # ✅ Já existe
```

### 3.2 Formato feature_list.json:
```json
{
  "feature": "minha-feature",
  "version": "1.0.0",
  "created": "2026-01-25T12:00:00Z",
  "tests": [
    {
      "id": "test-001",
      "description": "Usuário pode fazer login com email válido",
      "category": "auth",
      "steps": [
        "Abrir página de login",
        "Inserir email válido",
        "Inserir senha correta",
        "Clicar em entrar",
        "Verificar redirecionamento para dashboard"
      ],
      "passes": false,
      "lastTested": null,
      "evidence": null
    }
  ],
  "summary": {
    "total": 10,
    "passing": 0,
    "failing": 0,
    "pending": 10
  }
}
```

---

## 4. FLUXO v3: Comando Único `adk3 feature work`

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
    │ 1. Gerar PRD    │          │ 1. pwd          │
    │ 2. Gerar        │          │ 2. Ler progress │
    │    feature_list │          │ 3. Ler feature  │
    │ 3. Gerar init.sh│          │    _list        │
    │ 4. Git commit   │          │ 4. git log -20  │
    │ 5. Salvar       │          │ 5. ./init.sh    │
    │    session ID   │          │ 6. Trabalhar 1  │
    └─────────────────┘          │    feature      │
                                 │ 7. Testar e2e   │
                                 │ 8. passes: true │
                                 │ 9. Git commit   │
                                 │ 10. Repetir     │
                                 └─────────────────┘
```

---

## 5. IMPLEMENTAÇÃO POR SPRINTS

### Sprint 0: Setup (1 dia)
- [ ] Criar branch feature/adk-v3
- [ ] Criar src/cli-v3.ts
- [ ] Adicionar script "adk3" no package.json
- [ ] **NÃO fazer npm link**

### Sprint 1: Session Store (3 dias)
- [ ] src/utils/session-store.ts
- [ ] src/utils/claude-v3.ts
- [ ] Testes unitários

### Sprint 2: Dual-Agent Prompts (3 dias)
- [ ] src/utils/prompts/initializer-agent.ts
- [ ] src/utils/prompts/coding-agent.ts
- [ ] src/utils/feature-list.ts
- [ ] src/utils/init-script.ts

### Sprint 3: Comando Work (5 dias)
- [ ] src/commands/feature-v3.ts
- [ ] Loop até 100% passes
- [ ] Integração completa

### Sprint 4: Git Integration (3 dias)
- [ ] src/utils/git-context.ts
- [ ] Auto-commit

### Sprint 5: Migração (2 dias)
- [ ] Testes completos
- [ ] Merge para CLI principal
- [ ] Release v3.0.0

---

## 6. COMO TESTAR

### ❌ ERRADO (PROIBIDO):
```bash
npm run build
npm link           # ← NUNCA durante dev v3
adk feature work   # ← Pode quebrar v2
```

### ✅ CORRETO:
```bash
npm run build
node dist/cli-v3.js feature work my-feature
# ou
npm run adk3 -- feature work my-feature
```

### Package.json (adicionar):
```json
{
  "scripts": {
    "adk3": "node dist/cli-v3.js",
    "adk3:dev": "ts-node src/cli-v3.ts"
  }
}
```

---

## 7. CRITÉRIOS DE SUCESSO

| Métrica | v2 Atual | v3 Target |
|---------|----------|-----------|
| Sessões por feature | 7+ | 1-3 |
| Contexto entre fases | ~0% | >95% |
| Conclusão prematura | ~40% | <5% |
| Recovery após crash | Manual | <30s |

---

## 8. PRÓXIMOS PASSOS

```bash
# 1. Tag v2 estável
git tag -a v2.0.0 -m "ADK v2 - Stable before v3"
git push --tags

# 2. Branch v3
git checkout -b feature/adk-v3

# 3. Criar estrutura
mkdir -p src/utils/prompts
touch src/cli-v3.ts
touch src/commands/feature-v3.ts
touch src/utils/claude-v3.ts
touch src/utils/session-store.ts
touch src/utils/prompts/initializer-agent.ts
touch src/utils/prompts/coding-agent.ts
touch src/utils/feature-list.ts
touch src/utils/init-script.ts

# 4. NUNCA:
# npm link  ← PROIBIDO até v3 validado
```

---

*Documento consolidado - ADK v3 Final*


## Dependencies

[Liste dependências externas e internas]

## Related Files

[Liste arquivos relacionados para referência]
