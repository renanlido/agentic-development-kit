# Implementation Plan: Multi AI Provider Support (gemini-integration)

**Data**: 2026-01-28
**Status**: Draft
**Versão**: 1.0
**Baseado em**: research.md, prd.md

---

## Executive Summary

Este plano detalha a implementação de suporte a múltiplos AI providers no ADK, começando com Gemini CLI como segundo provider além do Claude CLI existente. A implementação segue uma abordagem incremental em 5 fases, priorizando retrocompatibilidade e TDD.

### Estimativa Total

| Fase | Story Points | Tasks |
|------|--------------|-------|
| Phase 1: Foundation | 8 | 4 |
| Phase 2: Claude Provider Refactor | 8 | 4 |
| Phase 3: Gemini Provider | 13 | 5 |
| Phase 4: Integration | 13 | 6 |
| Phase 5: Polish | 8 | 5 |
| **Total** | **50** | **24** |

---

## Phase 1: Foundation (8 SP)

### Objetivo
Criar a camada de abstração de AI providers seguindo o padrão de Provider Registry já existente no codebase para Project Providers.

### 1.1 Core Types Definition

**Descrição**: Definir todas as interfaces e tipos do sistema de AI providers.

**Arquivos a criar**:
- `src/ai-providers/types.ts`

**Interfaces principais**:
- `AIProviderName` - Union type: 'claude' | 'gemini'
- `ModelTier` - Union type: 'high' | 'medium' | 'low'
- `AIProviderModel` - Modelo individual com name, tier, contextWindow
- `AIProviderOptions` - Opções de execução (model, headless, metrics, etc)
- `AIProviderResult` - Resultado com success, output, error, metrics
- `AIProvider` - Interface principal do provider
- `AIProviderConfig` - Configuração (default, fallback, autoFallback)

**Testes necessários**:
- `tests/ai-providers/types.test.ts`
  - Type guards para AIProviderName
  - Type guards para ModelTier
  - Validação de estruturas de interface

**Critérios de aceitação**:
- [ ] Todas interfaces exportadas corretamente
- [ ] Tipos compatíveis com sistema de tipos existente (ModelType, PhaseType)
- [ ] Re-export em `src/types/ai-provider.ts` funcionando
- [ ] Sem conflitos com tipos existentes

**Dependências**: Nenhuma

**Story Points**: 2

---

### 1.2 Stream Parser Types

**Descrição**: Definir tipos normalizados para eventos de stream, agnósticos de provider.

**Arquivos a criar**:
- `src/ai-providers/stream-parsers/types.ts`

**Tipos principais**:
- `NormalizedEventType` - init | text | tool_start | tool_end | error | result
- `NormalizedStreamEvent` - Evento normalizado com campos opcionais por tipo
- `StreamParser` - Interface para parsers específicos de cada provider

**Testes necessários**:
- `tests/ai-providers/stream-parsers/types.test.ts`
  - Type guards para NormalizedEventType
  - Validação de NormalizedStreamEvent

**Critérios de aceitação**:
- [ ] Tipos cobrem todos eventos de Claude (system, assistant, user, result)
- [ ] Tipos suportam eventos de Gemini (init, message, tool_use, tool_result, error, result)
- [ ] Interface StreamParser é implementável
- [ ] Compatível com CollectedMetrics existente

**Dependências**: Task 1.1

**Story Points**: 2

---

### 1.3 Base Provider Abstract Class

**Descrição**: Criar classe base abstrata com funcionalidade comum a todos providers.

**Arquivos a criar**:
- `src/ai-providers/base-provider.ts`

**Funcionalidades**:
- `isInstalled()` - Verifica se CLI está instalada (com cache)
- `validateModel()` - Valida modelo contra lista de modelos do provider
- Métodos abstratos para implementação específica de cada provider

**Nota de Segurança**: Usar `execFileNoThrow` do projeto para verificação de instalação em vez de `exec` direto.

**Testes necessários**:
- `tests/ai-providers/base-provider.test.ts`
  - `isInstalled()` com cache
  - `validateModel()` validação
  - Reset de cache entre testes

