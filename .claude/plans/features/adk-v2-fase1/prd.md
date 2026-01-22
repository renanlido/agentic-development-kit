# PRD: adk-v2-fase1 - MCP Memory RAG

**Data:** 2026-01-21
**Status:** Draft
**Autor:** Auto-generated
**Versão:** 1.0
**Parent Feature:** adk-v2

---

## 1. Problema

### 1.1 Problema Central

O sistema de busca atual do ADK utiliza correspondência literal de keywords, resultando em perda significativa de contexto relevante. O código em `src/utils/memory-search.ts:17-29` demonstra a limitação:

```typescript
function simpleSearch(text: string, query: string): number {
  const words = lowerQuery.split(/\s+/)
  for (const word of words) {
    if (lowerText.includes(word)) matches++  // MATCH LITERAL APENAS
  }
}
```

**Impacto direto:**
- Query "auth" **NÃO** encontra documentos contendo "autenticacao" ou "authentication"
- Query "user" **NÃO** encontra documentos contendo "usuario" ou "account"
- Recall estimado de apenas **20%** para queries cross-language
- Desenvolvedores perdem tempo procurando manualmente contexto que existe no sistema

### 1.2 Cenário Típico de Falha

```
Desenvolvedor: "Quero implementar autenticação JWT"
Sistema atual: Busca "JWT" → encontra 2 docs
Sistema desejado: Busca semântica → encontra 8 docs (JWT, auth, login, token, session, autenticacao, etc.)
```

### 1.3 Problemas Secundários

1. **Context loss em sessões longas**: Sem busca semântica, agentes não conseguem recuperar contexto arquivado eficientemente
2. **Silos de linguagem**: Documentação em português não é encontrada por queries em inglês e vice-versa
3. **Latência de desenvolvimento**: Tempo perdido reformulando queries ou navegando manualmente
4. **Dependência de memória humana**: Desenvolvedor precisa lembrar exatamente como documentou algo

### 1.4 Por que é P0 (Bloqueador)

MCP Memory RAG é **pré-requisito** para as demais fases do ADK v2:

```
MCP Memory RAG ◀── P0 BLOQUEADOR
       │
       ├──────────────────────┐
       ▼                      ▼
SessionManager           ContextCompactor
(archiva contexto)       (usa MCP para arquivar)
```

Sem busca semântica funcional:
- ContextCompactor não pode arquivar com recall confiável
- SessionManager não pode resumir contexto de sessões anteriores
- Powers pattern não consegue carregar contexto dinamicamente

---

## 2. Solução Proposta

### 2.1 Visão Geral

Implementar camada de busca semântica via MCP (Model Context Protocol) server, permitindo:

1. **Indexação automática** de documentos `.claude/*` sem compactação
2. **Busca semântica** via embeddings que entende sinônimos e traduções
3. **Busca híbrida** combinando semantic + keyword para melhor precision
4. **Recall focado** (princípio "conta-gotas") - retorna apenas o mais relevante

### 2.2 Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      ADK Memory Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  CLI Commands    │    │         Hooks                     │   │
│  │  - adk memory    │    │  - post-write-index.sh           │   │
│  │    index         │    │  (indexação automática)           │   │
│  │  - adk memory    │    └──────────────────────────────────┘   │
│  │    recall        │                    │                       │
│  └────────┬─────────┘                    │                       │
│           │                              │                       │
│           ▼                              ▼                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   MemoryMCP Wrapper                        │   │
│  │  src/utils/memory-mcp.ts                                   │   │
│  │  - index(content, metadata)                                │   │
│  │  - recall(query, options)                                  │   │
│  │  - fallback para keyword search                            │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   MCP Server                               │   │
│  │  (@yikizi/mcp-local-rag ou mcp-memory-service)            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────┐     │   │
│  │  │ SQLite-vec │  │ Embeddings │  │  Hybrid Search  │     │   │
│  │  │ Storage    │  │   Model    │  │  (sem + key)    │     │   │
│  │  └────────────┘  └────────────┘  └─────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Princípios Fundamentais

