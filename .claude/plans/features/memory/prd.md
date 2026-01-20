# PRD: Sistema de Memoria Especializada

**Feature**: memory
**Data**: 2026-01-13
**Status**: Draft
**Prioridade**: P0

## Contexto e Problema

### Problema Principal

O ADK atualmente sofre com quatro problemas criticos relacionados a gestao de contexto:

1. **Perda de contexto entre sessoes**: Ao iniciar uma nova sessao do Claude Code, informacoes importantes sobre o andamento de features sao perdidas, exigindo que o desenvolvedor re-explique o contexto ou que o Claude re-analise arquivos.

2. **Contexto muito grande/caro**: Os arquivos de memoria atuais (`.claude/memory/`) sao genericos e monoliticos, consumindo tokens desnecessarios ao carregar informacoes irrelevantes para a task atual.

3. **Atualizacao manual**: Nao existe mecanismo automatico para persistir aprendizados e decisoes tomadas durante o desenvolvimento. O usuario precisa lembrar de atualizar manualmente.

4. **Falta de especializacao**: A estrutura atual de memoria (`project-context.md`, `architecture.md`, `current-state.md`) nao suporta memorias especializadas por feature, causando poluicao de contexto.

### Situacao Atual

```
.claude/memory/
├── project-context.md   (~293 linhas - contexto global)
├── architecture.md      (~455 linhas - arquitetura geral)
├── current-state.md     (~38 linhas - estado superficial)
└── conventions.md       (convencoes gerais)
```

**Limitacoes**:
- Todos os arquivos sao carregados independente da task
- Nao ha memoria por feature ou PRD
- Comandos ADK nao atualizam memoria automaticamente
- Nao ha busca eficiente em arquivos grandes

### Melhores Praticas 2026 (Pesquisa)

Baseado em pesquisa da documentacao oficial e artigos especializados:

1. **Hierarquia de 4 niveis**: Enterprise → Project → Rules → User
2. **Arquivos lean**: Maximo 500-1000 linhas por arquivo
3. **Modularidade**: Usar `.claude/rules/` para regras especificas
4. **Import recursivo**: Sintaxe `@path/to/import` com max 5 niveis
5. **Uso de grep**: Para arquivos grandes, usar busca ao inves de leitura completa

**Fontes**:
- https://code.claude.com/docs/en/memory
- https://cuong.io/blog/2025/06/15-claude-code-best-practices-memory-management

## Usuarios e Personas

### Persona Primaria: Desenvolvedor usando ADK

**Perfil**: Desenvolvedor que usa ADK para automatizar desenvolvimento com Claude Code

**Frequencia de uso**: Diario, multiplas vezes por dia

**Necessidades**:
- Retomar trabalho em features sem perder contexto
- Economizar tokens evitando contexto desnecessario
- Ter registro automatico de decisoes e aprendizados
- Buscar informacoes historicas rapidamente

### Persona Secundaria: Time de Desenvolvimento

**Perfil**: Equipe usando ADK em projeto compartilhado

**Necessidades**:
- Compartilhar contexto entre membros
- Manter historico de decisoes por feature
- Onboarding rapido em features existentes

## Requisitos Funcionais

### RF01: Comando memory save

Salva contexto atual para uma feature especifica.

```gherkin
Cenario: Salvar memoria de feature
  Dado que estou trabalhando na feature "auth"
  E tenho decisoes e padroes identificados na sessao
  Quando executo "adk memory save auth"
  Entao o sistema cria/atualiza ".claude/plans/features/auth/memory.md"
  E o arquivo contem: decisoes, padroes, riscos, estado atual
  E o arquivo respeita limite de 1000 linhas
  E exibe confirmacao com resumo do que foi salvo
```

```gherkin
Cenario: Salvar memoria automaticamente apos comando ADK
  Dado que executei "adk feature research auth"
  Quando o comando termina com sucesso
  Entao o sistema automaticamente executa logica de memory save
  E atualiza ".claude/plans/features/auth/memory.md"
  E registra fase concluida e aprendizados
```

### RF02: Comando memory load

Carrega memoria de feature para sessao atual.

```gherkin
Cenario: Carregar memoria de feature existente
  Dado que existe memoria salva para feature "auth"
  Quando executo "adk memory load auth"
  Entao o sistema le ".claude/plans/features/auth/memory.md"
  E injeta contexto no prompt para Claude Code
  E exibe resumo do contexto carregado
```

