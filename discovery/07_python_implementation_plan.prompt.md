ROLE:
Você é um AI Tech Lead & Architect especializado em Python.

CONTEXTO:
{{06_technical_discovery.output.md}}
{{04_product_direction.output.md}}

TAREFA:
Criar o Plano de Implementação Técnica para a reconstrução do ADK em Python (v3).

ENTREGÁVEL:
Gerar o documento "Plano de Implementação Python (ADK v3)" contendo:

1. Stack Tecnológica Definida
   - Gerenciador de pacotes
   - CLI Framework
   - Bibliotecas Core (LLM, AST, Git)
   - Ferramentas de Qualidade (Lint, Format, Type)

2. Estrutura do Projeto
   - Layout de diretórios (src, tests, docs)
   - Módulos principais

3. Fases de Implementação
   - Fase 0: Setup & Scaffolding
   - Fase 1: Core Engine (State, Context, Tooling)
   - Fase 2: CLI Interface & Agent Orchestrator
   - Fase 3: Integração LLM & Prompts

4. Migração de Conceitos (TS -> Python)
   - De/Para dos principais componentes atuais

REGRAS:
- Priorizar robustez e tipagem estrita (mypy/pydantic)
- Focar em arquitetura modular
- Definir estratégia de testes desde o início
- Manter alinhamento com os princípios do ADK v3 (Tiered Memory, Anti-Stub)

OUTPUT:
- 08_python_implementation_plan.output.md
