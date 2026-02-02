# Parallel Task Execution com Múltiplos Agentes

Este documento descreve o sistema de execução paralela de tasks usando múltiplos agentes Claude.

## Visão Geral

O ADK suporta execução paralela de tasks independentes usando git worktrees para isolamento. Isso permite:
- Executar 2-4 tasks simultaneamente
- Reduzir tempo total de desenvolvimento
- Manter isolamento entre mudanças

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Task Scheduler                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ tasks.md    │→ │ Dependency  │→ │ Wave        │          │
│  │ Parser      │  │ Graph       │  │ Scheduler   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Parallel Executor                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Agent 1  │  │ Agent 2  │  │ Agent 3  │  │ Agent 4  │    │
│  │ Worktree │  │ Worktree │  │ Worktree │  │ Worktree │    │
│  │ task-1   │  │ task-2   │  │ task-3   │  │ task-4   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Merge Controller                          │
│  - Conflict detection                                        │
│  - Sequential merge                                          │
│  - Rollback on failure                                       │
└─────────────────────────────────────────────────────────────┘
```

## Algoritmo de Scheduling

### Wave-Based Execution

Tasks são organizadas em "waves" baseadas em dependências:

```
Wave 1: [Task 1.1, Task 1.2, Task 1.3]  ← Sem dependências
         │          │          │
         ▼          ▼          ▼
Wave 2: [Task 2.1, Task 2.2]            ← Dependem de Wave 1
         │          │
         ▼          ▼
Wave 3: [Task 3.1]                       ← Depende de Wave 2
```

### Detecção de Dependências

O parser analisa `tasks.md` e identifica:

1. **Dependências explícitas**: `Dependências: Task 1.1, Task 1.2`
2. **Dependências implícitas**: Tasks que modificam os mesmos arquivos
3. **Dependências de API**: Endpoints que dependem de models/services

### Limite de Concorrência

| Recurso | Limite | Motivo |
|---------|--------|--------|
| Agentes simultâneos | 4 | Limite prático de contexto/atenção |
| Worktrees | 4 | Espaço em disco + overhead git |
| Tasks por wave | 4 | Gerenciabilidade |

## Comandos

### Executar com Paralelismo

```bash
# Implementar feature com múltiplos agentes (auto-detect tasks)
adk feature implement <name> --parallel

# Especificar número de agentes
adk feature implement <name> --parallel --agents 3

# Autopilot com implementação paralela
adk feature autopilot <name> --parallel

# Autopilot com número específico de agentes
adk feature autopilot <name> --parallel --agents 4

# Executar apenas uma wave específica
adk feature implement <name> --parallel --wave 2

# Dry-run para ver o plano de execução
adk feature implement <name> --parallel --dry-run
```

### Monitorar Execução

```bash
# Ver status de todos os agentes
adk agent status

# Ver progresso detalhado
adk feature status <name> --parallel
```

## Detecção de Conflitos

### Antes da Execução

O sistema analisa `tasks.md` e detecta conflitos potenciais:

```
⚠️  Conflito detectado:
    Task 2.1 e Task 2.3 modificam: src/services/user.ts

    Opções:
    1. Executar sequencialmente
    2. Dividir o arquivo em módulos
    3. Forçar paralelo (merge manual)
```

### Durante a Execução

Cada agente trabalha em worktree isolado:

```
.worktrees/
├── feature-task-1/     # Agente 1
├── feature-task-2/     # Agente 2
├── feature-task-3/     # Agente 3
└── feature-task-4/     # Agente 4
```

### Após a Execução

Merge sequencial com detecção de conflitos:

```bash
# Merge automático
git merge feature-task-1 --no-ff
git merge feature-task-2 --no-ff

# Se houver conflito
⚠️  Conflito no merge de task-2:
    src/services/user.ts

    Ação: Resolvendo automaticamente (estratégia: ours + manual review)
```

## Estrutura do tasks.md para Paralelismo

Para habilitar paralelismo eficiente, estruture tasks.md assim:

```markdown
## Task 1.1: Criar models de usuário
**Arquivos:** src/models/user.ts, src/types/user.ts
**Dependências:** nenhuma

## Task 1.2: Criar models de produto
**Arquivos:** src/models/product.ts, src/types/product.ts
**Dependências:** nenhuma

## Task 2.1: Implementar service de usuário
**Arquivos:** src/services/user-service.ts
**Dependências:** Task 1.1

## Task 2.2: Implementar service de produto
**Arquivos:** src/services/product-service.ts
**Dependências:** Task 1.2
```

### Regras para Paralelização

✅ **Podem rodar em paralelo:**
- Tasks sem dependências entre si
- Tasks que modificam arquivos diferentes
- Tasks de módulos independentes

❌ **Devem rodar sequencialmente:**
- Tasks com dependência explícita
- Tasks que modificam mesmo arquivo
- Tasks de infraestrutura (migrations, configs)

## Exemplo Prático

### Feature: Sistema de Autenticação

```
tasks.md detectado:
├── Task 1.1: Models (User, Token)           ─┐
├── Task 1.2: Config (env, secrets)           ├── Wave 1 (paralelo)
├── Task 1.3: Utils (hash, jwt)              ─┘
├── Task 2.1: Service Auth (depende 1.1,1.3) ─┐
├── Task 2.2: Middleware (depende 1.3)        ├── Wave 2 (paralelo)
├── Task 2.3: Validators (depende 1.1)       ─┘
├── Task 3.1: Controllers (depende 2.1,2.2)  ─── Wave 3 (sequencial)
└── Task 4.1: Testes E2E (depende 3.1)       ─── Wave 4 (sequencial)

Execução com 3 agentes:
Wave 1: [Agent1: 1.1] [Agent2: 1.2] [Agent3: 1.3] → merge
Wave 2: [Agent1: 2.1] [Agent2: 2.2] [Agent3: 2.3] → merge
Wave 3: [Agent1: 3.1] → merge
Wave 4: [Agent1: 4.1] → merge

Tempo estimado: 4 waves vs 8 tasks sequenciais
Speedup: ~2x
```

## Infraestrutura Existente

O ADK já possui a base para paralelismo:

| Componente | Localização | Status |
|------------|-------------|--------|
| Parallel Executor | `src/utils/parallel-executor.ts` | ✅ Implementado |
| Agent Manager | `src/commands/agent.ts` | ✅ Implementado |
| Worktree Utils | `src/utils/worktree.ts` | ✅ Implementado |
| Task Parser | `src/utils/task-parser.ts` | 🚧 A implementar |
| Wave Scheduler | `src/utils/wave-scheduler.ts` | 🚧 A implementar |

## Próximos Passos

1. **Task Parser**: Extrair tasks e dependências de `tasks.md`
2. **Wave Scheduler**: Agrupar tasks em waves executáveis
3. **Integration**: Conectar com `adk feature implement --parallel`
4. **Merge Controller**: Gerenciar merge sequencial com rollback

## Limitações

- Máximo 4 agentes simultâneos (recomendado: 2-3)
- Tasks com mesmo arquivo devem ser sequenciais
- Migrations/seeds sempre sequenciais
- Requer espaço em disco para worktrees (~100MB por worktree)
