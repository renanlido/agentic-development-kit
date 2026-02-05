# Fase 1: Core Engine (Fundação)

Este documento contém a implementação dos módulos fundamentais do ADK v3: Gerenciamento de Estado, Infraestrutura de Arquivos e Execução de Shell.

## 1. Configuração Global (`src/adk/config.py`)

Define constantes e configurações do projeto.

```python
from pathlib import Path
from pydantic import BaseModel

class ADKConfig(BaseModel):
    APP_NAME: str = "adk-core"
    VERSION: str = "0.1.0"
    WORK_DIR: Path = Path.cwd()
    ADK_DIR: Path = Path(".adk")
    MEMORY_DIR: str = "memory"
    
    @property
    def adk_path(self) -> Path:
        return self.WORK_DIR / self.ADK_DIR

settings = ADKConfig()
```

## 2. Core Memory (`src/adk/core/memory`)

### Tipos (`src/adk/core/memory/types.py`)

```python
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class TaskState(BaseModel):
    id: str
    description: str
    status: str = "pending"  # pending, in_progress, completed, failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class CoreState(BaseModel):
    schema_version: str = "1.0"
    feature_name: str
    session_id: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    current_task: Optional[TaskState] = None
    recent_decisions: List[str] = Field(default_factory=list)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
```

### Manager (`src/adk/core/memory/manager.py`)

```python
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional

from adk.core.memory.types import CoreState, TaskState
from adk.config import settings

class StateManager:
    def __init__(self, feature_name: str):
        self.feature_name = feature_name
        self.base_path = settings.adk_path / settings.MEMORY_DIR / feature_name
        self.state_file = self.base_path / "core-state.json"
        self._ensure_dir()

    def _ensure_dir(self):
        self.base_path.mkdir(parents=True, exist_ok=True)

    def load(self) -> CoreState:
        if not self.state_file.exists():
            return self._create_default()
        
        try:
            with open(self.state_file, "r") as f:
                data = json.load(f)
            return CoreState(**data)
        except (json.JSONDecodeError, OSError):
            # Fallback or error handling strategy
            return self._create_default()

    def save(self, state: CoreState) -> None:
        state.updated_at = datetime.utcnow()
        temp_file = self.state_file.with_suffix(".tmp")
        
        # Atomic write
        with open(temp_file, "w") as f:
            f.write(state.model_dump_json(indent=2))
        
        shutil.move(str(temp_file), str(self.state_file))

    def _create_default(self) -> CoreState:
        return CoreState(
            feature_name=self.feature_name,
            session_id=f"sess-{int(datetime.utcnow().timestamp())}"
        )

    def update_task(self, task: TaskState) -> CoreState:
        state = self.load()
        state.current_task = task
        self.save(state)
        return state
```

## 3. Infraestrutura (`src/adk/infra`)

### File System (`src/adk/infra/fs.py`)

```python
from pathlib import Path
from typing import Union, List

class FileSystem:
    @staticmethod
    def read_file(path: Union[str, Path]) -> str:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {path}")
        return p.read_text(encoding="utf-8")

    @staticmethod
    def write_file(path: Union[str, Path], content: str) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        
    @staticmethod
    def list_files(directory: Union[str, Path], pattern: str = "*") -> List[Path]:
        p = Path(directory)
        if not p.exists():
            return []
        return list(p.rglob(pattern))
```

### Shell Segura (`src/adk/infra/shell.py`)

```python
import subprocess
import shlex
from typing import Tuple, Optional
from dataclasses import dataclass

@dataclass
class ShellResult:
    stdout: str
    stderr: str
    exit_code: int
    command: str

class SecureShell:
    @staticmethod
    def run(
        command: str, 
        cwd: Optional[str] = None, 
        timeout: int = 60
    ) -> ShellResult:
        try:
            # Using shlex to split command safely if needed, but run expects string for shell=True
            # or list for shell=False. Using shell=True for flexibility but caution is needed.
            # Here we prefer shell=False with split args for security if possible, 
            # but for complex commands shell=True is often required in CLI tools.
            # Let's use shell=True but assume the agent provides safe commands.
            
            process = subprocess.run(
                command,
                cwd=cwd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return ShellResult(
                stdout=process.stdout,
                stderr=process.stderr,
                exit_code=process.returncode,
                command=command
            )
        except subprocess.TimeoutExpired:
            return ShellResult(
                stdout="",
                stderr="Command timed out",
                exit_code=124,
                command=command
            )
        except Exception as e:
            return ShellResult(
                stdout="",
                stderr=str(e),
                exit_code=1,
                command=command
            )
```

## 4. Testes (`tests/unit`)

### Teste State Manager (`tests/unit/test_state_manager.py`)

```python
import pytest
from pathlib import Path
from adk.core.memory.manager import StateManager
from adk.core.memory.types import TaskState

def test_state_manager_create_default(tmp_path):
    # Mock settings to use tmp_path
    from adk import config
    config.settings.WORK_DIR = tmp_path
    
    manager = StateManager("test-feature")
    state = manager.load()
    
    assert state.feature_name == "test-feature"
    assert state.session_id.startswith("sess-")
    assert state.current_task is None

def test_state_manager_persistence(tmp_path):
    from adk import config
    config.settings.WORK_DIR = tmp_path
    
    manager = StateManager("test-feature")
    
    # Save
    task = TaskState(id="1", description="Test Task")
    manager.update_task(task)
    
    # Reload
    new_manager = StateManager("test-feature")
    loaded_state = new_manager.load()
    
    assert loaded_state.current_task is not None
    assert loaded_state.current_task.id == "1"
    assert loaded_state.current_task.description == "Test Task"
```

### Teste Shell (`tests/unit/test_shell.py`)

```python
from adk.infra.shell import SecureShell

def test_shell_echo():
    result = SecureShell.run("echo 'hello'")
    assert result.exit_code == 0
    assert "hello" in result.stdout

def test_shell_timeout():
    # Sleep 2s, timeout 1s
    result = SecureShell.run("sleep 2", timeout=1)
    assert result.exit_code == 124
    assert "timed out" in result.stderr
```
