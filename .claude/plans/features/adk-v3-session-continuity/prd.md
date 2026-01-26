# PRD: adk-v3-session-continuity

**Data:** 2026-01-25
**Status:** Draft
**Autor:** Auto-generated
**Sprints:** 0 e 1 (Setup + Session Store)

---

## 1. Problema

### 1.1 Contexto Atual (ADK v2)

O ADK v2 possui um problema crítico de **perda total de contexto entre fases** de desenvolvimento de features. Atualmente:

| Problema | Impacto |
|----------|---------|
| Cada chamada de `executeClaudeCommand()` cria uma **nova sessão** Claude | 0% de continuidade de contexto |
| A função usa `spawnSync` (síncrono e bloqueante) | Impossível capturar output ou session ID |
| `stdio: ['pipe', 'inherit', 'inherit']` envia output para terminal | Função sempre retorna string vazia |
| Não há suporte para `--resume` ou `--print-session-id` | Impossível retomar sessões |

### 1.2 Fluxo Atual (Problemático)

```
adk feature research → Sessão 1 (contexto: PRD)
adk feature tasks    → Sessão 2 (perdeu contexto de research)
adk feature plan     → Sessão 3 (perdeu contexto de tasks)
adk feature implement → Sessão 4 (perdeu contexto de plan)
adk feature qa       → Sessão 5 (perdeu contexto de implement)
adk feature docs     → Sessão 6 (perdeu tudo)
adk feature finish   → Sessão 7 (perdeu tudo)

RESULTADO: 7 sessões isoladas, 0% de continuidade de contexto
```

### 1.3 Código Morto Existente

A análise revelou que o `StateManager` possui métodos de gerenciamento de sessão que **nunca são chamados**:

- `StateManager.createSession()` - DEFINIDO mas nunca usado
- `StateManager.updateSession()` - DEFINIDO mas nunca usado
- `StateManager.endSession()` - DEFINIDO mas nunca usado
- `StateManager.resumeFromSnapshot()` - DEFINIDO mas nunca usado

### 1.4 Problema com `executeClaudeCommand()`

```typescript
const result = spawnSync('claude', args, {
  input,
  encoding: 'utf-8',
  stdio: ['pipe', 'inherit', 'inherit'],  // ❌ output vai pro terminal!
})
return ''  // ❌ SEMPRE RETORNA STRING VAZIA!
```

**Consequências:**
- Impossível capturar session ID do Claude
- Impossível retomar sessões interrompidas
- Impossível saber o que Claude fez/respondeu

---

## 2. Solução Proposta

### 2.1 Abordagem de Isolamento

Criar um **CLI v3 completamente separado** para desenvolvimento e testes, mantendo v2 congelado:

```
⛔ PROIBIDO:
- Modificar src/cli.ts
- Modificar src/commands/feature.ts
- Fazer npm link durante desenvolvimento

✅ CORRETO:
- Criar src/cli-v3.ts (entry point separado)
- Testar com: npm run adk3 -- <comando>
- Manter v2 congelado até v3 validado
```

### 2.2 Componentes da Solução (Sprint 0 + Sprint 1)

#### Sprint 0: Setup do CLI Separado
- Criar `src/cli-v3.ts` como entry point
- Adicionar script `"adk3"` no package.json
- Criar estrutura de arquivos v3

#### Sprint 1: Sistema de Session Tracking
- Criar `src/utils/session-store.ts` para persistência de session IDs
- Criar `src/utils/claude-v3.ts` com suporte a `--resume` e `--print-session-id`
- Testes unitários completos

