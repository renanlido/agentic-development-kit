# Research: project-management

## Current State Analysis

O ADK atualmente gerencia todo o estado de features localmente através de arquivos markdown na estrutura `.claude/`. Não existe nenhuma integração com plataformas externas de gestão de projetos. O ciclo de vida de uma feature é gerenciado através de:

1. **Estrutura de diretórios**: `.claude/plans/features/<feature-name>/`
2. **Arquivos de estado**: `prd.md`, `tasks.md`, `research.md`, `implementation-plan.md`, `qa-report.md`, `progress.md`
3. **Memória de contexto**: `memory.md` e `.claude/memory/project-context.md`
4. **Foco ativo**: `.claude/active-focus.md`

Não há:
- Sincronização com sistemas externos
- Notificações de mudança de status
- Visibilidade para stakeholders não-técnicos
- Métricas automatizadas de velocity/lead time
- Queue de operações offline
- Sistema de configuração centralizado para integrações

## Similar Components

### 1. Progress Tracking System (`src/utils/progress.ts`)
- Interface `FeatureProgress` com steps e status
- Persiste estado em `progress.md` com formato estruturado
- Status possíveis: `pending`, `in_progress`, `completed`, `failed`
- Funções: `loadProgress`, `saveProgress`, `updateStepStatus`
- **Padrão a seguir**: Parsing/serialização de markdown com frontmatter

### 2. Memory System (`src/utils/memory-utils.ts`, `src/types/memory.ts`)
- Estrutura `MemoryContent` com phases, status, decisions
- Armazena histórico de fases e decisões
- Usa YAML frontmatter + markdown body
- **Padrão a seguir**: Estrutura de dados para contexto persistente

### 3. Decision Utils (`src/utils/decision-utils.ts`)
- Sistema de decisões arquiteturais (ADR)
- Persistência em arquivos markdown individuais
- Busca fuzzy com Fuse.js
- **Padrão a seguir**: Indexação e busca de dados

### 4. Feature Command (`src/commands/feature.ts`)
- Gerencia ciclo de vida completo de features
- Usa `FeatureState` para detecção de fase atual
- Integra com memory, progress, e Claude Code
- **Padrão a seguir**: Estrutura de comando com subcomandos e opções

### 5. Tool Registry (`src/utils/tool-registry.ts`)
- Registry pattern com persistência em JSON
- Busca fuzzy para descoberta
- Cache em memória
- **Padrão a seguir**: Registry pattern para providers

## Technical Stack

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| TypeScript | 5.3.x | Linguagem principal |
| Node.js | >= 18.0.0 | Runtime |
| Commander.js | 14.x | CLI parsing |
| Inquirer | 13.x | Prompts interativos |
| Ora | 9.x | Spinners |
| Chalk | 5.x | Cores no terminal |
| fs-extra | 11.x | Operações de arquivo |
| dotenv | 17.x | Variáveis de ambiente |
| Fuse.js | 7.x | Busca fuzzy |
| Zod | 3.x | Validação de schema |
| simple-git | 3.x | Operações Git |
| Jest | 30.x | Testes |
| Biome | 2.3.x | Lint/Format |

**Para esta feature, será necessário adicionar:**
- `axios` ou usar `fetch` nativo (Node.js 18+) - para requisições HTTP
- Potencialmente `keytar` (opcional) - para armazenamento seguro de credenciais no OS

## Files to Create

### Core Provider System
- [ ] `src/providers/index.ts` - Interface base `ProjectProvider` e factory
- [ ] `src/providers/types.ts` - Tipos compartilhados para providers
- [ ] `src/providers/local.ts` - Provider local (wrapper do comportamento atual)

### ClickUp Provider
- [ ] `src/providers/clickup/index.ts` - Implementação do ClickUp provider
- [ ] `src/providers/clickup/client.ts` - HTTP client para ClickUp API v2
- [ ] `src/providers/clickup/mapper.ts` - Mapeamento ADK ↔ ClickUp
- [ ] `src/providers/clickup/types.ts` - Tipos específicos do ClickUp

