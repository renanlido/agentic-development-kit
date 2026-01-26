# Workflow de Implementação - INSTRUÇÕES CRÍTICAS

**LEIA ISTO ANTES DE IMPLEMENTAR QUALQUER TASK**

## 📋 Checklist Obrigatório

### 1. ANTES DE COMEÇAR
```bash
# 1.1 Leia tasks.md para ver o progresso atual
Read: .claude/plans/features/<name>/tasks.md

# 1.2 Identifique a próxima task pendente
# Procure por:
#   - [ ] Task X.X  ← PENDENTE (faça essa)
#   - [~] Task Y.Y  ← IN PROGRESS (continue essa)
#   - [x] Task Z.Z  ← COMPLETA (pule)

# 1.3 Marque a task como in_progress
.claude/hooks/mark-task.sh <feature-name> "<task-id>" in_progress
```

### 2. DURANTE A IMPLEMENTAÇÃO
```bash
# 2.1 Siga TDD rigoroso
# - Escreva testes PRIMEIRO
# - Execute e confirme que falham
# - Implemente código
# - Execute e confirme que passam

# 2.2 Commit incremental
git add <arquivos>
git commit -m "feat(<feature>): <descricao>"
```

### 3. AO COMPLETAR UMA TASK
```bash
# 3.1 Verifique se TUDO passou
npm test        # Todos os testes passam?
npm run check   # Lint limpo?

# 3.2 Marque como completed
.claude/hooks/mark-task.sh <feature-name> "<task-id>" completed

# 3.3 Commit final da task
git add .
git commit -m "feat(<feature>): complete Task X.X - <descricao>"

# 3.4 CRIE CHECKPOINT (NOVO!)
.claude/hooks/create-checkpoint.sh <feature-name> "<task-id>" "<descricao>"

# O checkpoint será criado e mostrará:
# ✅ CHECKPOINT CRIADO
# ⚠️  PRÓXIMO PASSO: LIMPE O CONTEXTO
```

### 4. LIMPAR CONTEXTO E CONTINUAR
```bash
# 4.1 Saia da sessão atual
Ctrl+C

# 4.2 Limpe o contexto do Claude
claude clear
# Ou use o comando do seu IDE para limpar contexto

# 4.3 Retome com contexto limpo
adk feature implement <feature-name>

# O sistema irá:
# - Ler o checkpoint automaticamente
# - Recuperar o estado (qual task foi feita, qual é a próxima)
# - Continuar de onde parou
# - COM CONTEXTO LIMPO (sem lixo da task anterior)
```

## ❌ ERROS COMUNS - NÃO FAÇA ISSO

### ❌ Implementar sem marcar in_progress
```bash
# ERRADO: Começar direto
# Read tasks.md → Implementar Task 1.1 → Commit

# CERTO: Marcar antes
Read tasks.md → mark-task in_progress → Implementar → mark-task completed
```

### ❌ Implementar task que já está [x]
```bash
# tasks.md:
- [x] Task 1.1: Criar tipos  ← JÁ FEITA, PULE!
- [ ] Task 1.2: Testes       ← FAÇA ESSA

# Se você implementar Task 1.1 de novo:
# → Desperdício de tempo
# → Sobrescreve código existente
# → Perde progresso
```

### ❌ Esquecer de marcar completed
```bash
# ERRADO:
Implementar Task 1.1 → Commit → Próxima task

# Resultado:
# - tasks.md mostra [ ] (pendente)
# - Próxima sessão tenta fazer Task 1.1 de novo

# CERTO:
Implementar → Commit → mark-task completed → Próxima task
```

### ❌ Implementar múltiplas tasks sem marcar
```bash
# ERRADO: Implementar Tasks 1.1, 1.2, 1.3 em sequência sem marcar

# CERTO:
Task 1.1: mark in_progress → implement → mark completed
Task 1.2: mark in_progress → implement → mark completed
Task 1.3: mark in_progress → implement → mark completed
```

## ✅ EXEMPLO COMPLETO - FLUXO CORRETO (COM CHECKPOINT)

