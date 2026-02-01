# PRD: Multi AI Provider Support (gemini-integration)

**Data:** 2026-01-28
**Status:** Draft
**Autor:** Auto-generated via ADK

---

## 1. Problema

### 1.1 Contexto Atual

O ADK (Agentic Development Kit) atualmente depende exclusivamente do Claude CLI como único provider de IA para todas as operações do framework CADD. Esta dependência única apresenta várias limitações:

1. **Vendor Lock-in**: Dependência total de um único fornecedor (Anthropic) sem alternativas
2. **Sem Free Tier**: Claude CLI não oferece tier gratuito, aumentando custos para experimentação e tasks menores
3. **Contexto Limitado**: Claude oferece 200K tokens de contexto, enquanto concorrentes oferecem até 1M tokens
4. **Sem Resiliência**: Se o Claude CLI falhar ou estiver indisponível, todo o sistema para
5. **Sem Flexibilidade**: Usuários não podem escolher o provider mais adequado para cada tipo de tarefa

### 1.2 Oportunidade

O Gemini CLI da Google foi lançado com características atrativas:
- **Free tier generoso**: 60 requests/min, 1000 requests/dia
- **Context window 5x maior**: 1M tokens vs 200K
- **Open source**: Licença Apache 2.0
- **Compatibilidade de interface**: Flags e output similares ao Claude CLI

---

## 2. Solução Proposta

Implementar uma **arquitetura de providers abstraída** que permita ao ADK trabalhar com múltiplos AI providers de forma transparente e intercambiável.

### 2.1 Visão Geral

```
┌─────────────────────────────────────────────────────┐
│                    ADK Commands                      │
│         (feature, agent, workflow, etc.)             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              AI Provider Registry                    │
│         (Factory + Configuration)                    │
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Claude Provider │     │  Gemini Provider │
│  - opus          │     │  - gemini-2.5-pro│
│  - sonnet        │     │  - gemini-2.5-flash
│  - haiku         │     │  - flash-lite    │
└─────────────────┘     └─────────────────┘
```

### 2.2 Componentes Principais

1. **AIProvider Interface**: Contrato comum para todos os providers
2. **Provider Registry**: Registro e factory de providers
3. **Model Router**: Roteamento inteligente baseado em tiers (high/medium/low)
4. **Stream Parsers**: Parsers específicos para cada formato de stream JSON
5. **Configuration System**: Configuração global e por projeto

---

## 3. Requisitos Funcionais

### 3.1 Seleção de Provider

- **RF01**: O sistema DEVE permitir selecionar o AI provider via flag CLI (`--provider claude|gemini`)
- **RF02**: O sistema DEVE suportar configuração de provider padrão via arquivo de configuração
- **RF03**: O sistema DEVE permitir override do provider padrão por comando
- **RF04**: O sistema DEVE validar se o provider selecionado está instalado antes de executar

### 3.2 Gerenciamento de Modelos

- **RF05**: O sistema DEVE mapear modelos entre providers usando tiers semânticos (high/medium/low)
- **RF06**: O sistema DEVE selecionar automaticamente o modelo apropriado baseado na fase do workflow
  - Research/Planning/PRD → tier `high`
  - Implementation/Docs → tier `medium`
  - QA/Validation → tier `low`
- **RF07**: O sistema DEVE permitir especificação explícita de modelo via flag `--model`
- **RF08**: O sistema DEVE listar modelos disponíveis por provider (`adk config providers`)

### 3.3 Fallback Automático

- **RF09**: O sistema DEVE suportar fallback automático para provider secundário em caso de falha
- **RF10**: O sistema DEVE permitir habilitar/desabilitar fallback via configuração
- **RF11**: O sistema DEVE logar quando fallback é acionado com motivo da falha original
- **RF12**: O sistema DEVE respeitar a ordem de fallback configurada

### 3.4 Execução e Output

- **RF13**: O sistema DEVE normalizar o output de diferentes providers para formato comum
- **RF14**: O sistema DEVE suportar modo headless (`--headless`) em todos os providers
- **RF15**: O sistema DEVE coletar métricas de execução (tokens in/out, duração) de forma uniforme
- **RF16**: O sistema DEVE manter retrocompatibilidade com `executeClaudeCommand()` existente

### 3.5 Configuração

