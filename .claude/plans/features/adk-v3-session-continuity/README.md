# ADK v3: Session Continuity System

Sistema de rastreamento e continuidade de sessões do Claude CLI para o ADK v3.

## Problema Resolvido

No ADK v2, cada comando criava uma nova sessão Claude isolada, resultando em perda total de contexto entre fases de desenvolvimento (research → plan → implement → qa → docs). O v3 resolve isso rastreando session IDs e permitindo retomada automática de sessões.

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  CLI v3 Entry Point (cli-v3.ts)                         │
│  ├─ feature status <name>                               │
│  └─ [comandos futuros]                                  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Feature Commands (feature-v3.ts)                       │
│  └─ status: exibe info de sessões                       │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Claude Executor (claude-v3.ts)                         │
│  ├─ executeClaudeCommandV3: spawn assíncrono            │
│  ├─ parseSessionId: extrai session ID                   │
│  └─ executeWithSessionTracking: integração automática   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Session Store (session-store.ts)                       │
│  ├─ save/get/list/update/clear                          │
│  └─ Persistência em .claude/plans/features/{name}/      │
└─────────────────────────────────────────────────────────┘
```

## Como Usar

### 1. Verificar Status de Sessões

```bash
npm run adk3 -- feature status my-feature
```

**Output esperado:**

```
✔ Feature: my-feature

Session Info:
  Current: session-1737897600000-abc123
  Claude ID: claude-xyz789
  Status: active
  Resumable: Yes
  Last Activity: 1/26/2026, 10:30:00 AM
  Model: sonnet

Session History:
  session-1737897600000-abc123 | active | 1/26/2026, 10:00:00 AM
  session-1737883200000-def456 | completed | 1/25/2026, 6:00:00 PM
  ... and 3 more
```

### 2. Executar Claude com Session Tracking (Programático)

```typescript
import { executeWithSessionTracking } from './utils/claude-v3.js'

const result = await executeWithSessionTracking(
  'my-feature',
  'Analyze this codebase and create a plan',
  { model: 'sonnet' }
)

console.log('Session ID:', result.sessionId)
console.log('Output:', result.output)
```

**Comportamento:**
- Se há sessão resumível (< 24h), retoma automaticamente
- Caso contrário, cria nova sessão
- Session ID é extraído e armazenado automaticamente

### 3. Executar Claude Manualmente (Sem Tracking)

```typescript
import { executeClaudeCommandV3 } from './utils/claude-v3.js'

const result = await executeClaudeCommandV3(
  'Review this code for security issues',
  {
    model: 'sonnet',
    resume: 'claude-abc123',  // opcional
    timeout: 600000,          // 10 minutos
    printSessionId: true      // default
  }
)
```

## Estrutura de Persistência

```
.claude/plans/features/{feature-name}/sessions/
├── current.json              # Sessão ativa atual
└── history/
    ├── session-1737897600000-abc123.json
    ├── session-1737883200000-def456.json
    └── session-1737869600000-ghi789.json
```

### Formato de Sessão

```json
{
  "id": "session-1737897600000-abc123",
  "claudeSessionId": "claude-xyz789",
  "feature": "my-feature",
  "startedAt": "2026-01-26T10:00:00.000Z",
  "lastActivity": "2026-01-26T10:30:00.000Z",
  "status": "active",
  "resumable": true,
  "metadata": {
    "model": "sonnet",
    "exitCode": 0,
    "duration": 45000
  }
}
```

## API Reference

### SessionStore

```typescript
class SessionStore {
  // Salva sessão (usa atomic write pattern)
  async save(feature: string, session: SessionInfoV3): Promise<void>

  // Recupera sessão atual
  async get(feature: string): Promise<SessionInfoV3 | null>

  // Alias para get
  async getLatest(feature: string): Promise<SessionInfoV3 | null>

  // Lista histórico (ordenado por data, mais recente primeiro)
  async list(feature: string): Promise<SessionInfoV3[]>

  // Atualiza sessão existente
  async update(
    feature: string,
    sessionId: string,
    updates: Partial<SessionInfoV3>
  ): Promise<void>

  // Remove sessão atual
  async clear(feature: string): Promise<void>