**Critérios de aceitação**:
- [ ] Cache de instalação funciona corretamente
- [ ] Validação de modelo funciona
- [ ] Classe é extensível (abstract methods)
- [ ] Logger integrado para debugging

**Dependências**: Task 1.1, Task 1.2

**Story Points**: 2

---

### 1.4 AI Provider Registry

**Descrição**: Implementar o registry de providers seguindo o padrão de `src/providers/index.ts`.

**Arquivos a criar**:
- `src/ai-providers/index.ts`

**Funcionalidades**:
- `register(provider)` - Registra novo provider
- `get(name)` - Obtém provider por nome
- `getAll()` - Lista todos providers
- `getConfigured()` - Obtém provider configurado com fallback automático

**Testes necessários**:
- `tests/ai-providers/registry.test.ts`
  - `register()` e `get()`
  - `getAll()` retorna todos providers
  - `getConfigured()` respeita config
  - `getConfigured()` auto-fallback quando provider não instalado
  - Erro quando provider não encontrado

**Critérios de aceitação**:
- [ ] Registry singleton funcional
- [ ] Auto-fallback implementado
- [ ] Mensagens de erro claras com guia de instalação
- [ ] Integração com sistema de config

**Dependências**: Task 1.1, Task 1.3

**Story Points**: 2

---

## Phase 2: Claude Provider Refactor (8 SP)

### Objetivo
Extrair a lógica existente de Claude para a nova arquitetura de providers, mantendo 100% de retrocompatibilidade.

### 2.1 Claude Stream Parser

**Descrição**: Extrair e adaptar o parser de stream do Claude para o novo formato normalizado.

**Arquivos a criar**:
- `src/ai-providers/stream-parsers/base-parser.ts`
- `src/ai-providers/stream-parsers/claude-parser.ts`

**Arquivos a modificar**:
- `src/utils/stream-parser.ts` (deprecar funções, manter por retrocompatibilidade)

**Funcionalidades**:
- `ClaudeStreamParser.parse(line)` - Parse de linha JSON
- `ClaudeStreamParser.normalize(event)` - Normalização para formato comum
- Mapeamento: system→init, assistant→text/tool_start, user→tool_end, result→result

**Testes necessários**:
- `tests/ai-providers/stream-parsers/claude-parser.test.ts`
  - Parse de evento `system.init`
  - Parse de evento `assistant` com texto
  - Parse de evento `assistant` com tool_use
  - Parse de evento `user` com tool_result
  - Parse de evento `result` com métricas
  - Linha inválida retorna null
  - Fixtures com exemplos reais de output Claude

**Critérios de aceitação**:
- [ ] Todos tipos de evento Claude mapeados
- [ ] Métricas extraídas corretamente (duration, tokens, cost)
- [ ] Compatível com formato NormalizedStreamEvent
- [ ] Cobertura de testes >= 90%

**Dependências**: Task 1.2

**Story Points**: 3

---

### 2.2 Claude Provider Implementation

**Descrição**: Implementar ClaudeProvider usando BaseAIProvider.

**Arquivos a criar**:
- `src/ai-providers/claude-provider.ts`

**Configuração**:
- Models: opus (high), sonnet (medium), haiku (low)
- Context window: 200K
- CLI command: `claude`
- Flags: -p, --model, --output-format stream-json, --dangerously-skip-permissions, --verbose

**Testes necessários**:
- `tests/ai-providers/claude-provider.test.ts`
  - `isInstalled()` detecta Claude CLI
  - `getDefaultModel()` retorna 'sonnet'
  - `mapModelTier()` mapeamento correto
  - `validateModel()` aceita opus/sonnet/haiku
  - `validateModel()` rejeita modelos inválidos
  - `buildArgs()` gera argumentos corretos
  - `execute()` (mock spawn) - modo interativo
  - `executeHeadless()` (mock spawn) - modo headless com métricas

**Critérios de aceitação**:
- [ ] Comportamento idêntico a `executeClaudeCommand()` atual
- [ ] Suporta todos flags existentes
- [ ] Métricas coletadas corretamente
- [ ] Stream parsing funcionando

**Dependências**: Task 1.3, Task 2.1

**Story Points**: 3

---

### 2.3 Retrocompatibility Proxy

**Descrição**: Atualizar `src/utils/claude.ts` para usar novo provider mantendo API existente.