- **RF17**: O sistema DEVE suportar configuração global em `~/.adk/config.json`
- **RF18**: O sistema DEVE suportar configuração por projeto em `.claude/config.json`
- **RF19**: O sistema DEVE suportar variável de ambiente `ADK_AI_PROVIDER`
- **RF20**: O sistema DEVE priorizar: flag CLI > env var > projeto > global > default

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- **RNF01**: A abstração de provider DEVE adicionar no máximo 50ms de overhead por execução
- **RNF02**: O sistema DEVE fazer cache de verificação de instalação por sessão
- **RNF03**: Stream parsing DEVE processar eventos em real-time sem buffering excessivo

### 4.2 Confiabilidade

- **RNF04**: Fallback DEVE ocorrer em menos de 2 segundos após detecção de falha
- **RNF05**: O sistema DEVE ter 99% de uptime considerando fallback entre providers
- **RNF06**: Erros de provider DEVEM ser logados com contexto suficiente para debugging

### 4.3 Usabilidade

- **RNF07**: Mensagens de erro DEVEM indicar claramente qual provider falhou e por quê
- **RNF08**: Configuração DEVE ter defaults sensatos que funcionem out-of-the-box
- **RNF09**: Documentação DEVE incluir exemplos de configuração para casos comuns

### 4.4 Manutenibilidade

- **RNF10**: Adicionar novo provider DEVE requerer apenas implementação da interface `AIProvider`
- **RNF11**: Código DEVE ter cobertura de testes mínima de 80%
- **RNF12**: Cada provider DEVE ter testes de integração independentes

### 4.5 Segurança

- **RNF13**: API keys NÃO DEVEM ser logadas em nenhuma circunstância
- **RNF14**: Configurações sensíveis DEVEM suportar variáveis de ambiente
- **RNF15**: Flags perigosas (como `--dangerously-skip-permissions`) DEVEM ser explicitamente opt-in

### 4.6 Compatibilidade

- **RNF16**: DEVE manter 100% de retrocompatibilidade com API pública existente
- **RNF17**: DEVE funcionar com Node.js >= 18.0.0
- **RNF18**: DEVE funcionar em macOS, Linux e Windows (WSL)

---

## 5. User Stories

### US01: Seleção de Provider via CLI

**Como** desenvolvedor usando ADK
**Quero** selecionar qual AI provider usar via linha de comando
**Para** ter controle sobre qual CLI será usada em cada execução

**Critérios de Aceitação:**
- [ ] Flag `--provider claude` executa usando Claude CLI
- [ ] Flag `--provider gemini` executa usando Gemini CLI
- [ ] Erro claro se provider não está instalado
- [ ] Help mostra providers disponíveis

**Exemplo de Uso:**
```bash
adk feature research my-feature --provider gemini
adk agent run analyzer --provider claude
```

---

### US02: Configuração de Provider Padrão

**Como** desenvolvedor com preferência por um provider específico
**Quero** configurar meu provider padrão uma vez
**Para** não precisar especificar em cada comando

**Critérios de Aceitação:**
- [ ] Comando `adk config set aiProvider.default gemini` funciona
- [ ] Configuração persiste em arquivo
- [ ] Configuração por projeto sobrescreve global
- [ ] Comando `adk config get aiProvider` mostra configuração atual

**Exemplo de Uso:**
```bash
adk config set aiProvider.default gemini
adk config set aiProvider.fallback claude
adk config set aiProvider.autoFallback true
```

---

### US03: Fallback Automático

**Como** desenvolvedor que precisa de alta disponibilidade
**Quero** que o sistema automaticamente use outro provider se o principal falhar
**Para** não ter meu workflow interrompido por falhas de um provider

**Critérios de Aceitação:**
- [ ] Se Claude falhar e fallback está configurado, usa Gemini automaticamente
- [ ] Mensagem indica que fallback foi acionado
- [ ] Retry com provider original em próxima execução
- [ ] Configurável via `aiProvider.autoFallback: true|false`

**Exemplo de Uso:**
```bash
# Configuração
adk config set aiProvider.default claude
adk config set aiProvider.fallback gemini
adk config set aiProvider.autoFallback true

# Execução - se Claude falhar, usa Gemini
adk feature implement my-feature
# Output: "⚠️ Claude unavailable, falling back to Gemini..."
```

---

### US04: Economia com Free Tier

**Como** desenvolvedor consciente de custos
**Quero** usar Gemini free tier para tasks menos críticas
**Para** reduzir custos sem comprometer qualidade em tasks importantes

**Critérios de Aceitação:**
- [ ] Configuração `preferFreeWhenAvailable` funciona
- [ ] Tasks de validação/QA usam Gemini quando configurado
- [ ] Tasks de research/planning continuam usando provider premium
- [ ] Métricas mostram economia estimada

