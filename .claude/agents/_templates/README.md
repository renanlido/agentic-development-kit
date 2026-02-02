# Agent Templates

Templates reutilizaveis para criar novos agentes seguindo as melhores praticas de engenharia de prompt.

## Tipos de Agente

| Tipo | Proposito | Modifica Codigo? | Modelo Recomendado |
|------|-----------|------------------|-------------------|
| **Analyzer** | Analisar sem modificar | Nao | opus/sonnet |
| **Executor** | Executar acoes que modificam | Sim | opus |
| **Validator** | Validar trabalho de outros | Nao | sonnet |
| **Generator** | Gerar artefatos/documentos | Cria novos | opus/sonnet |

## Estrutura dos Templates

Todos os templates seguem a mesma estrutura baseada em tecnicas avancadas de prompt engineering:

```
1. Role Prompting         → Define persona com anos de experiencia
2. Hierarquia de Contexto → GLOBAL → FEATURE → TASK
3. Pre-requisitos         → O que verificar antes de executar
4. Workflow Sequencial    → Etapas numeradas na ordem exata
5. Exemplo Concreto       → Few-shot learning com YAML
6. Verification Loop      → Auto-verificacao obrigatoria
7. Self-Review            → 5 perguntas criticas
8. Regras Absolutas       → NUNCA/SEMPRE explicitos
9. Output Estruturado     → Template de saida
```

## Como Usar

### 1. Escolha o Template

```
Preciso criar um agente que...
├── Analisa codigo sem modificar → analyzer-template.md
├── Implementa/executa acoes    → executor-template.md
├── Valida/revisa trabalho      → validator-template.md
└── Gera documentos/planos      → generator-template.md
```

### 2. Copie e Preencha

```bash
cp _templates/analyzer-template.md ../meu-novo-agente.md
```

### 3. Substitua os Placeholders

Todos os placeholders seguem o formato `{{PLACEHOLDER}}`:

| Placeholder | Descricao | Exemplo |
|-------------|-----------|---------|
| `{{AGENT_NAME}}` | Nome do agente (kebab-case) | `security-auditor` |
| `{{AGENT_TITLE}}` | Titulo do agente | `Security Auditor` |
| `{{DESCRIPTION}}` | Descricao para o frontmatter | `Audita codigo por vulnerabilidades` |
| `{{ROLE}}` | Papel/profissao | `security engineer` |
| `{{YEARS}}` | Anos de experiencia | `12` |
| `{{SPECIALIZATION}}` | Especializacao | `OWASP Top 10 e SAST` |
| `{{MODEL}}` | Modelo a usar | `opus` ou `sonnet` |

### 4. Personalize as Secoes

Cada template tem secoes especificas para personalizar:

**Analyzer:**
- Categorias de analise
- Criterios de classificacao
- Formato do relatorio

**Executor:**
- Metodologia (TDD, etc)
- Comandos de validacao
- Padrao de commits

**Validator:**
- Checklists de validacao
- Comandos automatizados
- Criterios de aprovacao

**Generator:**
- Perguntas obrigatorias
- Secoes do template
- Formato do artefato

## Exemplo: Criar Agente Security Auditor

### 1. Partir do analyzer-template.md

```bash
cp _templates/analyzer-template.md ../security-auditor.md
```

### 2. Preencher Frontmatter

```yaml
---
name: security-auditor
description: Audita codigo por vulnerabilidades de seguranca (OWASP Top 10)
tools:
  - Read
  - Glob
  - Grep
  - Bash
model: opus
---
```

### 3. Preencher Role

```markdown
# Security Auditor Agent

Voce e um security engineer senior com 12 anos de experiencia em
auditoria de codigo, especializado em identificar vulnerabilidades
OWASP Top 10 e recomendar correcoes.
```

### 4. Definir Categorias

```markdown
#### 3.1 Injection (A01)
| Check | Status | Evidencia |
|-------|--------|-----------|
| SQL Injection | OK/ISSUES | [arquivo:linha] |
| Command Injection | OK/ISSUES | [arquivo:linha] |
| LDAP Injection | OK/ISSUES | [arquivo:linha] |

#### 3.2 Broken Authentication (A02)
...
```

## Checklist de Qualidade

Antes de finalizar seu novo agente, verifique:

- [ ] Frontmatter completo (name, description, tools, model)
- [ ] Role com anos de experiencia e especializacao
- [ ] Hierarquia de contexto definida
- [ ] Pre-requisitos listados (se aplicavel)
- [ ] Workflow com etapas numeradas
- [ ] Exemplo concreto (few-shot)
- [ ] Verification Loop presente
- [ ] Self-Review com 5 perguntas
- [ ] Regras Absolutas (NUNCA/SEMPRE)
- [ ] Output estruturado definido

## Tecnicas Incorporadas

Estes templates incorporam as seguintes tecnicas de prompt engineering:

| Tecnica | Como e Usada |
|---------|--------------|
| **Role Prompting** | Persona com experiencia especifica |
| **Context Layering** | Hierarquia GLOBAL/FEATURE/TASK |
| **Chain-of-Thought** | Workflow sequencial numerado |
| **Few-Shot Learning** | Exemplo de output em YAML |
| **Verification Loops** | Auto-verificacao obrigatoria |
| **Self-Review** | 5 perguntas antes de entregar |
| **Structured Output** | Templates YAML para automacao |

## Referencia

Baseado no Framework de Engenharia de Prompt para IA (2025-2026):
- Role Prompting
- Few-Shot Learning
- Chain-of-Thought (CoT)
- Meta Prompting
- Incremental Complexity
- Context Engineering
- Verification Loops
