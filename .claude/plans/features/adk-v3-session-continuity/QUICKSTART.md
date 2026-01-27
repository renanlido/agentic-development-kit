# ADK v3: Quick Start Guide

Guia rápido para começar a usar ou contribuir com o ADK v3 Session Continuity.

---

## Para Usuários (Testing)

### 1. Build e Setup

```bash
cd agentic-development-kit
npm install
npm run build
```

**Não faça `npm link`!** O v3 é isolado do v2.

### 2. Verificar Instalação

```bash
npm run adk3 -- --version
```

Output esperado:
```
3.0.0-alpha
```

### 3. Verificar Sessões de uma Feature

```bash
npm run adk3 -- feature status my-feature
```

Output esperado:
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
  ... and 2 more
```

Se feature não existir:
```
✖ Feature "my-feature" not found
```

### 4. Uso Programático (Exemplo)

Crie um script de teste:

```typescript
// test-v3.ts
import { executeWithSessionTracking } from './src/utils/claude-v3.js'

async function test() {
  const result = await executeWithSessionTracking(
    'test-feature',
    'Analyze this codebase structure',
    { model: 'sonnet' }
  )

  console.log('Session ID:', result.sessionId)
  console.log('Exit Code:', result.exitCode)
  console.log('Duration:', result.duration, 'ms')
}

test()
```

Execute:
```bash
npx tsx test-v3.ts
```

### 5. Verificar Persistência

```bash
ls -la .claude/plans/features/test-feature/sessions/
```

Você deve ver:
```
current.json
history/
  session-1737897600000-abc123.json
```

Inspecionar sessão:
```bash
cat .claude/plans/features/test-feature/sessions/current.json | jq
```

---

## Para Desenvolvedores (Contributing)

### 1. Setup de Desenvolvimento

```bash
git clone https://github.com/renanlido/agentic-development-kit
cd agentic-development-kit
git checkout feature/adk-v3-session-continuity
npm install
```

### 2. Estrutura de Arquivos v3

```
src/
├── cli-v3.ts                    # Entry point (NÃO modificar cli.ts!)
├── commands/
│   └── feature-v3.ts            # Comandos feature v3
├── types/
│   └── session-v3.ts            # Tipos TypeScript
└── utils/
    ├── claude-v3.ts             # Executor Claude com session tracking
    └── session-store.ts         # Persistência de sessões

tests/
├── commands/
│   └── feature-v3.test.ts
└── utils/
    ├── claude-v3.test.ts
    ├── session-integration.test.ts
    └── session-store.test.ts
```

### 3. Comandos de Desenvolvimento

```bash
# Watch mode (recompila automaticamente)
npm run dev

# Executar v3 em modo dev (sem build)
npm run adk3:dev -- feature status test

# Rodar testes
npm test

# Testes específicos v3
npm test -- tests/utils/session-store.test.ts
npm test -- tests/utils/claude-v3.test.ts
npm test -- tests/commands/feature-v3.test.ts

# Verificar cobertura
npm run test:coverage -- --collectCoverageFrom='src/utils/session-store.ts'

# Lint e format
npm run check:fix

# Type checking
npm run type-check
```

### 4. Workflow TDD Recomendado

```bash
# 1. Criar teste que falha (RED)
vim tests/utils/minha-feature.test.ts

# 2. Rodar teste (deve falhar)
npm test -- tests/utils/minha-feature.test.ts

# 3. Implementar código mínimo (GREEN)
vim src/utils/minha-feature.ts

# 4. Rodar teste (deve passar)
npm test -- tests/utils/minha-feature.test.ts

# 5. Refatorar (REFACTOR)
vim src/utils/minha-feature.ts

