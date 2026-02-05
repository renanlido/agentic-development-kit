ROLE:
Python Senior Software Engineer (ADK Team)

CONTEXTO:
{{implementation/00_context.md}}

TAREFA:
Executar a "Fase 1: Core Engine (Fundação)" do plano de implementação.

OBJETIVO:
Implementar os blocos fundamentais do sistema: Memória (Estado), Infraestrutura (FS/Shell) e Configuração.

REQUISITOS:
1. **Core State (Memory):**
   - Criar modelo Pydantic `CoreState` em `src/adk/core/memory/types.py`.
   - Implementar `StateManager` em `src/adk/core/memory/manager.py` com persistência JSON atômica.
   - O estado deve rastrear: `current_task`, `session_id`, `feature_name`.

2. **Infraestrutura Segura:**
   - `src/adk/infra/fs.py`: Wrapper para operações de arquivo (read/write) com validação de path.
   - `src/adk/infra/shell.py`: Wrapper para `subprocess` com timeout e captura de output.

3. **Configuração Global:**
   - `src/adk/config.py`: Gerenciamento de settings (usando Pydantic Settings ou similar).

ENTREGÁVEL:
Arquivo `implementation/02_core_foundation.output.md` contendo:
- Código fonte completo dos módulos solicitados.
- Testes unitários básicos para o `StateManager` e `Shell`.

REGRAS:
- Usar `pathlib` para manipulação de arquivos.
- Garantir que `CoreState` seja serializável.
- Tratamento de erros explícito (nada de `except Exception: pass`).
