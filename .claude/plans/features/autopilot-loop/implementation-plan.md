# Autopilot Loop Mode - Plano de Implementação

## Objetivo

Adicionar flag `--loop` / `-l` ao comando `adk feature autopilot` para executar tasks automaticamente em sequência, sem intervenção manual entre elas.

## Problema Atual

```
Task 1 termina → Ctrl+C → adk feature autopilot <name>
Task 2 termina → Ctrl+C → adk feature autopilot <name>
... (repetir N vezes manualmente)
```

## Solução

```bash
adk feature autopilot <name> --loop
# ou
adk feature autopilot <name> -l
```

Comportamento:
```
┌────────────────────────────────────────────────────────┐
│  Loop Externo (Node.js - não Claude)                   │
│  ┌────────────────────────────────────────────────────┐│
│  │ 1. Verifica tasks pendentes (checkTasksCompletion) ││
│  │ 2. Se allDone=true → exit com sucesso              ││
│  │ 3. Executa subprocess: claude --dangerously-skip.. ││
│  │ 4. Subprocess termina → cooldown 3s                ││
│  │ 5. Volta ao passo 1                                ││
│  └────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

---

## Mudanças Necessárias

### 1. Adicionar flag no CLI (`src/cli.ts`)

**Linha ~196** - Adicionar option ao comando autopilot:

```typescript
feature
  .command('autopilot <name> [description]')
  .description(
    'Executa fluxo completo automatizado em worktree isolado: PRD → Research → Tasks → Arquitetura → Implementação → QA → Documentação'
  )
  .option('-c, --context <file>', 'Arquivo de contexto adicional')
  .option('-d, --desc <description>', 'Descrição da feature (alternativa ao argumento posicional)')
  .option('--base-branch <branch>', 'Branch base para criar o worktree (padrão: main)')
  .option('-l, --loop', 'Modo loop: executa tasks automaticamente até todas completarem')  // NOVO
  .action((name, description, options) =>
    featureCommand.autopilot(name, {
      ...options,
      description: options.desc || description,
      baseBranch: options.baseBranch,
      loop: options.loop,  // NOVO
    })
  )
```

### 2. Atualizar interface FeatureOptions (`src/commands/feature.ts`)

Adicionar campo `loop?: boolean` na interface FeatureOptions (ou onde está definida).

### 3. Criar método `autopilotLoop` (`src/commands/feature.ts`)

Novo método privado que implementa o loop:

```typescript
private async autopilotLoop(name: string, options: FeatureOptions): Promise<void> {
  const MAX_ITERATIONS = 50  // Safeguard contra loop infinito
  const COOLDOWN_MS = 3000   // 3 segundos entre iterações

  let iteration = 0

  console.log(chalk.bold.magenta('🔁 ADK Autopilot Loop Mode'))
  console.log(chalk.gray('━'.repeat(50)))
  console.log(chalk.gray('Tasks serão executadas automaticamente em sequência'))
  console.log(chalk.gray('Ctrl+C a qualquer momento para pausar'))
  console.log()

  while (iteration < MAX_ITERATIONS) {
    iteration++

    // 1. Verificar status das tasks
    const taskStatus = await this.checkTasksCompletion(name)

    console.log(chalk.cyan(`\n📊 Iteração ${iteration} - Tasks: ${taskStatus.completed}/${taskStatus.total} (${taskStatus.percentage}%)`))

    // 2. Se todas completas, sair
    if (taskStatus.allDone) {
      console.log(chalk.green('\n✅ Todas as tasks completas!'))
      console.log(chalk.gray('Próximo passo: adk feature qa ' + name))
      return
    }

    // 3. Executar subprocess com Claude
    console.log(chalk.gray(`\nIniciando sessão Claude para próxima task...`))

    try {
      const featureSlug = name.replace(/[^a-zA-Z0-9-]/g, '-')
      const mainRepo = this.getMainRepoPath()
      const worktreeDir = path.join(mainRepo, '.worktrees', featureSlug)

      // Verificar se worktree existe
      const worktreeExists = await fs.pathExists(worktreeDir)
      const cwd = worktreeExists ? worktreeDir : process.cwd()

      // Executar claude com prompt para implementar próxima task
      execFileSync('claude', [
        '--dangerously-skip-permissions',
        '-p',
        this.buildImplementNextTaskPrompt(name)
      ], {
        stdio: 'inherit',
        cwd
      })
    } catch (error) {
      // Claude retornou com erro ou foi interrompido
      console.log(chalk.yellow('\n⚠️  Sessão Claude encerrada'))

      // Verificar progresso mesmo assim
      const updatedStatus = await this.checkTasksCompletion(name)
      if (updatedStatus.allDone) {
        console.log(chalk.green('\n✅ Todas as tasks completas!'))
        return
      }

      // Perguntar se quer continuar
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Sessão interrompida. O que fazer?',
        choices: [
          { name: '🔄 Continuar para próxima task', value: 'continue' },
          { name: '🛑 Parar o loop', value: 'stop' }
        ]
      }])

      if (action === 'stop') {
        console.log(chalk.yellow('\nLoop pausado. Continue com:'))
        console.log(chalk.gray(`  adk feature autopilot ${name} --loop`))
        return
      }
    }

    // 4. Cooldown entre iterações
    console.log(chalk.gray(`\n⏳ Próxima task em ${COOLDOWN_MS / 1000}s... (Ctrl+C para pausar)`))
    await this.sleep(COOLDOWN_MS)
  }

  console.log(chalk.yellow(`\n⚠️  Limite de ${MAX_ITERATIONS} iterações atingido`))
  console.log(chalk.gray('Verifique o progresso: adk feature status ' + name))
}

