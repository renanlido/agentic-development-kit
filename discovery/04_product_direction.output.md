# Direcionamento do Produto: Agentic Development Kit (ADK)

## 1. Visão do Produto
O ADK v3 deve ser o **Sistema Operacional da Engenharia de Software Assistida por IA**. Ele não é uma ferramenta de chat ou um gerador de código, mas um framework de orquestração determinístico que aplica rigor de engenharia (CADD - Context-Agentic Development & Delivery) para garantir que mudanças no código sejam precisas, idiomáticas e seguras, operando como um "Principal Engineer" virtual que trabalha lado a lado com o desenvolvedor humano no terminal.

## 2. Princípios Inegociáveis
- **Contexto como Ativo Escasso:** Cada token enviado deve ter um propósito. O sistema deve priorizar a extração cirúrgica de contexto (AST/LSP) sobre o despejo massivo de arquivos.
- **Determinismo sobre Criatividade:** Em tarefas de engenharia, a previsibilidade é mais valiosa que a inventividade. O sistema deve falhar explicitamente antes de alucinar ou realizar ações destrutivas.
- **Soberania do Desenvolvedor (HITL):** O desenvolvedor humano é o árbitro final. O ADK propõe, valida e executa sob supervisão clara, nunca operando em "autonomia silenciosa".
- **Integridade e Padronização:** O código gerado deve ser indistinguível do código escrito pelos melhores desenvolvedores do projeto, respeitando padrões, linting e arquitetura sem exceções.

## 3. Estratégia de Evolução

### Manter
- **Abordagem CLI-First:** O terminal como centro de gravidade da produtividade.
- **Fluxo de Feature (Research/Plan/Implement):** A separação clara entre pensar e executar.
- **Integração Nativa com Git:** Uso do Git como mecanismo de rollback e checkpoint.

### Matar
- **Context Dumps:** O envio de arquivos `.ts`/`.py` inteiros sem necessidade.
- **Autopilot Reativo:** Loops de tentativa e erro que queimam tokens sem progresso real.
- **Instabilidade Local:** Dependência de múltiplos processos e estados em memória não persistidos.

### Criar
- **Dynamic Tiered Memory:** Um sistema de memória em camadas (Projeto > Feature > Sessão) que injeta apenas o necessário no System Prompt.
- **Anti-Stub Protocol:** Bloqueio mecânico de "TODOs" e implementações parciais geradas pela IA.
- **Deterministic Execution Engine:** Um motor de execução em Python que garante que cada passo seja validado (Test/Lint) antes de prosseguir.
- **Token Efficiency Analytics:** Dashboard no terminal mostrando o "ROI de Contexto" de cada tarefa.

## 4. Roadmap de Alto Nível (Sem Prazos)

### Fase 1: Estabilização do Core (Python)
- Portabilidade da lógica de orquestração para Python visando robustez.
- Implementação do Core State persistence (sessões resilientes).

### Fase 2: Gestão Cirúrgica de Contexto
- Integração com AST/LSP para leitura inteligente de código.
- Sistema de Tiered Memory (Injection vs Recall).

### Fase 3: Rigor e Qualidade (Anti-Stub)
- Implementação de Quality Gates ativos e protocolos de auto-correção.
- Integração profunda com ferramentas de teste e análise estática.

### Fase 4: Ecossistema e Colaboração
- Sincronização de progresso entre múltiplos desenvolvedores.
- Extensibilidade via Skills e Agentes customizados.