### Utilities
- [ ] `src/utils/sync.ts` - Lógica de sincronização bidirecional
- [ ] `src/utils/queue.ts` - Queue para operações offline
- [ ] `src/utils/config.ts` - Gerenciamento de configuração de integração

### Commands
- [ ] `src/commands/config.ts` - Comando `adk config` para configurações
- [ ] `src/commands/sync.ts` - Comando `adk sync` para sincronização

### Types
- [ ] `src/types/provider.ts` - Tipos de provider e sincronização
- [ ] `src/types/clickup.ts` - Tipos da API ClickUp

### Tests
- [ ] `tests/providers/clickup/client.test.ts`
- [ ] `tests/providers/clickup/mapper.test.ts`
- [ ] `tests/utils/sync.test.ts`
- [ ] `tests/utils/queue.test.ts`
- [ ] `tests/commands/config.test.ts`
- [ ] `tests/commands/sync.test.ts`

## Files to Modify

### CLI Registration
- [ ] `src/cli.ts`
  - Adicionar comandos `config` e `sync`
  - Adicionar flags `--no-sync` em `feature new`
  - Adicionar `--remote` em comandos de status

### Feature Command
- [ ] `src/commands/feature.ts`
  - Integrar sync após operações (create, research, plan, implement)
  - Adicionar suporte a `--no-sync` flag
  - Chamar provider.sync() quando configurado

### Progress Utils
- [ ] `src/utils/progress.ts`
  - Adicionar campo `remoteId` e `lastSynced` em `FeatureProgress`
  - Integrar com sistema de sync

### Memory Utils
- [ ] `src/utils/memory-utils.ts`
  - Adicionar metadata de sync em `MemoryContent`

### Types
- [ ] `src/types/memory.ts`
  - Adicionar tipos para sync metadata

### Package.json
- [ ] `package.json`
  - Adicionar dependências (axios ou similar se necessário)

### Templates
- [ ] `templates/claude-structure/settings.json` (se existir)
  - Adicionar configurações default para integration

## Dependencies

### External (npm packages)
| Package | Justificativa | Alternativa |
|---------|--------------|-------------|
| - | Node.js 18+ tem `fetch` nativo | axios se precisar de features avançadas |
| `keytar` (opcional) | Armazenamento seguro de tokens no OS keychain | Usar .env ou arquivo local |
| - | Zod já existe para validação | - |

### Internal (módulos ADK)
| Módulo | Uso |
|--------|-----|
| `src/utils/logger.ts` | Logging consistente |
| `src/utils/paths.ts` | Resolução de caminhos |
| `src/utils/progress.ts` | Base para tracking de sync |
| `src/utils/memory-utils.ts` | Integração com memória |
| `src/types/memory.ts` | Extensão de tipos |
| `src/commands/feature.ts` | Integração com ciclo de feature |

## Risks

### Risk 1: Rate Limiting da API ClickUp
**Impacto**: Alto
**Probabilidade**: Média
**Descrição**: ClickUp limita a 100 requests/minuto por token
**Mitigação**:
- Implementar cache local de dados
- Batching de operações quando possível
- Exponential backoff em retries
- Mostrar warning quando próximo do limite

### Risk 2: Conflitos de Sincronização
**Impacto**: Médio
**Probabilidade**: Alta
**Descrição**: Mudanças simultâneas local e remoto podem conflitar
**Mitigação**:
- Estratégia de resolução configurável (local-wins, remote-wins, manual)
- Timestamp de última sincronização em ambos os lados
- Lock otimista com detecção de conflito
- Log de todas operações para auditoria

### Risk 3: Exposição de Tokens
**Impacto**: Alto
**Probabilidade**: Baixa
**Descrição**: Tokens podem ser commitados acidentalmente
**Mitigação**:
- Nunca armazenar em arquivos versionados
- Usar .env ou .adk-credentials (em .gitignore)
- Validar .gitignore na inicialização
- Warning se token encontrado em arquivo versionado

### Risk 4: Dependência de Conectividade
**Impacto**: Médio
**Probabilidade**: Média
**Descrição**: Operações podem falhar sem internet
**Mitigação**:
- Queue local para operações pendentes
- Todas operações funcionam offline primeiro
- Sync automático ao reconectar (opcional)
- Feedback claro sobre estado de conexão

