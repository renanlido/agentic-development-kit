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

## 1. DECISÕES FINAIS

### 1.1 O que MANTER (v2 funcional - CONGELADO):
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

### 1.2 O que CRIAR (v3 novo):
```text
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

### 1.3 O que ABORTAR:
```
❌ NÃO FAZER:
- Modificar src/cli.ts atual
- Modificar src/commands/feature.ts atual
- Fazer npm link durante desenvolvimento
- Migrar para Python SDK agora
- Implementar Constitution/Steering
- Completar tarefas pendentes de v2-fase3
```

### 1.4 Flags do Claude CLI (verificado 2026-02-02):
```bash
-r, --resume [value]     # Resume by session ID or picker
--session-id <uuid>      # Use specific UUID for session
-c, --continue           # Continue most recent in current dir
--fork-session           # New ID when resuming (use with --resume)
```

---

## 2. ESTRUTURA DE ARQUIVOS v3

### 2.1 Nova Estrutura de Feature:
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

### 2.2 Formato feature_list.json:
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

## 3. FLUXO v3: Um Comando Por Domínio

### Filosofia ADK
> **"Um comando por domínio, não um comando por etapa."**
> Cada comando faz TUDO do seu domínio. Zero fragmentação. Zero paralisia por decisão.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      adk feature my-feature                             │
│                                                                         │
│  Faz TUDO: research → plan → implement → test → docs → done            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Feature existe? │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ NÃO             │          │ SIM             │
    │ → Criar +       │          │ → Continuar     │
    │   Inicializar   │          │   de onde parou │
    └────────┬────────┘          └────────┬────────┘
             │                            │
             ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ Initializer:    │          │ Coding Agent:   │
    │ 1. Estrutura    │          │ 1. Detectar     │
    │ 2. feature_list │          │    estado atual │
    │ 3. init.sh      │          │ 2. Próxima task │
    │ 4. Git commit   │          │ 3. Implementar  │
    └────────┬────────┘          │ 4. Testar e2e   │
             │                   │ 5. Commit       │
             └───────────────────│ 6. Loop até     │
                                 │    100% done    │
                                 └─────────────────┘
```

### Comandos v3 (Um por Domínio)

| Comando | Domínio | O que faz |
|---------|---------|-----------|
| `adk feature <name>` | Features | Interativo com validações manuais entre fases |
| `adk feature autopilot <name>` | Features | Automático com QA por task + escalonamento |
| `adk docs [target]` | Documentação | Analisa → Gera → Organiza → Done |
| `adk workflow daily` | Workflow | Update → Identify → Prioritize → Done |

### Fluxo do Autopilot (Detalhado)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    adk feature autopilot <name>                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │           FASES COM VALIDAÇÃO           │
         └────────────────────┬────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌────────┐              ┌────────┐              ┌────────────┐
│Research│──►[Validar]  │  Plan  │──►[Validar]  │ Implement  │
└────────┘   Refinar?   └────────┘   Refinar?   └─────┬──────┘
             ou Seguir              ou Seguir         │
                                                      │
         ┌────────────────────────────────────────────┘
         │         LOOP AUTOMÁTICO COM QA
         └────────────────────┬────────────────────────
                              │
                              ▼
                    ┌─────────────────┐
                    │     Task N      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    QA Task      │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
           Passou                        Falhou
              │                             │
              ▼                             ▼
     ┌────────────────┐           ┌─────────────────┐
     │  Próxima Task  │           │ Criar correções │
     └────────────────┘           │ e tentar de novo│
                                  └────────┬────────┘
                                           │
                                  Falhou 3x?
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                             Não                       Sim
                              │                         │
                              ▼                         ▼
                    ┌─────────────────┐      ┌─────────────────┐
                    │  Loop correção  │      │  PEDE AJUDA AO  │
                    └─────────────────┘      │     USUÁRIO     │
                                             └─────────────────┘
