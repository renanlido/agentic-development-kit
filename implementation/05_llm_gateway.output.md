# Fase 3: Integração LLM (via Claude CLI)

Este documento implementa a conexão com a Inteligência Artificial utilizando o CLI nativo `claude-code` em modo headless.

## 1. Setup de Dependências

Adicionar ao `pyproject.toml` (via `poetry add`):
- `jinja2` (Templating)
- `python-dotenv` (Environment Variables - para outras configs se necessário)

*Nota: Não é necessário `litellm` ou SDKs de terceiros, pois usaremos o CLI via subprocess.*

## 2. LLM Gateway (`src/adk/core/llm/gateway.py`)

Wrapper para execução do comando `claude`.

```python
import subprocess
import json
import os
from typing import List, Dict, Any, Optional
from adk.utils.logger import logger

class LLMGateway:
    def __init__(self, model: Optional[str] = None):
        self.model = model

    def complete(self, prompt: str, **kwargs) -> str:
        """
        Executa uma chamada ao Claude Code CLI em modo headless.
        """
        args = [
            "claude",
            "-p", prompt,
            "--dangerously-skip-permissions",
            "--output-format", "json"
        ]

        if self.model:
            args.extend(["--model", self.model])

        try:
            logger.debug(f"Executando CLI: {' '.join(args)}")
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                check=True
            )
            
            # O output JSON do claude contém o resultado no campo esperado
            data = json.loads(result.stdout)
            # Ajustar conforme o schema real do 'claude --output-format json'
            return data.get("completion", data.get("result", ""))
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Erro ao chamar Claude CLI: {e.stderr}")
            raise RuntimeError(f"Claude CLI falhou: {e.stderr}")
        except json.JSONDecodeError:
            logger.error("Falha ao parsear output JSON do Claude")
            raise RuntimeError("Output inválido do Claude CLI")

    def stream_complete(self, prompt: str, on_event=None):
        """
        Versão streaming usando 'stream-json'.
        """
        args = [
            "claude",
            "-p", prompt,
            "--dangerously-skip-permissions",
            "--output-format", "stream-json"
        ]
        
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        full_output = []
        for line in process.stdout:
            if not line.strip():
                continue
            try:
                event = json.loads(line)
                if on_event:
                    on_event(event)
                # Acumular texto se disponível no evento
                if "content" in event:
                    full_output.append(event["content"])
            except json.JSONDecodeError:
                continue

        process.wait()
        return "".join(full_output)
```

## 3. Prompt Manager (`src/adk/core/llm/prompts.py`)

Sistema de renderização de templates permanece similar, focado em gerar o prompt final para o CLI.

```python
from pathlib import Path
from typing import Dict, Any
from jinja2 import Environment, FileSystemLoader, select_autoescape

class PromptManager:
    def __init__(self, templates_dir: str = "src/adk/templates"):
        self.env = Environment(
            loader=FileSystemLoader(templates_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )

    def render(self, template_name: str, context: Dict[str, Any]) -> str:
        """
        Renders a Jinja2 template with the given context.
        """
        template = self.env.get_template(template_name)
        return template.render(**context)
```

## 4. Templates (`src/adk/templates/`)

### `system_base.j2`

```jinja
Role: Expert Software Engineer.
Context: You are working on {{ project_name }}.
Task: {{ task_description }}

Current State:
{{ state_summary }}

Instructions:
1. Provide complete code.
2. No stubs.
3. Be concise.
```

## 5. Exemplo de Uso (Integração)

```python
# src/adk/core/agent/orchestrator.py

from adk.core.llm.gateway import LLMGateway
from adk.core.llm.prompts import PromptManager

class AgentOrchestrator:
    def __init__(self, live_mode: bool = False):
        self.llm = LLMGateway() if live_mode else None
        self.prompts = PromptManager()

    def execute_step(self, task):
        prompt = self.prompts.render("system_base.j2", {
            "project_name": "ADK-V3",
            "task_description": task.description,
            "state_summary": "Initial scaffolding"
        })
        
        if self.llm:
            response = self.llm.complete(prompt)
            print(f"AI Response: {response}")
```

## 6. Autenticação

O `claude-code` CLI gerencia a autenticação localmente. Certifique-se de estar logado:
```bash
claude login
```
Não é necessário passar `auth_token` ou `ANTHROPIC_API_KEY` via variáveis de ambiente para o ADK, a menos que o CLI as utilize internamente.