private buildImplementNextTaskPrompt(name: string): string {
  return `Você está no modo autopilot loop do ADK.

CONTEXTO:
- Feature: ${name}
- Arquivo de tasks: .claude/plans/features/${name}/tasks.md

INSTRUÇÕES:
1. Leia o arquivo tasks.md
2. Encontre a PRIMEIRA task que ainda está pendente ([ ] ou [~])
3. Marque-a como in_progress usando: ./.claude/hooks/mark-task.sh ${name} "<pattern>" in_progress
4. Implemente a task seguindo TDD
5. Ao finalizar, marque como completed: ./.claude/hooks/mark-task.sh ${name} "<pattern>" completed
6. Crie um checkpoint: ./.claude/hooks/create-checkpoint.sh ${name} "<task>" "descrição"
7. PARE após completar UMA task - o loop externo cuidará da próxima

IMPORTANTE:
- Implemente APENAS UMA task por sessão
- Siga rigorosamente o workflow: mark in_progress → implementar → mark completed → checkpoint
- Não continue para a próxima task, o loop externo fará isso`
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### 4. Modificar método `autopilot` principal

No início do método `autopilot`, adicionar verificação da flag:

```typescript
async autopilot(name: string, options: FeatureOptions = {}): Promise<void> {
  // Se modo loop ativado, usar fluxo específico
  if (options.loop) {
    return this.autopilotLoop(name, options)
  }

  // ... resto do código existente ...
}
```

---

## Safeguards

| Safeguard | Valor | Propósito |
|-----------|-------|-----------|
| MAX_ITERATIONS | 50 | Evita loop infinito |
| COOLDOWN_MS | 3000 | Tempo para Ctrl+C |
| Error handling | inquirer | Pergunta após erro |
| Task verification | checkTasksCompletion | Verifica antes de cada iteração |

---

## Fluxo Visual

```
┌─────────────────────────────────────────────────────────────┐
│  adk feature autopilot my-feature --loop                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Loop Iteration 1                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ checkTasksCompletion() → 0/10 tasks                     ││
│  │ exec claude --dangerously-skip-permissions -p "..."     ││
│  │ Claude implementa Task 1.1                               ││
│  │ Claude termina (exit 0)                                  ││
│  │ cooldown 3s                                              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Loop Iteration 2                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ checkTasksCompletion() → 1/10 tasks                     ││
│  │ exec claude --dangerously-skip-permissions -p "..."     ││
│  │ Claude implementa Task 1.2                               ││
│  │ ...                                                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                         (...)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Loop Iteration N                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ checkTasksCompletion() → 10/10 tasks (allDone=true)     ││
│  │ ✅ Todas as tasks completas!                            ││
│  │ EXIT                                                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/cli.ts` | Adicionar `.option('-l, --loop', ...)` |
| `src/commands/feature.ts` | Adicionar `autopilotLoop()`, `buildImplementNextTaskPrompt()`, `sleep()` |
| `src/commands/feature.ts` | Modificar `autopilot()` para redirecionar quando `options.loop` |

---

## Estimativa de Complexidade

- **Linhas de código**: ~80-100 novas linhas
- **Risco**: Baixo (código isolado, não altera fluxo existente)
- **Testes**: Verificar manualmente com feature de teste

---

## Uso

```bash
# Modo normal (comportamento atual)
adk feature autopilot my-feature

# Modo loop (novo)
adk feature autopilot my-feature --loop
adk feature autopilot my-feature -l

# Combinado com outras flags
adk feature autopilot my-feature --loop --base-branch develop
```

---

## Alternativa Considerada: `--unattended`

Nome alternativo considerado: `--unattended` / `-u`
- Mais descritivo ("sem supervisão")
- Mas `--loop` é mais curto e intuitivo

Decisão: usar `--loop` / `-l`