**Arquivos a modificar**:
- `src/utils/claude.ts`

**Mudanças**:
- Registrar ClaudeProvider na inicialização
- `executeClaudeCommand()` vira proxy para novo provider
- Adicionar JSDoc @deprecated
- Manter exports existentes

**Testes necessários**:
- `tests/utils/claude.test.ts` (existente)
  - Todos testes existentes devem continuar passando
  - Adicionar teste de proxy para novo provider

**Critérios de aceitação**:
- [ ] Todos testes existentes passam sem modificação
- [ ] Deprecation warning no JSDoc
- [ ] Funcionalidade idêntica
- [ ] Sem breaking changes na API pública

**Dependências**: Task 2.2

**Story Points**: 1

---

### 2.4 Provider Bootstrap

**Descrição**: Registrar ClaudeProvider automaticamente no bootstrap da aplicação.

**Arquivos a modificar**:
- `src/ai-providers/index.ts`

**Mudanças**:
- Import e instância de ClaudeProvider
- Registro automático no aiProviderRegistry
- Export da instância para uso direto

**Testes necessários**:
- `tests/ai-providers/bootstrap.test.ts`
  - ClaudeProvider registrado automaticamente
  - `getAIProvider('claude')` funciona após import

**Critérios de aceitação**:
- [ ] Claude disponível imediatamente após import
- [ ] Lazy loading quando possível
- [ ] Sem side effects indesejados

**Dependências**: Task 2.2, Task 2.3

**Story Points**: 1

---

## Phase 3: Gemini Provider (13 SP)

### Objetivo
Implementar suporte completo ao Gemini CLI como segundo AI provider.

### 3.1 Gemini Stream Parser

**Descrição**: Implementar parser para formato de stream JSON do Gemini CLI.

**Arquivos a criar**:
- `src/ai-providers/stream-parsers/gemini-parser.ts`

**Formato Gemini (baseado na pesquisa)**:
- Event types: init, message, tool_use, tool_result, error, result
- Campos: timestamp, session_id, role, content, name, parameters, success, output, duration, tokens

**Testes necessários**:
- `tests/ai-providers/stream-parsers/gemini-parser.test.ts`
  - Parse de evento `init`
  - Parse de evento `message` (user e assistant)
  - Parse de evento `tool_use`
  - Parse de evento `tool_result` (success e error)
  - Parse de evento `error`
  - Parse de evento `result` com métricas
  - Fixtures com exemplos reais ou simulados de Gemini CLI

**Critérios de aceitação**:
- [ ] Todos tipos de evento Gemini mapeados
- [ ] Normalização para formato comum
- [ ] Tratamento de erros robusto
- [ ] Cobertura de testes >= 90%

**Dependências**: Task 1.2

**Story Points**: 3

---

### 3.2 Gemini Provider Implementation

**Descrição**: Implementar GeminiProvider usando BaseAIProvider.

**Arquivos a criar**:
- `src/ai-providers/gemini-provider.ts`

**Configuração**:
- Models: gemini-2.5-pro (high), gemini-2.5-flash (medium), gemini-2.0-flash-lite (low)
- Context window: 1M
- CLI command: `gemini`
- Flags: -p, --model, --output-format stream-json, --yolo (= --dangerously-skip-permissions), --verbose

**Testes necessários**:
- `tests/ai-providers/gemini-provider.test.ts`
  - `isInstalled()` detecta Gemini CLI
  - `getDefaultModel()` retorna 'gemini-2.5-flash'
  - `mapModelTier()` mapeamento correto
  - `validateModel()` aceita modelos Gemini
  - `buildArgs()` gera argumentos corretos (incluindo `--yolo`)
  - Mock tests para `execute()` e `executeHeadless()`

**Critérios de aceitação**:
- [ ] Compatível com interface AIProvider
- [ ] Mapeamento correto de flags (--yolo = --dangerously-skip-permissions)
- [ ] Métricas coletadas corretamente
- [ ] Detecção de instalação funcionando

**Dependências**: Task 1.3, Task 3.1

**Story Points**: 3

---

### 3.3 Gemini Provider Bootstrap

**Descrição**: Registrar GeminiProvider automaticamente no bootstrap.