### 2.3 Arquitetura da Solução

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE EXECUÇÃO v3                             │
│                                                                          │
│  executeClaudeCommandV3() ─────────────────────────────────────────────► │
│  ✅ spawn (assíncrono)                                                   │
│  ✅ Captura session ID via --print-session-id                           │
│  ✅ Suporta --resume para retomar sessões                               │
│  ✅ Captura output do Claude                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SESSION STORE                                     │
│                                                                          │
│  SessionStore.save(feature, sessionId)                                  │
│  SessionStore.get(feature) → sessionId | null                           │
│  SessionStore.list(feature) → SessionInfo[]                             │
│  SessionStore.clear(feature)                                            │
│                                                                          │
│  Persistido em: .claude/plans/features/{name}/sessions/                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Requisitos Funcionais

### Sprint 0: Setup

- **RF01:** Criar arquivo `src/cli-v3.ts` como entry point separado do CLI v3
  - Deve usar Commander.js consistente com v2
  - Deve registrar comandos do `feature-v3.ts`
  - Deve ser executável via `npm run adk3`

- **RF02:** Criar arquivo `src/commands/feature-v3.ts` com comandos básicos
  - Comando `feature status <name>` para verificar estado
  - Estrutura preparada para receber comando `work` futuramente

- **RF03:** Adicionar script no package.json
  ```json
  {
    "scripts": {
      "adk3": "node dist/cli-v3.js",
      "adk3:dev": "ts-node src/cli-v3.ts"
    }
  }
  ```

- **RF04:** Criar estrutura de diretórios para v3
  ```
  src/
  ├── cli-v3.ts
  ├── commands/
  │   └── feature-v3.ts
  └── utils/
      └── prompts/          # Para sprints futuros
  ```

### Sprint 1: Session Store

- **RF05:** Criar `src/utils/session-store.ts` com interface:
  ```typescript
  interface SessionInfo {
    id: string
    feature: string
    startedAt: string
    lastActivity: string
    status: 'active' | 'completed' | 'interrupted'
    resumable: boolean
  }

  class SessionStore {
    async save(feature: string, session: SessionInfo): Promise<void>
    async get(feature: string): Promise<SessionInfo | null>
    async getLatest(feature: string): Promise<SessionInfo | null>
    async list(feature: string): Promise<SessionInfo[]>
    async update(feature: string, sessionId: string, updates: Partial<SessionInfo>): Promise<void>
    async clear(feature: string): Promise<void>
  }
  ```

- **RF06:** Persistir sessões em arquivo JSON por feature:
  ```
  .claude/plans/features/{feature-name}/sessions/
  ├── current.json           # Sessão ativa
  └── history/
      └── session-YYYYMMDD-HHMMSS.json
  ```

- **RF07:** Criar `src/utils/claude-v3.ts` com nova implementação:
  ```typescript
  interface ClaudeV3Options {
    model?: ModelType
    resume?: string        // Session ID para retomar
    printSessionId?: boolean
    timeout?: number
  }

  interface ClaudeV3Result {
    output: string
    sessionId: string | null
    exitCode: number
  }

  async function executeClaudeCommandV3(
    prompt: string,
    options: ClaudeV3Options
  ): Promise<ClaudeV3Result>
  ```

- **RF08:** Implementar captura de session ID:
  - Usar flag `--print-session-id` do Claude CLI
  - Parsear output para extrair session ID
  - Armazenar no SessionStore automaticamente

- **RF09:** Implementar suporte a resume:
  - Quando `options.resume` fornecido, usar `--resume <sessionId>`
  - Validar se sessão existe antes de tentar retomar
  - Retornar erro claro se sessão não existir ou não for resumível

- **RF10:** Usar `spawn` ao invés de `spawnSync`:
  - Execução assíncrona real
  - Captura de stdout e stderr
  - Suporte a timeout configurável
  - Possibilidade de cancelamento

---

## 4. Requisitos Não-Funcionais

- **RNF01: Isolamento**
  - v3 DEVE funcionar independentemente de v2
  - Nenhuma modificação em arquivos v2 existentes
  - Testes devem rodar com `npm run adk3`, não `npm link`

- **RNF02: Performance**
  - SessionStore deve ler/escrever em < 50ms para operações individuais
  - Não deve haver overhead significativo na execução de comandos