1. **NUNCA compactar → SEMPRE indexar → RECALL focado**
   - Documentos são indexados integralmente
   - Recall retorna chunks mais relevantes (top-k)
   - Princípio "conta-gotas" para economizar tokens

2. **Fallback graceful**
   - Se MCP server indisponível → keyword search atual
   - Se embedding falhar → full-text search
   - Sistema nunca quebra por falha de MCP

3. **Local-first**
   - SQLite para storage (sem dependência de cloud)
   - Funciona offline após indexação inicial

4. **Non-blocking**
   - Indexação via hook é assíncrona
   - Não bloqueia operações do usuário

---

## 3. Requisitos Funcionais

### 3.1 Types e Interfaces

- **RF01**: Criar `src/types/mcp-memory.ts` com interfaces:
  - `MemoryDocument` (id, content, metadata, embedding?)
  - `MemoryQuery` (query, options: limit, threshold, hybrid)
  - `MemoryResult` (documents, scores, timings)
  - `MemoryConfig` (provider, storagePath, chunkSize, model)
  - Type guards para validação

### 3.2 MCP Memory Wrapper

- **RF02**: Criar `src/utils/memory-mcp.ts` com classe `MemoryMCP`:
  - Método `index(content: string, metadata: Record<string, unknown>): Promise<IndexResult>`
  - Método `recall(query: string, options?: RecallOptions): Promise<MemoryResult>`
  - Conexão configurável com MCP server
  - Fallback para `simpleSearch()` em caso de erro
  - Logging de performance metrics

### 3.3 Configuração

- **RF03**: Criar schema de configuração em `.adk/memory.json`:
  - `provider`: string (`mcp-local-rag` | `mcp-memory-service`)
  - `storagePath`: string (default: `.adk/memory.db`)
  - `chunkSize`: number (default: 512 tokens)
  - `embeddingModel`: string (modelo de embeddings)
  - `hybridSearch`: boolean (default: true)
  - Validação via Zod schema

- **RF04**: Configurar MCP server em `.claude/mcp.json`:
  - Connection string
  - Tools expostos (index, recall)
  - Timeout settings

### 3.4 Comandos CLI

- **RF05**: Implementar `adk memory index`:
  - Subcomando `--file <path>` para indexar arquivo individual
  - Subcomando `--dir <path>` para indexar diretório
  - Opção `--filter <pattern>` para filtrar por extensão (ex: `*.md`)
  - Opção `--force` para re-indexar arquivos já indexados
  - Spinner com progresso e resumo de arquivos indexados
  - Skip automático de arquivos binários e sensíveis (.env)

- **RF06**: Modificar `adk memory recall` para busca semântica:
  - Usar MCP Memory como primary search
  - Fallback para keyword search se MCP falhar
  - Opção `--hybrid` para busca combinada (semantic + keyword)
  - Opção `--limit <n>` para número de resultados (default: 5)
  - Opção `--threshold <0-1>` para similarity threshold (default: 0.7)
  - Output formatado com scores de relevância

### 3.5 Hook de Indexação Automática

- **RF07**: Criar `.claude/hooks/post-write-index.sh`:
  - Trigger: `PostToolUse:Write` para arquivos em `.claude/*`
  - Execução assíncrona (não bloqueia)
  - Queue de indexação com debounce (evita múltiplas indexações)
  - Skip de arquivos fora do escopo
  - Log de arquivos indexados

### 3.6 Busca Híbrida

- **RF08**: Implementar algoritmo de busca híbrida:
  - Semantic search via embeddings (peso: 0.7)
  - Keyword search via full-text (peso: 0.3)
  - Reranking dos resultados combinados
  - Configurável via options

### 3.7 Integração com Claude Code

- **RF09**: Registrar MCP server no `.claude/settings.json`:
  - Tools `memory_index` e `memory_recall` disponíveis
  - Claude Code pode invocar diretamente para buscar contexto

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01**: Busca semântica deve retornar em **< 100ms (p95)**
- **RNF02**: Indexação de arquivo único em **< 500ms**
- **RNF03**: Indexação de diretório (100 arquivos) em **< 30s**
- **RNF04**: Indexação assíncrona deve eliminar **100-500ms** de latência por escrita

### 4.2 Qualidade de Busca

