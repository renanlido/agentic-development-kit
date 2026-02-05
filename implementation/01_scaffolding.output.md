# Fase 0: Setup & Scaffolding

Este documento contém os artefatos necessários para inicializar o projeto `adk-core` com a stack Python definida (Poetry, Typer, Rich, Pydantic).

## 1. Script de Inicialização (`setup.sh`)

Este script cria a estrutura de diretórios e inicializa o projeto com Poetry.

```bash
#!/bin/bash
set -e

PROJECT_NAME="adk-core"
PACKAGE_NAME="adk"

echo "🚀 Initializing $PROJECT_NAME..."

# 1. Create Directory Structure
echo "📂 Creating directory structure..."
mkdir -p $PROJECT_NAME/src/$PACKAGE_NAME/cli/commands
mkdir -p $PROJECT_NAME/src/$PACKAGE_NAME/core/{agent,memory,context,llm}
mkdir -p $PROJECT_NAME/src/$PACKAGE_NAME/infra
mkdir -p $PROJECT_NAME/src/$PACKAGE_NAME/utils
mkdir -p $PROJECT_NAME/tests/{unit,integration,e2e}

# 2. Initialize Git (if not exists)
if [ ! -d ".git" ]; then
    echo "git init"
    git init
fi

# 3. Create Configuration Files
cd $PROJECT_NAME

# .gitignore
echo "📄 Creating .gitignore..."
cat <<EOF > .gitignore
__pycache__/
*.py[cod]
*$py.class
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

.env
.venv
env/
virtualenv/
ENV/
env.bak/
virtualenv.bak/

.coverage
.tox/
.nox/
coverage.xml
*.cover
*.py,cover
.hypothesis/
.pytest_cache/
EOF

# README.md
echo "📄 Creating README.md..."
cat <<EOF > README.md
# ADK v3 Core

The Agentic Development Kit (ADK) Core Engine, rewritten in Python for robustness and determinism.

## Development

```bash
# Install dependencies
poetry install

# Run CLI
poetry run adk --help

# Run Tests
poetry run pytest
```
EOF

# pyproject.toml
echo "📄 Creating pyproject.toml..."
cat <<EOF > pyproject.toml
[tool.poetry]
name = "$PROJECT_NAME"
version = "0.1.0"
description = "ADK v3 Core Engine"
authors = ["ADK Team"]
readme = "README.md"
packages = [{include = "$PACKAGE_NAME", from = "src"}]

[tool.poetry.dependencies]
python = "^3.11"
tyer = {extras = ["all"], version = "^0.9.0"}
rich = "^13.7.0"
pydantic = "^2.6.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0.0"
pytest-cov = "^4.1.0"
ruff = "^0.2.0"
mypy = "^1.8.0"
pre-commit = "^3.6.0"

[tool.poetry.scripts]
adk = "adk.cli.main:app"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "B", "I", "N", "UP", "PL", "RUF"]
ignore = []

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
addopts = "--cov=adk --cov-report=term-missing"
testpaths = ["tests"]
EOF

# 4. Create Entry Points
echo "📄 Creating entry points..."

# src/adk/__init__.py
touch src/$PACKAGE_NAME/__init__.py

# src/adk/__main__.py
cat <<EOF > src/$PACKAGE_NAME/__main__.py
from adk.cli.main import app

if __name__ == "__main__":
    app()
EOF

# src/adk/cli/__init__.py
touch src/$PACKAGE_NAME/cli/__init__.py

# src/adk/cli/main.py
cat <<EOF > src/$PACKAGE_NAME/cli/main.py
import typer
from rich.console import Console

app = typer.Typer(
    name="adk",
    help="Agentic Development Kit v3 CLI",
    add_completion=False,
)
console = Console()

@app.command()
def version():
    """Show ADK version."""
    console.print("[bold blue]ADK v3.0.0[/bold blue]")

@app.command()
def info():
    """Show project info."""
    console.print("ADK Core Engine: [green]Active[/green]")

if __name__ == "__main__":
    app()
EOF

# 5. Install Dependencies
echo "📦 Installing dependencies..."
# Check if poetry is installed
if ! command -v poetry &> /dev/null;
    echo "Poetry not found. Installing..."
    curl -sSL https://install.python-poetry.org | python3 -
fi

poetry install

echo "✅ Setup complete! Try running:"
echo "cd $PROJECT_NAME && poetry run adk version"
```

## 2. Instruções de Execução

1.  Salve o script acima como `setup.sh` na raiz do repositório (fora de `adk-core` se quiser criar a pasta, ou dentro se já estiver nela).
2.  Dê permissão de execução: `chmod +x setup.sh`
3.  Execute: `./setup.sh`

## 3. Validação

Após a execução, entre no diretório e valide o ambiente:

```bash
cd adk-core

# 1. Verificar Linting
poetry run ruff check .

# 2. Verificar Tipagem
poetry run mypy .

# 3. Executar Testes (ainda não há testes, mas deve rodar sem erro de config)
poetry run pytest

# 4. Rodar CLI
poetry run adk version
```