**Arquivos a modificar**:
- `src/ai-providers/index.ts`

**Mudanças**:
- Import e instância de GeminiProvider
- Registro automático junto com ClaudeProvider
- Export das instâncias

**Testes necessários**:
- `tests/ai-providers/bootstrap.test.ts` (adicionar)
  - GeminiProvider registrado automaticamente
  - `getAIProvider('gemini')` funciona após import
  - `aiProviderRegistry.getAll()` retorna ambos providers

**Critérios de aceitação**:
- [ ] Gemini disponível após import do módulo
- [ ] Não falha se Gemini CLI não estiver instalado
- [ ] Lista de providers completa

**Dependências**: Task 3.2

**Story Points**: 1

---

### 3.4 Unified Display Handler

**Descrição**: Criar display handler unificado que funciona com NormalizedStreamEvent.

**Arquivos a criar**:
- `src/ai-providers/stream-display.ts`

**Funcionalidades**:
- `handleEvent(event)` - Processa evento normalizado
- Spinner management para tool execution
- Métricas acumuladas
- Output formatado consistente

**Testes necessários**:
- `tests/ai-providers/stream-display.test.ts`
  - `handleEvent()` para cada tipo de evento
  - Métricas acumuladas corretamente
  - Spinner gerenciado corretamente

**Critérios de aceitação**:
- [ ] Funciona com eventos de ambos providers
- [ ] Output visual consistente
- [ ] Métricas coletadas de forma unificada
- [ ] Compatível com output atual do ADK

**Dependências**: Task 1.2

**Story Points**: 3

---

### 3.5 Integration Tests

**Descrição**: Criar testes de integração para ambos providers.

**Arquivos a criar**:
- `tests/ai-providers/integration/claude.integration.test.ts`
- `tests/ai-providers/integration/gemini.integration.test.ts`
- `tests/ai-providers/integration/fallback.integration.test.ts`

**Cenários**:
- Claude: execução simples, métricas, erros
- Gemini: execução simples, métricas, erros
- Fallback: Claude indisponível → usa Gemini
- Fallback: Gemini indisponível → usa Claude

**Critérios de aceitação**:
- [ ] Testes executam apenas se CLI instalado (skip graceful)
- [ ] Cobertura de cenários reais
- [ ] Testes de fallback funcionando

**Dependências**: Task 3.2, Task 3.3

**Story Points**: 3

---

## Phase 4: Integration (13 SP)

### Objetivo
Integrar o sistema de providers com CLI, configuração e comandos existentes.

### 4.1 Model Router Extension

**Descrição**: Estender model router para suportar mapeamento multi-provider.

**Arquivos a modificar**:
- `src/utils/model-router.ts`
- `src/types/model.ts`

**Mudanças**:
- `getModelForPhase()` aceita provider como parâmetro
- Usa `aiProvider.mapModelTier()` para obter modelo correto
- Mantém retrocompatibilidade (sem provider = Claude)

**Testes necessários**:
- `tests/utils/model-router.test.ts` (atualizar)
  - `getModelForPhase()` com provider Claude
  - `getModelForPhase()` com provider Gemini
  - Override funciona para ambos providers
  - Default funciona corretamente

**Critérios de aceitação**:
- [ ] Retrocompatibilidade mantida (sem provider = Claude)
- [ ] Mapeamento correto para cada provider
- [ ] Tiers funcionam para ambos

**Dependências**: Task 3.2

**Story Points**: 2

---

### 4.2 Configuration System Extension

**Descrição**: Adicionar configuração de AI providers ao sistema de config.

**Arquivos a modificar**:
- `src/utils/config.ts`
- `src/providers/types.ts` (AdkConfig interface)

**Mudanças**:
- Adicionar `aiProvider?: AIProviderConfig` em AdkConfig
- `getAIProviderConfig()` - carrega config com defaults
- `updateAIProviderConfig()` - persiste mudanças

**Testes necessários**:
- `tests/utils/config.test.ts` (atualizar)
  - `getAIProviderConfig()` retorna defaults
  - `updateAIProviderConfig()` persiste mudanças
  - Validação de valores

