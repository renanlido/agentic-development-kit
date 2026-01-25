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
