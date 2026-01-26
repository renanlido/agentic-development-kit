# Estratégia de Limpeza de Contexto

## Problema

Durante implementação de múltiplas tasks, o contexto do Claude acumula:
- Código de tasks anteriores
- Discussões sobre decisões já tomadas
- Detalhes de implementação irrelevantes para próxima task
- Erros e tentativas que já foram corrigidas

**Resultado**: Claude erra mais, fica confuso, repete código, perde foco.

## Solução: Checkpoint Entre Tasks

### Fluxo Implementado

```
Task 1 → Implementar → Mark Completed → CREATE CHECKPOINT → PAUSE
                                              ↓
                                         Salva estado
                                              ↓
                                    USER: claude clear
                                              ↓
Task 2 → Ler Checkpoint → Contexto Limpo → Implementar → ...
```

### Como Funciona

#### 1. Ao Completar Uma Task

Claude executa automaticamente:

```bash
# Marca task como completed
.claude/hooks/mark-task.sh myfeature "Task 1.1" completed

# Commit
git commit -m "feat(myfeature): complete Task 1.1"

# CRIA CHECKPOINT (salva estado)
.claude/hooks/create-checkpoint.sh myfeature "Task 1.1" "Descrição curta"
```

**Output do checkpoint:**
```
✅ CHECKPOINT CRIADO

📄 Arquivo: .task-checkpoint.md
📊 Progresso: 1/10 tasks (10%)

⚠️  PRÓXIMO PASSO: LIMPE O CONTEXTO

1. Ctrl+C para sair desta sessão
2. Execute: claude clear
3. Execute: adk feature implement myfeature
```

Claude **PARA AQUI**. Não continua para próxima task.

#### 2. Usuário Limpa o Contexto

```bash
# Ctrl+C para sair
^C

# Limpar contexto
$ claude clear
Contexto limpo com sucesso.
```

#### 3. Retomar com Contexto Limpo

```bash
$ adk feature implement myfeature
```

Claude:
1. **Lê o checkpoint** automaticamente
2. Recupera estado:
   - Qual task foi completada
   - Qual é a próxima pendente
   - Progresso atual (X/Y)
3. Continua de onde parou **COM CONTEXTO LIMPO**

### Formato do Checkpoint

```markdown
# Task Checkpoint

> Created: 2026-01-26T02:00:00Z

## ✅ Task Completada

- **ID**: Task 1.1
- **Descrição**: Criar tipos base
- **Status**: Completed (marcada como [x])

### Arquivos Modificados
  - src/types/base.ts
  - tests/types/base.test.ts

### Testes
- Execute: `npm test` para verificar
- Coverage: Execute `npm run test:coverage`

---

## 📋 Próxima Task

**Próxima task pendente:**
```
Task 1.2: Implementar validação de tipos
```

### Contexto Mínimo Necessário
- Leia tasks.md para ver dependências
- Revise implementation-plan.md se necessário
- Verifique que task anterior está [x]

---

## 📊 Estado Atual

- **Progresso**: 1 / 10 tasks completas (10%)
- **Fase**: Implementação
- **Checkpoint**: 2026-01-26T02:00:00Z

---

## 🔄 Como Continuar

### 1. Limpe o Contexto
```bash
claude clear
```

### 2. Retome a Implementação
```bash
adk feature implement myfeature
```

### 3. O Sistema Vai
- Ler este checkpoint
- Verificar tasks.md
- Continuar da próxima task pendente [ ]
- NÃO refazer tasks que estão [x]
```

## Vantagens

✅ **Contexto sempre limpo** - Cada task começa com contexto fresco
✅ **Menos erros** - Claude não se confunde com código antigo
✅ **Continuidade garantida** - Checkpoint salva o estado exato
✅ **Controle do usuário** - Você decide quando limpar
✅ **Transparência** - Checkpoint é legível, você pode editar se quiser

## Desvantagens e Mitigações

❌ **Interrupção manual** - Requer Ctrl+C e claude clear

✅ **Mitigação**: É rápido (2 segundos) e vale a pena pela qualidade

❌ **Perde contexto da task anterior**

✅ **Mitigação**: Checkpoint salva arquivos modificados e descrição. Se próxima task depender da anterior, você pode ler o código.

## Comparação: Com vs Sem Checkpoint

### ❌ SEM Checkpoint (antigo)

```
Sessão 1:
Task 1.1 → Implementar → Commit
Task 1.2 → Implementar → Commit (contexto sujo)
Task 1.3 → Implementar → Commit (muito contexto sujo)
Task 1.4 → Implementar → ERRO (contexto muito sujo, Claude confuso)

Resultado: 3/4 tasks OK, 1 com erro
```

### ✅ COM Checkpoint (novo)

```
Sessão 1:
Task 1.1 → Implementar → Commit → Checkpoint → PAUSE

Sessão 2 (contexto limpo):
Task 1.2 → Implementar → Commit → Checkpoint → PAUSE

Sessão 3 (contexto limpo):
Task 1.3 → Implementar → Commit → Checkpoint → PAUSE

Sessão 4 (contexto limpo):
Task 1.4 → Implementar → Commit → Checkpoint → PAUSE

Resultado: 4/4 tasks OK, 0 erros
```

## Quando NÃO Usar Checkpoint

### Não pause se:
- Task é muito pequena (< 5 minutos)
- Tasks são fortemente acopladas (Ex: Task 2.1 cria função, Task 2.2 usa a função imediatamente)

Nestes casos, você pode implementar 2-3 tasks na mesma sessão e criar checkpoint apenas após o grupo.

### Como desabilitar checkpoint temporariamente:

No prompt, Claude pode ignorar o step 5 (checkpoint) se o usuário pedir:

```bash
# Exemplo: implementar tasks 1.1 e 1.2 juntas
$ adk feature implement myfeature --no-checkpoint
# (flag ainda não implementada, mas pode ser adicionada)
```

Por enquanto, se quiser pular checkpoint, simplesmente continue para próxima task sem executar `create-checkpoint.sh`.

## Scripts Disponíveis

```bash
# Criar checkpoint manualmente
.claude/hooks/create-checkpoint.sh <feature> "<task-id>" "<descrição>"

# Marcar task como completed
.claude/hooks/mark-task.sh <feature> "<task-id>" completed

# Ver checkpoint atual
cat .claude/plans/features/<feature>/.task-checkpoint.md
```

## Integração com Autopilot

O `adk feature autopilot` **NÃO** usa checkpoint automático porque roda tasks em sequência. Para usar checkpoint no autopilot:

1. Rode autopilot normalmente
2. Quando ele pausar após uma fase completa, limpe contexto
3. Retome autopilot

OU:

Use `adk feature implement` manualmente para controle task-a-task com checkpoint.

## Resumo - Checklist Rápido

Para cada task:

1. ✅ Ler tasks.md
2. ✅ Marcar in_progress
3. ✅ Implementar (TDD)
4. ✅ Marcar completed
5. ✅ Commit
6. ✅ **Criar checkpoint**
7. ✅ **Ctrl+C**
8. ✅ **claude clear**
9. ✅ **Retomar**

Repita até todas as tasks [x].