**Critérios de aceitação**:
- [ ] Config carrega e salva corretamente
- [ ] Defaults sensatos
- [ ] Merge com config existente funciona

**Dependências**: Task 1.1

**Story Points**: 2

---

### 4.3 Environment Variable Support

**Descrição**: Adicionar suporte a variável de ambiente ADK_AI_PROVIDER.

**Arquivos a modificar**:
- `src/ai-providers/index.ts`

**Mudanças**:
- `getConfigured()` verifica `process.env.ADK_AI_PROVIDER` primeiro
- Priority: ENV > config > default
- Warning se CLI não instalado

**Testes necessários**:
- `tests/ai-providers/env.test.ts`
  - `ADK_AI_PROVIDER=gemini` seleciona Gemini
  - `ADK_AI_PROVIDER=invalid` faz fallback
  - Sem variável usa config

**Critérios de aceitação**:
- [ ] Variável de ambiente tem prioridade sobre config
- [ ] Valores inválidos fazem graceful fallback
- [ ] Warning quando CLI não instalado

**Dependências**: Task 1.4

**Story Points**: 1

---

### 4.4 CLI Global Flags

**Descrição**: Adicionar flags `--provider` e `--model` globais na CLI.

**Arquivos a modificar**:
- `src/cli.ts`
- `src/cli-v3.ts`

**Mudanças**:
- Flags `-P, --provider <name>` e `-M, --model <model>` no programa principal
- Propagação para comandos via options
- Help atualizado

**Testes necessários**:
- `tests/cli.test.ts` (atualizar ou criar)
  - `--provider gemini` passa para comando
  - `--model opus` passa para comando
  - Help mostra novas opções

**Critérios de aceitação**:
- [ ] Flags disponíveis em todos comandos
- [ ] Help atualizado
- [ ] Propagação correta para comandos

**Dependências**: Task 4.2

**Story Points**: 2

---

### 4.5 Command Updates

**Descrição**: Atualizar comandos para usar novo sistema de providers.

**Arquivos a modificar**:
- `src/commands/feature.ts`
- `src/commands/agent.ts`
- `src/commands/workflow.ts`

**Mudanças**:
- Obter provider de options ou config
- Verificar instalação antes de executar
- Usar `provider.execute()` ou `provider.executeHeadless()`
- Coletar métricas

**Testes necessários**:
- `tests/commands/feature.test.ts` (atualizar)
  - research com provider default
  - research com --provider gemini
  - implement com provider
  - Fallback quando provider não instalado

**Critérios de aceitação**:
- [ ] Todos comandos usam novo sistema
- [ ] Flags funcionam corretamente
- [ ] Mensagens de erro claras
- [ ] Métricas coletadas

**Dependências**: Task 4.1, Task 4.3, Task 4.4

**Story Points**: 3

---

### 4.6 Fallback Manager

**Descrição**: Implementar sistema de fallback automático entre providers.

**Arquivos a criar**:
- `src/ai-providers/fallback-manager.ts`

**Funcionalidades**:
- `executeWithFallback(prompt, options)` - Executa com fallback automático
- Detecta falha do provider primário
- Troca para fallback se configurado
- Logging do motivo do fallback

**Testes necessários**:
- `tests/ai-providers/fallback-manager.test.ts`
  - Execução sem fallback (provider funciona)
  - Fallback acionado quando primary falha
  - Sem fallback quando config desabilitado
  - Erro propagado quando ambos falham
  - Log de fallback inclui motivo

**Critérios de aceitação**:
- [ ] Fallback em < 2 segundos (RNF04)
- [ ] Logging claro do motivo
- [ ] Respeita configuração
- [ ] Retry no provider original na próxima execução

**Dependências**: Task 4.2, Task 3.5

**Story Points**: 3

---

## Phase 5: Polish (8 SP)

### Objetivo
Finalizar com documentação, comando de configuração e testes end-to-end.

### 5.1 Config Providers Command

**Descrição**: Implementar comando `adk config providers` para listar e configurar providers.

**Arquivos a criar**:
- `src/commands/config-providers.ts`

**Arquivos a modificar**:
- `src/commands/config.ts`
- `src/cli.ts`

**Funcionalidades**:
- `listProviders()` - Lista providers com status de instalação
- `setDefaultProvider(name)` - Define provider padrão
- Exibe modelos disponíveis por provider

