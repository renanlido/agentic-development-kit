from adk.cli.main import app
from typer.testing import CliRunner

runner = CliRunner()

def test_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "ADK v3.0.0" in result.stdout
