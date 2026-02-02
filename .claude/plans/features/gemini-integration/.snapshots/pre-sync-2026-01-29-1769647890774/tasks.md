# Tasks: gemini-integration

**Complexidade:** Complexa
**Total de Tasks:** 18 (target: 15-25 baseado na complexidade)
**Data de Criação:** 2026-01-28

---

## Fase 1: Foundation (Abstração Core)

### Task 1.1: Criar tipos e interfaces base do sistema de AI Providers

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** nenhuma

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/types.ts` com interfaces: `AIProvider`, `AIProviderOptions`, `AIProviderResult`, `AIProviderModel`, `AIProviderConfig`
  - Criar tipo `AIProviderName = 'claude' | 'gemini'`
  - Criar tipo `ModelTier = 'high' | 'medium' | 'low'`
  - Criar interface `StreamEvent` normalizada (comum a todos providers)
  - Criar testes unitários para validação de tipos (type guards)
- O que NÃO FAZER:
  - Implementar classes concretas
  - Modificar código existente

#### Critérios de Aceite
- [ ] Arquivo `src/ai-providers/types.ts` criado com todas interfaces documentadas
- [ ] Testes de type guards passando
- [ ] Build passa sem erros de tipo

#### Arquivos Envolvidos
- `src/ai-providers/types.ts` - criar
- `tests/ai-providers/types.test.ts` - criar

---

### Task 1.2: Implementar BaseAIProvider e AIProviderRegistry

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 1.1

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/base-provider.ts` com classe abstrata `BaseAIProvider`
  - Implementar métodos comuns: `isInstalled()` caching, validação de modelo, error handling
  - Criar `src/ai-providers/index.ts` com `AIProviderRegistry` (pattern igual a `src/providers/index.ts`)
  - Exportar funções: `registerAIProvider()`, `getAIProvider()`, `getConfiguredAIProvider()`
  - Testes unitários para Registry e BaseProvider
- O que NÃO FAZER:
  - Implementar providers concretos (Claude/Gemini)
  - Integrar com CLI ainda

#### Critérios de Aceite
- [ ] `BaseAIProvider` implementa métodos abstratos e concretos documentados
- [ ] `AIProviderRegistry` permite registrar e obter providers
- [ ] Cache de `isInstalled()` funciona corretamente
- [ ] Cobertura de testes ≥ 80% para ambos arquivos

#### Arquivos Envolvidos
- `src/ai-providers/base-provider.ts` - criar
- `src/ai-providers/index.ts` - criar
- `tests/ai-providers/base-provider.test.ts` - criar
- `tests/ai-providers/registry.test.ts` - criar

---

## Fase 2: Claude Provider Refactor

### Task 2.1: Criar ClaudeStreamParser extraindo lógica de stream-parser.ts

**Tipo:** Refactor
**Estimativa:** M (2-4h)
**Dependências:** Task 1.1

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/stream-parsers/types.ts` com interfaces de parsing
  - Criar `src/ai-providers/stream-parsers/base-parser.ts` com classe abstrata
  - Criar `src/ai-providers/stream-parsers/claude-parser.ts` extraindo lógica específica do Claude de `stream-parser.ts`
  - Manter `stream-parser.ts` como facade que usa o novo parser internamente
  - Testes unitários para o parser com fixtures de eventos reais
- O que NÃO FAZER:
  - Quebrar a API pública de `stream-parser.ts`
  - Modificar comportamento visual do output

#### Critérios de Aceite
- [ ] `ClaudeStreamParser` parseia corretamente eventos: system, assistant, user, result
- [ ] `stream-parser.ts` mantém mesma API pública
- [ ] Output visual permanece idêntico
- [ ] Testes com fixtures de eventos Claude reais

#### Arquivos Envolvidos
- `src/ai-providers/stream-parsers/types.ts` - criar
- `src/ai-providers/stream-parsers/base-parser.ts` - criar
- `src/ai-providers/stream-parsers/claude-parser.ts` - criar
- `src/utils/stream-parser.ts` - modificar (usar novo parser)
- `tests/ai-providers/stream-parsers/claude-parser.test.ts` - criar

---

### Task 2.2: Implementar ClaudeProvider completo

**Tipo:** Refactor
**Estimativa:** G (4-8h)
**Dependências:** Task 1.2, Task 2.1

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/claude-provider.ts` implementando `AIProvider`
  - Extrair lógica de execução de `src/utils/claude.ts`
  - Implementar `execute()`, `executeHeadless()`, `mapModelTier()`, `getInstallationGuide()`
  - Registrar automaticamente no AIProviderRegistry
  - Manter `src/utils/claude.ts` como proxy de retrocompatibilidade (deprecated)
  - Testes de integração validando execução real