```

**Regras do Autopilot:**
1. **Entre fases** (Research → Plan → Implement): Validação manual obrigatória
2. **Dentro de Implement**: Loop automático task por task
3. **QA por task**: Cada task passa por QA antes de ir para próxima
4. **QA Final**: Ao completar TODAS as tasks, QA da feature completa
5. **Auto-correção**: Se QA falha, cria direcionamentos e tenta corrigir
6. **Escalonamento**: Se falhar 3x, pede ajuda ao humano

### QA em Duas Camadas

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTAÇÃO                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CAMADA 1: QA POR TASK (durante implementação)                         │
│  ─────────────────────────────────────────────────                      │
│  Task 1 → Implementa → QA Task ──► Task 2                              │
│  Task 2 → Implementa → QA Task ──► Task 3                              │
│  Task N → Implementa → QA Task ──► ✓ Tasks completas                   │
│                                          │                              │
│                                          ▼                              │
│  CAMADA 2: QA FINAL (feature completa)                                 │
│  ─────────────────────────────────────────────                          │
│                               ┌─────────────────┐                       │
│                               │   QA FINAL      │                       │
│                               │ Feature completa│                       │
│                               └────────┬────────┘                       │
│                                        │                                │
│                         ┌──────────────┴──────────────┐                 │
│                      Passou                        Falhou               │
│                         │                             │                 │
│                         ▼                    Cria correções             │
│                      ✅ DONE                 Tenta novamente            │
│                                              (max 3x → humano)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. IMPLEMENTAÇÃO POR SPRINTS

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

## 5. COMO TESTAR

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

## 6. CRITÉRIOS DE SUCESSO

| Métrica | v2 Atual | v3 Target |
|---------|----------|-----------|
| Sessões por feature | 7+ | 1-3 |
| Contexto entre fases | ~0% | >95% |
| Conclusão prematura | ~40% | <5% |
| Recovery após crash | Manual | <30s |

---

## 7. PRÓXIMOS PASSOS IMEDIATOS

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

## 8. OBJETIVOS ESTRATÉGICOS v3

### 8.1 Sistema Coeso de Recursos ADK

Integração completa de todos os recursos em um fluxo unificado:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA INTEGRADO ADK v3                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │   HOOKS     │   │   SKILLS    │   │   MEMORY    │   │   AGENTS    │ │
│  │             │   │             │   │             │   │             │ │
│  │ • inject    │   │ • commit    │   │ • core-state│   │ •Initializer│ │
│  │ • validate  │   │ • review    │   │ • session   │   │ • Coding    │ │
│  │ • checkpoint│   │ • docs      │   │ • decisions │   │ • QA        │ │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘ │
│         │                 │                 │                 │         │
│         └─────────────────┴────────┬────────┴─────────────────┘         │
│                                    │                                    │
│                            ┌───────▼───────┐                           │
│                            │  CONSTRAINTS  │                           │
│                            │               │                           │
│                            │ • No Stubs    │                           │
│                            │ • Read-First  │                           │
│                            │ • Test-After  │                           │
│                            └───────────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Injeção Automática de Contexto

O contexto é injetado automaticamente baseado em **fase** e **task**:

| Fase | Contexto Injetado Automaticamente |
|------|-----------------------------------|
| **Research** | PRD, constraints, project guidelines |
| **Plan** | PRD, research.md, architecture patterns |
| **Implement** | Plan, task atual, arquivos relacionados, decisions |
| **QA** | Implementation, test patterns, acceptance criteria |

```typescript
interface ContextInjection {
  phase: 'research' | 'plan' | 'implement' | 'qa'
  currentTask?: TaskState
  autoInject: {
    coreState: CoreState       // Sempre
    relevantFiles: string[]    // Baseado na task
    recentDecisions: string[]  // Últimas 5
    constraints: string[]      // Sempre
  }
}
```

### 8.3 Feedback Loop Inteligente

Quando QA encontra problemas, o sistema pode **voltar fases** se necessário:

```text
                        QA ENCONTROU PROBLEMA
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Classificar Problema │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    IMPLEMENTATION         PLANNING              RESEARCH
      BUG/ERROR           ARQUITETURA          REQUISITOS
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Corrigir código │  │ Revisar plan    │  │ Revisar PRD     │
│ (loop normal)   │  │ com usuário     │  │ com usuário     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Classificação de Problemas:**

