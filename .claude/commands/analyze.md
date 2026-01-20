---
description: Analisa codebase e documenta arquitetura existente
---

# Analisar Projeto

Voce vai analisar este projeto e documentar sua arquitetura.

## Processo

### 1. Analise de Estrutura

```bash
# Ver estrutura de pastas
find . -type d -not -path './node_modules/*' -not -path './.git/*' | head -30

# Ver arquivos principais
ls -la src/ 2>/dev/null || ls -la

# Ver dependencias
cat package.json 2>/dev/null | head -50
```

### 2. Identificar Padroes

**Analisar:**
- Estrutura de pastas (MVC, Clean Architecture, etc)
- Padroes de nomenclatura
- Convencoes de codigo
- Framework/libs usados
- Padroes de teste

### 3. Documentar Arquitetura

Crie/atualize `.claude/memory/architecture.md`:

```markdown
# Arquitetura do Projeto

## Visao Geral

[Descricao em 2-3 linhas]

## Diagrama

\`\`\`
[Diagrama ASCII da arquitetura]
\`\`\`

## Camadas

### Presentation
- Localizacao: `src/[pasta]/`
- Responsabilidade: [descricao]
- Padroes: [padroes usados]

### Business
- Localizacao: `src/[pasta]/`
- Responsabilidade: [descricao]
- Padroes: [padroes usados]

### Data
- Localizacao: `src/[pasta]/`
- Responsabilidade: [descricao]
- Padroes: [padroes usados]

## Padroes Identificados

| Padrao | Onde | Como Usado |
|--------|------|------------|
| Pattern 1 | local | descricao |

## Dependencias Principais

| Dependencia | Versao | Proposito |
|-------------|--------|-----------|
| lib1 | X.Y.Z | para que |

## Convencoes

### Nomenclatura
- Arquivos: [padrao]
- Classes: [padrao]
- Funcoes: [padrao]

### Estrutura de Arquivos
- [Descricao]

### Tratamento de Erros
- [Descricao]

## Pontos de Extensao

- [Onde adicionar novas features]
- [Como integrar novos componentes]
```

### 4. Atualizar Contexto

Atualize `.claude/memory/project-context.md` com:
- Stack tecnologico identificado
- Padroes encontrados
- Convencoes do projeto

### 5. Criar/Atualizar CLAUDE.md

Se nao existir ou estiver incompleto, crie `CLAUDE.md` com:
- Comandos de build/dev/test
- Padroes a seguir
- Convencoes importantes

## Output

Resumo para o usuario:

```
Analise Completa

Tipo de Projeto: [Web API, CLI, etc]
Stack: [tecnologias]
Arquitetura: [padrao identificado]

Documentacao Criada/Atualizada:
- .claude/memory/architecture.md
- .claude/memory/project-context.md
- CLAUDE.md

Padroes Identificados:
- [Lista de padroes]

Sugestoes:
- [Melhorias sugeridas]
```