- O que NÃO FAZER:
  - Quebrar `executeClaudeCommand()` existente
  - Mudar comportamento padrão

#### Critérios de Aceite
- [ ] `ClaudeProvider` implementa toda interface `AIProvider`
- [ ] `executeClaudeCommand()` continua funcionando (proxy)
- [ ] Todos comandos existentes funcionam sem modificação
- [ ] Métricas coletadas corretamente via `CollectedMetrics`
- [ ] Testes de integração passando

#### Arquivos Envolvidos
- `src/ai-providers/claude-provider.ts` - criar
- `src/utils/claude.ts` - modificar (adicionar deprecation, criar proxy)
- `tests/ai-providers/claude-provider.test.ts` - criar

---

## Fase 3: Gemini Provider

### Task 3.1: Criar GeminiStreamParser para formato stream-json do Gemini CLI

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 2.1

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/stream-parsers/gemini-parser.ts`
  - Parsear eventos: init, message, tool_use, tool_result, error, result
  - Normalizar eventos Gemini para interface `StreamEvent` comum
  - Testes com fixtures baseadas na documentação do Gemini CLI
- O que NÃO FAZER:
  - Modificar parser do Claude
  - Assumir formato não documentado

#### Critérios de Aceite
- [ ] Parser reconhece todos tipos de eventos documentados do Gemini
- [ ] Eventos normalizados para `StreamEvent` comum
- [ ] Métricas extraídas corretamente (tokens, duração, custo)
- [ ] Testes com fixtures de exemplo

#### Arquivos Envolvidos
- `src/ai-providers/stream-parsers/gemini-parser.ts` - criar
- `tests/ai-providers/stream-parsers/gemini-parser.test.ts` - criar

---

### Task 3.2: Implementar GeminiProvider completo

**Tipo:** Feature
**Estimativa:** G (4-8h)
**Dependências:** Task 1.2, Task 3.1

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/gemini-provider.ts` implementando `AIProvider`
  - Implementar detecção de instalação (`which gemini`)
  - Implementar `execute()` e `executeHeadless()` usando Gemini CLI flags
  - Mapear tiers: high→gemini-2.5-pro, medium→gemini-2.5-flash, low→gemini-2.0-flash-lite
  - Implementar `getInstallationGuide()` com instruções de instalação
  - Registrar no AIProviderRegistry
  - Testes unitários e de integração
- O que NÃO FAZER:
  - Implementar fallback automático (task separada)
  - Modificar configuração ainda

#### Critérios de Aceite
- [ ] `GeminiProvider` implementa toda interface `AIProvider`
- [ ] Detecção de instalação funciona
- [ ] Execução headless com stream-json funciona
- [ ] Model tier mapping correto
- [ ] Mensagem clara se Gemini não instalado

#### Arquivos Envolvidos
- `src/ai-providers/gemini-provider.ts` - criar
- `tests/ai-providers/gemini-provider.test.ts` - criar

---

## Fase 4: Model Router com Multi-Provider

### Task 4.1: Estender model-router.ts para suportar múltiplos providers

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 2.2, Task 3.2

#### Escopo
- O que FAZER:
  - Estender `src/types/model.ts` com tipos para multi-provider
  - Adicionar `MODEL_TIER_MAPPING` para Claude e Gemini
  - Criar `getModelForPhaseAndProvider(phase, provider, override?)`
  - Manter `getModelForPhase()` funcionando (assume provider padrão)
  - Testes para todas combinações phase/provider/tier