- **RNF05**: Recall para queries cross-language: **80%** (baseline: 20%)
- **RNF06**: Precision dos top-5 resultados: **85%** (baseline: 60%)
- **RNF07**: Query "auth" deve retornar documentos com: auth, authentication, autenticacao, login, token, session

### 4.3 Segurança

- **RNF08**: API tokens do MCP server apenas em `.env`
- **RNF09**: Arquivos sensíveis (.env, credentials) **NUNCA** indexados
- **RNF10**: Validação de input em todos comandos CLI

### 4.4 Confiabilidade

- **RNF11**: Fallback para keyword search se MCP indisponível (zero downtime)
- **RNF12**: Max 3 retries para conexão com MCP server
- **RNF13**: Timeout de 5s para operações MCP (configurável)

### 4.5 Usabilidade

- **RNF14**: Setup inicial com `adk memory index --dir .claude/` (one-liner)
- **RNF15**: Mensagens de erro claras quando MCP não configurado
- **RNF16**: Documentação de troubleshooting no README

### 4.6 Manutenibilidade

- **RNF17**: Cobertura de testes **>= 80%** para `memory-mcp.ts`
- **RNF18**: Wrapper abstrai provider específico (troca de MCP server sem breaking changes)
- **RNF19**: Logs estruturados para debugging

---

## 5. User Stories

### US01: Busca Semântica Cross-Language

**Como** desenvolvedor usando ADK
**Quero** buscar por "auth" e encontrar documentos sobre "autenticacao"
**Para** recuperar contexto relevante independente da linguagem usada

**Critérios de Aceitação:**
- [ ] Query "auth" retorna documentos contendo "autenticacao", "authentication", "login"
- [ ] Query "user" retorna documentos contendo "usuario", "account", "profile"
- [ ] Resultados ordenados por relevância semântica (não apenas keyword match)
- [ ] Tempo de resposta < 100ms

---

### US02: Indexação Manual de Diretório

**Como** desenvolvedor configurando ADK em novo projeto
**Quero** indexar todo o diretório `.claude/` de uma vez
**Para** habilitar busca semântica em toda documentação existente

**Critérios de Aceitação:**
- [ ] Comando `adk memory index --dir .claude/` indexa todos arquivos .md
- [ ] Arquivos binários são automaticamente ignorados
- [ ] Arquivos .env e credentials são ignorados por segurança
- [ ] Spinner mostra progresso durante indexação
- [ ] Resumo final mostra total de arquivos indexados

---

### US03: Indexação Automática de Novos Documentos

**Como** desenvolvedor trabalhando em feature
**Quero** que novos documentos em `.claude/` sejam indexados automaticamente
**Para** não precisar executar `adk memory index` manualmente toda vez

**Critérios de Aceitação:**
- [ ] Hook `post-write-index.sh` detecta escrita em `.claude/*`
- [ ] Indexação acontece em background (não bloqueia)
- [ ] Debounce previne múltiplas indexações em sequência rápida
- [ ] Log confirma indexação completada

---

### US04: Busca Híbrida para Melhor Precision

**Como** desenvolvedor buscando contexto específico
**Quero** combinar busca semântica com keyword
**Para** encontrar documentos que match tanto o significado quanto termos exatos

**Critérios de Aceitação:**
- [ ] Opção `--hybrid` ativa busca combinada
- [ ] Peso configurável entre semantic (default 0.7) e keyword (default 0.3)
- [ ] Resultados mostram score combinado
- [ ] Precision melhora para queries com termos técnicos específicos

---

### US05: Fallback Graceful quando MCP Indisponível

**Como** desenvolvedor em ambiente sem MCP configurado
**Quero** que busca continue funcionando com keyword search
**Para** não ter breaking changes em projetos existentes

**Critérios de Aceitação:**
- [ ] Se MCP server não responde → usa keyword search atual
- [ ] Mensagem informa que está usando fallback
- [ ] Sugestão de como configurar MCP para melhor resultados
- [ ] Zero exceptions para usuário

---

### US06: Recall Focado (Conta-Gotas)

**Como** agente de longa duração
**Quero** receber apenas os chunks mais relevantes
**Para** não saturar meu contexto com informação redundante