**Testes necessários**:
- `tests/commands/config-providers.test.ts`
  - `listProviders()` mostra todos providers
  - `setDefaultProvider()` atualiza config
  - Erro para provider inválido

**Critérios de aceitação**:
- [ ] Lista clara de providers e modelos
- [ ] Indica status de instalação
- [ ] Permite configurar default e fallback
- [ ] Help completo

**Dependências**: Task 4.2

**Story Points**: 2

---

### 5.2 Type Exports

**Descrição**: Criar re-exports públicos para tipos de AI providers.

**Arquivos a criar**:
- `src/types/ai-provider.ts`

**Arquivos a modificar**:
- `src/types/index.ts`

**Exports**:
- Todos tipos de `src/ai-providers/types.ts`
- Todos tipos de `src/ai-providers/stream-parsers/types.ts`

**Testes necessários**:
- `tests/types/exports.test.ts`
  - Todos tipos importáveis de `adk/types`

**Critérios de aceitação**:
- [ ] Tipos públicos exportados corretamente
- [ ] Sem exports de tipos internos
- [ ] Documentação JSDoc nos tipos principais

**Dependências**: Task 1.1, Task 1.2

**Story Points**: 1

---

### 5.3 Documentation Update

**Descrição**: Atualizar documentação com informações sobre multi-provider.

**Arquivos a modificar**:
- `CLAUDE.md`

**Arquivos a criar**:
- `.claude/docs/multi-provider.md`

**Conteúdo**:
- Overview de providers suportados
- Configuração via CLI, ENV, arquivo
- Model selection por tier/fase
- Automatic fallback
- Listagem de providers

**Critérios de aceitação**:
- [ ] Documentação clara e completa
- [ ] Exemplos funcionais
- [ ] CLAUDE.md atualizado com quick reference

**Dependências**: Todas tasks anteriores

**Story Points**: 2

---

### 5.4 End-to-End Tests

**Descrição**: Criar testes E2E para cenários completos de uso.

**Arquivos a criar**:
- `tests/e2e/multi-provider.e2e.test.ts`

**Cenários**:
- Provider selection via CLI flag
- Provider selection via config
- Provider listing command
- Fallback behavior

**Critérios de aceitação**:
- [ ] Testes cobrem cenários principais
- [ ] Skip graceful se CLIs não instalados
- [ ] Cleanup após testes

**Dependências**: Todas tasks anteriores

**Story Points**: 2

---

### 5.5 Metrics Collection Update

**Descrição**: Garantir que métricas são coletadas uniformemente de ambos providers.

**Arquivos a modificar**:
- `src/ai-providers/stream-display.ts`
- `src/types/parallel.ts` (se necessário)

**Mudanças**:
- Adicionar `provider?: AIProviderName` em CollectedMetrics
- Garantir preenchimento consistente

**Testes necessários**:
- `tests/ai-providers/metrics.test.ts`
  - Métricas Claude coletadas corretamente
  - Métricas Gemini coletadas corretamente
  - Provider identificado nas métricas

**Critérios de aceitação**:
- [ ] Métricas consistentes entre providers
- [ ] Provider identificado
- [ ] Compatível com sistema existente de métricas

**Dependências**: Task 3.4

**Story Points**: 1

---

## Verification Points

### Pontos de Verificação (após cada fase)

| Fase | Checkpoint | Comando de Verificação |
|------|------------|------------------------|
| Phase 1 | Abstração compilando | `npm run type-check` |
| Phase 2 | Testes Claude passando | `npm test -- --grep "Claude"` |
| Phase 3 | Gemini funcional | `npm test -- --grep "Gemini"` |
| Phase 4 | CLI integrada | `adk config providers` |
| Phase 5 | E2E passando | `npm run test:e2e` |

### Critérios de Go/No-Go

**Phase 1 → Phase 2:**
- [ ] Interfaces compilando sem erros
- [ ] Testes de tipos passando
- [ ] Registry funcional

**Phase 2 → Phase 3:**
- [ ] Todos testes existentes passando
- [ ] ClaudeProvider funcional
- [ ] Proxy retrocompatível

