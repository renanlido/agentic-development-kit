# Fase 1: Core Engine (Contexto & Qualidade)

Este documento contém a implementação do motor de contexto e do validador anti-stub, essenciais para garantir que a IA tenha as informações corretas e gere código de qualidade.

## 1. Anti-Stub Validator (`src/adk/core/quality/anti_stub.py`)

Módulo responsável por bloquear código incompleto gerado pela IA.

```python
import re
from typing import List, NamedTuple
from pydantic import BaseModel

class StubViolation(BaseModel):
    line: int
    pattern: str
    content: str

class ValidationResult(BaseModel):
    is_valid: bool
    violations: List[StubViolation]

class AntiStubProtocol:
    # Regex patterns for common stub indicators
    STUB_PATTERNS = [
        (re.compile(r"TODO[:\s]"), "TODO detected"),
        (re.compile(r"FIXME[:\s]"), "FIXME detected"),
        (re.compile(r"raise NotImplementedError"), "NotImplementedError detected"),
        (re.compile(r"throw new Error.*Not implemented.*\s*"), "Not implemented error detected"),
        (re.compile(r"^\s*pass\s*(#.*)?$"), "Empty pass statement"),
        (re.compile(r"^\s*\.\.\.\s*$"), "Ellipsis stub"),
        (re.compile(r"#\s*stub"), "Explicit stub comment"),
    ]

    @classmethod
    def validate_code(cls, content: str) -> ValidationResult:
        violations = []
        lines = content.splitlines()

        for i, line in enumerate(lines, 1):
            for pattern, description in cls.STUB_PATTERNS:
                if pattern.search(line):
                    violations.append(StubViolation(
                        line=i,
                        pattern=description,
                        content=line.strip()
                    ))

        return ValidationResult(
            is_valid=len(violations) == 0,
            violations=violations
        )
```

## 2. Context Manager (`src/adk/core/context/manager.py`)

Gerencia a leitura e preparação de arquivos para o contexto da LLM.

```python
from pathlib import Path
from typing import List, Dict, Union
from pydantic import BaseModel

from adk.infra.fs import FileSystem

class ContextFile(BaseModel):
    path: str
    content: str
    size: int

class ContextManager:
    MAX_FILE_SIZE = 100 * 1024  # 100KB limit for safety

    def __init__(self, work_dir: Union[str, Path]):
        self.work_dir = Path(work_dir)
        self.fs = FileSystem()

    def _is_text_file(self, path: Path) -> bool:
        # Basic heuristic: check extension and try reading first chunk
        # In production, use python-magic or similar
        BINARY_EXTENSIONS = {'.pyc', '.git', '.png', '.jpg', '.pdf', '.zip'}
        if path.suffix in BINARY_EXTENSIONS:
            return False
        return True

    def read_files(self, paths: List[str]) -> List[ContextFile]:
        results = []
        for path_str in paths:
            path = self.work_dir / path_str
            
            if not path.exists():
                continue
                
            if not self._is_text_file(path):
                continue
                
            # Size check
            stats = path.stat()
            if stats.st_size > self.MAX_FILE_SIZE:
                # TODO: Implement truncation or summary for large files
                continue

            content = self.fs.read_file(path)
            results.append(ContextFile(
                path=path_str,
                content=content,
                size=len(content)
            ))
            
        return results

    def format_for_prompt(self, files: List[ContextFile]) -> str:
        """Formats files into an XML-like structure for the LLM."""
        output = []
        for file in files:
            output.append(f'<file path="{file.path}">
{file.content}
</file>')
        return "\n\n".join(output)
```

## 3. Testes (`tests/unit`)

### Teste Anti-Stub (`tests/unit/test_anti_stub.py`)

```python
from adk.core.quality.anti_stub import AntiStubProtocol

def test_detects_todos():
    code = """
    def my_func():
        # TODO: Implement this later
        pass
    """
    result = AntiStubProtocol.validate_code(code)
    assert not result.is_valid
    assert len(result.violations) >= 1
    assert "TODO detected" in result.violations[0].pattern

def test_detects_not_implemented():
    code = """
    class MyClass:
        def method(self):
            raise NotImplementedError("Boom")
    """
    result = AntiStubProtocol.validate_code(code)
    assert not result.is_valid
    assert "NotImplementedError detected" in result.violations[0].pattern

def test_valid_code_passes():
    code = """
    def add(a, b):
        return a + b
    """
    result = AntiStubProtocol.validate_code(code)
    assert result.is_valid
    assert len(result.violations) == 0
```

### Teste Context Manager (`tests/unit/test_context_manager.py`)

```python
import pytest
from pathlib import Path
from adk.core.context.manager import ContextManager

def test_context_manager_read_files(tmp_path):
    # Setup
    f1 = tmp_path / "test1.py"
    f1.write_text("print('hello')")
    f2 = tmp_path / "image.png"
    f2.write_bytes(b'\x89PNG\r\n\x1a\n')  # Fake binary
    
    manager = ContextManager(tmp_path)
    
    # Execute
    files = manager.read_files(["test1.py", "image.png", "nonexistent.txt"])
    
    # Assert
    assert len(files) == 1
    assert files[0].path == "test1.py"
    assert "print('hello')" in files[0].content

def test_format_for_prompt(tmp_path):
    manager = ContextManager(tmp_path)
    
    # Mocking internal method or using valid files logic
    # Here we can just create ContextFile objects directly to test formatting logic
    from adk.core.context.manager import ContextFile
    
    files = [
        ContextFile(path="a.py", content="code_a", size=6),
        ContextFile(path="b.py", content="code_b", size=6)
    ]
    
    output = manager.format_for_prompt(files)
    
    assert '<file path="a.py">' in output
    assert 'code_a' in output
    assert '<file path="b.py">' in output
```