**Critérios de Aceitação:**
- [ ] Default limit de 5 resultados
- [ ] Threshold de similarity configurável (default 0.7)
- [ ] Resultados ordenados por relevância descendente
- [ ] Metadata inclui source file e posição no documento

---

## 6. Escopo

### 6.1 Incluído

#### Fase de Preparação
- Benchmark de providers MCP (documentado em `.claude/plans/features/adk-v2-fase1/mcp-benchmark.md`)
- Escolha documentada com justificativa

#### Fase de Implementação
- Types em `src/types/mcp-memory.ts`
- Wrapper `MemoryMCP` em `src/utils/memory-mcp.ts`
- Schema de configuração `.adk/memory.json`
- Configuração MCP `.claude/mcp.json`
- Comando `adk memory index`
- Modificação de `adk memory recall`
- Hook `post-write-index.sh`
- Testes unitários com >= 80% coverage
- Testes de integração E2E

#### Documentação
- CLAUDE.md atualizado com seção MCP Memory
- README com setup instructions

### 6.2 Excluído (Out of Scope)

- **VS Code Extension** - Apenas CLI nesta fase
- **Multiple embedding models** - Um modelo fixo por provider
- **Cloud storage** - Apenas SQLite local
- **Knowledge Graph completo** - Apenas semantic search simples
- **Real-time sync** - Indexação é event-driven, não contínua
- **Compression de embeddings** - Otimização futura
- **Multi-tenant** - Apenas single-user local
- **UI/Dashboard** - Apenas CLI output
- **Integração com outros MCP servers** - Apenas memory servers listados

---

## 7. Riscos e Mitigações

| # | Risco | Impacto | Probabilidade | Mitigação |
|---|-------|---------|---------------|-----------|
| R1 | Provider MCP escolhido tem single maintainer | Alto | Média | Benchmark 2+ providers antes de escolher; wrapper abstrai implementação; fallback para keyword search sempre disponível |
| R2 | Latência de busca semântica excede 100ms | Alto | Média | Benchmark com documentos reais do ADK; cache de queries frequentes; SQLite-vec é otimizado para local |
| R3 | Embeddings não capturam bem termos técnicos | Médio | Média | Busca híbrida combina semantic + keyword; reranking ajusta scores; threshold configurável |
| R4 | Hook de indexação causa lentidão | Médio | Baixa | Execução assíncrona com `&`; debounce de 1s; queue com batch |
| R5 | MCP server consome muita memória | Médio | Baixa | Lazy loading do modelo; SQLite-vec é lightweight; monitorar com `adk diagnostics` |
| R6 | Breaking changes em providers MCP | Alto | Baixa | Wrapper abstrai API; version lock no package.json; testes E2E validam integração |
| R7 | Arquivos sensíveis indexados acidentalmente | Alto | Baixa | Blocklist de patterns (.env, credentials, *.key); validação em index(); auditoria em logs |
| R8 | Debugging difícil com MCP como caixa preta | Médio | Alta | Verbose mode com logging detalhado; metrics de latência por operação; `adk diagnostics` health check |

---

## 8. Métricas de Sucesso

### 8.1 Métricas de Qualidade de Busca

| Métrica | Baseline (keyword) | Target (semantic) | Como Medir |
|---------|-------------------|-------------------|------------|
| Recall cross-language | 20% | **80%** | Queries em inglês encontram docs em português e vice-versa |
| Precision top-5 | 60% | **85%** | Dos 5 primeiros resultados, quantos são relevantes |
| Response time p95 | N/A | **< 100ms** | Latência de `adk memory recall` |

### 8.2 Métricas de Indexação

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Indexação single file | < 500ms | Tempo de `adk memory index --file` |
| Indexação batch (100 files) | < 30s | Tempo de `adk memory index --dir` |
| Hook latency overhead | < 100ms | Diferença percebida em PostToolUse:Write |

### 8.3 Métricas de Confiabilidade

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Uptime do MCP server | 99% | Falhas de conexão / total de queries |
| Fallback success rate | 100% | Queries que funcionam mesmo com MCP down |
| Zero data loss | 0 incidents | Documentos indexados recuperáveis |

