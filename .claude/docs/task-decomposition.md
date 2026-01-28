# Task Decomposition Algorithm

Este documento descreve o algoritmo de decomposição de tasks usado pelo ADK para quebrar features em unidades de trabalho gerenciáveis.

## Problema

Algoritmos tradicionais de decomposição tendem a criar tasks excessivamente granulares, resultando em:
- 90-100+ tasks para features simples
- Overhead de gerenciamento
- Perda de contexto entre tasks muito pequenas
- Tasks horizontais que não entregam valor isoladamente

## Solução: Vertical Slicing com Avaliação de Complexidade

O ADK usa uma abordagem baseada em pesquisas de decomposição de tarefas para agentes LLM e práticas ágeis modernas.

### Referências

- [LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) - Lilian Weng
- [Task Decomposition for Affordable AI](https://www.amazon.science/blog/how-task-decomposition-and-smaller-llms-can-make-ai-more-affordable) - Amazon Science
- [Vertical Slicing in Agile](https://www.linkedin.com/pulse/user-story-decomposition-closer-look-vertical-slicing-rommel-bandeira)
- [Requirements Decomposition Research](https://link.springer.com/chapter/10.1007/978-3-319-57633-6_5) - Springer

## Algoritmo

### Passo 1: Avaliação de Complexidade

Antes de decompor, o algoritmo classifica a feature:

| Complexidade | Características | Target Tasks |
|--------------|-----------------|--------------|
| **Simples** | 1-2 arquivos, lógica direta, sem dependências externas | 3-8 tasks |
| **Média** | 3-5 arquivos, algumas integrações, lógica moderada | 8-15 tasks |
| **Complexa** | 6+ arquivos, múltiplas integrações, lógica complexa | 15-25 tasks |
| **Épico** | Sistema novo, muitas dependências, arquitetura nova | 30-60 tasks |

**Limite máximo: 60 tasks.** Features que excedem devem ser divididas em sub-features.

### Passo 2: Vertical Slicing

Cada task deve ser um "slice vertical" que entrega valor completo, atravessando todas as camadas necessárias.

```
✅ BOM (Vertical Slice):
"Implementar endpoint GET /users com teste e validação"
- Inclui: teste + controller + service + repository + validação

❌ RUIM (Horizontal Slice):
- Task 1: "Criar controller"
- Task 2: "Criar service"
- Task 3: "Criar repository"
- Task 4: "Criar teste"
```

**Princípio**: Uma task vertical inclui TODAS as camadas para UMA funcionalidade.

### Passo 3: Agrupamento por Funcionalidade

Operações relacionadas são agrupadas em uma única task:

```
✅ BOM:
"CRUD de usuários" (inclui create, read, update, delete)

❌ RUIM:
- Task 1: "Create user"
- Task 2: "Read user"
- Task 3: "Update user"
- Task 4: "Delete user"
```

```
✅ BOM:
"Validação de formulário de cadastro" (todos os campos)

❌ RUIM:
- Task 1: "Validar campo email"
- Task 2: "Validar campo nome"
- Task 3: "Validar campo telefone"
```

### Passo 4: Consolidação de Micro-Tasks

Tasks muito pequenas (< 30 min) são consolidadas:

| Micro-Tasks | Consolidar Em |
|-------------|---------------|
| "Criar type X", "Criar type Y", "Criar type Z" | "Definir tipos/interfaces do módulo" |
| "Adicionar import A", "Adicionar import B" | (incorporar na task que usa) |
| "Criar arquivo config", "Adicionar variável env" | "Configurar ambiente do módulo" |

## Estrutura de Task

Cada task segue esta estrutura:

```markdown
## Task N: [Nome descritivo - verbo no infinitivo]

**Tipo:** Feature | Refactor | Bugfix | Config | Docs
**Estimativa:** [P|M|G] (Pequena <2h | Média 2-4h | Grande 4-8h)
**Dependências:** [lista ou "nenhuma"]

### Escopo
- O que FAZER: [lista objetiva]
- O que NÃO FAZER: [limites claros]

### Critérios de Aceite
- [ ] Critério 1 (testável e verificável)
- [ ] Critério 2

### Arquivos Envolvidos
- `path/to/file.ts` - [criar|modificar]
```

## Regras de Ouro

1. **TDD Integrado**: Testes são PARTE da task de implementação, não tasks separadas
2. **Completude**: Cada task deve deixar o sistema em estado funcional
3. **Independência**: Minimize dependências entre tasks
4. **Verificabilidade**: Critérios de aceite devem ser sim/não
5. **Tamanho Ideal**: Tasks de 2-8 horas (nem muito pequenas, nem muito grandes)

## Anti-Patterns a Evitar

| Anti-Pattern | Por que é ruim |
|--------------|----------------|
| Uma task por arquivo | Fragmentação excessiva, perde contexto |
| Uma task por função/método | Micro-gerenciamento, overhead |
| Separar "criar teste" de "implementar" | Viola TDD, duplica esforço de contexto |
| Tasks de configuração triviais separadas | Overhead desnecessário |
| Mais de 60 tasks | Feature muito grande, dividir |

## Comparação: Antes vs Depois

| Aspecto | Algoritmo Antigo | Algoritmo Novo |
|---------|------------------|----------------|
| Granularidade | "1-2 horas max" | "2-8 horas ideal" |
| Limite | Nenhum | 60 tasks máximo |
| Slicing | Horizontal (por camada) | Vertical (por funcionalidade) |
| Testes | Tasks separadas | Integrados na task |
| Complexidade | Não avaliada | 4 níveis com targets |
| CRUD | 4 tasks | 1 task |
| Validações | N tasks (1/campo) | 1 task agrupada |

## Exemplo Prático

### Feature: "Adicionar autenticação JWT"

**Algoritmo Antigo** (90+ tasks):
```
Task 1: Criar interface User
Task 2: Criar interface Token
Task 3: Criar interface AuthPayload
Task 4: Instalar jsonwebtoken
Task 5: Instalar bcrypt
Task 6: Criar arquivo auth.config.ts
Task 7: Adicionar JWT_SECRET no .env
Task 8: Criar teste para hashPassword
Task 9: Implementar hashPassword
Task 10: Criar teste para comparePassword
... (continua por 80+ tasks)
```

**Algoritmo Novo** (12 tasks):
```
Task 1: Configurar dependências e ambiente de autenticação
Task 2: Implementar módulo de hashing de senhas com testes
Task 3: Implementar geração e validação de JWT com testes
Task 4: Criar endpoint POST /auth/register com validação
Task 5: Criar endpoint POST /auth/login com validação
Task 6: Implementar middleware de autenticação
Task 7: Criar endpoint GET /auth/me (perfil do usuário)
Task 8: Implementar refresh token
Task 9: Criar endpoint POST /auth/logout
Task 10: Adicionar rate limiting nos endpoints de auth
Task 11: Implementar recuperação de senha
Task 12: Documentar API de autenticação
```

## Comando

O algoritmo é executado automaticamente pelo comando:

```bash
adk feature tasks <feature-name>
```

O output é salvo em `.claude/plans/features/<name>/tasks.md`.
