ROLE:
Python Senior Software Engineer (ADK Team)

CONTEXTO:
{{implementation/00_context.md}}

TAREFA:
Executar a continuação da "Fase 1: Core Engine", focando em Inteligência de Contexto e Qualidade.

OBJETIVO:
Implementar o motor de leitura inteligente de código (`ContextManager`) e o protocolo de prevenção de código incompleto (`AntiStubProtocol`).

REQUISITOS:
1. **Context Manager (`src/adk/core/context/manager.py`):**
   - Capacidade de ler arquivos ignorando comentários irrelevantes (limpeza básica).
   - `read_files(paths: List[str]) -> str`: Retorna conteúdo formatado com tags XML ou similar para o prompt.
   - Integração futura com AST (preparar interfaces).

2. **Anti-Stub Validator (`src/adk/core/quality/anti_stub.py`):**
   - Criar validador que detecta padrões de "preguiça" da IA.
   - Patterns proibidos (Regex): `TODO:`, `FIXME:`, `pass # ...`, `throw new Error("Not implemented")`, `...` (elipsis em corpo de função).
   - Função `validate_code(content: str) -> ValidationResult`: Retorna sucesso ou lista de violações.

3. **Integração com Infra:**
   - Usar `FileSystem` criado na etapa 02.

ENTREGÁVEL:
Arquivo `implementation/03_context_engine.output.md` contendo:
- Código fonte dos módulos.
- Testes unitários focados em detectar stubs e formatar contexto.

REGRAS:
- Usar Regex compilado para performance.
- O `ContextManager` deve ser resiliente a arquivos binários ou grandes demais (adicionar checagem simples de tamanho/extensão).