  // Verifica se sessão é resumível (< 24h de inatividade)
  async isResumable(feature: string): Promise<boolean>
}
```

### Claude V3 Executor

```typescript
// Executa comando Claude com captura de session ID
async function executeClaudeCommandV3(
  prompt: string,
  options?: ClaudeV3Options
): Promise<ClaudeV3Result>

// Extrai session ID do output do Claude
function parseSessionId(output: string): string | null

// Executa com tracking e resume automático
async function executeWithSessionTracking(
  feature: string,
  prompt: string,
  options?: ClaudeV3Options
): Promise<ClaudeV3Result>
```

### Tipos

```typescript
interface SessionInfoV3 {
  id: string
  claudeSessionId: string | null
  feature: string
  startedAt: string
  lastActivity: string
  status: 'active' | 'completed' | 'interrupted'
  resumable: boolean
  metadata?: {
    model?: string
    exitCode?: number
    duration?: number
  }
}

interface ClaudeV3Options {
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string
  printSessionId?: boolean
  timeout?: number
  onOutput?: (chunk: string) => void
}

interface ClaudeV3Result {
  output: string
  sessionId: string | null
  exitCode: number
  duration: number
}
```

## Configuração

Nenhuma configuração adicional necessária. O sistema funciona out-of-the-box.

### Variáveis de Ambiente

- `TEST_FEATURE_PATH`: Usado em testes para sobrescrever base path (não use em produção)

## Diferenças do v2

| Aspecto | v2 | v3 |
|---------|----|----|
| Execução Claude | `spawnSync` (síncrono) | `spawn` (assíncrono) |
| Captura de output | Impossível (stdio: inherit) | Completa (stdio: pipe) |
| Session ID | Nunca capturado | Sempre extraído |
| Resume | Impossível | Automático quando aplicável |
| Contexto entre fases | 0% (sessões isoladas) | 100% (sessão contínua) |
| Timeout | Nenhum | Configurável (default 5min) |

## Limitações Conhecidas

1. **Janela de Resume**: Sessões só são resumíveis por 24 horas
2. **Claude CLI Dependency**: Requer Claude CLI com suporte a `--print-session-id` e `--resume`
3. **Isolamento de v2**: CLI v3 é completamente separado - não afeta comandos v2 existentes

## Roadmap

### Sprint 2 (Futuro)
- Prompts diferenciados (Initializer Agent / Coding Agent)
- `feature_list.json` generator
- `init.sh` generator

### Sprint 3 (Futuro)
- Comando `feature work` com loop de desenvolvimento
- Integração com Git (auto-commit, git log reading)

## Testes

```bash
# Rodar testes unitários
npm test -- tests/utils/session-store.test.ts
npm test -- tests/utils/claude-v3.test.ts
npm test -- tests/commands/feature-v3.test.ts

# Verificar cobertura
npm run test:coverage -- --collectCoverageFrom='src/utils/session-store.ts'
npm run test:coverage -- --collectCoverageFrom='src/utils/claude-v3.ts'

# Testes de integração
npm test -- tests/utils/session-integration.test.ts
```

## Troubleshooting

### Sessão não está sendo retomada

Verifique:
1. Session ID foi capturado? `adk3 feature status <name>`
2. Última atividade foi < 24h atrás?
3. Status é `active` e `resumable: true`?

### Session ID não aparece

Verifique:
1. Claude CLI está instalado? `which claude`
2. Claude CLI suporta `--print-session-id`? `claude --help`
3. Check output do Claude contém "Session ID: ..."

### Performance lenta

- SessionStore usa atomic writes (pode ser ~30-50ms por operação)
- Isso é esperado e garante consistência de dados
- Não executa operações de I/O em hot paths

## Contribuindo

Para adicionar novos comandos ao CLI v3:

1. Adicione método em `src/commands/feature-v3.ts`
2. Registre comando em `src/cli-v3.ts`
3. Crie testes em `tests/commands/feature-v3.test.ts`
4. **NUNCA** modifique arquivos v2 (`cli.ts`, `feature.ts`, `claude.ts`)

## Licença

Mesmo que o projeto ADK principal.