- **RNF03: Compatibilidade**
  - Deve funcionar com Node.js >= 18.0.0
  - Deve usar mesmas dependências do v2 (Commander.js v14, fs-extra v11)

- **RNF04: Persistência**
  - Sessions devem sobreviver a reinícios do terminal
  - Formato JSON para facilitar inspeção manual
  - Histórico de sessões mantido para debugging

- **RNF05: Recuperação**
  - Sistema deve detectar sessões interrompidas
  - Deve permitir resume de sessões dentro de janela de tempo (24h sugerido)
  - Sessões antigas devem ser marcadas como não-resumíveis

- **RNF06: Testabilidade**
  - Cobertura mínima de 80% para novos arquivos
  - SessionStore deve ser mockável para testes
  - Testes não devem depender de Claude CLI real

---

## 5. User Stories

### US01: Desenvolvedor cria CLI v3 isolado
**Como** desenvolvedor do ADK
**Quero** criar um CLI v3 separado do v2
**Para** desenvolver e testar novas funcionalidades sem quebrar workflows existentes

**Critérios de Aceitação:**
- [ ] `npm run build` compila `cli-v3.ts` sem erros
- [ ] `npm run adk3 -- --version` exibe versão do CLI
- [ ] `npm run adk3 -- --help` exibe ajuda
- [ ] `src/cli.ts` permanece inalterado
- [ ] `src/commands/feature.ts` permanece inalterado

### US02: Sistema armazena session IDs
**Como** sistema ADK v3
**Quero** persistir session IDs do Claude
**Para** permitir retomada de sessões interrompidas

**Critérios de Aceitação:**
- [ ] SessionStore salva sessão com feature, ID, timestamps e status
- [ ] SessionStore recupera última sessão de uma feature
- [ ] SessionStore lista histórico de sessões
- [ ] Dados persistem em `.claude/plans/features/{name}/sessions/`
- [ ] Formato JSON é legível por humanos

### US03: Comando Claude captura session ID
**Como** sistema ADK v3
**Quero** capturar session ID do Claude CLI
**Para** armazenar e usar em futuras retomadas

**Critérios de Aceitação:**
- [ ] `executeClaudeCommandV3` usa `--print-session-id`
- [ ] Output do Claude é capturado corretamente
- [ ] Session ID é extraído do output
- [ ] Session ID é salvo automaticamente no SessionStore
- [ ] Função retorna objeto com output, sessionId e exitCode

### US04: Comando Claude suporta resume
**Como** sistema ADK v3
**Quero** retomar sessões Claude anteriores
**Para** manter contexto entre execuções

**Critérios de Aceitação:**
- [ ] `executeClaudeCommandV3` aceita opção `resume`
- [ ] Quando resume fornecido, usa `--resume <sessionId>`
- [ ] Erro claro se sessão não existir
- [ ] Erro claro se sessão não for resumível
- [ ] Sessão retomada atualiza `lastActivity` no store

### US05: Desenvolvedor verifica sessões de feature
**Como** desenvolvedor
**Quero** ver sessões de uma feature
**Para** debugar e entender estado atual

**Critérios de Aceitação:**
- [ ] `npm run adk3 -- feature status <name>` mostra sessões
- [ ] Lista inclui: ID, data início, última atividade, status
- [ ] Indica qual sessão é resumível
- [ ] Funciona mesmo se feature não tiver sessões

---

## 6. Escopo

### 6.1 Incluído (Sprint 0 + Sprint 1)

**Sprint 0:**
- Criar `src/cli-v3.ts` entry point
- Criar `src/commands/feature-v3.ts` básico
- Adicionar scripts npm para adk3
- Criar estrutura de diretórios

**Sprint 1:**
- Implementar `src/utils/session-store.ts`
- Implementar `src/utils/claude-v3.ts`
- Testes unitários para ambos
- Comando `feature status` mostrando sessões