| Severidade | Tipo | Ação |
|------------|------|------|
| **HIGH** | Bug de implementação | Corrige automaticamente (3x) |
| **MEDIUM** | Problema de design | Pausa, apresenta opções ao usuário |
| **LOW** | Melhoria sugerida | Registra para próxima iteração |

### 8.4 Detecção de Loops Infinitos

Sistema detecta e previne desperdício de recursos:

```typescript
interface LoopDetection {
  maxAttempts: {
    perTask: 3          // Máximo 3 tentativas por task
    perPhase: 10        // Máximo 10 tasks falhando na fase
    totalSession: 30    // Máximo 30 falhas totais na sessão
  }
  patterns: {
    sameError: 2        // Mesmo erro 2x = escalar
    similarFix: 3       // Mesma correção 3x = loop detectado
    noProgress: 5       // 5 iterações sem progresso = parar
  }
  action: 'pause' | 'escalate' | 'abort'
}
```

**Sinais de Loop Infinito:**
1. Mesmo erro aparece após correção
2. Mesma correção sendo aplicada repetidamente
3. Nenhum teste novo passando após N iterações
4. Token usage aumentando sem progresso

### 8.5 Enriquecimento de Contexto pelo Usuário

Para problemas **MEDIUM/LOW**, usuário pode enriquecer o contexto:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️  PROBLEMA DETECTADO (MEDIUM)                                        │
│                                                                         │
│  Descrição: Componente X não está seguindo pattern Y                    │
│                                                                         │
│  Opções:                                                                │
│  [1] Corrigir automaticamente (usar pattern Y)                         │
│  [2] Manter atual (adicionar exceção documentada)                      │
│  [3] Fornecer direcionamento específico                                │
│                                                                         │
│  > 3                                                                    │
│                                                                         │
│  Seu direcionamento:                                                    │
│  > Usar pattern Z neste caso porque [motivo]. Ver referência em...     │
│                                                                         │
│  ✓ Direcionamento adicionado ao contexto. Continuando...               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.6 Gerenciamento de Contexto para Assertividade

Sistema garante que o contexto necessário é sempre lido:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTEXT MANAGEMENT LAYERS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TIER 1: CORE STATE (sempre presente)                                  │
│  ─────────────────────────────────────                                  │
│  • currentTask: { id, status, files }                                  │
│  • recentDecisions: últimas 5 decisões                                 │
│  • constraints: regras ativas                                          │
│  • sessionFiles: arquivos modificados                                  │
│                                                                         │
│  TIER 2: TASK CONTEXT (carregado por task)                             │
│  ─────────────────────────────────────────                              │
│  • Arquivos relacionados à task (auto-detectados)                      │
│  • Testes existentes para os arquivos                                  │
│  • Histórico de mudanças recentes (git diff)                           │
│                                                                         │
│  TIER 3: FEATURE CONTEXT (carregado sob demanda)                       │
│  ──────────────────────────────────────────────                         │
│  • PRD, research.md, implementation-plan.md                            │
│  • Decisões de arquitetura                                             │
│  • Padrões do projeto                                                  │
│                                                                         │
│  TIER 4: PROJECT CONTEXT (referência quando necessário)                │
│  ──────────────────────────────────────────────────────                 │
│  • CLAUDE.md, guidelines.md                                            │
│  • Convenções globais                                                  │
│  • Dependências e integrações                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Regras de Carregamento:**
1. **Tier 1**: Sempre injetado no início de cada ação
2. **Tier 2**: Carregado automaticamente baseado na task
3. **Tier 3**: Carregado quando agente precisa de contexto de feature
4. **Tier 4**: Carregado apenas quando explicitamente necessário

**Anti-Patterns Prevenidos:**
- ❌ Implementar sem ler código existente (força Read-First)
- ❌ Criar stubs ou TODOs (constraint No-Stubs)
- ❌ Esquecer testes (constraint Test-After)
- ❌ Perder decisões anteriores (injeta recentDecisions)

---

*Documento de Decisões - ADK v3 Final*