### 8.4 Métricas de Adoção (30 dias pós-launch)

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Projetos com MCP configurado | 80% dos novos inits | Presença de `.adk/memory.json` |
| Queries semânticas / dia | > 10 por projeto ativo | Logs de `adk memory recall` |
| Satisfação com resultados | NPS > 8 | Feedback qualitativo |

---

## 9. Dependências

### 9.1 Dependências Externas

| Dependência | Tipo | Criticidade | Status | Alternativa |
|-------------|------|-------------|--------|-------------|
| `@yikizi/mcp-local-rag` | MCP Server | P0 | A avaliar | `mcp-memory-service` |
| `mcp-memory-service` | MCP Server | P0 | A avaliar | `@yikizi/mcp-local-rag` |
| SQLite | Storage | P1 | Disponível | Nenhuma (required) |

### 9.2 Dependências Internas ADK

| Módulo | Tipo | Status | Impacto se Indisponível |
|--------|------|--------|-------------------------|
| `memory-search.ts` | Será modificado | ✅ Pronto | Bloqueia integração |
| `memory.ts` (command) | Será estendido | ✅ Pronto | Bloqueia CLI |
| Hook system | Infraestrutura | ✅ Pronto | Bloqueia auto-indexação |
| settings.json | Configuração | ✅ Pronto | Bloqueia registro MCP |

### 9.3 Dependências Downstream (Outras Fases)

| Fase | Dependência | Tipo |
|------|-------------|------|
| Fase 2 (Session Management) | MCP Memory para arquivar contexto | Hard |
| Fase 3 (Context Compactor) | MCP Memory para recall de contexto arquivado | Hard |
| Fase 4 (Constitution/Powers) | MCP Memory para loading dinâmico | Soft |

---

## 10. Timeline (Sugestão)

### Semana 1: Benchmark e Configuração (3-4 dias)

**Entregáveis:**
- [ ] Benchmark documentado de `@yikizi/mcp-local-rag` vs `mcp-memory-service`
- [ ] Escolha de provider com justificativa
- [ ] `src/types/mcp-memory.ts` - Types e interfaces
- [ ] `.adk/memory.json` - Schema de configuração
- [ ] `.claude/mcp.json` - Configuração do server escolhido

**Critérios de conclusão:**
- Provider escolhido e funcionando localmente
- Types compilando sem erros
- Configuração válida criada

### Semana 2: Wrapper e Comandos (4-5 dias)

**Entregáveis:**
- [ ] `tests/utils/memory-mcp.test.ts` - Testes do wrapper
- [ ] `src/utils/memory-mcp.ts` - Wrapper `MemoryMCP`
- [ ] `tests/commands/memory-index.test.ts` - Testes de index
- [ ] Comando `adk memory index` implementado
- [ ] `tests/commands/memory-recall.test.ts` - Testes de recall
- [ ] Comando `adk memory recall` modificado

**Critérios de conclusão:**
- `adk memory index --dir .claude/` funciona
- `adk memory recall "auth"` retorna resultados semânticos
- Fallback para keyword search testado

### Semana 3: Hook e Integração (3-4 dias)

**Entregáveis:**
- [ ] `tests/hooks/post-write-index.test.ts` - Testes do hook
- [ ] `.claude/hooks/post-write-index.sh` - Hook de indexação
- [ ] Atualização de `.claude/settings.json` com hook
- [ ] Testes de integração E2E
- [ ] Documentação em CLAUDE.md

**Critérios de conclusão:**
- Hook indexa automaticamente ao escrever em `.claude/*`
- E2E: index → recall → resultados corretos
- Cobertura de testes >= 80%

### Buffer (2-3 dias)

- Bug fixes
- Performance tuning se necessário
- Documentação adicional

---

## 11. Critérios de Aceite

### 11.1 Critérios de Go-Live

- [ ] Benchmark de providers documentado com escolha justificada
- [ ] `adk memory index` funcional para arquivo e diretório
- [ ] `adk memory recall` retorna resultados semânticos
- [ ] Busca híbrida (semantic + keyword) implementada
- [ ] Fallback graceful quando MCP indisponível
- [ ] Hook de indexação automática funcional
- [ ] Recall cross-language >= 80% em testes
- [ ] Response time p95 < 100ms
- [ ] Cobertura de testes >= 80%
- [ ] CLAUDE.md documentado

