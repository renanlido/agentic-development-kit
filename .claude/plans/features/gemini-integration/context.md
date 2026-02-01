# gemini-integration Context

Inherits: .claude/memory/project-context.md

## Feature-specific Context

Implemente o multi ai provider e me forneça um meio de selecionar a CLI que eu quero usar no adk cli

---

# Research: Multi AI Provider Support (Claude + Gemini CLI)

**Data**: 2026-01-28
**Status**: Research Complete
**Autor**: ADK Team

---

## 1. Objetivo

Implementar suporte a múltiplos AI providers no ADK, permitindo escolha entre Claude CLI e Gemini CLI, com possibilidade de fallback automático e otimização de custos.

---

## 2. Análise Comparativa

### 2.1 Interfaces das CLIs

| Aspecto | Claude CLI | Gemini CLI |
|---------|------------|------------|
| **Pacote NPM** | `@anthropic-ai/claude-code` | `@google/gemini-cli` |
| **Comando** | `claude` | `gemini` |
| **Prompt direto** | `claude -p "..."` | `gemini -p "..."` |
| **Stream JSON** | `--output-format stream-json` | `--output-format stream-json` |
| **Seleção modelo** | `--model opus/sonnet/haiku` | `--model gemini-2.5-pro/flash` |
| **MCP Support** | ✅ Nativo | ✅ Nativo |
| **Licença** | Proprietário | Apache 2.0 |

### 2.2 Modelos Disponíveis

#### Claude (Anthropic)
| Modelo | Contexto | Uso Recomendado |
|--------|----------|-----------------|
| `opus` | 200K tokens | Tarefas complexas, research |
| `sonnet` | 200K tokens | Implementação, balanceado |
| `haiku` | 200K tokens | Validação, tasks rápidas |

#### Gemini (Google)
| Modelo | Contexto | Uso Recomendado |
|--------|----------|-----------------|
| `gemini-2.5-pro` | 1M tokens | Tarefas complexas, codebase grande |
| `gemini-2.5-flash` | 1M tokens | Implementação rápida |
| `gemini-2.0-flash-lite` | 1M tokens | Tasks simples, economia |

### 2.3 Pricing e Limites

#### Claude
- Requer API key ou subscription
- Sem free tier para CLI
- Pricing por token (input/output)

#### Gemini
- **Free tier**: 60 requests/min, 1000 requests/dia
- API key opcional para pay-as-you-go
- Context window 5x maior

### 2.4 Flags e Opções

#### Claude CLI
```bash
claude -p "prompt"                    # Prompt direto
claude --model sonnet                 # Selecionar modelo
claude --output-format stream-json    # Output streaming
claude --dangerously-skip-permissions # Skip confirmações
claude --verbose                      # Modo verboso
```

#### Gemini CLI
```bash
gemini -p "prompt"                    # Prompt direto
gemini --model gemini-2.5-pro         # Selecionar modelo
gemini --output-format stream-json    # Output streaming
gemini --include-directories dir1,dir2 # Include dirs
gemini --sandbox                      # Modo sandbox
```

---

## 3. Arquitetura Proposta

### 3.1 Estrutura de Diretórios

```
src/
├── ai-providers/
│   ├── types.ts              # Interfaces e tipos
│   ├── index.ts              # Registry e factory
│   ├── base-provider.ts      # Classe base abstrata
│   ├── claude-provider.ts    # Implementação Claude
│   ├── gemini-provider.ts    # Implementação Gemini
│   └── stream-parsers/
│       ├── types.ts          # Tipos de eventos
│       ├── claude-parser.ts  # Parser Claude
│       └── gemini-parser.ts  # Parser Gemini
├── types/
│   └── ai-provider.ts        # Tipos exportados
└── utils/
    └── claude.ts             # (deprecated, proxy para novo sistema)
```

### 3.2 Interfaces Principais

```typescript
// src/ai-providers/types.ts

export type AIProviderName = 'claude' | 'gemini'

export interface AIProviderModel {
  id: string
  name: string
  contextWindow: number
  tier: 'high' | 'medium' | 'low'
}

export interface AIProviderOptions {
  model?: string
  headless?: boolean
  showProgress?: boolean
  cwd?: string
  collectMetrics?: boolean
  timeout?: number
}

export interface AIProviderResult {
  success: boolean
  output?: string
  metrics?: ProviderMetrics
  error?: string
}

export interface ProviderMetrics {
  tokensIn: number
  tokensOut: number
  duration: number
  cost?: number
}

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
```

### 3.3 Mapeamento de Modelos por Tier

```typescript
// Mapeamento semântico entre providers

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

// Uso no phase routing
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

### 3.4 Configuração

```typescript
// Extensão do AdkConfig

export interface AIProviderConfig {
  default: AIProviderName
  fallback?: AIProviderName
  autoFallback: boolean
  preferFreeWhenAvailable: boolean
}

export interface AdkConfig {
  // ... existing config
  aiProvider: AIProviderConfig
}