### Risk 5: Mudanças na API do ClickUp
**Impacto**: Médio
**Probabilidade**: Baixa
**Descrição**: API pode mudar breaking compatibility
**Mitigação**:
- Versionar client de API
- Testes de integração automatizados
- Monitorar changelog do ClickUp
- Arquitetura de provider permite swap fácil

### Risk 6: Complexidade de Mapeamento
**Impacto**: Médio
**Probabilidade**: Média
**Descrição**: Estrutura ADK e ClickUp podem não mapear 1:1
**Mitigação**:
- Começar com mapeamento simples (feature → task)
- Configuração flexível de mapeamento
- Documentação clara de limitações
- Evoluir baseado em feedback real

## Patterns to Follow

### 1. Command Pattern (src/commands/feature.ts:53-375)
```typescript
class ConfigCommand {
  async integration(provider: string, options: IntegrationOptions): Promise<void> {
    const spinner = ora('Configurando integração...').start()
    try {
      // implementation
      spinner.succeed('Integração configurada')
    } catch (error) {
      spinner.fail('Erro ao configurar')
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}
export const configCommand = new ConfigCommand()
```

### 2. Type-safe Options (src/commands/feature.ts:20-33)
```typescript
interface IntegrationOptions {
  provider?: string
  token?: string
  workspace?: string
  space?: string
  autoSync?: boolean
}
```

### 3. Path Resolution (src/utils/paths.ts)
```typescript
export function getConfigPath(): string {
  return path.join(getClaudePath(), 'config.json')
}
```

### 4. Interactive Prompts (src/commands/feature.ts:228-240)
```typescript
const { apiToken } = await inquirer.prompt([
  {
    type: 'password',
    name: 'apiToken',
    message: 'ClickUp API Token:',
    validate: (input) => input.startsWith('pk_') || 'Token deve começar com pk_'
  }
])
```

### 5. Progress/Status Tracking (src/utils/progress.ts)
```typescript
interface SyncStatus {
  provider: string
  remoteId: string
  lastSynced: string
  pendingChanges: SyncChange[]
  status: 'synced' | 'pending' | 'conflict' | 'error'
}
```

### 6. Error Handling with Spinner
```typescript
const spinner = ora('Sincronizando...').start()
try {
  await provider.sync(feature)
  spinner.succeed('Sincronização concluída')
} catch (error) {
  spinner.fail('Erro na sincronização')
  logger.error(error instanceof Error ? error.message : String(error))
  // Don't exit - sync failure shouldn't block local work
}
```

## Performance Considerations

### 1. Operações Não-Bloqueantes
- Sync deve ser assíncrono e não bloquear CLI
- Timeout máximo de 2s para operações individuais
- Background sync para operações longas

### 2. Caching Agressivo
- Cache de dados do ClickUp em memória durante sessão
- Cache de configuração em arquivo local
- Invalidação baseada em TTL ou evento

### 3. Batching de Requisições
- Agrupar múltiplas operações em uma requisição quando possível
- Limitar número de requests paralelos (max 5)
- Queue com rate limiting respeitando 100 req/min

### 4. Lazy Loading
- Não carregar provider até ser necessário
- Validar token apenas quando fazer primeira operação
- Carregar configuração apenas quando necessário

### 5. Minimal Payload
- Enviar apenas campos modificados em updates
- Não sincronizar conteúdo completo de PRD (apenas hash/checksum)
- Comprimir dados grandes se necessário

## Security Considerations

### 1. Armazenamento de Credenciais
- Tokens em variáveis de ambiente (`.env`) ou arquivo ignorado (`.adk-credentials`)
- Nunca em código ou arquivos versionados
- Opção de usar keychain do OS via `keytar`

### 2. Validação de Input
- Validar todos os IDs antes de usar em requisições
- Sanitizar dados antes de enviar para API
- Não confiar em dados vindos da API (validar schema)

### 3. Comunicação Segura
- Apenas HTTPS para todas requisições
- Validar certificados SSL
- Não desabilitar verificação SSL mesmo em dev

### 4. Princípio do Menor Privilégio
- Solicitar apenas permissões necessárias no ClickUp
- Personal Token tem escopo limitado ao usuário
- Não armazenar mais dados que o necessário