**Exemplo de Uso:**
```bash
adk config set aiProvider.preferFreeWhenAvailable true

# QA usa Gemini (free tier)
adk workflow qa my-feature
# Output: "Using Gemini (free tier) for validation..."

# Research usa Claude (premium)
adk feature research my-feature
# Output: "Using Claude opus for research..."
```

---

### US05: Listar Providers e Modelos

**Como** desenvolvedor explorando opções
**Quero** ver quais providers e modelos estão disponíveis
**Para** tomar decisões informadas sobre qual usar

**Critérios de Aceitação:**
- [ ] Comando `adk config providers` lista providers
- [ ] Mostra se cada provider está instalado
- [ ] Lista modelos disponíveis por provider
- [ ] Indica modelo default de cada tier

**Exemplo de Uso:**
```bash
adk config providers

# Output:
# AI Providers disponíveis:
#
# ✅ claude (instalado)
#    Modelos:
#    - opus (high tier) - 200K context
#    - sonnet (medium tier) - 200K context  [DEFAULT]
#    - haiku (low tier) - 200K context
#
# ✅ gemini (instalado)
#    Modelos:
#    - gemini-2.5-pro (high tier) - 1M context
#    - gemini-2.5-flash (medium tier) - 1M context  [DEFAULT]
#    - gemini-2.0-flash-lite (low tier) - 1M context
```

---

### US06: Seleção de Modelo Específico

**Como** desenvolvedor com necessidade específica
**Quero** selecionar um modelo específico independente do tier
**Para** ter controle granular quando necessário

**Critérios de Aceitação:**
- [ ] Flag `--model` permite especificar modelo exato
- [ ] Erro se modelo não existe no provider selecionado
- [ ] Override funciona com qualquer provider
- [ ] Help lista modelos válidos

**Exemplo de Uso:**
```bash
# Usar modelo específico
adk feature research complex-feature --provider gemini --model gemini-2.5-pro

# Usar haiku para task rápida
adk agent run validator --provider claude --model haiku
```

---

### US07: Métricas de Uso

**Como** desenvolvedor monitorando custos
**Quero** ver métricas de uso por provider
**Para** entender meu consumo e otimizar custos

**Critérios de Aceitação:**
- [ ] Cada execução registra tokens in/out
- [ ] Cada execução registra duração
- [ ] Comando `adk metrics` mostra resumo
- [ ] Métricas separadas por provider

**Exemplo de Uso:**
```bash
adk metrics --last 7d

# Output:
# Uso dos últimos 7 dias:
#
# Claude:
#   Execuções: 45
#   Tokens In: 1.2M
#   Tokens Out: 340K
#   Tempo Total: 23min
#
# Gemini:
#   Execuções: 128
#   Tokens In: 890K
#   Tokens Out: 210K
#   Tempo Total: 15min
```

---

## 6. Escopo

### 6.1 Incluído (In Scope)

**Fase 1 - Fundação:**
- Interfaces e tipos para abstração de provider
- Classe base `BaseAIProvider`
- Refatoração do código Claude existente para `ClaudeProvider`
- Registry de providers
- Testes unitários da abstração

**Fase 2 - Gemini Provider:**
- Implementação completa do `GeminiProvider`
- Stream parser para Gemini JSON format
- Detecção de instalação
- Mapeamento de modelos
- Testes de integração

**Fase 3 - Integração:**
- Flags CLI (`--provider`, `--model`)
- Sistema de configuração
- Fallback automático
- Atualização de todos os comandos existentes
- Retrocompatibilidade de `executeClaudeCommand()`

**Fase 4 - Polish:**
- Comando `adk config providers`
- Documentação completa
- Métricas de uso básicas
- Testes end-to-end

### 6.2 Excluído (Out of Scope)