- O que NÃO FAZER:
  - Quebrar API existente de `getModelForPhase()`
  - Adicionar configuração (task separada)

#### Critérios de Aceite
- [ ] Mapping de tiers correto para ambos providers
- [ ] `getModelForPhase()` mantém comportamento atual
- [ ] Nova função `getModelForPhaseAndProvider()` funciona
- [ ] Testes cobrem todas combinações

#### Arquivos Envolvidos
- `src/types/model.ts` - modificar
- `src/utils/model-router.ts` - modificar
- `tests/utils/model-router.test.ts` - modificar

---

## Fase 5: Sistema de Configuração

### Task 5.1: Implementar AIProviderConfig no sistema de configuração

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 1.1

#### Escopo
- O que FAZER:
  - Estender `src/providers/types.ts` com `AIProviderConfig`
  - Estender `AdkConfig` com campo `aiProvider`
  - Criar defaults: `default: 'claude'`, `autoFallback: true`
  - Implementar loading/saving de configuração em `src/utils/config.ts`
  - Suportar env var `ADK_AI_PROVIDER`
  - Testes para prioridade: CLI > ENV > projeto > global > default
- O que NÃO FAZER:
  - Implementar CLI flags (task separada)
  - Implementar fallback logic (task separada)

#### Critérios de Aceite
- [ ] `AIProviderConfig` definido com todos campos do PRD
- [ ] Config carrega corretamente de arquivo
- [ ] Env var `ADK_AI_PROVIDER` sobrescreve config
- [ ] Defaults funcionam se sem configuração
- [ ] Testes de prioridade passando

#### Arquivos Envolvidos
- `src/providers/types.ts` - modificar
- `src/utils/config.ts` - modificar
- `tests/utils/config.test.ts` - modificar

---

### Task 5.2: Adicionar comando `adk config providers` para listar providers

**Tipo:** Feature
**Estimativa:** P (< 2h)
**Dependências:** Task 5.1, Task 2.2, Task 3.2

#### Escopo
- O que FAZER:
  - Adicionar subcomando `providers` em `src/commands/config.ts`
  - Listar providers registrados com status de instalação
  - Mostrar modelos disponíveis por provider com tiers
  - Indicar provider e modelo default
  - Formatação visual com chalk
- O que NÃO FAZER:
  - Modificar configuração via este comando
  - Adicionar flags interativas

#### Critérios de Aceite
- [ ] `adk config providers` lista claude e gemini
- [ ] Mostra ✅ ou ❌ se instalado
- [ ] Lista modelos por tier corretamente
- [ ] Indica defaults claramente

#### Arquivos Envolvidos
- `src/commands/config.ts` - modificar
- `tests/commands/config.test.ts` - modificar

---

## Fase 6: CLI Integration

### Task 6.1: Adicionar flags --provider e --model globais no CLI

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 4.1, Task 5.1

#### Escopo
- O que FAZER:
  - Adicionar opções `--provider` e `--model` em `src/cli.ts`
  - Passar provider/model para commands relevantes: feature, agent, workflow
  - Criar helper `resolveProvider(options)` que aplica prioridade
  - Validar provider/model contra valores válidos
  - Mostrar erro claro se provider não instalado
- O que NÃO FAZER:
  - Modificar lógica interna dos comandos (próxima task)
  - Implementar fallback

#### Critérios de Aceite
- [ ] `adk feature research X --provider gemini` aceita flag
- [ ] `adk agent run X --model haiku` aceita flag
- [ ] Erro claro se `--provider invalid`
- [ ] Help mostra opções válidas

#### Arquivos Envolvidos
- `src/cli.ts` - modificar
- `src/utils/provider-resolver.ts` - criar
- `tests/cli.test.ts` - modificar

---

### Task 6.2: Atualizar comandos para usar abstração de AI Provider

**Tipo:** Refactor
**Estimativa:** G (4-8h)
**Dependências:** Task 6.1