# 6. Rodar teste novamente
npm test -- tests/utils/minha-feature.test.ts
```

### 5. Adicionar Novo Comando ao CLI v3

**Exemplo: adicionar `feature clear <name>`**

1. Adicionar método em `src/commands/feature-v3.ts`:

```typescript
async clear(name: string): Promise<void> {
  const spinner = ora(`Clearing sessions for ${name}...`).start()

  try {
    await sessionStore.clear(name)
    spinner.succeed(`Sessions cleared for ${name}`)
  } catch (error) {
    spinner.fail('Error clearing sessions')
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
```

2. Registrar em `src/cli-v3.ts`:

```typescript
feature
  .command('clear <name>')
  .description('Clear all sessions for a feature')
  .action((name) => featureV3Command.clear(name))
```

3. Criar teste em `tests/commands/feature-v3.test.ts`:

```typescript
describe('clear', () => {
  it('should clear sessions for feature', async () => {
    // Arrange
    await sessionStore.save('test-feature', mockSession)

    // Act
    await featureV3Command.clear('test-feature')

    // Assert
    const sessions = await sessionStore.get('test-feature')
    expect(sessions).toBeNull()
  })
})
```

### 6. Checklist Antes de Commit

```bash
# ✅ Build sem erros
npm run build

# ✅ Testes passando
npm test

# ✅ Cobertura >= 80%
npm run test:coverage

# ✅ Lint e format
npm run check:fix

# ✅ Type checking
npm run type-check

# ✅ CRÍTICO: Nenhum arquivo v2 modificado
git diff src/cli.ts
git diff src/commands/feature.ts
git diff src/utils/claude.ts

# ✅ Se todos os checks passaram, commit
git add .
git commit -m "feat(v3): descrição da mudança"
```

### 7. Debugging

#### Session não sendo salva

```typescript
// Adicionar logs em claude-v3.ts
console.log('Session ID capturado:', result.sessionId)
console.log('SessionInfo a salvar:', sessionInfo)
```

#### Testes falhando

```bash
# Rodar teste individual com logs
npm test -- tests/utils/session-store.test.ts --verbose

# Verificar temp dir em testes
ls /tmp/session-test-*
```

#### Session não sendo resumida

```bash
# Verificar sessão atual
cat .claude/plans/features/my-feature/sessions/current.json | jq

# Verificar isResumable
npm run adk3 -- feature status my-feature

# Debug manual
node -e "
const { sessionStore } = require('./dist/utils/session-store.js');
sessionStore.isResumable('my-feature').then(console.log)
"
```

---

## Regras Críticas

### ⛔ PROIBIDO

1. **Modificar arquivos v2**:
   - `src/cli.ts`
   - `src/commands/feature.ts`
   - `src/utils/claude.ts`
   - Qualquer outro arquivo não relacionado a v3

2. **Executar `npm link` durante desenvolvimento**:
   - Use sempre `npm run adk3`

3. **Commits sem testes**:
   - Todo código deve ter >= 80% coverage

4. **Quebrar build**:
   - `npm run build` deve sempre passar

### ✅ OBRIGATÓRIO

1. **Seguir TDD**:
   - RED → GREEN → REFACTOR

2. **Verificar isolamento**:
   - `git diff src/cli.ts` deve estar vazio

3. **Documentar mudanças**:
   - Atualizar README.md da feature
   - Adicionar JSDoc onde necessário
   - Atualizar CHANGELOG.md

4. **Usar convenções de commit**:
   - `feat(v3): descrição`
   - `fix(v3): descrição`
   - `test(v3): descrição`

---

## Exemplos de Uso Avançado

### 1. Custom Timeout

```typescript
const result = await executeClaudeCommandV3(
  'Analyze this large codebase',
  { timeout: 600000 } // 10 minutos
)
```

### 2. Streaming Output

```typescript
const result = await executeClaudeCommandV3(
  'Generate documentation',
  {
    onOutput: (chunk) => {
      console.log('Chunk recebido:', chunk)
      // Processar chunk em tempo real
    }
  }
)
```

### 3. Manual Resume

```typescript
const session = await sessionStore.get('my-feature')
if (session?.claudeSessionId) {
  const result = await executeClaudeCommandV3(
    'Continue previous task',
    { resume: session.claudeSessionId }
  )
}
```

### 4. Session Cleanup Periódico

```typescript
const sessions = await sessionStore.list('my-feature')
const oldSessions = sessions.filter(s => {
  const age = Date.now() - new Date(s.startedAt).getTime()
  return age > 30 * 24 * 60 * 60 * 1000 // > 30 dias
})

for (const session of oldSessions) {
  // Implementar lógica de cleanup
}
```

---

## Troubleshooting

### Erro: "Session not found"

**Causa:** Session ID inválido ou sessão expirada.

**Solução:**
```bash
# Verificar sessões disponíveis
npm run adk3 -- feature status my-feature

# Se necessário, limpar e começar nova sessão
rm .claude/plans/features/my-feature/sessions/current.json
```

### Erro: "Claude command timed out"

**Causa:** Operação demorou > timeout (5min default).

**Solução:**
```typescript
// Aumentar timeout
await executeClaudeCommandV3(prompt, { timeout: 600000 })
```

### Erro: "Feature not found"

**Causa:** Diretório `.claude/plans/features/{name}` não existe.

**Solução:**
```bash
# Criar estrutura básica
mkdir -p .claude/plans/features/my-feature
```

---

## FAQ

**Q: Por que usar `npm run adk3` ao invés de `adk`?**
A: v3 é isolado. `adk` roda v2, `npm run adk3` roda v3.

**Q: Posso usar v2 e v3 simultaneamente?**
A: Sim! São completamente isolados.

**Q: Quando v3 será merged em v2?**
A: Após Sprint 3 completo e validação em produção.

**Q: Como contribuir com v3?**
A: Siga este guia, mantenha testes >= 80%, não modifique v2.

---

## Links Úteis

- [README da Feature](./README.md)
- [PRD](./prd.md)
- [Implementation Plan](./implementation-plan.md)
- [Tasks](./tasks.md)
- [Changelog](./CHANGELOG.md)

---

Happy coding! 🚀