```bash
# Sessão 1: Implementando Task 1.1
$ Read .claude/plans/features/myfeature/tasks.md
# Vejo:
# - [ ] Task 1.1: Criar tipos
# - [ ] Task 1.2: Testes

$ .claude/hooks/mark-task.sh myfeature "Task 1.1" in_progress
✓ Task updated (in_progress)

# Agora tasks.md mostra:
# - [~] Task 1.1: Criar tipos

$ # Implemento a task (TDD)...
$ npm test  # ✓ Todos passam

$ .claude/hooks/mark-task.sh myfeature "Task 1.1" completed
✓ Task updated (completed)

# Agora tasks.md mostra:
# - [x] Task 1.1: Criar tipos

$ git add .
$ git commit -m "feat(myfeature): complete Task 1.1 - criar tipos"

$ # NOVO: Criar checkpoint
$ .claude/hooks/create-checkpoint.sh myfeature "Task 1.1" "Criar tipos"

✅ CHECKPOINT CRIADO

📄 Arquivo: .claude/plans/features/myfeature/.task-checkpoint.md
📊 Progresso: 1/10 tasks (10%)

⚠️  PRÓXIMO PASSO: LIMPE O CONTEXTO

1. Ctrl+C para sair desta sessão
2. Execute: claude clear
3. Execute: adk feature implement myfeature

# PARE AQUI! Não continue para Task 1.2
# O contexto está sujo, precisa limpar
```

```bash
# Sessão 2: Retomando COM CONTEXTO LIMPO
$ claude clear  # Limpou o contexto

$ adk feature implement myfeature

# Claude lê automaticamente o checkpoint:
# 📌 CHECKPOINT DA ÚLTIMA SESSÃO
# Task Completada: Task 1.1 - Criar tipos
# Próxima task: Task 1.2 - Testes
# Progresso: 1/10 tasks (10%)

$ Read .claude/plans/features/myfeature/tasks.md
# Vejo:
# - [x] Task 1.1: Criar tipos  ← FEITA, PULAR
# - [ ] Task 1.2: Testes       ← PRÓXIMA

$ .claude/hooks/mark-task.sh myfeature "Task 1.2" in_progress
# ... implementa Task 1.2 COM CONTEXTO LIMPO ...

$ .claude/hooks/mark-task.sh myfeature "Task 1.2" completed
$ git commit -m "feat(myfeature): complete Task 1.2 - testes"
$ .claude/hooks/create-checkpoint.sh myfeature "Task 1.2" "Testes"

# Novamente: PARE, limpe contexto, retome
```

```bash
# Sessão 2: Retomando
$ adk feature autopilot myfeature

📌 Última sessão estava trabalhando em:
   Task 1.2: Testes

$ Read .claude/plans/features/myfeature/tasks.md
# Vejo:
# - [x] Task 1.1: Criar tipos  ← FEITA, PULAR
# - [~] Task 1.2: Testes       ← CONTINUAR ESSA

# Continua da Task 1.2, NÃO recomeça da 1.1!
```

## 🎯 VERIFICAÇÃO DE PROGRESSO

Antes de começar cada task, SEMPRE leia tasks.md:

```typescript
// Exemplo de como ler e interpretar:

Read: .claude/plans/features/myfeature/tasks.md

/*
Resultados:
  ## Fase 1: Setup
  ### Task 1.1: Criar diretórios
  - [x] Criar src/utils/
  - [x] Criar tests/utils/

  ### Task 1.2: Configurar package.json
  - [~] Adicionar script "test"     ← ESTA ESTÁ IN PROGRESS
  - [ ] Adicionar script "build"    ← ESTA É A PRÓXIMA

  ### Task 1.3: Validação
  - [ ] npm run build compila
  - [ ] npm test executa
*/

// O que fazer:
// 1. Procurar [~] (in_progress) → Continuar essa
// 2. Se não houver [~], procurar primeiro [ ] → Começar essa
// 3. Nunca refazer tasks que estão [x]
```

## 📊 COMANDOS ÚTEIS

```bash
# Ver progresso atual
adk feature status <name> --unified

# Ver tasks pendentes
grep "- \[ \]" .claude/plans/features/<name>/tasks.md

# Ver tasks in-progress
grep "- \[~\]" .claude/plans/features/<name>/tasks.md

# Ver tasks completed
grep "- \[x\]" .claude/plans/features/<name>/tasks.md | wc -l

# Marcar task manualmente
.claude/hooks/mark-task.sh <name> "<pattern>" <status>
```

## 🚨 REGRA DE OURO

**SEMPRE que começar uma task:**
1. Leia tasks.md
2. Marque como in_progress
3. Implemente (TDD)
4. Marque como completed
5. Commit

**NUNCA:**
- Pule tasks que estão [x]
- Esqueça de marcar progresso
- Implemente sem verificar tasks.md primeiro