- **OpenAI/GPT Provider**: Pode ser adicionado futuramente, mas não nesta iteração
- **Ollama/Local Models**: Arquitetura suporta, mas implementação futura
- **UI/Dashboard de métricas**: Apenas CLI nesta fase
- **Rate limiting avançado**: Apenas retry básico, sem queue sofisticada
- **Cost estimation em tempo real**: Apenas métricas de tokens
- **A/B testing entre providers**: Não nesta versão
- **Provider-specific prompts**: Prompts serão os mesmos para todos providers

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Diferenças no formato stream JSON** | Alta | Médio | Parsers específicos por provider com suite de testes robusta |
| **Gemini CLI não instalado em máquinas de usuários** | Alta | Baixo | Graceful fallback para Claude, mensagem clara de instalação |
| **Rate limits do free tier Gemini** | Média | Médio | Auto-fallback para Claude quando limites atingidos |
| **Comportamento diferente entre modelos** | Alta | Alto | Testes extensivos comparando outputs, prompts adaptativos se necessário |
| **Output format incompatível** | Média | Médio | Camada de normalização de output robusta |
| **Breaking changes na API dos CLIs** | Baixa | Alto | Versioning de providers, testes de integração em CI |
| **Aumento de complexidade do código** | Média | Médio | Documentação clara, padrões de design consistentes |
| **Performance degradada com abstração** | Baixa | Baixo | Benchmarks, cache de verificações |

---

## 8. Métricas de Sucesso

### 8.1 Métricas Técnicas

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Overhead da abstração | < 50ms | Benchmark antes/depois |
| Cobertura de testes | ≥ 80% | Jest coverage report |
| Fallback success rate | ≥ 95% | Logs de fallback bem-sucedidos |
| Zero breaking changes | 0 | Testes de retrocompatibilidade |

### 8.2 Métricas de Adoção

| Métrica | Target (30 dias) | Como Medir |
|---------|------------------|------------|
| % usuários usando Gemini | ≥ 20% | Analytics de uso |
| % uso de fallback automático | ≤ 5% | Logs de fallback |
| Issues relacionados | ≤ 3 críticos | GitHub issues |
| Satisfação com feature | ≥ 4/5 | Feedback survey |

### 8.3 Métricas de Valor

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Redução de custos (free tier) | ≥ 30% para tasks QA | Comparativo de tokens |
| Aumento de disponibilidade | 99.5% uptime | Monitoramento de falhas |
| Tempo de resposta médio | Mantido ou melhorado | Métricas de duração |

---

## 9. Dependências

### 9.1 Dependências Externas

| Dependência | Tipo | Status | Notas |
|-------------|------|--------|-------|
| `@anthropic-ai/claude-code` | NPM | ✅ Existente | Já em uso no projeto |
| `@google/gemini-cli` | NPM | ⏳ A adicionar | Verificar versão estável |
| Node.js >= 18.0.0 | Runtime | ✅ Existente | Já requisito do projeto |
| Conta Google | Serviço | 📝 Opcional | Para free tier do Gemini |

### 9.2 Dependências Internas

| Componente | Dependência | Notas |
|------------|-------------|-------|
| `GeminiProvider` | `BaseAIProvider` | Provider base deve existir primeiro |
| CLI flags | `AIProviderRegistry` | Registry deve estar funcional |
| Fallback system | Ambos providers | Requires both providers implemented |
| Config system | Tipos de provider | Types devem estar definidos |

### 9.3 Pré-requisitos

- [ ] Research aprovado (este documento é derivado do research)
- [ ] Arquitetura de diretórios aprovada
- [ ] Interfaces base definidas e revisadas
- [ ] Gemini CLI disponível e testado manualmente

---

## 10. Timeline (Sugestão)

### Fase 1: Abstração e Fundação (2 dias)

**Entregáveis:**
- `src/ai-providers/types.ts` - Interfaces completas
- `src/ai-providers/base-provider.ts` - Classe base abstrata
- `src/ai-providers/index.ts` - Registry e factory
- Testes unitários da abstração

**Critérios de Done:**
- Interfaces revisadas e aprovadas
- Base class testada
- Registry funcional

---

### Fase 2: Claude Provider Refatorado (2 dias)

**Entregáveis:**
- `src/ai-providers/claude-provider.ts` - Implementação completa
- `src/ai-providers/stream-parsers/claude-parser.ts` - Parser extraído
- Proxy em `src/utils/claude.ts` para retrocompatibilidade
- Testes unitários e integração

**Critérios de Done:**
- Todos comandos existentes funcionando com novo provider
- Zero breaking changes na API pública
- Cobertura de testes ≥ 80%

---

### Fase 3: Gemini Provider (3 dias)

**Entregáveis:**
- `src/ai-providers/gemini-provider.ts` - Implementação completa
- `src/ai-providers/stream-parsers/gemini-parser.ts` - Parser de stream
- Detecção de instalação
- Mapeamento de modelos por tier
- Testes unitários e integração

**Critérios de Done:**
- Gemini provider funcional para todos comandos
- Stream parsing testado com outputs reais
- Fallback para Claude se Gemini não instalado

---