### 11.2 Critérios de Sucesso Pós-Launch (30 dias)

- [ ] Zero incidents críticos relacionados a MCP Memory
- [ ] 80% dos projetos novos com MCP configurado
- [ ] Satisfação > 8/10 em feedback qualitativo
- [ ] Nenhum caso de arquivo sensível indexado

---

## 12. Apêndices

### A. Comparativo de Providers MCP

| Critério | @yikizi/mcp-local-rag | mcp-memory-service |
|----------|----------------------|-------------------|
| Local-first | ✅ Sim | ✅ Sim |
| Otimizado para código | ✅ Sim | Parcial |
| Manutenção | Ativa | Ativa (13+ apps) |
| Response time | A testar | 5ms reportado |
| Hybrid search | ✅ Sim | ✅ Sim |
| Storage | SQLite-vec | SQLite |
| Embedding model | Configurável | Fixo |
| Setup complexity | Médio | Baixo |

**Ação:** Benchmark com documentos reais do ADK antes de escolher.

### B. Exemplo de Uso

```bash
# Setup inicial (one-time)
adk memory index --dir .claude/

# Busca semântica
adk memory recall "autenticação JWT"
# Retorna: docs sobre auth, JWT, token, session, login...

# Busca híbrida
adk memory recall "autenticação JWT" --hybrid

# Indexação manual de novo arquivo
adk memory index --file .claude/decisions/auth-strategy.md
```

### C. Estrutura de Arquivos

```
src/
├── types/
│   └── mcp-memory.ts          # Types e interfaces
├── utils/
│   └── memory-mcp.ts          # Wrapper MCP
└── commands/
    └── memory.ts              # Comandos (modificado)

.claude/
├── hooks/
│   └── post-write-index.sh    # Hook de indexação
└── mcp.json                   # Config do MCP server

.adk/
├── memory.json                # Config do memory
└── memory.db                  # SQLite storage

tests/
├── utils/
│   └── memory-mcp.test.ts
├── commands/
│   ├── memory-index.test.ts
│   └── memory-recall.test.ts
└── hooks/
    └── post-write-index.test.ts
```

### D. Schema de Configuração

```json
// .adk/memory.json
{
  "version": "1.0.0",
  "provider": "mcp-local-rag",
  "storagePath": ".adk/memory.db",
  "chunkSize": 512,
  "embeddingModel": "text-embedding-3-small",
  "hybridSearch": true,
  "hybridWeights": {
    "semantic": 0.7,
    "keyword": 0.3
  },
  "indexPatterns": [
    ".claude/**/*.md",
    ".claude/**/*.txt"
  ],
  "ignorePatterns": [
    "**/.env*",
    "**/credentials*",
    "**/*.key"
  ]
}
```

---

**Documento criado em:** 2026-01-21
**Próxima revisão:** Após benchmark de MCP providers
**Relacionado:** `.claude/plans/features/adk-v2/prd.md` (parent feature)

---

## Refinamento

**Data do Refinamento:** 2026-01-21
**Contexto Incorporado:** `/docs/adk-unified-analysis.md` (versão 4.3, validado contra código)

### Contexto Adicional Incorporado

A análise unificada do ADK confirmou e expandiu pontos críticos para esta fase:

#### 1. Confirmação do Problema Central

O problema de busca literal está **validado contra o código fonte** (`src/utils/memory-search.ts:17-29`). A análise confirma que o ADK está 96% completo, com MCP Memory RAG sendo o **principal bloqueador** para os 4% restantes:

```
GAPS REAIS (4 componentes):
1. MCP Memory RAG → Busca semântica (ESTA FASE - P0)
2. SessionManager → Checkpoints + Resume (depende de MCP Memory)
3. ContextCompactor → Handoff documents (depende de SessionManager)
4. Constitution/Steering → Contexto estruturado (paralelo)
```

#### 2. Otimizações de Configuração Identificadas

