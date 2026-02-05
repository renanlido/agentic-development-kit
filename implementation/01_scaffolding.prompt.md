ROLE:
Python DevOps & Architecture Specialist

CONTEXTO:
{{implementation/00_context.md}}

TAREFA:
Executar a "Fase 0: Setup & Scaffolding" do plano de implementação.

OBJETIVO:
Gerar um script shell robusto e arquivos de configuração iniciais para estruturar o projeto Python `adk-core`.

REQUISITOS:
1. Estrutura de Diretórios: Criar layout `src` conforme definido no plano mestre.
2. Gerenciamento de Dependências: Configurar `pyproject.toml` usando Poetry.
   - Dependências: `typer`, `rich`, `pydantic`.
   - Dev-Dependencies: `ruff`, `mypy`, `pytest`, `pytest-cov`, `pre-commit`.
3. Configuração de Ferramentas:
   - `ruff.toml` (ou seção no pyproject.toml) para linting agressivo.
   - `mypy.ini` (ou seção no pyproject.toml) para strict mode.
4. Git Integration: `.gitignore` padrão para Python/Poetry.
5. Entry Point: Um "Hello World" funcional usando Typer em `src/adk/__main__.py` e `src/adk/cli/main.py`.

ENTREGÁVEL:
Arquivo Markdown `implementation/01_scaffolding.output.md` contendo:
- `setup.sh`: Script bash para criar pastas e rodar poetry init/install.
- Conteúdo dos arquivos de configuração (`pyproject.toml`, `README.md`, `.gitignore`, etc).
- Instruções de validação (`make check` ou comandos similares).

REGRAS:
- O script deve ser idempotente (checar se diretório existe).
- Usar versões recentes e estáveis das libs.
- Garantir que o pacote se chame `adk` mas o projeto `adk-core`.