### 6.2 Excluído (Out of Scope - Sprints Futuros)

- ❌ Prompts diferenciados (Initializer Agent / Coding Agent) - Sprint 2
- ❌ `feature_list.json` generator - Sprint 2
- ❌ `init.sh` generator - Sprint 2
- ❌ Comando `feature work` com loop - Sprint 3
- ❌ Integração com Git (auto-commit, git log reading) - Sprint 4
- ❌ Browser automation / testes e2e - Não planejado para v3
- ❌ Migração para Python SDK - Planejado para v4
- ❌ Constitution/Steering - Não planejado
- ❌ Modificações em qualquer arquivo v2

---

## 7. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Modificação acidental de arquivos v2 | Alto | Média | Code review rigoroso; CI verifica que cli.ts e feature.ts não foram modificados |
| Claude CLI muda formato de --print-session-id | Alto | Baixa | Testes de integração; abstrair parsing em função isolada |
| Session ID não é persistente do lado do Claude | Alto | Baixa | Verificar documentação Claude; testes manuais antes de implementar |
| Performance degradada com muitas sessões | Médio | Baixa | Limpar sessões antigas automaticamente (>30 dias) |
| Conflitos de merge com v2 | Médio | Média | Arquivos completamente separados; não compartilhar código |
| npm link acidental quebra v2 | Alto | Média | Documentação clara; CI não faz npm link; scripts de teste isolados |

---

## 8. Métricas de Sucesso

### 8.1 Métricas Técnicas

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Cobertura de testes | >= 80% | `npm run test:coverage` nos arquivos v3 |
| Tempo de leitura SessionStore | < 50ms | Benchmark em testes |
| Tempo de escrita SessionStore | < 50ms | Benchmark em testes |
| Build sem erros | 100% | CI pipeline |
| Zero modificações em v2 | 0 arquivos | Git diff em CI |

### 8.2 Métricas de Validação

| Métrica | v2 Atual | v3 Target |
|---------|----------|-----------|
| Session ID capturado | Nunca | 100% das execuções |
| Resume funcional | Impossível | >95% sucesso |
| Contexto entre fases | 0% | >95% (após Sprint 3) |

### 8.3 Critérios de Conclusão dos Sprints

**Sprint 0 completo quando:**
- [ ] `npm run adk3 -- --version` funciona
- [ ] `npm run adk3 -- feature status test` executa (mesmo sem sessões)
- [ ] Nenhum arquivo v2 modificado

**Sprint 1 completo quando:**
- [ ] SessionStore salva/recupera sessões corretamente
- [ ] `executeClaudeCommandV3` captura session ID
- [ ] `executeClaudeCommandV3` suporta resume
- [ ] Cobertura de testes >= 80%
- [ ] Testes passam em CI

---

## 9. Dependências

### 9.1 Dependências Técnicas

| Dependência | Versão | Uso |
|-------------|--------|-----|
| Node.js | >= 18.0.0 | Runtime |
| TypeScript | >= 5.0.0 | Compilação |
| Commander.js | v14 | CLI parsing |
| fs-extra | v11 | Operações de arquivo |
| Vitest | existente | Testes |

### 9.2 Dependências Externas

| Dependência | Status | Crítico |
|-------------|--------|---------|
| Claude CLI com `--print-session-id` | Verificar disponibilidade | Sim |
| Claude CLI com `--resume` | Verificar disponibilidade | Sim |

### 9.3 Pré-requisitos

- [ ] Tag `v2.0.0` criada antes de iniciar desenvolvimento
- [ ] Branch `feature/adk-v3` criada
- [ ] Verificar que Claude CLI suporta flags necessárias

---

## 10. Timeline (Sugestão)

### Sprint 0: Setup (1 dia)
| Dia | Tarefa |
|-----|--------|
| 1 manhã | Criar branch, estrutura de arquivos, cli-v3.ts básico |
| 1 tarde | feature-v3.ts básico, scripts npm, validação |

