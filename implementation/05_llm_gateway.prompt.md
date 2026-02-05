ROLE:
Python Senior Software Engineer (ADK Team)

CONTEXTO:
{{implementation/00_context.md}}

TAREFA:
Executar a "Fase 3: Integração LLM & Prompts".

OBJETIVO:
Conectar o ADK aos provedores de LLM reais e implementar o sistema de templates de prompt.

REQUISITOS:
1. **LLM Gateway (`src/adk/core/llm/gateway.py`):**
   - Usar `liteLLM` (ou `anthropic` SDK) para chamadas.
   - Implementar retry exponencial (usando `tenacity`).
   - `complete(messages: List[Dict], model: str) -> str`.

2. **Prompt System (`src/adk/core/llm/prompts.py`):**
   - Usar `Jinja2` para renderizar templates.
   - Criar classe `PromptManager` que carrega templates de `src/adk/templates/`.
   - Exemplo de template: `system_prompt.j2` (com injeção de `CoreState`).

3. **Live Integration:**
   - Atualizar o `AgentOrchestrator` (da Fase 2) para usar o `LLMGateway` real em vez do mock, se uma flag for passada (ex: `--live`).

ENTREGÁVEL:
Arquivo `implementation/05_llm_gateway.output.md` contendo:
- Código fonte do Gateway e PromptManager.
- Exemplo de template Jinja2.
- Instruções de como configurar API KEY via `.env`.

REGRAS:
- Nunca commitar chaves de API. Usar `python-dotenv`.
- O Gateway deve logar custos (token usage) se possível.
