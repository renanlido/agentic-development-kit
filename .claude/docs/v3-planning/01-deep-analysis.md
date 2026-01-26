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
// ✅ RESPOSTA: NINGUÉM! É código morto.

// Linha 264-287: endSession - CÓDIGO MORTO
async endSession(feature: string, sessionId: string, reason: CheckpointReason): Promise<void> {
  // ...
}
// ✅ RESPOSTA: NINGUÉM! É código morto.

// Linha 289-311: resumeFromSnapshot - CÓDIGO MORTO
async resumeFromSnapshot(feature: string, snapshotId?: string): Promise<UnifiedFeatureState> {
  // ...
}
// ✅ RESPOSTA: NINGUÉM! É código morto.
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
  await executeClaudeCommand(prompt, { model: researchModel })
  // ❌ PROBLEMA: Nova sessão, contexto de PRD perdido
}

// Linha ~550: plan()
async plan(name: string, options: FeatureOptions = {}): Promise<void> {
  await executeClaudeCommand(prompt, { model: planModel })
  // ❌ PROBLEMA: Nova sessão, contexto de research perdido
}

// Linha ~700: implement()
async implement(name: string, options: FeatureOptions): Promise<void> {
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

---

## 5. ANÁLISE: `.claude/hooks/`

### `session-bootstrap.sh`
```bash
#!/bin/bash
ACTIVE_FOCUS=".claude/active-focus.md"
echo "=== ACTIVE CONTEXT ==="
cat "$ACTIVE_FOCUS"
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
cat > "$SNAPSHOT_FILE" <<EOF
{
  "id": "$SNAPSHOT_ID",
  "feature": "$FEATURE",
  "reason": "session_end",
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

## 8. MAPA DE DEPENDÊNCIAS PARA v3

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

## 9. RECOMENDAÇÃO FINAL

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