A análise sugere melhorias na configuração proposta na Seção 12.D:

| Campo | PRD Original | Recomendação da Análise | Justificativa |
|-------|--------------|-------------------------|---------------|
| `embeddingModel` | text-embedding-3-small | nomic-embed-text-v1.5 | Modelo 2024, melhor para código/docs técnicos |
| `chunkSize` overlap | 50 tokens implícito | 100 tokens | Melhor handling de boundaries |
| `hybridWeights.semantic` | 0.7 | Manter | Confirmado como adequado |
| Storage maxSize | Não especificado | 500MB | Previne crescimento ilimitado |
| topK inicial | 5 | 10 → rerank → 5 | Two-phase retrieval melhora qualidade |
| threshold | 0.7 | 0.65 | Levemente menor para melhor recall cross-language |
| Compaction | neverCompact | archive-old (180 dias) | Evita crescimento ilimitado mantendo docs recentes |

#### 3. Hook de Indexação: Padrão Assíncrono

A análise identifica risco de latência no RF07 (Hook de Indexação):

**Problema:** Indexação síncrona adiciona 100-500ms por operação de escrita.

**Solução Recomendada:** Implementar queue assíncrona com debouncing:

```typescript
// Adicionar src/utils/memory-index-queue.ts
export class MemoryIndexQueue {
  private queue: Map<string, NodeJS.Timeout> = new Map()
  private readonly DEBOUNCE_MS = 2000

  enqueue(filePath: string): void {
    const existing = this.queue.get(filePath)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      await this.indexFile(filePath)
      this.queue.delete(filePath)
    }, this.DEBOUNCE_MS)

    this.queue.set(filePath, timer)
  }
}
```

**Hook não-bloqueante:**
```bash
#!/bin/bash
FILE="$1"
if [[ "$FILE" == .claude/* ]]; then
  adk memory queue "$FILE" &
fi
```

#### 4. Integração com State Layer Existente

A análise confirma que o State Layer está **100% implementado**:

- StateManager (state.json caching)
- SyncEngine (3 estratégias)
- HistoryTracker (auto-prune 50 entries)
- SnapshotManager (10 snapshots, semantic naming)
- TaskParser ([ ], [x], [~], [!])
- ProgressConflict (4 tipos, 4 estratégias)
- MetricsCollector (git diff tracking)

**Impacto:** MCP Memory deve integrar com esses componentes existentes, não duplicá-los. O MemoryMCP wrapper deve usar o SnapshotManager para pontos de restauração.

### Impacto nas Outras Seções

#### Seção 3.5 (RF07 - Hook de Indexação)
- **Adicionar:** Subcomando `adk memory queue <path>` para enfileirar indexação
- **Adicionar:** Subcomando `adk memory process-queue --batch-size <n>` para processar fila
- **Modificar:** Hook usa `&` para execução assíncrona

#### Seção 3.3 (RF03 - Configuração)
- **Adicionar:** Campo `storage.maxSize` com default "500MB"
- **Adicionar:** Campo `embedding.overlap` com default 100
- **Modificar:** `compaction.strategy: "archive-old"` ao invés de `neverCompact: true`
- **Adicionar:** Campo `compaction.archiveAfterDays` com default 180
- **Adicionar:** Campo `retrieval.finalK` para two-phase retrieval

#### Seção 6.1 (Escopo Incluído)
- **Adicionar:** MemoryIndexQueue em `src/utils/memory-index-queue.ts`
- **Adicionar:** Integração com SnapshotManager para pontos de restauração

#### Seção 7 (Riscos)
- **R4 atualizado:** Risco de latência mitigado com async queue (probabilidade: Muito Baixa)
- **Novo R9:** Integração com State Layer pode revelar incompatibilidades - mitigação: testes de integração early

#### Apêndice A (Comparativo de Providers)
- **Adicionar:** Critério "Production readiness" (mcp-memory-service: 13+ apps, 5ms response time)
- **Adicionar:** Critério "Embedding model support" (@yikizi: configurável, mcp-memory-service: fixo)

### Code Review Insights (Seção 8 da Análise)

A Seção 8 do documento de análise fornece revisão crítica das propostas que impactam MCP Memory:

#### Preparação para ContextCompactor (Fase 3)

Embora fora do escopo desta fase, o MCP Memory deve ser projetado considerando a hierarquia de compactação da Anthropic:

```
1. RAW CONTEXT (preferido) - Manter contexto original
2. COMPACTION (reversível) - Arquivar via MCP Memory  ← MCP Memory habilita isso
3. SUMMARIZATION (lossy) - Último recurso apenas
```

**Implicação para MCP Memory:** O wrapper `MemoryMCP` deve expor métodos que facilitem a compactação reversível:

```typescript
class MemoryMCP {
  async archiveForCompaction(content: string, metadata: ArchiveMetadata): Promise<string>
  async recoverArchived(archiveId: string): Promise<string>
}
```

#### Best Practices Identificadas

Da análise de práticas da indústria (Anthropic, GitHub, AWS Kiro):

| Fonte | Prática | Aplicação no MCP Memory |
|-------|---------|-------------------------|
| Anthropic | Plain text > JSON para handoffs | Formatar recall results em markdown, não JSON |
| GitHub Spec Kit | Constitution como contrato | Indexar `constitution.md` para recall em queries de padrões |
| AWS Kiro | Dynamic context loading | Usar MCP Memory para carregar contexto sob demanda |

**Nota:** Essas práticas informam o design do wrapper mas não adicionam escopo à Fase 1.

### Integração com Sistema de Hooks (Seção 9 da Análise)

A versão 4.3 da análise adiciona contexto crítico sobre **aplicação autônoma de técnicas** via hooks. Isso impacta diretamente a implementação do MCP Memory:

#### Contexto: ADK v2 Fase 0 já implementou hooks base

A Fase 0 do ADK v2 já implementou os seguintes hooks que MCP Memory deve integrar:

| Hook | Arquivo | Relevância para MCP Memory |
|------|---------|----------------------------|
| `SessionStart` | `session-bootstrap.sh` | Pode carregar contexto de memória semanticamente relevante |
| `PostToolUse:Write` | `sync-state.sh` | **Ponto de integração para `post-write-index.sh`** |
| `Stop` | `session-checkpoint.sh` | Pode indexar handoff document automaticamente |

#### Estratégia de Integração dos Hooks

O hook `post-write-index.sh` (RF07) deve ser adicionado **em paralelo** ao `sync-state.sh` existente:

```json
"PostToolUse": [
  {
    "matcher": "Write",
    "hooks": [
      { "type": "command", "command": ".claude/hooks/post-write.sh" },
      { "type": "command", "command": ".claude/hooks/sync-state.sh" },
      { "type": "command", "command": ".claude/hooks/post-write-index.sh" }
    ]
  }
]
```

#### MCP Memory no SessionStart

Possibilidade futura (fora do escopo inicial): O hook `session-bootstrap.sh` poderia usar MCP Memory para injetar contexto semanticamente relevante ao invés de apenas carregar arquivos fixos:

```bash
RELEVANT_DOCS=$(adk memory recall "$FEATURE" --limit 3 --format brief)
echo "### Related Context from Memory"
echo "$RELEVANT_DOCS"
```

**Nota:** Essa integração avançada é P2 e pode ser adicionada após a implementação básica do MCP Memory.

### Ações Requeridas

1. **[ANTES DA IMPLEMENTAÇÃO]** Executar benchmark com documentos reais do ADK:
   - Usar corpus de `.claude/plans/`, `.claude/memory/`, `.claude/decisions/`
   - Medir: recall cross-language, precision top-5, response time p95
   - Documentar em `.claude/plans/features/adk-v2-fase1/mcp-benchmark.md`

2. **[DURANTE IMPLEMENTAÇÃO]** Atualizar configuração com otimizações identificadas

3. **[DURANTE IMPLEMENTAÇÃO]** Garantir compatibilidade com hooks existentes da Fase 0

4. **[APÓS IMPLEMENTAÇÃO]** Validar integração com State Layer (StateManager, SnapshotManager)

5. **[APÓS IMPLEMENTAÇÃO]** Testar hook `post-write-index.sh` em paralelo com outros PostToolUse hooks