```gherkin
Cenario: Carregar memoria inexistente
  Dado que NAO existe memoria para feature "nova-feature"
  Quando executo "adk memory load nova-feature"
  Entao exibe mensagem informativa
  E sugere criar feature primeiro com "adk feature new"
```

### RF03: Comando memory compact

Compacta memoria grande para economizar tokens.

```gherkin
Cenario: Compactar memoria que excede limite
  Dado que existe memoria para feature "auth"
  E o arquivo tem mais de 1000 linhas
  Quando executo "adk memory compact auth"
  Entao o sistema gera prompt para Claude resumir
  E cria versao compactada mantendo informacoes essenciais
  E arquiva versao original em "memory-archive/"
  E novo arquivo respeita limite de 1000 linhas
```

```gherkin
Cenario: Compactar memoria ja dentro do limite
  Dado que memoria da feature "auth" tem 500 linhas
  Quando executo "adk memory compact auth"
  Entao exibe mensagem "Memoria ja esta otimizada (500/1000 linhas)"
  E NAO modifica o arquivo
```

### RF04: Comando memory search

Busca em memorias usando grep otimizado.

```gherkin
Cenario: Buscar termo em todas as memorias
  Dado que existem memorias para features "auth", "payments", "users"
  Quando executo "adk memory search 'JWT token'"
  Entao o sistema usa grep para buscar em todos os arquivos memory.md
  E exibe resultados com: feature, linha, contexto
  E ordena por relevancia (numero de matches)
```

```gherkin
Cenario: Buscar em feature especifica
  Dado que existe memoria para feature "auth"
  Quando executo "adk memory search 'JWT' --feature auth"
  Entao busca apenas em ".claude/plans/features/auth/memory.md"
  E exibe linhas com contexto (3 linhas antes/depois)
```

### RF05: Comando memory view

Visualiza memoria de feature ou global.

```gherkin
Cenario: Visualizar memoria de feature
  Quando executo "adk memory view auth"
  Entao exibe conteudo de ".claude/plans/features/auth/memory.md"
  E formata com syntax highlighting
  E mostra estatisticas (linhas, ultima atualizacao)
```

```gherkin
Cenario: Visualizar memoria global
  Quando executo "adk memory view --global"
  Entao exibe conteudo de ".claude/memory/project-context.md"
  E lista memorias de features existentes
```

### RF06: Comando memory update

Atualiza memoria global do projeto.

```gherkin
Cenario: Atualizar memoria global
  Quando executo "adk memory update"
  Entao o sistema analisa estado atual do projeto
  E atualiza ".claude/memory/project-context.md"
  E atualiza ".claude/memory/current-state.md"
  E exibe diff das mudancas
```

### RF07: Integracao Automatica com Comandos ADK

```gherkin
Cenario: Atualizacao automatica apos feature research
  Dado que executo "adk feature research auth"
  Quando o comando completa com sucesso
  Entao automaticamente salva em memoria:
    | Campo | Valor |
    | fase_concluida | research |
    | arquivos_analisados | lista de arquivos |
    | riscos_identificados | lista de riscos |
    | proxima_fase | plan |
```

```gherkin
Cenario: Atualizacao automatica apos feature implement
  Dado que executo "adk feature implement auth --phase 1"
  Quando o comando completa com sucesso
  Entao automaticamente salva em memoria:
    | Campo | Valor |
    | fase_concluida | implement-phase-1 |
    | testes_criados | lista de arquivos |
    | decisoes_tecnicas | lista de decisoes |
    | proxima_fase | implement-phase-2 |
```

## Requisitos Nao-Funcionais

### RNF01: Performance

- **Busca**: < 100ms para busca em ate 50 arquivos de memoria
- **Save/Load**: < 200ms para operacoes de arquivo
- **Compact**: < 5s (envolve chamada ao Claude)

### RNF02: Limite de Tamanho

- **Maximo por arquivo**: 1000 linhas
- **Alerta**: Warning quando atingir 800 linhas (80%)
- **Acao automatica**: Sugerir compact quando atingir limite

### RNF03: Formato de Arquivo

Estrutura padrao para `memory.md`:

```markdown
# Memoria: [Feature Name]

**Ultima Atualizacao**: YYYY-MM-DD HH:MM
**Fase Atual**: [research|plan|implement|qa|deploy]
**Status**: [in_progress|blocked|completed]

## Resumo Executivo
[2-3 frases sobre o estado atual]

## Decisoes Arquiteturais
- [ADR-001]: Decisao X porque Y
- [ADR-002]: Decisao Z porque W

## Padroes Identificados
- Padrao A: usado em [arquivos]
- Padrao B: usado em [arquivos]

## Riscos e Dependencias
- Risco 1: [descricao] - Mitigacao: [acao]
- Dependencia 1: [descricao]

## Estado Atual
- Concluido: [lista]
- Em progresso: [lista]
- Pendente: [lista]

## Proximos Passos
1. [acao 1]
2. [acao 2]

## Historico de Fases
| Data | Fase | Resultado |
|------|------|-----------|
| YYYY-MM-DD | research | completed |
```

### RNF04: Compatibilidade

- Funciona com estrutura CADD existente
- Retrocompativel com memorias globais atuais
- Nao quebra workflows existentes

### RNF05: Atomicidade

- Operacoes de escrita sao atomicas (write completo ou nada)
- Backup automatico antes de compact

## Metricas de Sucesso

### Metricas Primarias

| Metrica | Baseline | Meta | Como Medir |
|---------|----------|------|------------|
| Tokens por sessao | ~50k | -30% (~35k) | Comparar /cost antes/depois |
| Re-perguntas de contexto | Frequente | Raro | Observacao qualitativa |
| Tempo de onboarding | ~5min | ~1min | Tempo ate primeira acao util |

### Metricas Secundarias

| Metrica | Meta | Como Medir |
|---------|------|------------|
| Adocao do comando | 80% das sessoes | Logs de uso |
| Memorias por feature | >= 1 por feature ativa | Contagem de arquivos |
| Compactacoes realizadas | Quando necessario | Logs de compact |

### Criterios de Sucesso

1. **Continuidade**: Claude retoma trabalho sem re-analise em 90% dos casos
2. **Economia**: Reducao mensuravel no consumo de tokens
3. **Usabilidade**: Comandos sao intuitivos e uteis

## Non-Goals (Fora do Escopo)

1. **Interface grafica**: Apenas CLI, sem UI web ou desktop
2. **Sincronizacao cloud**: Memoria local apenas, sem sync remoto
3. **Versionamento de memoria**: Sem historico de versoes (apenas archive)
4. **Memoria entre projetos**: Cada projeto tem suas memorias isoladas
5. **Integracao com outros LLMs**: Apenas Claude Code
6. **Criptografia de memoria**: Arquivos em texto plano

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Memoria fica grande demais | Media | Alto | Comando compact + alertas automaticos |
| Formato inconsistente | Baixa | Medio | Template padrao + validacao |
| Perda de memoria | Baixa | Alto | Backup antes de compact, git tracking |
| Overhead de performance | Baixa | Medio | Operacoes async, grep otimizado |
| Adocao baixa | Media | Alto | Integracao automatica com comandos |

## Dependencias

### Internas
- `src/commands/feature.ts` - Integracao pos-comando
- `src/commands/workflow.ts` - Integracao pos-workflow
- `src/utils/claude.ts` - Para comando compact
- `src/utils/templates.ts` - Template de memoria

### Externas
- Claude Code CLI - Para compact (resumo inteligente)
- grep/ripgrep - Para busca eficiente

## Casos de Uso Detalhados

### UC01: Retomar Trabalho em Feature

```
1. Dev inicia nova sessao
2. Dev: "adk memory load auth"
3. Sistema carrega contexto da feature auth
4. Dev: "adk feature implement auth"
5. Claude tem contexto completo, implementa sem re-perguntas
6. Ao final, sistema: "adk memory save auth" (automatico)
```

### UC02: Buscar Decisao Historica

```
1. Dev: "adk memory search 'por que usamos JWT'"
2. Sistema busca em todas as memorias
3. Exibe: "feature/auth/memory.md:45 - ADR-001: Usamos JWT porque..."
4. Dev tem resposta sem re-analisar codigo
```

### UC03: Economia de Tokens

```
1. Dev trabalha em feature "payments"
2. Sistema carrega apenas memoria de "payments"
3. NAO carrega memorias de "auth", "users", etc
4. Economia de ~15k tokens por sessao
```

## Aprovacoes

- [ ] Product Owner: _______________
- [ ] Tech Lead: _______________
- [ ] Desenvolvedor: _______________

---

**Criado por**: ADK Autopilot - PRD Creator Agent
**Revisado em**: 2026-01-13
