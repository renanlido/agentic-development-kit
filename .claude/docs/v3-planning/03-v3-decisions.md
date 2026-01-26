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

## 3. FLUXO v3: Comando Único `adk3 feature work`

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

*Documento de Decisões - ADK v3 Final*