### Fase 4: Integração e CLI (2 dias)

**Entregáveis:**
- Flags `--provider` e `--model` em todos comandos relevantes
- Sistema de configuração (`adk config`)
- Fallback automático implementado
- Variável de ambiente `ADK_AI_PROVIDER`

**Critérios de Done:**
- Flags funcionais em todos comandos
- Configuração persistida corretamente
- Fallback testado em cenários de falha

---

### Fase 5: Polish e Documentação (1 dia)

**Entregáveis:**
- Comando `adk config providers`
- Atualização de CLAUDE.md
- Documentação em `.claude/docs/`
- Exemplos de configuração
- Release notes

**Critérios de Done:**
- Documentação completa e revisada
- Todos exemplos testados
- README atualizado

---

## 11. Arquitetura Técnica

### 11.1 Estrutura de Diretórios

```
src/
├── ai-providers/
│   ├── types.ts              # AIProvider, AIProviderOptions, etc.
│   ├── index.ts              # Registry, getProvider(), registerProvider()
│   ├── base-provider.ts      # BaseAIProvider abstract class
│   ├── claude-provider.ts    # ClaudeProvider implementation
│   ├── gemini-provider.ts    # GeminiProvider implementation
│   └── stream-parsers/
│       ├── types.ts          # StreamEvent, ParsedOutput
│       ├── claude-parser.ts  # Claude stream-json parser
│       └── gemini-parser.ts  # Gemini stream-json parser
├── types/
│   └── ai-provider.ts        # Re-exports for external use
└── utils/
    ├── claude.ts             # DEPRECATED - proxy to new system
    └── model-router.ts       # Phase-based model selection
```

### 11.2 Interfaces Principais

```typescript
export type AIProviderName = 'claude' | 'gemini'

export interface AIProvider {
  readonly name: AIProviderName
  readonly displayName: string
  readonly models: AIProviderModel[]

  isInstalled(): boolean
  execute(prompt: string, options?: AIProviderOptions): Promise<AIProviderResult>
  executeHeadless(prompt: string, options?: AIProviderOptions): Promise<AIProviderResult>
  getDefaultModel(): string
  mapModelTier(tier: 'high' | 'medium' | 'low'): string
}

export interface AIProviderConfig {
  default: AIProviderName
  fallback?: AIProviderName
  autoFallback: boolean
  preferFreeWhenAvailable: boolean
}
```

### 11.3 Mapeamento de Modelos

```typescript
const MODEL_TIER_MAPPING = {
  claude: {
    high: 'opus',
    medium: 'sonnet',
    low: 'haiku'
  },
  gemini: {
    high: 'gemini-2.5-pro',
    medium: 'gemini-2.5-flash',
    low: 'gemini-2.0-flash-lite'
  }
}

const PHASE_TIER_MAPPING = {
  research: 'high',
  planning: 'high',
  prd: 'high',
  implement: 'medium',
  qa: 'low',
  validation: 'low',
  docs: 'medium',
  default: 'medium'
}
```

---

## 12. Decisões de Design

### 12.1 Decisões Tomadas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Provider padrão | Claude | Mantém comportamento atual, sem breaking change |
| Auto-fallback default | Habilitado | Melhora resiliência out-of-the-box |
| Configuração por projeto | Suportada | Permite diferentes providers por projeto |
| Retrocompatibilidade | 100% | `executeClaudeCommand()` continua funcionando |

### 12.2 Decisões Pendentes

| Decisão | Opções | Responsável | Prazo |
|---------|--------|-------------|-------|
| Adicionar OpenAI provider futuro? | Sim/Não | Tech Lead | Pós-release |
| Suportar Ollama local? | Sim/Não | Tech Lead | Pós-release |
| Dashboard de métricas? | CLI only / Web | Product | v2.0 |

---

## 13. Checklist de Aprovação

### 13.1 Stakeholders

- [ ] **Product Owner**: Aprova escopo e priorização
- [ ] **Tech Lead**: Aprova arquitetura técnica
- [ ] **QA**: Aprova critérios de aceitação
- [ ] **DevOps**: Aprova dependências e CI/CD

### 13.2 Documentos Relacionados

- [x] Research Document: `research.md`
- [ ] Implementation Plan: `implementation-plan.md` (a ser criado)
- [ ] Tasks Breakdown: `tasks.md` (a ser criado)
- [ ] Test Plan: `test-plan.md` (a ser criado)

---

*Documento gerado em 2026-01-28*
*Última atualização: 2026-01-28*
