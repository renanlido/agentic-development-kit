# Plano de Implementação Python (ADK v3)

## 1. Stack Tecnológica Definida

A escolha da stack prioriza robustez, tipagem estrita e excelente experiência de desenvolvedor (DX) no terminal.

- **Linguagem:** Python 3.11+ (para melhorias de performance e tipagem)
- **Gerenciador de Pacotes:** `Poetry` (gestão de dependências e ambientes virtuais determinísticos)
- **CLI Framework:** `Typer` (baseado em Type Hints) + `Rich` (UI/UX no terminal)
- **Data Validation & Settings:** `Pydantic v2` (performance e validação estrita de schema)
- **LLM Interface:** CLI Nativo `claude-code` via subprocess (modo headless com output JSON)
- **Context Analysis:** `tree-sitter` (parsing robusto multi-linguagem) ou `ast` (nativo para Python)
- **Git Operations:** `GitPython`
- **Qualidade & Linting:**
  - `Ruff` (linter/formatter ultra-rápido, substitui flake8/black/isort)
  - `Mypy` (checagem estática de tipos, modo estrito)
  - `Pre-commit` (hooks de git)
- **Testes:** `Pytest` + `Pytest-Cov` (com plugins para mocking e vcr.py para gravar interações HTTP)

## 2. Estrutura do Projeto

O projeto seguirá o padrão `src` layout para evitar problemas de importação e garantir empacotamento limpo.

```
adk-core/
├── pyproject.toml          # Configuração Poetry e ferramentas
├── poetry.lock
├── README.md
├── src/
│   └── adk/
│       ├── __init__.py
│       ├── __main__.py     # Entry point (python -m adk)
│       ├── cli/            # Interface de Linha de Comando (Typer)
│       │   ├── commands/   # Subcomandos (feature, memory, etc.)
│       │   └── console.py  # Configuração Rich/Console global
│       ├── core/           # Lógica de Negócio Pura
│       │   ├── agent/      # Orquestrador e Máquina de Estados
│       │   ├── memory/     # Gestão de Estado (Core State, Tiered Memory)
│       │   ├── context/    # AST, Indexação e Busca
│       │   └── llm/        # Gateway e Prompts
│       ├── infra/          # Adaptadores de Sistema
│       │   ├── fs.py       # File System seguro
│       │   ├── git.py      # Operações Git
│       │   └── shell.py    # Execução de comandos (Sandboxing)
│       └── utils/          # Utilitários compartilhados
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## 3. Fases de Implementação

### Fase 0: Setup & Scaffolding (Fundação)
**Objetivo:** Ambiente de desenvolvimento configurado e pipeline de qualidade ativo.
1.  Inicializar projeto Poetry.
2.  Configurar `pyproject.toml` com Ruff, Mypy e Pytest.
3.  Criar estrutura de diretórios.
4.  Implementar `adk --version` (Hello World do Typer).
5.  Configurar CI (GitHub Actions) básico.

### Fase 1: Core Engine (O Cérebro sem IA)
**Objetivo:** O sistema consegue gerenciar estado e manipular arquivos de forma determinística.
1.  **Memory System:** Implementar `CoreState` (Pydantic models) e persistência em JSON.
2.  **Toolbox:** Implementar wrappers seguros para File System e Shell.
3.  **Context Engine:** Implementar leitura básica de arquivos e integração inicial com `tree-sitter` ou `grep` inteligente.
4.  **Anti-Stub Protocol:** Implementar validadores de output (Regex para bloquear `TODOs`).

### Fase 2: CLI Interface & Agent Orchestrator (O Corpo)
**Objetivo:** O usuário consegue interagir com comandos e o sistema mantém sessões.
1.  **CLI Structure:** Implementar comandos `adk feature work <name>` (esqueleto).
2.  **Session Management:** Lógica de carregar/salvar sessões e locking de diretórios.
3.  **Orchestrator Loop:** Máquina de estados (Research -> Plan -> Implement) sem chamar LLM real (Mocked).
4.  **Interactive UI:** Spinners, tabelas e logs coloridos com `Rich`.

### Fase 3: Integração LLM & Prompts (A Mente)
**Objetivo:** Conectar o cérebro ao corpo via CLI nativo.
1.  **LLM Gateway:** Implementar wrapper para `claude -p --output-format stream-json`.
2.  **Prompt Engineering:** Portar prompts (System Prompts, Templates) para Jinja2 ou f-strings estruturadas.
3.  **Live Testing:** Executar fluxos reais invocando o CLI nativo.
4.  **Compaction:** Implementar lógica de compactação de histórico (via `--settings` personalizados se necessário).

## 4. Migração de Conceitos (TS -> Python)

| Conceito ADK v2 (TS) | Implementação ADK v3 (Python) | Mudança Chave |
| :--- | :--- | :--- |
| `src/commands/*.ts` | `src/adk/cli/commands/*.py` | Typer (Decorators) vs Commander |
| `state.json` (Generic) | `CoreState` (Pydantic) | Validação estrita de schema no runtime |
| `read_file` (Raw text) | `ContextManager` (AST/Smart) | Análise semântica vs Dump de texto |
| `run_shell_command` | `SecureShell` (Subprocess) | Timeouts forçados e captura de stream |
| `console.log` | `Rich Console` | Output estruturado e visualmente hierárquico |
| `Manual XML/Prompts` | `Jinja2 Templates` | Separação lógica/template para prompts complexos |

## 5. Próximos Passos Imediatos

1.  Criar diretório `adk-py` (ou renomear root atual, estratégia a definir).
2.  Executar `poetry init`.
3.  Instalar dependências core: `typer`, `rich`, `pydantic`.
