ROLE:
Python Software Engineer (ADK Team)

CONTEXTO:
{{implementation/00_context.md}}

TAREFA:
Executar a "Fase 2: CLI Interface & Agent Orchestrator".

OBJETIVO:
Implementar a interface de comando (`adk feature work`) e a máquina de estados que governa o fluxo de desenvolvimento, ainda com execução de LLM mockada.

REQUISITOS:
1. **Session Management (`src/adk/core/session.py`):**
   - Gerenciar o ciclo de vida da sessão (carregar estado, bloquear diretório para evitar concorrência).
   - `SessionManager.load_or_create(feature_name: str) -> CoreState`.

2. **Agent Orchestrator (`src/adk/core/agent/orchestrator.py`):**
   - Implementar a máquina de estados: `RESEARCH` -> `PLAN` -> `IMPLEMENT` -> `QA`.
   - Método `run_loop()` que itera sobre o estado atual.
   - Por enquanto, apenas "simular" a chamada de IA (mock) e atualizar o estado para a próxima fase.

3. **CLI Commands (`src/adk/cli/commands/feature.py`):**
   - Implementar comando `adk feature work <name>`.
   - Integrar `Rich` para mostrar progresso (Spinners, Tabelas de Status).
   - Tratamento de `Ctrl+C` (Graceful shutdown).

ENTREGÁVEL:
Arquivo `implementation/04_cli_orchestrator.output.md` contendo:
- Código fonte dos módulos.
- Exemplo de como registrar o comando no `main.py`.

REGRAS:
- Usar `Typer` para comandos.
- Usar `Rich` para output visual.
- A máquina de estados deve ser resiliente (salvar estado a cada transição).
