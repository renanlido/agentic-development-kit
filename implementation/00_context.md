# Contexto de Implementação ADK v3

Este arquivo centraliza o contexto para os agentes de implementação, garantindo alinhamento com o Discovery.

## Referências Cruciais
- **Contexto Geral:** {{discovery/00_context.md}}
- **Diagnóstico:** {{discovery/02_product_diagnostic.output.md}}
- **Visão de Produto:** {{discovery/04_product_direction.output.md}}
- **Direcionamento Técnico:** {{discovery/06_technical_discovery.output.md}}
- **Plano Mestre Python:** {{discovery/08_python_implementation_plan.output.md}}

## Estratégia de Implementação
- **Stack:** Python 3.11+, Poetry, Typer, Rich, Pydantic, Ruff, Mypy.
- **Filosofia:** "Strict by Default" (Tipagem forte, validação agressiva).
- **Estrutura:** Layout `src/`, modularidade por domínio (`agent`, `memory`, `infra`).