#### Escopo
- O que FAZER:
  - Modificar `src/commands/feature.ts` para usar `getConfiguredAIProvider()`
  - Modificar `src/commands/agent.ts` para usar abstração
  - Modificar `src/commands/workflow.ts` para usar abstração
  - Manter comportamento padrão (Claude) se sem configuração
  - Passar options de provider/model corretamente
- O que NÃO FAZER:
  - Modificar prompts dos comandos
  - Adicionar lógica de fallback nos comandos

#### Critérios de Aceite
- [ ] `adk feature research X --provider gemini` usa Gemini
- [ ] `adk feature implement X` usa Claude (default)
- [ ] `adk workflow qa X --provider gemini` funciona
- [ ] Todos testes existentes continuam passando

#### Arquivos Envolvidos
- `src/commands/feature.ts` - modificar
- `src/commands/agent.ts` - modificar
- `src/commands/workflow.ts` - modificar
- `tests/commands/feature.test.ts` - modificar
- `tests/commands/agent.test.ts` - modificar

---

## Fase 7: Fallback System

### Task 7.1: Implementar mecanismo de fallback automático entre providers

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 6.2, Task 5.1

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/fallback-manager.ts`
  - Detectar falhas: CLI não instalado, rate limit, erro de execução
  - Tentar provider de fallback se `autoFallback: true`
  - Logar motivo da falha e ação de fallback
  - Respeitar `aiProvider.fallback` da configuração
  - Testes simulando cenários de falha
- O que NÃO FAZER:
  - Implementar retry com backoff (pode ser futuro)
  - Modificar comandos (já usam abstração)

#### Critérios de Aceite
- [ ] Fallback acionado se provider principal falha
- [ ] Log claro: "⚠️ Claude unavailable, falling back to Gemini..."
- [ ] Não faz fallback se `autoFallback: false`
- [ ] Erro final se ambos providers falham
- [ ] Fallback em < 2 segundos (RNF04)

#### Arquivos Envolvidos
- `src/ai-providers/fallback-manager.ts` - criar
- `src/ai-providers/index.ts` - modificar (usar fallback manager)
- `tests/ai-providers/fallback-manager.test.ts` - criar

---

## Fase 8: Métricas e Observabilidade

### Task 8.1: Unificar coleta de métricas entre providers

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 6.2

#### Escopo
- O que FAZER:
  - Criar `src/ai-providers/metrics-collector.ts`
  - Coletar métricas uniformes: tokens in/out, duração, custo, provider usado
  - Integrar com `CollectedMetrics` existente
  - Adicionar campo `provider` às métricas
  - Exibir métricas no summary de execução
  - Testes validando coleta para ambos providers
- O que NÃO FAZER:
  - Implementar persistência de métricas (futuro)
  - Criar comando `adk metrics` (futuro)

#### Critérios de Aceite
- [ ] Métricas coletadas uniformemente para Claude e Gemini
- [ ] Summary mostra provider usado
- [ ] Formato: "✨ Concluído [provider] 12.3s · 5 turns · 10 tools · $0.0234"
- [ ] Testes validam coleta

#### Arquivos Envolvidos
- `src/ai-providers/metrics-collector.ts` - criar
- `src/ai-providers/base-provider.ts` - modificar
- `src/utils/stream-parser.ts` - modificar (mostrar provider)
- `tests/ai-providers/metrics-collector.test.ts` - criar

---

## Fase 9: Polish e Documentação

### Task 9.1: Criar re-exports e atualizar type exports públicos

**Tipo:** Config
**Estimativa:** P (< 2h)
**Dependências:** Todas tasks de implementação

#### Escopo
- O que FAZER:
  - Criar `src/types/ai-provider.ts` com re-exports para uso externo
  - Atualizar `src/index.ts` se existir (exports públicos)
  - Garantir que tipos públicos estejam documentados
  - Verificar que não há exports duplicados ou conflitantes
- O que NÃO FAZER:
  - Exportar implementações internas
  - Modificar tipos existentes

#### Critérios de Aceite
- [ ] Tipos públicos acessíveis via import correto
- [ ] Sem erros de tipo no build
- [ ] JSDoc em interfaces públicas

#### Arquivos Envolvidos
- `src/types/ai-provider.ts` - criar
- `src/index.ts` - modificar (se existir)

---

### Task 9.2: Atualizar CLAUDE.md e criar documentação em .claude/docs/

**Tipo:** Docs
**Estimativa:** M (2-4h)
**Dependências:** Todas tasks anteriores

#### Escopo
- O que FAZER:
  - Atualizar `CLAUDE.md` com seção de Multi AI Provider
  - Criar `.claude/docs/multi-ai-provider.md` com documentação detalhada
  - Documentar: configuração, flags CLI, fallback, troubleshooting
  - Incluir exemplos de uso para cenários comuns
  - Atualizar Quick Reference no CLAUDE.md
- O que NÃO FAZER:
  - Criar documentação externa (README principal)
  - Documentar APIs internas

#### Critérios de Aceite
- [ ] CLAUDE.md atualizado com exemplos
- [ ] Documentação cobre todos use cases do PRD
- [ ] Troubleshooting para "Gemini não instalado"
- [ ] Exemplos de configuração testados

#### Arquivos Envolvidos
- `CLAUDE.md` - modificar
- `.claude/docs/multi-ai-provider.md` - criar

---

### Task 9.3: Adicionar testes end-to-end para fluxos completos

**Tipo:** Feature
**Estimativa:** M (2-4h)
**Dependências:** Task 6.2, Task 7.1

#### Escopo
- O que FAZER:
  - Criar `tests/e2e/multi-provider.test.ts`
  - Testar fluxo: feature research com Gemini
  - Testar fluxo: feature implement com fallback
  - Testar configuração via arquivo e env var
  - Usar mocks para CLIs externos (não depender de instalação real)
- O que NÃO FAZER:
  - Testes que requerem API keys reais
  - Testes de performance (benchmark separado)

#### Critérios de Aceite
- [ ] E2E para seleção de provider via CLI
- [ ] E2E para fallback automático
- [ ] E2E para configuração por projeto
- [ ] Todos testes passam em CI (mocked)

#### Arquivos Envolvidos
- `tests/e2e/multi-provider.test.ts` - criar
- `tests/fixtures/gemini-events.json` - criar
- `tests/fixtures/claude-events.json` - criar

---

## Resumo de Dependências

```
Task 1.1 ─────┬─────► Task 1.2 ─────┬─────► Task 2.2 ─────┬─────► Task 4.1 ─────► Task 6.1 ─────► Task 6.2 ─────┬─────► Task 7.1
              │                     │                     │                                                     │
              │                     │                     └─────► Task 3.2 ──────────────────────────────────────┤
              │                     │                                                                            │
              └─────► Task 2.1 ─────┴─────► Task 3.1 ──────────────────────────────────────────────────────────────┤
                                                                                                                  │
Task 5.1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                                             │
    └─────► Task 5.2                                                                                              │
                                                                                                                  │
                                                                                                              Task 8.1
                                                                                                                  │
                                                                                                              Task 9.1
                                                                                                                  │
                                                                                                              Task 9.2
                                                                                                                  │
                                                                                                              Task 9.3
```

---

## Ordem Sugerida de Execução

| Ordem | Task | Pode Paralelizar Com |
|-------|------|---------------------|
| 1 | 1.1 | - |
| 2 | 1.2, 2.1, 5.1 | Sim, independentes após 1.1 |
| 3 | 2.2, 3.1 | Sim, independentes |
| 4 | 3.2 | - |
| 5 | 4.1 | - |
| 6 | 5.2, 6.1 | Sim |
| 7 | 6.2 | - |
| 8 | 7.1, 8.1 | Sim |
| 9 | 9.1, 9.2, 9.3 | Sim |

---

*Documento gerado em 2026-01-28*
*Total de Tasks: 18*
*Estimativa Total: 2 tarefas P + 11 tarefas M + 5 tarefas G = ~50-70 horas de trabalho*