**Phase 3 → Phase 4:**
- [ ] GeminiProvider funcional
- [ ] Stream parsers testados
- [ ] Testes de integração passando

**Phase 4 → Phase 5:**
- [ ] CLI flags funcionando
- [ ] Configuração persistindo
- [ ] Fallback funcionando

---

## Test Strategy

### Níveis de Teste

| Nível | Cobertura Target | Responsabilidade |
|-------|------------------|------------------|
| Unit | 90% | Cada função isolada |
| Integration | 80% | Interação entre módulos |
| E2E | 70% | Fluxos completos |

### Fixtures Necessários

1. **Claude Stream Events**
   - `tests/fixtures/claude-stream/init.json`
   - `tests/fixtures/claude-stream/text.json`
   - `tests/fixtures/claude-stream/tool_use.json`
   - `tests/fixtures/claude-stream/tool_result.json`
   - `tests/fixtures/claude-stream/result.json`

2. **Gemini Stream Events**
   - `tests/fixtures/gemini-stream/init.json`
   - `tests/fixtures/gemini-stream/message.json`
   - `tests/fixtures/gemini-stream/tool_use.json`
   - `tests/fixtures/gemini-stream/tool_result.json`
   - `tests/fixtures/gemini-stream/result.json`

### Mocking Strategy

- `child_process.spawn` - Mock para testes unitários
- Installation checks - Mock para verificação de instalação
- Real execution - Apenas testes de integração marcados como `@slow`

---

## Risk Mitigation

### Mitigações Implementadas por Fase

| Risco | Fase | Mitigação |
|-------|------|-----------|
| Breaking changes | 2 | Proxy retrocompatível em claude.ts |
| Gemini CLI não instalado | 3 | Graceful skip em testes, mensagem clara |
| Diferenças de formato | 3 | Parser com normalização robusta |
| Fallback lento | 4 | Timeout de 2s, detecção prévia |
| Config corruption | 4 | Validação de schema, defaults |

---

## Dependencies Graph

```
Phase 1: Foundation
  1.1 Core Types ─────────────────────────────────────────┐
  1.2 Stream Parser Types ─────────────┐                  │
  1.3 Base Provider ──────────────────────────────────────┤
  1.4 Registry ───────────────────────────────────────────┘
                                       │
Phase 2: Claude Refactor              │
  2.1 Claude Stream Parser ────────────┘
  2.2 Claude Provider ─────────────────┐
  2.3 Retrocompat Proxy ───────────────┤
  2.4 Claude Bootstrap ────────────────┘
                                       │
Phase 3: Gemini Provider               │
  3.1 Gemini Stream Parser ────────────┤
  3.2 Gemini Provider ─────────────────┤
  3.3 Gemini Bootstrap ────────────────┤
  3.4 Unified Display ─────────────────┤
  3.5 Integration Tests ───────────────┘
                                       │
Phase 4: Integration                   │
  4.1 Model Router Ext ────────────────┤
  4.2 Config System Ext ───────────────┤
  4.3 ENV Variable Support ────────────┤
  4.4 CLI Global Flags ────────────────┤
  4.5 Command Updates ─────────────────┤
  4.6 Fallback Manager ────────────────┘
                                       │
Phase 5: Polish                        │
  5.1 Config Providers Cmd ────────────┤
  5.2 Type Exports ────────────────────┤
  5.3 Documentation ───────────────────┤
  5.4 E2E Tests ───────────────────────┤
  5.5 Metrics Update ──────────────────┘
```

---

## Summary

Este plano implementa suporte multi-provider em 5 fases incrementais:

1. **Foundation**: Abstração base seguindo padrões existentes
2. **Claude Refactor**: Extrair lógica existente para novo sistema
3. **Gemini Provider**: Implementar segundo provider
4. **Integration**: Conectar com CLI, config e comandos
5. **Polish**: Documentação, comando de config e testes E2E

**Total**: 24 tasks, 50 story points

**Princípios-chave**:
- TDD em todas as fases
- Retrocompatibilidade 100%
- Reuso de padrões existentes (Provider Registry)
- Checkpoint + context cleanup entre tasks

---

*Plano criado em: 2026-01-28*
*Última atualização: 2026-01-28*
