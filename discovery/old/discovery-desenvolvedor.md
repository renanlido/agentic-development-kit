# Discovery Orientado a Desenvolvedores - ADK

Este documento detalha a visão do produto sob a perspectiva do desenvolvedor, identificando perfis, fluxos críticos e expectativas de valor.

## 2. Discovery Orientado a Desenvolvedores

### 2.1 Perfis de Usuário

*   **Solo Dev:**
    *   **Objetivo:** Maximizar a velocidade de entrega individual.
    *   **Uso do ADK:** Automação de boilerplate, documentação rápida e execução de tarefas repetitivas.
    *   **Necessidade:** Uma ferramenta que seja seu "copiloto avançado", mantendo o estado de múltiplas tarefas sem que ele perca o foco.

*   **Senior Dev:**
    *   **Objetivo:** Garantir qualidade técnica e consistência na arquitetura.
    *   **Uso do ADK:** Refatorações complexas, planejamento técnico detalhado (Specs) e automação de testes.
    *   **Necessidade:** Controle fino sobre o contexto injetado e rastreabilidade total das decisões tomadas pela IA.

*   **Tech Lead:**
    *   **Objetivo:** Padronização de processos e visibilidade do progresso.
    *   **Uso do ADK:** Geração de PRDs a partir de discovery, revisão automatizada de código e mapeamento de dependências.
    *   **Necessidade:** Relatórios estruturados e garantia de que os agentes seguem as diretrizes do projeto.

### 2.2 Fluxos Críticos

1.  **Inicialização de Projeto (`adk init`):**
    *   O ponto de entrada onde o ADK entende a stack, padrões e cultura de código do projeto.
2.  **Discovery Guiado:**
    *   Uso de agentes especializados para ler a base de código e extrair regras de negócio, arquitetura e débitos técnicos.
3.  **Geração de PRD / Spec:**
    *   Transformar uma intenção de alto nível em um documento técnico estruturado pronto para implementação.
4.  **Planejamento Técnico:**
    *   Decomposição de uma Feature em Tasks granulares e gerenciáveis, estimando complexidade.
5.  **Execução Assistida (Autopilot/Feature):**
    *   O ciclo de implementação onde a IA escreve código, executa testes e itera até a conclusão.
6.  **Review Automatizado:**
    *   Validação da implementação contra a Spec original e os padrões de lint/estilo do projeto.

### 2.3 Pontos de Fricção Atuais

*   **Onde o usuário perde confiança:**
    *   Quando o "Autopilot" falha silenciosamente ou entra em loops infinitos.
    *   Instabilidade na execução de comandos shell que modificam o sistema de arquivos sem clareza.
*   **Onde o sistema perde contexto:**
    *   Em tarefas de longa duração onde o histórico de chat se torna muito grande e a IA começa a alucinar ou esquecer restrições iniciais.
    *   Fragmentação entre as versões v1, v2 e v3 do CLI.
*   **Onde o custo explode:**
    *   Gestão ineficiente de tokens, enviando arquivos inteiros ou contextos desnecessários repetidamente para a API.
    *   Spawn excessivo de processos locais consumindo recursos da máquina.

### 2.4 Expectativa Real do Usuário

*   **O que ele espera automatizar:**
    *   Sincronização entre documentação e código.
    *   Criação de testes unitários e de integração.
    *   Boilerplate de novas funcionalidades.
    *   Mapeamento de impacto de mudanças em grandes bases de código.
*   **O que ele nunca quer perder controle:**
    *   Decisões arquiteturais críticas.
    *   Aprovação final de código que vai para produção.
    *   Segurança de dados sensíveis e segredos (API Keys, etc).
    *   A escolha final de "como" resolver um problema lógico complexo.