// Exemplo de configuração
const config: AdkConfig = {
  aiProvider: {
    default: 'claude',
    fallback: 'gemini',
    autoFallback: true,
    preferFreeWhenAvailable: false
  }
}
```

---

## 4. Análise de Impacto

### 4.1 Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/utils/claude.ts` | Deprecate, proxy para novo sistema | Baixo |
| `src/types/model.ts` | Adicionar tipos de provider | Baixo |
| `src/providers/types.ts` | Adicionar AIProviderConfig | Baixo |
| `src/utils/model-router.ts` | Usar abstração de provider | Médio |
| `src/utils/stream-parser.ts` | Extrair para parsers específicos | Médio |
| `src/commands/feature.ts` | Usar novo provider system | Médio |
| `src/commands/agent.ts` | Usar novo provider system | Médio |

### 4.2 Arquivos a Criar

| Arquivo | Propósito |
|---------|-----------|
| `src/ai-providers/types.ts` | Interfaces e tipos |
| `src/ai-providers/index.ts` | Registry e exports |
| `src/ai-providers/base-provider.ts` | Classe base |
| `src/ai-providers/claude-provider.ts` | Provider Claude |
| `src/ai-providers/gemini-provider.ts` | Provider Gemini |
| `src/ai-providers/stream-parsers/*.ts` | Parsers de stream |

### 4.3 Breaking Changes

**Nenhum breaking change** - A API pública (`executeClaudeCommand`) será mantida como proxy para o novo sistema, garantindo retrocompatibilidade.

---

## 5. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Diferenças no stream JSON | Alta | Médio | Parsers específicos por provider |
| Gemini não instalado | Média | Baixo | Fallback automático para Claude |
| Rate limits Gemini free | Média | Médio | Queue com retry + fallback |
| Comportamento diferente entre modelos | Alta | Alto | Testes extensivos, prompts adaptativos |
| Output format incompatível | Média | Médio | Normalização de output |

---

## 6. Benefícios Esperados

### 6.1 Para Usuários

1. **Flexibilidade**: Escolher provider baseado em preferência/disponibilidade
2. **Economia**: Usar free tier do Gemini para tasks menos críticas
3. **Resiliência**: Fallback automático se um provider falhar
4. **Context maior**: Gemini oferece 1M tokens vs 200K

### 6.2 Para o Projeto

1. **Vendor independence**: Não depender de um único provider
2. **Competitividade**: Acompanhar evolução de múltiplos players
3. **Testabilidade**: Comparar resultados entre providers
4. **Escalabilidade**: Distribuir carga entre providers

---

## 7. Estimativa de Esforço

| Fase | Tasks | Complexidade | Estimativa |
|------|-------|--------------|------------|
| **1. Abstração** | Interfaces, tipos, base class | Baixa | 1 dia |
| **2. Claude Provider** | Refatorar código existente | Baixa | 1 dia |
| **3. Gemini Provider** | Nova implementação | Média | 2 dias |
| **4. Stream Parsers** | Parsers específicos | Média-Alta | 2 dias |
| **5. Integração** | Config, CLI, commands | Média | 1 dia |
| **6. Testes** | Unit + Integration | Média | 2 dias |
| **7. Documentação** | Docs, examples | Baixa | 1 dia |

**Total estimado**: ~10 dias de desenvolvimento

---

## 8. Dependências Externas

### 8.1 NPM Packages

```json
{
  "dependencies": {
    "@google/gemini-cli": "^1.x.x"  // Verificar versão atual
  }
}
```

### 8.2 Requisitos de Sistema

- Node.js >= 18.0.0
- Claude CLI instalado (para provider Claude)
- Gemini CLI instalado (para provider Gemini)
- Conta Google (para Gemini free tier)

---

## 9. Referências

- [Gemini CLI - GitHub](https://github.com/google-gemini/gemini-cli)
- [Gemini CLI - NPM](https://www.npmjs.com/package/@google/gemini-cli)
- [Gemini CLI Documentation](https://developers.google.com/gemini-code-assist/docs/gemini-cli)
- [Google Blog - Gemini CLI](https://blog.google/technology/developers/introducing-gemini-cli-open-source-ai-agent/)
- [Gemini CLI Tips - Addy Osmani](https://addyosmani.com/blog/gemini-cli/)

---

## 10. Próximos Passos

1. [ ] Aprovar research e arquitetura proposta
2. [ ] Criar feature branch
3. [ ] Implementar Phase 1 (Abstração)
4. [ ] Testar com Claude provider
5. [ ] Implementar Gemini provider
6. [ ] Testes de integração
7. [ ] Documentação
8. [ ] Release

---

## 11. Decisões Pendentes

1. **Qual provider será default?** Claude (atual) ou Gemini (free tier)?
2. **Auto-fallback habilitado por padrão?** Sim/Não
3. **Persistir preferência por projeto ou global?** Ambos com override
4. **Suportar outros providers futuros?** (OpenAI, Ollama local) Arquitetura extensível

---

*Documento gerado em 2026-01-28*


## Dependencies

[Liste dependências externas e internas]

## Related Files

[Liste arquivos relacionados para referência]
