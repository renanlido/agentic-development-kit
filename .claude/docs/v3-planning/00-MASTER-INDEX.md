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
- 🆕 `src/commands/feature-v3.ts` - Comandos v3
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
