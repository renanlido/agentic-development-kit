# Fase 2: CLI & Orchestrator

Este documento implementa a "espinha dorsal" do ADK: a CLI interativa e o orquestrador que gerencia o fluxo de trabalho.

## 1. Session Management (`src/adk/core/session.py`)

Gerencia o carregamento e persistência do estado da sessão.

```python
from pathlib import Path
from typing import Optional
from adk.core.memory.manager import StateManager
from adk.core.memory.types import CoreState

class SessionManager:
    def __init__(self, feature_name: str):
        self.feature_name = feature_name
        self.state_manager = StateManager(feature_name)
        self._active_state: Optional[CoreState] = None

    def __enter__(self):
        # Future: Implement file lock here to prevent concurrent runs
        self.load()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Release lock
        pass

    def load(self) -> CoreState:
        self._active_state = self.state_manager.load()
        return self._active_state

    def save(self) -> None:
        if self._active_state:
            self.state_manager.save(self._active_state)

    @property
    def state(self) -> CoreState:
        if not self._active_state:
            raise RuntimeError("Session not loaded. Use 'with SessionManager(...)'.")
        return self._active_state
```

## 2. Agent Orchestrator (`src/adk/core/agent/orchestrator.py`)

A máquina de estados que controla o fluxo.

```python
import time
from enum import Enum
from rich.console import Console
from rich.status import Status

from adk.core.session import SessionManager
from adk.core.memory.types import TaskState

console = Console()

class AgentPhase(str, Enum):
    RESEARCH = "research"
    PLAN = "plan"
    IMPLEMENT = "implement"
    QA = "qa"
    COMPLETED = "completed"

class AgentOrchestrator:
    def __init__(self, session: SessionManager):
        self.session = session
        self.state = session.state

    def run_loop(self):
        """Executes the main agent loop."""
        
        while True:
            current_phase = self._determine_phase()
            
            console.print(f"[bold blue]Phase:[/bold blue] {current_phase.upper()}")
            
            if current_phase == AgentPhase.COMPLETED:
                console.print("[bold green]Feature Completed![/bold green]")
                break
                
            self._execute_phase(current_phase)
            
            # Auto-save after each step
            self.session.save()
            
            # Safety break for dev/mock
            if current_phase == AgentPhase.QA: 
                 # Just to stop the infinite loop in this mock version
                 # In real version, QA passes or fails, leading to completion or more implementation
                 break 

    def _determine_phase(self) -> AgentPhase:
        # Simple heuristic state machine for now
        # In real implementation, this checks specific flags in CoreState
        if not self.state.current_task:
            return AgentPhase.RESEARCH
        
        if self.state.current_task.status == "pending":
            return AgentPhase.IMPLEMENT
            
        if self.state.current_task.status == "in_progress":
            return AgentPhase.IMPLEMENT
            
        return AgentPhase.QA

    def _execute_phase(self, phase: AgentPhase):
        with console.status(f"[bold yellow]Running {phase}...[/bold yellow]") as status:
            # Simulation of LLM work
            time.sleep(1) 
            
            if phase == AgentPhase.RESEARCH:
                console.log("🔍 Analyzing requirements...")
                # Mock: Decide to start a task
                self.state.current_task = TaskState(
                    id="1", 
                    description="Scaffold project structure",
                    status="in_progress"
                )
                console.log("✅ Research complete. Plan generated.")
                
            elif phase == AgentPhase.IMPLEMENT:
                console.log("🔨 Writing code...")
                # Mock: Finish the task
                if self.state.current_task:
                    self.state.current_task.status = "completed"
                console.log("✅ Implementation step done.")
                
            elif phase == AgentPhase.QA:
                console.log("🧪 Running tests...")
                # Mock: Tests pass
                console.log("✅ QA Passed.")
```

## 3. CLI Commands (`src/adk/cli/commands/feature.py`)

O comando exposto ao usuário.

```python
import typer
from rich.prompt import Confirm
from adk.core.session import SessionManager
from adk.core.agent.orchestrator import AgentOrchestrator

app = typer.Typer()

@app.command()
def work(
    name: str = typer.Argument(..., help="Name of the feature to work on"),
    resume: bool = typer.Option(True, help="Resume existing session")
):
    """
    Start or resume work on a feature using the Agentic Workflow.
    """
    try:
        with SessionManager(name) as session:
            orchestrator = AgentOrchestrator(session)
            
            typer.echo(f"Starting work on feature: {name}")
            typer.echo(f"Session ID: {session.state.session_id}")
            
            if not resume and session.state.current_task:
                if not Confirm.ask("Existing session found. Overwrite?"):
                    raise typer.Abort()
            
            orchestrator.run_loop()
            
    except KeyboardInterrupt:
        typer.echo("\n\n🛑 Work paused. Session saved.")
    except Exception as e:
        typer.echo(f"\n❌ Error: {e}")
        raise typer.Exit(code=1)
```

## 4. Registro no Main (`src/adk/cli/main.py`)

Atualização necessária no arquivo principal.

```python
# Adicionar imports
from adk.cli.commands import feature

# ... (setup anterior)

# Registrar subcomando
app.add_typer(feature.app, name="feature", help="Manage features")

if __name__ == "__main__":
    app()
```