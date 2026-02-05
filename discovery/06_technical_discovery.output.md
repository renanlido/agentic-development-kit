# Direcionamento Técnico: Agentic Development Kit (ADK) - Python Reconstruction

## 1. Componentes Principais do Sistema

- **CLI Engine (Interface):** Baseada em `Typer` ou `Click`, responsável pelo parsing de comandos, interface rica no terminal (`Rich`) e interação com o usuário.
- **Context Manager (Inteligência de Dados):** Utiliza AST (Abstract Syntax Trees) e integração com LSP (Language Server Protocol) para entender o código sem carregar arquivos inteiros. Inclui um indexador local para busca semântica (RAG minimalista).
- **Agent Orchestrator (Cérebro):** Gerencia a máquina de estados das sessões, decompõe objetivos em tarefas atômicas e coordena o fluxo entre diferentes modelos de prompts.
- **Unified Toolbox (Ações):** Camada de abstração para operações de sistema (File System, Shell, Git). Garante que toda ação seja rastreável e passível de rollback.
- **LLM Gateway (Comunicação):** Interface baseada na execução do CLI nativo `claude-code` em modo headless (`-p` / `--output-format stream-json`). Esta abordagem herda o contexto e as permissões do CLI já configurado no sistema do usuário, evitando a gestão manual de API keys e tokens no início. Suporta streaming de eventos via JSON.

## 2. Modelo de Orquestração

- **Decomposição Estrita:** Objetivos complexos são obrigatoriamente quebrados em uma lista de tarefas (Task List) antes da execução.
- **Ciclo de Pensamento Explícito (Chain-of-Thought):** O sistema deve "pensar" em voz alta no terminal, justificando cada ação antes de executá-la.
- **Stateful Sessions:** O estado da tarefa é persistido em disco, permitindo retomar execuções interrompidas sem perda de contexto ou retrabalho.

## 3. Estratégia de Controle de Execução

- **Atomicidade via Git:** Cada "passo" bem-sucedido pode ser marcado ou commitado temporariamente, garantindo que o `undo` seja nativo e seguro.
- **Sandboxing de Comandos:** Execução de comandos shell com timeouts rigorosos e captura controlada de stdout/stderr para evitar poluição de contexto.
- **Human-in-the-loop (HITL):** Pontos de parada obrigatórios para aprovação de planos de ação, alterações em múltiplos arquivos ou comandos shell potencialmente perigosos.

## 4. Estratégia de Redução de Tokens

- **Selective Context Injection:** Envio apenas de snippets de código extraídos via AST/LSP em vez de arquivos completos.
- **Prompt Compaction:** Uso de system prompts modulares e compressão de histórico de conversa (sumarização de passos anteriores).
- **Context Caching:** Aproveitamento de recursos de caching de contexto dos provedores (ex: Anthropic Context Caching) para informações estáticas como documentação e regras de estilo.
- **Minimalist Tooling Output:** Ferramentas que retornam apenas o essencial (ex: "Testes passaram" em vez de 1000 linhas de log).

## 5. Estratégia de Testabilidade

- **LLM Mocking:** Suite de testes que utiliza respostas pré-gravadas (VCR style) para validar a lógica do orquestrador sem gastar tokens.
- **Golden Outputs:** Testes de regressão baseados em "resultados ideais" para tarefas comuns (ex: geração de um PRD padrão).
- **E2E Integration Tests:** Execução do framework em repositórios "lab" controlados para validar fluxos completos de criação de features.
- **Type Safety:** Uso rigoroso de Type Hints e validação com `mypy`/`pyright` para garantir a robustez do core em Python.
