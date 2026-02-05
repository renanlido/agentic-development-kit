import typer
from rich.console import Console

app = typer.Typer(
    name="adk",
    help="Agentic Development Kit v3 CLI",
    add_completion=False,
)
console = Console()

@app.command()
def version() -> None:
    """Show ADK version."""
    console.print("[bold blue]ADK v3.0.0[/bold blue]")

@app.command()
def info() -> None:
    """Show project info."""
    console.print("ADK Core Engine: [green]Active[/green]")

if __name__ == "__main__":
    app()