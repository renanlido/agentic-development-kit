# Direcionamento Técnico - ADK

Este documento estabelece as diretrizes técnicas para a reconstrução e evolução do Agentic Development Kit (ADK), focando em estabilidade, eficiência de custos e controle de execução.

## 4. Direcionamento Técnico

### 4.1 Arquitetura Recomendada (Alto Nível)
A nova arquitetura deve priorizar a separação de responsabilidades para garantir que o sistema seja robusto e extensível.
- **CLI como Camada de Controle:** Interface leve em Python para interação com o usuário, focada em UX e rapidez de resposta.
- **Core Orchestrator:** Gerenciador central de estado e fluxo de trabalho, responsável por coordenar as interações entre o desenvolvedor e os agentes.
- **Agent Runtime:** Ambiente isolado e controlado para a execução de agentes, permitindo diferentes estratégias de raciocínio.
- **Prompt Templates Versionados:** Armazenamento de prompts como artefatos de código, permitindo evolução controlada e testes A/B.
- **Execution Sandbox:** Ambiente seguro para execução de comandos shell e modificações de arquivos, prevenindo efeitos colaterais indesejados no sistema do hospedeiro.

### 4.2 Controle de Execução
Para resolver a fragilidade da execução e o spawn excessivo de processos identificados no diagnóstico:
- **Limite de Spawn:** Mecanismo rigoroso para controlar o número de processos simultâneos, evitando sobrecarga da máquina do desenvolvedor.
- **Orquestração Síncrona vs. Assíncrona Explícita:** Definição clara de quais tarefas bloqueiam a CLI e quais rodam em background, com feedback visual constante.
- **Cancelamento e Rollback:** Capacidade de interromper qualquer tarefa em execução e reverter mudanças no sistema de arquivos em caso de falha ou interrupção pelo usuário.

### 4.3 Estratégias de Redução de Tokens
Endereçando o alto custo operacional e a perda de contexto:
- **Contexto Mínimo por Agente:** Em vez de enviar arquivos inteiros, utilizar técnicas de "chunking" e busca semântica para injetar apenas o necessário.
- **Cache Semântico:** Armazenamento local de resultados de inferências comuns para evitar chamadas repetitivas à API.
- **Prompts Determinísticos:** Estruturação de prompts para obter respostas consistentes e concisas, minimizando o "raciocínio" desnecessário na saída final.
- **Separação de Raciocínio e Output:** Diferenciar o log de pensamento da IA do resultado acionável, permitindo processar apenas o output relevante para o sistema.

### 4.4 Testabilidade
Garantindo a qualidade técnica e a confiança do desenvolvedor sênior:
- **Agentes Testáveis Isoladamente:** Cada agente deve ser capaz de ser executado e validado em um ambiente de teste com inputs e outputs simulados.
- **Prompts como Artefatos Versionados:** Garantir que mudanças no comportamento da IA sejam rastreáveis via Git, assim como o código.
- **Simulação de Execução sem IA (Dry Run):** Capacidade de rodar fluxos de trabalho usando mocks de IA para validar a lógica de orquestração e ferramentas sem custo de tokens.

## 5. Próximos Passos Técnicos
1. Definição da stack Python e estrutura de diretórios do novo Core.
2. Implementação do sistema de logs e rastreabilidade (Tracing).
3. Criação do primeiro protótipo de Sandbox para comandos `git` e `fs`.