### 5. Logging Seguro
- Nunca logar tokens ou credenciais
- Mascarar dados sensíveis em logs
- Log de operações para auditoria (sem dados sensíveis)

### 6. Gitignore Validation
- Verificar se `.env` está em `.gitignore`
- Warning se arquivo de credenciais não está ignorado
- Bloquear operação se risco de exposição

## Architecture Decision Record

### ADR-001: Provider Architecture
**Contexto**: Precisamos suportar ClickUp agora e outras plataformas no futuro.
**Decisão**: Usar padrão Provider com interface abstrata.
**Alternativas consideradas**:
- Implementação direta do ClickUp (descartada por falta de extensibilidade)
- Plugin system completo (over-engineering para MVP)
**Consequências**:
- (+) Fácil adicionar novos providers
- (+) Testabilidade melhorada com mocks
- (-) Overhead de abstração inicial

### ADR-002: Offline-First
**Contexto**: Desenvolvedores podem trabalhar sem internet.
**Decisão**: Todas operações funcionam localmente primeiro, sync é secundário.
**Alternativas consideradas**:
- Online-first com fallback (descartada por UX ruim)
- Sync obrigatório (descartada por dependência de rede)
**Consequências**:
- (+) Nunca bloqueia trabalho local
- (+) Resiliência a falhas de rede
- (-) Complexidade de resolução de conflitos

### ADR-003: Configuration in .claude/
**Contexto**: Onde armazenar configuração de integração?
**Decisão**: `.adk/config.json` (não versionado) + `.env` para secrets.
**Alternativas consideradas**:
- CLAUDE.md (descartada por ser versionado)
- ~/.adk global (descartada por ser per-project)
**Consequências**:
- (+) Configuração por projeto
- (+) Secrets separados de config
- (-) Precisa configurar por projeto

## Implementation Phases

### Phase 1: Foundation (Core)
1. Criar estrutura de diretórios para providers
2. Definir interface `ProjectProvider`
3. Implementar `LocalProvider` (wrapper do comportamento atual)
4. Criar sistema de configuração básico
5. Testes unitários da fundação

### Phase 2: ClickUp Basic
1. Implementar ClickUp HTTP client
2. Autenticação via Personal Token
3. CRUD básico de tasks
4. Mapeamento feature → task
5. Comando `adk config integration clickup`
6. Testes de integração

### Phase 3: Sync System
1. Implementar lógica de sincronização
2. Integrar com `feature create` (auto-sync)
3. Comando `adk sync`
4. Atualização de status em mudanças de fase
5. Custom fields para fase/progresso

### Phase 4: Robustness
1. Queue offline com persistência
2. Detecção e resolução de conflitos
3. Retry com exponential backoff
4. Mensagens de erro amigáveis
5. Logging detalhado

### Phase 5: Polish
1. Importação de projetos existentes
2. `adk status --remote`
3. Métricas de sync
4. Documentação completa
5. Testes E2E

## ClickUp API Reference

### Endpoints Principais
| Operação | Método | Endpoint |
|----------|--------|----------|
| Get Teams | GET | `/v2/team` |
| Get Spaces | GET | `/v2/team/{team_id}/space` |
| Get Lists | GET | `/v2/space/{space_id}/list` |
| Create Task | POST | `/v2/list/{list_id}/task` |
| Update Task | PUT | `/v2/task/{task_id}` |
| Get Task | GET | `/v2/task/{task_id}` |
| Create Subtask | POST | `/v2/list/{list_id}/task` (com parent) |
| Set Custom Field | POST | `/v2/task/{task_id}/field/{field_id}` |

### Headers Necessários
```
Authorization: {api_token}
Content-Type: application/json
```

### Rate Limits
- 100 requests por minuto por token
- 429 Too Many Requests quando exceder
- Header `X-RateLimit-Remaining` disponível

### Task Status Mapping
| ADK Phase | ClickUp Status |
|-----------|----------------|
| prd | to do |
| research | in progress |
| tasks | in progress |
| plan | in progress |
| implement | in progress |
| qa | review |
| docs | complete |