### Sprint 1: Session Store (3 dias)
| Dia | Tarefa |
|-----|--------|
| 2 manhã | Interface SessionStore, estrutura de dados |
| 2 tarde | Implementação SessionStore, testes unitários |
| 3 manhã | claude-v3.ts: spawn assíncrono, captura output |
| 3 tarde | claude-v3.ts: --print-session-id, extração session ID |
| 4 manhã | claude-v3.ts: --resume, integração com SessionStore |
| 4 tarde | Testes de integração, documentação, code review |

### Milestones

| Marco | Data Estimada | Entregável |
|-------|---------------|------------|
| Sprint 0 Done | Dia 1 | CLI v3 executável |
| Sprint 1 Done | Dia 4 | Session tracking funcional |
| Validação | Dia 5 | Teste manual ponta a ponta |

---

## 11. Especificações Técnicas Detalhadas

### 11.1 Estrutura de Arquivos Criados

```
src/
├── cli-v3.ts                    # Entry point v3
├── commands/
│   └── feature-v3.ts            # Comandos feature v3
└── utils/
    ├── claude-v3.ts             # Execução Claude com session
    ├── session-store.ts         # Persistência de sessões
    └── prompts/                 # Diretório para sprints futuros
        └── .gitkeep
```

### 11.2 Formato de Dados - Session

```typescript
interface SessionInfo {
  id: string
  feature: string
  startedAt: string          // ISO 8601
  lastActivity: string       // ISO 8601
  status: 'active' | 'completed' | 'interrupted'
  resumable: boolean
  metadata?: {
    model?: string
    promptTokens?: number
    completionTokens?: number
    exitCode?: number
  }
}
```

### 11.3 Estrutura de Persistência

```
.claude/plans/features/{feature-name}/sessions/
├── current.json              # Sessão ativa (se existir)
└── history/
    ├── session-20260125-100000.json
    ├── session-20260125-140000.json
    └── session-20260125-180000.json
```

### 11.4 API do claude-v3.ts

```typescript
export interface ClaudeV3Options {
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string
  printSessionId?: boolean
  timeout?: number            // ms, default 300000 (5min)
  onOutput?: (chunk: string) => void
}

export interface ClaudeV3Result {
  output: string
  sessionId: string | null
  exitCode: number
  duration: number            // ms
}

export async function executeClaudeCommandV3(
  prompt: string,
  options?: ClaudeV3Options
): Promise<ClaudeV3Result>

export function parseSessionId(output: string): string | null
```

---

## 12. Checklist de Validação Final

### Antes de Marcar Sprint 0 como Completo
- [ ] `npm run build` compila sem erros
- [ ] `npm run adk3 -- --version` exibe versão
- [ ] `npm run adk3 -- --help` exibe ajuda
- [ ] `npm run adk3 -- feature --help` exibe subcomandos
- [ ] `npm run adk3 -- feature status test` executa
- [ ] `git diff src/cli.ts` retorna vazio
- [ ] `git diff src/commands/feature.ts` retorna vazio

### Antes de Marcar Sprint 1 como Completo
- [ ] SessionStore salva sessão corretamente
- [ ] SessionStore recupera sessão por feature
- [ ] SessionStore lista histórico
- [ ] SessionStore atualiza sessão existente
- [ ] executeClaudeCommandV3 usa spawn assíncrono
- [ ] executeClaudeCommandV3 captura output
- [ ] executeClaudeCommandV3 extrai session ID
- [ ] executeClaudeCommandV3 suporta --resume
- [ ] Cobertura de testes >= 80%
- [ ] `npm test` passa
- [ ] Nenhum arquivo v2 modificado

---

*PRD gerado automaticamente baseado na documentação de contexto do ADK v3*
*Referências: 00-MASTER-INDEX.md, 01-deep-analysis.md, 02-long-running-agents-gap.md, 03-v3-decisions.md*
