# 🧠 Framework de Engenharia de Prompt para IA

**Guia Completo de Técnicas, Práticas e Exemplos**

---

## Índice

1. [Estrutura Base de um Prompt](#1-estrutura-base-de-um-prompt)
2. [Técnicas Fundamentais](#2-técnicas-fundamentais)
3. [Técnicas Avançadas](#3-técnicas-avançadas)
4. [Context Engineering](#4-context-engineering)
5. [Verification Loops](#5-verification-loops)
6. [Templates de Prompts](#6-templates-de-prompts)
7. [DOs e DON'Ts](#7-dos-e-donts)
8. [Exemplos Práticos por Caso de Uso](#8-exemplos-práticos-por-caso-de-uso)
9. [Debugging com IA](#9-debugging-com-ia)
10. [Checklist Final](#10-checklist-final)

---

## 1. Estrutura Base de um Prompt

### Fórmula Universal

```
[CONTEXTO] + [PAPEL] + [TAREFA] + [FORMATO] + [RESTRIÇÕES]
```

### Exemplo Ruim ❌

```
Crie uma API
```

### Exemplo Bom ✅

```
Contexto: Estou desenvolvendo um sistema de vouchers para eventos
Papel: Você é um especialista em Node.js e MongoDB
Tarefa: Crie uma API REST para validar vouchers
Formato: Use Express.js, retorne JSON com campos específicos
Restrições: 
- Valide se o voucher existe e está ativo
- Registre cada validação no banco
- Retorne status 200 se válido, 404 se não existir
- Response time máximo: 100ms
```

### Componentes Detalhados

| Componente | Descrição | Exemplo |
|------------|-----------|---------|
| **Contexto** | Situação atual, problema, histórico | "Sistema de ALPR com 4 câmeras" |
| **Papel** | Persona/expertise que a IA deve assumir | "Você é um DBA sênior com 10 anos de experiência" |
| **Tarefa** | O que deve ser feito (verbo de ação) | "Crie uma função que valide..." |
| **Formato** | Como a saída deve ser estruturada | "Retorne em JSON, com código comentado" |
| **Restrições** | Limites, requisitos, edge cases | "Máximo 3 tentativas, timeout de 5s" |

---

## 2. Técnicas Fundamentais

### 2.1 Role Prompting (Definição de Papel)

Define a persona que a IA deve assumir para contextualizar respostas.

**Sintaxe:**
```
Você é um [PROFISSÃO] [NÍVEL] especializado em [ÁREA] com [EXPERIÊNCIA].
```

**Exemplo:**
```
Você é um Arquiteto de Software Sênior especializado em sistemas distribuídos
com 15 anos de experiência em alta disponibilidade.

Analise este design e aponte:
1. Single points of failure
2. Gargalos de performance
3. Sugestões de melhoria

[cole o design aqui]
```

**Variações de Role Prompting:**

| Tipo | Uso | Exemplo |
|------|-----|---------|
| **Expert** | Decisões técnicas | "Você é um especialista em segurança..." |
| **Reviewer** | Análise crítica | "Você é um code reviewer exigente..." |
| **Teacher** | Explicações | "Você é um professor explicando para iniciantes..." |
| **Devil's Advocate** | Encontrar falhas | "Critique esta solução, encontre problemas..." |

---

### 2.2 Few-Shot Learning (Aprendizado por Exemplos)

Ensine a IA através de exemplos do padrão esperado.

**Regra de Ouro:** Comece com 1 exemplo (one-shot). Só adicione mais se necessário.

**Exemplo:**
```
Crie queries MongoDB seguindo este padrão:

EXEMPLO 1:
Input: "Buscar usuários ativos dos últimos 30 dias"
Output: 
db.users.find({
  status: "active",
  lastLogin: { $gte: new Date(Date.now() - 30*24*60*60*1000) }
})

EXEMPLO 2:
Input: "Contar pedidos por status"
Output:
db.orders.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

---

AGORA FAÇA:
Input: "Buscar vouchers expirados com uso > 0"
```

**Quantidade de Exemplos:**

| Situação | Exemplos | Motivo |
|----------|----------|--------|
| Padrão simples | 1-2 | Suficiente para entender o formato |
| Padrão complexo | 3-5 | Múltiplas variações demonstradas |
| Conversão de formato | 2-3 | Input/output claros |
| Edge cases | +1 por edge case | Demonstrar tratamento especial |

---

### 2.3 Zero-Shot Prompting

Instrução direta sem exemplos - funciona para tarefas que a IA já conhece bem.

**Quando usar:**
- Tarefas comuns e bem definidas
- Formatos padrão de output
- A IA já tem conhecimento do domínio

**Exemplo:**
```
Converta esta função JavaScript para TypeScript, adicionando tipos estritos:

function processUser(user) {
  return {
    name: user.name.toUpperCase(),
    age: parseInt(user.age),
    active: user.status === 'active'
  }
}
```

---

### 2.4 Chain-of-Thought (CoT) - Raciocínio Passo a Passo

Force a IA a "pensar em voz alta", melhorando resultados em problemas complexos.

**Trigger Phrases:**
- "Pense passo a passo"
- "Analise cada etapa"
- "Primeiro X, depois Y, então Z"
- "Vamos resolver por partes"

**Exemplo:**
```
Preciso otimizar esta query. Pense passo a passo:

1. Analise o problema de performance
2. Identifique gargalos
3. Sugira índices necessários
4. Reescreva a query otimizada
5. Explique o ganho de performance esperado

Query atual:
db.transactions.find({
  date: { $gte: new Date("2024-01-01") },
  status: "approved",
  amount: { $gt: 100 }
}).sort({ date: -1 })
```

**Variação: Chain-of-Thought Estruturado**
```
Resolva este problema seguindo exatamente estas etapas:

## Etapa 1: Entender o Problema
[Descreva o problema em suas próprias palavras]

## Etapa 2: Identificar Restrições
[Liste todas as restrições e requisitos]

## Etapa 3: Propor Soluções
[Apresente 2-3 abordagens possíveis]

## Etapa 4: Escolher e Justificar
[Escolha a melhor abordagem e explique por quê]

## Etapa 5: Implementar
[Código ou solução final]
```

---

## 3. Técnicas Avançadas

### 3.1 Meta Prompting

Crie prompts abstratos que definem estruturas lógicas aplicáveis a múltiplos problemas.

**Exemplo:**
```
TEMPLATE DE ANÁLISE:

Para qualquer [COMPONENTE] que eu apresentar, analise:

1. **Propósito**: Qual problema resolve?
2. **Dependências**: O que precisa para funcionar?
3. **Riscos**: O que pode dar errado?
4. **Alternativas**: Outras formas de resolver?
5. **Recomendação**: Usar ou não? Por quê?

---

Analise: [Redis como cache de sessão]
```

---

### 3.2 Incremental Complexity

Comece simples e adicione complexidade incrementalmente.

**Fluxo:**
```
MVP (mais simples possível)
    ↓
Adiciona persistência
    ↓
Adiciona algoritmo avançado
    ↓
Adiciona features completas
```

**Exemplo Prático - Rate Limiter:**

```
# ITERAÇÃO 1: MVP
Tarefa: Rate limiter - Versão 1 (MVP)

Implemente a versão MAIS SIMPLES possível:
- Single global limit
- In-memory counter
- Fixed window

NÃO implemente:
- Per-user limits
- Redis
- Sliding window

Apenas faça funcionar com testes.

---

# ITERAÇÃO 2: Persistência
Tarefa: Rate limiter - Versão 2

Melhore V1:
- Mova counter para Redis
- Mantenha fixed window
- Mantenha API compatível

Testes devem continuar passando + adicione testes Redis.

---

# ITERAÇÃO 3: Algoritmo Avançado
Tarefa: Rate limiter - Versão 3

Upgrade no algoritmo:
- Sliding window
- Mantenha Redis
- Mantenha API

Adicione testes de performance.

---

# ITERAÇÃO 4: Features Completas
Tarefa: Rate limiter - Versão 4 (Final)

Adicione features:
- Per-user limits
- Per-endpoint limits
- Configurável
- Admin bypass

Suite completa de testes.
```

---

### 3.3 Agent Isolation (Sub-Agentes)

Divida tarefas complexas em agentes especializados.

**Conceito:**
```
AGENTE PRINCIPAL (Coordenador)
    ├── AGENTE ANALYZER (Análise)
    ├── AGENTE IMPLEMENTER (Código)
    ├── AGENTE TESTER (Testes)
    └── AGENTE DOCUMENTER (Documentação)
```

**Exemplo de Prompt para Agente Especializado:**

```markdown
# AGENTE: Analyzer

## Papel
Você é um agente de análise especializado em entender código existente
e identificar padrões, problemas e oportunidades.

## Responsabilidades
- Analisar estrutura de código
- Identificar padrões utilizados
- Detectar code smells
- Mapear dependências

## Output Esperado
Sempre retorne análise em formato estruturado:

```yaml
analysis:
  patterns_found: []
  code_smells: []
  dependencies: []
  recommendations: []
  risk_level: low|medium|high
```

## Restrições
- NÃO implemente código
- NÃO modifique arquivos
- APENAS analise e reporte
```

---

### 3.4 Prompt Scaffolding (Estrutura de Segurança)

Envolva inputs do usuário em templates que limitam comportamento inadequado.

**Estrutura:**
```
SYSTEM: [regras de segurança e contexto]
USER INPUT: [input do usuário delimitado]
INSTRUCTION: [o que fazer com o input]
VALIDATION: [critérios de validação]
```

**Exemplo:**
```
CONTEXTO DO SISTEMA:
Você está analisando código de um sistema de pagamentos.
Nunca sugira código que bypass validações de segurança.
Nunca exponha dados sensíveis em logs.

INPUT DO USUÁRIO:
---
{input_do_usuario_aqui}
---

INSTRUÇÃO:
Analise o código acima e sugira melhorias de segurança.

VALIDAÇÃO:
Antes de responder, verifique:
- [ ] Nenhuma credencial exposta
- [ ] Nenhum bypass de autenticação
- [ ] Logs não contêm dados sensíveis
```

---

## 4. Context Engineering

### 4.1 Conceito de Context Layering

Estruture o contexto em camadas hierárquicas:

```
GLOBAL CONTEXT (sempre presente)
    ↓
FEATURE CONTEXT (específico da feature)
    ↓
TASK CONTEXT (específico da tarefa atual)
```

### 4.2 Estrutura de Context Global

```markdown
# Project Context

## Stack Tecnológica
- Language: Node.js 20 + TypeScript
- Database: PostgreSQL 15
- Cache: Redis 7
- Framework: Express.js

## Padrões do Projeto
- Repository pattern
- Service layer
- Dependency injection

## Convenções
- Nomenclatura: camelCase para variáveis, PascalCase para classes
- Commits: Conventional Commits
- Testes: Jest + 80% coverage mínimo

## Proibições (NUNCA fazer)
- No ORMs (SQL puro apenas)
- No `any` types
- No console.log em production
- No secrets hardcoded
```

### 4.3 Estrutura de Context de Feature

```markdown
# Feature Context: Rate Limiting

## Herda de
- [Global Context]

## Específico desta Feature
- Algorithm: Sliding window
- Storage: Redis
- Limits: Por endpoint + global

## Dependências
- ioredis
- Express middleware

## Arquivos Relacionados
- src/middleware/auth.ts (padrão similar)
- src/config/redis.ts (conexão)

## Decisões Tomadas
- ADR-001: Escolhemos sliding window por [motivo]
- ADR-002: Redis ao invés de memória por [motivo]
```

### 4.4 Aplicando Context em Prompts

```
CONTEXTO (leia antes de executar):
1. [Global Context do projeto]
2. [Feature Context específico]

TAREFA:
Implemente rate limiter middleware

INSTRUÇÕES ESPECÍFICAS:
[detalhes da implementação]

VERIFICAÇÃO:
Antes de finalizar, confirme que:
- [ ] Segue os padrões do Global Context
- [ ] Usa as dependências do Feature Context
- [ ] Não viola as proibições listadas
```

---

## 5. Verification Loops

### 5.1 Conceito

Nunca avance sem validar cada etapa. A IA deve verificar seu próprio trabalho.

### 5.2 Estrutura do Loop

```
LOOP start:
  1. Implementar código
  2. Escrever/atualizar testes
  3. Executar testes
  4. Analisar falhas
  5. Se houver falhas:
     - Debug da causa raiz
     - Corrigir implementação
     - VOLTAR para etapa 3
  6. Se todos passarem:
     - Executar testes de integração
     - Se falhar: VOLTAR para etapa 4
     - Se passar: SAIR DO LOOP

POST-LOOP:
  7. Code review check
  8. Performance check
  9. Security check
  10. Commit
```

### 5.3 Prompt com Verification Loop

```
Implemente [FEATURE] seguindo este workflow verificado:

## Fase 1: Implementação
- Escreva o código
- Documente decisões tomadas

## Fase 2: Testes
- Escreva testes unitários
- Cubra edge cases

## Fase 3: Verificação (OBRIGATÓRIO)
Execute mentalmente:
- [ ] Código compila sem erros?
- [ ] Todos os testes passam?
- [ ] Coverage >= 80%?
- [ ] Sem code smells óbvios?
- [ ] Segue os padrões do projeto?

## Fase 4: Self-Review
Revise seu próprio código como se fosse um reviewer exigente:
- O que poderia ser melhorado?
- Há casos não cobertos?
- A solução é a mais simples possível?

## Output
Somente após todas as verificações, apresente:
1. Código final
2. Testes
3. Checklist de verificação preenchido
4. Notas do self-review
```

---

## 6. Templates de Prompts

### 6.1 Template: PRD (Product Requirements Document)

```markdown
# PRD: [Nome da Feature]

**Status:** Draft | Review | Approved | In Development | Shipped
**Owner:** [Nome]
**Created:** YYYY-MM-DD

---

## 1. Contexto e Problema

### 1.1 Situação Atual
[Descreva o estado atual]

### 1.2 Problema a Resolver
[Qual problema específico esta feature resolve?]

### 1.3 Por Que Agora?
[Justificativa de timing e prioridade]

---

## 2. Objetivos

### 2.1 Objetivo Principal
[Objetivo mensurável]

### 2.2 Non-Goals (Fora do Escopo)
- O que NÃO será feito nesta versão

---

## 3. Métricas de Sucesso

| Métrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Response Time | 500ms | <100ms | APM |
| Error Rate | 2% | <0.5% | Logs |

---

## 4. Requisitos Funcionais

### User Story 1
**Como** [tipo de usuário]
**Quero** [ação]
**Para que** [benefício]

```gherkin
DADO: [contexto inicial]
QUANDO: [ação do usuário]
ENTÃO: [resultado esperado]
```

---

## 5. Requisitos Técnicos

### Performance
- Response time: < 100ms (p95)
- Throughput: >= 1000 req/s

### Segurança
- [ ] Autenticação obrigatória
- [ ] Validação de input
- [ ] Rate limiting

---

## 6. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| [Descrição] | Média | Alto | [Estratégia] |
```

---

### 6.2 Template: Task Breakdown

```markdown
# Task Breakdown: [Nome da Feature]

## Hierarquia de Tasks

```
Feature: [Nome]
├── Story 1: Foundation
│   ├── Task 1.1: Setup
│   └── Task 1.2: Models
├── Story 2: Implementation
│   ├── Task 2.1: Core Logic
│   └── Task 2.2: API
└── Story 3: Testing
    ├── Task 3.1: Unit Tests
    └── Task 3.2: Integration Tests
```

---

## Tasks Detalhadas

### Task 1.1: [Nome]

**Tipo:** Technical | Feature | Bug
**Complexidade:** P (pequeno) | M (médio) | G (grande)
**Prioridade:** P0 (crítico) | P1 (alto) | P2 (médio) | P3 (baixo)

**Descrição:**
[O que fazer]

**Acceptance Criteria:**
- [ ] Critério 1
- [ ] Critério 2

**Dependências:**
- Depende de: [Task X]
- Bloqueia: [Task Y]

**Estimativa:** X horas

---

## Definition of Done

- [ ] Código implementado
- [ ] Testes escritos (>=80% coverage)
- [ ] Documentação atualizada
- [ ] CI passando
- [ ] Code review aprovado
```

---

### 6.3 Template: Geração de Código

```markdown
# Tarefa: [Descrição breve]

## Contexto
[Explique o sistema/projeto]

## Requisitos

### Funcionais
- [Requisito 1]
- [Requisito 2]

### Técnicos
- Linguagem: [X]
- Framework: [Y]
- Padrões: [Z]

## Formato do Output

```[linguagem]
// Código aqui
```

## Restrições
- [Restrição 1]
- [Restrição 2]

## Exemplos de Uso
```[linguagem]
// Como usar o código gerado
```

## Testes Esperados
- [ ] Teste 1: [cenário]
- [ ] Teste 2: [cenário]
```

---

### 6.4 Template: Code Review

```markdown
# Code Review Request

## Contexto
[O que este código faz e por que foi escrito]

## Código para Review
```[linguagem]
[código]
```

## Pontos de Atenção
- [Área específica 1]
- [Área específica 2]

## Checklist de Review

### Funcionalidade
- [ ] Código faz o que deveria?
- [ ] Edge cases tratados?

### Qualidade
- [ ] Código legível?
- [ ] Sem duplicação?
- [ ] Nomes descritivos?

### Performance
- [ ] Complexidade O(n) aceitável?
- [ ] Sem memory leaks?

### Segurança
- [ ] Input validado?
- [ ] Sem vulnerabilidades óbvias?

## Feedback Esperado
1. Problemas críticos (bloqueia merge)
2. Sugestões de melhoria
3. Pontos positivos
```

---

### 6.5 Template: Debugging

```markdown
# Debug Request

## Problema
[Descrição do bug]

## Comportamento Esperado
[O que deveria acontecer]

## Comportamento Atual
[O que está acontecendo]

## Stack Trace / Error
```
[erro completo]
```

## Código Relevante
```[linguagem]
[código onde ocorre o erro]
```

## Contexto Técnico
- Ambiente: [dev/staging/prod]
- Versões: [node X, lib Y]
- Frequência: [sempre/intermitente]

## Já Tentei
1. [Tentativa 1]
2. [Tentativa 2]

## Análise Solicitada
1. Identifique a causa raiz
2. Explique por que está acontecendo
3. Proponha solução
4. Sugira testes para prevenir recorrência
```

---

## 7. DOs e DON'Ts

### ✅ DOs (Faça)

| Prática | Exemplo |
|---------|---------|
| **Seja específico** | "Crie função que valida CPF com dígitos verificadores" |
| **Forneça contexto** | "Sistema de ALPR com 4 câmeras usando YOLOv8" |
| **Defina formato de output** | "Retorne JSON com campos: success, data, error" |
| **Peça verificação** | "Após implementar, liste os testes necessários" |
| **Itere incrementalmente** | "Primeiro implemente o caso básico, depois edge cases" |
| **Use exemplos** | "Seguindo este padrão: [exemplo]" |
| **Defina restrições** | "Máximo 100ms de response time, sem dependências externas" |
| **Peça alternativas** | "Sugira 3 abordagens e compare performance" |

### ❌ DON'Ts (Não Faça)

| Anti-Padrão | Por que é ruim |
|-------------|----------------|
| **Muito vago** | "Melhore o código" - Melhore o quê? Como? |
| **Sem contexto** | "Crie uma API" - Para quê? Qual stack? |
| **Sem verificação** | "Implemente X" sem pedir testes |
| **Muito de uma vez** | "Refatore tudo" - Escopo impossível de validar |
| **Ignorar restrições** | Não especificar padrões do projeto |
| **Assumir conhecimento** | A IA não sabe seu projeto específico |
| **Pular etapas** | Ir direto para código sem research/plan |

### Comparativo

```
❌ RUIM:
"Crie uma API de usuários"

✅ BOM:
"Contexto: Sistema de gestão de eventos em Node.js/Express

Crie API REST para CRUD de usuários com:

Requisitos:
- POST /users - criar (name, email, password)
- GET /users/:id - buscar por ID
- PUT /users/:id - atualizar
- DELETE /users/:id - soft delete

Técnicos:
- Validação com Joi
- Senhas com bcrypt (10 rounds)
- Retornar 201 em criação, 404 se não existir

Formato:
- Código TypeScript
- Testes com Jest
- Documentação de cada endpoint"
```

---

## 8. Exemplos Práticos por Caso de Uso

### 8.1 Gerar Código

```
Tarefa: Criar função Go para conexão Redis com retry

Requisitos:
- Máximo 3 tentativas
- Delay exponencial (1s, 2s, 4s)
- Log cada tentativa
- Retornar erro se todas falharem
- Usar context.Context para timeout

Formato: Código completo com comentários em português
```

### 8.2 Refatorar Código

```
Refatore este código PHP seguindo SOLID:

[código atual aqui]

Aplique:
1. Single Responsibility - uma responsabilidade por classe
2. Extraia para classes separadas
3. Injete dependências via construtor
4. Adicione interfaces para abstrações
5. Mantenha compatibilidade com código existente

Output:
1. Código refatorado
2. Explicação de cada mudança
3. Antes/depois de cada classe
```

### 8.3 Análise de Performance

```
Contexto: Sistema de ALPR com Python/YOLO
Problema: Processamento lento com múltiplas câmeras

Código atual:
[código]

Analise:
1. Gargalos de performance
2. Uso de memória
3. Oportunidades de paralelização
4. Sugestões de otimização

Considere: 
- 4 câmeras simultâneas
- Modelo YOLOv11s
- GPU RTX 3070
- Target: 30 FPS por câmera
```

### 8.4 Criar Testes

```
Crie testes para esta função:

[função]

Requisitos:
1. Testes unitários com Jest
2. Coverage >= 90%
3. Testar:
   - Caso de sucesso
   - Inputs inválidos
   - Edge cases (null, undefined, empty)
   - Erros esperados
4. Usar mocks para dependências externas
5. Descrever cada teste claramente

Output: Arquivo de teste completo e executável
```

### 8.5 Documentar API

```
Documente esta API em formato OpenAPI 3.0:

[código dos endpoints]

Inclua:
1. Descrição de cada endpoint
2. Parâmetros com tipos e validação
3. Responses possíveis (200, 400, 401, 404, 500)
4. Exemplos de request/response
5. Autenticação necessária

Formato: YAML válido para Swagger
```

### 8.6 Migrar Código

```
Migre este código de JavaScript para TypeScript:

[código JS]

Requisitos:
1. Tipos estritos (no any)
2. Interfaces para objetos complexos
3. Enums onde apropriado
4. Generics quando útil
5. Manter funcionalidade idêntica
6. Adicionar JSDoc para funções públicas

Output:
1. Código TypeScript
2. Arquivo de types separado se necessário
3. Notas sobre decisões de tipagem
```

---

## 9. Debugging com IA

### 9.1 Template de Debug Estruturado

```
Bug: [descrição curta]

SINTOMAS:
- O que está acontecendo
- Quando começou
- Frequência (sempre/às vezes)

CONTEXTO:
- Ambiente: [dev/staging/prod]
- Versão: [x.y.z]
- Últimas mudanças: [se souber]

ERRO COMPLETO:
```
[stack trace / logs]
```

CÓDIGO RELEVANTE:
```[linguagem]
[código onde ocorre]
```

JÁ TENTEI:
1. [tentativa 1 - resultado]
2. [tentativa 2 - resultado]

---

DEBUG WORKFLOW:
1. Analise o stack trace
2. Identifique a causa raiz
3. Explique por que está acontecendo
4. Proponha fix
5. Sugira teste que pegaria este bug
6. Indique se há riscos de regressão
```

### 9.2 Debugging Sistemático

```
Execute debug sistemático:

1. REPRODUZIR
   - Passos exatos para reproduzir
   - Menor caso de teste possível

2. ISOLAR
   - Qual componente está falhando?
   - É input, processamento ou output?

3. INVESTIGAR
   - Adicione logs estratégicos
   - Verifique estado das variáveis
   - Compare com caso que funciona

4. IDENTIFICAR
   - Causa raiz (não sintoma)
   - Por que o código errado foi escrito?

5. CORRIGIR
   - Fix mínimo necessário
   - Não introduza novos bugs

6. VERIFICAR
   - Bug não ocorre mais
   - Testes existentes passam
   - Novo teste previne regressão

7. DOCUMENTAR
   - Post-mortem se crítico
   - Atualizar docs se necessário
```

---

## 10. Checklist Final

### Antes de Enviar o Prompt

```
✅ CLAREZA
- [ ] O objetivo está claro?
- [ ] Ambiguidades eliminadas?
- [ ] Termos técnicos definidos?

✅ CONTEXTO
- [ ] Stack tecnológica informada?
- [ ] Restrições listadas?
- [ ] Padrões do projeto especificados?

✅ FORMATO
- [ ] Output esperado definido?
- [ ] Linguagem/framework especificados?
- [ ] Exemplos fornecidos (se necessário)?

✅ VERIFICAÇÃO
- [ ] Critérios de sucesso definidos?
- [ ] Testes solicitados?
- [ ] Self-review pedido?

✅ ESCOPO
- [ ] Tarefa é atômica (uma coisa só)?
- [ ] Complexidade adequada para um prompt?
- [ ] Se muito grande, quebrou em partes?
```

### Após Receber a Resposta

```
✅ QUALIDADE
- [ ] Atende aos requisitos?
- [ ] Código compila/executa?
- [ ] Segue os padrões solicitados?

✅ COMPLETUDE
- [ ] Todos os casos cobertos?
- [ ] Edge cases tratados?
- [ ] Documentação incluída?

✅ SEGURANÇA
- [ ] Sem vulnerabilidades óbvias?
- [ ] Inputs validados?
- [ ] Secrets não expostos?

✅ MANUTENIBILIDADE
- [ ] Código legível?
- [ ] Bem comentado?
- [ ] Testável?
```

---

## Resumo: Os 10 Mandamentos

1. **Seja específico** - Nunca seja vago
2. **Forneça contexto** - A IA não conhece seu projeto
3. **Defina o papel** - Expert, reviewer, teacher
4. **Use exemplos** - Few-shot quando necessário
5. **Pense em etapas** - Chain-of-thought para complexidade
6. **Itere pequeno** - Complexidade incremental
7. **Verifique sempre** - Loops de verificação
8. **Documente decisões** - Context engineering
9. **Teste tudo** - TDD por padrão
10. **Revise criticamente** - Self-review obrigatório

---

## Diferenças por Modelo

| Modelo | Característica | Dica |
|--------|----------------|------|
| **GPT** | Tende a compensar demais quando vago | Seja mais específico nas instruções |
| **Claude** | Responde bem a tags XML e estrutura | Use delimitadores claros |
| **Gemini** | Beneficia-se de formatação ajustada | Organize inputs longos |

---

**Lembre-se:** O melhor prompt não é o mais longo ou complexo. É aquele que atinge seus objetivos de forma confiável com a estrutura mínima necessária.

---

*Framework compilado a partir de melhores práticas de engenharia de prompt (2025-2026)*